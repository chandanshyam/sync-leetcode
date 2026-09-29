// GitHub Actions secrets client.
//
// Writing a repo secret is a two-step dance:
//   1. GET the repo's public key (id + base64 key).
//   2. Seal the secret value with libsodium's crypto_box_seal against that key,
//      base64-encode it, and PUT it under the secret name.
//
// The PAT needs the "Secrets" repository permission (write) on the target repo.
// Classic tokens: `repo` scope. Fine-grained: Repository permissions →
// Secrets: Read and write.

import _sodium from "libsodium-wrappers";

const API = "https://api.github.com";

let sodiumReady;
function sodium() {
  sodiumReady ??= _sodium.ready.then(() => _sodium);
  return sodiumReady;
}

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function ghFetch(url, token, init = {}) {
  const res = await fetch(url, { ...init, headers: { ...headers(token), ...(init.headers || {}) } });
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json())?.message ?? "";
    } catch {
      // no JSON body
    }
    throw new Error(`GitHub ${init.method || "GET"} ${new URL(url).pathname} → ${res.status} ${res.statusText}${detail ? `: ${detail}` : ""}`);
  }
  return res;
}

// Confirm the token works and return the authenticated login (for the popup).
export async function whoami(token) {
  const res = await ghFetch(`${API}/user`, token);
  const json = await res.json();
  return json.login;
}

async function getPublicKey(owner, repo, token) {
  const res = await ghFetch(`${API}/repos/${owner}/${repo}/actions/secrets/public-key`, token);
  return res.json(); // { key_id, key }
}

// Encrypt `value` for the repo's public key using crypto_box_seal (sealed box).
async function sealSecret(publicKeyBase64, value) {
  const s = await sodium();
  const keyBytes = s.from_base64(publicKeyBase64, s.base64_variants.ORIGINAL);
  const messageBytes = s.from_string(value);
  const sealed = s.crypto_box_seal(messageBytes, keyBytes);
  return s.to_base64(sealed, s.base64_variants.ORIGINAL);
}

// Create or update a single Actions secret.
export async function putSecret(owner, repo, token, name, value) {
  const { key_id, key } = await getPublicKey(owner, repo, token);
  const encrypted_value = await sealSecret(key, value);
  await ghFetch(`${API}/repos/${owner}/${repo}/actions/secrets/${encodeURIComponent(name)}`, token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ encrypted_value, key_id }),
  });
}

// Push the LeetCode tokens as LEETCODE_SESSION / LEETCODE_CSRF.
// Public key is fetched once and reused across both writes.
export async function pushLeetcodeSecrets(owner, repo, token, { session, csrf }) {
  const { key_id, key } = await getPublicKey(owner, repo, token);
  for (const [name, value] of [
    ["LEETCODE_SESSION", session],
    ["LEETCODE_CSRF", csrf],
  ]) {
    const encrypted_value = await sealSecret(key, value);
    await ghFetch(`${API}/repos/${owner}/${repo}/actions/secrets/${encodeURIComponent(name)}`, token, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ encrypted_value, key_id }),
    });
  }
}
