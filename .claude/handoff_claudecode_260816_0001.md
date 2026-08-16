# 인수인계 — Claude Code (2026-08-16)

account/my/cs 채팅 산출물 기준. **헤더 롤아웃 + 공통 정리**가 지금 할 일이고, 서버/DB는 뒤로 미룬다.
(quiz/run 쪽 작업은 별도 문서 `handoff_quiz_260816_0001.md` 참고.)

## 배경(이 채팅에서 만든 것)
- `account/index.html` — 계정 허브. 하나의 카드(.ah-panel) 안에 섹션 순서대로(내 계정 → 이용권 → 쿠폰 → 결제 내역), 내 자료는 분리 카드, 하단 문의(CS).
- `my/index.html` — 내 자료. 로그인 게이트 + 로컬 우선 라이브러리. 퀴즈 카드 = 좌측 링크 + [결과보기][다시풀기]. 글리프 = `assets/img/brand-glyph.svg`.
- `assets/js/mydata.js` — `CubeNest.mydata`(로컬 우선, 클라우드 이음새).
- `assets/js/auth.js` — mountHeader() 한 함수만 패치(#authNav에 SVG 있으면 라벨·.authed만 갱신, 마크업 보존 · 하위호환).
- 헤더: 계정 = 원+사람 아이콘(로그인 시 액센트), 내 자료 = 데스크톱 텍스트 / 모바일 아이콘.

---

## 지금 할 일

### 1. 헤더 롤아웃 (나머지 페이지)
공용 헤더가 있는 페이지 전부에 동일 적용: **랜딩(`/`) · 가이드 · 퀴즈 · 문제지(worksheets)**. (playground는 전용 헤더라 제외.)

**(a) 각 페이지 `<nav class="site-nav">` 끝에 내 자료 + 계정 아이콘 추가.** 마크업은 `account/index.html`·`my/index.html`의 `<nav>` 그대로 참고.
- 계정: `<a href="{상대}/account/" id="authNav" aria-label="로그인" title="로그인"><svg 원+사람/></a>`
- 내 자료: `<a href="{상대}/my/" id="myNav"><span class="t">내 자료</span><svg class="i" 큐브/></a>`
- **경로는 깊이별로**(마스터 §2.1 상대경로): 하위폴더 페이지 `../my/`·`../account/`, 루트 랜딩 `my/`·`account/`, `quiz/run`(2단계) `../../my/`·`../../account/`.
- 현재 페이지면 해당 링크에 `aria-current="page"`.

**(b) 인라인 네비 CSS → 공용 `assets/css/nav.css`로 이전.** 지금 account/my 두 페이지에 "임시 인라인"으로 들어가 있음(코드 주석 표시). 이전 후 두 페이지의 인라인 블록 제거. 넣을 규칙:
```css
.site-nav a#authNav{width:44px;height:44px;padding:0;display:inline-grid;place-items:center;border-radius:50%;color:var(--muted);}
.site-nav a#authNav svg{width:24px;height:24px;}
.site-nav a#authNav.authed{color:var(--accent-ink);}
.site-nav a#myNav .i{display:none;}
@media (hover:hover){ .site-nav a#authNav:hover{background:var(--panel-2);color:var(--ink);} .site-nav a#myNav:hover{color:var(--accent-ink);} }
@media (max-width:640px){
  .site-nav a:not(#authNav):not(#myNav){display:none;}
  .site-nav a#myNav{width:44px;height:44px;padding:0;display:inline-grid;place-items:center;border-radius:50%;color:var(--muted);}
  .site-nav a#myNav .t{display:none;}
  .site-nav a#myNav .i{display:block;width:24px;height:24px;}
}
```

**(c) `assets/js/auth.js`를 이 채팅의 패치본으로 교체**(mountHeader). 안 하면 아이콘이 텍스트로 덮인다.

### 2. CS 폼 URL 교체
account/my 두 페이지의 `CS_FORM_URL='https://forms.gle/REPLACE-WITH-CS-FORM'`를 실제 구글폼으로 교체(마스터 §6.6). 가능하면 한 곳으로 중앙화.

### 3. 마스터 등재 (§8.1 단일 지점)
§2.1 트리·§9 인덱스에 `assets/js/mydata.js`·`my/index.html`·`account/index.html` 반영, auth.js 버전 갱신.

> 렌더 검증에 쓴 스텁 자산(nav.css/consent.css/consent.js/brand-glyph 등)은 실제 리포에 이미 존재 → 인도 대상 아님.

---

## 나중에 (구현 70%+ 이후 — 지금은 설정하지 말 것)

> **결정:** 미리 DB를 구축해 복잡도를 올리지 않는다. 전 기능을 **로컬 우선**으로 계속 개발하고, **구현이 최소 70% 이상** 된 뒤에 서버/DB를 붙인다.

- **Supabase `my_items` 테이블 + RLS** 신설 → `mydata.js`의 `pickBackend()`를 클라우드로 전환(로컬↔클라우드 무접점, 마스터 §6.4). 그때까지 `mydata`는 localStorage 백엔드 유지.
- **account 이음새 실연결** — `account/index.html`의 `loadEntitlement()`(이용권/만료) · `loadPayments()`(결제 내역) · `redeemCoupon()`(쿠폰)은 현재 베타-무료 스텁. 서버(Postgres 이용권 + Edge Function `/redeem` 등)로 교체(마스터 §6.5·§6.7, 유료 판정은 서버/RLS).
- 이 단계 전까지 account는 "베타 무료·결제 없음·쿠폰은 정식 출시 후"로 정직하게 표시되며, 코드 수정 없이 이음새 함수만 교체하면 된다.
