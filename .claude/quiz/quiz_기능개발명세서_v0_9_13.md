# quiz_기능개발명세서

> **버전:** v0.9.13 · **상태:** 초안 — 본문=현행 8유형 · §6=**서버 이전(P0.5) 완료** · **최종 수정일:** 2026-08-17
> **기준 마스터:** v1.5.2
> **정본 참조(재정의 금지):** 모양 수학·겉넓이 = 마스터 3·4장 · 인증/게이트/저장 = 6장 · 공용 요소(F1~F5) = 5장 · 문제 분류·생성기·공급/보관 = 『문제 분류 체계』 · 학습 순서 = 『CubeNest 커리큘럼』 · 렌더·투상 펼침·겉넓이 계산 = playground.

### 변경 이력
| 버전 | 날짜 | 핵심 |
|---|---|---|
| v0.1.0~v0.5.0 | ~08-04 | 스텁 → 트랙·태그·build_tier → 드롭다운 필터 → run 프로토타입 → gen_config 외부화·정본 3D 뷰어 임베드. |
| v0.6.0 | 08-07 | 차원 = 문제 보기 형태(3D 문제/2D 겨냥도), worksheets 연동 규칙, 실행이 `dim`으로 뷰어 선택. |
| v0.7.0 | 08-07 | 뷰어 격자·위앞옆 라벨(회전 연동)·회전 잘림 해결·2D 버튼 명확화, 문항별 의견 버튼(구글폼 미리채우기), 채점 캐릭터 애니메이션. |
| **v0.8.0** | **08-07** | **문제별 정답·해설 구성 신설(§3).** 답안·애니메이션 **동시 표시** + `Good!`/`Oops!` + **효과음(벨)·음소거**. 결과 **3버튼 + 공유하기**. **유형별 해설 강화**: 개수(층별+위에서 본 수 합+2D 격자), 부피(단위 정합), **겉넓이(오목 반영 위·앞·옆 + 정확 공식 병기 + 펼쳐보기)**, 높이지도(정답 채움), 위앞옆(앞/옆/위 무작위·균일 옵션·옆 반전 수정). |
| **v0.8.1** | **08-07** | **GA4 태깅(§4.2).** 두 페이지에 오리진 공유 동의 배너 + `consent.js`(gtag 로더) 추가 → 동의 후 **페이지뷰 자동 전송**. 랜딩·실행 **커스텀 이벤트 목록** 정리·배선. |
| **v0.9.0** | **08-08** | **공용 모듈 채택(마스터 §5.1·§8.1).** 인라인 `mount3D`·`mountExplode`·§4 계산 제거 → **`cubenest-core`(계산)·`cubenest-viewer`(관찰/펼쳐보기) import**(core 먼저, `?v=`). viewer **v0.2.1**로 위·앞·옆 라벨 정상화(비율·물체 밖 배치, quiz 우회 제거). 리팩터 회귀 수정(`silSig`/`perturbSil` 복원). 겉넓이 해설 표기: **①위·앞·옆 / ②'다른 해설'**(항상 병기, 오목/볼록 미노출). |
| **v0.9.1** | **08-08** | **겉넓이 오목 난이도 밴딩(마스터 v1.5.2 4.2).** core 오목 판정(`노출면 > 2×실루엣`)으로 하·중=오목X / 상=혼재 / 최상=오목O 재샘플. **count−pairs '다른 해설' 항상 병기 = v1.5.2로 정합**(정책 차이 해소). **최상 5/5/5·edge2**로 상향(`gen-config v0.2.0`). |
| **v0.9.2** | **08-09** | **실행 로직 분리(`run.js`)** — HTML 234줄 + 로직 별도(편집 토큰 절감). **신규 유형 2종**: 최소·최대(최소/최대/차이, `core.reverseCounts`·`reverseShapes`로 3D 최소·최대 모양 + 위 그림 불변 숫자/변동 칸), 안 보이는 나무(초등 겨냥도 가림/유아 이웃 가림 2정의, `viewer.setHighlight` 3D 빨강). **연습장 canvas**(전 유형·정적 HTML·4색·지우개·undo 5획·접기). 모듈 **core 0.3.0 / viewer 0.2.3**. |
| **v0.9.3** | **08-09** | **위·앞·옆 그리기(`facesDraw`) 구현** — 솔리드 보고 위·앞·옆 격자 칠하기, `topSil/frontSil/sideSil` 칸별 채점(초록/빨강). **격자 높이=레벨 maxH**(정답 힌트 제거), **최상 제외(4×4×4 이하)**·**dim 존중(2d 겨냥도 필요)**. 해설 = **정답 세 방향 그림 + 3D 뷰어(세로 1열)**, 설명 텍스트 제거. 연습장 **접힘 시 도구 숨김·라벨만 / 펼침 시 라벨 숨김.** |
| **v0.9.4** | **08-13** | **생성기 공용 모듈 추출** `cubenest-gen` v0.1.0(rng·genShape·isConcave·hiddenCells·`genSession`) — quiz·worksheets 동일 문제 보장(§8.1). **세션 지속(이어풀기)**: 위치·답·정오·연습장 localStorage 저장/복원. **문항 자유 이동**(이전/다음, 답한 문항 복원). **연습장 지속**: 리사이즈 시 그림 보존·문항별 저장(PDF 토대). **worksheets 위임**(`fromQuiz` payload, '문제지 만들기'). ⚠ quiz+worksheets **동일 오너**. |
| **v0.9.5** | **08-13** | **실행 UX 정비.** 문제 앞 **"N번"** · **번호 팔레트+결과보기 한 묶음(`.qnav`)**(맞음 초록/틀림 빨강/안 푼 빈칸·클릭 이동·가로 스크롤 한 줄) · **결과보기=allDone 기준 활성**(비활성 시 안 푼 번호 툴팁) · **'다음'=안 푼 다음 문항으로 순환**(모두 풀기 전 상시) · 마지막 **결과 확인 중복 버튼** · **진행바=푼 문제 수 비례** · **헤더 스크롤 슬라이드 숨김/표시** · 연습장 접기 텍스트·[hidden] 잔상 차단·중복 정보 정리(qhead 유형 제거). |
| **v0.9.6** | **08-14** | **연습장 2레이어 + 첨삭.** 아이 레이어 **제출 시 잠금**(원본 보존) · **첨삭(선생님·학부모) 레이어**(별도 캔버스 오버레이) · **모의 로그인 게이트**(`cubenest_mock_login`, worksheets 공용) → 첨삭 모드. 색: 아이=검정·보라·초록·주황 / 첨삭=**빨강·파랑**. `store[idx]={child,tutor}` 2 PNG. worksheets payload·요청서 `{child,tutor}`로 개정. |
| **v0.9.7** | **08-14** | **서버 아키텍처 재개편 기획 + API PoC(구현 전·별도 파일).** 분류축 (테마→제시→질문) 매트릭스(17+2) · **`gen`·`gen-config` 서버(Edge Function) 이전** 방향 · 서버 API v0.3 계약(전 유형 서버 채점·isoImage 은닉) · mock 서버 + run 비동기 전환 PoC로 **생성·채점 전 유형 서버 경유 검증**. **현행 배포(8유형)는 불변.** (§6) |
| **v0.9.8** | **08-15** | **서버 이전(P0.5) 실배포.** Supabase Edge Functions(Deno) `/generate`·`/grade` 배포(무료·verify_jwt=false) · `gen`+`gen-config` 서버 이전(원본 무수정 import) · gsig(HMAC) · **Postgres rate limit**(anon 쿠키+IP) · 클라 `api-client.js`(실 fetch·X-Anon-Id) + `run.js` 서버 연동(GEN 의존 제거) · **8유형 생성·채점·해설 서버 경유 실동작 확인.** (§6.7) |
| **v0.9.13** | **08-17** | **안 보이는 나무 6종 E2E 검수 완료(Claude Code) + /generate 스키마 변경.** ① **정답 누출 제거**: questionFor가 q.correct(facesMc)·q.rc(minmax·A-d)·q.kinds(A-f)를 내려보내던 것 전부 제거. present 폐지(클라 소비 0). ② **minmax·hidden은 sh 대신 `given` 수신**: `_gp={level,type,sub?,which?,given}`, given.kind=sils/numTop/layers/isoTop(A-a/b/f isoTop.iso=서버가 그린 겨냥도 SVG). 3D회전 6종(count/volume/surface/heightmap/facesMc/facesDraw)은 sh 유지(회전=풀이과정, 은닉 설계상 불가·수용, CLAUDE.md 보안§). ③ **채점·색칠·해설 단일출처=/grade 응답**(answerKey+explain). **로컬 폴백 채점 제거**(서버 없이는 세션 시작도 안 됨). 실패 시 문항 미소진 **재시도**(오프라인/레이트리밋/서버오류 구분). ④ **pr.unit 오버라이드**(A-f "가지"). ⑤ **SKEY에 sub 포함**(서브만 바꿔도 진행상태 분리). ⑥ 빈 답 제출 안내(.ansnote). ⑦ 공용 모듈 **cubenest-iso.js** 신설(renderIso 승격, 클라 assets/js/ + 서버 _shared/). 커밋 d6d2a6a·65d86b5·5554076 배포 완료. |
| **v0.9.12** | **08-16** | **연습장·문제지 성능 개선(claude code 검증).** (1) 연습장 pointermove **누적경로 제거**→구간별 1획만 렌더(선형비용 소멸, 100/300/600점 0ms), pointerdown 단일점 즉시 표시. (2) 문제지 `buildWorksheetPayload` **async 청크화**(3문항마다 yield)+버튼 '📄 문제지 만드는 중…'·disable·finally 복원→최대 프리즈 238→71ms. (3) 배경탭 대비 **rAF+60ms 타이머 레이스**. 벡터 저장 API 불변. |
| **v0.9.11** | **08-16** | **연습장 벡터 저장 전환.** run 연습장(scratch)을 PNG dataURL→**획 벡터**(store={child/tutor:[stroke]}, stroke={c,w,e,p:[정규화0..1]})로 교체—용량 8~35배↓·해상도무관·크로스기기 재생·클라우드 동기화 준비. 공개 API(show/hide/get/all/load) 유지, get()=벡터→PNG 변환(문제지 임베드 호환). 확인: `mydata.js` 로드·헤더 마크업 반영됨. |
| **v0.9.10** | **08-16** | **P1-1 착수(설계·구현)·유형 재정의.** (1) '안 보이는 나무' A-a~f **6종 확정**+visibleTop 규칙(교과서 검증)—기존 hidden 버그 정답. (2) 단원 전체 유형지도 A~J(문제집 4종 수렴검증)+범위확정(G·H=P1/J=P2/I·K 제외). (3) 현행 8유형 **리매핑**+**난이도 3축**(난이도 라벨⊥격자스케일·밀도 U자·유형별 프리셋·계산복잡도별 지원등급). (4) **gen 3축 리팩터**(`cubenest-gen-config.js` 신규·`resolveCfg`, genSession만 교체=계약 불변)—Edge 배포·복구 완료. (5) run: **mydata 연동**(퀴즈기록·문제지 로컬축적)+`/my` URL(restart·view=result). (6) auth 담당 변경 흡수(mock→실 `CubeNest.auth`). |
| **v0.9.9** | **08-15** | **P0.5 마무리 + 로딩 UX.** 정적 `cubenest-gen.js`·`gen-config.json` **삭제**(클라 미로드 확인) · **로딩 버디**(채점 캐릭터와 동일 톤·영어 'Ready~'·로드완료 즉시 퀴즈, 제출 시 미표시) · **grade 지연 완화**(rate DB 왕복 제거, gsig 보호) · 랜딩 `shadow` 글리프 버그 수정. `run_260815_0005.js`. |

