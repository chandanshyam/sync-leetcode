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

async function gh<T = any>(token: string, method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${url}`, {
    method,
    headers: { ...ghHeaders(token), "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GitHub ${method} ${url} failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

// Write many files in a single commit. Files already under `replaceDir` that
// aren't in `files` are deleted, so the folder mirrors the latest submission.
export async function commitFiles(
  repo: string,
  token: string,
  files: { path: string; content: string }[],
  message: string,
  replaceDir?: string,
): Promise<void> {
  const { default_branch: branch } = await gh(token, "GET", `/repos/${repo}`);
  const ref = await gh(token, "GET", `/repos/${repo}/git/ref/heads/${branch}`);
  const head = await gh(token, "GET", `/repos/${repo}/git/commits/${ref.object.sha}`);

  const entries: object[] = files.map((f) => ({ path: f.path, mode: "100644", type: "blob", content: f.content }));

  if (replaceDir) {
    const keep = new Set(files.map((f) => f.path));
    const tree = await gh(token, "GET", `/repos/${repo}/git/trees/${head.tree.sha}?recursive=1`);
    for (const e of tree.tree) {
      if (e.type === "blob" && e.path.startsWith(`${replaceDir}/`) && !keep.has(e.path)) {
        entries.push({ path: e.path, mode: e.mode, type: "blob", sha: null });
      }
    }
  }

  const tree = await gh(token, "POST", `/repos/${repo}/git/trees`, { base_tree: head.tree.sha, tree: entries });
  const commit = await gh(token, "POST", `/repos/${repo}/git/commits`, { message, tree: tree.sha, parents: [head.sha] });
  await gh(token, "PATCH", `/repos/${repo}/git/refs/heads/${branch}`, { sha: commit.sha });
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