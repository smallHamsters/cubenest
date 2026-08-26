# CLAUDE.md — CubeNest (단일 자립 명세)

이 파일 하나가 유일한 참조 문서다. 다른 .md 없이 이것만 보고 작업한다. (현행 구현의 세부는 코드가 기준.)
※ 상세 기획·불변 원리의 정본은 마스터 문서 `CubeNest_00_마스터_공통`(별도 관리). 코드 주석의 `§` 표기는 그 마스터의 장 번호를 가리킨다.

## 개요
- **CubeNest(큐브네스트):** '쌓기나무(공간과 입체)' 3D 학습 웹 도구 — 3D 회전, 위·앞·옆 투상, 개수·부피·겉넓이 자동 계산, 블록 추가·삭제.
- **대상: 만 5~11세**(한국 교육과정 기준, **기본 스테이지 = 초6** '공간과 입체'). 난이도는 **연령 스테이지가 유형·밴드를 먼저 정하고** 하/중/상/최상은 그 안의 상대 난이도다 — 출시 **S0~S4**(유아 · 초1~2 · 초3~4 · 초5 · **초6**(기본)), **S5(중1~2) 비노출**(설계는 코드에 보존). **S0·S1은 `count`·`facesMc` 2종만** 열고 `facesMc`는 묻는 방향 제한(S0=위 / S1=위·앞). 정본 = `.claude/quiz/cubenest_난이도_재설계_260818_v0_1.md` §7·§10.
- 해외(미국·싱가포르·태국) 진출은 **후순위**. 조사 결과는 `.claude/quiz/cubenest_연령별_국제_난이도설계_260819_v0_1.md`에 보관(보류).
- 태블릿·휴대폰 우선. 무료 런칭(트래픽·피드백) 단계. 개인사업자·정적 호스팅.
- 사이트맵: `/`(landing) · `/playground`(3D 도구) · `/quiz`(퀴즈 랜딩) · `/quiz/run`(퀴즈 플레이) · `/worksheets`(PDF, 스텁) · `/guide`(가이드) · `/account`(계정 허브: 로그인·닉네임·이용권·결제·CS, 성인 중심) · `/my`(내 자료: 퀴즈 기록·문제지·모양, 로컬 우선).

## 불변 규칙 (전 페이지 공유·재정의 금지)
- 데이터 모델: 3D 격자 `(x,y,z)` 채움/비움. 축: **앞=+z, 옆(오른쪽)=+x, 위=+y.**
- **중력:** 뜬 나무 비허용. 추가 시 뜨는 자리 차단, 받침 나무 삭제 차단.
- 격자: 기본 3³, 축별 독립, **최대 10.** 밖으로 나가는 축소 차단.
- **투영: 전체 직교.** 편집은 **자유 3D 보기에서만**, 위·앞·옆은 관찰 전용(카메라 이동만).

## 모양 수학 (계산·문제의 단일 기준)
- **직렬화(F2):** 채운 칸·격자·모서리 → URL-safe base64 `?m=`. **모양만 담고 문제 메타 금지.**
- **값(정확식):** 부피 = 개수×모서리³ / 노출면 = **6×개수 − 2×맞닿은 면 쌍**(항상 정확) = `2×(위+앞+옆)`(방향별 **드러난 면 수**) / 겉넓이 = 노출면×모서리²(**바닥 포함**).
  - count−pairs식은 **겉넓이 해설의 '다른 해설(대안)'로 항상 허용**(주 표기는 `2×(위+앞+옆)`, 아이 친화 문구).
- **투상 2종:** 높이 지도(개수 유일) / 세 방향 실루엣(투영 그림자 → 최소·최대 발생).
- **역방향(중력 준수):** 최대 `h=min(앞,옆)`, 최소 = 정확 계산·값 유일, **은면(안 보이는 나무) = 최대−최소**(자유 칸). ※ quiz의 '가림' 관점과 항상 일치하진 않음 — 문제별 관점 명시.
- **오목(노치):** `노출면 > 2×(위+앞+옆 실루엣)`이면 오목(겉넓이 난이도 축). L자는 '오목 없음'.
- **출제 범위:** 연결된(구멍 없는) 모양만. 유형·난이도 상세 = 분류 체계(`cubenest_remap`) 소관.
- **문제 스키마(F5):** `{shape, givens, ask, answer, reveal}` — quiz·worksheet 공유.
- **공유 요소(재사용, 재발명 금지):** F1 `track()` · F2 직렬화 · F3 이미지 캡처 · F4 정답 노출 · F5 문제 스키마.

