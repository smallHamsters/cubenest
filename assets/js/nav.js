/* CubeNest — 공용 헤더 메뉴 거동. 마스터 §8.1.
   헤더 마크업은 nav.css 규약대로 각 페이지 HTML 에 인라인으로 있고, 스타일은 nav.css 가
   단일 출처다. 이 파일은 **CSS 로 안 되는 두 가지**만 한다.

   왜 필요한가 (260906 실측):
     모바일에서 .site-nav 는 햄버거 없이 가로 스크롤한다(nav.css @640 — 숨기면 내비게이션이
     사라진다는 결정). 그런데 375px 에서 메뉴 칸은 241px 인데 메뉴 5종은 329px 라 88px 가
     넘치고, 다섯 중 셋만 보인다. 480px 부터 전부 들어온다(320:2/5 · 360~390:3/5 · 412~430:4/5).
     그 결과 두 가지가 깨진다:
       ① 가려진 메뉴가 있다는 신호가 없다 — 잘린 글자 하나가 유일한 단서이고,
          360px 에선 항목 경계에 딱 떨어져 그 단서마저 없다.
       ② 헤더로 그 페이지에 들어가고도 aria-current 칩이 화면 밖이라 현재 위치를 못 본다.

   ⚠ 이 파일은 넘침을 없애지 않는다. 넘침을 **발견 가능하게** 하고 **현재 위치를 보이게** 할 뿐이다.
      완전히 없애려면 라벨 축약이나 햄버거가 필요한데 둘 다 제품 결정이라 따로 다룬다.

   ⚠ 페이드는 **넘칠 때만** 건다. 항상 걸면 480px 이상에서 마지막 메뉴가 이유 없이 흐려진다
      — 그래서 CSS 만으로 못 하고 이 파일이 클래스를 토글한다(.fade-l / .fade-r).

   CubeNest.auth · mydata 에 의존하지 않는 순수 DOM 유틸이어야 한다(foot.js 와 같은 규약)
   — quiz/index.html 처럼 가벼운 페이지도 이걸 쓴다.

   소비: index(랜딩) · price · quiz · quiz/run · worksheets · account · my · terms · privacy
         — playground(전용 오버레이)와 404(자립형)만 제외. */
(function () {
  'use strict';

  var EDGE = 1;          /* 소수점 반올림 여유 — 이게 없으면 끝에서 페이드가 깜빡인다 */

  function syncFade(nav) {
    var over = nav.scrollWidth - nav.clientWidth;
    if (over <= EDGE) {                       /* 다 들어온다 — 두 클래스 다 뗀다 */
      nav.classList.remove('fade-l', 'fade-r');
      return;
    }
    nav.classList.toggle('fade-l', nav.scrollLeft > EDGE);
    nav.classList.toggle('fade-r', nav.scrollLeft < over - EDGE);
  }

  /* 현재 페이지 칩을 스크롤 안으로. scrollIntoView 를 쓰지 않는다 —
     그쪽은 조상 스크롤러(=문서)까지 건드려 페이지가 같이 튀는 경우가 있다.
     scrollLeft 를 직접 넣으면 이 컨테이너만 움직이고 범위를 넘겨도 브라우저가 클램프한다. */
  function centerCurrent(nav) {
    var cur = nav.querySelector('[aria-current]');
    if (!cur) return;                          /* 랜딩엔 현재 항목이 없다 — 아무 일도 안 한다 */
    if (nav.scrollWidth - nav.clientWidth <= EDGE) return;
    nav.scrollLeft = cur.offsetLeft - (nav.clientWidth - cur.offsetWidth) / 2;
  }

  function init() {
    var nav = document.querySelector('.site-nav');
    if (!nav) return;                          /* playground·404 — no-op */

    centerCurrent(nav);
    syncFade(nav);

    var sync = function () { syncFade(nav); };
    nav.addEventListener('scroll', sync, { passive: true });
    addEventListener('resize', sync, { passive: true });

    /* 웹폰트(Pretendard)가 늦게 오면 글자 폭이 바뀌어 넘침 여부가 달라진다.
       그 전에 잰 값으로 페이드를 걸어 두면 틀린 상태로 남는다. */
    if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
      document.fonts.ready.then(function () { centerCurrent(nav); sync(); });
    }
    addEventListener('load', function () { centerCurrent(nav); sync(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
