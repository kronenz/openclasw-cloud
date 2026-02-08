import type { Bindings } from '../types/index.js';
import { generateId } from '../utils/id.js';
import { fetchWithTimeout } from '../utils/fetch.js';
import { structuredLog } from '../utils/log.js';
import { CLOUDFLARE_API_BASE, API_TIMEOUT_LONG } from '../config/constants.js';

interface CfApiConfig {
  apiToken: string;
  accountId: string;
}

interface CfResourceResult {
  id: string;
  name: string;
}

export class CloudflareApi {
  private config: CfApiConfig;

  constructor(env: Bindings) {
    this.config = {
      apiToken: env.CF_API_TOKEN || '',
      accountId: env.CF_ACCOUNT_ID || '',
    };
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${CLOUDFLARE_API_BASE}/${this.config.accountId}${path}`;
    const res = await fetchWithTimeout(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.config.apiToken}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    }, API_TIMEOUT_LONG);

    const data = await res.json() as { success: boolean; result: T; errors: Array<{ code: number; message: string }> };
    if (!data.success) {
      throw new Error(`CF API error: ${JSON.stringify(data.errors)}`);
    }
    return data.result;
  }

  private isConfigured(): boolean {
    return !!(this.config.apiToken && this.config.accountId);
  }

  private ensureConfigured(): void {
    if (!this.config.apiToken || !this.config.accountId) {
      throw new Error('Cloudflare API is not configured. Set CF_API_TOKEN and CF_ACCOUNT_ID environment variables.');
    }
  }

  async createD1Database(name: string): Promise<CfResourceResult> {
    if (!this.isConfigured()) {
      const id = generateId('d1');
      structuredLog('cf_api_d1_simulated', { name, id });
      return { id, name };
    }
    this.ensureConfigured();
    // Real Cloudflare API call: POST /d1/database with { name }
    // This would be replaced with actual fetch call when credentials are configured
    const result = await this.request<CfResourceResult>('/d1/database', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    structuredLog('cf_api_d1_created', { name, id: result.id });
    return result;
  }

  async createKvNamespace(title: string): Promise<CfResourceResult> {
    if (!this.isConfigured()) {
      const id = generateId('kv');
      structuredLog('cf_api_kv_simulated', { title, id });
      return { id, name: title };
    }
    this.ensureConfigured();
    // Real Cloudflare API call: POST /storage/kv/namespaces with { title }
    // This would be replaced with actual fetch call when credentials are configured
    const result = await this.request<{ id: string }>('/storage/kv/namespaces', {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
    structuredLog('cf_api_kv_created', { title, id: result.id });
    return { id: result.id, name: title };
  }

  async createR2Bucket(name: string): Promise<CfResourceResult> {
    if (!this.isConfigured()) {
      const id = generateId('r2');
      structuredLog('cf_api_r2_simulated', { name, id });
      return { id, name };
    }
    this.ensureConfigured();
    // Real Cloudflare API call: POST /r2/buckets with { name }
    // This would be replaced with actual fetch call when credentials are configured
    await this.request<void>('/r2/buckets', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    structuredLog('cf_api_r2_created', { name, id: name });
    return { id: name, name };
  }

  async createWorker(name: string, script?: string): Promise<CfResourceResult> {
    if (!this.isConfigured()) {
      const id = generateId('worker');
      structuredLog('cf_api_worker_simulated', { name, id });
      return { id, name };
    }
    this.ensureConfigured();
    // Real Cloudflare API call: PUT /workers/scripts/{name} with multipart form data
    // This would be replaced with actual fetch call when credentials are configured
    const workerScript = script || `export default { fetch() { return new Response('OK'); } }`;
    const formData = new FormData();
    formData.append('metadata', JSON.stringify({
      main_module: 'index.js',
      compatibility_date: '2026-02-08',
    }));
    formData.append('index.js', new Blob([workerScript], { type: 'application/javascript+module' }), 'index.js');

    const url = `${CLOUDFLARE_API_BASE}/${this.config.accountId}/workers/scripts/${name}`;
    const res = await fetchWithTimeout(url, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${this.config.apiToken}` },
      body: formData,
    }, API_TIMEOUT_LONG);

    if (!res.ok) {
      throw new Error(`Worker creation failed: ${await res.text()}`);
    }
    structuredLog('cf_api_worker_created', { name, id: name });
    return { id: name, name };
  }

  // Create all resources for a tenant
  // Real Cloudflare API call: Provision D1, KV, R2, and Worker resources via parallel API calls
  async provisionTenantResources(tenantId: string, subdomain: string): Promise<{
    worker: CfResourceResult;
    d1: CfResourceResult;
    kv: CfResourceResult;
    r2: CfResourceResult;
  }> {
    const prefix = `oc-${subdomain}`;
    structuredLog('cf_api_provision_start', { tenantId, subdomain, prefix });

    const [worker, d1, kv, r2] = await Promise.all([
      this.createWorker(`${prefix}-worker`),
      this.createD1Database(`${prefix}-db`),
      this.createKvNamespace(`${prefix}-kv`),
      this.createR2Bucket(`${prefix}-storage`),
    ]);

    structuredLog('cf_api_provision_complete', { tenantId, worker: worker.id, d1: d1.id, kv: kv.id, r2: r2.id });
    return { worker, d1, kv, r2 };
  }
}
