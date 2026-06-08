-- Day 5 schema — run this once in the Supabase SQL Editor.
-- It resets to a clean slate and adds support for login, pinning,
-- polls, upvotes/downvotes, search, and timestamped questions.

-- ── reset ──────────────────────────────────────────────────────────────────
drop table if exists poll_votes;
drop table if exists poll_options;
drop table if exists polls;
drop table if exists bookmarks;
drop table if exists votes;
drop table if exists questions cascade;
drop table if exists users cascade;
drop view if exists question_vote_counts;

-- ── users ──────────────────────────────────────────────────────────────────
create table users (
  id            uuid primary key default gen_random_uuid(),
  userid        text not null unique,
  password_hash text not null,
  display_name  text,
  created_at    timestamptz default now()
);

-- ── questions ──────────────────────────────────────────────────────────────
create table questions (
  id          uuid primary key default gen_random_uuid(),
  body        text not null,
  author      text,
  author_id   uuid references users(id) on delete set null,
  pinned      boolean default false,
  has_poll    boolean default false,
  created_at  timestamptz default now()
);

-- ── votes (upvote / downvote / unvote) ───────────────────────────────────────
create table votes (
  id           uuid primary key default gen_random_uuid(),
  question_id  uuid not null references questions(id) on delete cascade,
  voter_id     text not null,
  direction    smallint not null check (direction in (1, -1)),
  created_at   timestamptz default now(),
  unique (question_id, voter_id)
);

create index votes_question_id_idx on votes (question_id);
create index votes_voter_id_idx on votes (voter_id);

create view question_vote_counts as
select
  question_id,
  sum(direction) as score,
  sum(direction = 1)::int as upvotes,
  sum(direction = -1)::int as downvotes,
  count(*) as total_votes
from votes
group by question_id;

-- ── polls ───────────────────────────────────────────────────────────────────
create table polls (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null unique references questions(id) on delete cascade,
  created_at  timestamptz default now()
);

create table poll_options (
  id       uuid primary key default gen_random_uuid(),
  poll_id  uuid not null references polls(id) on delete cascade,
  label    text not null
);

create index poll_options_poll_id_idx on poll_options (poll_id);

create table poll_votes (
  id           uuid primary key default gen_random_uuid(),
  question_id  uuid not null references questions(id) on delete cascade,
  option_id    uuid not null references poll_options(id) on delete cascade,
  voter_id     text not null,
  created_at   timestamptz default now(),
  unique (question_id, voter_id)
);

create index poll_votes_question_id_idx on poll_votes (question_id);
create index poll_votes_voter_id_idx on poll_votes (voter_id);

-- ── bookmarks (existing feature support) ────────────────────────────────────
create table bookmarks (
  id           uuid primary key default gen_random_uuid(),
  question_id  uuid not null references questions(id) on delete cascade,
  user_id      uuid not null references users(id) on delete cascade,
  created_at   timestamptz default now(),
  unique (question_id, user_id)
);

create index bookmarks_question_id_idx on bookmarks (question_id);
create index bookmarks_user_id_idx on bookmarks (user_id);

-- ── full-text search index (Feature 5) ───────────────────────────────────────
create index questions_fts_idx on questions using gin (to_tsvector('english', body));

-- ── seed (~25 questions, spaced out in time so ordering is stable) ───────────
insert into questions (body, author, created_at)
select body, author, now() - (n || ' minutes')::interval
from (
  values
    (1,  'How do I deploy to Vercel?', 'Priya'),
    (2,  'What''s the difference between server and client components?', 'Marcus'),
    (3,  'When should I add a database index?', 'Aisha'),
    (4,  'How does Postgres full-text search work?', 'Diego'),
    (5,  'Why did my in-memory data vanish on restart?', 'Lena'),
    (6,  'Should I store a vote count or count vote rows?', 'Sam'),
    (7,  'What is a unique constraint good for?', 'Priya'),
    (8,  'How do I prevent double voting?', 'Noah'),
    (9,  'What''s the difference between SSR and hydration?', 'Aisha'),
    (10, 'How does optimistic UI actually work?', 'Marcus'),
    (11, 'When do I really need pagination?', 'Ravi'),
    (12, 'Offset vs cursor pagination — which one?', 'Lena'),
    (13, 'How do I debounce a search input?', 'Diego'),
    (14, 'Why must secrets stay on the server?', 'Sam'),
    (15, 'What is row-level security in Supabase?', 'Noah'),
    (16, 'How does connection pooling help on Vercel?', 'Priya'),
    (17, 'What is a GIN index and when do I use it?', 'Ravi'),
    (18, 'How do foreign keys protect my data?', 'Aisha'),
    (19, 'When should I move counts into Redis?', 'Marcus'),
    (20, 'How do I run a database migration safely?', 'Lena'),
    (21, 'What does on delete cascade actually do?', 'Diego'),
    (22, 'How do I seed test data quickly?', 'Sam'),
    (23, 'Why is my Vercel function cold starting?', 'Noah'),
    (24, 'How do I scale reads with replicas?', 'Ravi'),
    (25, 'What''s the best way to add auth later?', 'Priya')
) as seed(n, body, author);