### 버전별 최종 작업물
> 새 버전마다 이 표에 최종 작업물을 기입한다.

| 버전 | 최종 작업물 (흔적) | 커밋 위치 | 비고 |
|---|---|---|---|
| v0.5.0 | `quiz_run_260804_0002.html` | `quiz/run/index.html` | 정본 3D 뷰어 임베드 · `gen-config.json` |
| v0.6.0 | `quiz_run_260807_0001.html` | `quiz/run/index.html` | `dim`으로 뷰어 선택. 설정 `quiz_260807_0001.html` |
| v0.7.0 | `quiz_run_260807_0008.html` | `quiz/run/index.html` | 뷰어 격자·라벨·의견 버튼·채점 캐릭터 |
| **v0.8.0** | **`quiz_run_260807_0020.html`** | `quiz/run/index.html` | 정답·해설 구성(§3)·효과음/음소거·결과 공유·겉넓이 펼쳐보기. 설정 `quiz_260807_0001.html` 유지 |
| **v0.8.1** | **`quiz_run_260807_0021.html`** | `quiz/run/index.html` | GA4 태깅(동의 배너·consent.js·이벤트). 설정 **`quiz_260807_0002.html`**(→ `quiz/index.html`) 동반 |
| **v0.9.0** | **`quiz_run_260808_0006.html`** | `quiz/run/index.html` | 공용 모듈(core·viewer v0.2.1) import, 겉넓이 해설 '다른 해설' 병기. 설정 `quiz_260807_0002.html` 유지. 모듈: `assets/js/cubenest-core.js?v=0.2.0`·`cubenest-viewer.js?v=0.2.1` |
| **v0.9.1** | **`quiz_run_260808_0008.html`** | `quiz/run/index.html` | 겉넓이 오목 난이도 밴딩, 최상 5/5/5. 동반 **`gen-config.json` v0.2.0**(→ `assets/js/quiz/gen-config.json`). 설정 `quiz_260807_0002.html` 유지 |
| **v0.9.2** | **`quiz_run_260809_0009.html`** + **`run_260809_0009.js`** | `quiz/run/index.html` + `assets/js/quiz/run.js` | 로직 분리, 최소·최대/안 보이는 나무, 연습장. 설정 **`quiz_260809_0001.html`**(minmax/hidden live). 모듈: `cubenest-core.js?v=0.3.0`·`cubenest-viewer.js?v=0.2.3` |
| **v0.9.3** | **`quiz_run_260809_0016.html`** + **`run_260809_0014.js`** | `quiz/run/index.html` + `assets/js/quiz/run.js` | 위·앞·옆 그리기, 해설 3D·세로 1열, 연습장 접힘/라벨. 설정 **`quiz_260809_0003.html`**(facesDraw live·최상 제외). 모듈 동일(core 0.3.0·viewer 0.2.3) |
| **v0.9.4** | **`quiz_run_260813_0002.html`** + **`run_260813_0004.js`** | `quiz/run/index.html` + `assets/js/quiz/run.js` | 생성기 모듈·세션 지속·문항 이동·연습장 지속·worksheets 위임. **신규 모듈 `assets/js/cubenest-gen.js` v0.1.0**. 로드 순서 core→**gen**→viewer→run.js |
| **v0.9.5** | **`quiz_run_260813_0010.html`** + **`run_260813_0013.js`** | `quiz/run/index.html` + `assets/js/quiz/run.js` | 실행 UX 정비(팔레트·결과버튼·진행바·헤더). 모듈 동일(core 0.3.0·gen 0.1.0·viewer 0.2.3) |
| **v0.9.6** | **`quiz_run_260814_0005.html`** + **`run_260814_0005.js`** | `quiz/run/index.html` + `assets/js/quiz/run.js` | 연습장 2레이어(아이 잠금/첨삭)·모의 로그인·첨삭 색. 요청서 **`worksheets_integration_request_quiz_260814.md`**. 모듈 동일 |