## 공용 모듈 (assets/js/ — import, 재-인라인 금지)
전역 `window.CubeNest`. viewer는 core에 의존 → **core 먼저 로드.** 변경은 단일 지점 + 전 모듈 재테스트.
- `cubenest-core.js` — 계산 코어(§4 실행형). `cubenest-viewer.js` — 3D 뷰어·펼쳐보기.
- `cubenest-iso.js` — 겨냥도 SVG 렌더러. **서버 복본(`_shared/`)이 은닉 유형 제시물을 그린다** — 그리는 순서(뒤→앞)가 곧 가림이라 정렬을 바꾸면 숨은 나무가 드러난다.
- `auth.js` — **공용 인증(`CubeNest.auth`·`isLoggedIn` 단일 진실)**. `mydata.js` — **공용 데이터 계층(로컬 우선, `/my` 오너·account 소비)**. **저장소 키는 계정별로 나뉜다**(`cubenest_my_v1__<uid>`) — 공용 기기에서 계정을 바꿔도 앞 사람 자료가 안 보인다. 이 기기의 비로그인 자료는 **처음 로그인한 계정 하나만** 승계하고(`cubenest_my_adopted`) 원본은 남긴다. **`CubeNest.auth` 를 참조하는 유일한 모듈**이다. `consent.js` — GA4·동의.
- **생성기 `gen`·설정 `gen-config`는 서버 전용**(Edge Function, 클라 미배포 — 아래 보안).
- **클라↔서버 복본 규약(마스터 §5.2):** 같은 모듈이 `assets/js/`와 `_shared/`에 두 벌이면 **정본은 클라**, 복본은 **원문 그대로 + ESM export 꼬리 2줄**만 다르다. 커밋 전 `diff -u assets/js/X.js supabase/functions/_shared/X.js` → **export 블록 외 차이가 나오면 드리프트**. **클라가 `<script src>`로 로드하지 않는 모듈은 복본 금지(서버 단일본)** — 죽은 사본은 증상 없이 갈라진다(`minmax`·`manip`이 실제로 갈라져 260821 클라 사본 삭제 = 서버 단일본). 서버 전용 신규 계산 모듈은 처음부터 `_shared/`에만(`cubenest-hidden.js`). **현재 두 벌인 모듈 = `core`·`iso` 둘뿐**(둘 다 diff 일치 확인).

## 인증 · 저장 · 게이트
- **로그인: Supabase OAuth 전용**(카카오·구글, 검증 완료). 비밀번호 없음·PKCE·세션 지속. 성인(교사·학부모) 중심, **학생 무로그인**, 아동 PII 최소화.
- **`CubeNest.auth`가 로그인 단일 진실.** 새 인증·mock 만들지 말 것.
  - **죽은 세션 자동 정리:** 계정이 서버에서 삭제·차단돼도 access token 만료 전까지 로컬 세션이 남아 `isLoggedIn()`이 계속 `true`다(260827 실제 발생 — 화면은 로그인된 듯 그려지는데 서버 호출만 조용히 실패). 세션 복원 직후 `getUser()`로 한 번 확인하고 죽었으면 로그아웃한다.
  - ⚠ **네트워크 실패로는 절대 로그아웃하지 않는다.** 오프라인이면 `AuthRetryableFetchError`(`status:0`)가 오고, 서버가 **401/403**으로 명시적으로 부정할 때만 정리한다. 여길 느슨하게 고치면 오프라인에서 세션이 날아가 '로컬 우선' 설계가 무너진다.
  - 검증은 **`ready`를 막지 않는다**(백그라운드) — 첫 페인트를 네트워크 왕복만큼 늦추면 잠금 깜빡임 방지가 깨진다.
- **게이트:** 무로그인 = home·guide·playground(편집·관찰)·quiz(랜딩·플레이). 로그인 = calc 30분 이후·quiz 결과 저장·worksheets·`/account`·`/my`.
  - calc: 첫 상호작용 후 **30분 무료** → 이후 잠금·로그인 유도(치팅 방지+가입 유도). 세션 복원 전엔 잠그지 않음.
