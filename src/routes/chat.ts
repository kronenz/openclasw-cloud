import { Hono } from 'hono';
import type { Bindings, Variables, ApiResponse, AiTextResponse } from '../types/index.js';
import { withErrorHandler, validationError } from '../utils/error-handler.js';
import { getTenant } from '../db/queries.js';
import {
  createConversationMessage,
  getConversationMessages,
  getRecentConversationMessages,
  listConversationSessions,
  deleteConversationSession,
} from '../db/queries-chat.js';
import { generateId } from '../utils/id.js';
import { soulR2Key, DEFAULT_AI_MODEL, AI_MAX_TOKENS_DEFAULT, DEFAULT_AI_SYSTEM_PROMPT, ERROR_CODES, MAX_MESSAGE_LENGTH } from '../config/constants.js';
import { structuredLog, structuredError } from '../utils/log.js';

const chat = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Helper function to run AI inference with conversation context
async function runAiInferenceWithContext(
  ai: Ai,
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
): Promise<string> {
  try {
    const aiResult = await ai.run(DEFAULT_AI_MODEL, {
      messages,
      max_tokens: AI_MAX_TOKENS_DEFAULT,
    });
    return (aiResult as AiTextResponse).response || '죄송합니다. 응답을 생성할 수 없습니다.';
  } catch (error) {
    structuredError('ai_inference_failed', error);
    return '죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
  }
}

// POST /api/chat/:tenantId - Send message and get AI response
chat.post('/:tenantId', withErrorHandler('chat_message_failed', async (c) => {
  const tenantId = c.req.param('tenantId');

  // Validate tenant
  const tenant = await getTenant(c.env.DB, tenantId);
  if (!tenant || tenant.status !== 'active') {
    return c.json<ApiResponse>({
      success: false,
      error: 'Tenant not found or inactive',
      code: ERROR_CODES.TENANT_NOT_FOUND,
    }, 404);
  }

  // Parse request body
  const body = await c.req.json();
  const { message, session_id } = body as { message?: string; session_id?: string };

  // Validate message
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return validationError(c, 'Message is required and must be non-empty');
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return validationError(c, `Message too long (max ${MAX_MESSAGE_LENGTH} characters)`);
  }

  // Generate or validate session ID
  const sessionId = session_id && typeof session_id === 'string' && session_id.trim().length > 0
    ? session_id
    : generateId('session');

  structuredLog('chat_message_received', {
    tenantId,
    sessionId,
    messageLength: message.length,
  });

  // Get SOUL.md for this tenant
  const soulContent = await c.env.STORAGE.get(soulR2Key(tenantId));
  const soulText = soulContent ? await soulContent.text() : null;
  const systemPrompt = soulText || DEFAULT_AI_SYSTEM_PROMPT;

  // Load recent conversation history for context
  const recentMessages = await getRecentConversationMessages(c.env.DB, tenantId, sessionId, 20);

  // Build messages array for AI
  const aiMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
    { role: 'system', content: systemPrompt },
  ];

  // Add conversation history
  for (const msg of recentMessages) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      aiMessages.push({ role: msg.role, content: msg.content });
    }
  }

  // Add current user message
  aiMessages.push({ role: 'user', content: message });

  // Call AI with full context
  const responseText = await runAiInferenceWithContext(c.env.AI, aiMessages);

  // Store user message
  const userMessageId = generateId('msg');
  await createConversationMessage(c.env.DB, {
    id: userMessageId,
    tenant_id: tenantId,
    session_id: sessionId,
    role: 'user',
    content: message,
  });

  // Store AI response
  const assistantMessageId = generateId('msg');
  await createConversationMessage(c.env.DB, {
    id: assistantMessageId,
    tenant_id: tenantId,
    session_id: sessionId,
    role: 'assistant',
    content: responseText,
  });

  structuredLog('chat_message_completed', {
    tenantId,
    sessionId,
    userMessageId,
    assistantMessageId,
  });

  return c.json<ApiResponse>({
    success: true,
    data: {
      session_id: sessionId,
      response: responseText,
      message_id: assistantMessageId,
    },
  });
}));

// GET /api/chat/:tenantId/history - Get conversation history
chat.get('/:tenantId/history', withErrorHandler('chat_history_failed', async (c) => {
  const tenantId = c.req.param('tenantId');
  const sessionId = c.req.query('session_id');
  const limitStr = c.req.query('limit');
  const limit = limitStr ? parseInt(limitStr, 10) : 50;

  // Validate tenant
  const tenant = await getTenant(c.env.DB, tenantId);
  if (!tenant || tenant.status !== 'active') {
    return c.json<ApiResponse>({
      success: false,
      error: 'Tenant not found or inactive',
      code: ERROR_CODES.TENANT_NOT_FOUND,
    }, 404);
  }

  // Validate limit
  if (isNaN(limit) || limit < 1 || limit > 500) {
    return validationError(c, 'Limit must be between 1 and 500');
  }

  // If session_id provided, return messages for that session
  if (sessionId && typeof sessionId === 'string' && sessionId.trim().length > 0) {
    const messages = await getConversationMessages(c.env.DB, tenantId, sessionId, limit);

    return c.json<ApiResponse>({
      success: true,
      data: {
        session_id: sessionId,
        messages,
      },
    });
  }

  // Otherwise, return list of sessions
  const sessions = await listConversationSessions(c.env.DB, tenantId, limit);

  return c.json<ApiResponse>({
    success: true,
    data: {
      sessions,
    },
  });
}));

// DELETE /api/chat/:tenantId/history/:sessionId - Clear a session
chat.delete('/:tenantId/history/:sessionId', withErrorHandler('chat_delete_session_failed', async (c) => {
  const tenantId = c.req.param('tenantId');
  const sessionId = c.req.param('sessionId');

  // Validate tenant
  const tenant = await getTenant(c.env.DB, tenantId);
  if (!tenant || tenant.status !== 'active') {
    return c.json<ApiResponse>({
      success: false,
      error: 'Tenant not found or inactive',
      code: ERROR_CODES.TENANT_NOT_FOUND,
    }, 404);
  }

  // Validate session ID
  if (!sessionId || sessionId.trim().length === 0) {
    return validationError(c, 'Session ID is required');
  }

  // Delete the session
  await deleteConversationSession(c.env.DB, tenantId, sessionId);

  structuredLog('chat_session_deleted', {
    tenantId,
    sessionId,
  });

  return c.json<ApiResponse>({
    success: true,
    data: {
      session_id: sessionId,
      deleted: true,
    },
  });
}));

export { chat };