---

## 한눈에

**무엇:** 쌓기나무 문제를 **필터로 골라 자동채점으로 푸는 웹 퀴즈.** 태블릿·휴대폰 우선, 플레이 무로그인(마스터 6.3).

```
[설정] quiz/index.html
   · 교육과정·난이도·차원(보기 형태)·문제유형·문제수 → 유형 카드
   │  시작하기 → ./run/?type&lv&n&edu&dim
   ▼
[실행] quiz/run/index.html (얇은 HTML) + assets/js/quiz/run.js (로직)
   · seed로 N문항 → 제시(뷰어/세 방향/겨냥도) → 연습장 → 답·채점(캐릭터+효과음)·해설(§3) → 결과·공유
   · 진도·결과 localStorage(무로그인) / 결과 저장(클라우드)만 로그인 게이트(RLS)
```

**정본 경계:** 값·판정·겉넓이·최소/최대·오목=`cubenest-core` · **문제 생성기(genShape·genSession)=`cubenest-gen`** · gen-config=분류 체계 · 3D 렌더·투상·큐브 강조=`cubenest-viewer`/playground · 인증·저장=6장 · **PDF 문제지=worksheets(quiz는 `fromQuiz`로 이용).**

**구현 현황 (build_tier):**
| build_tier | 유형 | 입력 / 채점 | 상태 |
|---|---|---|---|
| 기본채점 | 개수·부피·겉넓이 | 숫자 / 정확 일치(4.2) | ✅ |
| 기본채점 | 위·앞·옆 모양 고르기 | 객관식 / 정답 선택(4.3b) | ✅ |
| 기본채점 | 위에서 본 수 쓰기 | 격자 칸별 숫자 / 칸별(4.3a) | ✅ |
| 사고력 | **최소·최대**(최소/최대/차이) | 숫자 / `reverseCounts`(4.4) | ✅ |
| 사고력 | **안 보이는 나무**(겨냥도 가림/이웃 가림) | 숫자 / 가림 판정 | ✅ |
| 입력UI | **위·앞·옆 그리기**(기본) | 격자 칠하기 / 칸별 실루엣 | ✅ |
| 입력UI | 위·앞·옆 그리기(가감 후) | 격자 칠하기 | ⏳ 후속 |
| 사고력엔진 | 추론·구성·변환·세기(나머지) | 역방향 등 | ⏳ 후속 |
| 공통 | **연습장**(전 유형) | 자유 필기 canvas | ✅ |

---

## 1. 두 화면

### 1.1 설정 — `quiz/index.html`  [프로토타입]
- **필터(드롭다운 + 스테퍼):** 교육과정 · 난이도(다중, 기본 전체) · **차원(전체/3D 문제/2D 겨냥도)** · 문제유형(그룹 다중) · 문제 수(5~30, 5단위, 기본 10).
- **차원 = 보기 형태(§2.3).** 카드 태그가 필터 선택 미러링. 2D 지원 유형엔 **`문제지 생성 →`** 버튼(worksheets 예약 안내), 3D 조작 전용엔 **`화면 전용`**.
- 시작하기 → `./run/?type&lv&n&edu&dim`.