- **저장:** 로컬 우선(`mydata.js`) + **서버 미러**. 백엔드를 통째로 갈아끼우지 않는다 — `getNickname()` 처럼 **동기 반환**을 `/my`·`/account` 가 동기로 소비하므로, 서버는 읽어서 **로컬 캐시를 채우는** 방향으로만 붙인다(시그니처 바꾸지 말 것). **RLS가 실제 방어선**("본인 것만"). 진도·연습장은 로컬 전용, **완료 결과만** 저장. `entitlements`는 사용자 select만(쓰기=결제 서버). `/account`=계정 허브·`/my`=내 자료.
  - **구현됨 = `profiles`·`quiz_results`·`my_items`**(260827). 닉네임·**퀴즈 완료 결과**·**문제지**가 계정에 귀속돼 기기를 넘어 따라온다. `entitlements`만 남았다.
  - **`my_items` vs `quiz_results` — 멱등키도 수명도 다르다.** 결과는 **누적**(`attempt_id`, `ignoreDuplicates`)이고, 산출물은 같은 URL이면 **덮어쓰기**(`item_id`, upsert). 그래서 한 테이블에 합치지 않는다. `my_items.kind` CHECK가 `'quiz'`를 막아 섞이는 것을 DB에서 차단한다.
  - **퀴즈 결과는 완료 즉시 자동 미러**한다(로그인 상태일 때). 버튼을 눌러야만 올리는 방식이 아니다 — append-only + `attempt_id` 멱등이라 충돌이 원천적으로 없기 때문이다. `attempt_id`는 **`run.js`가 세션 시작 때 발급**해 진도와 함께 보관한다: 이어풀기는 같은 시도, **'다시 풀기'는 새 시도**(누적). 이 id 가 `/my` 항목 id(`quiz_<attemptId>`)이기도 해서, 같은 퀴즈를 여러 번 끝내도 사본이 안 쌓인다.
  - `mydata.syncQuiz()`·`syncItems()`가 **양방향**이다: pull(다른 기기 기록) + push(이 기기·비로그인 시절 기록). 로그인 직후 한 번 돌면 승계가 끝나므로 **pending intent 를 따로 두지 않는다**.
  - ⚠ **개별 `sync*` 를 직접 부르지 말고 `mydata.sync()` 를 쓴다.** 둘 다 `readStore → 수정 → writeStore` 라 동시에 띄우면 뒤 쓰기가 앞 쓰기를 통째로 덮는다(같은 localStorage 키 경쟁). `sync()` 가 순차 실행 + 중복 호출 합치기를 한다.
  - **서버에서 내려온 것은 첫 페인트보다 늦게 온다.** `/my` 는 `sync()` 뒤에 목록 서명(닉네임+id 목록)이 바뀌었을 때만 다시 그린다 — 안 하면 다른 기기 자료가 새로고침해야 보이고, 무조건 재렌더하면 목록이 깜빡인다.
  - **문제지 항목 id 는 `mydata.urlId(prefix, url)` 이 단일 출처다.** URL 에서 결정적으로 뽑으므로 다시 열어도 사본이 안 쌓이고, 그 id 가 곧 서버 멱등키(`my_items.item_id`)다. **적립하는 쪽(`worksheets`·`quiz/run`)이 각자 해시를 만들면 같은 문제지가 두 항목이 된다** — 실제로 그랬다(quiz 쪽은 id 를 아예 안 넘겨 누를 때마다 쌓였다, 260827 수정). 해시(djb2)를 바꾸면 저장된 항목 id 가 전부 달라지니 건드리지 말 것.
  - **RLS 전례(`supabase_profiles_schema_260826.sql` → `supabase_quizresults_schema_260827.sql`)를 이후 테이블이 복사한다:** 소유자 컬럼은 언제나 `user_id`, 정책마다 `to authenticated` 명시, `auth.uid()` 는 **`(select auth.uid())`** 로 감싸고(initplan 캐싱), insert/update 에 `with check` 필수. **`profiles` 만 delete 정책을 주지 않는다** — 행 삭제 = 계정 메타 유실인데 되살릴 트리거가 없고, 탈퇴는 FK cascade 가 처리한다. **`quiz_results`·`my_items`는 4정책 전부 준다**(`/my`의 '삭제'가 실제 기능이고, 지워도 되살릴 필요가 없다).

