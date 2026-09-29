const ENDPOINT = "https://leetcode.com/graphql";

function headers() {
  const session = process.env.LEETCODE_SESSION;
  const csrf = process.env.LEETCODE_CSRF;
  if (!session || !csrf) {
    throw new Error("Missing LEETCODE_SESSION or LEETCODE_CSRF");
  }
  return {
    "Content-Type": "application/json",
    "x-csrftoken": csrf,
    Referer: "https://leetcode.com",
    "User-Agent": "sync-leetcode",
    Cookie: `LEETCODE_SESSION=${session}; csrftoken=${csrf}`,
  };
}

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`LeetCode query failed: ${res.status} ${await res.text()}`);
  
  
  const json = await res.json();

  if (json.errors) throw new Error(`LeetCode errors: ${JSON.stringify(json.errors)}`);
  return json.data as T;
}

// Throws if the session is signed out; otherwise returns days until the
// LEETCODE_SESSION JWT expires (Infinity if the token has no readable expiry).
export async function checkAuth(): Promise<{ username: string; daysLeft: number }> {
  const { userStatus } = await gql<{ userStatus: { isSignedIn: boolean; username: string } }>(
    `query { userStatus { isSignedIn username } }`,
  );
  if (!userStatus.isSignedIn) throw new Error("LEETCODE_SESSION/LEETCODE_CSRF are expired or invalid");

  const expected = process.env.LEETCODE_USERNAME;
  if (expected && userStatus.username.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(`Session belongs to "${userStatus.username}", expected "${expected}"`);
  }

  let daysLeft = Infinity;
  try {
    const payload = JSON.parse(atob(process.env.LEETCODE_SESSION!.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/")));
    const exp = Number(payload.expired_time_ ?? payload.exp);
    if (exp) daysLeft = (exp * 1000 - Date.now()) / 86_400_000;
  } catch {}
  return { username: userStatus.username, daysLeft };
}

export interface RecentSubmission {
  id: string;
  title: string;
  titleSlug: string;
  timestamp: string;
  lang: string;
}

export async function recentAccepted(username: string, limit = 50): Promise<RecentSubmission[]> {
  const query = `query ($u: String!, $n: Int) {
    recentAcSubmissionList(username: $u, limit: $n) {
      id title titleSlug timestamp lang
    }
  }`;
  const data = await gql<{ recentAcSubmissionList: RecentSubmission[] }>(query, { u: username, n: limit });
  return data.recentAcSubmissionList ?? [];
}

export interface SubmissionDetail {
  code: string;
  lang: { name: string };
  runtimeDisplay: string;
  memoryDisplay: string;
}

export async function submissionCode(id: string): Promise<SubmissionDetail> {
  const query = `query ($id: Int!) {
    submissionDetails(submissionId: $id) {
      code runtimeDisplay memoryDisplay lang { name }
    }
  }`;
  const data = await gql<{ submissionDetails: SubmissionDetail | null }>(query, { id: Number(id) });
  // LeetCode returns null (not an error) when the session cookie is expired or invalid.
  if (!data.submissionDetails) {
    throw new Error(
      `No details for submission ${id}: LEETCODE_SESSION/LEETCODE_CSRF are likely expired. Refresh them from your browser cookies.`,
    );
  }
  return data.submissionDetails;
}

export interface QuestionInfo {
  questionFrontendId: string;
  title: string;
  difficulty: string;
  content: string; // HTML
}

export async function questionInfo(slug: string): Promise<QuestionInfo> {
  const query = `query ($s: String!) {
    question(titleSlug: $s) {
      questionFrontendId title difficulty content
    }
  }`;
  const data = await gql<{ question: QuestionInfo | null }>(query, { s: slug });
  if (!data.question) throw new Error(`No question found for slug "${slug}"`);
  return data.question;
}

export interface SubmissionListItem {
  id: string;
  title: string;
  titleSlug: string;
  statusDisplay: string;
  lang: string;
  timestamp: string;
}

export interface SubmissionListPage {
  lastKey: string | null;
  hasNext: boolean;
  submissions: SubmissionListItem[];
}

export async function submissionsPage(
  offset: number,
  limit: number,
  lastKey: string | null,
): Promise<SubmissionListPage> {
  const query = `query ($offset: Int!, $limit: Int!, $lastKey: String) {
    submissionList(offset: $offset, limit: $limit, lastKey: $lastKey) {
      lastKey hasNext
      submissions { id title titleSlug statusDisplay lang timestamp }
    }
  }`;
  const data = await gql<{ submissionList: SubmissionListPage }>(query, { offset, limit, lastKey });
  return data.submissionList;
}
// ---- Projects (leetcode.com/project) ----

export interface ProjectSubmission {
  id: string;
  problemSlug: string;
  status: string; // SUCCESS | FAILURE | PENDING | RUNNING
  createdAt: string;
  reportAvailable: boolean;
}

export interface ProjectSubmissionPage {
  hasMore: boolean;
  nodes: ProjectSubmission[];
}

export async function projectSubmissionsPage(skip: number, limit: number): Promise<ProjectSubmissionPage> {
  const query = `query ($skip: Int, $limit: Int) {
    projectSubmissionList(skip: $skip, limit: $limit) {
      hasMore
      nodes { id problemSlug status createdAt reportAvailable }
    }
  }`;
  const data = await gql<{ projectSubmissionList: ProjectSubmissionPage | null }>(query, { skip, limit });
  return data.projectSubmissionList ?? { hasMore: false, nodes: [] };
}

export interface ProjectDetail {
  slug: string;
  title: string;
  difficulty: string; // INTERMEDIATE | ADVANCED | EXPERT
  summary: string;
  description: string;
  languages: string[];
}

export async function projectDetail(slug: string): Promise<ProjectDetail> {
  const query = `query ($s: String!) {
    projectProblemDetail(problemSlug: $s) { slug title difficulty summary description languages }
  }`;
  const data = await gql<{ projectProblemDetail: ProjectDetail | null }>(query, { s: slug });
  if (!data.projectProblemDetail) throw new Error(`No project found for slug "${slug}"`);
  return data.projectProblemDetail;
}

// Parsed subset of the reportJson blob the report page renders.
export interface ProjectReport {
  submittedAt: string;
  submission?: { files: { path: string; kind: string; language?: string; content: string }[] };
  tests: { status: string; passed: number; total: number };
  analysis: Record<string, { status: string; rating?: string; contentMarkdown?: string }>;
}

// Returns null while the report is still being generated.
export async function projectReport(slug: string, id: string): Promise<ProjectReport | null> {
  const query = `query ($s: String!, $id: ID!) {
    projectSubmissionReport(problemSlug: $s, id: $id) { status errorMessage reportJson }
  }`;
  const data = await gql<{
    projectSubmissionReport: { status: string; errorMessage: string | null; reportJson: string | null } | null;
  }>(query, { s: slug, id });
  const r = data.projectSubmissionReport;
  if (!r?.reportJson) return null;
  return JSON.parse(r.reportJson) as ProjectReport;
}