### 1.2 실행 — `quiz/run/index.html` + `assets/js/quiz/run.js`  [프로토타입]
- **구조:** 얇은 HTML(마크업·스타일·스크립트 참조 ~234줄) + **로직 분리 `run.js`**(생성기·채점·해설·뷰어 마운트·연습장·GA4 등). HTML은 화면, run.js는 로직 → 편집·검증 토큰 절감.
- **라우팅:** 별도 페이지, 상대경로(`../../assets`, 복귀 `../`).
- **제시 형태(유형별):** 3D 임베드/2D 겨냥도(`dim`) · **세 방향 본 모양**(최소·최대) · **고정 겨냥도**(안 보이는 나무).
- **상단 헤더(v0.9.5):** 사이트 헤더 `.site-top`는 **아래로 스크롤 시 위로 슬라이드 숨김 / 위로 스크롤 시 표시**(sticky + transform, 문항 이동 중엔 토글 억제). 퀴즈 topbar = 나가기 · **유형 + 진행바 + "푼 문제 N/총"** · 음소거.
- **본문 순서:** 제시 → 물음(**앞에 "N번"**) → 답 입력 → **연습장(§3.9)** → 제출 → **해설(연습장 아래)** → 이동.
- **화면 구성 정리(v0.9.5):** 정보 중복 제거 — 유형=topbar / 위치=팔레트 / 진행(푼 수)=topbar. `.qhead`=난이도·모드·의견만. `[hidden]{display:none!important}`로 결과 화면 잔상(해설·액션) 차단.
- **문항 이동·팔레트(v0.9.5, §3.11):** 카드 상단 **`.qnav` = 번호 팔레트 + 결과보기(한 묶음)**. 팔레트 = 맞음 초록·틀림 빨강·**안 푼 빈칸**, **클릭 이동**, **가로 스크롤 한 줄**(30+ 문항도 높이 유지), 현재 칩 자동 정렬. 하단 액션(세로) = **[제출]** / 답한 뒤 **[다음 →]**(안 푼 다음 문항으로 순환) / 모두 풀면 **[결과 확인]**.
- **세션 지속·이어풀기(v0.9.4):** 위치·문항별 답·정오·연습장을 seed 기준 `localStorage` 저장(`beforeunload` 포함) → **새로고침 시 이어풀기**. '다시풀기'는 세션 초기화.
- **결과:** 점수 · 문항별 O/X · **버튼**(다시풀기·다른 퀴즈·**결과 저장하기 → 📄 문제지 만들기**, 동일 폭) · **공유하기**(§4.4).

---

## 2. 엔진 (설정·실행·worksheets 공유)

### 2.1 문제 유형
유형·태그·난이도·`build_tier`·정답 산출 = **『문제 분류 체계』 정본(14종)**. 학습 순서 = **커리큘럼**.

### 2.2 생성기 · `gen_config` · 시드
- **생성기 = `(config, seed)` 순수 함수**(높이 지도, 연결·중력).
- **`gen_config` 외부화**(`assets/js/quiz/gen-config.json`, 분류 §7.3, **v0.2.0**): run이 fetch → 실패 시 인라인 폴백. worksheets 동일 문항 재현의 다리. 레벨별 `gx·gz·maxH·fMin/fMax·nMin/nMax·edge`. **최상 = 5/5/5·edge2**(fMin9·fMax14·nMin18·nMax30).
- **겉넓이 오목 난이도 밴딩(마스터 v1.5.2 4.2):** `core` 오목 판정 `isConcave`(`노출면 > 2×(위+앞+옆 실루엣)`)으로 **하·중=오목없음 / 상=혼재 / 최상=오목있음**. 시드 스트림을 유지한 채 목표에 맞을 때까지 재샘플(≤60, 결정적). (검증: 밴딩 실패 0.)
- **시드:** 문자열 seed→`xmur3`→`mulberry32`. 스트림 분리(문제 `seed:i`/난이도 `seed:L`/오답 `seed:d{i}`), `history.replaceState`로 URL 유지 → 재현·공유.

### 2.3 뷰어 — 두 보기 형태(차원)
- **`3D 문제` = 3D 임베드:** 공용 **`cubenest-viewer.createViewer`**(관찰 전용). 큐브 + 바닥·기준 격자 + **위·앞·옆 라벨(회전 연동, v0.2.1: 물체 밖 배치·비율 정상)** + 오빗 + `정면` 리셋(`reset()`). 직교 프러스텀 = 대각선 기준(4×4×4 미절단).
- **`2D 겨냥도` = 정적 SVG(quiz 고유):** 아이소 + 바닥 격자·위앞옆 라벨 · **돌리기 버튼(굽은 화살표+`90°`)** · 나침반. 인쇄 가능 → worksheets 직결. (모듈 아님 — 2D 표현은 quiz 로컬)
- **선택·폴백:** `dim=2d` 또는 `THREE`/`viewer` 미로딩 시 2D 겨냥도. 계산 미로딩 시 값만 표기.
- 문항 전환·결과 시 뷰어 `dispose`.

### 2.4 공용 모듈 (마스터 §5.1·§8.1)  ⭐
- **`cubenest-core`(계산, §4 정본, v0.3.0):** `stats`(개수·부피·pairs·위앞옆·노출면·겉넓이) · `silhouettes` · **`reverseCounts`(최소·최대·은면)** · **`reverseShapes`(최소·최대 높이지도)** · `serialize`(F2). quiz의 §4 값·최소/최대 모양은 전부 여기서 나온다.
- **`cubenest-gen`(생성기, v0.1.0) ⭐ 신규:** `rngFrom`(시드 PRNG) · `genShape(rng,cfg)` · `isConcave` · `hiddenCells` · `levelPool` · **`genProblem`/`genSession`**(모양 + 하위질문 결정 which/dir/hmode). **quiz·worksheets가 같은 seed→같은 문제**를 얻는 단일 출처(§8.1 표류 방지). buildSession은 `genSession`을 호출하고 프레젠테이션(문구·보기)만 담당. core 의존.
- **`cubenest-viewer`(뷰어/펼쳐보기, v0.2.3):** `createViewer(...)` + 펼쳐보기 + **`setHighlight`/`highlightCells`** + `dirLabelPositions`.
- **로딩:** `window.CubeNest.{core,gen,viewer}`. **core → gen → viewer → run.js.** 캐시 무효화 `?v=`(**core 0.3.0 · gen 0.1.0 · viewer 0.2.3**).
- **모양 어댑터:** `coreShape(sh)` = `{gx, gy:maxH, gz, edge, cells:[[x,y,z]]}`(quiz·gen 공용 형태).
- **오너십:** 모듈은 playground 소관 — 변경은 단일 지점(playground)에서, quiz는 참조. (라벨 문제도 quiz 우회 후 모듈 v0.2.1로 근본 해결.)

---

## 3. 문제별 정답·해설 구성  ⭐ (신설)

활성(기본채점) 5개 유형의 **입력 · 채점 · 해설**을 정의한다. 계산은 마스터 4장/playground 정본을 따르고, 해설은 **공식을 숫자로 풀어** 정확·명료하게 보인다.

### 3.0 공통 채점 연출
- 제출 → **답안(정오 문구·해설·`다음`)을 즉시 표시**, **동시에** 채점 연출 재생.
- **캐릭터(브랜드 큐브 버디):** 정답 = 웃으며 축하 + 초록 **O** + `Good!` / 오답 = 순한 표정 + 분홍 **X** + `Oops!`. **반투명 중앙 오버레이 ~1.3초**, `prefers-reduced-motion` 존중.
- **효과음:** Web Audio **벨/차임 합성**(외부 파일 無) — 정답 상행, 오답 하행. **음소거 토글**로 on/off(§1.2).
- 해설(`sol`)은 공식·핵심 숫자를 강조 표시.

