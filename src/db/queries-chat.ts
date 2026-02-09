// OpenClasw Cloud D1 Query Helpers - Chat Conversations
import { nowISO } from '../utils/id.js';

export interface ConversationMessage {
  id: string;
  tenant_id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export interface ConversationSession {
  session_id: string;
  last_message_at: string;
  message_count: number;
}

/**
 * Create a new conversation message
 */
export async function createConversationMessage(
  db: D1Database,
  message: Omit<ConversationMessage, 'created_at'>
): Promise<ConversationMessage> {
  const now = nowISO();
  const stmt = db
    .prepare(
      `INSERT INTO conversations (id, tenant_id, session_id, role, content, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(
      message.id,
      message.tenant_id,
      message.session_id,
      message.role,
      message.content,
      now
    );

  await stmt.run();

  return {
    ...message,
    created_at: now,
  };
}

/**
 * Get conversation messages for a session
 */
export async function getConversationMessages(
  db: D1Database,
  tenantId: string,
  sessionId: string,
  limit: number = 50
): Promise<ConversationMessage[]> {
  const stmt = db
    .prepare(
      `SELECT * FROM conversations
       WHERE tenant_id = ? AND session_id = ?
       ORDER BY created_at ASC
       LIMIT ?`
    )
    .bind(tenantId, sessionId, limit);

  const result = await stmt.all<ConversationMessage>();
  return result.results || [];
}

/**
 * Get recent messages for AI context (limited to last N messages)
 */
export async function getRecentConversationMessages(
  db: D1Database,
  tenantId: string,
  sessionId: string,
  limit: number = 20
): Promise<ConversationMessage[]> {
  const stmt = db
    .prepare(
      `SELECT * FROM conversations
       WHERE tenant_id = ? AND session_id = ?
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .bind(tenantId, sessionId, limit);

  const result = await stmt.all<ConversationMessage>();
  // Reverse to get chronological order (oldest first)
  return (result.results || []).reverse();
}

/**
 * List conversation sessions for a tenant
 */
export async function listConversationSessions(
  db: D1Database,
  tenantId: string,
  limit: number = 50
): Promise<ConversationSession[]> {
  const stmt = db
    .prepare(
      `SELECT
         session_id,
         MAX(created_at) as last_message_at,
         COUNT(*) as message_count
       FROM conversations
       WHERE tenant_id = ?
       GROUP BY session_id
       ORDER BY last_message_at DESC
       LIMIT ?`
    )
    .bind(tenantId, limit);

  const result = await stmt.all<ConversationSession>();
  return result.results || [];
}

/**
 * Delete all messages in a conversation session
 */
export async function deleteConversationSession(
  db: D1Database,
  tenantId: string,
  sessionId: string
): Promise<void> {
  const stmt = db
    .prepare(
      `DELETE FROM conversations
       WHERE tenant_id = ? AND session_id = ?`
    )
    .bind(tenantId, sessionId);

  await stmt.run();
}

/**
 * Count total messages in a session
 */
export async function countConversationMessages(
  db: D1Database,
  tenantId: string,
  sessionId: string
): Promise<number> {
  const stmt = db
    .prepare(
      `SELECT COUNT(*) as count FROM conversations
       WHERE tenant_id = ? AND session_id = ?`
    )
    .bind(tenantId, sessionId);

  const result = await stmt.first<{ count: number }>();
  return result?.count ?? 0;
}
