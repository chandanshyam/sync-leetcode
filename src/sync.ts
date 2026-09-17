import { recentAccepted, submissionCode, questionInfo, type QuestionInfo, type SubmissionDetail } from "./leetcode";
import { htmlToText, wrapAsComment, extFor } from "./format";
import { upsertFile, readJsonFile } from "./github";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function difficultyFolder(d: string): string {
  const map: Record<string, string> = { Easy: "easy", Medium: "medium", Hard: "hard" };
  return map[d] ?? "other";
}

// Build the full file: problem statement as a comment, then the solution code.
export function buildFile(slug: string, info: QuestionInfo, detail: SubmissionDetail): string {
  const statement = [
    `${info.questionFrontendId}. ${info.title}   [${info.difficulty}]`,
    `https://leetcode.com/problems/${slug}/`,
    ``,
    `Runtime: ${detail.runtimeDisplay}   Memory: ${detail.memoryDisplay}`,
    ``,
    htmlToText(info.content),
  ].join("\n");

  const comment = wrapAsComment(statement, detail.lang.name);
  return comment + detail.code.trimEnd() + "\n";
}

export async function run(): Promise<void> {
  const { LEETCODE_USERNAME, GH_TOKEN, GH_REPO } = process.env;

  if (!LEETCODE_USERNAME || !GH_TOKEN || !GH_REPO) {
    throw new Error("Missing LEETCODE_USERNAME, GH_TOKEN or GH_REPO");
  }

  const subs = await recentAccepted(LEETCODE_USERNAME);
  // synced.json maps titleSlug -> last synced submission id, so a better
  // resubmission overwrites the old file and reruns skip unchanged ones.
  const synced = await readJsonFile(GH_REPO, GH_TOKEN, "synced.json");

  let changed = 0;
  for (const s of subs) {
    if (synced[s.titleSlug] === s.id) continue;

    const [detail, info] = await Promise.all([submissionCode(s.id), questionInfo(s.titleSlug)]);
    const path = `${difficultyFolder(info.difficulty)}/${s.titleSlug}/solution.${extFor(detail.lang.name)}`;
    const file = buildFile(s.titleSlug, info, detail);

    await upsertFile(GH_REPO, GH_TOKEN, path, file, `Sync ${info.questionFrontendId}. ${info.title}`);
    synced[s.titleSlug] = s.id;
    changed++;
    await sleep(600); // stay under LeetCode's rate limiter
  }

  if (changed > 0) {
    await upsertFile(
      GH_REPO,
      GH_TOKEN,
      "synced.json",
      JSON.stringify(synced, null, 2) + "\n",
      `Update sync state (${changed} new)`,
    );
  }}