### 3.1 개수 세기
- **입력:** 숫자(`개`). **채점:** 정확 일치.
- **해설(2가지 방법 + 2D 그림):**
  - **2D 그림:** 위에서 본 수 격자(각 칸에 그 자리 높이).
  - **① 층별 세기:** `1층 A + 2층 B + … = N개`(층별 큐브 수).
  - **② 위에서 본 수의 합:** `h₁ + h₂ + … = N개`. → 두 방법이 같은 값.

### 3.2 부피 구하기
- **입력:** 숫자(`cm³`). **채점:** 정확 일치(4.2).
- **해설:** `부피 = 쌓기나무 수 × 한 개의 부피 = N × (a cm × a cm × a cm) = V cm³` (단위 정합).

### 3.3 겉넓이 구하기
- **입력:** 숫자(`cm²`, 바닥 포함). **채점 계산:** `cubenest-core.stats` — 방향별 노출면(이웃 빈칸 검사) → `노출면 = 2×(위+앞+옆)`, `겉넓이 = 노출면 × 모서리²`.
- **해설(항상 두 가지 병기 · 오목/볼록은 사용자에게 미노출):**
  - **① 위·앞·옆으로:** `2×(위 U + 앞 F + 옆 S) × (a cm × a cm)`. U·F·S = 방향별 노출면 개수(오목 포함 정확).
  - **② 다른 해설:** `겉넓이 = (전체 면 수 − 맞닿은 면 수) × 한 면의 넓이 = (6×N − 2×pairs) × (a cm × a cm) = … cm²`. (‘정확식·count−pairs’ 표현 대신 **'다른 해설'** 로 표기.)
  - ※ 내부적으로 오목 여부(core: `노출면 > 2×실루엣`)는 난이도 밴딩 등에만 사용, 화면엔 드러내지 않음.
  - ※ 마스터 **v1.5.2 4.2로 정합**: count−pairs 병기를 '겉넓이 대안 표기(다른 해설)로 항상 허용'(주 표기는 `2×(위+앞+옆)`, 날 용어 금지).
- **시각 자료 — 펼쳐보기(`cubenest-viewer`):** `createViewer(...,{faceColors:true})` + `setExplode` — 위·앞·옆 실루엣 방향색 패널 + **큐브 6면 방향색** + 라벨 + **삼투상/육투상 토글**(`setExplode6`), 드래그 회전. `viewer` 미로딩 시 평면 투상 그리드 폴백.

### 3.4 위에서 본 수 쓰기
- **입력:** 위 격자 칸별 숫자(색칠 칸만). **채점:** 칸별 일치. 채점 후 **각 칸에 정답 높이 채움**(정답 초록·오답 빨강 테두리).
- **해설:** 각 칸의 수 = 그 자리 나무의 **높이(층수)**(4.3a).

### 3.6 최소·최대  ⭐ (마스터 4.4)
- **제시:** 위·앞·옆 **세 방향 본 모양**(2D 방향색 패널). 솔리드는 숨김(정답 노출 방지).
- **출제:** 문항마다 **최소 / 최대 / 차이(=최대−최소)** 무작위. `core.reverseCounts`로 정답. **max>min 되도록 재샘플**(범위 있는 문제).
- **입력:** 숫자(개). **채점:** 정확 일치.
- **해설(문제 맞춤):**
  - **위에서 본 모양 그리드:** 불변 칸(min==max)은 **고정 높이 숫자**, 변동 칸(min≠max)은 **색칠 + `최소~최대` 범위**(어느 자리에서 갈리는지 간략 표시). `core.reverseShapes`로 산출.
  - **3D 최소·최대 모양** 나란히(`reverseShapes` → 높이지도 → `createViewer` 2개). `viewer` 부재 시 2D 겨냥도 폴백.
  - 텍스트: 최대=작은 값까지 채움 / 최소=변동 칸을 낮춤 / 차이=최대−최소.

### 3.7 안 보이는 나무  ⭐ (2정의)
- **정의(교육과정별):** **교과=겨냥도 뒤쪽 가림**(큐브 `(x,y,z)` 뒤 `(x+1,y+1,z+1)`이 있으면 가림) / **사고력=이웃 가림**(앞·위·옆 이웃 모두 채워짐). `PRM.edu==="think"`면 이웃 가림, 그 외 겨냥도 가림.
- **제시:** **고정 2D 겨냥도**(회전 없음 — 정의가 겨냥도 시점 기준). **가림 ≥1개 되도록 재샘플.**
- **입력:** 숫자(개). **채점:** 가려진 나무 수.
- **해설:** **3D 뷰어 + `setHighlight`로 가려진 나무 빨강**(회전 가능). `viewer` 부재 시 **반투명 2D 겨냥도에 빨강**(renderIso ghost) 폴백.

### 3.8 채점 후 3D 해설 뷰어 (공통 인프라)
- 최소·최대(최소·최대 모양)·안 보이는 나무(강조)·**위·앞·옆 그리기(정답 모양)** 의 해설 뷰어는 `EXPVIEWS`로 관리, 문항 전환·결과 시 `disposeExpViews()`로 정리(WebGL 누수 방지).

### 3.9 연습장 (전 유형 공통)  ⭐
- **정적 HTML(`#scratch`)** — 문제·입력 아래, **해설 위**(해설은 캔버스 아래). run.js는 **1회 초기화**, 문제마다 `SCRATCH.show()`로 사이징·초기화(정적이라 유형별 `hide()`로 조절 가능 — `NO_SCRATCH` 예정).
- **자유 필기 canvas(아이):** 색연필 **검정·보라·초록·주황**, **지우개**(SVG), **되돌리기 5획**, **전체삭제**, **접기**(localStorage 저장).
- **툴바 표시 규칙:** 펼침 = 라벨 숨김·도구만 / **접힘 = 도구 숨김·접기 버튼+"연습장" 라벨만**.
- **좌표 정합:** 표시 시 `requestAnimationFrame`으로 `getBoundingClientRect` 사이징 + 그릴 때마다 현재 rect로 매핑 → **첫 문제 y오프셋 없음**. 고해상도(`×dpr`) 대응.
- **2레이어 + 첨삭(v0.9.6):** 캔버스 2겹 — **아이(`child`, 흰 배경) / 첨삭(`tutor`, 투명 오버레이)**. `store[idx]={child,tutor}` 각 PNG.
  - **아이 잠금:** 문제 **제출(채점) 시 아이 레이어 read-only**(그리기·도구 비활성, `relock`) → 원본 보존.
  - **첨삭(선생님·학부모):** 제출 후 첨삭 바 노출 → **모의 로그인**(`cubenest_mock_login`, ✅ worksheets와 공용) → **첨삭 모드**(빨강·파랑, 굵기 동일). 아이 풀이 위에 다른 색으로. `첨삭 종료`로 해제.
  - **레이어별 저장·되돌리기 분리** — 나중에 필터링·구분 출력 가능. 실제 로그인 붙으면 `isLoggedIn()`만 Supabase 세션 체크로 교체.
