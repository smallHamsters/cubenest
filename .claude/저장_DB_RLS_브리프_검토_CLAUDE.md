# CubeNest — 저장(DB·RLS) 브리프 검토 의견 · 마스터 보고용

대상: `.claude/저장_DB_RLS_구현_브리프_CLAUDE.md` (초안)
작성 시점: 2026-08-16 / 기준 커밋: `237dad8` (`master(v1.7.0)` 로그인 도입)
성격: **구현 착수 전 검토.** 코드는 아직 손대지 않았다. 이 문서는 브리프를 v2로 고치기 위한 지시 목록이다.

---

## 요약

브리프 초안을 리포와 1:1 대조한 결과, **전제 3개가 실재하지 않고 지시 1개가 보안 구멍을 만든다.** 그대로 착수하면 존재하지 않는 코드를 grep하다 멈추거나, 사용자가 스스로에게 유료 이용권을 부여할 수 있는 테이블이 만들어진다. 추가로 스키마·동기화·실패 UX·개인정보 쪽에 빠진 결정이 9건 있다.

**착수 순서 권고:** 이 문서로 브리프를 v2로 개정 → 그 다음 구현.

### 이번 단계 스코프 (확정)

| 갈림길 | 결정 |
|---|---|
| 저장 목록 위치 | **`/my` 페이지 신설**(브리프 원문대로) |
| 연습장 필기 클라우드 저장 | **이번엔 제외 — 결과 메타만.** 컬럼은 `null`로 만들어만 둔다 |
| 마이그레이션 적용 | **대시보드 SQL Editor 붙여넣기 유지**(현행 방식) |

---

## A. 사실과 다른 전제 — 반드시 수정 (4건)

### A1. `/my`는 존재하지 않는다 → "grep 대상"이 아니라 "신설 대상"
브리프 10행이 `/my`를 "이미 심긴 저장 CTA"로 분류한다. 그러나 **`/my`로 향하는 링크는 리포 전체에 0건**이고, 언급은 `.claude/` 문서 2곳의 계획 문맥이 전부다. 나머지 grep 토큰(`결과 저장`·`save_result`·`SCRATCH.get`·`buildWorksheetPayload`)은 실재하므로 그대로 두고, `/my`만 "만들 것" 절로 옮긴다.

신설 시 손댈 파일을 브리프에 명시할 것:
- 신규 `my/index.html`
- `<nav>`가 하드코딩된 HTML **6개** — `index.html` / `guide/` / `quiz/` / `quiz/run/` / `worksheets/` / `account/` (페이지마다 상대경로가 다르다: `my/`, `../my/`, `../../my/`)
- `assets/css/nav.css` — 주석 "메뉴 5종" 정합
- `playground/`는 공용 헤더가 없는 전체화면 앱이라 **수정 불필요**
- `sitemap.xml`에는 **넣지 않는다** — `/account`처럼 로그인 전용이므로 noindex 일관성 유지

### A2. worksheets는 스텁이다 → 브리프 39행 "worksheets 저장"은 이번 범위에서 제외
`worksheets/index.html`은 "준비 중" 정적 70줄이 전부다. **`window.CubeNest.worksheets`도 `fromQuiz`도 리포에 존재하지 않는다.** `quiz/run/run.js:861`의 호출부는 항상 `else` 분기(alert)로 떨어진다. 없는 모듈에 저장을 배선할 수 없으므로 39행은 "후속"으로 이동한다.

### A3. 마이그레이션은 push로 배포되지 않는다 (브리프 47행)
기존 유일 마이그레이션 `supabase/migrations/supabase_rate_schema_260815.sql`은 Supabase 표준 timestamp 이름규칙이 아니고, **파일 헤더가 "대시보드 SQL Editor에 붙여넣기"를 1순위 적용법으로 안내한다.** `supabase db push` 파이프라인이 실제로 도는 상태가 아니다.

수정: 47행의 "GitHub 연동돼 있으니 push로 배포되게" → **"리포에는 기록용으로 커밋하고, 적용은 대시보드 SQL Editor 붙여넣기."** 새 파일명은 기존 관례를 따라 `supabase_save_schema_<YYMMDD>.sql`.

