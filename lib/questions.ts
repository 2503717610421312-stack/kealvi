import { supabase } from "@/lib/supabase";

type QuestionRow = {
  id: string;
  body: string;
  author: string | null;
  author_id: string | null;
  pinned: boolean;
  has_poll: boolean;
  created_at: string;
};

type VoteRow = {
  question_id: string;
  direction: number;
  voter_id: string;
};

type VoteSummary = {
  score: number;
  upvotes: number;
  downvotes: number;
  currentVote: number;
};

function buildSort(sort: string) {
  const ascending = sort === "earliest";
  return [
    { column: "pinned", ascending: false },
    { column: "created_at", ascending },
  ] as const;
}

function summarizeVotes(rows: VoteRow[], voterId?: string): Record<string, VoteSummary> {
  return rows.reduce<Record<string, VoteSummary>>((map, row) => {
    const summary = map[row.question_id] ?? {
      score: 0,
      upvotes: 0,
      downvotes: 0,
      currentVote: 0,
    };

    summary.score += row.direction;
    if (row.direction === 1) summary.upvotes += 1;
    if (row.direction === -1) summary.downvotes += 1;
    if (voterId && row.voter_id === voterId) {
      summary.currentVote = row.direction;
    }

    map[row.question_id] = summary;
    return map;
  }, {});
}

async function getVoteSummaries(questionIds: string[], voterId?: string) {
  if (questionIds.length === 0) return {};

  const { data, error } = await supabase
    .from("votes")
    .select("question_id, direction, voter_id")
    .in("question_id", questionIds);

  if (error) {
    throw new Error(error.message);
  }

  return summarizeVotes((data ?? []) as VoteRow[], voterId);
}

function normalizeQuestion(row: QuestionRow, summary: VoteSummary | undefined) {
  return {
    id: row.id,
    body: row.body,
    author: row.author,
    createdAt: row.created_at,
    pinned: row.pinned,
    hasPoll: row.has_poll,
    score: summary?.score ?? 0,
    upvotes: summary?.upvotes ?? 0,
    downvotes: summary?.downvotes ?? 0,
    currentVote: summary?.currentVote ?? 0,
  };
}

export async function getQuestionsPage(
  offset: number,
  limit: number,
  sort: string = "latest",
  voterId?: string
) {
  const sortFields = buildSort(sort);
  let query = supabase
    .from("questions")
    .select("id, body, author, author_id, pinned, has_poll, created_at")
    .order(sortFields[0].column, { ascending: sortFields[0].ascending })
    .order(sortFields[1].column, { ascending: sortFields[1].ascending })
    .range(offset, offset + limit);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as QuestionRow[];
  const hasMore = rows.length > limit;
  const pageRows = rows.slice(0, limit);
  const questionIds = pageRows.map((q) => q.id);
  const voteSummaries = await getVoteSummaries(questionIds, voterId);

  return {
    questions: pageRows.map((q) => normalizeQuestion(q, voteSummaries[q.id])),
    hasMore,
  };
}

export async function searchQuestions(
  q: string,
  limit: number,
  sort: string = "latest",
  voterId?: string
) {
  const sortFields = buildSort(sort);
  const { data, error } = await supabase
    .from("questions")
    .select("id, body, author, author_id, pinned, has_poll, created_at")
    .textSearch("body", q, { type: "websearch", config: "english" })
    .order(sortFields[0].column, { ascending: sortFields[0].ascending })
    .order(sortFields[1].column, { ascending: sortFields[1].ascending })
    .limit(limit);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as QuestionRow[];
  const questionIds = rows.map((q) => q.id);
  const voteSummaries = await getVoteSummaries(questionIds, voterId);

  return rows.map((row) => normalizeQuestion(row, voteSummaries[row.id]));
}
