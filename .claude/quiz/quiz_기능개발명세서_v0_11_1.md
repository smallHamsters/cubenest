# quiz_기능개발명세서

> **버전:** v0.11.1 · **상태:** 초안 — 본문 = 현행 13유형(8유형 + 안 보이는 나무 6종, minmax·hidden 통합) · **최종 수정일:** 2026-08-17
> **기준 마스터:** v1.8.3 (§6.7 정답 은닉 규약 포함)
> **정본 참조(재정의 금지):** 모양 수학·겉넓이 = 마스터 3·4장 · 인증/게이트/저장 = 6장 · 공용 요소(F1~F5) = 5장 · 문제 분류·생성기·공급/보관 = 『문제 분류 체계』 · 학습 순서 = 『CubeNest 커리큘럼』 · 렌더·투상 펼침·겉넓이 계산 = playground.

### 변경 이력
| 버전 | 날짜 | 핵심 |
|---|---|---|
| **v0.11.1** | **08-17** | **혼합 문제지 · URL 재현 · `/my` 다시 열기(Claude Code).** ① **`/worksheet` 에 `mix:[{theme,sub?,n}]`** — 여러 유형을 한 장에, 항목마다 `seed#i` 독립 스트림, 총 30 상한. **🐛 `theme` 필수 가드가 mix 처리보다 앞에 있어** 혼합 요청이 전부 400 이었다 → 순서 교정. ② **URL 이 곧 문제지 사양** — `?t=theme[:sub]:n`(반복)`&lv=&seed=` + `history.replaceState`. 같은 URL = 같은 문제지(정답 5건 일치 실측)라 새로고침·공유·'열기'가 한 장치로 끝난다. ⚠ 단일 유형은 `mix` 가 아닌 **평면 요청** — 그래야 quiz 위임분 seed 와 같은 문제가 나온다. ③ **`/my` 열기** — `mydata.list()` 가 `meta.url` 을 `openUrl` 로 승격. **🐛 열 때마다 목록에 사본이 쌓여** id 를 URL 해시로 결정화(`ws_<djb2>`) → 덮어쓰기. ④ **`api-client` 오류 표시** — 서버 `error` 를 버리고 `detail` 만 읽어 400 사유가 클라에서 사라졌다(위 mix 버그 진단이 늦어진 원인) → 둘 다 전달(`e.serverError`). §4.7 신설. |
| **v0.11.0** | **08-17** | **worksheets 독립 생성기 + 공용 도형 모듈(Claude Code).** ① **`cubenest-figures.js` 신설** — 실루엣·삼면도·위에서 본 수·층별·빈 격자 렌더러를 `run.js` 에서 승격(추출본이 원본과 **36건 바이트 일치** 확인). 진입점 `renderGiven(given)` 이 제시물 종류를 알아서 그린다 → worksheets 가 19종 분기를 갖지 않는다. ② **발문·폼·단위(`ask`·`form`·`unit`)를 서버로 이관** — `buildSession` 이 조립하던 20여 개 문자열을 `presentSpec()` 단일 출처로. quiz 화면과 문제지가 같은 문구를 쓴다. ③ **Edge Function `/worksheet` 신설** — `/generate` + **정답(answerKey)**. 마스터 §6.7 "유료·고가치는 로그인 후 서버 생성" 대로 **`verify_jwt=true`**(토큰 없이 호출 시 401 실측) + 전용 rate 버킷(분당 6). ④ worksheets 에 **유형 19종·난이도·문항수 생성 폼**. ⑤ drawSil 정답 그림은 `answerKey.cells` 로 직접 칠한다 — H-a/H-b 는 클라가 '조작 후 모양'을 모르므로 이 경로가 유일. **🐛 CSS 충돌:** 빈 상태 컨테이너 `.empty` 가 격자 칸의 `.empty` 수식자와 충돌해 `min-height:100vh` 를 물려줬다 → `.nodata` 로 분리. |
| **v0.10.3** | **08-17** | **worksheets 연동 실구현 — 문제지·정답지 인쇄(Claude Code).** 그동안 `fromQuiz` 는 **한 번도 연결된 적이 없었다**(worksheets 스크립트가 quiz 페이지에 없어 항상 alert 폴백). **경계 재정의:** 레이아웃·인쇄=worksheets / **문제 그림·정답 표기=quiz** — quiz 가 화면 렌더러로 그린 SVG 를 payload 에 실어 보내 worksheets 가 19종 분기를 다시 갖지 않게 했다(도형 모듈 추출 불필요). **전달:** `localStorage` 경유 같은 탭 이동(sessionStorage 는 noopener 새 탭이 못 받고, `await` 뒤라 `window.open` 은 항상 차단). **PDF = 브라우저 인쇄**(정적 호스팅·한글 폰트·SVG 벡터). payload 에 `figure`·`answerArea`(폼별 종이 답란: 숫자칸/고르기/격자/빈 삼면도)·`answerText`·`answerFigure` 추가. 인쇄·저장은 로그인 게이트(미리보기는 공개). **`shape:null` 이음새는 불필요로 판명** — 결과 화면이 전 문항 채점 후에만 열려 항상 `explain` 이 있다. |
| **v0.10.2** | **08-17** | **H군 완성 — H-a 더 쌓은 후 / H-b 빼낸 후 삼면도(Claude Code).** 열 단위 `h±k`(높이지도라 낙하 없음), 답은 `drawSil` 로 `facesDraw` 격자·채점 재사용. **성립 조건 4가지를 한 루프에서**(`opCandidates`): 숨은 열 없음 · 비어있지 않음 · **발자국 연결 유지**(끊김 11% 발생) · **삼면도가 실제로 달라짐**(가장 높지 않은 열을 건드리면 답=원본). 격자 행 수는 **등급 maxH 고정**(조작 후 높이로 그리면 정답 유출) + H-a 는 `h+k≤maxH`. 표시 열은 `iso` 의 `ghost:false` 로 빨강. 답 부담 때문에 **최상 제외(상만)**. 600문항 검증: 4개 제약 위반 0. **🐛 회귀 수정:** `.dcell`·`.opt` 클릭 핸들러가 `T.form`(유형 기본 폼)으로 걸려 있어 **`pr.form` 으로 폼을 덮어쓰는 서브에서 격자만 그려지고 클릭이 안 먹었다** → `form` 으로 교정. **live 19종.** |
| **v0.10.1** | **08-17** | **H군(조작) H-c·H-d — `type:'manip'` 신설(Claude Code).** **H-c 정육면체 완성** — `m³−현재`, ⚠ `m` 은 격자가 아니라 **실제 점유 범위**(격자를 쓰면 정육면체가 부당하게 커진다). G-c 와 같은 이유로 **숨은 열 없는 모양만** 출제 + 이미 정육면체면 제외(두 조건 한 루프). **H-d 색칠 정육면체** — 꼭짓점8·모서리12(n−2)·면6(n−2)²·속(n−2)³, 합 n³ 을 **직접 시뮬로 확정**(n=3~7). n=2 제외, n=등급(3/4/5). 제시는 별도 도식 없이 **`cubenest-iso` 에 `paint` 옵션**을 더해 n³ 솔리드를 파랗게(겉면만 보이므로 그대로 '색칠한 정육면체'). `renderIso` 에 `ghost:false`(강조만) 옵션도 추가 — **기본 호출 24건 이전과 바이트 동일**로 하위호환 확인. 신규 모듈 **`cubenest-manip.js`**. 랜딩 카테고리 **5 조작** 신설(2종). **live 17종.** 누출·만점채점·결정성 17유형 통과. |
| **v0.10.0** | **08-17** | **G군(최대·최소) 확장 — G-a/G-b/G-c(Claude Code).** `type:'minmax'` 에 `sub` 축 도입(hidden 과 동일 패턴, `sub` 없으면 난이도별 pool 에서 결정적 선택). **G-b 위+한 방향 최대·최소** 신규 — 공식 `max=Σ sil×n` / `min=Σ(sil+n−1)` 을 **브루트포스 전수 대조로 확정**(앞·옆 186건 불일치 0). 폭 조건(`높이≥2 이면서 칸≥2`인 줄 존재)으로 재생성, 차이형 제외. **G-c 몇 층 이상 세기** 신규 — 파워유형 유형9 공식(`n 이상인 칸 수`), ⚠ **겨냥도만 주므로 숨은 열 없는 모양으로만 출제**(숨은열 제거 + n 선택을 한 루프에서 — 따로 하면 되살아남. 600문항 검증: 풀 수 없는 문항 0·자명 문항 0). 신규 공용 모듈 **`cubenest-minmax.js`**(클라 + `_shared` 서버 복본). 랜딩 3-1~3-3 카드. **live 15종.** 누출 검사·만점 채점 15유형 전부 통과. |
| **v0.9.14** | **08-17** | **본문 정합화 + §3.5 누락분 보충(Claude Code).** §3에 **`facesMc`(위·앞·옆 모양 고르기) 절이 통째로 빠져 있던 것**을 채움(3.4 → 3.6으로 건너뛰고 있었다). v0.9.10~v0.9.13에서 **변경 이력만 갱신되고 본문은 v0.9.9 상태로 남아 있던 절들**을 코드 기준으로 정정. 주요 정정: §3.7 안 보이는 나무(폐기된 '2정의' → **A-a~f 6종**) · §2.4 공용 모듈(클라 gen 제거, **iso·auth·mydata·api-client 추가**, 로드 순서) · §2.2 gen-config(클라 json → **서버 상수**) · §3.11 상태 모델(`{answered,ok,raw}` → **`+key,explain`**)·세션키(**+sub**) · §3.9 연습장(PNG → **벡터**) · §4.5 경로(`assets/js/quiz/run.js` → **`quiz/run/run.js`**) · **§3.12 채점 아키텍처 신설**(서버 단일출처·재시도) · §1.1 랜딩(드롭다운 → **카테고리 아코디언**) · build_tier 표·결정 로그·§6.7 잔여 갱신. **기능 변경 없음 — 문서만 현행화.** |
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
   · 교육과정·난이도·차원(보기 형태)·문제 수 필터 + 카테고리 아코디언(8) → 유형 카드(19)
   │  시작하기 → ./run/?type&sub&lv&n&dim
   ▼