- **지속(v0.9.4):** **리사이즈 시 그림 보존**(`fitKeep`: 크기 같으면 무동작 / 다르면 스냅샷→재설정→재그림) — **입력창(키보드) 열림/닫힘에도 안 지워짐**. **문항별 풀이 저장**(`store[idx]` PNG dataURL) — 문제 전환/새로고침에 유지. API `SCRATCH.get(idx)`·`all()`·`load()` = **worksheets PDF 병기·세션 지속의 데이터원**.

### 3.10 위·앞·옆 그리기  ⭐ (`facesDraw`, 4.3b)
- **제시:** 솔리드(3D 뷰어/2D 겨냥도, **dim 존중** — 인쇄용 2D 겨냥도 필요). **최상(5×5×5) 제외 = 4×4×4 이하**(겨냥도 높이 과장 완화). 랜딩·run 양쪽에서 최상 배제.
- **입력:** 위(gx×gz 발자국)·앞(gx×**maxH**)·옆(gz×maxH) **격자 칸 칠하기**. 격자 높이 = **레벨 maxH**(실제 최고 높이를 힌트하지 않음). 옆 = z 반전(옆에서 본 좌우).
- **채점:** `topSil/frontSil/sideSil` 정답과 **칸별 대조** — 맞게 칠함=초록·놓침=초록 테두리·잘못 칠함=빨강. 세 격자 모두 일치 = 정답. (검증: 정답 격자 = core 실루엣 면적 일치.)
- **해설:** **정답 세 방향 그림 + 3D 뷰어(세로 1열)**. 설명 텍스트 없음(그림·색 표시로 충분).
- (미구현) **가감 후 그리기**(수를 더하거나 빼서 변형 후) — 후속.

### 3.11 세션 지속 · 문항 이동  ⭐ (v0.9.4)
- **상태 모델:** `S.state[i] = {answered, ok, raw}` (raw = 학생 제출 답: num=값 / mc=선택 / hm=칸값 / draw=칠한 칸). `readAnswer`(캡처) ↔ `applyAnswer`(복원).
- **이동:** `goTo(i)` — 이전/다음 자유 이동. 답한 문항 재방문 = `applyAnswer` + `submit(revisit)`로 답·채점·해설 재구성(효과음·추적·저장은 새 제출만).
- **지속:** `saveSession`/`loadSession`(키 = seed·type·n·levels·edu·dim). 저장 = 위치·`state`·연습장(`_sc`, 용량 초과 시 연습장만 생략). 로드 = init에서 복원 후 해당 위치 렌더. `beforeunload`에도 저장.
- **다시풀기:** 세션·저장 초기화 후 처음부터(같은 seed=같은 문제).
- **팔레트·이동(v0.9.5):** `.qnav`(카드 상단) = 번호 팔레트 + 결과보기. 팔레트 칩 = 정오/미풀이 색(빈칸=미풀이) · 클릭 `goTo` · **가로 스크롤만**(윈도우 스크롤 유발 금지 → 흔들림 없음) · 현재 칩 중앙 정렬. `goTo`는 **즉시 스크롤 + 헤더 토글 억제**.
- **결과보기 활성 로직(v0.9.5):** **`allDone`(모든 문항 answered) 기준** 활성 — 순서 무관, 마지막 한 문항을 푸는 순간 활성. 비활성 시 **안 푼 번호를 툴팁으로 안내**(`안 푼 문제 N개: 1,3,5번`).
- **'다음' 로직(v0.9.5):** 답한 문항에서 `allDone` 아니면 **[다음 →] = `firstUnanswered`(안 푼 다음 문항, 끝이면 앞쪽으로 순환)**. → 건너뛴 문항으로 반드시 도달. 모두 풀면 **[결과 확인]**(상단 결과보기와 중복, 편의).
- **진행바:** `.bar` 길이·"푼 문제 N/총" = **실제 푼 문항 수**에 비례(`updateProgress`), 문항 번호 아님.

---

## 4. 공통 인프라

### 4.1 저장 (마스터 6.3·6.4)
- **플레이 무로그인** — 진도·오답·결과 로컬 우선(`localStorage`).
- **결과 저장(클라우드)만 게이트** — 로그인 시 RLS. 로그인 = Supabase OAuth(카카오 우선)·성인 계정. (현재 `결과 저장하기`는 안내만 — 로그인 미구현.)

### 4.2 계측 — GA4 / F1 (동의 후에만)

**설정(오리진 공유 정본):** 두 페이지에 `assets/css/consent.css` + 동의 배너(`#consent`) + `assets/js/consent.js`(gtag 로더·GA4 측정 ID) 포함. 깊이별 경로(설정 `../assets`, 실행 `../../assets`). 동의(`cubenest_consent`) 전엔 미로드, 이벤트는 `track(name,params)` → `window.gtag` 존재 시에만 발화.

**페이지뷰:** consent.js의 gtag `config`가 **동의 후 자동 전송**. `quiz/`·`quiz/run/`은 경로가 달라 **별도 페이지뷰**로 집계.

**커스텀 이벤트 — 랜딩(`quiz/index.html`):**
| 이벤트 | 발생 | 파라미터 |
|---|---|---|
| `filter_change` | 교육과정·난이도·차원·문제유형·문제수 변경 | `filter`, `value` |
| `quiz_start_click` | 카드 `시작하기`(전환 지표) | `type`,`n`,`lv`,`edu`,`dim` |
| `worksheet_click` | 카드 `문제지 생성` | `type` |

**커스텀 이벤트 — 실행(`quiz/run/index.html`):**
| 이벤트 | 발생 | 파라미터 |
|---|---|---|
| `quiz_run_start` | 세션 시작 | `type`,`n`,`seed` |
| `quiz_answer` | 문항 제출·채점 | `type`,`level`,`correct`,`idx` |
| `quiz_run_complete` | 결과 도달 | `type`,`n`,`score`,`seed` |
| `quiz_rotate` / `quiz_view_reset` | 2D 회전 / 3D 정면 리셋 | `dir`,`deg` / — |
| `feedback_open` | 의견 버튼 | `prefill`,`idx` |
| `share_click` | 결과 공유하기 | — |
| `save_result_click` | 결과 저장하기(로그인 유도) | `loggedIn` |
| `replay_click` / `new_quiz_click` | 다시풀기 / 다른 퀴즈 | `type`,`seed` |

> 배포 시: 리포에 `consent.js`(GA4 ID 포함)·`consent.css` 필요. GA4 관리에서 이벤트·맞춤 측정기준(파라미터) 등록 시 분석 가능. 미리보기(파일 부재)에선 태깅 무시.

