import { checkAuth } from "./leetcode";

const WARN_BELOW_DAYS = 3;

// Run before a sync: fail fast if the session is dead, and warn in the
// Actions summary when it's close to expiring.
//
// Refreshing the session no longer happens here (or anywhere in this repo):
// the companion Chrome extension captures LEETCODE_SESSION / csrftoken on
// login and pushes them straight to this repo's Actions secrets.
export async function ensureAuth(): Promise<void> {
  let daysLeft: number;
  try {
    ({ daysLeft } = await checkAuth());
  } catch (err) {
    const msg = `${err instanceof Error ? err.message : err}. Log in to LeetCode with the browser extension to refresh the repo secrets.`;
    if (process.env.GITHUB_ACTIONS) console.log(`::error::${msg}`);
    throw new Error(msg);
  }
  if (!Number.isFinite(daysLeft)) return;
  const msg = `LeetCode session expires in ${daysLeft.toFixed(1)} days`;
  if (daysLeft < WARN_BELOW_DAYS && process.env.GITHUB_ACTIONS) {
    console.log(`::warning::${msg}. Log in with the browser extension to refresh.`);
  } else {
    console.log(msg);
  }
}
