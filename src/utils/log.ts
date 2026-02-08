type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  event: string;
  [key: string]: unknown;
}

export function structuredLog(event: string, data: Record<string, unknown> = {}): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: 'info',
    event,
    ...data,
  };
  console.log(JSON.stringify(entry));
}

export function structuredWarn(event: string, data: Record<string, unknown> = {}): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: 'warn',
    event,
    ...data,
  };
  console.warn(JSON.stringify(entry));
}

export function structuredError(event: string, error: unknown, data: Record<string, unknown> = {}): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: 'error',
    event,
    error_message: formatErrorMessage(error),
    ...data,
  };
  console.error(JSON.stringify(entry));
}

export function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
