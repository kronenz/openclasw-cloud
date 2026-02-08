import { describe, it, expect } from 'vitest';
import { escapeHtml } from '../../../src/utils/html.js';

describe('escapeHtml', () => {
  it('escapes ampersand character', () => {
    expect(escapeHtml('A & B')).toBe('A &amp; B');
  });

  it('escapes less-than character', () => {
    expect(escapeHtml('a < b')).toBe('a &lt; b');
  });

  it('escapes greater-than character', () => {
    expect(escapeHtml('a > b')).toBe('a &gt; b');
  });

  it('escapes double quote character', () => {
    expect(escapeHtml('Say "hello"')).toBe('Say &quot;hello&quot;');
  });

  it('escapes single quote character', () => {
    expect(escapeHtml("It's here")).toBe('It&#x27;s here');
  });

  it('returns empty string for empty input', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('returns string unchanged if no special chars', () => {
    const plain = 'Hello World 123';
    expect(escapeHtml(plain)).toBe(plain);
  });

  it('handles strings with multiple special chars', () => {
    expect(escapeHtml('<script>alert("XSS")</script>'))
      .toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
  });

  it('escapes complex HTML injection attempt', () => {
    const malicious = `<img src=x onerror='alert(1)'>`;
    expect(escapeHtml(malicious))
      .toBe('&lt;img src=x onerror=&#x27;alert(1)&#x27;&gt;');
  });

  it('escapes all characters in correct order (ampersand first)', () => {
    expect(escapeHtml('&<>"\''))
      .toBe('&amp;&lt;&gt;&quot;&#x27;');
  });
});
