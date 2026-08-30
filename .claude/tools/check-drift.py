# -*- coding: utf-8 -*-
# ⚠ shebang 을 붙이지 말 것. Windows 의 py 런처가 그 줄을 읽어 인터프리터를 고르는데,
#   이 개발 머신에선 python·python3 둘 다 WindowsApps 스텁으로 가서 그냥 죽는다
#   ("Python" 만 찍고 exit 49). shebang 이 없으면 py 가 자기 Python 3 을 쓴다.
"""
CubeNest 드리프트 검사 — 리포 루트에서  py .claude/tools/check-drift.py

헤더·푸터 마크업은 "스타일만 공유하고 마크업은 각 HTML 에 인라인" 규약이라
9개 페이지에 복붙돼 있다. 복사가 어긋나도 **오류가 나지 않아** 조용히 남는다.
여기 있는 검사는 전부 260828~29 에 실제로 일어난 사고에서 나왔다:

  1) 브랜드 지역화 훅/스크립트가 3페이지에서 빠져 한국어 사용자에게 "CubeNest" 가 남음
  2) api-client.js 의 ?v= 가 0.2.0 과 1 로 갈려 옛 파일이 계속 서빙됨
  3) 파비콘 링크가 11페이지 전부 0개 (하위경로 배포라 자동 탐색이 안 통함)
  4) og:image 가 없는 /public/ 경로를 가리켜 /quiz/ 미리보기가 깨짐
  5) 셸에 box-sizing 이 없어 같은 max-width 가 헤더와 22px 어긋남

종료코드 0 = 이상 없음, 1 = 문제 있음(CI 에 걸기 좋게).
"""
import io, os, re, sys, glob
from collections import defaultdict

# Windows 콘솔이 cp949 라 한글 출력이 깨진다 — stdout 을 UTF-8 로 직접 잡는다.
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(ROOT)

# 공용 헤더/푸터를 쓰는 페이지. playground(전용 오버레이)·404(자립형)는 규약 밖이다.
SHARED = ['index.html', 'guide/index.html', 'my/index.html', 'account/index.html',
          'privacy/index.html', 'terms/index.html', 'worksheets/index.html',
          'quiz/index.html', 'quiz/run/index.html']
ALL_HTML = sorted(p.replace('\\', '/') for p in glob.glob('**/*.html', recursive=True)
                  if not p.replace('\\', '/').startswith('assets/'))
STANDALONE = {'404.html', 'playground/index.html'}

# ?v= 를 일부러 안 붙이는 것들(CLAUDE.md 기록). 바뀌면 그때 붙인다.
UNVERSIONED_OK = {'consent.css', 'qrcode-generator.js'}

fails, notes = [], []
def fail(section, msg): fails.append((section, msg))
def note(msg): notes.append(msg)

def read(p):
    return io.open(p, encoding='utf-8').read()

def header_of(src):
    m = re.search(r'<header class="site-top".*?</header>', src, re.S)
    return m.group(0) if m else None

def depth_prefix(page):
    """페이지 깊이에 맞는 상대경로 접두사. index.html → '', quiz/run/… → '../../'"""
    return '../' * page.count('/')


# ── 1. 헤더 메뉴가 9페이지에서 같은가 ────────────────────────────────────────
def check_menu():
    seen = defaultdict(list)
    for p in SHARED:
        h = header_of(read(p))
        if h is None:
            fail('헤더', f'{p}: <header class="site-top"> 를 못 찾음'); continue
        nav = re.search(r'<nav class="site-nav".*?</nav>', h, re.S)
        items = tuple(t.strip() for t in re.findall(r'>([^<>]+)</a>', nav.group(0))) if nav else ()
        seen[items].append(p)
    if len(seen) > 1:
        fail('헤더', f'메뉴 항목이 {len(seen)}종으로 갈렸다:')
        for items, pages in seen.items():
            fail('헤더', f'    {" · ".join(items)}  ← {", ".join(pages)}')
    else:
        note(f'헤더 메뉴 {len(SHARED)}페이지 동일 ({" · ".join(list(seen)[0])})')


