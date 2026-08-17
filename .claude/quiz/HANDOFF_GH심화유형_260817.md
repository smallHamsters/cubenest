# CubeNest — G(최대·최소) · H(조작) 심화 유형 · Claude Code 인수인계 (설계→구현)

> **작성:** 2026-08-17 · **인계:** quiz·gen/분류 담당(채팅) → **인수:** Claude Code
> **선행:** 안 보이는 나무 6종 완료·배포(커밋 d6d2a6a·65d86b5·5554076). 그 검수에서 **/generate 스키마가 바뀌었으니(§1.2) 반드시 그 패턴 위에 구현**.
> **범위:** P1 잔여. **Phase 1 = G(최대·최소 확장)**, **Phase 2 = H(조작)**. J(폴리큐브)=P2, I(방향)·K(프로그램)=제외.
> **성격:** 이 문서는 hidden처럼 완성 코드가 아니라 **설계 스펙**이다. Claude Code가 교과서/문제집 대조로 알고리즘을 확정·검증한다. "확정"과 "검증필요"를 구분해 표기.

---

## 0. 오리엔테이션
1. 이 문서 §1(컨텍스트·**새 스키마**) → §2(G) → §3(H).
2. **필독 선행 문서**:
   - `HANDOFF_안보이는나무6종_260817.md` — 아키텍처·배포 함정(그대로 유효).
   - Claude Code 검수 회신(직전) — /generate 스키마·cubenest-iso·no-leak 원칙.
   - `cubenest_quiz_type_map_260816_v0_3.md` §G·§H — 원 유형 근거(문제집 실측).
   - `cubenest_remap_260816_v0_7.md` — 난이도 3축·6종 검수 반영.
   - 마스터 `CubeNest_00_마스터_공통_v1_8_1.md` §4 [불변] 계산·§0.2 파워유형 공식.

---

## 1. 컨텍스트 & 반드시 지킬 새 아키텍처

### 1.1 흐름(재확인)
`랜딩 → run(?type&sub&lv&n) → api.generate → generate/index.ts → buildProbs → gen.genSession → genProblem → adapter.questionFor(_gp) → run 렌더`. 채점은 `run → api.grade → grade/index.ts → answerKeyFor + checkAnswer + explainFor`.

### 1.2 ⚠ 새 스키마 (hidden 검수에서 확립 — G·H도 이 규약을 따른다)
- **정답 비누출:** `questionFor`(=_gp)에 정답이 될 수 있는 값(정답 보기번호·rc·kinds·완성수 등) **금지**. G·H의 정답(min/max, 완성 나무 수, 색칠 수, 조작후 실루엣)은 **오직 /grade가** 계산.
- **제시는 `given`으로:** 3D 회전이 풀이에 불필요한 유형은 `sh` 대신 `given`을 보낸다.
  ```
  _gp = { level, type, sub?, which?/op?, given }
  given.kind = "sils" | "numTop" | "layers" | "isoTop" | (신규 필요시 추가)
    sils   : { gx,gz, sils:{top,front,side} }
    numTop : { gx,gz, heights:{"x,z":h} }
    layers : { gx,gz, layers:[["x,z"...] ...] }   // 1층부터
    isoTop : { gx,gz, iso:"<svg>", top:<topSil> }   // 서버가 그린 겨냥도
  ```
  - **3D 회전 6종(count·volume·surface·heightmap·facesMc·facesDraw)만 sh 유지**(회전이 풀이과정). G·H는 대부분 겨냥도/삼면도/위모양 제시 → **given** 사용.
- **채점·색칠·해설 단일출처 = /grade 응답**(answerKey + explain). **로컬 폴백 채점 없음**. 실패 시 문항 미소진·재시도.
- **cubenest-iso.js**(신규 공용, 클라 assets/js/ + 서버 _shared/): 겨냥도 렌더 단일 지점. **(x+z) 오름차순 정렬=은닉이므로 정렬 불변**. G/H가 겨냥도를 그릴 땐 이 모듈 사용.
- **_shared 규약:** 신규 계산 모듈은 원본 IIFE + 맨끝 `export const x = globalThis.CubeNest.x`, gen-modules.ts에 값 import(로드순서: core→genConfig→hidden→(신규)→gen). 누락 시 503.

