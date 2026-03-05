import * as debug from "./logger.js";

interface ShellFn {
  (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<{ stdout: Buffer; exitCode: number }>;
}

/**
 * Extract git remote origin URL from the worktree.
 */
export async function getGitOrigin(
  $: ShellFn,
  worktree: string,
): Promise<string | null> {
  try {
    const result =
      await $`git -C ${worktree} config --get remote.origin.url 2>/dev/null`;
    if (result.exitCode === 0) {
      return result.stdout.toString().trim() || null;
    }
  } catch {
    await debug.debug("Failed to get git origin", { worktree });
  }
  return null;
}

/**
 * Extract the current git branch from the worktree.
 */
export async function getGitBranch(
  $: ShellFn,
  worktree: string,
): Promise<string | null> {
  try {
    const result =
      await $`git -C ${worktree} rev-parse --abbrev-ref HEAD 2>/dev/null`;
    if (result.exitCode === 0) {
      const branch = result.stdout.toString().trim();
      return branch && branch !== "HEAD" ? branch : null;
    }
  } catch {
    await debug.debug("Failed to get git branch", { worktree });
  }
  return null;
}