[실행] quiz/run/index.html (얇은 HTML) + quiz/run/run.js (로직)
   · POST /generate → N문항(정답 미포함) → 제시(뷰어/삼면도/겨냥도/수·층) → 연습장
   · 제출 → POST /grade → 정오·answerKey(색칠)·explain(해설) → 결과·공유
   · 진도·결과 localStorage(무로그인) / 결과 저장(클라우드)만 로그인 게이트(RLS)
```

**정본 경계:** 값·판정·겉넓이·최소/최대·오목=`cubenest-core` · **문제 생성기·정답 = 서버(Edge Function `_shared/cubenest-gen`·`gen-config`, 클라 미배포)** · 겨냥도 SVG=`cubenest-iso`(클라+서버 복본) · 3D 렌더·투상·큐브 강조=`cubenest-viewer`/playground · 인증·저장=6장 · **PDF 문제지=worksheets(quiz는 `fromQuiz`로 이용).**

**구현 현황 (live 13종):**
| build_tier | 유형(`type`/`sub`) | 입력 / 채점 | 상태 |
|---|---|---|---|
| 기본채점 | 개수·부피·겉넓이 (`count`·`volume`·`surface`) | 숫자 / 정확 일치(4.2) | ✅ |
| 기본채점 | 위·앞·옆 모양 고르기 (`facesMc`) | 객관식 / 실루엣 일치(4.3b) | ✅ |
| 기본채점 | 위에서 본 수 쓰기 (`heightmap`) | 격자 칸별 숫자 / 칸별(4.3a) | ✅ |
| 입력UI | 위·앞·옆 그리기 (`facesDraw`) | 격자 칠하기 / 칸별 실루엣 | ✅ (최상 제외) |
| 사고력 | 최소·최대 (`minmax`) | 숫자 / `reverseCounts`(4.4) | ✅ |
| 사고력 | **안 보이는 나무 6종** (`hidden`/`A-a`~`A-f`) | bool·markCells·num / §3.7 | ✅ |
| 입력UI | 위·앞·옆 그리기(가감 후) → **H-a/H-b로 재분류** | 격자 칠하기 | ⏳ P1 |
| 사고력엔진 | **G**(최대·최소 확장)·**H**(조작) | 신규 계산 | ⏳ P1 착수 예정 |
| 사고력엔진 | J(폴리큐브) | 회전 동일성 | ⏳ P2 |
| 공통 | **연습장**(전 유형·2레이어) | 자유 필기 canvas(벡터) | ✅ |

> 랜딩 카드 19종 중 **live 13 / 곧 공개 6**(그림자 추론·무엇을 바꿨나·모양 만들기·조각 맞추기·같은 모양 찾기·가짓수 세기).

---

## 1. 두 화면

### 1.1 설정 — `quiz/index.html`  [프로토타입]
- **1행 필터:** 교육과정(전체/교과/사고력) · 난이도(다중 칩, 기본 중·상·최상) · **차원(전체/3D만/2D만)** · 문제 수(10/20/30).
- **2행 문제유형 = 카테고리 아코디언(v0.8.0~):** 8개 카테고리(`1 개수·부피·겉넓이 / 2 위·앞·옆 / 3 최소·최대 / 4 안 보이는 나무 / 5 추론 / 6 구성 / 7 변환·합동 / 8 세기`)를 펼쳐 세부 유형을 고른다. 아래 카드 그리드가 같은 목록을 카드로 미러링(카드 번호 = `카테고리-순번`).
- **`dim` = 지원하는 렌더 모드**(보기 형태 아님). run이 실제로 3D 뷰어를 띄울 수 있는 유형만 `3d`/`both` — `minmax`·`hidden` 6종은 항상 2D로만 그려지므로 `2d`. "3D만" 필터 = 실제로 회전 가능한 6종.
- 시작하기 → `./run/?type&sub&lv&n&dim` (`sub`은 hidden 6종 등 서브타입 지정).
- 필터 상태는 URL 쿼리로 동기화(`edu`·`dim`·`n`·`lv`) → 공유 가능.

### 1.2 실행 — `quiz/run/index.html` + `quiz/run/run.js`  [프로토타입]
- **구조:** 얇은 HTML(마크업·스타일·스크립트 참조) + **로직 분리 `run.js`**(세션 구성·렌더·채점 표시·해설·뷰어 마운트·연습장·GA4 등). HTML은 화면, run.js는 로직 → 편집·검증 토큰 절감.
- **경로 주의:** run.js는 **`quiz/run/run.js`**(모듈과 함께 두지 않고 페이지 옆). `api-client.js`도 같은 폴더.
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

### 2.2 생성기 · `gen-config` · 시드   ※ **전부 서버 전용**(클라 미배포, 마스터 6.7)
- **생성기 = `(config, seed)` 순수 함수**(높이 지도, 연결·중력). 위치 = `supabase/functions/_shared/cubenest-gen.js`.
- **`gen-config` = 서버 상수**(`_shared/cubenest-gen-config.js`, **3축 v0.2.0**). ~~`assets/js/quiz/gen-config.json`~~ **폐지·삭제됨**(클라 fetch 없음). run의 `INLINE_CONFIG`는 잔존 폴백일 뿐 서버가 무시한다.
- **난이도 3축(remap v0.7 §2):** ① 난이도 라벨(하/중/상/최상) ⊥ ② 격자 스케일(S 3³·M 4⁴·L 5⁵) ⊥ ③ 유형 고유축. 유형별 `PRESETS[type][label]`에서 `[격자, 밀도, edge?]` 조합을 rng로 골라 `resolveCfg`가 `gx·gz·maxH·fMin/fMax·nMin/nMax·edge`를 만든다. **지원 등급도 여기서 결정**(예: `minmax`·`hidden`은 중~최상, `facesDraw`는 하~상).
- **겉넓이 오목 난이도 밴딩(마스터 v1.5.2 4.2):** `core` 오목 판정 `isConcave`(`노출면 > 2×(위+앞+옆 실루엣)`)으로 **하·중=오목없음 / 상=혼재 / 최상=오목있음**. 시드 스트림을 유지한 채 목표에 맞을 때까지 재샘플(≤60, 결정적). (검증: 밴딩 실패 0.)
- **시드:** 문자열 seed→`xmur3`→`mulberry32`. 스트림 분리(문제 `seed:i`/난이도 `seed:L`/오답 `seed:d{i}`), `history.replaceState`로 URL 유지 → 재현·공유.

### 2.3 뷰어 — 두 보기 형태(차원)
- **`3D 문제` = 3D 임베드:** 공용 **`cubenest-viewer.createViewer`**(관찰 전용). 큐브 + 바닥·기준 격자 + **위·앞·옆 라벨(회전 연동, v0.2.1: 물체 밖 배치·비율 정상)** + 오빗 + `정면` 리셋(`reset()`). 직교 프러스텀 = 대각선 기준(4×4×4 미절단).
- **`2D 겨냥도` = 정적 SVG(quiz 고유):** 아이소 + 바닥 격자·위앞옆 라벨 · **돌리기 버튼(굽은 화살표+`90°`)** · 나침반. 인쇄 가능 → worksheets 직결. (모듈 아님 — 2D 표현은 quiz 로컬)
- **선택·폴백:** `dim=2d` 또는 `THREE`/`viewer` 미로딩 시 2D 겨냥도. 계산 미로딩 시 값만 표기.
- 문항 전환·결과 시 뷰어 `dispose`.

### 2.4 공용 모듈 (마스터 §5.1·§8.1)  ⭐
**클라이언트**
- **`cubenest-core`(계산, §4 정본, v0.3.0):** `stats` · `silhouettes` · `heightMap` · `viewHeights` · **`reverseCounts`·`reverseShapes`** · `serialize`(F2). quiz는 **해설 문구용 수치**와 F2 직렬화에만 쓴다(정답 판정은 서버).
- **`cubenest-iso`(겨냥도 SVG, v0.1.0) ⭐ 신규:** `rot` · `renderIso(sh,k,hiSet)`. run에 인라인돼 있던 것을 승격 — **서버 복본이 은닉 유형 제시물을 그린다**(§3.12). ⚠ 셀을 `(x+z)` 오름차순(뒤→앞)으로 칠하는 **정렬이 곧 가림**이므로 불변.
- **`cubenest-viewer`(뷰어/펼쳐보기, v0.2.3):** `createViewer(...)` + 펼쳐보기 + `setHighlight` + `dirLabelPositions`.
- **`auth`(v0.1.0)·`mydata`(v0.1.0)·`consent`:** 인증 단일 진실 · 로컬 우선 데이터 계층 · GA4 동의.
- **`api-client.js`(quiz 로컬):** `CubeNest.api.generate/grade` — 실 fetch·`X-Anon-Id`·429 처리.

**서버 전용**(`supabase/functions/_shared/`, 클라 미배포 — 마스터 6.7)
- **`cubenest-gen`(생성기):** `rngFrom` · `genShape` · **`reshape`** · `isConcave` · `levelPool` · `genProblem`/`genSession`.
- **`cubenest-gen-config`:** 3축 프리셋 · `support` · `resolveCfg`.
- **`cubenest-hidden`:** `visibleTopFootprint` · `hiddenColumns` · `hasHidden` · **`flattenHidden`** · `enumerateByVisible` · `layersToShape`.
- **`cubenest-iso`(복본)** · `gen-adapter`(`buildProbs`·`answerKeyFor`·`checkAnswer`·`questionFor`·`explainFor`).
- ⚠ **신규 `_shared` 모듈은 원본 IIFE + 맨끝 `export const x = globalThis.CubeNest.x`** 를 붙이고 `gen-modules.ts`에 값 import(로드 순서 `core→genConfig→hidden→iso→gen`). 누락 시 **503 BOOT_ERROR**.

- **로딩 순서(실제):** `THREE → core → iso → api-client → viewer → (본문) → supabase-js → auth → mydata → consent → run.js`. 캐시 무효화 `?v=`(**core 0.3.0 · iso 0.1.0 · viewer 0.2.3**).
- **모양 어댑터:** `coreShape(sh)` = `{gx, gy:maxH, gz, edge, cells:[[x,y,z]]}`.
- **오너십:** core·viewer는 playground 소관. **`cubenest-iso`는 quiz가 추출했으나 공용** — 변경은 단일 지점에서(클라·서버 복본 **동시** 갱신).

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

### 3.5 위·앞·옆 모양 고르기  (`facesMc`, 4.3b)   ※ v0.9.14에서 누락분 보충
- **제시:** 솔리드(3D 뷰어 / 2D 겨냥도, `dim` 존중). 묻는 방향 `dir`은 문항마다 `front`·`side`·`top` 중 결정적으로 선택.
- **보기(4지선다):** 정답 실루엣 + `perturbSil`로 만든 오답 3개(막대 높이 ±1 / 뒤집기 / 자리 바꾸기, 중복 제거 후 셔플). **보기 배열(`opts`)은 서버가 생성해 내려보낸다** — 클라가 같은 rng를 돌릴 필요가 없다.
- **채점:** ⚠ **정답 인덱스는 전송되지 않는다**(v0.9.13). 서버가 `answerKeyFor`에서 **같은 rng 시드(`seed:o{idx}`)로 보기를 재생성**해 같은 인덱스를 얻어 채점하고, 클라는 `/grade` 응답의 `answerKey.correct`로 초록/빨강을 칠한다.
- **해설:** 방향별 한 줄 설명(앞=가로 줄의 가장 높은 층 / 옆=깊이 줄의 가장 높은 층 / 위=있는 칸 모두, 높이 안 보임) + "초록 테두리가 정답".

### 3.6 최소·최대 G-a~c  ⭐ (마스터 4.4 · G군 v0.10.0)

> `type:'minmax'` 에 `sub` 축을 두어 3종. `sub` 없이 들어오면 난이도별 pool 에서 결정적으로 고른다(하위호환).

| sub | 이름 | 제시(`given.kind`) | 질문 | 서버 계산 | 지원 등급 |
|---|---|---|---|---|---|
| **G-a** | 삼면도 최대·최소 | `sils` | 최대/최소/차 | `core.reverseCounts` | 중~최상 |
| **G-b** | 위+한 방향 최대·최소 | `topOneSil` | 최대/최소 | `minmax.minmaxFromTopAndSil` | 상~최상 |
| **G-c** | 몇 층 이상 세기 | `isoTop`+`n` | n층 이상 칸 수 | `minmax.countAtLeast` | 중~상 |

- **G-b 공식(브루트포스 대조 확정):** 줄(앞이면 x, 옆이면 z)마다 실루엣 높이 `sil[a]`·발자국 칸 수 `n[a]` 라 할 때
  `max = Σ sil[a]×n[a]` (모든 칸을 그 줄 높이까지) · `min = Σ (sil[a]+n[a]−1)` (한 칸만 그 높이, 나머지 1).
  **폭 조건:** `max−min = Σ(sil[a]−1)(n[a]−1)` 이므로 **'높이≥2 이면서 칸≥2'인 줄이 하나는 있어야** 문제가 성립(`hasRange` 로 재생성). 차이형(diff)은 제외 — 최대/최소만 묻는다.
- **G-c 공식(파워유형 유형9 확정):** `n층 이상 칸 수 = 위모양에서 n 이상인 칸 수`.
  - ⚠ **겨냥도만 주므로 숨은 열이 있으면 문제가 성립하지 않는다**(그 열의 높이를 알 수 없다). 따라서 **숨은 열이 없는 모양으로만 출제**한다 — 재생성으로 못 맞추면 `hidden.flattenHidden` 으로 직접 정리. **숨은 열 제거와 `n` 선택은 같은 루프에서** 해야 한다(따로 하면 `n` 을 찾느라 모양을 다시 뽑을 때 숨은 열이 되살아난다).
  - `n` 은 답이 **1 이상이고 발자국 전부는 아닌** 값만 고른다(`levelChoices`) — 자명한 문제 방지. 단위는 **"칸"**.
- **해설:** G-a = 위 그리드(불변/변동 칸) + 3D 최소·최대 모양 / G-b = **줄별 계산 내역**(높이×칸 = 최대, 높이+칸−1 = 최소) / G-c = 위에서 본 수 격자에 **조건 만족 칸 초록 강조**(`explain.hitCells`).

### 3.6.1 (구) 최소·최대 공통 사항
- **제시:** 위·앞·옆 **세 방향 본 모양**(2D 방향색 패널). **모양(`sh`)은 아예 전송되지 않는다** — `given.kind="sils"`로 실루엣 3종만 받는다(§3.12).
- **출제:** 문항마다 **최소 / 최대 / 차이(=최대−최소)** 무작위(`which`는 질문이라 전송, **정답 `rc`는 미전송**). 서버가 `core.reverseCounts`로 채점. **max>min 되도록 재샘플**(범위 있는 문제).
- **입력:** 숫자(개). **채점:** 서버 `answerKey.value`(보조로 `min`·`max` 동반).
- **해설(문제 맞춤 · `/grade`의 `explain`으로 구성):**
  - **위에서 본 모양 그리드:** 불변 칸(min==max)은 **고정 높이 숫자**, 변동 칸(min≠max)은 **색칠 + `최소~최대` 범위**. `explain.minMax`(서버 `reverseShapes`) 사용.
  - **3D 최소·최대 모양** 나란히(높이지도 → `createViewer` 2개). `viewer` 부재 시 2D 겨냥도 폴백.
  - 텍스트: 최대=작은 값까지 채움 / 최소=변동 칸을 낮춤 / 차이=최대−최소.

### 3.6.2 조작 H-a~d  ⭐ (H군 v0.10.1 · `type:'manip'`)

| sub | 이름 | 제시(`given.kind`) | 질문 | form | 서버 계산 | 지원 등급 |
|---|---|---|---|---|---|---|
| **H-a** | 더 쌓은 후 그리기 | `isoMark` | 조작 후 위·앞·옆 | `drawSil` | `opCandidates`+`drawCorrectCells` | 상 |
| **H-b** | 빼낸 후 그리기 | `isoMark` | 조작 후 위·앞·옆 | `drawSil` | 〃 | 상 |
| **H-c** | 정육면체 완성 | `isoTop` | 더 필요한 나무 수 | `num` | `manip.completeCube` | 중~최상 |
| **H-d** | 색칠한 정육면체 | `paintedCube` | k면 색칠된 나무 수 | `num` | `manip.paintedCubeCount` | 중~최상 |

- **H-a/H-b(조작 후 삼면도):** 열 단위 `h ± k`. 우리 모델이 높이지도라 **'빼면 위 큐브가 떨어지는' 문제가 없다.** 답은 `facesDraw` 와 같은 `drawSil` 집합 일치로 채점하고 입력 격자(`renderDrawInput`)도 그대로 재사용한다.
  - **성립 조건 4가지를 한 루프에서**(`manip.opCandidates`): ① 숨은 열 없음(겨냥도로 높이를 읽어야) ② 결과가 비어있지 않음 ③ **발자국이 연결 유지**(빼면 두 덩이로 끊길 수 있다 — 열 전체 제거 기준 11% 발생) ④ **삼면도가 실제로 달라짐**(가장 높지 않은 열을 건드리면 실루엣이 그대로라 답이 원본과 같아진다).
  - **격자 행 수 = 등급 `maxH`**(`given.maxH`). 조작 후 실제 높이로 그리면 **격자 크기가 정답을 흘린다.** H-a 는 `h+k ≤ maxH` 도 만족해야 격자에 표현된다.
  - **표시 열:** `cubenest-iso` 의 `ghost:false` 로 대상 열만 빨강, 나머지는 원래 색(해설용 ghost 모드와 구분).
  - 답이 삼면도 그리기라 격자 부담이 커서 **`facesDraw` 와 같은 이유로 최상 제외(상만)**.
  - **해설:** 조작 전 → 조작 후 겨냥도를 나란히 + 정답 삼면도.

- **H-c(파워유형 유형8):** `더 필요 = m³ − 현재 개수`. **`m` 은 격자(gx·gz·maxH)가 아니라 실제 점유 범위**(`max−min+1`)로 구한다 — 모양이 격자를 다 채우지 않으면 두 값이 달라지고, 격자를 쓰면 정육면체가 부당하게 커진다.
  - ⚠ **G-c 와 같은 이유로 숨은 열이 없어야 한다**(겨냥도를 보고 현재 개수를 세야 하므로). 이미 정육면체면 `need=0` 이라 출제 불가 → 두 조건을 한 루프에서 만족시킨다.
  - "한 변 k 인 정육면체" 변형은 `completeCube(hmap, k)` 로 지원(문제집에 둘 다 있다).
- **H-d(파워유형 유형12):** 꼭짓점(3면)=8 · 모서리(2면)=12(n−2) · 면(1면)=6(n−2)² · 속(0면)=(n−2)³, 합=n³. **n=2 는 전부 3면이라 출제 제외.** 한 변 n = 등급(중 3·상 4·최상 5), k 는 0~3 결정적 선택.
  - **제시 렌더:** 별도 도식이 아니라 `cubenest-iso` 에 **`paint` 옵션**을 더해 n³ 솔리드를 파란색으로 그린다 — 겉면만 보이므로 그 자체가 '겉면을 색칠한 정육면체'다.
- **해설:** H-c = 현재 모양 겨냥도 + `m³ − 현재` 계산 / H-d = 네 자리(속·면·모서리·꼭짓점) 개수를 모두 보여주고 물어본 것을 강조, 합이 n³ 임을 확인.

### 3.7 안 보이는 나무 A-a~f  ⭐ (6종 · v0.9.10~13)

> ~~구 '2정의'(교과=겨냥도 가림 / 사고력=이웃 가림, `edu` 분기)는 **폐기**~~ — 판정이 틀렸다. 아래 `visibleTop` 규칙으로 대체.

**[불변] 판정 규칙** (교과서 70쪽 1·2번 + 엣지 케이스 검증)
```
heightMap h(x,z) = 각 (x,z) 열의 높이
visibleTop(x,z) ⟺ h(x+1,z+1) <= h(x,z)      // 앞대각이 '더 높을 때만' 가려짐
숨은 열 hiddenColumns = { (x,z) : h(x+1,z+1) > h(x,z) }
```
- ⚠ **`<`가 아니라 `<=`** — 평지 2×2(동일 높이 대각)를 숨음으로 오판하던 버그를 잡은 규칙.
- 클라 `renderIso`가 뒤→앞으로 칠하므로 숨은 열은 **자동으로 가려진다**(§2.4 정렬 불변).

**6종 규격**
| sub | 이름 | 제시(`given.kind`) | 질문 | form | 서버 answerKey |
|---|---|---|---|---|---|
| **A-a** | 숨은 나무 판단 | `isoTop` | 숨은 나무 있나? | `bool` | `hasHidden` |
| **A-b** | 숨은 나무 칸 찾기 | `isoTop` | 숨은 칸 모두 | `markCells` | `hiddenColumns` |
| **A-c** | 개수(위+수) | `numTop` | 총 개수 | `num` | `count` |
| **A-d** | 개수(삼면도 최대최소) | `sils` | 최대/최소/차 | `num` | `reverseCounts` |
| **A-e** | 개수(층별) | `layers` | 총 개수 | `num` | `count` |
| **A-f** | 여러 가지 종류 | `isoTop` | 몇 **가지**? | `num` | `enumerateByVisible` |

- **난이도별 서브 pool:** 중 = A-a·b / 상 = +A-c·d·e / 최상 = +A-f. (랜딩에서 `sub`을 직접 지정하면 그 서브로 강제.)
- **생성 제약(regen):** A-b = 숨은 나무 ≥1 / A-d = `max>min` / A-f = 가짓수 2~6.
- **A-f 가짓수:** 숨은 열의 높이 `t ∈ [1, D−1]`(D=앞대각 높이) → `Π(D−1)`. **정확값**을 답으로 쓴다(cap 을 정답으로 반환하던 버그 제거, remap v0.7 §6.1). 밴드(2~6)를 못 맞추면 **정답을 자르지 않고** 밴드에 가장 가까운 문제를 고른다. **[성질] "5가지"는 구조상 불가**(5는 소수 → 자유도 5 = maxH≥6 필요, 현재 최대 maxH=5).
- **A-a 균형:** 랜덤 모양은 난이도가 오를수록 거의 다 '숨음 있음'(최상 99%)이라 **seed로 답을 반반 정하고 그쪽 모양을 만든다.** '없음'은 `flattenHidden`으로 직접 생성(대각 사슬을 단조 비증가로 → 발자국·연결·중력 불변), `raise`/`lower`를 반반 섞어 개수 편향까지 상쇄. 결과 "있어요" **49%**(전 난이도).
- **입력 위젯:** `bool`(있어요/없어요 2지선다) · `markCells`(위 격자 44px 탭, 행=z·열=x — 제시 그림과 같은 방향) · `num`(A-f는 단위 **"가지"**).
- **해설:** `/grade`의 `explain.cells`로 모양을 되만들어 **숨은 칸을 빨강 강조한 겨냥도**(A-a/b/f) · 최소·최대 모양(A-d) · 위에서 본 수 + 층별 세기(A-c/e).

### 3.8 채점 후 3D 해설 뷰어 (공통 인프라)
- 최소·최대(최소·최대 모양)·안 보이는 나무(강조)·**위·앞·옆 그리기(정답 모양)** 의 해설 뷰어는 `EXPVIEWS`로 관리, 문항 전환·결과 시 `disposeExpViews()`로 정리(WebGL 누수 방지).

### 3.9 연습장 (전 유형 공통)  ⭐
- **정적 HTML(`#scratch`)** — 문제·입력 아래, **해설 위**(해설은 캔버스 아래). run.js는 **1회 초기화**, 문제마다 `SCRATCH.show()`로 사이징·초기화(정적이라 유형별 `hide()`로 조절 가능 — `NO_SCRATCH` 예정).
- **자유 필기 canvas(아이):** 색연필 **검정·보라·초록·주황**, **지우개**(SVG), **되돌리기 5획**, **전체삭제**, **접기**(localStorage 저장).
- **툴바 표시 규칙:** 펼침 = 라벨 숨김·도구만 / **접힘 = 도구 숨김·접기 버튼+"연습장" 라벨만**.
- **좌표 정합:** 표시 시 `requestAnimationFrame`으로 `getBoundingClientRect` 사이징 + 그릴 때마다 현재 rect로 매핑 → **첫 문제 y오프셋 없음**. 고해상도(`×dpr`) 대응.
- **2레이어 + 첨삭(v0.9.6):** 캔버스 2겹 — **아이(`child`, 흰 배경) / 첨삭(`tutor`, 투명 오버레이)**.
- **벡터 저장(v0.9.11):** `store[idx] = {child:[stroke], tutor:[stroke]}`, `stroke = {c(색), w(폭/캔버스폭), e(지우개), p:[[nx,ny]…] 정규화 0..1}`. ~~PNG dataURL~~ 폐기 — 용량 8~35배↓·해상도 무관·리사이즈 무손실·되돌리기 무제한. `SCRATCH.get()`은 **벡터→PNG 변환**을 제공(문제지 임베드 호환).
  - **아이 잠금:** 문제 **제출(채점) 시 아이 레이어 read-only**(그리기·도구 비활성, `relock`) → 원본 보존.
  - **첨삭(선생님·학부모):** 제출 후 첨삭 바 노출 → **모의 로그인**(`cubenest_mock_login`, ✅ worksheets와 공용) → **첨삭 모드**(빨강·파랑, 굵기 동일). 아이 풀이 위에 다른 색으로. `첨삭 종료`로 해제.
  - **레이어별 저장·되돌리기 분리** — 나중에 필터링·구분 출력 가능. 실제 로그인 붙으면 `isLoggedIn()`만 Supabase 세션 체크로 교체.
