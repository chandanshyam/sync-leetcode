import TurndownService from "turndown";

const td = new TurndownService({ codeBlockStyle: "fenced", headingStyle: "atx" });

// Convert LeetCode's HTML problem statement into readable text.
export function htmlToText(html: string): string {
  return td.turndown(html || "").trim();
}

type Comment =
  | { kind: "block" } //      /* ... */    C-family, JS, Java, Go, Rust, Swift...
  | { kind: "docstring" } //  """ ... """  Python
  | { kind: "line"; prefix: string }; // #  --  ;;  %%   line-comment languages

interface LangSpec {
  ext: string;
  comment: Comment;
}

// Keyed by LeetCode's internal lang name (submissionDetails.lang.name).
const LANGS: Record<string, LangSpec> = {
  cpp: { ext: "cpp", comment: { kind: "block" } },
  c: { ext: "c", comment: { kind: "block" } },
  java: { ext: "java", comment: { kind: "block" } },
  csharp: { ext: "cs", comment: { kind: "block" } },
  javascript: { ext: "js", comment: { kind: "block" } },
  typescript: { ext: "ts", comment: { kind: "block" } },
  php: { ext: "php", comment: { kind: "block" } },
  swift: { ext: "swift", comment: { kind: "block" } },
  kotlin: { ext: "kt", comment: { kind: "block" } },
  dart: { ext: "dart", comment: { kind: "block" } },
  golang: { ext: "go", comment: { kind: "block" } },
  scala: { ext: "scala", comment: { kind: "block" } },
  rust: { ext: "rs", comment: { kind: "block" } },
  python: { ext: "py", comment: { kind: "docstring" } },
  python3: { ext: "py", comment: { kind: "docstring" } },
  pythondata: { ext: "py", comment: { kind: "docstring" } },
  ruby: { ext: "rb", comment: { kind: "line", prefix: "# " } },
  elixir: { ext: "ex", comment: { kind: "line", prefix: "# " } },
  bash: { ext: "sh", comment: { kind: "line", prefix: "# " } },
  racket: { ext: "rkt", comment: { kind: "line", prefix: ";; " } },
  erlang: { ext: "erl", comment: { kind: "line", prefix: "%% " } },
  mysql: { ext: "sql", comment: { kind: "line", prefix: "-- " } },
  mssql: { ext: "sql", comment: { kind: "line", prefix: "-- " } },
  oraclesql: { ext: "sql", comment: { kind: "line", prefix: "-- " } },
  postgresql: { ext: "sql", comment: { kind: "line", prefix: "-- " } },
};

export function extFor(langName: string): string {
  return LANGS[langName]?.ext ?? "txt";
}

// Wrap the problem text in a comment appropriate for the solution's language.
export function wrapAsComment(text: string, langName: string): string {
  const style = LANGS[langName]?.comment ?? { kind: "block" };
  const body = text.trim();

  if (style.kind === "block") {
    // guard against a stray */ inside the statement closing the comment early
    return `/*\n${body.replace(/\*\//g, "* /")}\n*/\n\n`;
  }
  if (style.kind === "docstring") {
    return `"""\n${body.replace(/"""/g, '\\"\\"\\"')}\n"""\n\n`;
  }
  const p = style.prefix;
  const lines = body.split("\n").map((l) => (l ? p + l : p.trimEnd()));
  return lines.join("\n") + "\n\n";
}