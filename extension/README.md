# LeetCode Session → GitHub Secrets (Chrome extension)

Captures your LeetCode auth cookies (`LEETCODE_SESSION` + `csrftoken`) when you
log in and pushes them to a repo's **GitHub Actions secrets** as
`LEETCODE_SESSION` and `LEETCODE_CSRF` — the two secrets the `Sync LeetCode`
workflow reads. This replaces the old local Playwright `refresh-auth` flow.

## How it works

1. LeetCode's session cookie is `httpOnly`, so a normal page script can't read
   it. The extension's background service worker uses the `chrome.cookies` API
   (which can) to read both cookies straight from the browser's cookie jar.
2. Writing an Actions secret requires encrypting the value against the repo's
   public key with libsodium's sealed box (`crypto_box_seal`). The bundled
   libsodium does that in-browser, then the worker `PUT`s the encrypted value to
   the GitHub REST API.
3. It fires automatically whenever `LEETCODE_SESSION` changes (i.e. right after
   you log in), and you can also push on demand from the popup.

## Setup

### 1. Create a GitHub token that can write secrets

Fine-grained token (recommended):

- github.com → Settings → Developer settings → **Fine-grained tokens** → Generate
- **Repository access**: only the repo you sync to
- **Permissions → Repository → Secrets: Read and write**
- (That's the only permission needed.)

Or a classic token with the `repo` scope.

Keep the token handy — you paste it into the popup once.

### 2. Load the extension

The service worker is bundled (libsodium is inlined). If you cloned fresh or
changed anything under `extension/src/`, rebuild it from the repo root:

```bash
bun install
bun run build:ext   # writes extension/background.js
```

Then in Chrome:

1. Go to `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked** and select the `extension/` folder
4. Pin the extension so you can open its popup

### 3. Configure it

Open the popup and fill in:

- **GitHub token** — the token from step 1 (stored in `chrome.storage.local`,
  which is local to this machine and not synced to your Google account)
- **Owner** — the repo owner, e.g. your GitHub username
- **Repo** — the repo name, e.g. `sync-leetcode`
- **Auto-push when I log in** — leave on to push automatically

Click **Save settings**. The token is verified against `GET /user` before it's
stored.

## Using it

- **Automatic**: log in to leetcode.com as usual. When the session cookie is set,
  the extension pushes the two secrets and shows a notification.
- **Manual**: open the popup and click **Push session now**.

The popup shows the target repo, whether the cookies are present, roughly how
many days are left on the session (decoded from the session JWT), and when the
last push happened.

## Security notes

- The PAT lives in `chrome.storage.local`, readable only by this extension.
  Anyone with access to your Chrome profile can read it, so scope the token to
  just this repo and just the Secrets permission.
- Secret values are encrypted client-side with the repo's public key before they
  leave the browser; GitHub only ever receives the sealed ciphertext.
- The only network calls the extension makes are to `api.github.com`. The
  bundled libsodium loads its WebAssembly from an inlined binary — nothing is
  fetched from a third party. (`wasm-unsafe-eval` is in the manifest CSP so the
  service worker can instantiate that WASM.)
- Want to avoid storing a PAT in the browser entirely? Point `putSecret` in
  `src/github.js` at your own small proxy that holds the token server-side, and
  remove the `api.github.com` host permission.

## Files

- `manifest.json` — MV3 manifest (cookies, storage, notifications + host perms)
- `src/background.js` — service worker: reads cookies, encrypts, pushes secrets,
  auto-push listener (bundled into `background.js`)
- `src/github.js` — GitHub secrets client (public key + sealed box + PUT)
- `src/leetcode.js` — reads cookies, decodes session expiry
- `src/storage.js` — `chrome.storage.local` config wrapper
- `popup.html` / `popup.js` — settings + manual push UI
