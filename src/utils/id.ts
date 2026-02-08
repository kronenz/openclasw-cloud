// Generate a prefixed UUID for different entity types
export function generateId(prefix: string = ''): string {
  const uuid = crypto.randomUUID();
  return prefix ? `${prefix}_${uuid}` : uuid;
}

export function generateTenantId(): string {
  return generateId('tn');
}

export function generateResourceId(): string {
  return generateId('res');
}

export function generateIncidentId(): string {
  return generateId('inc');
}

export function generateSubscriptionId(): string {
  return generateId('sub');
}

// Generate a URL-safe subdomain from a name
export function generateSubdomain(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 32) || 'tenant';
}

/** Get current date as YYYY-MM-DD string */
export function toDateString(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}

/** Returns current UTC timestamp in ISO 8601 format */
export function nowISO(): string {
  return new Date().toISOString();
}
