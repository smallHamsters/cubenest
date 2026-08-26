-- CubeNest profiles — 사용자 프로필(표시 이름·역할) + RLS 첫 전례
-- 적용법(둘 중 하나):
--   (A) Supabase 대시보드 → SQL Editor 에 이 파일 전체를 붙여넣고 Run.  ← CLAUDE.md 규약
--   (B) supabase/migrations/ 에 이 파일을 두고  supabase db push
-- 전체가 재실행 안전(if not exists / or replace / drop … if exists)이다.
--
-- ⚠ 이 파일이 리포의 **첫 RLS 정책**이다(이전엔 rate_counter 의 "정책 0개=차단"뿐).
--   이후 모든 사용자 테이블(quiz_results·my_items·entitlements)이 아래 4가지를 복사한다:
--     · 소유자 컬럼 이름은 언제나 user_id (references auth.users(id) on delete cascade)
--     · 정책마다 to authenticated 명시
--     · auth.uid() 는 (select auth.uid()) 로 감싼다 — initplan 캐싱(Supabase 권장)
--     · insert/update 에는 with check 필수
--   근거: 마스터 §6.4.1.

-- 1) 테이블
--    auth.users 는 auth 스키마라 PostgREST 에 노출되지 않는다 → 클라가 조회할 public 앵커가 필요하다.
--    세션 JWT 의 user_metadata 는 사용자가 updateUser() 로 스스로 바꿀 수 있어 표시용 이상으로 못 쓴다.
create table if not exists public.profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  nickname   text,
  -- role(parent|teacher)은 self-assign 이 가능하므로 **권한 판정에 쓰지 않는다** — 표시용 라벨.
  -- 권한은 RLS·서버가 판정한다(마스터 §6.2·§6.5). 지금은 컬럼만 두고 UI 를 붙이지 않는다.
  role       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 20 = assets/js/mydata.js setNickname() 의 잘림 길이와 **같은 값이어야 한다**.
  -- 갈라지면 클라가 통과시킨 값을 DB 가 거부해 "저장했는데 안 되는" 상태가 된다.
  check (nickname is null or char_length(nickname) <= 20)
);

-- 2) 행 자동 생성 — auth.users insert 트리거
--    클라이언트 upsert 를 1차 수단으로 쓰지 않는다: 가입만 하고 앱을 안 열면 행이 영영 안 생긴다(§6.4.1).
--    security definer + search_path='' 는 Supabase 보안 린터 규칙이다(함수 안 이름은 전부 스키마 수식).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3) updated_at 자동 갱신 (이후 테이블들이 그대로 재사용한다)
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- 4) 백필 — 트리거는 **신규 가입만** 잡는다. 이미 가입한 사용자를 위해 1회.
--    (이 문장이 없으면 기존 사용자는 /account 에서 프로필이 영영 안 생긴다.)
insert into public.profiles (user_id)
select id from auth.users
on conflict (user_id) do nothing;

-- 5) RLS — 여기가 실제 방어선이다("본인 것만").
alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (user_id = (select auth.uid()));

-- insert 는 트리거가 실패했을 때 클라이언트가 자기 행을 되살리는 **자가 치유** 경로다.
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- delete 정책은 **의도적으로 주지 않는다(=차단)**. 규약의 "테이블당 4정책"에서 벗어나는 유일한 지점.
--   · 프로필 행 삭제 = 계정 메타 유실인데, 되살릴 트리거가 없다(트리거는 auth.users insert 에만 걸린다).
--   · 탈퇴는 auth.users 삭제 → 위 FK 의 on delete cascade 가 처리하므로 사용자용 delete 경로가 불필요하다.
--   entitlements 와 같은 "정책 0개 = 차단" 패턴이다(§6.4.1).
