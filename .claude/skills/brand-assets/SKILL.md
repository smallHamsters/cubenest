---
name: brand-assets
description: CubeNest 로고 마크·파비콘·OG 카드·웹 매니페스트를 고치거나 다시 만들 때의 규약. brand-glyph.svg·favicon.ico·apple-touch-icon·icon-192/512·site.webmanifest·cubenest-og-v2.png 또는 playground 캡처 워터마크(MARK_PATHS)·404 인라인 파비콘을 건드리기 전에 읽을 것.
---

# 브랜드 자산 규약 (로고 · 파비콘 · OG)

`CLAUDE.md` 에서 이관(2026-08-30). 로고·파비콘·OG 자산을 만질 때만 필요해서 상시 로드에서 뺐다.
`CLAUDE.md` 에는 **금지 규칙 요약과 이 스킬로의 포인터**가 남아 있다 — 여기를 고치면 그 요약도 함께 본다.

## 마크

- **브랜드 마크 = 라운드 등축 정육면체. 세 면이 곧 위·앞·옆이고 색도 방향색 그대로다**(위 `#3f8fd0` · 앞 `#4fae72` · 옆 `#d0546f`). 로고가 새 색을 들여온 게 아니라 제품이 이미 19곳에서 쓰던 의미색을 승격시킨 것 — **UI 액센트 `--accent:#3f3fbf` 는 그대로다.** 로고 3색으로 버튼·링크를 칠하지 말 것(방향의 뜻이 흐려진다).
  - **정본은 `assets/img/brand-glyph.svg` 하나이고 22곳이 이 URL 을 공유한다**(파비콘 `<link rel="icon">` 10 + 로고 `<img src>` 12, 10개 페이지). 파일명을 바꾸지 말 것 — 덮어쓰기 한 번이 3가지 깊이를 동시에 바꾸고 롤백도 `git checkout` 한 줄이다. 이름을 바꾸면 22곳 편집 창이 생겨 그사이 페이지마다 다른 로고가 뜬다.
  - **⚠ 같은 그림이 코드로 복제된 곳이 둘 있다. 마크를 고치면 셋 다 고친다.**
    ① `playground/index.html` 의 `MARK_PATHS` — 캡처 PNG 워터마크. SVG 의 `d` 문자열을 **그대로** 옮겨야 한다(라운딩이 '변의 20%'가 아니라 일률 3.01 유닛이라 재유도하면 어긋난다). **외부 SVG 를 `Image` 로 그리지 말 것** — `captureImage()` 가 동기이고 `a.click()` 다운로드 핸들러 안에서 불려, 비동기로 바꾸면 Safari 에서 사용자 활성화가 소실돼 다운로드가 막힌다.
    ② `404.html` 의 `data:image/svg+xml` 파비콘 — 이 페이지는 어떤 깊이에서도 떠서 상대경로가 깨지고 절대경로는 로컬 5500 에서 깨진다. 하단 경로 보정 스크립트도 파비콘엔 못 쓴다(브라우저가 파싱 초기에 가져간다). **`#` 을 `%23` 으로 인코딩할 것** — 안 하면 프래그먼트로 잘려 색이 전부 사라진다.
  - 랜딩 다크 푸터(`#1c2432`)만 `brand-glyph-dark.svg`(방향색을 한 단계 밝게)를 쓴다. **푸터 글리프에는 `.foot-brand .glyph{width:30px;height:30px}` 가 반드시 있어야 한다** — SVG 에 width/height 가 없어 이 규칙이 빠지면 대체요소 기본 규칙상 300px 로 잡혀 **실제로 253px 로 그려진 적이 있다**(260828 수정).
  - **제품 안 큐브의 나무색은 로고가 아니다** — `cubenest-iso.js:74·80`(+`_shared/` 사본), `viewer`·`playground` 의 3D 재질, 랜딩 삽화, 404 아트, 퀴즈 마스코트, `quiz/index.html` 의 `--w-*`(유형 카드 아이콘 15종이 소비한다 — 지우면 아이콘이 검게 된다). 학습 대상의 색이므로 로고 교체와 함께 바꾸지 않는다.

## 파비콘 · 매니페스트

- **파비콘은 11개 페이지 전부에 명시 링크가 있어야 한다.** GitHub Pages 하위경로(`/cubenest/`) 배포라 브라우저·iOS 의 루트 자동 탐색(`/favicon.ico`·`/apple-touch-icon.png`)이 **도메인 루트로 가버려 통하지 않는다.** `.ico` 를 먼저, SVG 를 뒤에 건다(Safari 는 SVG 파비콘 미지원 → `.ico` 폴백). 삽입점은 `canonical` 바로 뒤.
  - 자산: `assets/img/` 의 `favicon.ico`(16·32·48) · `apple-touch-icon.png`(180) · `icon-192.png` · `icon-512.png` · `icon-512-maskable.png`, 그리고 루트 `site.webmanifest`.
  - PNG 3종은 **흰 배경 + 여백**(iOS 가 투명을 검게 합성한다), `.ico` 는 투명·꽉 채움(16px 에서 여백을 주면 뭉갠다). maskable 은 512 캔버스에 박스 **416px**(마크 외접반경이 15.68/16 이라 안전영역 80% 안에 들어오려면 ≤418).
  - **매니페스트에 `theme_color` 를 넣지 말 것** — `theme-color` 가 이미 9곳 `#e9eef4` vs `quiz`·`404` `#3f3fbf` 로 갈려 있어 세 번째 출처를 만들면 표류가 확정된다. `display:"browser"` 를 명시해 설치 프롬프트 자격을 일부러 미달로 둔다.
  - 매니페스트 **안의** 상대경로는 매니페스트 URL 기준으로 풀리므로 깊이 분기가 필요 없다. 깊이별로 다른 건 각 페이지의 `href` 뿐이다.

## OG 카드

- **OG 카드(`assets/img/cubenest-og-v2.png`)를 고칠 땐 파일명을 바꾼다.** `og:image` 를 읽는 건 브라우저가 아니라 소셜 크롤러이고, 페이스북·카카오톡은 HTTP 캐시 헤더와 무관하게 무기한 캐시한다. 같은 이름으로 덮어쓰면 새 카드가 노출되지 않는다. 참조가 **22곳**이고 그중 둘(`index.html`·`playground/index.html`)은 **JSON-LD `"image"`** 라 놓치기 쉽다.
  - 재생성 템플릿 = `assets/og/og-card.html`(헤드리스 Chrome 으로 1200×630 스크린샷). 오른쪽 삽화는 손으로 그리지 않고 `cubenest-iso.js` 를 호출한다.
