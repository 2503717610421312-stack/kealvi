"use client";
import { useEffect, useMemo, useState } from "react";
import { getVoterId } from "@/lib/voter";

type Question = {
  id: string;
  body: string;
  author: string | null;
  createdAt: string;
  pinned: boolean;
  hasPoll: boolean;
  score: number;
  upvotes: number;
  downvotes: number;
  currentVote: number;
};

type User = { id: string; userid: string };

type PollResult = {
  pollId: string;
  questionId: string;
  options: { id: string; label: string; voteCount: number }[];
  selectedOptionId: string | null;
};

function formatRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const diff = Date.now() - date.getTime();

  const seconds = Math.max(Math.floor(diff / 1000), 0);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);

  if (weeks > 0) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  if (days > 0) return `${days} day${days === 1 ? "" : "s"} ago`;
  if (hours > 0) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  if (minutes > 0) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  return `${seconds} sec${seconds === 1 ? "" : "s"} ago`;
}

function PollCard({ questionId, voterId }: { questionId: string; voterId: string }) {
  const [poll, setPoll] = useState<PollResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let canceled = false;

    async function loadPoll() {
      setLoading(true);
      const res = await fetch(
        `/api/questions/${questionId}/poll?voterId=${encodeURIComponent(voterId)}`
      );
      const data = await res.json();
      if (!canceled) {
        setPoll(data.poll ?? null);
        setLoading(false);
      }
    }

    loadPoll();
    return () => {
      canceled = true;
    };
  }, [questionId, voterId]);

  async function vote(optionId: string) {
    if (!poll) return;
    const selected = poll.selectedOptionId === optionId ? null : optionId;

    await fetch(`/api/questions/${questionId}/option-vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voterId, optionId: selected }),
    });

    const res = await fetch(
      `/api/questions/${questionId}/poll?voterId=${encodeURIComponent(voterId)}`
    );
    const data = await res.json();
    setPoll(data.poll ?? null);
  }

  if (loading) {
    return <p className="mt-3 text-sm text-muted">Loading poll…</p>;
  }

  if (!poll) return null;

  return (
    <div className="mt-4 rounded-2xl border border-dashed bg-background p-4 text-sm">
      <p className="mb-3 font-medium">Poll options</p>
      <div className="space-y-2">
        {poll.options.map((option) => {
          const selected = option.id === poll.selectedOptionId;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => vote(option.id)}
              className={`w-full rounded-2xl border px-3.5 py-2 text-left transition ${
                selected
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-border bg-surface hover:border-brand"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span>{option.label}</span>
                <span className="text-xs text-muted">{option.voteCount} vote{option.voteCount === 1 ? "" : "s"}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function QuestionsList({
  initialQuestions,
  initialHasMore,
}: {
  initialQuestions: Question[];
  initialHasMore: boolean;
}) {
  const [questions, setQuestions] = useState(initialQuestions);
  const [draft, setDraft] = useState("");
  const [pollOptions, setPollOptions] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("latest");
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authUserid, setAuthUserid] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
    const stored = localStorage.getItem("liveqa_user");
    if (stored) {
      try {
        setCurrentUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem("liveqa_user");
      }
    }
  }, []);

  const voterId = useMemo(() => getVoterId(), [hydrated, currentUser]);

  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      const url = query
        ? `/api/questions?q=${encodeURIComponent(query)}&sort=${encodeURIComponent(sort)}&voterId=${encodeURIComponent(voterId)}`
        : `/api/questions?sort=${encodeURIComponent(sort)}&voterId=${encodeURIComponent(voterId)}`;
      const res = await fetch(url);
      const data = await res.json();
      setQuestions(data.questions);
      setHasMore(data.hasMore);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, sort, voterId]);

  async function refreshQuestions() {
    const url = query
      ? `/api/questions?q=${encodeURIComponent(query)}&sort=${encodeURIComponent(sort)}&voterId=${encodeURIComponent(voterId)}`
      : `/api/questions?sort=${encodeURIComponent(sort)}&voterId=${encodeURIComponent(voterId)}`;
    const res = await fetch(url);
    const data = await res.json();
    setQuestions(data.questions);
    setHasMore(data.hasMore);
  }

  async function submit() {
    if (!draft.trim()) return;

    const options = pollOptions
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const res = await fetch("/api/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body: draft,
        author: currentUser?.userid ?? "Anonymous",
        authorId: currentUser?.id,
        pollOptions: options.length > 1 ? options : undefined,
      }),
    });

    if (!res.ok) {
      return;
    }

    const created = await res.json();
    setQuestions((qs) => [
      {
        id: created.id,
        body: created.body,
        author: created.author,
        createdAt: created.created_at,
        pinned: created.pinned,
        hasPoll: created.has_poll,
        score: 0,
        upvotes: 0,
        downvotes: 0,
        currentVote: 0,
      },
      ...qs,
    ]);
    setDraft("");
    setPollOptions("");
  }

  async function vote(questionId: string, direction: number) {
    setQuestions((qs) =>
      qs.map((q) => {
        if (q.id !== questionId) return q;
        const current = q.currentVote;
        const nextDirection = current === direction ? 0 : direction;
        const nextScore = q.score + nextDirection - current;
        return {
          ...q,
          score: nextScore,
          currentVote: nextDirection,
          upvotes:
            nextDirection === 1
              ? q.upvotes + (current === -1 ? 1 : 1)
              : current === 1
              ? q.upvotes - 1
              : q.upvotes,
          downvotes:
            nextDirection === -1
              ? q.downvotes + (current === 1 ? 1 : 1)
              : current === -1
              ? q.downvotes - 1
              : q.downvotes,
        };
      })
    );

    const current = questions.find((q) => q.id === questionId)?.currentVote ?? 0;
    const nextDirection = current === direction ? 0 : direction;

    await fetch(`/api/questions/${questionId}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        voterId,
        direction: nextDirection,
      }),
    });

    refreshQuestions();
  }

  async function togglePin(questionId: string, pinned: boolean) {
    await fetch(`/api/questions/${questionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned }),
    });

    setQuestions((qs) =>
      qs.map((q) => (q.id === questionId ? { ...q, pinned } : q))
    );
  }

  async function handleAuth() {
    setAuthMessage("");
    const route = authMode === "login" ? "/api/auth/login" : "/api/auth/signup";
    const res = await fetch(route, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userid: authUserid, password: authPassword }),
    });

    const data = await res.json();
    if (!res.ok) {
      setAuthMessage(data.error ?? "Unable to sign in.");
      return;
    }

    localStorage.setItem("liveqa_user", JSON.stringify(data));
    setCurrentUser(data);
    setAuthUserid("");
    setAuthPassword("");
    setAuthMessage(authMode === "login" ? "Signed in." : "Account created.");
    refreshQuestions();
  }

  function logout() {
    localStorage.removeItem("liveqa_user");
    setCurrentUser(null);
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border bg-surface p-4 shadow-sm">
        {currentUser ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Signed in as {currentUser.userid}</p>
              <p className="text-sm text-muted">You can ask, vote, and pin questions.</p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="rounded-xl border px-4 py-2 text-sm transition hover:border-brand hover:text-brand"
            >
              Log out
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAuthMode("login")}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  authMode === "login" ? "bg-brand text-white" : "border"
                }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => setAuthMode("signup")}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  authMode === "signup" ? "bg-brand text-white" : "border"
                }`}
              >
                Sign up
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <input
                value={authUserid}
                onChange={(e) => setAuthUserid(e.target.value)}
                placeholder="User name"
                className="rounded-xl border bg-background px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-brand"
              />
              <input
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="Password"
                className="rounded-xl border bg-background px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-brand"
              />
              <button
                type="button"
                onClick={handleAuth}
                className="rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-strong"
              >
                {authMode === "login" ? "Login" : "Create account"}
              </button>
            </div>
            {authMessage && <p className="text-sm text-muted">{authMessage}</p>}
          </div>
        )}
      </div>

      <div className="rounded-2xl border bg-surface p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder={currentUser ? `Ask a question as ${currentUser.userid}…` : "Ask a question…"}
              className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-brand"
            />
            <textarea
              value={pollOptions}
              onChange={(e) => setPollOptions(e.target.value)}
              placeholder="Optional: add poll options separated by commas"
              className="mt-3 w-full resize-none rounded-xl border bg-background px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-brand"
              rows={2}
            />
            <p className="mt-2 text-xs text-muted">
              Add at least two comma-separated options to create a poll question.
            </p>
          </div>
          <button
            onClick={submit}
            className="shrink-0 rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-strong"
          >
            Ask
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search questions…"
          className="w-full rounded-xl border bg-surface px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-brand"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:border-brand"
        >
          <option value="latest">Latest first</option>
          <option value="earliest">Earliest first</option>
        </select>
        <span className="shrink-0 text-xs text-muted">
          {hydrated ? "Interactive ✓" : "Loading interactivity…"}
        </span>
      </div>

      <ul className="space-y-3">
        {questions.map((q) => (
          <li
            key={q.id}
            className="space-y-4 rounded-2xl border bg-surface p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => vote(q.id, 1)}
                  className={`rounded-2xl border px-3 py-2 text-sm font-semibold transition ${
                    q.currentVote === 1
                      ? "border-brand bg-brand-soft text-brand"
                      : "border-border bg-background hover:border-brand"
                  }`}
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => vote(q.id, -1)}
                  className={`rounded-2xl border px-3 py-2 text-sm font-semibold transition ${
                    q.currentVote === -1
                      ? "border-brand bg-brand-soft text-brand"
                      : "border-border bg-background hover:border-brand"
                  }`}
                >
                  ▼
                </button>
                <div className="text-sm leading-none">
                  <p className="font-semibold">{q.score}</p>
                  <p className="text-xs text-muted">votes</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                {q.pinned && (
                  <span className="rounded-full bg-brand-soft px-3 py-1 text-brand">
                    Pinned
                  </span>
                )}
                <span>{q.author ? `Asked by ${q.author}` : "Asked anonymously"}</span>
                <span>·</span>
                <span>{formatRelativeTime(q.createdAt)}</span>
                {currentUser && (
                  <button
                    onClick={() => togglePin(q.id, !q.pinned)}
                    className="rounded-full border px-3 py-1 text-xs transition hover:border-brand"
                  >
                    {q.pinned ? "Unpin" : "Pin"}
                  </button>
                )}
              </div>
            </div>

            <p className="text-sm leading-snug">{q.body}</p>

            {q.hasPoll && (
              <PollCard questionId={q.id} voterId={voterId} />
            )}
          </li>
        ))}
      </ul>

      {questions.length === 0 && (
        <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted">
          No questions yet — be the first to ask.
        </p>
      )}

      {hasMore && (
        <div className="flex justify-center">
          <button
            onClick={async () => {
              setLoading(true);
              const res = await fetch(
                `/api/questions?offset=${questions.length}&sort=${encodeURIComponent(sort)}&voterId=${encodeURIComponent(voterId)}`
              );
              const data = await res.json();
              setQuestions((qs) => [...qs, ...data.questions]);
              setHasMore(data.hasMore);
              setLoading(false);
            }}
            disabled={loading}
            className="rounded-xl border bg-surface px-5 py-2.5 text-sm font-medium transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
