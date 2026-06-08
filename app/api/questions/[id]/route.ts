import { supabase } from "@/lib/supabase";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: questionId } = await params;
    const { body, pinned } = await req.json();

    if (body != null && !body?.trim()) {
      return Response.json(
        { error: "Question body cannot be empty." },
        { status: 400 }
      );
    }

    const updatePayload: Record<string, unknown> = {};
    if (body != null) updatePayload.body = body.trim();
    if (pinned != null) updatePayload.pinned = Boolean(pinned);

    if (Object.keys(updatePayload).length === 0) {
      return Response.json({ error: "Nothing to update." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("questions")
      .update(updatePayload)
      .eq("id", questionId)
      .select("id, body, author, author_id, pinned, has_poll, created_at")
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(data);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: questionId } = await params;
    const { requesterUserid } = await req.json();

    if (!requesterUserid?.trim()) {
      return Response.json(
        { error: "requesterUserid is required." },
        { status: 400 }
      );
    }

    const { data: existing, error: existingError } = await supabase
      .from("questions")
      .select("author")
      .eq("id", questionId)
      .single();

    if (existingError) {
      return Response.json({ error: existingError.message }, { status: 500 });
    }

    if (existing?.author !== requesterUserid.trim()) {
      return Response.json({ error: "Not authorized." }, { status: 403 });
    }

    const { error } = await supabase
      .from("questions")
      .delete()
      .eq("id", questionId);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

