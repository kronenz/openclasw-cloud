import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithTimeout } from '../../../src/utils/fetch.js';

describe('fetchWithTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should successfully fetch when response is within timeout', async () => {
    const mockResponse = new Response('success', { status: 200 });
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse);

    const promise = fetchWithTimeout('https://example.com/api');
    await vi.runAllTimersAsync();
    const response = await promise;

    expect(response).toBe(mockResponse);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://example.com/api',
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    );
  });

  it('should trigger abort when timeout is exceeded', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(
      (_url, options) => {
        const signal = (options as RequestInit)?.signal as AbortSignal;
        return new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        });
      }
    );

    const promise = fetchWithTimeout('https://example.com/slow', {}, 1000);

    // Fast-forward past the timeout
    await vi.advanceTimersByTimeAsync(1001);

    await expect(promise).rejects.toThrow('The operation was aborted.');
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('should clear timeout on successful fetch', async () => {
    const mockResponse = new Response('success');
    vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse);
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

    const promise = fetchWithTimeout('https://example.com/api');
    await vi.runAllTimersAsync();
    await promise;

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('should use custom timeout when provided', async () => {
    const mockResponse = new Response('success');
    vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse);
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

    const customTimeout = 5000;
    const promise = fetchWithTimeout('https://example.com/api', {}, customTimeout);
    await vi.runAllTimersAsync();
    await promise;

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), customTimeout);
  });

  it('should use default timeout when not provided', async () => {
    const mockResponse = new Response('success');
    vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse);
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

    const promise = fetchWithTimeout('https://example.com/api');
    await vi.runAllTimersAsync();
    await promise;

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 10_000);
  });

  it('should forward request options correctly', async () => {
    const mockResponse = new Response('success');
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse);

    const options: RequestInit = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: 'data' }),
    };

    const promise = fetchWithTimeout('https://example.com/api', options);
    await vi.runAllTimersAsync();
    await promise;

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://example.com/api',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' }),
        signal: expect.any(AbortSignal),
      })
    );
  });

  it('should clear timeout even when fetch throws an error', async () => {
    const fetchError = new Error('Network error');
    vi.spyOn(global, 'fetch').mockRejectedValue(fetchError);
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

    const promise = fetchWithTimeout('https://example.com/api');
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow('Network error');
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

});