- **지속(v0.9.4):** **리사이즈 시 그림 보존**(`fitKeep`: 크기 같으면 무동작 / 다르면 스냅샷→재설정→재그림) — **입력창(키보드) 열림/닫힘에도 안 지워짐**. **문항별 풀이 저장**(`store[idx]` PNG dataURL) — 문제 전환/새로고침에 유지. API `SCRATCH.get(idx)`·`all()`·`load()` = **worksheets PDF 병기·세션 지속의 데이터원**.

### 3.10 위·앞·옆 그리기  ⭐ (`facesDraw`, 4.3b)
- **제시:** 솔리드(3D 뷰어/2D 겨냥도, **dim 존중** — 인쇄용 2D 겨냥도 필요). **최상(5×5×5) 제외 = 4×4×4 이하**(겨냥도 높이 과장 완화). 랜딩·run 양쪽에서 최상 배제.
- **입력:** 위(gx×gz 발자국)·앞(gx×**maxH**)·옆(gz×maxH) **격자 칸 칠하기**. 격자 높이 = **레벨 maxH**(실제 최고 높이를 힌트하지 않음). 옆 = z 반전(옆에서 본 좌우).
- **채점:** `topSil/frontSil/sideSil` 정답과 **칸별 대조** — 맞게 칠함=초록·놓침=초록 테두리·잘못 칠함=빨강. 세 격자 모두 일치 = 정답. (검증: 정답 격자 = core 실루엣 면적 일치.)
- **해설:** **정답 세 방향 그림 + 3D 뷰어(세로 1열)**. 설명 텍스트 없음(그림·색 표시로 충분).
- (미구현) **가감 후 그리기**(수를 더하거나 빼서 변형 후) — **H-a(더 쌓은 후)·H-b(빼낸 후)로 재분류**되어 P1에서 `type:'manip'`으로 구현 예정. 이 절의 격자·채점 로직(`drawSil`)을 그대로 재사용한다.
- ⚠ **격자 높이는 반드시 레벨 `maxH` 고정** — 실제 최고 높이로 그리면 격자 크기가 정답을 흘린다. H-a/b에서도 **조작 후** 모양의 maxH가 아니라 cfg maxH를 써야 한다.