### A4. ⚠ `entitlements`에 사용자 insert/update 정책을 주면 안 된다 (브리프 29행) — 보안
29행은 "각 테이블에 select/insert/update/delete **모두** `auth.uid() = user_id`"라고 일괄 지시한다. 이걸 `entitlements`(이용권)에 적용하면 **로그인 사용자가 클라이언트에서 anon key로 자기 행을 직접 insert/update해 스스로에게 유료 플랜을 부여할 수 있다.** 이용권은 결제 시스템(서버)만 쓸 수 있어야 한다.

수정:
- **`entitlements`는 `select`만 사용자에게**(`auth.uid() = user_id`). **insert/update/delete 정책은 만들지 않는다** — 정책 없음 = 전면 차단, service_role만 우회. 리포의 `rate_counter`가 이미 쓰는 패턴이다
- **`profiles.role`(parent/teacher)은 self-assign 가능하므로 권한 판정에 쓰지 말 것** — 표시용 라벨일 뿐임을 명시
- insert/update 정책은 `using`이 아니라 **`with check`** 가 필요하다. 리포에 RLS 정책 전례가 하나도 없으므로, 브리프에 문법을 못박아 두지 않으면 첫 전례가 잘못 굳는다

---

## B. 빠져 있어 추가할 항목 (9건)

### B1. `profiles` 행을 누구도 만들지 않는다
테이블 정의만 있고 생성 시점이 없다. **`auth.users` insert 트리거로 자동 생성**(`security definer`)을 권고. 클라이언트 `upsert` 경로는 사용자가 앱을 안 열면 행이 영원히 안 생긴다.

### B2. 중복 방지 — `attempt_id` 멱등키 + append-only
"같은 퀴즈를 두 번 풀면 몇 행인가"가 브리프에 없다.
- `quiz_results.attempt_id uuid not null` + **`unique (user_id, attempt_id)`**
- `attempt_id`는 세션 시작 시 클라이언트가 `crypto.randomUUID()`로 발급해 진도 객체(`SKEY`)에 함께 보관. `replaySame()`(`run.js` ≈836행)은 **새 attempt_id 발급**(다시풀기 = 새 시도)
- 저장은 `upsert(onConflict:'user_id,attempt_id', ignoreDuplicates:true)`
- **같은 seed 재도전은 2행으로 남긴다(덮어쓰기 금지)** — 6/10 → 9/10 성장 기록이 보호자에게 보여줄 핵심 가치다. `(user_id, seed, type, n)` 유니크로 잡으면 그 가치가 사라지고 `replaySame()` 동작과도 어긋난다
- 멱등키가 없으면 "실패했나, 성공했는데 응답만 못 받았나"를 구분할 수 없어 재시도가 곧 중복이 된다

### B3. 동기화 모델 — 진도는 클라우드에 올리지 않는다
브리프는 "로컬 우선 → 로그인 시 클라우드 동기화"라고만 적어 충돌 규칙이 없다. **충돌 규칙을 만드는 대신 충돌 가능 상태를 없앤다.**
- `cubenest_quiz_sess_*`(진도)와 `_sc`(연습장)는 **100% 로컬 전용.** 클라우드엔 **완료된 결과만**, **`결과 저장하기`를 눌렀을 때만** 올라간다
- 잃는 것: 기기 간 이어풀기. 얻는 것: 병합 UI·타임스탬프 신뢰·두 탭 경합 문제가 전부 소멸. **문제 배열조차 저장하지 않고 seed로 재현하는 현재 설계가 이미 "진도 = 기기 로컬의 휘발성 상태"라고 말하고 있다**
- `/my`의 "다시 풀기" = 진도 복원이 아니라 **seed URL로 새 시도 시작**
- **브리프 40행 "로컬→클라우드 일괄 승격"은 삭제.** 승격할 이력이 실제로 없다 — 로컬엔 `cubenest_quiz_last`(마지막 1건)뿐이고 그마저 **읽는 코드가 없는 고아 키**다
- 유일한 예외 = **pending intent 재개**: 비로그인 저장 클릭 → 로그인 모달 → 성공 시 그 1건만 자동 실행(`AUTH.onAuthChange`에 플래그 1개)