### 4.3 의견 · 오류 신고 (마스터 6.6 CS)
- **문항별 의견 버튼**(카드 우측 상단) → 별도 구글폼 **미리채우기**(현재 문항·재현 링크·기기 자동 채움). 상수: `FEEDBACK_VIEWFORM_URL`·`FEEDBACK_ENTRY_CTX`·`FEEDBACK_FORM_URL`.

### 4.4 공유
- 결과 화면 **공유하기** → **Web Share API**(점수+seed 링크), 미지원 시 **클립보드 복사**. 링크는 seed 포함 → 친구가 같은 문제 재현.

### 4.5 배포 · 경로 · 자산
- 산출: `quiz/index.html`·`quiz/run/index.html` + **`assets/js/quiz/run.js`**. **상대경로만.**
- 자산: `assets/css/*` · `assets/js/quiz/gen-config.json`(v0.2.0) · **공용 모듈 `assets/js/cubenest-{core,gen,viewer}.js`**(0.3.0·0.1.0·0.2.3). OG 절대 URL.
- 오리진 공유: GA4·동의. 흔적 `quiz_*`·`quiz_run_*`·`run_*.js` → 커밋 시 각 배포명.

### 4.6 worksheets 연동 (PDF 문제지)  ⭐ (v0.9.4)
- **경계:** PDF 문제지·정답지 알고리즘 = **worksheets 소관**(자체). quiz는 **이용(호출)만** — PDF 미생성(§8.1).
- **위임:** 결과 화면 **📄 문제지 만들기** → `buildWorksheetPayload()`(마스터 §4.5 set 스키마 + 문항별 **연습장 2레이어**) → `window.CubeNest.worksheets.fromQuiz(payload)` **있으면 호출**, 없으면 안내(연동 준비 중).
- **payload:** `{meta, problems:[{n,type,level,edu,ask,shape(F2),correct,scratch}]}`, **`scratch:{child,tutor}`**(아이 풀이 / 첨삭, 각 투명 PNG 또는 null). 정답은 넘기지 않음(정본=core, worksheets가 산출). worksheets는 두 레이어 **구분 표기·필터링** 지원 요망.
- **로그인:** 첨삭·저장·worksheets 공통 **모의 로그인 키 `cubenest_mock_login`** 재사용(실 로그인 = Supabase OAuth·RLS로 교체).
- **문서:** 연동 요청서 **`worksheets_integration_request_quiz_260814.md`**(2레이어 개정) · worksheets 스펙 `worksheets_기능개발명세서 v0.2.0`(동일 오너).

---

## 5. 관리

### 5.1 수용 기준
- **계산:** 5큐브 → 개수 5·부피 5·겉넓이 22 등 골든. **겉넓이 오목 포함** `2×(위+앞+옆)=6N−2쌍`. **최소·최대** `min≤실제≤max`.
- **생성기:** `gen.genShape`가 **원본과 완전 동일**(600/600, 셀 비어있지 않음 — Set→배열은 `Array.from`). 같은 seed → quiz·worksheets 동일 문제.
- **재현성·이어풀기:** 같은 seed → 같은 세트. 새로고침 시 위치·답·연습장 복원. URL 공유·다시풀기로 동일 문제.
- **뷰어/계산:** 공용 모듈 로드 시 정상, `viewer` 부재 시 2D 폴백. **연습장 첫 문제 오프셋·리사이즈 지움 없음.**
- **무결성:** 무로그인·상대경로 · quiz는 PDF 미생성(worksheets 위임).

### 5.2 버전 계획
`v0.9.4`(생성기 모듈·세션 지속·문항 이동·worksheets 위임) → `v0.10.0`(가감 후 그리기·혼합 세션·오답만 다시) → `v1.0.0`(기본채점+사고력 일부 출시).

### 5.3 결정 로그
build_tier · 실행 별도 `run/` · **로직 분리(`run.js`)** · **공용 모듈(core 0.3.0·gen 0.1.0·viewer 0.2.3, §5.1·§8.1)** · **생성기 = `cubenest-gen`(quiz·worksheets 공유·표류 방지)** · 시드 재현·공유·**이어풀기·문항 이동(팔레트)** · **실행 UX: 번호 팔레트(가로 스크롤·정오색·클릭 이동)+결과보기 한 묶음·결과보기 allDone 기준(안 푼 번호 안내)·'다음'=안 푼 다음 문항 순환·진행바=푼 수 비례·헤더 스크롤 슬라이드·중복 정보 정리·[hidden] 잔상 차단** · 답안·애니메이션 동시·효과음·음소거 · 결과 버튼+공유+**문제지(worksheets 위임)** · **겉넓이 = core.stats, ①위·앞·옆 / ②'다른 해설' 병기 + 오목 밴딩(최상 5/5/5)** · **최소·최대(min/max/차이+위 그림+3D)** · **안 보이는 나무(2정의+3D 빨강)** · **위·앞·옆 그리기(격자·칸별·maxH·최상 제외·해설 3D)** · **연습장(전 유형·정적·아이 4색(검정·보라·초록·주황)·지우개·undo5·접기·리사이즈 보존·문항별 저장·2레이어[아이 잠금/첨삭 빨강·파랑]·모의 로그인 게이트)** · facesMc 무작위·옆 반전 수정 · 저장 로그인 게이트(RLS) · GA4 · 외부 문항 미복제 · **quiz+worksheets 동일 오너·엄격 경계.**

### 5.4 미결
- **worksheets 구현**(`fromQuiz` PDF·문제 그림 렌더 공유·정답지·PDF 엔진) — 스켈레톤 `worksheets_기능개발명세서 v0.2.0`.
- **위·앞·옆 그리기 '가감 후 그리기'** · 연습장 **유형별 on/off**(`NO_SCRATCH`).
- **결과 저장(로그인·Supabase)** · 여러 유형 **혼합 세션** · **오답만 다시 풀기**.
- 최상 heightmap 부담 · 겨냥도 높이 가독성 · 효과음 에셋 · 태그 정밀화.

## 6. 서버 생성·채점 재개편 (P0.5 배포 완료 · 신규유형은 계획)  ⭐

> 본 절은 **구현 전 계획 + PoC**다. 현행 배포(§1~§5, 8유형)는 **그대로 유지**되며, 아래는 별도 파일·문서로 검증 중이다.

### 6.1 왜 (보안 · 마스터 피드백)
"클라이언트에 있으면 통째로 복제 가능 → 진짜 독점 가치만 서버로." **`cubenest-gen`+`gen-config`가 문제 은행 전체의 레시피**이므로 서버로 옮긴다. `core`·`viewer`·`run`·`consent`는 클라 유지(저가치·UI). 무료 quiz는 유지(요청당 서버 생성+rate limit), 유료는 로그인·이용권.

