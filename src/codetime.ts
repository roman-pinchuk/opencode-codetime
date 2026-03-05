import * as logger from "./logger.js";

const API_BASE = "https://api.codetime.dev";

export interface EventLogRequest {
  eventTime: number;
  language: string;
  project: string;
  relativeFile: string;
  editor: string;
  platform: string;
  absoluteFile?: string | null;
  gitOrigin?: string | null;
  gitBranch?: string | null;
}

export interface UserSelf {
  id: number;
  username: string;
  uploadToken: string;
  plan: string;
}

/**
 * Validate the CodeTime token by fetching the current user.
 * Returns user info on success, or null on failure.
 */
export async function validateToken(
  token: string,
): Promise<UserSelf | null> {
  try {
    const response = await fetch(`${API_BASE}/v3/users/self`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      await logger.error("Token validation failed", {
        status: response.status,
        statusText: response.statusText,
      });
      return null;
    }

    const data = (await response.json()) as UserSelf;
    return data;
  } catch (err) {
    await logger.error("Token validation request failed", {
      error: String(err),
    });
    return null;
  }
}

/**
 * Send a coding event (heartbeat) to the CodeTime API.
 */
export async function sendHeartbeat(
  token: string,
  event: EventLogRequest,
): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/v3/users/event-log`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      await logger.warn("Failed to send heartbeat", {
        status: response.status,
        statusText: response.statusText,
        event,
      });
      return false;
    }

    await logger.debug("Heartbeat sent", { event });
    return true;
  } catch (err) {
    await logger.error("Heartbeat request failed", {
      error: String(err),
      event,
    });
    return false;
  }
}

/**
 * Fetch today's coding minutes from CodeTime API.
 */
export async function getTodayMinutes(
  token: string,
): Promise<number | null> {
  try {
    const response = await fetch(
      `${API_BASE}/v3/users/self/minutes?minutes=1440`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) return null;

    const data = (await response.json()) as { minutes: number };
    return data.minutes;
  } catch {
    return null;
  }
}
