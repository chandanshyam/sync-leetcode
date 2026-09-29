// Popup: edit settings (stored in chrome.storage.local) and trigger pushes.
// The heavy lifting (cookies, encryption, GitHub calls) lives in background.js;
// the popup just sends messages and renders status.

const $ = (id) => document.getElementById(id);
const send = (msg) => chrome.runtime.sendMessage(msg);

async function loadSettings() {
  const cfg = await chrome.storage.local.get(["token", "owner", "repo", "auto"]);
  $("token").value = cfg.token ?? "";
  $("owner").value = cfg.owner ?? "";
  $("repo").value = cfg.repo ?? "";
  $("auto").checked = cfg.auto ?? true;
}

function setStatus(text, cls = "muted") {
  const el = $("status");
  el.className = cls;
  el.textContent = text;
}

function fmtDays(d) {
  if (d == null || !isFinite(d)) return "";
  return ` · session ~${d.toFixed(1)}d left`;
}

async function refreshStatus() {
  const s = await send({ type: "status" });
  if (!s?.ok) return setStatus(s?.error ?? "Could not read status", "err");

  const lines = [];
  lines.push(s.configured ? `Target: ${s.owner}/${s.repo}` : "Not configured yet");
  const cookieState = s.hasSession && s.hasCsrf ? "cookies found" : "no LeetCode cookies (log in first)";
  lines.push(cookieState + fmtDays(s.daysLeft));
  if (s.lastPush?.at) lines.push(`Last push: ${new Date(s.lastPush.at).toLocaleString()}`);
  lines.push(`Auto-push: ${s.auto ? "on" : "off"}`);
  setStatus(lines.join("\n"), s.hasSession && s.hasCsrf ? "ok" : "muted");
}

$("save").addEventListener("click", async () => {
  const token = $("token").value.trim();
  const owner = $("owner").value.trim();
  const repo = $("repo").value.trim();
  const auto = $("auto").checked;

  if (token) {
    setStatus("Verifying token…");
    const res = await send({ type: "verifyToken", token });
    if (!res?.ok) return setStatus(`Token check failed: ${res?.error ?? "unknown"}`, "err");
    setStatus(`Token OK (as ${res.login}). Saving…`, "ok");
  }
  await chrome.storage.local.set({ token, owner, repo, auto });
  await refreshStatus();
});

$("push").addEventListener("click", async () => {
  setStatus("Pushing…");
  const res = await send({ type: "push" });
  if (!res?.ok) return setStatus(`Push failed: ${res?.error ?? "unknown"}`, "err");
  setStatus(`Pushed${fmtDays(res.daysLeft)}`, "ok");
  await refreshStatus();
});

loadSettings().then(refreshStatus);
