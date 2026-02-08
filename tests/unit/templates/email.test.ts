import { describe, it, expect } from 'vitest';
import { generateWelcomeEmail } from '../../../src/templates/email/welcome.js';
import { generateReEngagementEmail } from '../../../src/templates/email/re-engagement.js';
import { generateUpsellEmail } from '../../../src/templates/email/upsell.js';

describe('generateWelcomeEmail', () => {
  const validData = {
    tenantName: 'Test Company',
    contactName: 'John Doe',
    subdomain: 'testco',
    plan: 'Pro',
    apiKey: 'sk_test_1234567890abcdef',
    dashboardUrl: 'https://testco.openclaw.ai/dashboard',
  };

  it('returns object with subject, html, text fields', () => {
    const result = generateWelcomeEmail(validData);
    expect(result).toHaveProperty('subject');
    expect(result).toHaveProperty('html');
    expect(result).toHaveProperty('text');
    expect(typeof result.subject).toBe('string');
    expect(typeof result.html).toBe('string');
    expect(typeof result.text).toBe('string');
  });

  it('subject contains tenant name', () => {
    const result = generateWelcomeEmail(validData);
    expect(result.subject).toContain('Test Company');
  });

  it('HTML contains all provided data', () => {
    const result = generateWelcomeEmail(validData);
    expect(result.html).toContain('John Doe');
    expect(result.html).toContain('Test Company');
    expect(result.html).toContain('testco');
    expect(result.html).toContain('Pro');
    expect(result.html).toContain('sk_test_1234567890abcdef');
  });

  it('text contains all provided data', () => {
    const result = generateWelcomeEmail(validData);
    expect(result.text).toContain('John Doe');
    expect(result.text).toContain('Test Company');
    expect(result.text).toContain('testco');
    expect(result.text).toContain('Pro');
    expect(result.text).toContain('sk_test_1234567890abcdef');
  });

  it('prevents XSS in contactName', () => {
    const xssData = { ...validData, contactName: '<script>alert(1)</script>' };
    const result = generateWelcomeEmail(xssData);
    expect(result.html).not.toContain('<script>alert(1)</script>');
    expect(result.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('prevents XSS in tenantName', () => {
    const xssData = { ...validData, tenantName: '<img src=x onerror=alert(1)>' };
    const result = generateWelcomeEmail(xssData);
    expect(result.html).not.toContain('<img src=x onerror=alert(1)>');
    expect(result.html).toContain('&lt;img');
  });

  it('prevents XSS in plan', () => {
    const xssData = { ...validData, plan: '"><script>alert(1)</script>' };
    const result = generateWelcomeEmail(xssData);
    expect(result.html).not.toContain('"><script>alert(1)</script>');
    expect(result.html).toContain('&quot;&gt;&lt;script&gt;');
  });

  it('prevents XSS in subdomain', () => {
    const xssData = { ...validData, subdomain: 'test<script>' };
    const result = generateWelcomeEmail(xssData);
    expect(result.html).not.toContain('test<script>');
    expect(result.html).toContain('test&lt;script&gt;');
  });

  it('prevents XSS in apiKey', () => {
    const xssData = { ...validData, apiKey: 'key<script>alert(1)</script>' };
    const result = generateWelcomeEmail(xssData);
    expect(result.html).not.toContain('key<script>alert(1)</script>');
    expect(result.html).toContain('key&lt;script&gt;');
  });

  it('does not escape URL in href attribute', () => {
    const result = generateWelcomeEmail(validData);
    expect(result.html).toContain(`href="${validData.dashboardUrl}"`);
  });
});

describe('generateReEngagementEmail', () => {
  const validParams = {
    tenantName: 'Test Company',
    contactName: 'Jane Smith',
    inactiveDays: 14,
    dashboardUrl: 'https://testco.openclaw.ai/dashboard',
  };

  it('returns object with subject, html, text fields', () => {
    const result = generateReEngagementEmail(validParams);
    expect(result).toHaveProperty('subject');
    expect(result).toHaveProperty('html');
    expect(result).toHaveProperty('text');
    expect(typeof result.subject).toBe('string');
    expect(typeof result.html).toBe('string');
    expect(typeof result.text).toBe('string');
  });

  it('subject contains contact name and tenant name', () => {
    const result = generateReEngagementEmail(validParams);
    expect(result.subject).toContain('Jane Smith');
    expect(result.subject).toContain('Test Company');
  });

  it('HTML contains all provided data', () => {
    const result = generateReEngagementEmail(validParams);
    expect(result.html).toContain('Jane Smith');
    expect(result.html).toContain('Test Company');
    expect(result.html).toContain('14');
  });

  it('text contains all provided data', () => {
    const result = generateReEngagementEmail(validParams);
    expect(result.text).toContain('Jane Smith');
    expect(result.text).toContain('Test Company');
    expect(result.text).toContain('14');
  });

  it('prevents XSS in contactName', () => {
    const xssParams = { ...validParams, contactName: '<script>alert(1)</script>' };
    const result = generateReEngagementEmail(xssParams);
    expect(result.html).not.toContain('<script>alert(1)</script>');
    expect(result.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('prevents XSS in tenantName', () => {
    const xssParams = { ...validParams, tenantName: '<svg onload=alert(1)>' };
    const result = generateReEngagementEmail(xssParams);
    expect(result.html).not.toContain('<svg onload=alert(1)>');
    expect(result.html).toContain('&lt;svg');
  });
});

describe('generateUpsellEmail', () => {
  const validParams = {
    tenantName: 'Test Corp',
    contactName: 'Bob Johnson',
    currentPlan: 'Starter',
    nextPlan: 'Professional',
    usagePercent: 85.7,
    currentTokens: 85700,
    currentLimit: 100000,
    nextPlanPrice: 99000,
    nextPlanLimit: 500000,
    dashboardUrl: 'https://testcorp.openclaw.ai/dashboard',
  };

  it('returns object with subject, html, text fields', () => {
    const result = generateUpsellEmail(validParams);
    expect(result).toHaveProperty('subject');
    expect(result).toHaveProperty('html');
    expect(result).toHaveProperty('text');
    expect(typeof result.subject).toBe('string');
    expect(typeof result.html).toBe('string');
    expect(typeof result.text).toBe('string');
  });

  it('subject contains tenant name', () => {
    const result = generateUpsellEmail(validParams);
    expect(result.subject).toContain('Test Corp');
  });

  it('HTML contains all provided data', () => {
    const result = generateUpsellEmail(validParams);
    expect(result.html).toContain('Bob Johnson');
    expect(result.html).toContain('Test Corp');
    expect(result.html).toContain('Starter');
    expect(result.html).toContain('Professional');
  });

  it('text contains all provided data', () => {
    const result = generateUpsellEmail(validParams);
    expect(result.text).toContain('Bob Johnson');
    expect(result.text).toContain('Test Corp');
    expect(result.text).toContain('Starter');
    expect(result.text).toContain('Professional');
  });

  it('formats usagePercent correctly in HTML', () => {
    const result = generateUpsellEmail(validParams);
    expect(result.html).toContain('86%'); // 85.7 rounds to 86
  });

  it('formats token counts with thousand separators in HTML', () => {
    const result = generateUpsellEmail(validParams);
    expect(result.html).toContain('85,700');
    expect(result.html).toContain('100,000');
    expect(result.html).toContain('500,000');
  });

  it('formats price correctly in HTML', () => {
    const result = generateUpsellEmail(validParams);
    expect(result.html).toContain('99,000');
  });

  it('prevents XSS in contactName', () => {
    const xssParams = { ...validParams, contactName: '<script>alert(1)</script>' };
    const result = generateUpsellEmail(xssParams);
    expect(result.html).not.toContain('<script>alert(1)</script>');
    expect(result.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('prevents XSS in tenantName', () => {
    const xssParams = { ...validParams, tenantName: '"><img src=x onerror=alert(1)>' };
    const result = generateUpsellEmail(xssParams);
    expect(result.html).not.toContain('"><img src=x onerror=alert(1)>');
    expect(result.html).toContain('&quot;&gt;&lt;img');
  });

  it('prevents XSS in currentPlan', () => {
    const xssParams = { ...validParams, currentPlan: 'Plan<script>alert(1)</script>' };
    const result = generateUpsellEmail(xssParams);
    expect(result.html).not.toContain('Plan<script>alert(1)</script>');
    expect(result.html).toContain('Plan&lt;script&gt;');
  });

  it('prevents XSS in nextPlan', () => {
    const xssParams = { ...validParams, nextPlan: '<svg onload=alert(1)>' };
    const result = generateUpsellEmail(xssParams);
    expect(result.html).not.toContain('<svg onload=alert(1)>');
    expect(result.html).toContain('&lt;svg');
  });

  it('handles high usage percent correctly', () => {
    const highUsageParams = { ...validParams, usagePercent: 95.5 };
    const result = generateUpsellEmail(highUsageParams);
    expect(result.html).toContain('96%'); // 95.5 rounds to 96
  });
});
