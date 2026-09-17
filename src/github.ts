const API = "https://api.github.com";

function ghHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "sync-leetcode",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function contentsUrl(repo: string, path: string) {
  // path segments are already URL-safe (slugs), keep the slashes as-is
  return `${API}/repos/${repo}/contents/${path}`;
}

// Create the file, or update it in place if it already exists (needs its sha).
export async function upsertFile(
  repo: string,
  token: string,
  path: string,
  content: string,
  message: string,
): Promise<void> {
  const url = contentsUrl(repo, path);
  const head = ghHeaders(token);

  const existing = await fetch(url, { headers: head });
  const sha = existing.ok ? (await existing.json()).sha : undefined;

  const res = await fetch(url, {
    method: "PUT",
    headers: { ...head, "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content: Buffer.from(content, "utf8").toString("base64"),
      ...(sha ? { sha } : {}),
    }),
  });

  if (!res.ok) {
    throw new Error(`GitHub PUT ${path} failed: ${res.status} ${await res.text()}`);
  }
}

// Read a JSON file from the repo, returning {} if it does not exist yet.
export async function readJsonFile<T = Record<string, string>>(
  repo: string,
  token: string,
  path: string,
): Promise<T> {
  const res = await fetch(contentsUrl(repo, path), { headers: ghHeaders(token) });
  if (!res.ok) return {} as T;
  const data = await res.json();
  try {
    return JSON.parse(Buffer.from(data.content, "base64").toString("utf8")) as T;
  } catch {
    return {} as T;
  }
}