### 3.11 세션 지속 · 문항 이동  ⭐ (v0.9.4)
- **상태 모델:** `S.state[i] = {answered, ok, raw, key, explain}`
  - `raw` = 학생 제출 답(num=값 / bool=0·1 / mc=선택 / markCells=`["x,z"]` / hm=칸값 / draw=칠한 칸). `readAnswer`(캡처) ↔ `applyAnswer`(복원).
  - **`key`·`explain` = `/grade` 응답 보관**(v0.9.13). 색칠·해설의 출처가 서버 응답이라, 없으면 새로고침 후 이미 푼 문항의 채점 화면을 복원할 수 없다. 이미 제출해 본 정보라 저장해도 새로 새는 것은 없다(문항당 ~0.2KB).
- **이동:** `goTo(i)` — 이전/다음 자유 이동. 답한 문항 재방문 = `applyAnswer` + `submit(revisit)`로 답·채점·해설 재구성(**보관된 `key`·`explain` 사용, 재요청 없음**. 효과음·추적·저장은 새 제출만).
- **지속:** `saveSession`/`loadSession`. **키 = `seed·type·n·levels·edu·dim` + (`sub` 있으면 뒤에 덧붙임)** — `sub`을 뒤에 붙이는 이유는 앞에 끼우면 hidden이 아닌 기존 세션 키가 전부 바뀌어 진행 중이던 이어풀기가 끊기기 때문. 저장 = 위치·`state`·연습장(`_sc`, 용량 초과 시 연습장만 생략). `beforeunload`에도 저장.
- **다시풀기:** 세션·저장 초기화 후 처음부터(같은 seed=같은 문제).
- **팔레트·이동(v0.9.5):** `.qnav`(카드 상단) = 번호 팔레트 + 결과보기. 팔레트 칩 = 정오/미풀이 색(빈칸=미풀이) · 클릭 `goTo` · **가로 스크롤만**(윈도우 스크롤 유발 금지 → 흔들림 없음) · 현재 칩 중앙 정렬. `goTo`는 **즉시 스크롤 + 헤더 토글 억제**.
- **결과보기 활성 로직(v0.9.5):** **`allDone`(모든 문항 answered) 기준** 활성 — 순서 무관, 마지막 한 문항을 푸는 순간 활성. 비활성 시 **안 푼 번호를 툴팁으로 안내**(`안 푼 문제 N개: 1,3,5번`).
- **'다음' 로직(v0.9.5):** 답한 문항에서 `allDone` 아니면 **[다음 →] = `firstUnanswered`(안 푼 다음 문항, 끝이면 앞쪽으로 순환)**. → 건너뛴 문항으로 반드시 도달. 모두 풀면 **[결과 확인]**(상단 결과보기와 중복, 편의).
- **진행바:** `.bar` 길이·"푼 문제 N/총" = **실제 푼 문항 수**에 비례(`updateProgress`), 문항 번호 아님.

