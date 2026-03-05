/**
 * Rate limiter for CodeTime heartbeats.
 * Prevents sending more than one heartbeat per HEARTBEAT_INTERVAL_MS per project.
 */

const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

let lastHeartbeatTime = 0;

/**
 * Initialize state (called on plugin startup).
 */
export function initState(): void {
  lastHeartbeatTime = 0;
}

/**
 * Check if enough time has passed to send a new heartbeat.
 * @param force If true, always returns true.
 */
export function shouldSendHeartbeat(force: boolean = false): boolean {
  if (force) return true;
  const now = Date.now();
  return now - lastHeartbeatTime >= HEARTBEAT_INTERVAL_MS;
}

/**
 * Record that a heartbeat was just sent.
 */
export function updateLastHeartbeat(): void {
  lastHeartbeatTime = Date.now();
}
