-- CubeNest my_items — 내 자료(문제지·모양)
-- 적용법(둘 중 하나):
--   (A) Supabase 대시보드 → SQL Editor 에 이 파일 전체를 붙여넣고 Run.  ← CLAUDE.md 규약
--   (B) supabase/migrations/ 에 이 파일을 두고  supabase db push
-- 전체가 재실행 안전(if not exists / or replace / drop … if exists)이다.
--
-- 전례는 supabase_profiles_schema_260826.sql · supabase_quizresults_schema_260827.sql 을 따른다:
--   user_id 컬럼명 · to authenticated · (select auth.uid()) 래핑 · insert/update 에 with check.
-- quiz_results 와 같이 **delete 정책을 준다** — /my 의 '삭제'가 실제 사용자 기능이다.

-- 1) 테이블
--    재현 가능한 산출물은 본문을 저장하지 않는다(마스터 §6.4). 문제지는 **URL 하나가 곧 사양**이라
--    (유형·난이도·seed)만 남기고, 열 때 서버가 같은 문제지를 다시 만든다. 정답지처럼 게이트가
--    필요한 산출물도 **열 때마다 로그인·이용권을 다시 통과**한다(본문을 방치하지 않는다).
create table if not exists public.my_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  -- item_id = 클라이언트가 **URL 에서 결정적으로** 뽑는 id('ws_<djb2>'). 이게 멱등키다.
  --   같은 URL = 같은 산출물이므로, /my '열기'·새로고침으로 다시 열려도 사본이 안 쌓인다.
  --   생성 규칙의 단일 출처는 CubeNest.mydata.urlId() 다(worksheets·quiz 가 같이 쓴다).
  item_id     text not null,
  -- 퀴즈 결과는 여기 오지 않는다 — quiz_results 가 따로 있고 멱등키·수명이 다르다(누적 vs 덮어쓰기).
  kind        text not null check (kind in ('worksheet', 'shape')),
  -- 목록에 필요한 필드는 payload 밖 실컬럼으로 승격(§6.4.1). 클라는 select * 금지.
  title       text,
  sub         text,
  type        text,
  seed        text,
  n           smallint,
  -- url 은 **/my 기준 상대경로**('../worksheets/?…')다. /my 의 '열기' 버튼의 단일 조건이라
  --   payload 가 아니라 실컬럼으로 올린다. 절대 URL 로 바꾸지 말 것 — 호스팅 하위경로가 바뀌면 전부 깨진다.
  url         text,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, item_id),
  check (n is null or (n > 0 and n <= 200)),
  check (octet_length(payload::text) < 262144)
);

-- 2) 인덱스 — /my 는 "내 것을 최신순으로" 만 읽는다. payload 에는 인덱스를 만들지 않는다(§6.4.1).
create index if not exists my_items_user_id_created_at_idx
  on public.my_items (user_id, created_at desc);

-- 3) updated_at 자동 갱신 — profiles 마이그레이션이 만든 함수를 재사용한다.
--    (이 파일만 단독 실행해도 되도록 or replace 로 다시 선언한다. 내용은 동일하다.)
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists my_items_touch_updated_at on public.my_items;
create trigger my_items_touch_updated_at
  before update on public.my_items
  for each row execute function public.touch_updated_at();

-- 4) RLS — 여기가 실제 방어선이다("본인 것만").
alter table public.my_items enable row level security;

drop policy if exists my_items_select_own on public.my_items;
create policy my_items_select_own on public.my_items
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists my_items_insert_own on public.my_items;
create policy my_items_insert_own on public.my_items
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- update 가 필요한 이유: 같은 URL(같은 item_id)로 다시 저장하면 제목·문항수가 갱신될 수 있다.
--   quiz_results 와 달리 여기서는 upsert 가 **덮어쓰기**다(산출물은 누적 대상이 아니다).
drop policy if exists my_items_update_own on public.my_items;
create policy my_items_update_own on public.my_items
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists my_items_delete_own on public.my_items;
create policy my_items_delete_own on public.my_items
  for delete to authenticated
  using (user_id = (select auth.uid()));
