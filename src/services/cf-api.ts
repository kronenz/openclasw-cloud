import type { Bindings } from '../types/index.js';

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

  constructor(private env: Bindings) {
    this.config = {
      apiToken: (env as any).CF_API_TOKEN || '',
      accountId: (env as any).CF_ACCOUNT_ID || '',
    };
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.config.accountId}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.config.apiToken}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    const data = await res.json() as { success: boolean; result: T; errors: any[] };
    if (!data.success) {
      throw new Error(`CF API error: ${JSON.stringify(data.errors)}`);
    }
    return data.result;
  }

  private isConfigured(): boolean {
    return !!(this.config.apiToken && this.config.accountId);
  }

  async createD1Database(name: string): Promise<CfResourceResult> {
    if (!this.isConfigured()) {
      return { id: `d1-placeholder-${name}`, name };
    }
    return this.request<CfResourceResult>('/d1/database', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async createKvNamespace(title: string): Promise<CfResourceResult> {
    if (!this.isConfigured()) {
      return { id: `kv-placeholder-${title}`, name: title };
    }
    const result = await this.request<{ id: string }>('/storage/kv/namespaces', {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
    return { id: result.id, name: title };
  }

  async createR2Bucket(name: string): Promise<CfResourceResult> {
    if (!this.isConfigured()) {
      return { id: `r2-placeholder-${name}`, name };
    }
    await this.request<void>('/r2/buckets', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    return { id: name, name };
  }

  async createWorker(name: string, script?: string): Promise<CfResourceResult> {
    if (!this.isConfigured()) {
      return { id: `worker-placeholder-${name}`, name };
    }
    // Worker creation requires multipart form data with the script
    // For now, create a minimal worker
    const workerScript = script || `export default { fetch() { return new Response('OK'); } }`;
    const formData = new FormData();
    formData.append('metadata', JSON.stringify({
      main_module: 'index.js',
      compatibility_date: '2026-02-08',
    }));
    formData.append('index.js', new Blob([workerScript], { type: 'application/javascript+module' }), 'index.js');

    const url = `https://api.cloudflare.com/client/v4/accounts/${this.config.accountId}/workers/scripts/${name}`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${this.config.apiToken}` },
      body: formData,
    });

    if (!res.ok) {
      throw new Error(`Worker creation failed: ${await res.text()}`);
    }
    return { id: name, name };
  }

  // Create all resources for a tenant
  async provisionTenantResources(tenantId: string, subdomain: string): Promise<{
    worker: CfResourceResult;
    d1: CfResourceResult;
    kv: CfResourceResult;
    r2: CfResourceResult;
  }> {
    const prefix = `oc-${subdomain}`;

    const [worker, d1, kv, r2] = await Promise.all([
      this.createWorker(`${prefix}-worker`),
      this.createD1Database(`${prefix}-db`),
      this.createKvNamespace(`${prefix}-kv`),
      this.createR2Bucket(`${prefix}-storage`),
    ]);

    return { worker, d1, kv, r2 };
  }
}
