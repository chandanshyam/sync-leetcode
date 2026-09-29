// Background service worker.
//
// Two ways secrets get pushed:
//   1. Manually, when the popup sends { type: "push" }.
//   2. Automatically, when the LEETCODE_SESSION cookie changes (i.e. you just
//      logged in or LeetCode rotated your session) and auto-push is on.
//
// All GitHub calls happen here, not in the popup, so the flow keeps running
// even after the popup closes.

import { readTokens, sessionDaysLeft } from "./leetcode.js";
import { pushLeetcodeSecrets, whoami } from "./github.js";
import { getConfig, setConfig, isConfigured } from "./storage.js";

// --- messaging from the popup -------------------------------------------------

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      switch (msg?.type) {
        case "status":
          sendResponse(await buildStatus());
          break;
        case "verifyToken":
          sendResponse({ ok: true, login: await whoami(msg.token) });
          break;
        case "push":
          sendResponse(await pushNow());
          break;
        default:
          sendResponse({ ok: false, error: `unknown message: ${msg?.type}` });
      }
    } catch (err) {
      sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  })();
  return true; // keep the channel open for the async response
});

async function buildStatus() {
  const cfg = await getConfig();
  const { session, csrf } = await readTokens();
  return {
    ok: true,
    configured: isConfigured(cfg),
    owner: cfg.owner,
    repo: cfg.repo,
    auto: cfg.auto,
    hasSession: Boolean(session),
    hasCsrf: Boolean(csrf),
    daysLeft: sessionDaysLeft(session),
    lastPush: cfg.lastPush,
  };
}

// --- the actual push ----------------------------------------------------------

async function pushNow() {
  const cfg = await getConfig();
  if (!isConfigured(cfg)) throw new Error("Set your GitHub token, owner and repo in the popup first.");

  const { session, csrf } = await readTokens();
  if (!session || !csrf) throw new Error("No LeetCode cookies found. Log in to leetcode.com first.");

  await pushLeetcodeSecrets(cfg.owner, cfg.repo, cfg.token, { session, csrf });
  const lastPush = { at: Date.now(), session };
  await setConfig({ lastPush });
  return { ok: true, pushed: true, at: lastPush.at, daysLeft: sessionDaysLeft(session) };
}

// --- auto-push on login -------------------------------------------------------

chrome.cookies.onChanged.addListener(async ({ cookie, removed }) => {
  if (removed) return;
  if (cookie.domain !== "leetcode.com" && cookie.domain !== ".leetcode.com") return;
  if (cookie.name !== "LEETCODE_SESSION") return;

  const cfg = await getConfig();
  if (!cfg.auto || !isConfigured(cfg)) return;
  // Skip if this exact session was already pushed (LeetCode re-sets the cookie often).
  if (cfg.lastPush?.session === cookie.value) return;

  try {
    await pushNow();
    notify("LeetCode session pushed", `Updated secrets on ${cfg.owner}/${cfg.repo}.`);
  } catch (err) {
    notify("Push failed", err instanceof Error ? err.message : String(err));
  }
});

function notify(title, message) {
  // notifications permission is optional; guard so absence doesn't throw.
  chrome.notifications?.create?.({
    type: "basic",
    iconUrl: "icon128.png",
    title,
    message,
  });
}