### 3.12 채점 아키텍처 · 정답 은닉  ⭐ (v0.9.13 신설 · 마스터 §6.7)

> **왜:** 클라가 `sh`로 정답을 재계산해 색칠했는데, 그러려면 모양(=정답의 원천)을 들고 있어야 해서 은닉이 원천적으로 불가능했다. 게다가 `_gp`에 정답이 그대로 실려 나갔다.

- **`/generate` 응답에 정답 없음.** 제거된 필드: `q.correct`(facesMc 정답 번호) · `q.rc`(minmax·A-d의 min/max) · `q.kinds`(A-f 정답). `present`(모양 중복 전송, 클라 소비 0)도 폐지.
  - facesMc 보기(`opts`)는 계속 보낸다 — 정답 인덱스는 서버가 **같은 rng 시드로 재생성**하므로 보낼 필요가 없다.
- **제시물만 전송(`given`):** 3D 회전이 풀이에 불필요한 유형(minmax·hidden)은 `sh` 대신 `given`.
  ```
  _gp = { level, type, sub?, which?, given }        // sh 없음
  given.kind
    sils   (minmax·A-d) : { gx,gz, sils:{top,front,side} }
    numTop (A-c)        : { gx,gz, heights:{"x,z":h} }
    layers (A-e)        : { gx,gz, layers:[["x,z"…] …] }   // 1층부터
    isoTop (A-a/b/f)    : { gx,gz, iso:"<svg>", top:<topSil> }  // 서버가 그린 겨냥도
  ```
  클라는 `givenShape(given)`으로 렌더용 부분 모양을 만든다 — `isoTop`·`sils`는 **발자국까지만** 알 수 있고 숨은 열의 높이는 오지 않는다(`_partial` 표시, 계산에 쓰면 안 됨).
