import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCb);

/**
 * Extract git remote origin URL from the worktree.
 * Uses node:child_process directly to avoid OpenCode TUI shell flash.
 */
export async function getGitOrigin(
  worktree: string,
): Promise<string | null> {
  try {
    const { stdout } = await execFile("git", [
      "-C",
      worktree,
      "config",
      "--get",
      "remote.origin.url",
    ]);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Extract the current git branch from the worktree.
 * Uses node:child_process directly to avoid OpenCode TUI shell flash.
 */
export async function getGitBranch(
  worktree: string,
): Promise<string | null> {
  try {
    const { stdout } = await execFile("git", [
      "-C",
      worktree,
      "rev-parse",
      "--abbrev-ref",
      "HEAD",
    ]);
    const branch = stdout.trim();
    return branch && branch !== "HEAD" ? branch : null;
  } catch {
    return null;
  }
}
