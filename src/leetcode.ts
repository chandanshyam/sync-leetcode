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

export interface RecentSubmission {
  id: string;
  title: string;
  titleSlug: string;
  timestamp: string;
  lang: string;
}

export async function recentAccepted(username: string, limit = 20): Promise<RecentSubmission[]> {
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
  const data = await gql<{ submissionDetails: SubmissionDetail }>(query, { id: Number(id) });
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
  const data = await gql<{ question: QuestionInfo }>(query, { s: slug });
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