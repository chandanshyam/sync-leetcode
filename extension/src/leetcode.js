// Read the LeetCode auth cookies out of the browser's cookie jar.
//
// LEETCODE_SESSION is an httpOnly cookie, so a content script / document.cookie
// can't see it — but the chrome.cookies API can, which is why this runs in the
// background service worker with the "cookies" permission.

const DOMAIN = "https://leetcode.com";

export async function readTokens() {
  const [session, csrf] = await Promise.all([
    getCookie("LEETCODE_SESSION"),
    getCookie("csrftoken"),
  ]);
  return { session: session?.value ?? null, csrf: csrf?.value ?? null };
}

function getCookie(name) {
  return chrome.cookies.get({ url: DOMAIN, name });
}

// A LeetCode session is a JWT; pull its expiry so the popup can show days left.
export function sessionDaysLeft(session) {
  if (!session) return null;
  const parts = session.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(b64urlDecode(parts[1]));
    if (!payload.exp) return null;
    return (payload.exp * 1000 - Date.now()) / 86_400_000;
  } catch {
    return null;
  }
}

function b64urlDecode(s) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
}
