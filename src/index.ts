import * as os from "node:os";
import * as path from "node:path";
import type { Plugin } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin/tool";
import {
  sendHeartbeat,
  validateToken,
  getTodayMinutes,
  getProjectMinutes,
  getTopProjects,
  type EventLogRequest,
} from "./codetime.js";
import { getGitBranch, getGitOrigin } from "./git.js";
import { detectLanguage } from "./language.js";
import { initLogger, info, warn, error, debug } from "./logger.js";
import {
  initState,
  shouldSendHeartbeat,
  updateLastHeartbeat,
} from "./state.js";

// ---- Type definitions for OpenCode events ----

interface ToolStateCompleted {
  status: "completed";
  input: Record<string, unknown>;
  output: string;
  title: string;
  metadata: Record<string, unknown>;
  time: { start: number; end: number };
}

interface ToolPart {
  id: string;
  sessionID: string;
  messageID: string;
  type: "tool";
  callID: string;
  tool: string;
  state: { status: string } & Partial<ToolStateCompleted>;
}

interface MessagePartUpdatedEvent {
  type: "message.part.updated";
  properties: {
    part: ToolPart | { type: string };
  };
}

interface FileDiff {
  file: string;
  before: string;
  after: string;
  additions: number;
  deletions: number;
}

// ---- State ----

const processedCallIds = new Set<string>();
const pendingFiles = new Map<string, { language: string; absoluteFile?: string }>();

let _token: string | null = null;
let _projectName = "unknown";
let _projectDir = "";
let _worktree = "";
let _gitOrigin: string | null = null;
let _gitBranch: string | null = null;
let _gitInfoFetched = false;
let _platform = os.platform();

// ---- File extraction from tool events ----

function extractFilesFromTool(
  tool: string,
  metadata: Record<string, unknown> | undefined,
  output: string,
  title?: string,
): string[] {
  const files: string[] = [];
  if (!metadata && tool !== "read") return files;

  switch (tool) {
    case "edit": {
      const filediff = metadata?.filediff as FileDiff | undefined;
      if (filediff?.file) {
        files.push(filediff.file);
      } else {
        const filePath = metadata?.filePath as string | undefined;
        if (filePath) files.push(filePath);
      }
      break;
    }
    case "write": {
      const filepath = metadata?.filepath as string | undefined;
      if (filepath) files.push(filepath);
      break;
    }
    case "read": {
      if (title) files.push(title);
      break;
    }
    case "patch": {
      const lines = output.split("\n");
      for (const line of lines) {
        if (line.startsWith("  ") && !line.startsWith("   ")) {
          const file = line.trim();
          if (file && !file.includes(" ")) files.push(file);
        }
      }
      break;
    }
    case "multiedit": {
      const results = metadata?.results as
        | Array<{ filediff?: FileDiff }>
        | undefined;
      if (results) {
        for (const result of results) {
          if (result.filediff?.file) {
            files.push(result.filediff.file);
          }
        }
      }
      break;
    }
    case "glob":
    case "grep":
    case "bash":
      // These don't produce meaningful file paths for tracking
      break;
  }

  return files;
}

