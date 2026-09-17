import { submissionsPage, submissionCode, questionInfo } from "./leetcode";
import { upsertFile, readJsonFile } from "./github";
import { buildFile, difficultyFolder } from "./sync";
import { extFor } from "./format";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const PAGE = 20;

export async function backfill(): Promise<void> {
  const { GH_TOKEN, GH_REPO } = process.env;
  if (!GH_TOKEN || !GH_REPO) throw new Error("Missing GH_TOKEN or GH_REPO");

  const synced = await readJsonFile(GH_REPO, GH_TOKEN, "synced.json");
  const seen = new Set<string>(); // slugs handled this run; keeps only the newest accepted per problem

  let offset = 0;
  let lastKey: string | null = null;
  let changed = 0;

  while (true) {
    const page = await submissionsPage(offset, PAGE, lastKey);

    for (const sub of page.submissions) {
      if (sub.statusDisplay !== "Accepted") continue; // successes only
      if (seen.has(sub.titleSlug)) continue;          // newest accepted wins, skip older ones
      seen.add(sub.titleSlug);

      if (synced[sub.titleSlug] === sub.id) continue; // already synced this exact submission

      const [detail, info] = await Promise.all([submissionCode(sub.id), questionInfo(sub.titleSlug)]);
      const path = `${difficultyFolder(info.difficulty)}/${sub.titleSlug}/solution.${extFor(detail.lang.name)}`;
      const file = buildFile(sub.titleSlug, info, detail);

      await upsertFile(GH_REPO, GH_TOKEN, path, file, `Backfill ${info.questionFrontendId}. ${info.title}`);
      synced[sub.titleSlug] = sub.id;
      changed++;
      await sleep(600);

      // checkpoint the state file every 25 pushes so a crash doesn't lose progress
      if (changed % 25 === 0) {
        await upsertFile(GH_REPO, GH_TOKEN, "synced.json",
          JSON.stringify(synced, null, 2) + "\n", `Backfill checkpoint (${changed})`);
      }
    }

    if (!page.hasNext) break;
    lastKey = page.lastKey;
    offset += PAGE;
    await sleep(800); // gentle between pages
  }

  if (changed > 0) {
    await upsertFile(GH_REPO, GH_TOKEN, "synced.json",
      JSON.stringify(synced, null, 2) + "\n", `Backfill state (${changed} total)`);
  }
  console.log(`Backfill done. ${changed} submission(s) synced.`);
}