### B4. 연습장 이미지 — 이번 제외 + 재개 조건 명시
현재 `run.js:461`이 문항마다 PNG dataURL 2장(`child`/`tutor`)을 만든다. 캔버스 1400×600(dpr2) 기준 **문항당 40~160KB → 10문항 저장 1건이 0.8~3.2MB.**

jsonb에 그대로 넣을 때의 파탄 지점:
- base64는 이미 압축된 PNG의 재인코딩이라 **Postgres 압축이 거의 안 먹는다**
- **jsonb는 부분 디토스트가 안 된다** — `payload->'meta'` 한 필드만 읽어도 전체를 디스크에서 읽는다. `/my` 목록 화면이 그대로 지옥이 된다
- 무료 DB 500MB ≈ **전체 300건**에서 소진. DB 스토리지는 파일 스토리지보다 단가가 훨씬 비싸고 WAL·백업까지 부풀린다
- PostgREST 응답은 **CDN 캐시가 없다** — `/my`를 세 번 열면 매번 전량 egress

브리프에 넣을 것:
- **이번 단계: `quiz_results.scratch jsonb null` 컬럼만 만들고 쓰지 않는다.** DB·RLS 첫 구축과 연습장 형식 변경을 한 커밋에 섞지 않는다
- **다음 커밋(독립): 획을 좌표 배열로 저장하는 벡터 전환.** 크기 1/30(건당 30~80KB). 부수적으로 지금의 **무통지 유실**(`run.js:320`의 빈 catch가 QuotaExceededError를 삼킴)·리사이즈 뭉개짐·undo 스냅샷 RAM(최대 ~34MB)이 함께 해소된다. `initScratch()` 30~40줄 교체 수준이고 `SCRATCH.get/all/load` 시그니처는 유지 — **`fromQuiz`가 없어 소비자가 0명인 지금이 형식을 바꿀 마지막이자 가장 싼 시점**
- **Storage 버킷은 지금 만들지 않는다.** 착수 트리거를 명시: (a) 진짜 래스터(사진 업로드) 등장 (b) 저장 1건 중앙값 300KB 초과 (c) DB 사용량이 무료 한도 50% 초과
- **폴백: 벡터 전환이 늦어지면 연습장은 클라우드에 올리지 않는다.** PNG를 임시로라도 올리면 그 데이터가 마이그레이션 부채로 남는다 — 임시 조치가 가장 비싸다

### B5. 스키마 방어선 (RLS 전례가 리포에 없으므로 여기서 못박기)
- **목록에 필요한 필드는 payload 밖 실컬럼으로 승격**: `title`, `kind`, `seed`, `type`, `n`, `score`, `created_at`
- **`select *` 금지, 컬럼 명시 필수**(`.select('id,kind,title,score,created_at')`) — 안 지키면 위 승격이 무의미해진다. 코드 리뷰 체크 항목으로
- **`check (octet_length(payload::text) < 262144)`** — CHECK는 TOAST 이전 원문 바이트로 평가되어 정확한 "예산"이 된다. 클라 버그가 DB를 망가뜨리지 못하게 하는 최후 방어선
- **payload에 인덱스 금지**(검색 요구 없음). 인덱스는 `<table>_user_id_created_at_idx`만
- 정책 컨벤션: 테이블당 4정책, **`to authenticated` 명시**, `auth.uid()`는 **`(select auth.uid())`로 감싸기**(행마다 재평가 대신 initplan 캐싱 — Supabase 권장), `user_id uuid not null references auth.users(id) on delete cascade default auth.uid()`
- SQL 스타일은 기존 마이그레이션을 따른다: 전부 소문자 키워드, `if not exists`, `public.` 접두, 한국어 주석 밀도, 섹션 번호(`-- 1)`)