function computeRelativeFile(absoluteFile: string, projectDir: string): string {
  if (absoluteFile.startsWith(projectDir)) {
    return absoluteFile.slice(projectDir.length).replace(/^\//, "");
  }
  return path.basename(absoluteFile);
}

// ---- Lazy git info ----

async function ensureGitInfo(): Promise<void> {
  if (_gitInfoFetched || !_worktree) return;
  _gitInfoFetched = true;
  try {
    _gitOrigin = await getGitOrigin(_worktree);
    _gitBranch = await getGitBranch(_worktree);
    await debug("Git info", { origin: _gitOrigin, branch: _gitBranch }).catch(() => {});
  } catch {
    // Git info is optional, continue without it
  }
}

// ---- Heartbeat processing ----

async function processHeartbeats(force: boolean = false): Promise<void> {
  if (!_token) return;
  if (!shouldSendHeartbeat(force) && !force) return;
  if (pendingFiles.size === 0) return;

  await ensureGitInfo();

  const promises: Promise<boolean>[] = [];

  for (const [filePath, fileInfo] of pendingFiles.entries()) {
    const relativeFile = computeRelativeFile(filePath, _projectDir);
    const event: EventLogRequest = {
      eventTime: Math.floor(Date.now() / 1000),
      language: fileInfo.language,
      project: _projectName,
      relativeFile,
      editor: "opencode",
      platform: _platform,
      absoluteFile: fileInfo.absoluteFile ?? filePath,
      gitOrigin: _gitOrigin,
      gitBranch: _gitBranch,
    };

    const p = sendHeartbeat(_token, event);
    if (force) {
      promises.push(p);
    }
  }

  pendingFiles.clear();
  updateLastHeartbeat();

  if (force && promises.length > 0) {
    await Promise.all(promises);
  }
}

function trackFile(filePath: string): void {
  const language = detectLanguage(filePath);
  pendingFiles.set(filePath, {
    language,
    absoluteFile: filePath,
  });
}

// ---- Event guard ----

function isMessagePartUpdatedEvent(event: {
  type: string;
}): event is MessagePartUpdatedEvent {
  return event.type === "message.part.updated";
}

// ---- Deduplication cleanup ----

function pruneProcessedIds(): void {
  if (processedCallIds.size > 1000) {
    const entries = Array.from(processedCallIds);
    const toRemove = entries.slice(0, entries.length - 500);
    for (const id of toRemove) {
      processedCallIds.delete(id);
    }
  }
}

// ---- Time formatting ----

function formatMinutes(minutes: number): string {
  if (minutes < 1) return "0m";
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

// ---- Plugin entry point ----

export const plugin: Plugin = async (ctx) => {
  try {
    const { client, directory, worktree } = ctx;

    // Initialize logger (may fail if client shape differs)
    try {
      initLogger(client as Parameters<typeof initLogger>[0]);
    } catch {
      // Logger init failed, continue without structured logging
    }

    // Read token from environment
    _token = process.env.CODETIME_TOKEN ?? null;
    if (!_token) {
      await warn(
        "CODETIME_TOKEN not set. CodeTime tracking disabled. " +
          "Get your token from https://codetime.dev/dashboard/settings",
      ).catch(() => {});
      return {};
    }

    // Validate token
    const user = await validateToken(_token);
    if (!user) {
      await error(
        "Invalid CODETIME_TOKEN. Please check your token at https://codetime.dev/dashboard/settings",
      ).catch(() => {});
      _token = null;
      return {};
    }

    await info(`CodeTime plugin initialized for user: ${user.username}`, {
      plan: user.plan,
    }).catch(() => {});

    // Initialize state
    initState();
    _projectDir = directory;
    _worktree = worktree;
    _projectName = `${path.basename(directory)} [opencode]`;
    _platform = os.platform();

    return {
      event: async ({ event }: { event: { type: string; properties?: Record<string, unknown> } }) => {
        try {
          if (!_token) return;

          // Handle tool completions
          if (isMessagePartUpdatedEvent(event)) {
            const { part } = event.properties;
            if (!("tool" in part) || part.type !== "tool") return;

            const toolPart = part as ToolPart;
            if (toolPart.state.status !== "completed") return;

            // Deduplicate
            if (processedCallIds.has(toolPart.callID)) return;
            processedCallIds.add(toolPart.callID);
            pruneProcessedIds();

            const { tool, state } = toolPart;
            const metadata = state.metadata;
            const output = state.output ?? "";
            const title = state.title;

            const files = extractFilesFromTool(tool, metadata, output, title);

            if (files.length > 0) {
              for (const file of files) {
                trackFile(file);
              }
              // Try to process heartbeats (rate limiter will throttle if needed)
              await processHeartbeats();
            }
          }

          // Handle session lifecycle - force flush
          if (
            event.type === "session.idle" ||
            event.type === "session.deleted"
          ) {
            await debug("Session ending, flushing heartbeats", {
              type: event.type,
              pendingFiles: pendingFiles.size,
            }).catch(() => {});
            await processHeartbeats(true);
          }
        } catch (err) {
          await error("Event handler error", { error: String(err) }).catch(() => {});
        }
      },

      "chat.message": async () => {
        try {
          // On any chat activity, try to process pending heartbeats
          if (_token && pendingFiles.size > 0) {
            await processHeartbeats();
          }
        } catch (err) {
          await error("Chat message handler error", { error: String(err) }).catch(() => {});
        }
      },

      config: async (cfg: any) => {
        cfg.command = cfg.command || {};
        cfg.command["codetime"] = {
          description: "Show today's coding time from CodeTime",
          template:
            "Retrieve current CodeTime coding time stats.\n\n" +
            "Immediately call `codetime` with no arguments and return its output verbatim.\n" +
            "Do not call other tools.",
        };
        cfg.command["codetime-breakdown"] = {
          description: "Show today's coding time breakdown by project",
          template:
            "Retrieve CodeTime coding time stats broken down by project.\n\n" +
            'Immediately call `codetime` with `breakdown: true` and return its output verbatim.\n' +
            "Do not call other tools.",
        };
      },

      tool: {
        codetime: tool({
          description:
            "Show today's coding time tracked by CodeTime. " +
            "Use this when the user asks about their coding time, " +
            "how long they've been coding, or wants to see their CodeTime stats. " +
            "Supports filtering by project name and showing a breakdown of time across all projects.",
          args: {
            project: tool.schema.string().optional().describe(
              "Filter by project name. Use 'current' to auto-detect the current project. " +
              "Omit to show total time across all projects.",
            ),
            breakdown: tool.schema.boolean().optional().describe(
              "When true, show a breakdown of coding time across all projects today.",
            ),
          },
          async execute(args) {
            if (!_token) {
              return "CodeTime is not configured. Set CODETIME_TOKEN environment variable to enable tracking. Get your token from https://codetime.dev/dashboard/settings";
            }

            try {
              // Breakdown mode: show all projects ranked by time
              if (args.breakdown) {
                const projects = await getTopProjects(_token);
                if (projects === null || projects.length === 0) {
                  return "No project data available for today.";
                }

                // Calculate total
                const totalMinutes = projects.reduce(
                  (sum, p) => sum + p.minutes,
                  0,
                );

                // Find the longest project name for alignment
                const maxNameLen = Math.max(
                  ...projects.map((p) => p.field.length),
                  "Total".length,
                );

                const lines = ["Today's coding time by project:", ""];
                for (const p of projects) {
                  const name = p.field.padEnd(maxNameLen + 2);
                  lines.push(`  ${name}${formatMinutes(p.minutes)}`);
                }
                lines.push(`  ${"─".repeat(maxNameLen + 2 + 8)}`);
                lines.push(
                  `  ${"Total".padEnd(maxNameLen + 2)}${formatMinutes(totalMinutes)}`,
                );

                return lines.join("\n");
              }

              // Project-specific mode
              const projectName =
                args.project === "current" ? _projectName : args.project;

              if (projectName) {
                // Fetch both project-specific and total in parallel
                const [projectMins, totalMins] = await Promise.all([
                  getProjectMinutes(_token, projectName),
                  getTodayMinutes(_token),
                ]);

                if (projectMins === null) {
                  return `Failed to fetch coding time for project "${projectName}" from CodeTime API.`;
                }

                const projectFormatted = formatMinutes(projectMins);
                const displayName = args.project === "current"
                  ? _projectName
                  : projectName;

                if (totalMins !== null) {
                  const totalFormatted = formatMinutes(totalMins);
                  return `Today's coding time for ${displayName}: ${projectFormatted} (Total across all projects: ${totalFormatted})`;
                }
                return `Today's coding time for ${displayName}: ${projectFormatted}`;
              }

              // Default: total coding time (original behavior)
              const minutes = await getTodayMinutes(_token);
              if (minutes === null) {
                return "Failed to fetch coding time from CodeTime API.";
              }

              const formatted = formatMinutes(minutes);
              return `Today's coding time: ${formatted}`;
            } catch (err) {
              return `Failed to fetch coding time: ${String(err)}`;
            }
          },
        }),
      },
    };
  } catch (err) {
    // If anything goes wrong during plugin initialization,
    // return empty hooks so OpenCode can continue without this plugin
    console.error("[opencode-codetime] Plugin failed to initialize:", err);
    return {};
  }
};

export default plugin;
