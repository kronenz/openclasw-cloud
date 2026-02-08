import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TelegramBot } from '../../../src/services/telegram-bot.js';
import type { Bindings } from '../../../src/types/index.js';
import { createMockEnv } from '../../helpers/mocks.js';

// Mock the structuredError utility
vi.mock('../../../src/utils/log.js', () => ({
  structuredError: vi.fn(),
  formatErrorMessage: (error: unknown) => error instanceof Error ? error.message : String(error),
}));

import { structuredError } from '../../../src/utils/log.js';

describe('TelegramBot', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('setBotToken', () => {
    it('stores bot token in KV cache', async () => {
      const env = createMockEnv();
      const bot = new TelegramBot(env);

      await bot.setBotToken('tn_test123', 'bot_token_abc123');

      expect(env.CACHE.put).toHaveBeenCalledWith(
        'telegram:bot:tn_test123',
        'bot_token_abc123'
      );
    });
  });

  describe('handleUpdate', () => {
    it('processes valid text message and sends AI response', async () => {
      const env = createMockEnv();
      vi.spyOn(env.CACHE, 'get').mockResolvedValue('bot_token_test');
      vi.spyOn(env.STORAGE, 'get').mockResolvedValue({
        text: async () => '# SOUL.md\n\n당신은 친절한 AI 비서입니다.',
      } as any);
      vi.spyOn(env.AI, 'run').mockResolvedValue({
        response: '안녕하세요! 무엇을 도와드릴까요?',
      });

      const bot = new TelegramBot(env);

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, result: { message_id: 123 } }),
      });
      global.fetch = fetchMock;

      const update = {
        update_id: 1,
        message: {
          message_id: 1,
          chat: { id: 12345, type: 'private' },
          from: { id: 67890, first_name: 'Test User', username: 'testuser' },
          text: '안녕하세요',
          date: Math.floor(Date.now() / 1000),
        },
      };

      await bot.handleUpdate('tn_test123', update);

      expect(env.CACHE.get).toHaveBeenCalledWith('telegram:bot:tn_test123');
      expect(env.STORAGE.get).toHaveBeenCalledWith('tenants/tn_test123/SOUL.md');
      expect(env.AI.run).toHaveBeenCalledWith(
        '@cf/meta/llama-3.1-8b-instruct',
        expect.objectContaining({
          messages: [
            { role: 'system', content: '# SOUL.md\n\n당신은 친절한 AI 비서입니다.' },
            { role: 'user', content: '안녕하세요' },
          ],
          max_tokens: 1000,
        })
      );
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.telegram.org/botbot_token_test/sendMessage',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.chat_id).toBe(12345);
      expect(callBody.text).toBe('안녕하세요! 무엇을 도와드릴까요?');
      expect(callBody.parse_mode).toBe('Markdown');
    });

    it('uses fallback prompt when SOUL.md does not exist', async () => {
      const env = createMockEnv();
      vi.spyOn(env.CACHE, 'get').mockResolvedValue('bot_token_test');
      vi.spyOn(env.STORAGE, 'get').mockResolvedValue(null);
      vi.spyOn(env.AI, 'run').mockResolvedValue({
        response: '네, 도와드리겠습니다.',
      });

      const bot = new TelegramBot(env);

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      });
      global.fetch = fetchMock;

      const update = {
        update_id: 1,
        message: {
          message_id: 1,
          chat: { id: 12345, type: 'private' },
          text: '도움이 필요해요',
          date: Math.floor(Date.now() / 1000),
        },
      };

      await bot.handleUpdate('tn_test123', update);

      expect(env.AI.run).toHaveBeenCalledWith(
        '@cf/meta/llama-3.1-8b-instruct',
        expect.objectContaining({
          messages: [
            { role: 'system', content: '당신은 친절한 AI 비서입니다. 한국어로 응답하세요.' },
            { role: 'user', content: '도움이 필요해요' },
          ],
        })
      );
    });

    it('skips processing when message has no text', async () => {
      const env = createMockEnv();
      const bot = new TelegramBot(env);

      const fetchMock = vi.fn();
      global.fetch = fetchMock;

      const update = {
        update_id: 1,
        message: {
          message_id: 1,
          chat: { id: 12345, type: 'private' },
          date: Math.floor(Date.now() / 1000),
        },
      };

      await bot.handleUpdate('tn_test123', update);

      expect(env.CACHE.get).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('skips processing when update has no message', async () => {
      const env = createMockEnv();
      const bot = new TelegramBot(env);

      const fetchMock = vi.fn();
      global.fetch = fetchMock;

      const update = {
        update_id: 1,
      };

      await bot.handleUpdate('tn_test123', update);

      expect(env.CACHE.get).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns early when bot token is not found', async () => {
      const env = createMockEnv();
      vi.spyOn(env.CACHE, 'get').mockResolvedValue(null);

      const bot = new TelegramBot(env);

      const fetchMock = vi.fn();
      global.fetch = fetchMock;

      const update = {
        update_id: 1,
        message: {
          message_id: 1,
          chat: { id: 12345, type: 'private' },
          text: 'Hello',
          date: Math.floor(Date.now() / 1000),
        },
      };

      await bot.handleUpdate('tn_test123', update);

      expect(structuredError).toHaveBeenCalledWith(
        'telegram_no_bot_token',
        expect.any(Error),
        { tenantId: 'tn_test123' }
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('sends error message when AI processing fails', async () => {
      const env = createMockEnv();
      vi.spyOn(env.CACHE, 'get').mockResolvedValue('bot_token_test');
      vi.spyOn(env.STORAGE, 'get').mockResolvedValue(null);
      vi.spyOn(env.AI, 'run').mockRejectedValue(new Error('AI Gateway error'));

      const bot = new TelegramBot(env);

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      });
      global.fetch = fetchMock;

      const update = {
        update_id: 1,
        message: {
          message_id: 1,
          chat: { id: 12345, type: 'private' },
          text: '안녕하세요',
          date: Math.floor(Date.now() / 1000),
        },
      };

      await bot.handleUpdate('tn_test123', update);

      expect(structuredError).toHaveBeenCalledWith(
        'telegram_ai_failed',
        expect.any(Error)
      );

      const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
      const callBody = JSON.parse(lastCall[1].body);
      expect(callBody.text).toContain('죄송합니다. 일시적인 오류가 발생했습니다.');
    });

    it('sends default response when AI returns no response', async () => {
      const env = createMockEnv();
      vi.spyOn(env.CACHE, 'get').mockResolvedValue('bot_token_test');
      vi.spyOn(env.STORAGE, 'get').mockResolvedValue(null);
      vi.spyOn(env.AI, 'run').mockResolvedValue({});

      const bot = new TelegramBot(env);

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      });
      global.fetch = fetchMock;

      const update = {
        update_id: 1,
        message: {
          message_id: 1,
          chat: { id: 12345, type: 'private' },
          text: '테스트',
          date: Math.floor(Date.now() / 1000),
        },
      };

      await bot.handleUpdate('tn_test123', update);

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.text).toBe('죄송합니다. 잠시 후 다시 시도해 주세요.');
    });
  });

  describe('registerWebhook', () => {
    it('registers webhook URL successfully', async () => {
      const env = createMockEnv();
      const bot = new TelegramBot(env);

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, result: true }),
      });
      global.fetch = fetchMock;

      const result = await bot.registerWebhook(
        'bot_token_test',
        'https://example.com/webhook/telegram'
      );

      expect(result).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.telegram.org/botbot_token_test/setWebhook',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.url).toBe('https://example.com/webhook/telegram');
    });

    it('returns false when webhook registration fails', async () => {
      const env = createMockEnv();
      const bot = new TelegramBot(env);

      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ ok: false, description: 'Invalid webhook URL' }),
      });
      global.fetch = fetchMock;

      const result = await bot.registerWebhook(
        'bot_token_invalid',
        'invalid-url'
      );

      expect(result).toBe(false);
    });
  });

  describe('sendMessage error handling', () => {
    it('logs error when sendMessage fails', async () => {
      const env = createMockEnv();
      vi.spyOn(env.CACHE, 'get').mockResolvedValue('bot_token_test');
      vi.spyOn(env.STORAGE, 'get').mockResolvedValue(null);
      vi.spyOn(env.AI, 'run').mockResolvedValue({ response: 'Test response' });

      const bot = new TelegramBot(env);

      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ ok: false, description: 'Chat not found' }),
      });
      global.fetch = fetchMock;

      const update = {
        update_id: 1,
        message: {
          message_id: 1,
          chat: { id: 12345, type: 'private' },
          text: 'Test',
          date: Math.floor(Date.now() / 1000),
        },
      };

      await bot.handleUpdate('tn_test123', update);

      expect(structuredError).toHaveBeenCalledWith(
        'telegram_send_failed',
        expect.any(Error)
      );
    });
  });
});