## 보안 · 지적재산 (정적 웹은 클라 코드 은닉 불가 → 서버화 + 법적 보호)
- **핵심 자산은 서버(Edge Function):** `gen`·`gen-config`(전체 문제 공간·정답 규칙)는 클라에서 삭제됨. 클라는 `api-client.js`로 `/generate`·`/grade` 호출. **`/grade`는 gsig(HMAC)로 위·변조 방지**, rate limit(익명 쿠키+IP). 무료 익명 플레이라 `verify_jwt=false`.
- **anon key만 클라이언트**(공개 OK). **`service_role` key는 절대 클라·리포 금지**(서버 전용).
- 클라 유지(보호 가치 낮음): core·viewer·auth·consent·iso(겨냥도 렌더).
- **정답 은닉:** `/generate` 응답에 **정답을 담지 않는다**(예전엔 facesMc 정답 번호·minmax rc·A-f kinds가 그대로 나갔다). 채점·색칠·해설의 단일 출처는 **`/grade` 응답의 `answerKey`·`explain`**. 로컬 폴백 채점 없음 → 실패 시 재시도(어차피 `/generate` 없이는 시작도 못 한다).
  - **minmax·hidden**은 모양(`sh`) 대신 **제시물만** 보낸다. 겨냥도가 제시물인 A-a/b/f는 서버가 `cubenest-iso`로 SVG를 그려 내려보낸다.
  - **[한계] 3D 모드에 한해 5종(count·volume·surface·heightmap·facesMc)은 은닉 불가** — 돌려서 가려진 나무를 확인하는 것이 풀이 과정이라 형상이 클라에 있어야 한다. 의도된 수용.
    - **2D 모드는 은닉이 성립한다.** `dim` 은 **제시물의 형태**를 정하는 요청 파라미터다(클라 → `/generate`, 서버가 `resolveDim` 으로 확정). 2D 면 서버가 겨냥도 SVG 를 그려 보내고 **형상을 보내지 않는다** — 돌릴 일이 없으니 위 수용 사유가 성립하지 않는다.
    - `q.dim` 은 **`'3d'|'2d'` 두 값뿐**(`'any'` 는 서버 안에서 소멸). hidden·minmax·manip·facesDraw 는 스테이지와 무관하게 항상 `'2d'` 다 — 제시물이 이미 서버가 그린 2D 이므로.
    - `dim` 은 **표현 전용**이다. `buildProbs`·`paramsHash` 에 넣지 말 것 — 넣으면 각각 조용한 오채점 / 진행 중 세션 403 이 난다.
  - A-a/b/f의 답은 **보이는 그림만의 함수**다(숨은 열의 실제 높이는 어느 답에도 안 쓰임). 그래서 그림을 주는 것으로 은닉이 성립한다 — 치터도 학생과 똑같이 그림을 분석해야 한다.
- 법적: 저작권 표시·독점 라이선스·이용약관·저작권 등록·**CubeNest 상표 출원**(변리사 확인).

## 기술 · 규약
- **단일 HTML/페이지 + Three.js, 빌드 없음, 정적 호스팅**(GitHub Pages, `/cubenest/` 하위경로). 백엔드 = **Supabase**(Auth·Postgres+RLS·Edge Functions). 로컬 확인: `py -m http.server 5500` (**5500 고정** — Edge Function CORS 허용 오리진. 기본 8000이면 `/generate`·`/grade`가 막힌다. **`python`이 아니라 `py`** — 개발 머신의 `python`은 WindowsApps 스텁이라 exit 9009로 죽는다).
- **배포 = `<모듈>/index.html`**(랜딩=루트). 공용 자산 `assets/{css,img,js}`. 상대경로(하위 `../`, 2층 `../../`). 서버 = `supabase/`(functions·migrations·config).
- 렌더링: 직교 카메라, 큐브 InstancedMesh 2그룹.
- 언어 한국어(브랜드: ko→큐브네스트 / else CubeNest). 모바일 가로 우선(44px+, hover 미사용). 계측 `track()`→GA4, 동의 후만.
- **DB 스키마는 마이그레이션 파일(`supabase/migrations/`)로 관리**, 적용은 대시보드 SQL Editor. 저장을 Edge 경유로 바꾸지 말 것(RLS로 충분).
  - **스키마는 아래 배포 순서의 예외 — 서버(DB)가 먼저다.** 클라를 먼저 내보내면 없는 테이블을 조회해 미러가 전부 조용히 실패한다("오류가 아니라 동기화가 안 되는 것처럼"). Edge Function 은 반대(클라 먼저)다.
  - 파일명은 기존 전례(`supabase_<주제>_schema_<YYMMDD>.sql`)를 따른다. CLI 타임스탬프 형식(`20260826…`)을 섞으면 `supabase db push` 가 기존 파일을 미적용으로 보고 순서가 꼬인다. 전체를 `if not exists`/`or replace`/`drop … if exists` 로 써 **재실행 안전**하게 한다.
