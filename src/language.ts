import * as path from "node:path";

const EXTENSION_MAP: Record<string, string> = {
  // JavaScript / TypeScript
  ".js": "JavaScript",
  ".mjs": "JavaScript",
  ".cjs": "JavaScript",
  ".jsx": "JavaScript JSX",
  ".ts": "TypeScript",
  ".mts": "TypeScript",
  ".cts": "TypeScript",
  ".tsx": "TypeScript JSX",

  // Web
  ".html": "HTML",
  ".htm": "HTML",
  ".css": "CSS",
  ".scss": "SCSS",
  ".sass": "Sass",
  ".less": "Less",
  ".vue": "Vue",
  ".svelte": "Svelte",
  ".astro": "Astro",

  // Python
  ".py": "Python",
  ".pyw": "Python",
  ".pyi": "Python",

  // Go
  ".go": "Go",

  // Rust
  ".rs": "Rust",

  // Java / Kotlin
  ".java": "Java",
  ".kt": "Kotlin",
  ".kts": "Kotlin",

  // C / C++
  ".c": "C",
  ".h": "C",
  ".cpp": "C++",
  ".cc": "C++",
  ".cxx": "C++",
  ".hpp": "C++",

  // C#
  ".cs": "C#",

  // Swift
  ".swift": "Swift",

  // Ruby
  ".rb": "Ruby",

  // PHP
  ".php": "PHP",

  // Lua
  ".lua": "Lua",

  // Shell
  ".sh": "Shell",
  ".bash": "Shell",
  ".zsh": "Shell",
  ".fish": "Shell",

  // Config / Data
  ".json": "JSON",
  ".jsonc": "JSONC",
  ".yaml": "YAML",
  ".yml": "YAML",
  ".toml": "TOML",
  ".xml": "XML",
  ".csv": "CSV",

  // Markup / Docs
  ".md": "Markdown",
  ".mdx": "MDX",
  ".rst": "reStructuredText",
  ".tex": "LaTeX",

  // Docker / DevOps
  ".dockerfile": "Dockerfile",
  ".tf": "Terraform",
  ".hcl": "HCL",

  // SQL
  ".sql": "SQL",

  // R
  ".r": "R",
  ".R": "R",

  // Elixir / Erlang
  ".ex": "Elixir",
  ".exs": "Elixir",
  ".erl": "Erlang",

  // Dart
  ".dart": "Dart",

  // Zig
  ".zig": "Zig",

  // Nim
  ".nim": "Nim",

  // Scala
  ".scala": "Scala",

  // Haskell
  ".hs": "Haskell",

  // OCaml
  ".ml": "OCaml",
  ".mli": "OCaml",

  // Clojure
  ".clj": "Clojure",
  ".cljs": "ClojureScript",

  // GraphQL
  ".graphql": "GraphQL",
  ".gql": "GraphQL",

  // Proto
  ".proto": "Protocol Buffers",
};

/**
 * Detect the programming language from a file path using its extension.
 * Returns "Unknown" if the extension is not recognized.
 */
export function detectLanguage(filePath: string): string {
  if (!filePath) return "Unknown";

  // Handle special filenames
  const basename = path.basename(filePath).toLowerCase();
  if (basename === "dockerfile") return "Dockerfile";
  if (basename === "makefile" || basename === "gnumakefile") return "Makefile";
  if (basename === "cmakelists.txt") return "CMake";

  const ext = path.extname(filePath).toLowerCase();
  return EXTENSION_MAP[ext] ?? "Unknown";
}