- **채점·색칠·해설의 단일 출처 = `/grade` 응답.**
  | form | 색칠 근거 |
  |---|---|
  | `num`·`bool` | `answerKey.value` (minmax·A-d는 `min`·`max` 동반) |
  | `mc` | `answerKey.correct` |
  | `hm` | `answerKey.grid` |
  | `draw`·`markCells` | `answerKey.cells` |
  해설 그림은 `explain`(`cells`·`gx`·`gz`·`maxH`·`edge`·`hiddenCols`·`minMax`)으로 모양을 되만들어 **기존 해설 렌더러를 그대로 재사용**한다(제출 후이므로 모양을 밝혀도 된다).
- **로컬 폴백 채점 제거.** `/generate` 없이는 세션이 시작조차 안 되므로 지킬 오프라인 세션이 없다.
- **실패 시 재시도:** 종전엔 네트워크 호출 **전에** `answered`를 세팅해 실패해도 문항이 소진됐다. 이제 **성공했을 때만** 소진하고, 답·입력 상태를 유지한 채 안내를 띄운다(오프라인 / 레이트리밋 / 서버오류 3갈래, `.ansnote` 재사용).
- **[한계·수용] 3D 회전 6종은 은닉하지 않는다.** `count`·`volume`·`surface`·`heightmap`·`facesMc`·`facesDraw`는 **돌려서 가려진 나무를 확인하는 것이 곧 풀이 과정**이라 형상이 클라에 있어야 한다. 이 6종은 직접 정답 필드만 제거.
- **[원리] 답이 '보이는 그림'만의 함수인 유형은 그림을 주는 것이 은닉의 최선.** A-a/b/f의 답은 숨은 열의 **실제 높이와 무관**하다(`enumerateByVisible`도 앞대각 높이 D만 쓴다). 따라서 서버 SVG에 가려진 큐브 좌표가 남아도 답이 새지 않으며, 치터도 학생과 똑같이 그림을 분석해야 한다.

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
- 산출: `quiz/index.html` · `quiz/run/index.html` + **`quiz/run/run.js`** + `quiz/run/api-client.js`. **상대경로만**(2층이라 `../../assets/…`).
- 공용 자산: `assets/css/*` · **`assets/js/cubenest-{core,iso,viewer}.js`**(0.3.0 · 0.1.0 · 0.2.3) · `auth.js`·`mydata.js`·`consent.js`. OG 절대 URL.
- **서버:** `supabase/functions/{generate,grade}/index.ts` + `_shared/*`. **`_shared` 를 건드리면 `generate`·`grade` 둘 다 재배포**(함수 단위 배포라 한쪽만 올리면 어긋난다). 재배포 후 `config.toml`의 `verify_jwt=false` 유지 확인.
- ~~`assets/js/quiz/gen-config.json`~~ · ~~`assets/js/cubenest-gen.js`~~ **삭제됨**(서버 전용).
- 로컬 확인: **`127.0.0.1:5500` 고정**(Edge Function CORS 허용 오리진 — 다른 포트면 `/generate`·`/grade`가 막힌다).
- 오리진 공유: GA4·동의. 흔적 `quiz_*`·`quiz_run_*`·`run_*.js` → 커밋 시 각 배포명.

