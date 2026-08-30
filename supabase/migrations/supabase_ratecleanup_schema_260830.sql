-- CubeNest rate limit 개정 — 만료 카운터 청소 + 함수 실행 권한 조이기
-- 선행: supabase_rate_schema_260815.sql (테이블·인덱스·RLS). 날짜 순으로 실행한다.
-- 적용법(둘 중 하나):
--   (A) Supabase 대시보드 → SQL Editor 에 이 파일 전체를 붙여넣고 Run.
--   (B) supabase/migrations/ 에 두고  supabase db push
-- 전체가 재실행 안전하다(or replace / 조건부 / 배치 루프).
--
-- ⚠ 260830 부터 `check_rate` 의 **정본은 이 파일이다.** 260815 파일의 함수 정의는 낡았다 —
--   그 파일을 단독으로 다시 Run 하면 아래 청소가 조용히 사라진다(260815 파일 상단 경고 참조).
--
-- [왜 필요한가]
--   종전엔 청소가 주석 처리돼 있었고 "행이 작아 방치해도 무방"이라고 적혀 있었다.
--   **그 판단이 틀렸다** — bucket 키에 분·시 윈도우가 들어가 공격이 없어도 정상 사용자가
--   분당 4행씩 새로 만들고, 지우는 주체가 아무도 없어 단조 증가했다. 거기에 키의 재료인
--   X-Anon-Id 와 X-Forwarded-For 를 클라가 정할 수 있어(우회는 별도 항목), 매 요청
--   랜덤화하면 요청당 신규 4행을 무한히 적재할 수 있다 → 디스크가 차면 profiles·
--   quiz_results·my_items 까지 함께 죽는다.
--
--   ⚠ 이 파일은 **증식을 청소**할 뿐 **우회 자체를 막지 않는다.** 버킷 키를 클라가
--     정하지 못하게 하는 것은 `_shared/rate.ts` 쪽 별도 작업이다. 특히 worksheet 은
--     위조 불가한 user.id 를 쥐고도 클라 헤더를 버킷 키로 쓴다.
--
-- 실행 전후로 크기를 보려면:  select count(*) from public.rate_counter;

-- 1) 검사 함수 재정의 — 기존 동작(원자적 증가+검사)은 그대로, 앞에 청소만 붙였다.
create or replace function public.check_rate(checks jsonb)
returns jsonb
language plpgsql
as $$
declare
  chk    jsonb;
  v_cnt  integer;
  v_now  timestamptz := now();
begin
  -- 만료 행 청소 — 매 호출의 약 1%에서만 돈다.
  --   매번 하면 hot path(/generate)가 느려지고, 안 하면 무한히 쌓인다. 그 사이를 택했다.
  --   ⚠ 아래 루프보다 **먼저** 해야 한다 — 한도 초과 시 루프 안에서 early return 하므로
  --     뒤에 두면 정작 남용 중일 때 청소가 건너뛰어진다.
  --   LIMIT 로 잘라 한 번에 오래 잠그지 않는다(rate_counter_expires_idx 사용).
  if random() < 0.01 then
    delete from public.rate_counter
     where bucket in (
       select bucket from public.rate_counter
        where expires_at < v_now
        order by expires_at
        limit 500
     );
  end if;

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

-- 2) 실행 권한 조이기 — 이 함수를 부르는 것은 Edge Function(service_role) 하나뿐이다.
--    Postgres 는 함수에 PUBLIC EXECUTE 를 기본으로 주므로 PostgREST 를 통해 anon 으로도
--    호출이 닿는다. 지금은 rate_counter 의 RLS 정책이 0개라 실패하지만, 나중에 이 함수에
--    security definer 를 붙이는 순간(profiles 가 세운 린터 규약이 그렇다) **임의 버킷을
--    부풀려 남의 rate limit 을 소진시키는 원시연산**이 된다. 미리 막는다.
revoke all on function public.check_rate(jsonb) from public;
grant execute on function public.check_rate(jsonb) to service_role;

-- 3) 즉시 1회 청소 — 지금까지 쌓인 만료 행을 비운다. 재실행해도 안전하다.
--    ⚠ 한 방에 지우지 않는다. 이 테이블이 얼마나 커져 있는지 모르는 채 첫 실행을 하는
--      상황이라, 통짜 DELETE 는 SQL Editor 에서 타임아웃 나거나 오래 잠글 수 있다.
--      배치로 끊어 지운다(다 지우면 스스로 멈춘다).
do $$
declare n integer;
begin
  loop
    delete from public.rate_counter
     where bucket in (
       select bucket from public.rate_counter
        where expires_at < now()
        order by expires_at
        limit 5000
     );
    get diagnostics n = row_count;
    exit when n = 0;
  end loop;
end
$$;

-- 4) (선택·권장) pg_cron 이 **이미 켜져 있으면** 매시 정각 청소도 함께 건다.
--    트래픽이 없으면 1)의 확률 청소가 돌지 않는다 — 남용 직후 조용해진 경우를 위한 보험이다.
--    확장이 없으면 조용히 건너뛴다(이 파일이 실패하지 않게). 켜려면:
--      대시보드 → Database → Extensions → pg_cron 활성화 → 이 파일 재실행.
--    cron.schedule 은 같은 이름이면 갱신하므로 재실행 안전하다.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('rate_counter_cleanup', '0 * * * *',
      $cron$ delete from public.rate_counter where expires_at < now() $cron$);
  end if;
end
$$;
