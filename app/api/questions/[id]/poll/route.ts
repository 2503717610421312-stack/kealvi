import { getPoll } from "@/lib/polls";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: questionId } = await params;
  const { searchParams } = new URL(req.url);
  const voterId = searchParams.get("voterId") ?? undefined;

  try {
    const poll = await getPoll(questionId, voterId);
    if (!poll) {
      return Response.json({ poll: null });
    }
    return Response.json({ poll });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