### B6. 저장 실패를 눈에 보이게 (조용한 실패 금지)
브리프에 실패 UX가 없다. **이 프로젝트는 이미 조용한 실패에 한 번 물렸다**(`run.js:320`의 빈 catch → 연습장 무통지 유실). 같은 실패 모드를 클라우드에서 반복하지 않는다.
- 버튼 3상태: `결과 저장하기` → `저장 중…` → `저장됨 ✓` / `저장 실패 — 다시 시도`
- 자동 재시도는 **즉시 1회만**, 타임아웃 10초(AbortController). 지수 백오프 루프 금지
- 실패 문구에 안전망 명시: **"저장하지 못했어요. 이 기기에는 그대로 남아 있어요."** (사실이다 — 로컬 저장이 선행된다)

### B7. 로그아웃·삭제·시각 규칙
- **로그아웃 시 로컬 데이터를 지우지 않는다**(기본, 추가 동작 없음). 진도·연습장은 아이 작업물이고 익명 플레이에서도 남는 게 정상이다. 로그아웃이 "내 작업이 사라지는 함정"이 되면 안 된다
- 공용 기기 대응은 삭제 강제가 아니라 선택지로: 로그아웃 확인에 **`이 기기에서 학습 기록도 지우기`(기본 꺼짐)** 체크박스. 대상은 `cubenest_quiz_*` 접두 키만(동의·음소거 같은 UI 설정은 유지)
- **삭제는 하드 delete.** soft delete·휴지통 금지
- **시각은 서버 `created_at default now()`만.** 클라이언트 타임스탬프 컬럼 금지
- **localStorage 키를 uid로 네임스페이싱하지 말 것** — 기존 사용자 진도가 전부 유실된다
- **`/my`는 로그인 시 클라우드만 조회.** 로컬 항목과 병합 표시하지 않는다(단일 진실 소스)

### B8. 계정·데이터 삭제와 개인정보 — 이번 단계에서 처음 사용자 데이터를 보관하게 된다
브리프에 전혀 없다. 최소한:
- `on delete cascade`로 `auth.users` 삭제 시 전 데이터 소멸(B5에 포함)
- `/account`에 **회원 탈퇴 = 데이터 삭제** 경로를 어떻게 제공할지 결정(초기엔 대시보드 수동 처리도 가능하나 문서에 명시)
- **개인정보처리방침 갱신 필요** — 지금까지는 "저장 안 함"이었는데 보관이 시작된다. 수집 항목(이메일·이름·아바타 URL·학습 결과)·보관 기간·삭제 방법을 적을 것

### B9. "하지 말 것" 절 신설
브리프에 금지 목록이 없어 과설계가 새어들 여지가 크다. 명시할 것:

1. 진도 클라우드 동기화 / 기기 간 이어풀기
2. 로컬↔클라우드 병합 UI("어느 쪽을 쓸까요?" 다이얼로그)
3. 백그라운드 동기 큐·Service Worker·outbox
4. soft delete·버전 관리·CRDT
5. 로그인만 하면 조용히 올라가는 자동 업로드
6. Storage 버킷·서명 URL·고아 GC (B4 트리거 발생 전까지)
7. payload jsonb에 인덱스
8. 저장 경로를 Edge Function 경유로 바꾸기 / `verify_jwt=true` 전환 — RLS로 충분하고 익명 무료 플레이만 깨진다
9. `profiles`에 아동 이름·학년 컬럼
10. localStorage 키 uid 네임스페이싱

---

## C. 검증 절차 보강 (브리프 51~57행)

수용 기준이 방향만 있고 실행 방법이 없다. 다음을 추가:

