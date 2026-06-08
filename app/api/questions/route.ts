import { supabase } from "@/lib/supabase";
import { getQuestionsPage, searchQuestions } from "@/lib/questions";

const PAGE_SIZE = 10;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const sort = searchParams.get("sort") ?? "latest";
  const voterId = searchParams.get("voterId") ?? undefined;

  if (q) {
    const questions = await searchQuestions(q, PAGE_SIZE, sort, voterId);
    return Response.json({ questions, hasMore: false });
  }

  const offset = Number(searchParams.get("offset") ?? 0);
  const { questions, hasMore } = await getQuestionsPage(offset, PAGE_SIZE, sort, voterId);
  return Response.json({ questions, hasMore });
}

export async function POST(req: Request) {
  const { body, author, authorId, pollOptions } = await req.json();

  if (!body?.trim()) {
    return Response.json({ error: "Question body is required." }, { status: 400 });
  }

  const { data: question, error: questionError } = await supabase
    .from("questions")
    .insert({
      body: body.trim(),
      author: author?.trim() || null,
      author_id: authorId || null,
    })
    .select("id, body, author, author_id, pinned, has_poll, created_at")
    .single();

  if (questionError) {
    return Response.json({ error: questionError.message }, { status: 500 });
  }

  if (Array.isArray(pollOptions) && pollOptions.length > 1) {
    const { data: poll, error: pollError } = await supabase
      .from("polls")
      .insert({ question_id: question.id })
      .select("id")
      .single();

    if (pollError) {
      return Response.json({ error: pollError.message }, { status: 500 });
    }

    const formattedOptions = pollOptions
      .map((option: string) => option?.trim())
      .filter(Boolean)
      .slice(0, 6)
      .map((label) => ({ poll_id: poll.id, label }));

    if (formattedOptions.length > 1) {
      const { error: optionError } = await supabase
        .from("poll_options")
        .insert(formattedOptions);

      if (optionError) {
        return Response.json({ error: optionError.message }, { status: 500 });
      }

      await supabase
        .from("questions")
        .update({ has_poll: true })
        .eq("id", question.id);
    }
  }

  return Response.json(question);
}
