-- Run this once in Supabase: Project -> SQL Editor -> New query -> paste -> Run.
-- Creates a single-row table holding the whole game save as JSON.
-- RLS is enabled with no public policies, so only the service_role key
-- (used server-side by the Vercel API routes, never exposed to the phone)
-- can read or write it.

create table if not exists game_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table game_state enable row level security;
-- No policies added on purpose: only requests using the service_role key
-- (server-side only) can bypass RLS and touch this table.

-- Seed the single row with the same starting state the app ships with
-- locally (PM lvl 60, Product lvl 2, Discipline lvl 10, default sprint).
insert into game_state (id, data)
values ('andrei', '{"version":1,"createdAt":"2026-07-10","sprintStart":"2026-07-10","frozen":false,"lastProcessedDate":"2026-07-10","skills":{"pm":{"id":"pm","name":"Project Management","icon":"💼","level":60,"xp":0,"peakLevel":60},"product":{"id":"product","name":"Product Management","icon":"🧠","level":2,"xp":0,"peakLevel":2},"discipline":{"id":"discipline","name":"Дисциплина","icon":"🔥","level":10,"xp":0,"peakLevel":10}},"fitness":{"pullups":5,"pushups":25,"bodyFatPct":22,"weightKg":83},"weightLog":[{"date":"2026-07-10","weight":83}],"regularityLog":[],"activityLog":[],"quests":[{"id":"wake","label":"Подъём до 7:00","icon":"⏰","target":14,"xpPerTick":25,"reward":"discipline","progress":0},{"id":"course","label":"45 минут курса по продакту","icon":"📘","target":15,"xpPerTick":30,"reward":"product","progress":0},{"id":"workout","label":"Любая тренировка","icon":"🏋️","target":12,"xpPerTick":50,"reward":"fitness","progress":0},{"id":"case","label":"Разбор продуктового кейса","icon":"🧩","target":6,"xpPerTick":60,"reward":"product","progress":0},{"id":"calories","label":"День в коридоре калорий","icon":"🥗","target":15,"xpPerTick":30,"reward":"discipline","progress":0}],"today":{"date":"2026-07-10","xpBySkill":{"pm":0,"product":0,"discipline":0},"fitnessXp":0},"history":[]}'::jsonb)
on conflict (id) do nothing;