1. **선행 확인 — 프로덕션 로그인.** 로그인은 **로컬(`localhost:5500`)에서만 검증됐다.** 배포 오리진의 Supabase Redirect URLs가 실제로 동작하는지 먼저 확인하지 않으면 저장 기능 전체가 배포 환경에서 죽은 채로 완성된다
2. **RLS 교차 검증에 두 번째 계정을 쓴다.** B 계정으로 로그인해 A의 `user_id` 행을 `select`/`update`/`delete` 시도 → 전부 빈 결과 또는 거부
3. **anon 접근**: 로그아웃 후 같은 쿼리 → 빈 결과
4. **`entitlements` 승격 시도**: 로그인 상태에서 자기 `entitlements` 행 insert/update 시도 → **거부**되어야 한다 (A4 검증)
5. **회귀**: 무로그인 퀴즈 플레이·localStorage 진도·playground 타임게이트 정상
6. **저장 실패 경로**: DevTools 오프라인으로 저장 클릭 → 실패가 눈에 보이고 로컬 데이터는 유지

---

## D. 문서 갱신 (브리프 58~60행 보강) — 마스터 확인 필요

브리프는 "마스터 채팅에 알릴 것"만 적혀 있는데, **리포의 자립 명세인 루트 `CLAUDE.md`가 이미 현행과 어긋난다.**

- "login-free-first … DB 불필요", "DB는 결제·계정 필요 시점에" — v1.7.0에서 이미 OAuth가 붙었다
- 사이트맵에 `/account`가 없다(`/my`도 물론 없다)
- 공유 기반 요소(F1~F5) 목록에 `auth.js`가 없다
- 코드 주석은 마스터 `§5.1`·`§6`·`§6.3`·`§8.1`을 참조하는데 **리포 `CLAUDE.md`에는 § 번호 체계 자체가 없다** — 참조 대상이 리포에 부재

→ 개정 브리프 말미에 **루트 `CLAUDE.md` 갱신**(사이트맵에 `/account`·`/my`, 데이터·인증 절, 공유 요소에 `auth.js`·`store`)을 완료 조건으로 넣는다. § 번호 체계를 리포에 들일지는 마스터 판단 사항.

---

## 개정 후 브리프의 구현 순서 (의존성 기준)

1. **마이그레이션 1개** — `profiles`(+생성 트리거) / `quiz_results`(`attempt_id` unique, `scratch jsonb null`, payload CHECK) / `saved_items` / `entitlements`(select 전용). RLS enable + 정책
2. **`CubeNest.store` 얇은 인터페이스** — `auth.ready` 대기 후 `auth.client` 사용. 로그인/비로그인 분기를 이 한 곳에만
3. **`saveResult()` 배선** — attempt_id 발급·보존, 멱등 upsert, 버튼 3상태, pending intent 재개
4. **`/my` 신설** — nav 6개 파일 + 목록·삭제(컬럼 명시 select, 하드 delete)
5. **검증** (위 C)
6. **(독립 커밋) `run.js` 벡터 전환** → 검증 후 `quiz_results.scratch` 연결

---

## 참고 — 검토 중 확인한 리포 현황

| 항목 | 상태 |
|---|---|
| `window.CubeNest.auth` | 완료(`237dad8`). `isLoggedIn`·`getUser`·`getSession`·`getAccessToken`·`onAuthChange`·`client`·`ready`·`settled` 노출. 구글 로그인 실사용 검증 통과, 카카오는 콘솔 대기 |
| `supabase/migrations/` | 파일 1개(rate limit 전용). **RLS `create policy` 전례 0건** — 유일한 RLS 사용은 "정책 0개 = 전면 차단" |
| `saveResult()` | `run.js:865` 완전한 자리표시자(alert만, 네트워크 호출 없음) |
| `/my` | 없음. 링크 0건 |
| `worksheets/` | "준비 중" 정적 70줄. `fromQuiz` 없음 |
| 연습장 데이터 | PNG dataURL 2레이어가 **이미 localStorage에 저장 중**(`_sc` 키). 초과 시 무통지 유실 |
| `api-client.js` | `Authorization` 헤더 없음(익명). CORS 허용목록엔 이미 `Authorization`이 있어 헤더만 추가하면 됨 |
| service_role key | 리포·클라이언트 어디에도 없음(Edge 런타임 자동 주입만). anon key만 `auth.js`에 의도적 하드코딩 |