### 1.3 재사용 계산 (마스터 §4 · core)
- `reverseCounts(cs)`→{minCount,maxCount,hidden} · `reverseShapes(cs)`→min/max shape · `silhouettes(cs)`→{top,front,side} · `viewHeights(cs)`→{front,side} · `heightMap(cs)`→{"x,z":h}.
- gen: `reshape(sh, hmapObj)`(신설, 높이지도→shape 재계산) · `genShape(rng,cfg)`.
- hidden 모듈: `visibleTopFootprint`·`hiddenColumns`·`enumerateByVisible`·`flattenHidden`.

### 1.4 난이도(remap v0.7 §2)
난이도 라벨 ⊥ 격자 스케일. 밀도 U자. 유형별 지원등급·프리셋. G·H도 계산복잡도별 지원등급을 정할 것(아래 각 유형에 초안).

---

## 2. Phase 1 — G. 최대·최소 (심화 핵심)

> G-a는 **이미 존재**(현행 `minmax`, hidden 검수 때 given=sils로 재작성됨). G는 이를 **G군(3종)으로 확장**: +G-b, +G-c.
> gen `type:'minmax'`에 `sub` 축을 추가하는 방식 권장(hidden과 동일 패턴): sub=G-a/G-b/G-c.

| sub | 이름 | 제시(given) | 질문 | form | 정답 계산 | 상태 |
|---|---|---|---|---|---|---|
| **G-a** | 삼면도 최대·최소 | sils(위·앞·옆) | 최대/최소/차 | num | `reverseCounts` | ✅존재(minmax) |
| **G-b** | 위+앞(또는 옆) 최대·최소 | 위모양 + 앞 **또는** 옆 실루엣 | 최대/최소 | num | **신규 §2.1** | ❌신규 ◎ |
| **G-c** | 층 조건 개수 | 겨냥도 + "n층 이상" | 최대/최소(또는 개수) | num | **신규 §2.2** | ❌신규 ○ |

### 2.1 G-b 알고리즘 〔검증필요〕
- **제시:** 위모양(footprint=어느 열이 있는지) + **한 방향 실루엣**(앞 `front[x]=max_z h(x,z)` 또는 옆 `side[z]=max_x h(x,z)`).
- **정답(앞 실루엣 기준):**
  - `maxCount` = Σ_{(x,z)∈footprint} front[x]  (모든 열을 그 x의 앞 높이까지 채움; 실루엣 위배 없음).
  - `minCount` = Σ_x [ front[x] + (그 x의 footprint 열 수 − 1)×1 ]  (각 x마다 한 열만 front[x]에 도달, 나머지는 1).
  - 옆 실루엣이면 x↔z 대칭.
- **⚠ Claude Code 검증:** 위 min/max 공식이 문제집(수학의신 img1·8·최고수준) 정답과 일치하는지 실측 대조. footprint에 그 x-열이 하나도 없을 때/실루엣과 footprint 모순 케이스 가드.
- **생성 제약:** max>min(범위 有)이도록 regen. which=max|min(diff는 선택).

### 2.2 G-c 알고리즘 〔검증필요〕
- **제시:** 겨냥도(iso, given=isoTop) + 조건 "n층 이상".
- **질문/정답 후보(문제집: 수학의신 img8 1~4):**
  - (개수형) "n층 이상인 칸(열)은 몇 개?" → `count( h(x,z) ≥ n )`. **파워유형 공식 §0.2: n층=위모양 n이상 칸수**.
  - (최대최소형) 삼면도+조건에서 n층 이상 열 수의 최대/최소.
- **권장 1차 구현:** 개수형(겨냥도 given, `count(h≥n)`)이 가장 단순·확실. 최대최소형은 2차.
- **⚠ 검증:** n 범위(2..maxH), 조건 만족 열이 항상 ≥1이도록 생성.

### 2.3 G 통합 포인트
- **gen:** `minmax` 분기에 sub(G-a/b/c) 추가. G-a=현행 reverseCounts. G-b=위+한방향, G-c=층조건. out에 sub·which·정답보조(min/max는 서버 재계산이므로 **_gp엔 넣지 말 것**).
- **adapter:**
  - `answerKeyFor('minmax')`: sub 분기. G-a=reverseCounts, G-b=§2.1, G-c=§2.2. 전부 `{type:'num', value, min?,max?,which}`.
  - `questionFor`: given 구성. G-a=sils(기존), G-b=**신규 given.kind="topOneSil"**{top, side:'front'|'side', bars} , G-c=isoTop + `n`(조건은 정답 아님, 제시 가능). **정답(min/max) 미전달**.
  - `explainFor`: G-a=reverseShapes(기존). G-b/c=min·max 도달 예시 shape(gen.reshape로 구성) + 설명.