# ── 2. 브랜드 지역화: 훅과 스크립트가 짝으로 있는가 ──────────────────────────
#     훅만 복사하고 스크립트를 빠뜨리면 오류 없이 영문이 남는다(260829 실제 사고).
def check_brand():
    bad = []
    for p in SHARED:
        src = read(p); h = header_of(src)
        if h is None: continue
        b = re.search(r'<b\b([^>]*)>', h)
        has_hook = bool(b) and ('data-brand' in b.group(1) or 'id=' in b.group(1))
        has_switch = 'navigator.language' in src and '큐브네스트' in src
        if not (has_hook and has_switch):
            bad.append(f'{p}: 훅={"O" if has_hook else "X"} 스크립트={"O" if has_switch else "X"}')
    if bad:
        fail('브랜드', '헤더 워드마크 언어 전환이 불완전하다 — 한국어 사용자에게 "CubeNest" 가 남는다:')
        for b in bad: fail('브랜드', '    ' + b)
    else:
        note(f'브랜드 지역화 훅+스크립트 {len(SHARED)}페이지 정상')


# ── 3. ?v= 가 파일마다 한 값인가 ─────────────────────────────────────────────
def check_versions():
    vals = defaultdict(lambda: defaultdict(list))   # 파일명 → 값 → [페이지]
    unver = defaultdict(list)
    for p in ALL_HTML:
        # href/src 속성 안만 본다 — 주석에 적힌 파일명("스타일은 foot.css 단일 출처")까지
        # 잡으면 ?v= 가 없다고 오탐한다.
        for m in re.finditer(
                r'(?:href|src)="[^"]*assets/(?:css|js)/(?:vendor/)?([\w.-]+\.(?:css|js))(\?v=([\d.]+))?"', read(p)):
            name, ver = m.group(1), m.group(3)
            if ver: vals[name][ver].append(p)
            else:   unver[name].append(p)
    for name, byver in sorted(vals.items()):
        if len(byver) > 1:
            fail('캐시', f'{name} 의 ?v= 가 {len(byver)}종으로 갈렸다 — 옛 파일이 계속 서빙된다:')
            for v, pages in byver.items():
                fail('캐시', f'    ?v={v}  ← {", ".join(pages)}')
    for name, pages in sorted(unver.items()):
        if name in UNVERSIONED_OK: continue
        if name in vals:
            fail('캐시', f'{name} 이(가) {len(pages)}곳에서 ?v= 없이 로드된다: {", ".join(pages)}')
    if not any(s == '캐시' for s, _ in fails):
        note(f'?v= 버저닝 정상 ({len(vals)}개 자산, 파일당 한 값)')


# ── 4. 파비콘·아이콘 링크 ────────────────────────────────────────────────────
#     하위경로(/cubenest/) 배포라 루트 자동 탐색이 안 통한다 → 전 페이지에 명시 필요.
def check_icons():
    bad = []
    for p in ALL_HTML:
        src = read(p)
        miss = []
        if 'rel="icon"' not in src: miss.append('icon')
        if p not in STANDALONE:      # 404 는 data URI 하나로 자립
            if 'rel="apple-touch-icon"' not in src: miss.append('apple-touch-icon')
            if 'rel="manifest"' not in src: miss.append('manifest')
        if miss: bad.append(f'{p}: {", ".join(miss)} 없음')
    if bad:
        fail('아이콘', '아이콘 링크 누락 — 하위경로 배포라 루트 자동 탐색이 통하지 않는다:')
        for b in bad: fail('아이콘', '    ' + b)
    else:
        note(f'아이콘 링크 {len(ALL_HTML)}페이지 정상')


# ── 5. 글리프 경로 깊이 ──────────────────────────────────────────────────────
def check_glyph_paths():
    bad = []
    for p in ALL_HTML:
        want = depth_prefix(p) + 'assets/img/'
        for m in re.finditer(r'src="([^"]*brand-glyph[^"]*)"', read(p)):
            if not m.group(1).startswith(want):
                bad.append(f'{p}: {m.group(1)}  (기대 {want}…)')
    if bad:
        fail('글리프', '상대경로 깊이가 안 맞는다:')
        for b in bad: fail('글리프', '    ' + b)
    else:
        note('브랜드 글리프 상대경로 정상')


# ── 6. og:image 가 한 곳을 가리키는가 ────────────────────────────────────────
def check_og():
    targets = defaultdict(list)
    for p in ALL_HTML:
        for m in re.finditer(r'(?:og:image"|twitter:image"|"image":)\s*(?:content=)?"([^"]+\.png)"', read(p)):
            targets[m.group(1)].append(p)
    if len(targets) > 1:
        fail('OG', f'og:image 가 {len(targets)}곳을 가리킨다:')
        for t, pages in targets.items():
            fail('OG', f'    {t}  ← {", ".join(pages)}')
    elif targets:
        url = list(targets)[0]
        local = url.split('/cubenest/')[-1]
        if not os.path.exists(local):
            fail('OG', f'og:image 가 리포에 없는 파일을 가리킨다: {local}')
        else:
            note(f'og:image 단일 대상 ({local})')