### 6.2 무엇이 바뀌나
- **분류 축:** 평면 8유형 → **(테마→제시given→질문ask) 매트릭스**(≈17종 + measure 2 + 3D 전용 테마 D). 데이터 모델 `{theme,given,ask,params,shape,paper}`.
- **차별화:** worksheets=2D 지면 한계 / quiz=3D(회전·펼쳐보기·조립)로 확장. `paper` 플래그(2D 출력 가능 여부).
- **난이도 3축:** 격자(3³=중·4³↑=상최상) · 은닉 수(0=중하·n=중상↑) · 모호성 가능모양수(0=하·1~2=중상·3~4=상·5↑=최상, **복수정답형 상한 6**).

### 6.3 서버 API 계약 (v0.3)
- `POST /v1/generate` → 문제 인스턴스(정답 미포함) · `POST /v1/grade` → 채점 후 `answerKey`·`explain`. **전 유형 서버 채점**(무료 포함), `gsig`(HMAC) 무상태 위·변조 방지.
- **present**: shape/isoImage(은닉·서버SVG)/sils/top/layers/countGiven/options. **answer**: num·numList·bool·mc·markCells·markCount·drawSil·drawLayers·enumerate(복수형 mustAll·max6).
- 결정성=서버가 seed+index 재생성(공유·이어풀기). 연습장·첨삭은 클라 로컬.

### 6.4 PoC 결과 (검증 완료)
- `cubenest-mock-server`(실 GEN·CORE, seed+index 재생성 채점) + `run_poc`(buildSession→`await generate`, submit→`await grade`) → **현행 8유형 전부 생성·채점 서버 경유** 정상(결정성 OK). facesMc(같은 rng 스트림 보기 재생성)·facesDraw(drawCorrect 셀집합)까지 정합.
- 배포 영향 없음(별도 `run_poc.js`·`cubenest-mock-server.js`).

### 6.5 관련 문서 (정본 후보)
- 기획서 `quiz_redesign_plan_260814_v1_2.md` · 서버 API `quiz_server_api_spec_260814_v0_3.md` · 유형 매핑 `quiz_type_mapping_260814_v0_2.md` · 연동요청 `worksheets_integration_request_quiz_260814.md`.

### 6.7 배포 완료 상태 (260815) ✅

- **Supabase Edge Functions 배포 완료**: `https://jtniutmexokswdpxkjof.supabase.co/functions/v1/{generate,grade}` (무료·`verify_jwt=false`).
- **gen·gen-config 서버 이전**: 원본 `cubenest-core.js`·`cubenest-gen.js` 무수정 import(ESM named export 추가본)·`GEN_CONFIG` 서버 상수. 보호 대상(생성기)이 클라에서 사라짐.
- **gsig(HMAC-SHA256)**: 채점 위·변조 방지(secret=`GSIG_SECRET`).
- **rate limit**: Postgres 원자적 카운터(`check_rate` RPC)·anon 쿠키(개인 공정)+IP(하한). generate 쿠키 20/분·300/시, grade 60/분·1000/시, IP 120/분·2000/시. 429+Retry-After.
- **클라 연동**: `api-client.js`(실 fetch·`X-Anon-Id` 랜덤 UUID·`USE_MOCK` 폴백) + `run.js`(비동기 generate/grade·GEN 의존 제거·gen-config fetch 제거). 로드=core→api-client→viewer→consent→run.
- **서버가 `_gp`(렌더용 질문 데이터: sh·which·rc·hmode·hcells·facesMc opts)를 함께 반환** → 현행 8유형 렌더 호환. (은닉 isoImage 도입 시 축소 예정.)
- **검증**: 8유형 생성·렌더·**서버 채점**·해설 실동작 확인. 결정성(seed) 유지.
- **정적 파일 삭제 완료**: `assets/js/cubenest-gen.js`·`assets/js/quiz/gen-config.json` 제거(클라 Network 미로드 확인). **생성기가 클라에서 완전히 사라짐.**
- **로딩 UX(큐브 버디)**: 문제 로딩(generate) 시 채점 캐릭터(Good!/Oops!)와 **동일 톤**의 나무 큐브 버디 + 영어 **'Ready~'**(`.fxword`와 같은 폰트·900·흰 외곽선, 색=액센트). 로드 완료 즉시 퀴즈 표시. **제출(grade) 시엔 미표시**(사용자 선택).
- **grade 지연 완화**: grade는 `gsig`로 보호되고 유효 gsig는 rate 걸린 generate에서만 나오므로, grade의 rate DB 왕복 **제거**(pending 단축). generate rate는 유지.
- **랜딩 버그 수정**: `quiz/index.html`의 `shadow` 글리프 누락(`G[t.glyph] is not a function`) → `shadow` 추가 + `G[t.glyph]?...:''` 방어.
- **잔여**: 은닉 present `isoImage`(서버 renderIso) · P1 리매핑·신규 17유형(서버) · 안 보이는 나무 `hiddenCells` 정의 수정(보류) · worksheets 실구현.
- **관련 문서**: `quiz_edge_function_plan_260815_v0_2.md`(결정·아키텍처) · `quiz_edge_deploy_guide_260815.md`(배포) · `supabase_rate_schema_260815.sql` · `edge/`(함수 스켈레톤).

### 6.6 다음 (단계)
P0 마스터 §7.3 분류 + §5·§6 인증·모듈 개정 → P0.5 실 Edge Function(Supabase·gen 서버 이전·정적 config 폐지) → P1 리매핑(9종)+measure → P2 저비용 신규 → P3 열거형 → P4 3D 전용. 랜딩 UX(드릴다운/프리셋) 병행. **보류:** 안 보이는 나무(`hiddenCells`) 정의 수정(서버 연동과 독립).

---

> **버전 정합(오늘 확인):** quiz `?v=` = **core 0.3.0 · gen 0.1.0 · viewer 0.2.3** / gen-config **v0.2.0** / 명세서 **v0.9.9** / **클라에서 gen·gen-config 제거(서버 전용)** / worksheets 스펙 **v0.2.0**. ※ 마스터 **§9 인덱스**에 **`cubenest-gen`·worksheets 스펙** 신규 등재 + 모듈 명세서(`cubenest_모듈_명세서`)에 gen API 추가 = 마스터 오너 갱신 필요(요청 예정).

> 해소: ~~겉넓이 오목 난이도 밴딩~~(v0.9.1 반영) · ~~count−pairs 병기 정책~~(마스터 v1.5.2 정합) · ~~뷰어·펼쳐보기 공용 모듈 추출~~(v0.9.0 반영).
