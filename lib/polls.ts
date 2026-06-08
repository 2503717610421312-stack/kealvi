import { supabase } from "@/lib/supabase";

type PollRow = {
  id: string;
  question_id: string;
};

type PollOptionRow = {
  id: string;
  poll_id: string;
  label: string;
};

type PollVoteRow = {
  option_id: string;
  voter_id: string;
};

export type PollOption = {
  id: string;
  label: string;
  voteCount: number;
};

export type PollResult = {
  pollId: string;
  questionId: string;
  options: PollOption[];
  selectedOptionId: string | null;
};

export async function getPoll(questionId: string, voterId?: string) {
  const { data: pollData, error: pollError } = await supabase
    .from<PollRow>("polls")
    .select("id, question_id")
    .eq("question_id", questionId)
    .maybeSingle();

  if (pollError) throw new Error(pollError.message);
  if (!pollData) return null;

  const { data: options, error: optionsError } = await supabase
    .from<PollOptionRow>("poll_options")
    .select("id, poll_id, label")
    .eq("poll_id", pollData.id);

  if (optionsError) throw new Error(optionsError.message);

  const { data: votes, error: votesError } = await supabase
    .from<PollVoteRow>("poll_votes")
    .select("option_id, voter_id")
    .eq("question_id", questionId);

  if (votesError) throw new Error(votesError.message);

  const counts = votes?.reduce<Record<string, number>>((map, vote) => {
    map[vote.option_id] = (map[vote.option_id] ?? 0) + 1;
    return map;
  }, {}) ?? {};

  const selectedOptionId = voterId
    ? votes?.find((vote) => vote.voter_id === voterId)?.option_id ?? null
    : null;

  return {
    pollId: pollData.id,
    questionId,
    options: (options ?? []).map((option) => ({
      id: option.id,
      label: option.label,
      voteCount: counts[option.id] ?? 0,
    })),
    selectedOptionId,
  };
}