- **run:** given.kind별 렌더. topOneSil = 위모양 격자 + 한 실루엣 bars. G-c = 겨냥도(cubenest-iso) + "n층 이상" 안내. 답=num(기존 위젯).
- **지원등급(초안):** G-a 중~최상 / G-b 상~최상 / G-c 중~상.

---

## 3. Phase 2 — H. 조작 (빼내기·더쌓기·완성·색칠)

> 전부 신규. gen `type:'manip'`(신규) + sub=H-a/b/c/d 권장. H-c·H-d가 ◎(교과 빈출·계산 명확), H-a·b는 ○.

| sub | 이름 | 제시(given) | 질문 | form | 정답 계산 | 우선 |
|---|---|---|---|---|---|---|
| **H-c** | 정육면체 완성 | 겨냥도+위모양(isoTop) | 더 필요한 나무 수 | num | §3.1 | ◎ |
| **H-d** | 색칠 정육면체 | 큰 정육면체 n³ 겉면 색칠(그림) | k면 색칠 나무 수 | num | §3.2 | ◎ |
| **H-a** | 더 쌓은 후 삼면도 | 겨냥도+"㉠ 열에 +k" | 앞/옆 모양 | drawSil | §3.3 | ○ |
| **H-b** | 빼낸 후 삼면도 | 겨냥도+"빨강 −k" | 앞/옆 모양 | drawSil | §3.3 | ○ |

### 3.1 H-c 정육면체 완성 〔확정 계산·형상 검증필요〕
- **정답:** 목표 정육면체 한 변 `m = max(gx, gz, maxH)`. 더 필요 = `m³ − count(sh)`. (파워유형 §0.2: 정육면체완성=최소−현재.)
- **⚠ 검증:** 문제집이 "가장 작은 정육면체"를 목표로 하는지(=m=max dim) 확정. 일부는 "한 변 k인 정육면체" 명시 → 그 경우 `k³−count`(k는 제시). 두 변형 다 지원 권장.
- **생성:** 완성수 ≥1(이미 정육면체면 제외). given=isoTop + 위모양. 난이도=격자·현재 밀도.

### 3.2 H-d 색칠 정육면체 〔확정 계산·제시 렌더 필요〕
- **고전 "색칠된 정육면체" 문제.** 한 변 n인 정육면체를 쌓아 겉면 전체 색칠 후 낱개로 분해:
  ```
  paintedCubeCount(n, k):
    k=3 (세 면): 꼭짓점 = 8
    k=2 (두 면): 모서리 = 12(n−2)
    k=1 (한 면): 면   = 6(n−2)²
    k=0 (색 없음): 속  = (n−2)³
    합 = n³
  ```
- **제시:** 큰 정육면체 n³ 그림(색칠). **신규 렌더 필요**(cubenest-iso로 n³ 큐브 + 색칠 표현, 또는 도식). 질문 = "k면 색칠된 나무 몇 개"(k 랜덤 0~3).
- **난이도:** n=3(중)·4(상)·5(최상). n=2는 전부 3면(자명)→제외.
- **⚠ 검증:** n≥3에서만 의미(속·면·모서리 구분). 표시 방식(색칠 부위 강조) 문제집(수학의신 img5) 대조.

### 3.3 H-a/H-b 조작 후 삼면도 〔검증필요〕
- **H-a:** 겨냥도 + "㉠로 표시된 열에 k개 더 쌓기" → 결과 shape의 **앞/옆(또는 삼면) 그리기**(drawSil, facesDraw 재사용).
- **H-b:** 겨냥도 + "빨강 표시된 열(또는 셀)에서 k개 빼기" → 결과 삼면도.
- **알고리즘:** `perturbThenViews(sh, ops)` — ops로 특정 열 높이 ±k(gen.reshape로 hmap 수정→shape), 그 후 `silhouettes` 재계산. 정답 = 변경 shape의 drawSil cells.
- **제시:** 원본 겨냥도(isoTop) + 표시 열(마커) + 지시문(+k/−k). **표시 열은 정답 아님**(제시 가능). 정답(변경후 실루엣)은 /grade만.
- **주의:** 빼기 시 열 높이 ≥0·연결/중력 유지(빼면 위 큐브 낙하? 교과는 보통 열 단위라 단순 −k). 규칙 문제집 대조.

