# CubeNest — 로그인(인증) 구현 브리프 · Claude Code

이 문서 하나로 로그인 기능을 구현한다. 마스터 6장의 인증 결정을 요약해 담았다.

## 목표
Supabase **OAuth 로그인**을 붙이고, **이미 코드 곳곳에 심겨 있는 로그인 CTA·가짜(mock) 로그인을 실제 세션에 배선**한다. (새 로그인 UI를 병렬로 만들지 말 것.)

## ⚠ 가장 먼저 — 이미 심긴 것부터 찾아라 (핵심)
지금 리포에는 **mock 로그인과 로그인 CTA가 여러 곳에 이미** 들어가 있다. 착수 전에 **리포 전체를 grep**해서 배선 지점 목록부터 만든다:
`cubenest_mock_login` · `isLoggedIn` · `save_result` · `결과 저장` · `첨삭` · `타임게이트`/`timegate` · 로그인 배너/버튼.

배선 대상(새로 만들지 말고 실제 세션에 연결):
- **`cubenest_mock_login`** (localStorage 키): quiz·worksheets 공용 가짜 로그인. **`isLoggedIn()`이 이 키를 본다 → Supabase 세션 체크로 교체.**
- **quiz `결과 저장하기` 버튼**(`quiz/run`): 현재 "안내만". → 로그인 상태에 반응하도록. GA 이벤트 `save_result_click{loggedIn}` 파라미터도 실제 상태로.
- **quiz 연습장 첨삭 모드**: `cubenest_mock_login`으로 게이트 중 → 실제 세션으로.
- **playground calc 30분 타임게이트**: 30분 후 calc 잠금 + 부드러운 **로그인 유도 배너** → 로그인 시 즉시 해제.
- **worksheets**: 저장·첨삭·PDF 로그인 게이트 → 실제 세션.

**원칙: `isLoggedIn()`을 단일 진실 소스로 통일**하고, 위 CTA들은 전부 그 하나를 바라보게 한다.

## 핵심 제약 (반드시 지킬 것)
- **OAuth 전용**(비밀번호 없음). 제공자: **Kakao(1순위)** · Google · Apple.
- 정적 사이트(GitHub Pages), **하위경로 `/cubenest/`** 서빙 → **리다이렉트 URL이 최대 함정**(아래 별도 절).
- **anon key만 클라이언트에 둔다(공개 OK). `service_role` key는 절대 클라이언트·리포에 넣지 말 것**(서버 전용).
- **성인(교사·학부모) 중심 계정, 학생 무로그인, 아동 PII 최소화.**
- **멀티 페이지(SPA 아님):** home·`/playground`·`/quiz`·`/quiz/run`·`/account`·`/my`가 각각 별도 HTML. Supabase JS가 세션을 localStorage에 지속하므로 **같은 오리진에서 페이지 이동해도 세션 유지** — 단 **각 페이지에서 auth 모듈을 로드**해야 한다.

## 로그인 게이트 매핑 (무엇이 로그인 필요한가)
- **무로그인(공개):** home · guide · playground(편집·관찰) · **quiz 랜딩(`/quiz`)·플레이(`/quiz/run`)** · calc(첫 상호작용 후 **30분 무료** → 이후 타임게이트).
- **로그인 필요:** playground **calc 30분 이후** · **quiz 결과 저장(클라우드)** · worksheets · `/account` · `/my`.
- 소프트 게이트(UI 숨김·우회 가능)는 **가입 유도용**, 실제 방어선은 **RLS**(다음 단계).

## 만들 것
1. **공용 auth 모듈** `assets/js/auth.js` → 전역 `window.CubeNest.auth`:
   - `signInWithKakao()` · `signInWithGoogle()` · `signInWithApple()` (OAuth 리다이렉트)
   - `signOut()` · `getUser()` · `getSession()` · **`isLoggedIn()`**
   - **`onAuthChange(cb)`** — 로그인 상태 변화 구독(로그인/로그아웃 시 CTA·헤더·게이트 UI 자동 갱신)
   - Supabase JS 클라이언트 init(공개 프로젝트 URL + **anon key**). 로드 순서: 각 페이지에서 `supabase-js` → `auth.js` → 페이지 스크립트.
