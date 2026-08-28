/* CubeNest — 공용 푸터 배선(연도 · 문의 창구). 마스터 §6.6.
   푸터 마크업은 nav.css 규약대로 각 페이지 HTML 에 인라인으로 있고,
   이 파일은 거기 있는 #year · #csLink · #csMail 만 채운다.

   CubeNest.auth · mydata 에 의존하지 않는 순수 DOM 유틸이어야 한다
   — quiz/index.html 처럼 consent.js 조차 안 싣는 가벼운 페이지도 이걸 쓴다.
   (로그인 여부는 있으면 읽고, 없으면 조용히 건너뛴다 — 의존이 아니다.)

   소비: index(랜딩 '정보' 열) · guide · quiz · quiz/run · worksheets · terms · privacy ·
         account · my — **playground 와 404 만 제외**한 전 페이지. */
(function () {
  'use strict';

  /* ── 문의 창구 2개 (마스터 §6.6) ────────────────────────────────────────
     ⚠ CS_MAIL 은 약관 제33조 ②·사업자 정보의 전자우편과 **같은 값**이어야 한다.
       한쪽만 바꾸면 화면과 약관이 어긋난다.
     ⚠ 폼을 만들면 아래 두 상수만 채우면 된다. 비어 있으면 자동으로 메일로 폴백하므로
       폼이 준비되기 전에도 푸터가 죽지 않는다.
       CS_ENTRY_CTX = 폼의 "자동 채움" 질문 entry ID. 지금은 그 질문을 두지 않아 빈 값이다.
       (되살릴 땐 폼 편집 → ⋮ → '미리 채워진 링크 가져오기' 로 얻는다.)
     ⚠ CS_VIEWFORM_URL 은 **단축 링크(forms.gle/…)가 아니라 정규 viewform 주소**를 쓴다.
       단축 링크는 302 로 넘길 때 쿼리를 흘려버려 미리채우기가 통째로 사라진다.
       (사람에게 안내할 땐 단축 링크 https://forms.gle/9emRPVgv8trafrN77 를 써도 된다.)
     ── playground/index.html · quiz/run/run.js 의 피드백 prefill 패턴과 같은 구조다. */
  var CS_VIEWFORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSeiHsloTvgUwkhPfGrpXdNThqjqYq5oOBM6xbtd4edyK6uv1Q/viewform';
  var CS_ENTRY_CTX    = '';   // 자동 채움 질문을 두지 않으므로 빈 값. 예: 'entry.123456789'
  var CS_MAIL         = 'mailto:prismxq@gmail.com';

  var NS = (window.CubeNest = window.CubeNest || {});

  /* 문의 처리에 도움이 되는 화면 정보. **개인정보는 넣지 않는다** —
     아동이 푸터를 누를 수 있고, 자동 PII 전송은 방침 §1 의 최소수집 서술과 어긋난다.
     로그인 여부(예/아니오)까지만이고 이메일·닉네임·uid 는 절대 넣지 않는다.
     UA 는 파싱하지 않고 원문 그대로 — 사람이 읽으므로 충분하고,
     run.js 의 deviceInfo() 를 복제하지 않아도 된다. */
  function csContext() {
    var signed = '모르겠음';
    try {
      var a = window.CubeNest && window.CubeNest.auth;
      if (a && typeof a.isLoggedIn === 'function') signed = a.isLoggedIn() ? '예' : '아니오';
    } catch (e) {}
    return '(문의 처리에 도움이 됩니다. 필요 없으면 지워 주세요.)\n'
      + '페이지: ' + location.href + '\n'
      + '화면: ' + window.innerWidth + '×' + window.innerHeight + '\n'
      + 'UA: ' + (navigator.userAgent || '') + '\n'
      + '로그인: ' + signed + '\n─────────\n문의 내용: ';
  }

  /* 폼 주소 → entry 가 있으면 미리채우기, 폼이 없으면 메일로 폴백 */
  function csHref() {
    if (!CS_VIEWFORM_URL) return CS_MAIL;
    if (!CS_ENTRY_CTX) return CS_VIEWFORM_URL;
    var id = /^entry\./.test(CS_ENTRY_CTX) ? CS_ENTRY_CTX : ('entry.' + CS_ENTRY_CTX);
    return CS_VIEWFORM_URL + '?usp=pp_url&' + id + '=' + encodeURIComponent(csContext());
  }

  NS.CS_MAIL = CS_MAIL;
  NS.csHref  = csHref;
  /* 하위 호환 — /account 의 .ah-help 가 이 이름을 쓴다. 폼이 있으면 폼, 없으면 메일. */
  NS.CS_FORM_URL = CS_VIEWFORM_URL || CS_MAIL;

  function mount() {
    var y = document.getElementById('year');
    if (y) y.textContent = new Date().getFullYear();

    var cs = document.getElementById('csLink');
    if (cs) {
      var href = csHref();
      cs.href = href;
      // mailto 는 새 탭이 필요 없다 — target=_blank 면 빈 탭이 남는 브라우저가 있다.
      if (href.indexOf('mailto:') === 0) {
        cs.removeAttribute('target');
        cs.removeAttribute('rel');
      }
    }

    var mail = document.getElementById('csMail');
    if (mail) {
      mail.href = CS_MAIL;
      mail.removeAttribute('target');
      mail.removeAttribute('rel');
      // 폼이 아직 없으면 두 링크가 같은 곳을 가리켜 중복이다 → 메일 링크만 남긴다.
      if (!CS_VIEWFORM_URL) {
        var sep = mail.previousElementSibling;
        if (sep && sep.classList && sep.classList.contains('dot')) sep.remove();
        mail.remove();
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
