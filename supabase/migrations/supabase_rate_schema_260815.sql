-- CubeNest rate limit — Postgres 카운터 + 원자적 검사 RPC
-- 적용법(둘 중 하나):
--   (A) Supabase 대시보드 → SQL Editor 에 이 파일 전체를 붙여넣고 Run.
--   (B) supabase/migrations/ 에 이 파일을 두고  supabase db push
-- Edge Function은 service_role로 접근(자동 주입). 이 테이블은 RLS로 잠가 익명 접근 차단.

-- 1) 카운터 테이블: bucket 문자열이 (식별자+종류+윈도우)를 인코딩. 윈도우가 바뀌면 새 bucket.
create table if not exists public.rate_counter (
  bucket     text primary key,
  count      integer not null default 0,
  expires_at timestamptz not null
);
create index if not exists rate_counter_expires_idx on public.rate_counter (expires_at);

-- 2) RLS 잠금: 정책 없음 → anon/authenticated 접근 불가. service_role(Edge)만 우회 접근.
alter table public.rate_counter enable row level security;

-- 3) 원자적 검사 함수: checks = [{bucket, "limit", ttl}, ...]
--    각 bucket을 +1 하고, 한도 초과가 하나라도 있으면 {ok:false, retryAfter, reason} 반환.
--    모두 통과면 {ok:true}. (증가+검사가 한 트랜잭션 = 경쟁 안전)
create or replace function public.check_rate(checks jsonb)
returns jsonb
language plpgsql
as $$
declare
  chk    jsonb;
  v_cnt  integer;
  v_now  timestamptz := now();
begin
  for chk in select * from jsonb_array_elements(checks)
  loop
    insert into public.rate_counter(bucket, count, expires_at)
      values (chk->>'bucket', 1, v_now + ((chk->>'ttl')::int * interval '1 second'))
    on conflict (bucket) do update
      set count = public.rate_counter.count + 1
    returning count into v_cnt;

    if v_cnt > (chk->>'limit')::int then
      return jsonb_build_object('ok', false,
                                'retryAfter', (chk->>'ttl')::int,
                                'reason', chk->>'reason');
    end if;
  end loop;
  return jsonb_build_object('ok', true);
end;
$$;

-- 4) (선택) 만료 카운터 청소. pg_cron 확장이 있으면 매시 삭제.
--    확장이 없으면 이 블록은 건너뛰어도 됨(행이 작아 방치해도 무방).
-- create extension if not exists pg_cron;
-- select cron.schedule('rate_counter_cleanup', '0 * * * *',
--   $$ delete from public.rate_counter where expires_at < now() $$);
