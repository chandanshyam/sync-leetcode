import { projectSubmissionsPage, projectDetail, projectReport, type ProjectDetail, type ProjectReport } from "./leetcode";
import { commitFiles } from "./github";
import { htmlToText } from "./format";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const PAGE = 20;

// synced.json key for a project, kept apart from problem slugs.
const stateKey = (slug: string) => `project:${slug}`;

// Folder named after the project: "Rate Limiter" -> "ratelimiter"
const folderName = (title: string) => title.toLowerCase().replace(/[^a-z0-9]/g, "");

// "codeQuality" -> "Code Quality"
const humanize = (id: string) => id.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());

function buildReadme(detail: ProjectDetail, report: ProjectReport): string {
  // description may come back as HTML or markdown
  const description = /<[a-z][^>]*>/i.test(detail.description) ? htmlToText(detail.description) : detail.description.trim();
  const lines = [
    `# ${detail.title}   [${detail.difficulty}]`,
    ``,
    `https://leetcode.com/project/${detail.slug}/`,
    ``,
    `Tests: ${report.tests.passed}/${report.tests.total} passed   Submitted: ${report.submittedAt}`,
    ``,
    description,
  ];

  const sections = Object.entries(report.analysis ?? {}).filter(([, s]) => s.status === "completed" && s.contentMarkdown);
  if (sections.length > 0) {
    lines.push(``, `---`, ``, `# Review`);
    for (const [id, s] of sections) {
      const rating = s.rating && s.rating !== "not_evaluated" ? ` (${s.rating.replace(/_/g, " ")})` : "";
      lines.push(``, `## ${humanize(id)}${rating}`, ``, s.contentMarkdown!.trim());
    }
  }
  return lines.join("\n") + "\n";
}

// Push the newest successful submission of each project to projects/<slug>/.
// `all` walks every page (backfill); otherwise only the most recent page is checked.
export async function syncProjects(
  repo: string,
  token: string,
  synced: Record<string, string>,
  all: boolean,
): Promise<number> {
  const seen = new Set<string>(); // newest successful submission per project wins
  let changed = 0;

  for (let skip = 0; ; skip += PAGE) {
    const page = await projectSubmissionsPage(skip, PAGE);

    for (const sub of page.nodes) {
      if (sub.status !== "SUCCESS" || !sub.reportAvailable) continue;
      if (seen.has(sub.problemSlug)) continue;
      seen.add(sub.problemSlug);

      if (synced[stateKey(sub.problemSlug)] === sub.id) continue;

      const [detail, report] = await Promise.all([projectDetail(sub.problemSlug), projectReport(sub.problemSlug, sub.id)]);
      if (!report?.submission?.files.length) {
        console.log(`Skipping project ${sub.problemSlug}: report for submission ${sub.id} has no files yet.`);
        continue;
      }

      const dir = `projects/${folderName(detail.title)}`;
      const files = report.submission.files.map((f) => ({ path: `${dir}/${f.path}`, content: f.content }));
      // don't clobber a README.md the submission itself contains
      const readme = files.some((f) => f.path === `${dir}/README.md`) ? `${dir}/LEETCODE.md` : `${dir}/README.md`;
      files.push({ path: readme, content: buildReadme(detail, report) });

      await commitFiles(repo, token, files, `Sync project ${detail.title}`, dir);
      synced[stateKey(sub.problemSlug)] = sub.id;
      changed++;
      await sleep(600);
    }

    if (!all || !page.hasMore) break;
    await sleep(800);
  }

  return changed;
}
