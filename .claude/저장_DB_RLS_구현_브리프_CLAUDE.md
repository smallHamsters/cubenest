# CubeNest — 저장(DB·RLS·클라우드 저장) 구현 브리프 · Claude Code

로그인(v1.7.0, `CubeNest.auth`)에 이어, **로그인 사용자의 데이터를 실제로 클라우드에 저장**한다. 이 문서 하나로 구현한다. 마스터 6장의 저장·인증 결정을 요약해 담았다.

## 목표
Supabase **Postgres 테이블 + RLS(Row Level Security)** 를 세우고, 이미 심긴 저장 CTA(quiz 결과 저장·`/my`·연습장/첨삭)를 **로컬 우선 → 로그인 시 클라우드 동기화**로 배선한다.

## ⚠ 먼저 — 이미 있는 것부터 확인 (핵심)
- 로그인은 이미 됨: **`window.CubeNest.auth`**(`isLoggedIn()`·`getUser()`·`getSession()`·`onAuthChange()`). **새 인증 만들지 말 것.**
- 저장 CTA·자리표시자가 이미 있다 → grep 후 배선: `결과 저장`·`save_result`·`SCRATCH.get`/`store[idx]`·`{child,tutor}`·`fromQuiz`·`buildWorksheetPayload`·`/my`.
- **`save/load` 얇은 인터페이스로 추상화**(마스터 6.4): 무로그인=localStorage, 로그인=Supabase. 한 곳에서 분기해 나머지 코드는 위치를 모르게.

## 핵심 제약 (반드시)
- **RLS가 실제 방어선.** 클라이언트 숨김은 UI일 뿐. **모든 사용자 테이블에 "본인 것만"(`auth.uid() = user_id`) 정책**을 건다. RLS 없이 테이블 열지 말 것.
- **anon key만 클라이언트**(공개 OK). **`service_role` key는 절대 클라이언트·리포 금지.**
- **스키마는 마이그레이션 파일로 리포에서 관리**(`supabase/migrations/`). 대시보드 수동 변경 금지(재현·추적 안 됨). 이미 `supabase/`(functions·migrations·config.toml)가 리포에 있음 — 그 구조에 맞춰 추가.
- **무료 quiz 플레이(익명)를 깨지 말 것.** 진도·결과는 무로그인도 localStorage로 계속 동작, **클라우드 저장만** 로그인 게이트.
- 성인(교사·학부모) 계정, **아동 PII 최소화** — 자녀 이름·학년 등은 담지 말거나 최소화.

## 만들 것

### 1. DB 스키마 (마이그레이션 파일 신설)
로그인 사용자당 저장. 최소 테이블(필요 시 조정):
- **`profiles`** — `id`(=auth.uid PK), `role`(parent/teacher), `created_at`. (아동 PII 없음.)
- **`quiz_results`** — `id`, `user_id`, `seed`, `type`, `level`, `score`, `n`, `answers`(jsonb), `created_at`. (quiz 결과 저장)
- **`saved_items`** (`/my`) — `id`, `user_id`, `kind`(worksheet/scratch/…), `title`, `payload`(jsonb: F2 shape·문항·연습장 2레이어 `{child,tutor}` 등), `created_at`. (worksheets가 담은 history·문제지·정답지·첨삭)
- **`entitlements`** (이용권, 뼈대만 — 결제는 후속) — `user_id`, `plan`, `expires_at`. 지금은 스키마만.

각 테이블에 **RLS enable + policy**: select/insert/update/delete 모두 `auth.uid() = user_id`. `profiles`는 `auth.uid() = id`.

### 2. 저장 인터페이스 `CubeNest.store` (또는 auth.js 확장)
- `saveResult(result)` · `listResults()` · `saveItem(item)` · `listItems()` · `deleteItem(id)`.
- 내부 분기: `isLoggedIn()` → Supabase(RLS 테이블) / 아니면 localStorage(기존 유지). **호출부는 위치를 모른다.**
- Supabase 접근은 로그인 세션의 JWT로(anon key 클라이언트 + RLS가 서버에서 판정).

### 3. CTA 배선 (새로 만들지 말고 연결)
- **quiz `결과 저장하기`**: 로그인 → `saveResult` 실제 저장 + 완료 피드백 / 비로그인 → 로그인 모달. `save_result_click{loggedIn}` 계측 실제화.
- **`/my` 페이지**: `listItems`·`listResults`로 저장 목록 표시(제목·날짜·다시 풀기/열기·삭제). 로그인 게이트.
- **worksheets 저장 / 연습장 2레이어(`{child,tutor}`)**: `saveItem`으로 `payload`에 담아 저장(첨삭 레이어 포함).
- (선택) **로컬→클라우드 승격**: 로그인 순간, 무로그인 때 쌓인 localStorage 진도·결과를 한 번 동기화(중복 방지).

## 범위 밖 (후속)
- **결제·이용권 실제 로직**은 하지 않음(테이블 뼈대만). 토스페이먼츠·이용권 판정은 다음 브리프.
- Edge Function은 현재 `verify_jwt=false`(무료·익명). 저장은 클라이언트 → Supabase 직접(RLS)으로 충분 — 굳이 서버 함수 경유 불필요.

## 리포 반영 (마이그레이션·설정)
- 마이그레이션: `supabase/migrations/<timestamp>_save_schema.sql`(테이블 + RLS). GitHub 연동돼 있으니 push로 배포되게.
- Supabase 대시보드에서 마이그레이션 적용 확인(또는 CLI). **service_role key는 서버·CI 시크릿에만, 리포/클라 금지.**
- ※ 대시보드·CLI 인증 같은 수동 단계는 사람이 — Claude Code는 SQL·클라 코드·적용 순서 안내.

## 검증 (수용 기준)
- 로그인 사용자가 quiz 결과·`/my` 항목을 저장 → **새로고침·다른 기기 로그인 후에도 조회**됨.
- **RLS 확인:** 다른 사용자의 `user_id` 행을 클라이언트에서 조회·수정 시도 → **거부**(정책 동작). anon 상태로 테이블 접근 시 빈 결과/거부.
- **무로그인 quiz 플레이·localStorage 진도가 그대로 동작**(회귀 없음).
- `service_role` key가 클라이언트·리포에 없음.
- 연습장 2레이어(`{child,tutor}`)가 payload로 저장·복원.

## 완료 후 (마스터 반영 메모)
- 저장 인터페이스/테이블이 확정되면 마스터 6.4(저장)·6.3(게이트)에 "구현" 반영, `/my` 사이트맵 상태 갱신 → 마스터 채팅에 알릴 것.
- 다음: 결제(entitlements 채우기)·토스페이먼츠 이용권.
