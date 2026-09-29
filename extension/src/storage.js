// Thin wrapper over chrome.storage.local for the extension's config + state.
//
// Stored in chrome.storage.local (extension-private, not synced to your Google
// account so the PAT doesn't leave this machine):
//   token   - GitHub PAT with repo Secrets:write
//   owner   - repo owner (user or org)
//   repo    - repo name
//   auto    - boolean, auto-push on cookie change
//   lastPush- { at, session } bookkeeping so we don't re-push an unchanged session

export async function getConfig() {
  const d = await chrome.storage.local.get(["token", "owner", "repo", "auto", "lastPush"]);
  return {
    token: d.token ?? "",
    owner: d.owner ?? "",
    repo: d.repo ?? "",
    auto: d.auto ?? true,
    lastPush: d.lastPush ?? null,
  };
}

export async function setConfig(patch) {
  await chrome.storage.local.set(patch);
}

export function isConfigured(cfg) {
  return Boolean(cfg.token && cfg.owner && cfg.repo);
}