# ── 7. 셸 컨테이너에 box-sizing 이 있는가 ────────────────────────────────────
#     없으면 같은 max-width 가 헤더(border-box)와 다른 뜻이 돼 22px 어긋난다.
SHELLS = [('assets/css/foot.css', '.site-foot'), ('assets/css/nav.css', '.site-topin'),
          ('my/index.html', '.my-main'), ('account/index.html', '.acct-main'),
          ('worksheets/index.html', '.page'), ('assets/css/legal.css', '.legal-main')]
def check_boxsizing():
    bad = []
    for path, sel in SHELLS:
        src = read(path)
        m = re.search(re.escape(sel) + r'\s*\{(.*?)\}', src, re.S)
        if not m: bad.append(f'{path}: {sel} 규칙을 못 찾음'); continue
        # 주석을 먼저 걷어낸다 — 규칙 안 주석에 'box-sizing' 이라는 낱말이 있으면
        # 선언이 없어도 통과해버린다(이 검사기 자체의 오탐을 260829 에 잡았다).
        body = re.sub(r'/\*.*?\*/', '', m.group(1), flags=re.S)
        if not re.search(r'box-sizing\s*:', body):
            bad.append(f'{path}: {sel} 에 box-sizing 선언 없음')
    if bad:
        fail('레이아웃', '셸 컨테이너에 box-sizing:border-box 가 없다 — 폭을 맞춰도 헤더와 어긋난다:')
        for b in bad: fail('레이아웃', '    ' + b)
    else:
        note(f'셸 box-sizing 명시 {len(SHELLS)}곳 정상')


# ── 8. GA4 동의 3종 세트가 한 벌로 있는가 ────────────────────────────────────
#     GA4 로더는 assets/js/consent.js **하나뿐**이다(리포 전체에서 googletagmanager 문자열이
#     그 파일에만 있다). 이 파일을 안 실으면 window.gtag 가 아예 없고, 각 페이지의 track() 은
#     `if(window.gtag)` 가드라 **오류 없이 조용히 버려진다** — 260830 에 quiz/index.html 이
#     정확히 그 상태였고 quiz_preview_* 두 이벤트가 100% 유실됐다(배포 내내 아무 증상 없음).
#     세 조각(css·배너 마크업·스크립트)은 헤더·푸터와 같은 규약이라 각 HTML 에 인라인이고,
#     그래서 한둘만 복사하는 실수가 난다. 전부 있거나 전부 없어야 한다.
CONSENT_PAGES = [p for p in SHARED if p != '404.html'] + ['playground/index.html']
def check_consent():
    bad = []
    for p in CONSENT_PAGES:
        src = read(p)
        has_css = 'assets/css/consent.css' in src
        has_js  = 'assets/js/consent.js' in re.sub(r'<!--.*?-->', '', src, flags=re.S)
        has_ui  = 'id="consent"' in src and 'id="consentAccept"' in src and 'id="consentDeny"' in src
        if len({has_css, has_js, has_ui}) > 1:
            bad.append(f'{p}: css={"O" if has_css else "X"} 배너={"O" if has_ui else "X"} js={"O" if has_js else "X"}')
        # track() 을 부르면서 로더가 없으면 그 이벤트는 전부 버려진다.
        if not has_js and re.search(r'(?<![\w.])track\s*\(', src):
            bad.append(f'{p}: track() 을 호출하는데 consent.js 가 없다 — 이벤트가 조용히 버려진다')
    if bad:
        fail('계측', 'GA4 동의 3종 세트(css·배너·consent.js)가 어긋났다 — 이벤트가 오류 없이 사라진다:')
        for b in bad: fail('계측', '    ' + b)
    else:
        note(f'GA4 동의 3종 세트 {len(CONSENT_PAGES)}페이지 정상')


for fn in (check_menu, check_brand, check_versions, check_icons,
           check_glyph_paths, check_og, check_boxsizing, check_consent):
    try:
        fn()
    except Exception as e:                       # 검사 자체가 죽어도 나머지는 돌린다
        fail(fn.__name__, f'검사 실패: {e!r}')

print('=' * 68)
print(' CubeNest 드리프트 검사 — %d개 HTML' % len(ALL_HTML))
print('=' * 68)
for n in notes:
    print('  OK   ' + n)
if fails:
    print()
    last = None
    for section, msg in fails:
        if section != last: print('  [%s]' % section); last = section
        print('  FAIL ' + msg if not msg.startswith('    ') else '       ' + msg.strip())
    print('\n문제 %d건.' % len([f for f in fails if not f[1].startswith('    ')]))
    sys.exit(1)
print('\n이상 없음.')
