type Level = 'debug' | 'info' | 'warn' | 'error';

export function log(level: Level, message: string, meta?: Record<string, unknown>): void {
  const payload = {
    time: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  if (level === 'error') {
    console.error(JSON.stringify(payload));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(payload));
  } else {
    console.log(JSON.stringify(payload));
  }
}
