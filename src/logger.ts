type LogLevel = "debug" | "info" | "warn" | "error";

interface LogClient {
  app: {
    log: (opts: {
      body: {
        service: string;
        level: LogLevel;
        message: string;
        extra?: Record<string, unknown>;
      };
    }) => Promise<unknown>;
  };
}

let _client: LogClient | null = null;

const SERVICE = "opencode-codetime";

export function initLogger(client: LogClient): void {
  _client = client;
}

export async function log(
  level: LogLevel,
  message: string,
  extra?: Record<string, unknown>,
): Promise<void> {
  if (!_client) return;
  try {
    await _client.app.log({
      body: { service: SERVICE, level, message, extra },
    });
  } catch {
    // Silently ignore logging failures
  }
}

export async function debug(
  message: string,
  extra?: Record<string, unknown>,
): Promise<void> {
  return log("debug", message, extra);
}

export async function info(
  message: string,
  extra?: Record<string, unknown>,
): Promise<void> {
  return log("info", message, extra);
}

export async function warn(
  message: string,
  extra?: Record<string, unknown>,
): Promise<void> {
  return log("warn", message, extra);
}

export async function error(
  message: string,
  extra?: Record<string, unknown>,
): Promise<void> {
  return log("error", message, extra);
}
