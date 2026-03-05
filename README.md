# opencode-codetime

[CodeTime](https://codetime.dev) plugin for [OpenCode](https://github.com/anomalyco/opencode) -- track your AI coding activity and time spent.

## Features

- **Automatic time tracking** -- sends coding events to CodeTime when OpenCode reads, edits, or writes files
- **Language detection** -- detects 90+ programming languages from file extensions
- **Git integration** -- captures current branch and remote origin
- **Rate-limited** -- one heartbeat per 2 minutes to avoid API spam
- **Session lifecycle** -- flushes pending events on session end so no data is lost
- **Zero config** -- just set your token and go

## Prerequisites

A [CodeTime](https://codetime.dev) account. Sign up for free at [codetime.dev](https://codetime.dev).

Get your upload token from [CodeTime Settings](https://codetime.dev/dashboard/settings).

## Installation

### Via opencode config (recommended)

Add to your `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-codetime"]
}
```

### From source

```bash
git clone https://github.com/roman-pinchuk/opencode-codetime
cd opencode-codetime
npm install && npm run build
```

Then copy the built files to your OpenCode plugins directory:

```bash
mkdir -p ~/.config/opencode/plugins
cp dist/*.js ~/.config/opencode/plugins/
```

## Configuration

Set your CodeTime upload token as an environment variable:

```bash
export CODETIME_TOKEN="your-upload-token-here"
```

Add it to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.) to persist across sessions.

The plugin validates the token on startup and logs a warning if it is missing or invalid.

## How It Works

The plugin hooks into OpenCode's event system to detect file activity.

```
OpenCode events                    Plugin                         CodeTime API
+-----------------------+     +------------------+     +------------------------+
| message.part.updated  | --> | Extract files    | --> | POST /v3/users/event-log|
| (edit, write, read,   |     | Detect language  |     |                        |
|  patch, multiedit)    |     | Rate limit (2m)  |     | { eventTime, language, |
+-----------------------+     +------------------+     |   project, relativeFile,|
| session.idle          | --> | Force flush      |     |   editor: "opencode",  |
| session.deleted       |     | pending events   |     |   platform, git info } |
+-----------------------+     +------------------+     +------------------------+
```

### What gets tracked

Each heartbeat sent to CodeTime includes:

| Field | Value |
|-------|-------|
| `eventTime` | Unix timestamp of the event |
| `language` | Detected from file extension (e.g. `TypeScript`, `Python`) |
| `project` | Current directory name |
| `relativeFile` | File path relative to the project root |
| `editor` | `opencode` |
| `platform` | OS platform (`darwin`, `linux`, `windows`) |
| `gitOrigin` | Remote origin URL (if available) |
| `gitBranch` | Current branch name (if available) |

### Hooks used

| Hook | Purpose |
|------|---------|
| `event` | Listens for `message.part.updated` (tool completions) and `session.idle`/`session.deleted` (flush) |
| `chat.message` | Processes pending heartbeats on chat activity |

### Tool tracking

| Tool | Data Extracted |
|------|---------------|
| `read` | File path from title |
| `edit` | File path from filediff metadata |
| `write` | File path from metadata |
| `patch` | File paths from output |
| `multiedit` | File paths from each edit result |

## Project Structure

```
src/
  index.ts        Main plugin entry point with event hooks
  codetime.ts     CodeTime API client (token validation, heartbeats)
  state.ts        Rate limiter (max 1 heartbeat per 2 minutes)
  language.ts     File extension to language name mapping
  git.ts          Git branch and remote origin extraction
  logger.ts       Structured logging via OpenCode SDK
```

## Development

```bash
# Install dependencies
npm install

# Type check
npm run typecheck

# Build
npm run build
```

## Troubleshooting

### Plugin not loading

1. Verify `opencode.json` syntax
2. Check that `CODETIME_TOKEN` is set in your environment
3. Check OpenCode logs for `opencode-codetime` messages

### Heartbeats not appearing in CodeTime

1. Verify your token at [codetime.dev/dashboard/settings](https://codetime.dev/dashboard/settings)
2. Make sure you are editing files (not just chatting) -- heartbeats fire on tool completions
3. Wait up to 2 minutes for rate-limited heartbeats to flush
4. Check that the CodeTime API is reachable: `curl -s https://api.codetime.dev/v3`

### Token validation fails

1. Regenerate your token at [codetime.dev/dashboard/settings](https://codetime.dev/dashboard/settings)
2. Make sure the token has no leading/trailing whitespace

## License

[MIT](LICENSE)