### 3.4 H 통합 포인트
- **gen:** `type:'manip'` 신규. sub별 생성(H-c: 완성수≥1 / H-d: n·k / H-a·b: 표시열·k). out=sub·op·(H-d)n,k·(H-a/b)targetCol,delta. **정답값 _gp 금지**.
- **신규 계산 모듈 `cubenest-manip.js`**(isomorphic, _shared+클라): `completeCube(sh, m?)`·`paintedCubeCount(n,k)`·`perturbThenViews(sh, ops)`. hidden 모듈과 동일 패턴(+export, gen-modules import).
- **adapter:** answerKeyFor('manip') sub 분기(전부 num except H-a/b=drawSil). checkAnswer는 num·drawSil(기존 집합일치) 재사용. questionFor=given(isoTop/색칠도식) + 지시(n/k/마커). explainFor=완성/색칠/조작 후 shape 도해.
- **run:** given 렌더 + 색칠 정육면체 신규 렌더(H-d) + 조작 지시 표시. 답 위젯: num(H-c/d)·draw(H-a/b, facesDraw 재사용).
- **지원등급(초안):** H-c 중~최상 / H-d 중~최상(n=3/4/5) / H-a·b 상~최상.

---

## 4. 구현 순서 & 산출물 (권장)
1. **Phase 1 G** (작음, 기존 minmax 확장):
   - core/신규 calc: G-b(위+한실루엣 min/max), G-c(층조건). 문제집 대조 검증.
   - gen minmax +sub, adapter minmax sub 분기, run given(topOneSil) 렌더.
2. **Phase 2 H** (신규 type):
   - `cubenest-manip.js` 신규(+export, gen-modules) — completeCube·paintedCubeCount·perturbThenViews.
   - gen type:'manip', adapter, run(색칠도식·drawSil 재사용).
   - H-c → H-d → H-a/b 순(난이도·의존 순).
3. 랜딩: G군(3 sub)·H군(4 sub) 카테고리/카드 추가(카테고리 번호 계속).
4. 배포: _shared 신규 모듈 export+import → generate·grade 재배포. run·landing 업로드.

---

## 5. 검수 체크리스트 (Claude Code)
- [ ] **정답 비누출:** G/H 전 sub의 _gp에 min/max·완성수·색칠수·조작후실루엣 미포함(누출 검사).
- [ ] **문제집 대조:** G-b/c·H-c(목표 정육면체 정의)·H-d(색칠 공식)·H-a/b(빼기 규칙) 정답이 실측과 일치.
- [ ] **경계:** G-b footprint/실루엣 모순, G-c n범위, H-c 이미 정육면체, H-d n≥3, H-b 빼기 후 0/낙하.
- [ ] **given 렌더:** topOneSil(G-b)·색칠 정육면체(H-d) 신규 렌더 브라우저 확인.
- [ ] **결정성·강제sub·서버=클라 규칙 일치**(hidden 방식 시뮬).
- [ ] **/grade 단일출처·재시도·SKEY sub**(hidden과 동일 규약) 적용.
- [ ] 콘솔 에러 0·모바일 세로·터치 44px.

---

## 6. 열린 설계 질문 (Claude Code 판단 요청)
1. **H-c 목표 정육면체:** "가장 작은 감싸는 정육면체(m=max dim)"인가, "제시된 한 변 k"인가 — 문제집 다수 관례로 확정. (둘 다 지원이 안전.)
2. **G-c:** 개수형만(1차) vs 최대최소형 포함(2차) — 문제집 빈도로 우선순위.
3. **H-a/b 빼기 물리:** 열 단위 −k만(단순) vs 셀 제거+낙하(복잡) — 교과 관례.
4. **H-d 제시 렌더:** cubenest-iso로 n³ 색칠 표현 가능한지, 아니면 별도 도식/이미지가 나은지.
5. **난이도 프리셋:** 위 초안 지원등급을 remap v0.7 §2 밀도 U자·격자와 정합되게 확정.

---

## 7. 참조
- 유형 근거: `cubenest_quiz_type_map_260816_v0_3.md` §G(103-108)·§H(110-116)·계산헬퍼(119-120).
- 파워유형 공식(§0.2): n층=위모양 n이상 칸수 / 정육면체완성=최소−현재 / 색칠=꼭짓점(3면)·모서리(2면)·면(1면)·속(0면).
- 아키텍처·배포·좌표: `HANDOFF_안보이는나무6종_260817.md`, 마스터 v1.8.1 §3·§4.
- 커밋 규약: 검수 후 quiz_기능개발명세서·cubenest_remap·마스터 §9 갱신(§8.1).