### 4.6 worksheets 연동 (PDF 문제지)  ⭐ (v0.9.4)
- **경계(v0.10.3 확정):** **레이아웃·인쇄 = worksheets / 문제 그림·정답 표기 = quiz.** worksheets 가 19종의 제시물 분기를 다시 갖지 않도록(§8.1 표류) **quiz 가 화면 렌더러로 그린 그림(SVG/HTML)을 payload 에 실어 보내고**, worksheets 는 배치·인쇄만 한다. → 도형 렌더러 공용 모듈 추출이 **필요 없어졌다.**
- **전달:** 결과 화면 **📄 문제지 만들기** → `buildWorksheetPayload()` → **`localStorage['cubenest_ws_payload']`** 에 쓰고 `../../worksheets/?from=quiz` 로 이동.
  - ⚠ `sessionStorage` 는 쓸 수 없다 — `noopener` 새 탭은 새 브라우징 컨텍스트 그룹이라 물려받지 못한다.
  - ⚠ **같은 탭 이동**이다. payload 생성에 `await` 가 걸려 클릭의 사용자 제스처가 만료돼 `window.open` 은 사실상 항상 차단된다. 퀴즈는 seed URL + 세션으로 복원되고 문제지의 **'← 퀴즈로'**(`meta.quizUrl`)가 되돌린다.
  - ⚠ worksheets 는 payload 를 **읽고 지우지 않는다** — 지우면 새로고침·뒤로가기에서 문제지를 잃는다. quiz 가 매번 덮어쓰므로 잔여물도 쌓이지 않는다.
- **PDF = 브라우저 인쇄(`@media print`) + 'PDF로 저장'.** 빌드 없음·정적 호스팅이라 jsPDF 류는 한글 폰트 임베딩(수 MB)이 걸림돌이고, 제시물이 전부 SVG 라 인쇄 시 **벡터 그대로** 나간다. `print-color-adjust:exact` 필수(빠지면 격자·실루엣 배경이 사라진다).
- **로그인 게이트:** 미리보기는 보이되 **인쇄·저장은 로그인 필요**(마스터 §6.3 worksheets=필요). 도구의 산출물이 게이트 대상이다.
- **payload(v0.10.3):** `{meta:{title,grade,type,levels,n,score,seed,quizUrl,date,source}, problems:[…]}`
  ```
  problems[i] = { n, type, sub, level, edu, ask,
                  figure,       // 제시물 그림 HTML(SVG) — quiz 렌더러 산출물
                  answerArea,   // 종이 답란 HTML(폼별: 숫자칸 / 고르기 / 격자 / 빈 삼면도)
                  answerText,   // 정답지 한 줄 표기(서버 answerKey 기반)
                  answerFigure, // 정답이 그림인 유형(drawSil)의 정답 그림
                  shape,        // F2 직렬화(후속 기능용)
                  correct, scratch:{child,tutor} }
  ```
  - `figure`·`answerArea` 는 화면 위젯 마크업을 **비대화형으로 재사용**한다 — worksheets 는 같은 클래스(`viewer`·`pv`·`threeviews`·`markgrid`·`hmgrid`·`draw`/`dgrid`/`dcell`)만 스타일하면 된다.
  - ⚠ 화면 렌더러는 문항이 하나라 `id="iso"` 를 쓰지만 문제지엔 여러 문항이 들어가 **id 가 중복**된다 → `figureOf` 가 클래스로 바꿔 넘긴다.
  - ⚠ `renderSil` 의 SVG 는 viewBox 만 있고 고유 폭이 없어 **flex 안에서 0 으로 찌그러진다** → worksheets 정답지에서 폭을 명시한다.
- **정답의 단일 출처는 서버 `answerKey`**(§3.12). quiz 는 그것을 표기로 옮길 뿐 재계산하지 않는다.
- ~~`shape`가 `null`일 수 있다~~ — **결과 화면은 전 문항 채점 후에만 도달**하고 '문제지 만들기'는 결과 화면에만 있으므로, 모든 문항이 `explain` 을 갖는다. **quiz 위임 경로에선 `null` 이 발생하지 않는다.** (worksheets 독립 생성기를 만들 때 다시 검토할 것.)
- **로그인:** 첨삭·저장·worksheets 공통 **모의 로그인 키 `cubenest_mock_login`** 재사용(실 로그인 = Supabase OAuth·RLS로 교체).
- **문서:** 연동 요청서 **`worksheets_integration_request_quiz_260814.md`**(2레이어 개정) · worksheets 스펙 `worksheets_기능개발명세서 v0.2.0`(동일 오너).

### 4.7 worksheets 독립 생성기 · 혼합 · URL 재현  ⭐ (v0.11.1)
quiz 를 거치지 않고 worksheets 에서 바로 문제지를 만드는 경로. **quiz 위임 경로(§4.6)는 그대로 두고 나란히 존재**한다.

- **서버 `/worksheet`** (`supabase/functions/worksheet/`) — `/generate` 와 달리 **`answerKey` 를 함께** 준다(정답지). 그래서 **`verify_jwt=true`**(로그인 필수)이고 rate limit 도 별도(`rate.ts` 의 `worksheet`: 쿠키 6/분·60/시, IP 30/분·300/시). `/generate`·`/grade` 는 무료 익명 플레이라 `false` 유지 — **여기만 다르다.**
  - 요청: 단일 `{theme, sub?, n, levels, seed?}` 또는 혼합 `{mix:[{theme,sub?,n}], levels, seed?}`. **총 문항 30 상한.**
  - **혼합의 시드:** 항목마다 `seed + "#" + i` 로 **독립 스트림**을 쓴다. 같은 seed → 항상 같은 문제지.
  - ⚠ `theme` 은 단일일 때만 필수다. 가드를 mix 처리보다 **앞에** 두면 혼합 요청이 전부 400 으로 막힌다(실제로 한 번 겪음).
- **URL = 문제지 사양.** `?t=<theme[:sub]:n>`(반복) `&lv=<난이도코드>` `&seed=`. 생성 직후 `history.replaceState` 로 주소창에 박는다.
  - **같은 URL = 같은 문제지** → 새로고침·공유·`/my` '열기'가 전부 이 한 가지 장치로 해결된다. 별도 저장소가 필요 없다(정답지는 로그인 후 서버가 다시 만들어 준다).
  - ⚠ 단일 유형이면 `mix` 가 아니라 **평면 요청**으로 보낸다 — 그래야 quiz 위임분이 남긴 seed 로도 똑같이 재현된다(`#0` 접미사가 붙으면 다른 문제가 나온다).
  - ⚠ 베이스가 둘이다 — 주소창은 `./?`, `/my` 의 '열기'는 `../worksheets/?`.
- **`/my` 적립:** 독립 생성분만 worksheets 가 적립한다(quiz 위임분은 quiz 가 이미 적립). `meta.url` 을 남기면 `mydata.list()` 가 **`openUrl` 로 승격**해 '열기' 버튼이 생긴다.
  - ⚠ **id 를 URL 에서 결정적으로 뽑는다**(`ws_<djb2(url)>`). 안 그러면 '열기'·새로고침마다 목록에 사본이 쌓인다.
- **오류 표시:** `api-client.js` 는 서버의 `error`·`detail` 을 **둘 다** 실어 던진다(`e.serverError`). 예전엔 `detail` 만 읽어 400 사유가 클라에서 사라졌고, 위 mix 가드 버그의 진단이 늦어졌다.
- **`shape:null` 이음새(§4.6 미결) 해소:** 독립 생성기는 quiz payload 를 안 쓰고 서버 응답에서 바로 그린다. `given`/`sh` 로 모양을 복원해 `cubenest-figures` 에 넘기므로 `shape` 직렬화에 의존하지 않는다.
- **도형 렌더러 공용화:** 독립 경로에는 quiz 화면 렌더러가 없으므로 `assets/js/cubenest-figures.js` 로 **추출**했다(§2.4). quiz·worksheets 가 같은 함수를 부른다 — §4.6 의 "추출이 필요 없어졌다"는 **위임 경로에 한정된 판단**이었다.

---

## 5. 관리