- **`verify_jwt`(`supabase/config.toml`)는 함수별로 다르다 — 일괄 규칙이 아니다.** `generate`·`grade`·`config`만 **`false`**(무료 익명 플레이·UI 메타. `true`로 바꾸면 무로그인 플레이가 깨진다). **`worksheet`는 이미 `true`이고 그게 맞다** — 정답이 함께 내려가는 유일한 경로라 게이트웨이가 JWT를 검증하고, `api-client.worksheet`가 `CubeNest.auth` 토큰을 붙여 호출한다. **여기를 `false`로 "정정"하지 말 것.** 함수 안 `requireUser()`(`_shared/auth.ts`)가 두 번째 방어선으로 한 번 더 막지만 **그건 안전망이지 대체재가 아니다** — 둘 중 하나를 중복이라며 지우지 말 것.
- **캐시 무효화 `?v=` — 공용 모듈을 고치면 로드하는 모든 HTML의 `?v=`를 함께 올린다.** `<script src="../assets/js/cubenest-core.js?v=0.3.0">`처럼 소비처마다 버전이 박혀 있고, 안 올리면 GitHub Pages가 옛 파일을 계속 준다 — **오류가 아니라 "안 고쳐진 것처럼" 보인다**(아래 배포 순서와 같은 실패 유형).
  - 소비처 찾기: `grep -rn "<모듈>.js?v=" --include=*.html .` (index · playground · quiz · quiz/run · worksheets · my · account · guide 중 해당하는 것 전부)
  - **통일할 땐 기존 값 중 하나가 아니라 새 값으로 올린다.** 옛 값을 캐시한 브라우저가 그 값 그대로 옛 파일을 계속 쓰기 때문이다. (실제 사례: `api-client.js` 한 파일이 `?v=1` 2곳·`?v=0.2.0` 1곳으로 갈라져 있었다 → 260826 `0.3.0`으로 통일.)
  - `consent.js`와 `vendor/qrcode-generator.js`는 `?v=` 미고정(거의 안 바뀜) — 고치게 되면 그때 붙인다.
- **배포는 두 갈래이고 순서가 있다 — 클라 먼저, 서버 나중.** 정적 사이트 = `git push` → GitHub Pages(origin/main). 서버 = `supabase functions deploy config generate grade worksheet`. 둘은 따로 나가므로 **한쪽만 배포하면 조용히 어긋난다** — 오류가 아니라 "안 바뀐 것처럼" 보인다.
  - 클라는 `/config`(열린 학년·유형·등급)를 **정본**으로 삼는다. 서버를 먼저 배포하면 옛 클라가 **없어진 학년을 계속 팔고**(칩은 남는데 유형이 0개), 그 학년으로 시작한 퀴즈는 `normStage()`가 기본값으로 떨어뜨려 **다른 학년 문제가 조용히 나온다**(260821 중1~2 제거 때 실제로 발생).
  - 확인: `curl .../functions/v1/config` 의 `version` == `cubenest-gen-config.js` 의 `VERSION`, 그리고 라이브 HTML에 그 커밋의 표식이 있는지.

## 데이터·수익화
- **login-free-first:** 무료 도구는 클라만으로 완결. 로그인은 저장·유료의 선택 강화층.
- 수익화(학부모 B2C): 베타 무료 → **기간 이용권 단건결제**부터 → 월 자동결제 확장(관리형·Supabase Pro).

## 현재/다음
- **완료:** 상태 공유(F2·F3)·계측/동의(F1)·서버 생성/채점(gen 서버화)·OAuth 로그인·**유형 19종**(리매핑 + 안보이는나무 A-a~f + G군 + H군)·정답 은닉·worksheets(문제지·정답지 인쇄·QR)·**난이도 개편(연령 스테이지 S0~S4 + 개수 밴드, gen-config 구조 교체)**·세션 내 중복 회피(gen v0.5.0)·**DB+RLS 저장(`profiles`+`quiz_results`+`my_items`, 닉네임·퀴즈 기록·문제지 계정 귀속, 멱등키 `attempt_id`/`item_id`, 계정별 로컬 분리, 죽은 세션 자동 로그아웃)**.
- **다음:** **결제(이용권 `entitlements`)** — 저장 계층은 끝났다. ⚠ 여기까지 진척이 전부 콘텐츠·보안·UI였고 **수익화 검증 경로는 아직 0** — 마스터 §7.2 참조.
- 새 기능은 F1~F5·`CubeNest.auth`·`CubeNest.mydata`·서버 gen을 **재사용**한다.