2. **`isLoggedIn()` 단일화** — 기존 mock 판정을 전부 이 모듈로 교체(quiz·worksheets·playground 공통).
3. **로그인 진입 UI** — `/account`(로그인·회원·설정) 페이지 **또는** 공용 로그인 모달. 최소 요건: 제공자 버튼('카카오로 시작하기' 등) · 로그아웃 · 로그인 상태 표시. 기존 CTA(결과 저장·타임게이트 배너·첨삭)를 이 진입점으로 연결.
4. **리다이렉트 처리** — OAuth 콜백이 `/cubenest/` 하위 올바른 경로로 복귀. `redirectTo`를 현재/지정 복귀 URL로.

## 리다이렉트 URL — 하위경로 함정 (여기서 대부분 막힌다)
- **Supabase 대시보드 › Auth › URL Configuration**: **Site URL**과 **Redirect URLs**에 `https://smallhamsters.github.io/cubenest/`(및 필요한 하위경로, 로컬 개발 URL 예: `http://localhost:8000/…`)를 등록.
- **각 OAuth 제공자 콘솔(카카오·구글)의 콜백/Redirect URI**에는 **Supabase 콜백**(`https://<project-ref>.supabase.co/auth/v1/callback`)을 등록한다. 흐름은 *제공자 → Supabase → 우리 사이트* 이므로, **우리 사이트 URL을 제공자에 직접 넣는 게 아니다** — 가장 흔한 실수.
- 코드에서는 `supabase.auth.signInWithOAuth({ provider:'kakao', options:{ redirectTo: <복귀 URL> } })`.
- ※ **제공자 콘솔·Supabase 대시보드 설정은 사람이 하는 수동 단계**(코드로 안 됨). Claude Code는 필요한 값·순서를 안내하고 코드만 작성한다.

## 범위 — 이번엔 '인증 세션 + CTA 배선'까지
- **클라우드 저장(quiz 결과·worksheets·`/my` 콘텐츠)은 DB + RLS가 필요 → 다음 단계.** 이번엔 로그인 세션 확립 + `isLoggedIn()` 단일화 + CTA 배선. 저장 버튼은 "로그인됨 → (저장 API 준비되면 저장) / 비로그인 → 로그인 유도"까지만.
- **Edge Functions는 현재 `verify_jwt=false`(익명 무료 플레이). 무료 익명 플레이를 깨지 말 것.** 로그인 사용자는 요청에 JWT를 실을 수 있게 준비만 해 둔다(저장·유료용, 후속).

## 검증(수용 기준)
- 카카오·구글 로그인 왕복이 **하위경로 콜백으로 정상 복귀**. 새로고침·페이지 이동 후 세션 유지.
- `isLoggedIn()`이 전 페이지에서 일관되고, **기존 CTA(결과 저장·calc 타임게이트·첨삭·worksheets)가 실제 로그인 상태에 반응**.
- 로그아웃 동작. **mock(`cubenest_mock_login`) 잔재 제거.**
- **`service_role` key가 클라이언트·리포 어디에도 없음. anon key만.**
- 무료 quiz 플레이(익명)가 그대로 동작.

## 완료 후 (마스터 반영용 메모)
- 새 공용 모듈 `assets/js/auth.js`가 생기면 마스터 §5.1·§9·§2.1(트리)에 등재 필요 → 마스터 채팅에 알릴 것.
- 다음 단계: DB 스키마 + RLS(`quiz_progress`·`saved_worksheets`·`my_items`·`entitlements`), 저장 API, `/my` 실제 저장.
