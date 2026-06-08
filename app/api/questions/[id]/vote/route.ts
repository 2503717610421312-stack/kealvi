import { supabase } from "@/lib/supabase";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: questionId } = await params;
  const { voterId, direction } = await req.json();

  if (!voterId?.trim()) {
    return Response.json({ error: "voterId is required." }, { status: 400 });
  }

  if (![1, -1, 0].includes(direction)) {
    return Response.json({ error: "direction must be 1, -1, or 0." }, { status: 400 });
  }

  if (direction === 0) {
    const { error: deleteError } = await supabase
      .from("votes")
      .delete()
      .eq("question_id", questionId)
      .eq("voter_id", voterId);

    if (deleteError) {
      return Response.json({ error: deleteError.message }, { status: 500 });
    }

    return Response.json({ ok: true, direction: 0 });
  }

  const { error } = await supabase
    .from("votes")
    .upsert(
      { question_id: questionId, voter_id: voterId, direction },
      { onConflict: ["question_id", "voter_id"] }
    );

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, direction });
}
