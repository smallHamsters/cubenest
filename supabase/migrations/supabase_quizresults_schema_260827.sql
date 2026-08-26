-- CubeNest quiz_results — 퀴즈 완료 결과(누적·멱등)
-- 적용법(둘 중 하나):
--   (A) Supabase 대시보드 → SQL Editor 에 이 파일 전체를 붙여넣고 Run.  ← CLAUDE.md 규약
--   (B) supabase/migrations/ 에 이 파일을 두고  supabase db push
-- 전체가 재실행 안전(if not exists / drop … if exists)이다.
--
-- 전례는 supabase_profiles_schema_260826.sql 을 그대로 따른다:
--   user_id 컬럼명 · to authenticated · (select auth.uid()) 래핑 · insert/update 에 with check.
-- ⚠ profiles 와 달리 **delete 정책을 준다** — /my 의 '삭제' 버튼이 실제 사용자 기능이고,
--   결과 행은 지워도 되살릴 필요가 없다(같은 seed 로 다시 풀면 새 시도가 쌓인다).

-- 1) 테이블
--    저장은 덮어쓰기가 아니라 **누적(append-only)** 이다. 같은 퀴즈를 다시 풀면 새 시도로 쌓인다.
--    재현 가능한 산출물은 본문을 저장하지 않는다(마스터 §6.4) — (type·seed·n) 이 곧 문제 사양이라
--    열 때 서버가 같은 문제를 다시 만든다. 그래서 행이 작고 동기화 비용이 사실상 0 이다.
create table if not exists public.quiz_results (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  -- attempt_id = **클라이언트가 세션 시작 때 발급하는 멱등키**(run.js). 이게 없으면
  -- "실패 vs 성공했는데 응답만 유실"을 구분 못 해 재시도가 곧 중복이 된다(§6.4.1).
  attempt_id  uuid not null,
  -- 목록에 필요한 필드는 payload 밖 **실컬럼으로 승격**한다(§6.4.1). 클라는 select * 금지.
  type        text not null,
  seed        text not null,
  n           smallint not null,
  score       smallint not null,
  title       text,
  stage       text,
  sub         text,
  payload     jsonb not null default '{}'::jsonb,
  -- 연습장 필기(정규화 좌표 획 배열)를 담을 자리. **이번 마이그레이션에서는 연결하지 않는다**
  -- (§6.4.1 권고: 스키마 구축과 연습장 저장을 한 커밋에 섞지 않는다). 컬럼만 미리 둔다.
  scratch     jsonb,
  created_at  timestamptz not null default now(),
  unique (user_id, attempt_id),
  check (n > 0 and n <= 100),
  check (score >= 0 and score <= n),
  -- CHECK 는 TOAST 이전 원문 바이트로 평가되어 정확한 예산이다.
  -- 클라이언트 버그가 DB 를 못 망가뜨리게 하는 최후 방어선(§6.4.1).
  check (octet_length(payload::text) < 262144)
);

-- 2) 인덱스 — /my 는 "내 것을 최신순으로" 만 읽는다. payload 에는 인덱스를 만들지 않는다(§6.4.1).
create index if not exists quiz_results_user_id_created_at_idx
  on public.quiz_results (user_id, created_at desc);

-- 3) RLS — 여기가 실제 방어선이다("본인 것만").
alter table public.quiz_results enable row level security;

drop policy if exists quiz_results_select_own on public.quiz_results;
create policy quiz_results_select_own on public.quiz_results
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists quiz_results_insert_own on public.quiz_results;
create policy quiz_results_insert_own on public.quiz_results
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- update 는 실질적으로 scratch(연습장) 뒤늦은 첨부 정도에만 쓰인다. 결과 자체는 누적이라 고치지 않는다.
drop policy if exists quiz_results_update_own on public.quiz_results;
create policy quiz_results_update_own on public.quiz_results
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists quiz_results_delete_own on public.quiz_results;
create policy quiz_results_delete_own on public.quiz_results
  for delete to authenticated
  using (user_id = (select auth.uid()));