### 5.1 수용 기준
- **계산:** 5큐브 → 개수 5·부피 5·겉넓이 22 등 골든. **겉넓이 오목 포함** `2×(위+앞+옆)=6N−2쌍`. **최소·최대** `min≤실제≤max`.
- **생성기:** 같은 seed → 같은 문제(`/generate`와 `/grade`의 재생성이 일치해야 채점이 성립). `sub` 강제 지정이 100% 반영.
- **재현성·이어풀기:** 같은 seed → 같은 세트. 새로고침 시 위치·답·**채점 화면(색칠·해설)**·연습장 복원. URL 공유·다시풀기로 동일 문제.
- **뷰어/계산:** 공용 모듈 로드 시 정상, `viewer` 부재 시 2D 폴백. **연습장 첫 문제 오프셋·리사이즈 지움 없음.**
- **무결성:** 무로그인·상대경로 · quiz는 PDF 미생성(worksheets 위임).
- **정답 비누출(v0.9.13 신설·회귀 금지):** `/generate` 응답 어디에도 정답이 없어야 한다. 회귀 검사 = 전 유형에 대해 `_gp`에 금지 필드(`correct`·`rc`·`kinds`·`hasHidden`·`hcols`)가 없고, `answerKey` 값이 페이로드에 문자열로 등장하지 않으며, minmax·hidden은 `sh` 미포함.
- **만점 답안 채점(회귀):** 전 유형에 대해 서버 `answerKey`를 그대로 제출하면 `correct:true`. (유형 추가 시 반드시 이 검사를 통과시킬 것.)
- **채점 실패:** 네트워크 차단 상태로 제출 → 문항이 소진되지 않고 답이 유지되며, 복구 후 재제출이 성공.

### 5.2 버전 계획
`v0.9.13`(안 보이는 나무 6종·정답 은닉·서버 단일 채점) → **`v0.10.0`(P1 잔여 = G 최대·최소 확장 / H 조작)** → `v0.11.0`(혼합 세션·오답만 다시 풀기) → `v1.0.0`(기본채점+사고력 출시).

### 5.3 결정 로그
build_tier · 실행 별도 `run/` · **로직 분리(`run.js`)** · **공용 모듈(core 0.3.0·iso 0.1.0·viewer 0.2.3, §5.1·§8.1)** · **생성기·정답 = 서버 전용(Edge Function, 클라 미배포)** · 시드 재현·공유·**이어풀기·문항 이동(팔레트)** · **실행 UX: 번호 팔레트(가로 스크롤·정오색·클릭 이동)+결과보기 한 묶음·결과보기 allDone 기준(안 푼 번호 안내)·'다음'=안 푼 다음 문항 순환·진행바=푼 수 비례·헤더 스크롤 슬라이드·중복 정보 정리·[hidden] 잔상 차단** · 답안·애니메이션 동시·효과음·음소거 · 결과 버튼+공유+**문제지(worksheets 위임)** · **겉넓이 = core.stats, ①위·앞·옆 / ②'다른 해설' 병기 + 오목 밴딩(최상 5/5/5)** · **최소·최대(min/max/차이+위 그림+3D)** · **안 보이는 나무 6종 A-a~f(visibleTop `<=` 규칙·A-f 정확 가짓수·A-a 균형)** · **정답 은닉(§3.12: /generate 무정답·given 전송·/grade 단일출처·재시도)** · **위·앞·옆 그리기(격자·칸별·maxH·최상 제외·해설 3D)** · **연습장(전 유형·정적·아이 4색(검정·보라·초록·주황)·지우개·undo5·접기·리사이즈 보존·문항별 저장·2레이어[아이 잠금/첨삭 빨강·파랑]·모의 로그인 게이트)** · facesMc 무작위·옆 반전 수정 · 저장 로그인 게이트(RLS) · GA4 · 외부 문항 미복제 · **quiz+worksheets 동일 오너·엄격 경계.**

### 5.4 미결
- **worksheets 구현**(`fromQuiz` PDF·문제 그림 렌더 공유·정답지·PDF 엔진) — 스켈레톤 `worksheets_기능개발명세서 v0.2.0`.
- **'가감 후 그리기' → H-a/H-b로 재분류**(P1 · G·H 인수인계서 §3.3) · 연습장 **유형별 on/off**(`NO_SCRATCH`).
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
- ~~서버가 `_gp`(렌더용 질문 데이터: sh·which·rc·hmode·hcells·facesMc opts)를 함께 반환~~ → **v0.9.13에서 대체됨.** `rc`·`hmode`·`hcells`는 정답이거나 폐기된 필드라 더 이상 나가지 않는다. 현행 `_gp` 계약은 **§3.12** 참조.
- **검증**: 8유형 생성·렌더·**서버 채점**·해설 실동작 확인. 결정성(seed) 유지.
- **정적 파일 삭제 완료**: `assets/js/cubenest-gen.js`·`assets/js/quiz/gen-config.json` 제거(클라 Network 미로드 확인). **생성기가 클라에서 완전히 사라짐.**
- **로딩 UX(큐브 버디)**: 문제 로딩(generate) 시 채점 캐릭터(Good!/Oops!)와 **동일 톤**의 나무 큐브 버디 + 영어 **'Ready~'**(`.fxword`와 같은 폰트·900·흰 외곽선, 색=액센트). 로드 완료 즉시 퀴즈 표시. **제출(grade) 시엔 미표시**(사용자 선택).
- **grade 지연 완화**: grade는 `gsig`로 보호되고 유효 gsig는 rate 걸린 generate에서만 나오므로, grade의 rate DB 왕복 **제거**(pending 단축). generate rate는 유지.
- **랜딩 버그 수정**: `quiz/index.html`의 `shadow` 글리프 누락(`G[t.glyph] is not a function`) → `shadow` 추가 + `G[t.glyph]?...:''` 방어.
- **잔여(v0.9.13 기준 갱신)**: ~~은닉 present `isoImage`(서버 renderIso)~~ **완료**(§3.12 `given.isoTop.iso`) · ~~안 보이는 나무 `hiddenCells` 정의 수정~~ **완료**(§3.7 6종) · **P1 잔여 = G(최대·최소 확장)·H(조작)** · P2 = J(폴리큐브) · worksheets 실구현(§4.6 `shape:null` 이음새 포함).
- **관련 문서**: `quiz_edge_function_plan_260815_v0_2.md`(결정·아키텍처) · `quiz_edge_deploy_guide_260815.md`(배포) · `supabase_rate_schema_260815.sql` · `edge/`(함수 스켈레톤).

### 6.6 다음 (단계)
P0 마스터 §7.3 분류 + §5·§6 인증·모듈 개정 → P0.5 실 Edge Function(Supabase·gen 서버 이전·정적 config 폐지) → P1 리매핑(9종)+measure → P2 저비용 신규 → P3 열거형 → P4 3D 전용. 랜딩 UX(드릴다운/프리셋) 병행. **보류:** 안 보이는 나무(`hiddenCells`) 정의 수정(서버 연동과 독립).

---

> **버전 정합(v0.9.14 기준):** quiz `?v=` = **core 0.3.0 · iso 0.1.0 · viewer 0.2.3** / 명세서 **v0.9.14** / 마스터 **v1.8.3**(§6.7 정답 은닉 규약) / 분류 정본 **cubenest_remap v0.7** / 유형지도 **v0.3** / worksheets 스펙 v0.2.0.
> **클라에 없는 것:** ·(서버 전용) — 이 문서에서 클라 모듈로 기술하던 옛 서술은 v0.9.14에서 정정했다.

> 해소: ~~겉넓이 오목 난이도 밴딩~~(v0.9.1 반영) · ~~count−pairs 병기 정책~~(마스터 v1.5.2 정합) · ~~뷰어·펼쳐보기 공용 모듈 추출~~(v0.9.0 반영).
