      /* ===== 시드 RNG·생성기 = 공용 모듈 cubenest-gen (아래 GEN) ===== */

      /* ===== 유형 · 난이도 설정 ===== */
      const TYPES={
        count:{title:"개수 세기",ask:"쌓기나무는 모두 몇 개일까요?",form:"num",unit:"개"},
        volume:{title:"부피 구하기",ask:"이 모양의 부피는 얼마일까요?",form:"num",unit:"cm³",edge:true},
        surface:{title:"겉넓이 구하기",ask:"겉넓이는 얼마일까요? (바닥 포함)",form:"num",unit:"cm²",edge:true},
        heightmap:{title:"위에서 본 수 쓰기",ask:"위에서 본 모양의 각 칸에 쌓인 나무 수를 쓰세요.",form:"hm"},
        facesMc:{title:"위·앞·옆 모양 고르기",ask:"이 모양을 앞에서 본 모양을 고르세요.",form:"mc"},
        minmax:{title:"최소·최대",ask:"세 방향에서 본 모양이 되는 쌓기나무 개수는?",form:"num",unit:"개"},
        hidden:{title:"안 보이는 나무",ask:"안 보이게 숨길 수 있는 쌓기나무는 몇 개일까요?",form:"num",unit:"개"},
        manip:{title:"조작",ask:"조건에 맞는 쌓기나무 수를 구하세요.",form:"num",unit:"개"},
        facesDraw:{title:"위·앞·옆 그리기",ask:"위·앞·옆에서 본 모양을 각 칸을 칠해 그리세요.",form:"draw"},
      };
      /* gen_config (분류 체계 §7.3) — 정본은 assets/js/quiz/gen-config.json.
         아래는 프리뷰/오프라인 폴백 사본(리포에선 fetch로 덮어씀). */
      const INLINE_CONFIG={
        version:"0.2.0",
        levels:{
          "하":{gx:3,gz:3,maxH:2,fMin:3,fMax:4,nMin:4,nMax:6,edge:1},
          "중":{gx:3,gz:3,maxH:3,fMin:4,fMax:5,nMin:6,nMax:9,edge:1},
          "상":{gx:4,gz:4,maxH:3,fMin:5,fMax:7,nMin:9,nMax:14,edge:2},
          "최상":{gx:5,gz:5,maxH:5,fMin:9,fMax:14,nMin:18,nMax:30,edge:2},
        }
      };
      let GEN_CONFIG=INLINE_CONFIG;
      const LVCODE={1:"하",2:"중",3:"상",4:"최상"};

      /* F1 계측 — 동의 후 로드된 gtag가 있을 때만(오리진 공유 consent 정본). */
      function track(name,params){ try{ if(window.gtag) window.gtag('event',name,params||{}); }catch(e){} }
      /* 공용 모듈(§5.1): 계산=CubeNest.core, 뷰어/펼쳐보기=CubeNest.viewer. core 먼저 로드. */
      const CORE=(window.CubeNest&&window.CubeNest.core)||null;
      /* 인증(§6): CubeNest.auth 가 로그인 상태의 단일 진실 소스.
         첨삭 게이트(initScratch)와 결과 저장(saveResult)이 반드시 '같은 하나'를 봐야 한다. */
      const AUTH=(window.CubeNest&&window.CubeNest.auth)||null;
      const isLoggedIn=()=> !!(AUTH&&AUTH.isLoggedIn());

      /* ===== 로딩 버디 — 채점 캐릭터(gradeSVG)와 동일 톤. 로드 시 "Ready~"만. ===== */
      const Loader=(function(){
        let el=null,styled=false;
        function css(){ if(styled)return; styled=true; const st=document.createElement('style'); st.textContent=
          ".cubi-ov{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:rgba(247,248,251,.92);backdrop-filter:blur(3px);opacity:0;pointer-events:none;transition:opacity .16s}"+
          ".cubi-ov.on{opacity:1;pointer-events:auto}"+
          ".cubi-buddy{width:148px;height:auto;animation:cubi-bob 1s ease-in-out infinite;transform-origin:50% 90%}"+
          "@keyframes cubi-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-11px)}}"+
          ".cubi-buddy .wave{transform-box:fill-box;transform-origin:50% 100%;animation:cubi-wave .8s ease-in-out infinite}"+
          "@keyframes cubi-wave{0%,100%{transform:rotate(20deg)}50%{transform:rotate(-16deg)}}"+
          ".cubi-msg{font-family:var(--font);font-weight:900;font-size:clamp(30px,7vw,46px);line-height:1;color:var(--accent,#3b4bd8);"+
          "text-shadow:0 2px 0 #fff,0 -2px 0 #fff,2px 0 0 #fff,-2px 0 0 #fff,0 3px 10px rgba(24,34,51,.18);"+
          "animation:cubi-word .5s cubic-bezier(.34,1.6,.64,1) both}"+
          "@keyframes cubi-word{0%{transform:scale(.5);opacity:0}100%{transform:scale(1);opacity:1}}";
          document.head.appendChild(st); }
        const BUDDY="<svg class='cubi-buddy' viewBox='45 110 130 92' xmlns='http://www.w3.org/2000/svg'><g>"+
          "<path d='M70 130 L110 118 L150 130 L110 142z' fill='#f0d9b4' stroke='#c8965a' stroke-width='2.5' stroke-linejoin='round'/>"+
          "<rect x='70' y='130' width='80' height='64' rx='11' fill='#e6c9a0' stroke='#c8965a' stroke-width='3'/>"+
          "<rect x='53' y='132' width='10' height='26' rx='5' fill='#d8a76e' transform='rotate(30 58 145)'/>"+
          "<rect class='wave' x='157' y='132' width='10' height='26' rx='5' fill='#d8a76e'/>"+
          "<path d='M85 153 q6 -8 12 0' fill='none' stroke='#5b4327' stroke-width='4' stroke-linecap='round'/>"+
          "<path d='M123 153 q6 -8 12 0' fill='none' stroke='#5b4327' stroke-width='4' stroke-linecap='round'/>"+
          "<ellipse cx='83' cy='168' rx='6' ry='4' fill='#e88f96' opacity='.65'/>"+
          "<ellipse cx='137' cy='168' rx='6' ry='4' fill='#e88f96' opacity='.65'/>"+
          "<path d='M99 166 q11 14 22 0 z' fill='#8a4a3a'/>"+
          "</g></svg>";
        function ensure(){ css(); if(el)return; el=document.createElement('div'); el.className='cubi-ov';
          el.innerHTML=BUDDY+"<div class='cubi-msg'></div>"; document.body.appendChild(el); }
        let timer=null;
        function show(kind){ ensure(); el.querySelector('.cubi-msg').textContent=(kind==='generate'?'Ready~':''); el.classList.add('on'); }
        function showDelayed(kind,ms){ clearTimeout(timer); timer=setTimeout(function(){ show(kind); }, ms||250); }
        function hide(){ clearTimeout(timer); if(el)el.classList.remove('on'); }
        return {show,showDelayed,hide};
      })();
      const VIEWER=(window.CubeNest&&window.CubeNest.viewer)||null;
      const GEN=(window.CubeNest&&window.CubeNest.gen)||null;
      function coreShape(sh){ return {gx:sh.gx, gy:sh.maxH, gz:sh.gz, edge:sh.edge, cells:sh.cells.map(c=>[c.x,c.y,c.z])}; }
      // 안 보이는 나무: 숨은 열/셀 (visibleTop 규칙 인라인 — 숨음 ⟺ 앞대각(x+1,z+1) > 높이)
      function hiddenColsOf(sh){ const at=(x,z)=>((x>=0&&z>=0&&x<sh.gx&&z<sh.gz)?sh.hmap[x][z]:0); const out=[];
        for(let x=0;x<sh.gx;x++)for(let z=0;z<sh.gz;z++){ const h=sh.hmap[x][z]; if(h>0 && at(x+1,z+1)>h) out.push([x,z]); } return out; }
      function hiddenCellSet(sh){ const s=new Set(); hiddenColsOf(sh).forEach(([x,z])=>{ const h=sh.hmap[x][z]; for(let y=0;y<h;y++)s.add(x+","+y+","+z); }); return s; }
      // 서버가 준 제시물(given) → 렌더러들이 먹는 sh 모양 객체.
      //   ⚠ isoTop(A-a/b/f)·sils 에서는 '발자국'까지만 안다 — 숨은 열의 높이는 의도적으로
      //     전송되지 않으므로 높이를 1로 채운 부분 정보다(_partial). 개수·겉넓이 계산에 쓰면 안 된다.
      function givenShape(g){
        const gx=g.gx,gz=g.gz,hmap=[];
        for(let x=0;x<gx;x++)hmap.push(new Array(gz).fill(0));
        const foot=t=>{ for(let z=0;z<t.rows;z++)for(let x=0;x<t.cols;x++) if(t.g[z][x]) hmap[x][z]=1; };
        if(g.kind==="numTop"){ for(const k in g.heights){const p=k.split(",").map(Number);hmap[p[0]][p[1]]=g.heights[k];} }
        else if(g.kind==="layers"){ (g.layers||[]).forEach(cs=>cs.forEach(k=>{const p=k.split(",").map(Number);hmap[p[0]][p[1]]++;})); }
        else if(g.kind==="isoTop"){ foot(g.top); }
        else if(g.kind==="sils"){ foot(g.sils.top); }
        let maxH=0; const cells=[];
        for(let x=0;x<gx;x++)for(let z=0;z<gz;z++){const h=hmap[x][z]; if(h>maxH)maxH=h; for(let y=0;y<h;y++)cells.push({x,y,z});}
        // g.maxH 는 서버가 준 '등급 maxH' — 답안 격자(위·앞·옆 그리기)의 행 수다.
        // 조작 후 실제 높이가 아니라 이 값을 써야 격자 크기가 정답을 흘리지 않는다.
        return {gx,gz,maxH:g.maxH||Math.max(1,maxH),hmap,cells,edge:1,
                _partial:g.kind==="isoTop"||g.kind==="sils"||g.kind==="isoMark"};
      }
      // 문항 i 의 '완전한' 모양. 은닉 유형은 채점 전엔 클라에 없으므로 null 일 수 있다.
      function shapeOf(pr,i){
        const st=S.state[i]; const full=st&&st.explain&&shFromCells(st.explain);
        return full || (pr.sh && !pr.sh._partial ? pr.sh : null);
      }
      // /grade 의 explain → 해설 렌더러가 먹는 '완전한' 모양. 제출 후이므로 밝혀도 된다.
      function shFromCells(ex){
        if(!ex||!ex.cells) return null;
        const cells=ex.cells.map(c=>({x:c[0],y:c[1],z:c[2]}));
        const gx=ex.gx||Math.max(1,...cells.map(c=>c.x+1)), gz=ex.gz||Math.max(1,...cells.map(c=>c.z+1));
        const hmap=[]; for(let x=0;x<gx;x++)hmap.push(new Array(gz).fill(0));
        cells.forEach(c=>{ if(c.y+1>hmap[c.x][c.z]) hmap[c.x][c.z]=c.y+1; });
        return {gx,gz,maxH:ex.maxH||Math.max(1,...cells.map(c=>c.y+1)),hmap,cells,edge:ex.edge==null?1:ex.edge};
      }
      // 높이지도({"x,z":h}) → core/viewer 모양
      function hmapToShape(hm,edge){ const cells=[]; let gx=0,gz=0,gy=0; for(const k in hm){const p=k.split(",").map(Number),h=hm[k]; gx=Math.max(gx,p[0]+1); gz=Math.max(gz,p[1]+1); gy=Math.max(gy,h); for(let y=0;y<h;y++)cells.push([p[0],y,p[1]]);} return {gx,gy,gz,edge,cells}; }
      // 해설 내부 3D 뷰어(최소·최대 모양, 안 보이는 나무 강조) — 문항 전환 시 dispose
      let EXPVIEWS=[];
      function disposeExpViews(){ EXPVIEWS.forEach(v=>{try{v&&v.dispose&&v.dispose();}catch(e){}}); EXPVIEWS=[]; }
      // 오목·안 보이는 나무 판정 = 공용 모듈 GEN(isConcave·hiddenCells)
      // 위/앞/옆 라벨: viewer의 라벨 평면이 가로:세로≈1.6이라, 정사각 텍스처면 글자가 납작해짐 → 같은 비율(128×80) 캔버스로 보정.

      /* ===== 의견·오류 신고 (playground 피드백 패턴 재사용) =====
         배포 설정: 아래 3개를 quiz용 구글폼 값으로 채운다.
         · FEEDBACK_VIEWFORM_URL = 폼 '보기' 주소(…/viewform)
         · FEEDBACK_ENTRY_CTX    = '문제 정보(자동 채움)' 질문의 entry ID
                                    (폼 편집 → ⋮ → '미리 채워진 링크 가져오기'로 획득, 예 "entry.123456789")
         · FEEDBACK_FORM_URL     = 단축 링크(미리채우기 미설정 시 기본 열기) */
      const FEEDBACK_FORM_URL     = "https://docs.google.com/forms/d/e/1FAIpQLSe-FKqQrDKF_hG7a6TC5wkzCLy2HVYKZIDGZLna1PJToSnXyA/viewform";
      const FEEDBACK_VIEWFORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSe-FKqQrDKF_hG7a6TC5wkzCLy2HVYKZIDGZLna1PJToSnXyA/viewform";
      const FEEDBACK_ENTRY_CTX    = "entry.200601468"; // '문제 정보(자동 채움)' 질문
      function deviceInfo(){
        const ua=navigator.userAgent||""; let m,br;
        if(m=ua.match(/SamsungBrowser\/([\d.]+)/)) br="삼성인터넷 "+m[1];
        else if(m=ua.match(/Edg\/([\d.]+)/)) br="Edge "+m[1];
        else if(m=ua.match(/OPR\/([\d.]+)/)) br="Opera "+m[1];
        else if(m=ua.match(/Firefox\/([\d.]+)/)) br="Firefox "+m[1];
        else if(m=ua.match(/Chrome\/([\d.]+)/)) br="Chrome "+m[1];
        else if(m=ua.match(/Version\/([\d.]+).*Safari/)) br="Safari "+m[1];
        else br="알 수 없음";
        let os;
        if(m=ua.match(/Android[^;]*;\s*([^)]+)\)/)) os="Android · "+m[1].replace(/;.*/,"").replace(/\s*Build.*/i,"").trim();
        else if(/iPhone/.test(ua)) os="iPhone (iOS)";
        else if(/iPad/.test(ua)) os="iPad";
        else if(/Windows/.test(ua)) os="Windows";
        else if(/Mac OS X|Macintosh/.test(ua)) os="macOS";
        else os="기타";
        return os+" · "+br;
      }
      function quizContext(){
        const pr=(typeof S!=="undefined"&&S.probs&&S.probs[S.idx])||{}, T=(pr.type&&TYPES[pr.type])||{};
        const viewLabel=(window.THREE&&PRM.dim!=="2d")?"3D 문제":"2D 겨냥도";
        return "(개선·오류 신고 시 아래 정보가 도움이 됩니다. 필요 없으면 지워 주세요.)\n"
          + "유형: "+(T.title||pr.type||"-")+" · 난이도: "+(pr.lv||"-")+" · 문항: "+(S.idx+1)+"/"+S.n+"\n"
          + "보기 형태: "+viewLabel+"\n"
          + "재현 링크: "+location.href+"  (이 링크의 "+(S.idx+1)+"번째 문항)\n"
          + "기기/브라우저: "+deviceInfo()+" · 화면 "+window.innerWidth+"×"+window.innerHeight+"\n"
          + "UA: "+(navigator.userAgent||"")+"\n─────────\n개선/오류 내용: ";
      }
      function feedbackHref(){
        const viewReady=FEEDBACK_VIEWFORM_URL && !/X{4,}/.test(FEEDBACK_VIEWFORM_URL);
        const formReady=FEEDBACK_FORM_URL && !/X{4,}/.test(FEEDBACK_FORM_URL);
        if(FEEDBACK_ENTRY_CTX && viewReady){
          const id=/^entry\./.test(FEEDBACK_ENTRY_CTX)?FEEDBACK_ENTRY_CTX:("entry."+FEEDBACK_ENTRY_CTX);
          return FEEDBACK_VIEWFORM_URL+"?usp=pp_url&"+id+"="+encodeURIComponent(quizContext());
        }
        return formReady?FEEDBACK_FORM_URL:null;
      }
      function openFeedback(){
        track("feedback_open",{prefill:!!FEEDBACK_ENTRY_CTX, idx:(typeof S!=="undefined"?S.idx:-1)});
        const href=feedbackHref();
        if(!href){ alert("의견 폼은 구글폼 생성 후 연결됩니다.\n(FEEDBACK_FORM_URL · FEEDBACK_VIEWFORM_URL · FEEDBACK_ENTRY_CTX 설정)\n\n자동 채움 미리보기:\n\n"+quizContext()); return; }
        window.open(href,"_blank","noopener");
      }

      /* ===== 모양 생성 ===== */
      /* ===== 문제 생성기 = 공용 모듈 GEN.genShape / GEN.genSession ===== */

      /* ===== 아이소 뷰어 = 공용 모듈 cubenest-iso (서버도 같은 모듈로 겨냥도를 그린다) ===== */
      const ISO=(window.CubeNest&&window.CubeNest.iso)||null;
      function renderIso(sh,k,hiSet){ return ISO?ISO.renderIso(sh,k||0,hiSet):""; }
      /* ===== 도형 렌더러 = 공용 모듈 cubenest-figures (worksheets 와 같은 그림을 쓴다) ===== */
      const FIG=(window.CubeNest&&window.CubeNest.figures)||null;
      const renderSil=(sil,color)=>FIG?FIG.renderSil(sil,color):"";
      const frontSil=sh=>FIG.frontSil(sh);
      const sideSil=sh=>FIG.sideSil(sh);
      const topSil=sh=>FIG.topSil(sh);
      const silsOf=sh=>FIG.silsOf(sh);
      const renderThreeViews=sils=>FIG?FIG.renderThreeViews(sils):"";
      const drawDims=sh=>FIG.drawDims(sh);
      // 화면용 '칠하는' 격자(대화형). 종이 답란의 빈 격자는 FIG.renderDrawGrids 가 만든다.
      // views = 서버가 준 그릴 방향. 모양 1개면 세 면, 여러 개면 한 면(난이도 재설계 §4.8).
      //   답란도 이 방향만 내야 한다 — 세 격자를 다 내면 안 물어본 방향이 '빈칸 정답'처럼 보인다.
      function renderDrawInput(sh, views){
        const d=drawDims(sh);
        const vs=(views&&views.length)?views:["top","front","side"];
        const grid=(view)=>{
          const dd=d[view]; if(!dd) return "";
          let cells=""; for(let r=0;r<dd.rows;r++)for(let c=0;c<dd.cols;c++)cells+=`<button type="button" class="dcell" data-c="${c}" data-r="${r}"></button>`;
          const label=view==="top"?"위":view==="front"?"앞":"옆";
          return `<div class="dview"><div class="dgrid" data-view="${view}" style="grid-template-columns:repeat(${dd.cols},24px)">${cells}</div><span>${label}</span></div>`;
        };
        const hint=vs.length===1
          ? `<div class="hint">${vs[0]==="top"?"위":vs[0]==="front"?"앞":"옆"}에서 본 모양만 칠하세요.</div>`
          : `<div class="hint">각 칸을 눌러 칠하세요. 위=발자국, 앞·옆=높이만큼 아래에서 위로.</div>`;
        return `<div class="draw">${vs.map(grid).join("")}</div>`+hint;
      }
      // 최소·최대 해설: 위에서 본 모양 격자에 '불변 높이'(min==max)는 숫자, '변동 칸'(min≠max)은 색칠+범위
      function renderMinMaxTop(mn,mx,gx,gz){
        const c=26,p=6,w=gx*c,h=gz*c; let r="";
        for(let z=0;z<gz;z++)for(let x=0;x<gx;x++){
          const k=x+","+z; if(!(k in mn))continue;
          const a=mn[k],b=mx[k],vary=a!==b,X=p+x*c,Y=p+z*c;
          r+=`<rect x="${X}" y="${Y}" width="${c}" height="${c}" rx="3" fill="${vary?'#ffe6bd':'#eef2f7'}" stroke="${vary?'#e0932f':'#c3ccda'}" stroke-width="${vary?1.5:1}"/>`;
          r+= vary
            ? `<text x="${X+c/2}" y="${Y+c/2}" text-anchor="middle" dominant-baseline="central" font-size="10" font-weight="800" fill="#b5701a">${a}~${b}</text>`
            : `<text x="${X+c/2}" y="${Y+c/2}" text-anchor="middle" dominant-baseline="central" font-size="13" font-weight="800" fill="#2d2d3a">${a}</text>`;
        }
        return `<svg viewBox="0 0 ${w+p*2} ${h+p*2}" xmlns="http://www.w3.org/2000/svg">${r}</svg>`;
      }
      const renderTopNums=(sh,hit)=>FIG?FIG.renderTopNums(sh,hit):"";
      const renderLayers=sh=>FIG?FIG.renderLayers(sh):"";
      // G군 제시 렌더 — G-a=삼면도(sils) / G-b=위모양+한 방향(topOneSil) / G-c=겨냥도+조건(isoTop)
      function renderGGiven(pr){
        const g=pr.given, cap=t=>`<div class="rotcap">${t}</div>`;
        if(g.kind==="topOneSil"){
          const side=g.dir==="side", color=side?"#d0546f":"#4fae72", label=side?"옆":"앞";
          return `<div class="viewer"><div class="rothint" style="text-align:center;margin-bottom:4px">위에서 본 모양과 <b>${label}에서 본 모양</b>이에요</div>`
            +`<div class="threeviews"><div class="pv">${renderSil(g.top,"#3f8fd0")}<span>위</span></div>`
            +`<div class="pv">${renderSil(g.bars,color)}<span>${label}</span></div></div>`
            +cap("두 모양만으로는 <b>개수가 하나로 정해지지 않아요</b>")+`</div>`;
        }
        if(g.kind==="isoTop"){   // G-c: 겨냥도 + "n층 이상" 조건
          return `<div class="viewer"><div id="iso">${g.iso||""}</div>`
            +cap(`<b>${g.n}층 이상</b> 쌓인 칸을 세어요`)+`</div>`;
        }
        return `<div class="viewer"><div class="rothint" style="text-align:center;margin-bottom:4px">위·앞·옆에서 본 모양이에요</div>${renderThreeViews(g.sils)}</div>`;
      }
      // H군 제시 렌더 — H-c=겨냥도 / H-d=겉면 색칠한 정육면체(서버가 파란색으로 그려 보낸다)
      function renderMGiven(pr){
        const g=pr.given, cap=t=>`<div class="rotcap">${t}</div>`;
        if(g.kind==="isoMark"){
          const d=g.delta, txt=d>0?`<b style="color:#c33a4f">빨강으로 표시한 줄</b>에 <b>${d}개를 더 쌓아요</b>`
                                  :`<b style="color:#c33a4f">빨강으로 표시한 줄</b>에서 <b>${-d}개를 빼내요</b>`;
          return `<div class="viewer"><div id="iso">${g.iso||""}</div>${cap(txt)}</div>`;
        }
        if(g.kind==="paintedCube"){
          // 직육면체로 일반화됨(§4.10) — box 가 없는 옛 인스턴스는 정육면체로 되읽는다.
          const b=g.box||[g.n,g.n,g.n];
          const dims=(b[0]===b[1]&&b[1]===b[2])
            ? `한 변이 <b>${b[0]}개</b>인 정육면체`
            : `가로 <b>${b[0]}</b>·세로 <b>${b[1]}</b>·높이 <b>${b[2]}</b>개인 직육면체`;
          return `<div class="viewer"><div id="iso">${g.iso||""}</div>`
            +cap(`${dims}예요. <b>겉면을 모두 색칠</b>한 뒤 낱개로 떼어냅니다`)+`</div>`;
        }
        return `<div class="viewer"><div id="iso">${g.iso||""}</div>`
          +cap("이 모양으로 <b>가장 작은 정육면체</b>를 만들려면?")+`</div>`;
      }
      // 안 보이는 나무 6종 제시 렌더(서브별). 제시물은 서버가 준 pr.given 이 전부다.
      function renderHiddenGiven(pr,sh){
        const g=pr.given, cap=t=>`<div class="rotcap">${t}</div>`;
        if(g.kind==="numTop") return `<div class="viewer">${renderTopNums(sh)}${cap("위에서 본 모양의 각 칸에 쌓인 나무 <b>수</b>예요")}</div>`;
        if(g.kind==="sils")   return `<div class="viewer"><div class="rothint" style="text-align:center;margin-bottom:4px">위·앞·옆에서 본 모양이에요</div>${renderThreeViews(g.sils)}</div>`;
        if(g.kind==="layers") return `<div class="viewer">${renderLayers(sh)}${cap("<b>층별</b>로 나타낸 모양이에요")}</div>`;
        // isoTop (A-a/b/f): 겨냥도는 서버가 그려 보낸 SVG 를 그대로 쓴다.
        // 여기서 클라가 모양으로 다시 그리면 숨은 열의 높이가 클라에 있어야 해 은닉이 깨진다.
        return `<div class="viewer"><div id="iso">${g.iso||""}</div><div class="pv" style="margin-top:6px">${renderSil(g.top,"#3f8fd0")}<span>위에서 본 모양</span></div>${cap("겨냥도에서 <b>안 보이는 나무</b>를 생각해요")}</div>`;
      }
      // 투상 그리드(불리언 2D) → SVG
      function renderProj(g,color){
        const rows=g.length,cols=g[0]?g[0].length:1,s=13,gap=1.5,W=cols*(s+gap)+gap,H=rows*(s+gap)+gap;let r="";
        for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)r+=`<rect x="${gap+x*(s+gap)}" y="${gap+y*(s+gap)}" width="${s}" height="${s}" rx="2" fill="${g[y][x]?color:'var(--line-2)'}"/>`;
        return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${r}</svg>`;
      }
      // 삼투상(위·앞·옆)/육투상(+아래·뒤·좌) 시각자료 — playground 투상 재현
      function projPanel(sh){
        if(window.THREE && VIEWER){
          return `<div class="proj"><div class="proj-seg"><button class="pseg on" data-set="3" type="button">삼투상</button><button class="pseg" data-set="6" type="button">육투상</button></div><div class="explode-host" id="explodeHost"></div><div class="proj-hint">손가락·마우스로 돌려보세요 · 위·앞·옆을 펼쳐 보여줘요</div></div>`;
        }
        // 폴백: 평면 투상 그리드
        const gx=sh.gx,gz=sh.gz,hm=sh.hmap;
        const fH=[],sH=[];
        for(let x=0;x<gx;x++){let m=0;for(let z=0;z<gz;z++)m=Math.max(m,hm[x][z]);fH.push(m);}
        for(let z=0;z<gz;z++){let m=0;for(let x=0;x<gx;x++)m=Math.max(m,hm[x][z]);sH.push(m);}
        const maxH=Math.max(...fH,1),top=[];
        for(let z=0;z<gz;z++){const row=[];for(let x=0;x<gx;x++)row.push(hm[x][z]>0);top.push(row);}
        const bars=(h,rev)=>{const cols=h.length,g=[];for(let y=maxH-1;y>=0;y--){const row=[];for(let c=0;c<cols;c++){const cc=rev?cols-1-c:c;row.push(y<h[cc]);}g.push(row);}return g;};
        const B="#3f8fd0",G="#4fae72",R="#d0546f";
        const pv=(g,color,label,tri)=>`<div class="pv"${tri?' data-tri':''}>${renderProj(g,color)}<span>${label}</span></div>`;
        const views=pv(top,B,"위",1)+pv(top,B,"아래",0)
          +pv(bars(fH,0),G,"앞",1)+pv(bars(fH,1),G,"뒤",0)
          +pv(bars(sH,0),R,"좌",0)+pv(bars(sH,1),R,"옆",1);
        return `<div class="proj"><div class="proj-seg"><button class="pseg on" data-set="3" type="button">삼투상</button><button class="pseg" data-set="6" type="button">육투상</button></div><div class="proj-views" data-show="3">${views}</div></div>`;
      }
      let EXPLODE=null;
      function silSig(s){return s.t==="bars"?"b:"+s.a.join(","):"g:"+s.g.map(r=>r.map(c=>c?1:0).join("")).join("/");}
      function perturbSil(sil,rng){
        const ri=n=>Math.floor(rng()*n);
        if(sil.t==="bars"){
          const a=sil.a.slice(),rows=sil.rows,n=a.length,m=ri(3);
          if(m===0){const i=ri(n);a[i]=Math.max(0,Math.min(rows,a[i]+(rng()<.5?1:-1)));}
          else if(m===1)a.reverse();
          else{const i=ri(n),j=ri(n),t=a[i];a[i]=a[j];a[j]=t;}
          if(a.every(v=>v===0))a[ri(n)]=1;
          return {t:"bars",a,rows};
        }
        const g=sil.g.map(r=>r.slice());g[ri(sil.rows)][ri(sil.cols)]^=1;
        if(g.every(r=>r.every(c=>!c)))g[ri(sil.rows)][ri(sil.cols)]=1;
        return {t:"grid",g:g.map(r=>r.map(c=>!!c)),cols:sil.cols,rows:sil.rows};
      }
      function makeSilOpts(correct,rng){
        const key=silSig(correct),opts=[correct],seen=new Set([key]);let guard=0;
        while(opts.length<4&&guard++<80){const d=perturbSil(correct,rng),k=silSig(d);if(!seen.has(k)){seen.add(k);opts.push(d);}}
        for(let i=opts.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[opts[i],opts[j]]=[opts[j],opts[i]];}
        return {opts,correct:opts.findIndex(o=>silSig(o)===key)};
      }
      // 나침반: 위에서 본 정사각형이 회전(원래 '앞'면=아래 굵은 선). 얼마나·어느 쪽으로 돌렸는지 직관 표시.
      function renderCompass(k){
        const ang=k*90;
        return `<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
          <circle cx="30" cy="30" r="26" fill="var(--panel-2)" stroke="var(--line)"/>
          <g transform="rotate(${ang} 30 30)">
            <rect x="19" y="19" width="22" height="22" rx="3" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width="1.5"/>
            <line x1="19" y1="41" x2="41" y2="41" stroke="var(--accent)" stroke-width="3.4" stroke-linecap="round"/>
            <path d="M30 47 l-3.4 -4.4 h6.8 z" fill="var(--accent)"/>
          </g>
        </svg>`;
      }
      const ARC_CW='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1"/><path d="M20.5 4.5v4.5h-4.5"/></svg>';
      const ARC_CCW='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.5 4.5v4.5h4.5"/></svg>';

      let CURVIEW=null;

      /* ===== 세션 구성 ===== */
      function loadParams(){
        const p=new URLSearchParams(location.search);
        let type=p.get("type");if(!TYPES[type])type="count";
        let levels=(p.get("lv")||"1234").split("").map(c=>LVCODE[c]).filter(Boolean);if(!levels.length)levels=["하","중","상","최상"];
        let n=Math.min(30,Math.max(5,+(p.get("n")||10)));
        let seed=p.get("seed")||Math.random().toString(36).slice(2,9);
        let dim=p.get("dim")||"all"; // 3d=3D 임베드 / 2d=2D 겨냥도 / all=기본(3D)
        let restart=p.get("restart")==="1"; // /my 다시풀기: 저장 세션 제거 후 처음부터
        let view=p.get("view")||"";         // /my 결과보기: view=result → 결과화면
        let sub=p.get("sub")||"";           // 안 보이는 나무 서브 강제(A-a~f)
        // 연령 스테이지(S2~S5). 없으면 서버 기본 S4(초6) — 스테이지를 모르는 링크는 지금까지와 같다.
        //   ⚠ /generate 와 /grade 에 같은 값이 가야 한다(gsig 지문 포함). GRADE_PARAMS 참조.
        let stage=(p.get("stage")||"").toUpperCase(); if(!/^S[2-5]$/.test(stage)) stage="";
        return {type,levels,n,seed,dim,restart,view,sub,stage};
      }
      const PRM=loadParams();
      const S={type:PRM.type,seed:PRM.seed,n:PRM.n,idx:0,probs:[],answered:[],state:[]};
      // 세션 지속(새로고침 이어풀기): 진행 위치·문항별 답·정오·연습장 저장
      // sub 는 뒤에 덧붙인다 — 같은 seed 로 hidden 서브만 바꿔 들어오면 진행상태가 섞이기 때문.
      // (앞에 끼워 넣으면 hidden 이 아닌 기존 세션 키가 전부 바뀌어 이어풀기가 끊긴다.)
      // stage 도 sub 와 같은 이유로 뒤에 덧붙인다 — 스테이지가 다르면 같은 seed 라도 다른 문제다.
      const SKEY="cubenest_quiz_sess_"+[PRM.seed,PRM.type,PRM.n,(PRM.levels||[]).join(""),PRM.edu||"",PRM.dim||""].join("_")+(PRM.sub?"_"+PRM.sub:"")+(PRM.stage?"_"+PRM.stage:"");
      // /my "다시풀기"(restart=1): 저장 세션·연습장 제거 후 처음부터.
      if(PRM.restart){ try{ localStorage.removeItem(SKEY); localStorage.removeItem(SKEY+"_sc"); }catch(e){} }
      function saveSession(){
        try{
          // key·explain 도 함께 저장한다 — 이제 색칠·해설의 출처가 서버 응답이라,
          // 새로고침으로 이어풀기 할 때 이게 없으면 이미 푼 문항의 채점 화면을 복원할 수 없다.
          // (이미 제출해서 본 정보라 저장해도 새로 새는 것은 없다.)
          const state=S.state.map(s=>s?{answered:!!s.answered,ok:!!s.ok,raw:s.raw,key:s.key||null,explain:s.explain||null}:null);
          localStorage.setItem(SKEY,JSON.stringify({idx:S.idx,state,ts:Date.now()}));
          try{ if(SCRATCH) localStorage.setItem(SKEY+"_sc",JSON.stringify(SCRATCH.all())); }catch(e){/* 용량 초과 시 연습장만 생략 */}
        }catch(e){}
      }
      function loadSession(){ try{ const r=localStorage.getItem(SKEY); if(!r)return null; return JSON.parse(r); }catch(e){ return null; } }
      // 답 캡처(제출 시) / 복원(문항 재방문 시)
      function readAnswer(pr){
        const T=TYPES[pr.type], F=pr.form||T.form;
        if(F==="bool"){ return PICK<0?null:PICK; }
        // markCells·draw 는 아무것도 안 고른 상태가 빈 배열이라 예전엔 그대로 '제출'돼 즉시 오답이 됐다.
        // num·hm 처럼 null 을 돌려 제출을 막는다(A-b 는 숨은 칸이 항상 1개 이상이라 빈 답은 언제나 오답).
        if(F==="markCells"){ const a=[]; qcard.querySelectorAll(".mcell.on").forEach(c=>a.push(c.dataset.x+","+c.dataset.z)); return a.length?a:null; }
        if(F==="num"){ const v=parseInt(document.getElementById("ans").value,10); return isNaN(v)?null:v; }
        if(F==="mc"){ return PICK<0?null:PICK; }
        if(F==="hm"){ const a=[]; let bad=false; qcard.querySelectorAll(".hmcell input").forEach(inp=>{const v=parseInt(inp.value,10); if(isNaN(v))bad=true; a.push({x:+inp.dataset.x,z:+inp.dataset.z,v:isNaN(v)?null:v});}); return bad?null:a; }
        if(F==="draw"){ const a=[]; qcard.querySelectorAll(".dcell.on").forEach(c=>{a.push(c.closest(".dgrid").dataset.view+","+c.dataset.c+","+c.dataset.r);}); return a.length?a:null; }
        return null;
      }
      // 답 없이 제출했을 때. 예전엔 조용히 return 해서 제출 버튼이 먹통처럼 보였다.
      const NEEDMSG={ bool:"‘있어요 / 없어요’ 중 하나를 골라요.", markCells:"숨은 것 같은 칸을 한 곳 이상 눌러요.",
                      mc:"보기 중 하나를 골라요.", draw:"칠할 칸을 눌러요.", hm:"색칠된 칸에 수를 모두 써요.", num:"답을 써요.",
                      // 채점 실패 — 답은 그대로 두고 다시 제출하면 된다(문항은 소진되지 않았다).
                      network:"인터넷이 끊겨서 채점하지 못했어요. 연결을 확인하고 <b>다시 제출</b>해 주세요.",
                      rate:"잠시 뒤에 다시 제출해 주세요. (요청이 조금 많았어요)",
                      server:"채점 중 문제가 생겼어요. <b>다시 제출</b>해 주세요." };
      function needAnswer(form){
        const box=qcard.querySelector(".answer"); if(!box)return;
        let el=box.querySelector(".ansnote");
        if(!el){ el=document.createElement("div"); el.className="ansnote"; box.appendChild(el); }
        el.innerHTML=NEEDMSG[form]||NEEDMSG.num;
        el.classList.remove("show"); void el.offsetWidth; el.classList.add("show");   // 연타해도 매번 다시 흔들리게
        const inp=document.getElementById("ans"); if(inp)inp.focus();
      }
      // [PoC 2단계] 저장된 raw → API v0.3 answer 객체(서버 채점용). 현재 num·hm(markCount)만.
      function answerObj(pr,raw){
        const T=TYPES[pr.type], F=pr.form||T.form;
        if(F==="bool"){ return {type:"bool", value: raw===1}; }
        if(F==="markCells"){ return {type:"markCells", cells:(raw||[]).slice()}; }
        if(F==="num"){ return {type:"num", value:raw}; }
        if(F==="hm"){ const grid={}; (raw||[]).forEach(c=>{ if(c.v!=null) grid[c.x+","+c.z]=c.v; }); return {type:"markCount", grid}; }
        if(F==="mc"){ return {type:"mc", pick:raw}; }
        if(F==="draw"){ return {type:"drawSil", cells:(raw||[]).slice()}; }
        return null;
      }
      function GRADE_PARAMS(){ return {type:PRM.type, levels:PRM.levels, n:PRM.n, edu:PRM.edu, config:GEN_CONFIG, sub:PRM.sub||undefined, stage:PRM.stage||undefined}; }
      function applyAnswer(pr,raw){
        const T=TYPES[pr.type], F=pr.form||T.form; if(raw==null)return;
        if(F==="bool"){ PICK=raw; qcard.querySelectorAll(".boolopt").forEach(o=>o.classList.toggle("sel",+o.dataset.b===raw)); }
        else if(F==="markCells"){ const set=new Set(raw); qcard.querySelectorAll(".mcell").forEach(c=>c.classList.toggle("on",set.has(c.dataset.x+","+c.dataset.z))); }
        else if(F==="num"){ const el=document.getElementById("ans"); if(el)el.value=raw; }
        else if(F==="mc"){ PICK=raw; qcard.querySelectorAll(".opt").forEach((o,i)=>o.classList.toggle("sel",i===raw)); }
        else if(F==="hm"){ raw.forEach(c=>{const inp=qcard.querySelector('.hmcell input[data-x="'+c.x+'"][data-z="'+c.z+'"]'); if(inp&&c.v!=null)inp.value=c.v;}); }
        else if(F==="draw"){ const set=new Set(raw); qcard.querySelectorAll(".dcell").forEach(cell=>{cell.classList.toggle("on",set.has(cell.closest(".dgrid").dataset.view+","+cell.dataset.c+","+cell.dataset.r));}); }
      }
      // [PoC 1단계] 생성만 서버 API 경유(async). 채점·해설은 아직 로컬(다음 단계).
      async function buildSession(){
        S.probs=[];
        const resp=await CubeNest.api.generate({theme:PRM.type,given:[],ask:null,levels:PRM.levels,seed:PRM.seed,n:PRM.n,config:GEN_CONFIG,edu:PRM.edu,sub:PRM.sub||undefined,stage:PRM.stage||undefined});
        resp.problems.forEach((p,i)=>{
          const gp=p._gp;                       // 서버 생성 인스턴스(정답 필드는 들어 있지 않다)
          const lv=gp.level;
          // minmax·hidden 은 모양(sh)을 받지 않는다 — 제시물(given)만 온다.
          // 답은 전부 /grade 가 준다. 여기서 로컬 정답을 만들면 은닉이 도로 깨진다.
          const sh=gp.sh||(gp.given?givenShape(gp.given):null);
          // 발문·답 형식·단위는 **서버가 준 것을 그대로 쓴다**(gp.ask/form/unit).
          // 예전엔 여기서 유형·서브별로 조립했는데, worksheets 문제지가 같은 문구를 써야 해서
          // 두 곳이 각자 만들면 반드시 표류한다(§8.1) → 서버 단일 출처로 옮겼다.
          const pr={type:PRM.type,lv,sh,given:gp.given||null,id:p.id,gsig:p.gsig,
                    ask:gp.ask, form:gp.form, unit:gp.unit, sub:gp.sub||null,
                    stage:gp.stage||null, dim:gp.dim||null};   // 스테이지·보기형태는 서버가 정한다
          if(PRM.type==="facesMc"){ pr.opts=gp.opts; pr.dir=gp.dir; }   // 정답 인덱스는 안 온다
          if(PRM.type==="minmax"){ pr.which=gp.which; pr.dir=gp.dir; pr.n=gp.n; }
          if(PRM.type==="manip"){ pr.n=gp.n; pr.k=gp.k; pr.delta=gp.delta; pr.box=gp.box||null; }
          if(PRM.type==="facesDraw"){ pr.views=gp.views||null; }   // 그릴 방향(§4.8)
          if(PRM.type==="hidden"){ pr.which=gp.which; }
          S.probs.push(pr);
        });
      }

      /* ===== 렌더 ===== */
      const qcard=document.getElementById("qcard"),resultEl=document.getElementById("result");
      let ROT=0,PICK=-1;
      function renderProblem(){
        ROT=0;PICK=-1;
        const pr=S.probs[S.idx],T=TYPES[pr.type],sh=pr.sh;
        document.getElementById("pg-type").textContent=T.title;
        updateProgress();
        let ans="";
        const form=pr.form||T.form;
        if(form==="bool"){
          ans=`<div class="opts boolopts"><button type="button" class="opt boolopt" data-b="1">있어요</button><button type="button" class="opt boolopt" data-b="0">없어요</button></div>`;
        }else if(form==="markCells"){
          let mc=""; for(let z=0;z<sh.gz;z++)for(let x=0;x<sh.gx;x++){ const on=sh.hmap[x][z]>0;
            mc+= on ? `<button type="button" class="mcell" data-x="${x}" data-z="${z}" style="grid-column:${x+1};grid-row:${z+1}"></button>`
                    : `<div class="mcell empty" style="grid-column:${x+1};grid-row:${z+1}"></div>`; }
          // 44px = 터치 타깃 최소치(마스터 UI 규약). index.html 의 .mcell 크기와 같은 값이어야 한다.
          ans=`<div class="markgrid" style="grid-template-columns:repeat(${sh.gx},44px)">${mc}</div><div class="hint">안 보이게 숨었을 것 같은 칸을 눌러요(여러 칸 가능).</div>`;
        }else if(form==="num"){
          ans=`<div class="numin"><input id="ans" type="number" inputmode="numeric" autocomplete="off" placeholder="?"/><span class="unit">${pr.unit||T.unit}</span></div>`;
        }else if(form==="hm"){
          let cells="";
          for(let z=0;z<sh.gz;z++)for(let x=0;x<sh.gx;x++){
            const h=sh.hmap[x][z];
            cells+=`<div class="hmcell ${h>0?'fill':'empty'}" style="grid-column:${x+1};grid-row:${z+1}">${h>0?`<input data-x="${x}" data-z="${z}" type="number" inputmode="numeric" min="1" max="${sh.maxH}"/>`:''}</div>`;
          }
          ans=`<div class="hmgrid" style="grid-template-columns:repeat(${sh.gx},42px)">${cells}</div><div class="hint">색칠된 칸(위에서 보이는 칸)에만 수를 써요.</div>`;
        }else if(form==="mc"){
          ans=`<div class="opts">${pr.opts.map((v,i)=>`<button class="opt" data-i="${i}">${renderSil(v)}</button>`).join("")}</div>`;
        }else if(form==="draw"){
          ans=renderDrawInput(sh, pr.views);
        }
        const askText=pr.ask||T.ask;
        const edgeTxt=T.edge?`<br>쌓기나무 한 모서리 = ${sh.edge}cm`:"";
        const isViews=pr.type==="minmax";
        const isHidden=pr.type==="hidden";
        const isManip=pr.type==="manip";
        // 저학년(S2·S3)은 정적 겨냥도를 아직 안 배웠다 — 겨냥도는 초5 교과다.
        //   서버가 문항마다 dim 을 내려보내므로(gen-adapter) 클라가 따로 판단하지 않는다.
        //   dim==="3d" 면 URL 의 ?dim=2d 보다 서버 판단이 우선한다.
        const force3D=(pr.dim||"any")==="3d";
        const has3D=!!window.THREE && !!VIEWER && (force3D || PRM.dim!=="2d") && !isViews && !isHidden && !isManip;
        const gk=(pr.given&&pr.given.kind)||"";
        const GIVENLABEL={numTop:"위에서 본 수",sils:"위·앞·옆",layers:"층별 모양",topOneSil:"위 + 한 방향",isoTop:"2D 겨냥도",paintedCube:"색칠한 정육면체"};
        const viewLabel=(isViews||isHidden||isManip)?(GIVENLABEL[gk]||"2D 겨냥도"):(has3D?"3D 문제":"2D 겨냥도");
        const viewerHTML=isViews
          ? renderGGiven(pr)
          : isManip
          ? renderMGiven(pr)
          : isHidden
          ? renderHiddenGiven(pr,sh)
          : (has3D
          ? `<div class="viewer"><div id="v3d" class="v3d"></div><div class="rotrow2"><div class="rothint">손가락·마우스로 <b>돌려서</b> 위·앞·옆을 확인해요</div><button id="reset3d" class="rotbtn2" type="button">정면</button></div></div>`
          : `<div class="viewer"><div id="iso">${renderIso(sh,0)}</div><div class="rotrow"><button id="rl" class="rotbtn wide" type="button" aria-label="왼쪽으로 90도 돌리기">${ARC_CCW}<span>90°</span></button><div id="compass" class="compass" aria-hidden="true">${renderCompass(0)}</div><button id="rr" class="rotbtn wide" type="button" aria-label="오른쪽으로 90도 돌리기">${ARC_CW}<span>90°</span></button></div><div class="rotcap" id="rotcap">버튼으로 쌓기나무를 <b>돌려서</b> 뒤·옆면을 확인해요</div></div>`);
        qcard.innerHTML=`
          <div class="qhead"><span class="lv">${pr.lv}</span><span class="mode">${viewLabel}</span><button type="button" id="feedbackBtn" class="qfb" aria-label="이 문제에 의견 보내기"><svg viewBox="0 0 24 24" fill="none"><path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg><span>의견</span></button></div>
          <div class="qnav"><div class="qnav-dots" id="palette"></div><button class="qnav-result" id="resultBtn" type="button" disabled>결과 보기</button></div>
          <div class="qtext"><b class="qnum">${S.idx+1}번</b> ${askText}${edgeTxt}</div>
          ${viewerHTML}
          <div class="answer">${ans}</div>`;
        if(CURVIEW&&CURVIEW.dispose){CURVIEW.dispose();CURVIEW=null;} if(EXPLODE&&EXPLODE.dispose){EXPLODE.dispose();EXPLODE=null;} disposeExpViews();
        if(!isViews && !isHidden && !isManip){
        if(has3D){
          CURVIEW=VIEWER.createViewer(document.getElementById("v3d"),{THREE:window.THREE,shape:coreShape(sh),showLabels:true});
          const rb=document.getElementById("reset3d"); if(rb)rb.onclick=()=>{CURVIEW&&CURVIEW.reset();track("quiz_view_reset",{});};
        }else{
          const updRot=()=>{document.getElementById("iso").innerHTML=renderIso(sh,ROT);document.getElementById("compass").innerHTML=renderCompass(ROT);document.getElementById("rotcap").innerHTML=`버튼으로 쌓기나무를 <b>돌려서</b> 뒤·옆면을 확인해요`;};
          document.getElementById("rl").onclick=()=>{ROT=(ROT+3)%4;updRot();track("quiz_rotate",{dir:"ccw",deg:ROT*90});};
          document.getElementById("rr").onclick=()=>{ROT=(ROT+1)%4;updRot();track("quiz_rotate",{dir:"cw",deg:ROT*90});};
        }
        }
        if(SCRATCH) SCRATCH.show(S.idx);
        const fb0=document.getElementById("fb"); fb0.className="fb"; fb0.innerHTML=""; fb0.hidden=false;
        // ⚠ 반드시 form(=pr.form||T.form)으로 판단할 것. T.form 만 보면 유형 기본 폼과 다른
        //   서브(H-a/H-b 는 manip 이지만 draw)에서 격자만 그려지고 클릭이 안 먹는다.
        if(form==="mc"){qcard.querySelectorAll(".opt").forEach(b=>b.onclick=()=>{if(b.classList.contains("done"))return;PICK=+b.dataset.i;qcard.querySelectorAll(".opt").forEach(o=>o.classList.remove("sel"));b.classList.add("sel");});}
        if(form==="draw"){qcard.querySelectorAll(".dcell").forEach(b=>b.onclick=()=>{if(!b.disabled)b.classList.toggle("on");});}
        if((pr.form||T.form)==="bool"){qcard.querySelectorAll(".boolopt").forEach(b=>b.onclick=()=>{if(b.classList.contains("done"))return;PICK=+b.dataset.b;qcard.querySelectorAll(".boolopt").forEach(o=>o.classList.remove("sel"));b.classList.add("sel");});}
        if((pr.form||T.form)==="markCells"){qcard.querySelectorAll(".mcell:not(.empty)").forEach(b=>b.onclick=()=>{if(b.style.pointerEvents!=="none")b.classList.toggle("on");});}
        document.getElementById("feedbackBtn").onclick=openFeedback;
        const st=S.state[S.idx];
        if(st && st.answered){          // 이미 푼 문항: 답 복원 + 채점 상태 재구성(잠금)
          applyAnswer(pr,st.raw);
          submit(true);
        }else{                          // 새 문항: 답 가능
          document.getElementById("actions").hidden=false;
          setActions();
          const first=qcard.querySelector("input");if(first)first.focus();
        }
      }
      // 연습장 — 정적 HTML(#scratch) 1회 초기화. 문제 표시 때 SCRATCH.show()로 크기 맞춤·초기화.
      let SCRATCH=null;
      function initScratch(){
        const box=document.getElementById("scratch"), wrap=document.getElementById("scWrap");
        const cvC=document.getElementById("scratchpad"), cvT=document.getElementById("scratchpad-tutor");
        if(!box||!wrap||!cvC||!cvT)return;
        const dpr=Math.min(window.devicePixelRatio||1,2);
        const L={ child:{cv:cvC,ctx:cvC.getContext("2d"),pen:"#2d2d3a"}, tutor:{cv:cvT,ctx:cvT.getContext("2d"),pen:"#e0455e"} };
        const PEN=2.6*dpr, ERA=18*dpr;
        let eraser=false, tutorMode=false;
        const store={}; let curIdx=null; const tutorUsed={};   // store[idx]={child:[stroke..],tutor:[stroke..]} — stroke={c,w(폭/캔버스폭),e,p:[[nx,ny]..0..1]}
        const childLocked=()=> !!(curIdx!=null && S.state[curIdx] && S.state[curIdx].answered);
        const active=()=> tutorMode?L.tutor:L.child;
        const canDraw=()=> tutorMode ? isLoggedIn() : !childLocked();
        // ── 벡터 저장: PNG 대신 획(stroke) 배열. 해상도무관 재생·용량 1/10~1/50·크로스기기. ──
        function ensure(idx){ if(idx==null)return {child:[],tutor:[]}; if(!store[idx]||!Array.isArray(store[idx].child)) store[idx]={child:[],tutor:[]}; return store[idx]; }
        function strokesOf(idx,key){ const r=store[idx]; return (r&&Array.isArray(r[key]))?r[key]:[]; }
        function sizeBoth(w,h){ [cvC,cvT].forEach(c=>{c.width=w;c.height=h;const x=c.getContext("2d");x.lineCap="round";x.lineJoin="round";}); }
        // 한 레이어 획들을 현재 캔버스 크기로 재생(정규화 0..1 → 픽셀)
        function drawStrokes(ctx,ss,w,h){ ctx.clearRect(0,0,w,h);
          for(const s of ss){ if(!s.p||!s.p.length)continue;
            ctx.globalCompositeOperation=s.e?"destination-out":"source-over"; ctx.strokeStyle=s.c||"#2d2d3a"; ctx.lineWidth=Math.max(0.5,(s.w||0.004)*w);
            ctx.beginPath(); ctx.moveTo(s.p[0][0]*w,s.p[0][1]*h);
            if(s.p.length===1)ctx.lineTo(s.p[0][0]*w+0.1,s.p[0][1]*h); else for(let i=1;i<s.p.length;i++)ctx.lineTo(s.p[i][0]*w,s.p[i][1]*h);
            ctx.stroke(); }
          ctx.globalCompositeOperation="source-over"; }
        function replayLayer(key){ const a=L[key]; drawStrokes(a.ctx,strokesOf(curIdx,key),a.cv.width,a.cv.height); }
        function redraw(){ replayLayer("child"); replayLayer("tutor"); }
        function saveCur(){ /* 획 커밋 시점에 store 갱신됨 — 호환용 훅(무동작) */ }
        function doUndo(){ if(!canDraw())return; const key=tutorMode?"tutor":"child"; const ss=strokesOf(curIdx,key); if(!ss.length)return; ss.pop(); replayLayer(key); }
        // 리사이즈: 크기 다르면 재설정 후 획 재생(래스터 복사 불필요)
        function fitKeep(){ const r=wrap.getBoundingClientRect(); if(r.width<1)return;
          const w=Math.max(1,Math.round(r.width*dpr)), h=Math.max(1,Math.round(r.height*dpr));
          if(cvC.width===w&&cvC.height===h)return; sizeBoth(w,h); redraw(); }
        // 문항 진입: 크기 맞추고 두 레이어 재생
        function fitFor(idx){ const r=wrap.getBoundingClientRect(); if(r.width<1)return;
          sizeBoth(Math.max(1,Math.round(r.width*dpr)),Math.max(1,Math.round(r.height*dpr))); redraw(); }
        const pos=e=>{const r=wrap.getBoundingClientRect();return [(e.clientX-r.left)/(r.width||1),(e.clientY-r.top)/(r.height||1)];}; // 정규화 0..1
        let drawing=false, cur=null;
        wrap.addEventListener("pointerdown",e=>{ if(!canDraw()||curIdx==null)return; drawing=true; const a=active(),cv=a.cv; const [nx,ny]=pos(e);
          cur={c:a.pen,w:+((eraser?ERA:PEN)/cv.width).toFixed(4),e:eraser?1:0,p:[[+nx.toFixed(4),+ny.toFixed(4)]]};
          a.ctx.globalCompositeOperation=eraser?"destination-out":"source-over"; a.ctx.lineWidth=eraser?ERA:PEN; a.ctx.strokeStyle=a.pen;
          // 탭 한 번(점 하나)도 바로 보이게 — drawStrokes 의 단일점 처리와 같은 모양.
          a.ctx.beginPath(); a.ctx.moveTo(nx*cv.width,ny*cv.height); a.ctx.lineTo(nx*cv.width+0.1,ny*cv.height); a.ctx.stroke();
          wrap.setPointerCapture&&wrap.setPointerCapture(e.pointerId); if(tutorMode)tutorUsed[curIdx]=true; });
        // 이동마다 '직전점→현재점' 1구간만 새 경로로 그린다. 경로를 누적하면 stroke() 가
        // 매번 획 전체를 다시 래스터화해 점 수에 비례해 느려진다(600점에서 1회 0.9ms).
        // lineCap/lineJoin 이 round 이고 색이 불투명이라 화면 결과는 누적 경로와 동일하다.
        wrap.addEventListener("pointermove",e=>{ if(!drawing||!cur)return; const a=active(),cv=a.cv; const [nx,ny]=pos(e);
          const last=cur.p[cur.p.length-1]; if(last&&Math.abs(last[0]-nx)<0.0015&&Math.abs(last[1]-ny)<0.0015)return; // 과밀 방지
          a.ctx.beginPath(); a.ctx.moveTo(last[0]*cv.width,last[1]*cv.height); a.ctx.lineTo(nx*cv.width,ny*cv.height); a.ctx.stroke();
          cur.p.push([+nx.toFixed(4),+ny.toFixed(4)]); e.preventDefault(); });
        const end=()=>{ if(drawing&&cur){ const rec=ensure(curIdx); rec[tutorMode?"tutor":"child"].push(cur); } cur=null; drawing=false; };
        wrap.addEventListener("pointerup",end);wrap.addEventListener("pointercancel",end);wrap.addEventListener("pointerleave",end);
        // 아이 도구
        const er=document.getElementById("eraser");
        box.querySelectorAll(".scratch-left .pen").forEach(b=>b.onclick=()=>{ if(childLocked())return; L.child.pen=b.dataset.col; eraser=false; box.querySelectorAll(".scratch-left .pen").forEach(p=>p.classList.remove("on")); b.classList.add("on"); if(er)er.classList.remove("on"); });
        if(er)er.onclick=()=>{ if(childLocked())return; eraser=!eraser; er.classList.toggle("on",eraser); if(eraser)box.querySelectorAll(".scratch-left .pen").forEach(p=>p.classList.remove("on")); else{const on=box.querySelector(".scratch-left .pen");if(on)on.classList.add("on");L.child.pen=on?on.dataset.col:L.child.pen;} };
        const un=document.getElementById("scratchUndo"); if(un)un.onclick=()=>{ if(childLocked())return; doUndo(); };
        const clr=document.getElementById("scratchClear"); if(clr)clr.onclick=()=>{ if(childLocked())return; ensure(curIdx).child=[]; replayLayer("child"); };
        // 첨삭 도구(tutor 레이어)
        box.querySelectorAll(".tpen").forEach(b=>b.onclick=()=>{ L.tutor.pen=b.dataset.col; eraser=false; box.querySelectorAll(".tpen").forEach(p=>p.classList.remove("on")); b.classList.add("on"); const te=document.getElementById("tutorEraser"); if(te)te.classList.remove("on"); });
        const tEra=document.getElementById("tutorEraser"); if(tEra)tEra.onclick=()=>{ eraser=!eraser; tEra.classList.toggle("on",eraser); if(!eraser){const on=box.querySelector(".tpen.on")||box.querySelector(".tpen");if(on){L.tutor.pen=on.dataset.col;}} };
        const tUndo=document.getElementById("tutorUndo"); if(tUndo)tUndo.onclick=()=>{ if(!tutorMode)return; doUndo(); };
        const tClr=document.getElementById("tutorClear"); if(tClr)tClr.onclick=()=>{ if(!tutorMode)return; ensure(curIdx).tutor=[]; tutorUsed[curIdx]=true; replayLayer("tutor"); };
        // 첨삭 바 상태: 잠금 여부·로그인 여부·첨삭 모드에 따라
        function renderTutorBar(){
          const tut=document.getElementById("scratchTutor"); if(!tut)return;
          const locked=childLocked(); tut.hidden=!locked;
          const tools=document.getElementById("tutorTools"), loginB=document.getElementById("tutorLoginBtn"), startB=document.getElementById("tutorBtn");
          if(!locked){ tutorMode=false; if(tools)tools.hidden=true; return; }
          const authed=isLoggedIn();
          if(tools)tools.hidden=!tutorMode;
          if(loginB)loginB.hidden=authed;
          if(startB)startB.hidden=(!authed||tutorMode);
        }
        function enterTutor(){ if(!isLoggedIn())return; eraser=false; tutorMode=true; renderTutorBar(); }
        function exitTutor(){ eraser=false; tutorMode=false; renderTutorBar(); }
        const loginB=document.getElementById("tutorLoginBtn");
        if(loginB)loginB.onclick=()=>{ AUTH ? AUTH.requireLogin("scratch") : alert("로그인 기능을 불러오지 못했어요."); };
        // 모달에서 로그인/로그아웃하면 첨삭 바를 즉시 갱신(새로고침 불필요)
        if(AUTH) AUTH.onAuthChange(()=>{ if(!isLoggedIn()&&tutorMode) exitTutor(); else renderTutorBar(); });
        const startB=document.getElementById("tutorBtn"); if(startB)startB.onclick=()=>enterTutor();
        const tDone=document.getElementById("tutorDone"); if(tDone)tDone.onclick=exitTutor;
        // 접기
        const fold=document.getElementById("scratchFold"), foldtxt=document.getElementById("foldtxt");
        const setFoldTxt=()=>{ if(foldtxt) foldtxt.textContent=box.classList.contains("collapsed")?"펼치기":"접기"; };
        if(localStorage.getItem("cubenest_scratch_fold")==="1") box.classList.add("collapsed");
        setFoldTxt();
        if(fold)fold.onclick=()=>{const c=box.classList.toggle("collapsed");localStorage.setItem("cubenest_scratch_fold",c?"1":"0");setFoldTxt();if(!c)requestAnimationFrame(fitKeep);};
        window.addEventListener("resize",()=>{ if(!box.hidden && !box.classList.contains("collapsed")) fitKeep(); });
        // 문제지 임베드용: 벡터 획 → PNG dataURL(오프스크린 렌더). 저장은 벡터, 출력만 이미지.
        function renderDataURL(idx,key){ const ss=strokesOf(idx,key); if(!ss.length)return null;
          const w=cvC.width||600, h=cvC.height||400; const oc=document.createElement("canvas"); oc.width=w; oc.height=h;
          const ctx=oc.getContext("2d"); ctx.lineCap="round"; ctx.lineJoin="round"; drawStrokes(ctx,ss,w,h);
          try{ return oc.toDataURL("image/png"); }catch(e){ return null; } }
        SCRATCH={
          show(idx){ box.hidden=false; curIdx=idx; tutorMode=false; box.classList.toggle("locked",childLocked()); renderTutorBar(); if(!box.classList.contains("collapsed")) requestAnimationFrame(()=>fitFor(idx)); },
          hide(){ box.hidden=true; },
          relock(){ if(curIdx==null)return; box.classList.toggle("locked",childLocked()); renderTutorBar(); },
          // 문제지 병기용: 벡터→PNG 변환(호환)
          get(idx){ const i=idx!=null?idx:curIdx; const c=renderDataURL(i,"child"), t=renderDataURL(i,"tutor"); return (c||t)?{child:c,tutor:t}:null; },
          // 저장/복원: 벡터 그대로(용량 최소·클라우드 동기화 준비). 레거시(dataURL)는 무시.
          all(){ const o={}; for(const k in store){ const r=store[k]; if(r&&Array.isArray(r.child)) o[k]={child:r.child,tutor:Array.isArray(r.tutor)?r.tutor:[]}; } return o; },
          load(obj){ try{ for(const k in (obj||{})){ const r=obj[k]; if(r&&Array.isArray(r.child)) store[k]={child:r.child,tutor:Array.isArray(r.tutor)?r.tutor:[]}; } }catch(e){} }
        };
      }

      /* ===== 효과음 + 음소거 ===== */
      let MUTED=(localStorage.getItem("cubenest_quiz_muted")==="1"); let ACTX=null;
      function playSound(ok){
        if(MUTED) return;
        try{
          const Ctx=window.AudioContext||window.webkitAudioContext; if(!Ctx) return;
          ACTX=ACTX||new Ctx(); if(ACTX.state==="suspended") ACTX.resume();
          const t0=ACTX.currentTime;
          const master=ACTX.createGain(); master.gain.value=0.9; master.connect(ACTX.destination);
          // 벨/종소리 한 음: 배음(1·2.01·3·4.2) + 빠른 어택 + 긴 지수감쇠
          const bell=(freq,when,dur,peak)=>{
            [[1,1],[2.01,0.55],[3.0,0.3],[4.2,0.16]].forEach(([r,a])=>{
              const o=ACTX.createOscillator(), g=ACTX.createGain();
              o.type="sine"; o.frequency.value=freq*r;
              o.connect(g); g.connect(master);
              const s=t0+when;
              g.gain.setValueAtTime(0.0001,s);
              g.gain.exponentialRampToValueAtTime(peak*a, s+0.006);
              g.gain.exponentialRampToValueAtTime(0.0001, s+dur);
              o.start(s); o.stop(s+dur+0.05);
            });
          };
          if(ok){ bell(523.25,0,.9,.42); bell(659.25,.13,.95,.42); bell(783.99,.26,1.2,.48); }
          else { bell(440,0,1.1,.52); bell(329.63,.2,1.4,.52); }
        }catch(e){}
      }
      const muteBtn=document.getElementById("muteBtn");
      function muteIcon(){
        return MUTED
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16 9l5 6M21 9l-5 6"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8 8 0 0 1 0 12"/></svg>';
      }
      function refreshMute(){ if(muteBtn){muteBtn.innerHTML=muteIcon(); muteBtn.classList.toggle("on",!MUTED); muteBtn.setAttribute("aria-pressed", MUTED?"true":"false");} }
      if(muteBtn) muteBtn.addEventListener("click",()=>{ MUTED=!MUTED; try{localStorage.setItem("cubenest_quiz_muted",MUTED?"1":"0");}catch(e){} refreshMute(); if(!MUTED) playSound(true); });
      refreshMute();

      /* ===== 채점 캐릭터 (브랜드 큐브 버디) ===== */
      function gradeSVG(ok){
        if(ok){
          return `<svg viewBox="0 0 220 210" xmlns="http://www.w3.org/2000/svg">
            <g fill="#f4c542">
              <path class="spark s1" d="M46 44 l4 11 11 4 -11 4 -4 11 -4 -11 -11 -4 11 -4z"/>
              <path class="spark s2" d="M182 34 l3.2 8 8 3.2 -8 3.2 -3.2 8 -3.2 -8 -8 -3.2 8 -3.2z"/>
              <path class="spark s3" d="M190 98 l3 7.5 7.5 3 -7.5 3 -3 7.5 -3 -7.5 -7.5 -3 7.5 -3z"/>
            </g>
            <circle class="mark markO" cx="110" cy="66" r="40" fill="none" stroke="#0f9d58" stroke-width="12" stroke-linecap="round"/>
            <g class="buddy">
              <path d="M70 130 L110 118 L150 130 L110 142z" fill="#f0d9b4" stroke="#c8965a" stroke-width="2.5" stroke-linejoin="round"/>
              <rect x="70" y="130" width="80" height="64" rx="11" fill="#e6c9a0" stroke="#c8965a" stroke-width="3"/>
              <rect x="53" y="132" width="10" height="26" rx="5" fill="#d8a76e" transform="rotate(30 58 145)"/>
              <rect x="157" y="132" width="10" height="26" rx="5" fill="#d8a76e" transform="rotate(-30 162 145)"/>
              <path d="M85 153 q6 -8 12 0" fill="none" stroke="#5b4327" stroke-width="4" stroke-linecap="round"/>
              <path d="M123 153 q6 -8 12 0" fill="none" stroke="#5b4327" stroke-width="4" stroke-linecap="round"/>
              <ellipse cx="83" cy="168" rx="6" ry="4" fill="#e88f96" opacity=".65"/>
              <ellipse cx="137" cy="168" rx="6" ry="4" fill="#e88f96" opacity=".65"/>
              <path d="M99 166 q11 14 22 0 z" fill="#8a4a3a"/>
            </g>
          </svg>`;
        }
        return `<svg viewBox="0 0 220 210" xmlns="http://www.w3.org/2000/svg">
          <path class="mark markX1" d="M84 40 L136 92" fill="none" stroke="#e0466b" stroke-width="12" stroke-linecap="round"/>
          <path class="mark markX2" d="M136 40 L84 92" fill="none" stroke="#e0466b" stroke-width="12" stroke-linecap="round"/>
          <g class="buddy">
            <path d="M70 130 L110 118 L150 130 L110 142z" fill="#f0d9b4" stroke="#c8965a" stroke-width="2.5" stroke-linejoin="round"/>
            <rect x="70" y="130" width="80" height="64" rx="11" fill="#e6c9a0" stroke="#c8965a" stroke-width="3"/>
            <rect x="57" y="142" width="10" height="24" rx="5" fill="#d8a76e"/>
            <rect x="153" y="142" width="10" height="24" rx="5" fill="#d8a76e"/>
            <circle cx="92" cy="156" r="6" fill="#5b4327"/>
            <circle cx="128" cy="156" r="6" fill="#5b4327"/>
            <circle cx="94.3" cy="153.6" r="2" fill="#fff"/>
            <circle cx="130.3" cy="153.6" r="2" fill="#fff"/>
            <path d="M85 147 q7 -3.5 13 0" fill="none" stroke="#5b4327" stroke-width="2.4" stroke-linecap="round" opacity=".55"/>
            <path d="M135 147 q-7 -3.5 -13 0" fill="none" stroke="#5b4327" stroke-width="2.4" stroke-linecap="round" opacity=".55"/>
            <path class="sweat" d="M150 150 q6 9 0 14 q-6 -5 0 -14z" fill="#7cc6e8"/>
            <ellipse cx="110" cy="177" rx="5.2" ry="4.4" fill="#8a4a3a"/>
          </g>
        </svg>`;
      }
      function playGrade(ok){
        const fx=document.createElement("div");
        fx.className="gradefx "+(ok?"correct":"wrong");
        fx.innerHTML=`<div class="fxword ${ok?'good':'oops'}">${ok?'Good!':'Oops!'}</div>`+gradeSVG(ok);
        qcard.appendChild(fx);
        setTimeout(()=>{ fx.remove(); }, 1400);
      }
      // 채점·색칠·해설의 단일 출처는 /grade 응답이다.
      //   answerKey → 색칠 · explain → 해설 그림.
      //   예전엔 클라가 pr.sh 로 정답을 다시 계산해 색칠했는데, 그러려면 모양(=정답의 원천)을
      //   클라가 갖고 있어야 해서 은닉이 원천적으로 불가능했다. 서버는 이미 두 필드를 다 보내고
      //   있었고 클라가 res.correct 한 줄만 쓰고 버리던 것을, 이제 제대로 쓴다.
      async function submit(revisit){
        const pr=S.probs[S.idx],T=TYPES[pr.type],F=pr.form||T.form;
        if(!revisit){
          const raw=readAnswer(pr);
          if(raw===null){ needAnswer(F); return; }
          const note=qcard.querySelector(".ansnote"); if(note)note.remove();
          const sb0=document.getElementById("submit"); if(sb0)sb0.disabled=true;
          let res;
          try{
            res=await CubeNest.api.grade({id:pr.id, gsig:pr.gsig, answer:answerObj(pr,raw), params:GRADE_PARAMS()});
          }catch(e){
            // 실패해도 문항을 소진하지 않는다 — 답을 그대로 두고 다시 제출할 수 있다.
            if(sb0)sb0.disabled=false;
            needAnswer(e&&e.rate?"rate":(e&&e.network?"network":"server"));
            return;
          }
          S.state[S.idx]={answered:true,raw:raw,ok:!!res.correct,key:res.answerKey||null,explain:res.explain||null};
        }
        const st=S.state[S.idx]||{}, key=st.key||{}, ok=!!st.ok;
        // 해설용 모양 — 제출 후엔 밝혀도 되므로 explain 으로 되만든다(은닉 유형은 이때 처음 받는다).
        const sh=(st.explain&&shFromCells(st.explain))||pr.sh;
        let sol="";
        if(F==="num"){
          const a=key.value;
          if(pr.type==="manip"){                             // H군 해설
            const ex=st.explain||{};
            if(pr.sub==="H-d"){
              const all=ex.all||[], lab=["색칠 안 됨(속)","한 면(면)","두 면(모서리)","세 면(꼭짓점)"];
              const rows=all.map((v,i)=>`<div${i===pr.k?' style="font-weight:800;color:var(--accent-ink)"':''}>${lab[i]} : <b>${v}개</b>${i===pr.k?' ← 물어본 것':''}</div>`).join("");
              sol=`<div class="sol-list"><div class="mm-txt">한 변 <b>${ex.n}</b>인 정육면체는 자리에 따라 색칠된 면 수가 정해져요 — `
                +`<b>꼭짓점 8개</b>는 세 면, <b>모서리</b>는 두 면, <b>면 가운데</b>는 한 면, <b>속</b>은 색이 안 묻어요.</div>`
                +rows+`<div style="margin-top:6px">모두 더하면 ${all.reduce((a,b)=>a+b,0)}개 = ${ex.n}×${ex.n}×${ex.n} 이에요.</div></div>`;
            }else{
              sol=`<div class="sol-methods"><div class="sol-pic">${renderIso(sh,0)}<span>지금 모양</span></div>`
                +`<div class="sol-list"><div>가로·세로·높이 중 가장 큰 값이 <b>${ex.m}</b>이라 가장 작은 정육면체는 <b>${ex.m}×${ex.m}×${ex.m} = ${ex.total}개</b>예요.</div>`
                +`<div>지금 놓인 나무가 <b>${ex.count}개</b>이므로 ${ex.total} − ${ex.count} = <b>${a}개</b>가 더 필요해요.</div></div></div>`;
            }
          }else if(pr.type==="minmax"||pr.type==="hidden"){
            const mn0=key.min, mx0=key.max;                     // 서버 answerKey 가 준 최소·최대
            const rs=(st.explain&&st.explain.minMax)||(CORE&&sh?CORE.reverseShapes(coreShape(sh)):null);
            if(pr.type==="minmax" && pr.sub==="G-c"){           // 층 조건 개수
              const ex=st.explain||{}, hit=new Set(ex.hitCells||[]);
              const grid=renderTopNums(sh,hit);
              sol=`<div class="sol-methods"><div class="sol-pic">${grid}<span>위에서 본 수</span></div>`
                +`<div class="sol-list"><div>겨냥도의 각 칸에 쌓인 나무 수를 위에서 본 모양에 적어요.</div>`
                +`<div>그중 <b>${pr.n} 이상</b>인 칸을 세면 <b>${a}칸</b>이에요. <span style="color:#0b6e3e;font-weight:800">초록</span>이 조건을 만족한 칸이에요.</div></div></div>`;
            }else if(pr.type==="minmax" && pr.sub==="G-b"){     // 위 + 한 방향
              const ex=st.explain||{}, byLine=ex.byLine||{}, side=pr.dir==="side";
              const lines=Object.keys(byLine).map(k=>({k:+k,...byLine[k]})).sort((p,q)=>p.k-q.k);
              const rows=lines.map(l=>`<div>${side?"뒤에서":"왼쪽에서"} ${l.k+1}번째 줄 — 높이 <b>${l.sil}</b>, 칸 <b>${l.n}</b>개 → 최대 ${l.sil}×${l.n}=<b>${l.sil*l.n}</b> · 최소 ${l.sil}+${l.n}−1=<b>${l.sil+l.n-1}</b></div>`).join("");
              sol=`<div class="sol-list"><div class="mm-txt">${side?"옆":"앞"}에서 본 모양은 <b>각 줄의 가장 높은 칸</b>만 알려줘요. 그래서 줄마다 —<br>`
                +`<b>최대</b>는 모든 칸을 그 높이까지 채우고, <b>최소</b>는 <b>한 칸만</b> 그 높이로 두고 나머지는 1개만 놓아요.</div>`
                +rows+`<div style="margin-top:6px">모두 더하면 최소 <b>${mn0}개</b> ~ 최대 <b>${mx0}개</b>.</div></div>`;
            }else if(pr.type==="minmax"){
              let vis="";
              if(rs){
                const mn=hmapToShape(rs.min,sh.edge), mx=hmapToShape(rs.max,sh.edge);
                pr._mn=mn; pr._mx=mx;
                let vary=0; for(const k in rs.min) if(rs.min[k]!==rs.max[k]) vary++;
                const topGrid=renderMinMaxTop(rs.min,rs.max,sh.gx,sh.gz);
                const mark=`<b style="color:#c68a2e">색칠한 ${vary}칸</b>`;
                const txt = pr.which==="max"
                  ? `각 칸을 <b>앞·옆에서 본 높이 중 작은 값</b>까지 채우면 가장 많아요. 모두 더하면 최대 <b>${mx0}개</b>. ${mark}이 최대에서 더 쌓이는 자리예요.`
                  : pr.which==="min"
                  ? `${mark}을 <b>낮은 쪽 수</b>까지 낮추면 가장 적어요. 모두 더하면 최소 <b>${mn0}개</b>. (나머지 칸은 항상 그 수예요)`
                  : `최대 <b>${mx0}</b> − 최소 <b>${mn0}</b> = <b>${mx0-mn0}개</b>.`;
                const grid3d = (VIEWER&&window.THREE)
                  ? `<div class="mm-views"><div class="mmv"><div class="mmv-h">최소 ${mn0}개</div><div class="expv" id="expMin"></div></div><div class="mmv"><div class="mmv-h">최대 ${mx0}개</div><div class="expv" id="expMax"></div></div></div>`
                  : `<div class="mm-views"><div class="mmv"><div class="mmv-h">최소 ${mn0}개</div>${renderIso(mn,0)}</div><div class="mmv"><div class="mmv-h">최대 ${mx0}개</div>${renderIso(mx,0)}</div></div>`;
                vis = `<div class="mm-txt">${txt}</div><div class="mm-top"><div class="mmv-h">위에서 본 모양 · 숫자=항상 그 높이<br><span style="color:#c68a2e">색칠=최소·최대 달라지는 칸</span></div>${topGrid}</div>${grid3d}`;
              }
              sol = vis;
            }else{   // 안 보이는 나무 num 서브: A-c/A-e(개수)·A-d(최대최소)·A-f(종류수)
              if(pr.sub==="A-d"){
                let vis="정답: <b>"+a+"개</b>";
                if(rs){ const mn=hmapToShape(rs.min,sh.edge),mx=hmapToShape(rs.max,sh.edge); pr._mn=mn; pr._mx=mx;
                  vis=`<div class="mm-txt">세 방향에서 본 모양이 같아도 안쪽 높이가 달라질 수 있어요. 최소 <b>${mn0}</b> ~ 최대 <b>${mx0}</b>개.</div><div class="mm-views"><div class="mmv"><div class="mmv-h">최소 ${mn0}개</div>${renderIso(mn,0)}</div><div class="mmv"><div class="mmv-h">최대 ${mx0}개</div>${renderIso(mx,0)}</div></div>`; }
                sol=vis;
              }else if(pr.sub==="A-f"){
                const hiSet=hiddenCellSet(sh);
                sol=`<div class="sol-hidden"><div class="sol-pic">${renderIso(sh,0,hiSet)}</div><div class="sol-list">숨은 칸의 높이가 달라질 수 있어, 쌓은 모양은 <b>${a}가지</b>예요. <span style="color:#c33a4f;font-weight:800">빨강</span>이 안 보이는 칸이에요.</div></div>`;
              }else{   // A-c / A-e
                const nums=[]; for(let z=0;z<sh.gz;z++)for(let x=0;x<sh.gx;x++){if(sh.hmap[x][z]>0)nums.push(sh.hmap[x][z]);}
                const maxY=Math.max(...sh.cells.map(c=>c.y))+1, layer=Array(maxY).fill(0); sh.cells.forEach(c=>layer[c.y]++);
                sol=`<div class="sol-methods"><div class="sol-pic">${renderTopNums(sh)}<span>위에서 본 수</span></div><div class="sol-list"><div>① <b>위에서 본 수의 합</b> : ${nums.join(" + ")} = <b>${a}개</b></div><div>② <b>층별 세기</b> : ${layer.map((c,i)=>`${i+1}층 ${c}`).join(" + ")} = <b>${a}개</b></div></div></div>`;
              }
            }
          }else{
            const stt = CORE ? CORE.stats(coreShape(sh)) : null;   // §4 정본 계산(공용 모듈) — 해설 문구용
            if(pr.type==="volume"){
              sol=`부피 = 쌓기나무 수 × 한 개의 부피 = ${stt?stt.count:sh.cells.length} × (${sh.edge}cm × ${sh.edge}cm × ${sh.edge}cm) = <b>${a}cm³</b>`;
            }else if(pr.type==="surface"){
              if(stt){
                const up=stt.up,front=stt.front,side=stt.side,pairs=stt.touchingPairs,face=`${sh.edge}cm × ${sh.edge}cm`;
                sol=`<div class="sol-surf"><div>① <b>위·앞·옆으로</b> : 2×(위 ${up} + 앞 ${front} + 옆 ${side}) × (${face}) = <b>${a}cm²</b></div>`
                  +`<div>② <b>다른 해설</b> : 겉넓이 = (전체 면 수 − 맞닿은 면 수) × 한 면의 넓이 = (6×${stt.count} − 2×${pairs}) × (${face}) = <b>${a}cm²</b></div></div>`
                  +projPanel(sh);
              }else{
                sol=`겉넓이 = <b>${a}cm²</b>`+projPanel(sh);
              }
            }else{
              const maxY=Math.max(...sh.cells.map(c=>c.y))+1, layer=Array(maxY).fill(0);
              sh.cells.forEach(c=>layer[c.y]++);
              const nums=[]; for(let z=0;z<sh.gz;z++)for(let x=0;x<sh.gx;x++){if(sh.hmap[x][z]>0)nums.push(sh.hmap[x][z]);}
              sol=`<div class="sol-methods"><div class="sol-pic">${renderTopNums(sh)}<span>위에서 본 수</span></div>`
                +`<div class="sol-list"><div>① <b>층별 세기</b> : ${layer.map((c,i)=>`${i+1}층 ${c}`).join(" + ")} = <b>${a}개</b></div>`
                +`<div>② <b>위에서 본 수의 합</b> : ${nums.join(" + ")} = <b>${a}개</b></div></div></div>`;
            }
          }
        }else if(F==="hm"){
          const grid=key.grid||{};
          qcard.querySelectorAll(".hmcell input").forEach(inp=>{const cor=grid[inp.dataset.x+","+inp.dataset.z];const v=parseInt(inp.value,10);
            inp.style.borderColor=(!isNaN(v)&&v===cor)?"var(--add)":"var(--del)"; if(cor!=null)inp.value=cor; inp.disabled=true;});
          sol="각 칸의 수 = 그 자리에 쌓인 나무의 <b>높이(층수)</b>예요. 초록색이 정답입니다.";
        }else if(F==="mc"){
          const cor=key.correct;
          qcard.querySelectorAll(".opt").forEach((o,i)=>{o.classList.add("done");if(i===cor)o.classList.add("correct");else if(i===PICK)o.classList.add("wrong");o.style.pointerEvents="none";});
          sol=(pr.dir==="front"?"<b>앞</b>에서 보면 가로 각 줄에서 <b>가장 높은 층</b>까지 보여요."
              :pr.dir==="side"?"<b>옆</b>에서 보면 깊이 각 줄에서 <b>가장 높은 층</b>까지 보여요."
              :"<b>위</b>에서 보면 나무가 <b>있는 칸</b>이 모두 칠해져요(높이는 안 보여요).")
              +" 초록 테두리가 정답이에요.";
        }else if(F==="draw"){
          const truth=new Set(key.cells||[]);
          ["top","front","side"].forEach(view=>{
            const g=qcard.querySelector(`.dgrid[data-view="${view}"]`); if(!g)return;
            g.querySelectorAll(".dcell").forEach(cell=>{
              const should=truth.has(view+","+cell.dataset.c+","+cell.dataset.r),has=cell.classList.contains("on");
              cell.disabled=true;
              if(should&&has)cell.classList.add("okcell");
              else if(should&&!has)cell.classList.add("misscell");
              else if(!should&&has)cell.classList.add("wrongcell");
            });
          });
          if(pr.type==="manip"){                           // H-a/H-b — 조작 전 → 후를 나란히
            const ex=st.explain||{}, before=ex.beforeCells?shFromCells({...ex,cells:ex.beforeCells}):null;
            const d=pr.delta, verb=d>0?`${d}개 더 쌓으면`:`${-d}개 빼내면`;
            sol=`<div class="sol-draw"><div class="mm-txt">표시한 줄에 <b>${verb}</b> 이런 모양이 돼요. 그 모양을 위·앞·옆에서 본 것이 정답이에요.</div>`
              +`<div class="mm-views">`
              +(before?`<div class="mmv"><div class="mmv-h">조작 전</div>${renderIso(before,0)}</div>`:``)
              +`<div class="mmv"><div class="mmv-h">조작 후</div>${renderIso(sh,0)}</div></div>`
              +`<div class="sol-pic">${renderThreeViews(silsOf(sh))}<span>정답(조작 후 위·앞·옆)</span></div></div>`;
          }else{
            const vis3d = (VIEWER&&window.THREE) ? `<div class="expv expv-hi" id="expDraw"></div>` : `<div class="sol-pic">${renderIso(sh,0)}</div>`;
            sol=`<div class="sol-draw"><div class="sol-pic">${renderThreeViews(silsOf(sh))}<span>정답</span></div>${vis3d}</div>`;
          }
        }else if(F==="bool"){                          // A-a 유무
          const truth=key.value?1:0;
          qcard.querySelectorAll(".boolopt").forEach(o=>{o.classList.add("done");const b=+o.dataset.b;if(b===truth)o.classList.add("correct");else if(b===PICK)o.classList.add("wrong");o.style.pointerEvents="none";});
          const hiSet=hiddenCellSet(sh);
          sol=`<div class="sol-hidden"><div class="sol-pic">${renderIso(sh,0,hiSet)}</div><div class="sol-list">안 보이는 나무가 <b>${truth?"있어요":"없어요"}</b>. ${truth?'<span style="color:#c33a4f;font-weight:800">빨강</span>이 숨은 칸이에요.':"모든 칸의 윗면이 보여요."}</div></div>`;
        }else if(F==="markCells"){                     // A-b 위치
          const marked=new Set(); qcard.querySelectorAll(".mcell.on").forEach(c=>marked.add(c.dataset.x+","+c.dataset.z));
          const truth=new Set(key.cells||[]);
          qcard.querySelectorAll(".mcell").forEach(c=>{const k=c.dataset.x+","+c.dataset.z;c.style.pointerEvents="none";if(truth.has(k))c.classList.add("correct");else if(marked.has(k))c.classList.add("wrong");});
          const hiSet=hiddenCellSet(sh);
          sol=`<div class="sol-hidden"><div class="sol-pic">${renderIso(sh,0,hiSet)}</div><div class="sol-list"><span style="color:#c33a4f;font-weight:800">빨강</span>이 안 보이는 나무가 숨은 칸이에요 (${truth.size}칸).</div></div>`;
        }
        S.answered[S.idx]=ok;   // ok 는 서버 판정(S.state[idx].ok) — 로컬 재계산 없음
        if(!revisit){ track("quiz_answer",{type:pr.type,level:pr.lv,correct:ok,idx:S.idx}); if(SCRATCH)SCRATCH.relock(); }
        const ai=document.getElementById("ans"); if(ai)ai.disabled=true;
        const sb=document.getElementById("submit"); if(sb)sb.disabled=true;
        // 답안 즉시 표시 + 애니메이션·사운드 동시
        const fb=document.getElementById("fb");
        fb.className="fb show "+(ok?"ok":"no");
        fb.innerHTML=(ok?"⭕ 정답이에요!":"❌ 아쉬워요")+`<div class="sol">${sol}</div>`;
        if(VIEWER && window.THREE){
          if(pr.type==="minmax" && pr._mn){
            const hMin=document.getElementById("expMin"), hMax=document.getElementById("expMax");
            if(hMin) EXPVIEWS.push(VIEWER.createViewer(hMin,{THREE:window.THREE,shape:pr._mn,showLabels:false}));
            if(hMax) EXPVIEWS.push(VIEWER.createViewer(hMax,{THREE:window.THREE,shape:pr._mx,showLabels:false}));
          }else if(pr.type==="hidden"){
            // 안 보이는 나무 해설은 정적 iso(renderIso+hiddenCellSet)로 표시 → 3D explode 불필요
          }else if(pr.type==="facesDraw"){
            const hD=document.getElementById("expDraw");
            if(hD) EXPVIEWS.push(VIEWER.createViewer(hD,{THREE:window.THREE,shape:coreShape(sh),showLabels:true}));
          }
        }
        if(pr.type==="surface"){
          const segs=document.querySelectorAll(".pseg"), host=document.querySelector("#explodeHost");
          if(host && window.THREE && VIEWER){
            if(EXPLODE&&EXPLODE.dispose)EXPLODE.dispose();
            EXPLODE=VIEWER.createViewer(host,{THREE:window.THREE,shape:coreShape(sh),faceColors:true,showLabels:true});
            EXPLODE.setExplode(true);
            segs.forEach(b=>b.onclick=()=>{segs.forEach(s=>s.classList.remove("on"));b.classList.add("on");EXPLODE&&EXPLODE.setExplode6(b.dataset.set==="6");});
          }else{
            const vw=document.querySelector(".proj-views");
            segs.forEach(b=>b.onclick=()=>{segs.forEach(s=>s.classList.remove("on"));b.classList.add("on");if(vw)vw.dataset.show=b.dataset.set;});
          }
        }
        setActions();
        updateProgress();
        if(!revisit){ playGrade(ok); playSound(ok); saveSession(); }
      }
      // 문항 이동/제출/결과 버튼 구성(문항 상태에 따라)
      // 팔레트 + 결과보기(한 묶음). 팔레트=가로 스크롤 한 줄, 결과보기=미완료 시 비활성.
      function unansweredList(){ return S.probs.map((_,i)=>i).filter(i=>!(S.state[i]&&S.state[i].answered)); }
      function firstUnanswered(from){ for(let k=1;k<=S.n;k++){ const i=(from+k)%S.n; if(!(S.state[i]&&S.state[i].answered)) return i; } return -1; }
      function renderQNav(){
        const p=document.getElementById("palette");
        if(p){
          p.innerHTML=S.probs.map((_,i)=>{const st=S.state[i];const cls=st&&st.answered?(st.ok?"o":"x"):"u";return `<button type="button" class="labdot ${cls}${i===S.idx?" cur":""}" data-i="${i}" aria-label="${i+1}번 문제로 이동">${i+1}</button>`;}).join("");
          p.querySelectorAll(".labdot").forEach(b=>b.onclick=()=>goTo(+b.dataset.i));
          const cur=p.querySelector(".labdot.cur");
          if(cur){ const pr=p.getBoundingClientRect(), cr=cur.getBoundingClientRect(); p.scrollLeft += (cr.left+cr.width/2)-(pr.left+pr.width/2); } // 가로만(윈도우 스크롤 없음)
        }
        const rb=document.getElementById("resultBtn");
        if(rb){ const un=unansweredList(), allDone=un.length===0;
          rb.disabled=!allDone;
          rb.title=allDone?"결과 보기":`안 푼 문제 ${un.length}개: ${un.map(i=>i+1).join(", ")}번`;
          rb.onclick=showResult; }
      }
      function updateProgress(){ const done=S.state.filter(s=>s&&s.answered).length; const f=document.getElementById("pg-fill"); if(f)f.style.width=(done/S.n*100)+"%"; const nm=document.getElementById("pg-num"); if(nm)nm.textContent="푼 문제 "+done+" / "+S.n; }
      function setActions(){
        const answered=!!(S.state[S.idx]&&S.state[S.idx].answered);
        const allDone=unansweredList().length===0;
        const act=document.getElementById("actions"); if(!act)return;
        let h="";
        if(!answered) h+=`<button class="btn" id="submit">제출</button>`;
        else if(!allDone) h+=`<button class="btn" id="nextBtn">다음 →</button>`;   // 안 푼 다음 문항으로
        else h+=`<button class="btn" id="resultBtn2">결과 확인</button>`;             // 모두 풀면 결과 확인
        act.innerHTML=h; act.hidden=!h;
        const nb=document.getElementById("nextBtn"); if(nb)nb.onclick=()=>{ const ni=firstUnanswered(S.idx); if(ni>=0)goTo(ni); };
        const sub=document.getElementById("submit"); if(sub)sub.onclick=()=>submit(false);
        const rb2=document.getElementById("resultBtn2"); if(rb2)rb2.onclick=showResult;
        renderQNav(); updateProgress();
      }
      let hdrSuppress=0;
      function goTo(i){ if(i<0||i>=S.n)return; S.idx=i; saveSession(); renderProblem();
        const hdr=document.querySelector(".site-top"); if(hdr)hdr.classList.remove("hide");
        hdrSuppress=Date.now()+700; window.scrollTo(0,0); }   // 즉시 이동(부드러운 스크롤 제거) + 리스너 억제
      function next(){ if(S.idx+1<S.n) goTo(S.idx+1); else showResult(); }

      function showResult(){
        if(CURVIEW&&CURVIEW.dispose){CURVIEW.dispose();CURVIEW=null;} if(EXPLODE&&EXPLODE.dispose){EXPLODE.dispose();EXPLODE=null;} disposeExpViews(); if(SCRATCH)SCRATCH.hide();
        const _fb=document.getElementById("fb"); if(_fb){_fb.className="fb";_fb.innerHTML="";_fb.hidden=true;} const _ac=document.getElementById("actions"); if(_ac){_ac.innerHTML="";_ac.hidden=true;}
        qcard.style.display="none";document.getElementById("topbar").style.display="none";
        const score=S.answered.filter(Boolean).length;
        const dots=S.answered.map((o,i)=>`<span class="dot ${o?'o':'x'}">${i+1}</span>`).join("");
        try{localStorage.setItem("cubenest_quiz_last",JSON.stringify({type:S.type,seed:S.seed,n:S.n,score,ts:Date.now()}));}catch(e){}
        // /my "퀴즈 기록" 로컬 축적(로컬 우선, 로그인 불필요). mydata가 클라우드 전환 시 자동 동기화.
        if(window.CubeNest&&CubeNest.mydata) try{ CubeNest.mydata.add({
          kind:"quiz", title:TYPES[S.type].title, sub:"맞힌 문제 "+score+"/"+S.n,
          meta:{ type:S.type, seed:S.seed, n:S.n, score:score }
        }); }catch(e){}
        track("quiz_run_complete",{type:S.type,n:S.n,score,seed:S.seed});
        resultEl.className="result show";
        resultEl.innerHTML=`
          <h2>${TYPES[S.type].title} 완료!</h2>
          <div class="score">${score}<small> / ${S.n}</small></div>
          <div class="dots">${dots}</div>
          <div class="ractions">
            <button class="btn ghost" id="replayBtn" type="button">← 다시풀기</button>
            <button class="btn ghost" id="newBtn" type="button">다른 퀴즈 풀기</button>
            <button class="btn wide" id="saveBtn" type="button">결과 저장하기</button>
            <button class="btn ghost wide" id="worksheetBtn" type="button">📄 문제지 만들기</button>
          </div>
          <div class="share">
            <span>친구에게 이 퀴즈 공유하기</span>
            <button class="sharebtn" id="shareBtn" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>공유하기</button>
          </div>`;
        document.getElementById("replayBtn").onclick=()=>{track("replay_click",{type:S.type,seed:S.seed});replaySame();};
        document.getElementById("newBtn").onclick=()=>{track("new_quiz_click",{type:S.type});const u=new URL(location);u.searchParams.set("seed",Math.random().toString(36).slice(2,9));location.href=u.toString();};
        document.getElementById("saveBtn").onclick=saveResult;
        document.getElementById("worksheetBtn").onclick=exportWorksheet;
        document.getElementById("shareBtn").onclick=shareQuiz;
        window.scrollTo({top:0,behavior:"smooth"});
      }
      // 같은 URL(같은 seed)로 똑같은 문제 다시
      function replaySame(){
        resultEl.className="result"; resultEl.innerHTML="";
        qcard.style.display=""; document.getElementById("topbar").style.display="";
        S.idx=0; S.answered=[]; S.state=[];
        try{ localStorage.removeItem(SKEY); localStorage.removeItem(SKEY+"_sc"); }catch(e){}
        updateProgress();
        renderProblem();
        const hdr=document.querySelector(".site-top"); if(hdr)hdr.classList.remove("hide");
        hdrSuppress=Date.now()+700; window.scrollTo(0,0);
      }
      // 문제지(PDF) = worksheets 소관(자체 알고리즘). quiz는 세션+학생 연습장을 모아 넘겨 '이용'만 한다(마스터 §5.1·§8.1·§4.5).
      // SCRATCH.get() 은 획→PNG 동기 변환이라 문항당 ~19ms 든다. 문항 몇 개마다 한 번씩
      // 제어를 넘겨 긴 프리즈 대신 짧은 조각으로 나눈다(태블릿에서 체감 차이가 크다).
      // 문제의 '제시물 그림'을 인쇄용 정적 HTML 로. 화면 렌더러를 그대로 재사용한다 —
      // worksheets 가 19종의 제시물 분기를 다시 갖지 않도록(§8.1 표류 방지) quiz 가 그려서 넘긴다.
      function figureOf(pr,i){
        const sh=shapeOf(pr,i)||pr.sh;
        const html = pr.type==="minmax" ? renderGGiven(pr)
                   : pr.type==="manip"  ? renderMGiven(pr)
                   : pr.type==="hidden" ? renderHiddenGiven(pr,sh)
                   : (sh ? `<div class="viewer">${renderIso(sh,0)}</div>` : "");   // 3D 6종 = 2D 겨냥도로 인쇄
        // 화면 렌더러는 문항이 하나뿐이라 id="iso" 를 쓰지만, 문제지엔 여러 문항이 한 페이지에
        // 들어가 id 가 중복된다 → 클래스로 바꿔 넘긴다.
        return html.replace(/id="iso"/g,'class="isofig"');
      }
      // 종이에서 답을 적는 자리. 폼마다 필요한 것이 달라서(숫자칸 / 고르기 / 격자 표시 / 그리기)
      // 화면 위젯의 마크업을 '비대화형'으로 재사용한다 — worksheets 는 같은 클래스만 스타일하면 된다.
      function answerAreaOf(pr,i){
        const T=TYPES[pr.type], F=pr.form||T.form, unit=pr.unit||T.unit||"", sh=shapeOf(pr,i)||pr.sh;
        if(F==="bool") return `<div class="ansline">답 &nbsp; ☐ 있어요 &nbsp;&nbsp; ☐ 없어요</div>`;
        if(F==="mc")   return `<div class="ansline">답 <u>&nbsp;</u> 번</div>`;
        if(F==="markCells"&&sh){
          let c=""; for(let z=0;z<sh.gz;z++)for(let x=0;x<sh.gx;x++)
            c+=`<div class="mcell${sh.hmap[x][z]>0?"":" empty"}" style="grid-column:${x+1};grid-row:${z+1}"></div>`;
          return `<div class="ansline">답 · 숨은 칸에 ○ 표시하세요</div><div class="markgrid" style="grid-template-columns:repeat(${sh.gx},28px)">${c}</div>`;
        }
        if(F==="hm"&&sh){
          let c=""; for(let z=0;z<sh.gz;z++)for(let x=0;x<sh.gx;x++)
            c+=`<div class="hmcell ${sh.hmap[x][z]>0?"fill":"empty"}" style="grid-column:${x+1};grid-row:${z+1}"></div>`;
          return `<div class="ansline">답 · 색칠된 칸에 수를 쓰세요</div><div class="hmgrid" style="grid-template-columns:repeat(${sh.gx},28px)">${c}</div>`;
        }
        if(F==="draw"&&sh) return `<div class="ansline">답 · 칸을 칠해 그리세요</div>`+FIG.renderDrawGrids(sh, 18, null, pr.views);
        return `<div class="ansline">답 <u>&nbsp;</u> ${unit}</div>`;
      }
      // 정답지용 한 줄 표기. 정답의 단일 출처는 서버 answerKey 다(로컬 재계산 없음).
      function answerTextOf(pr,i){
        const st=S.state[i], key=st&&st.key; if(!key) return "—";
        const T=TYPES[pr.type], unit=pr.unit||T.unit||"";
        if(key.type==="num")  return key.value+unit+(key.min!=null?`  (최소 ${key.min} · 최대 ${key.max})`:"");
        if(key.type==="bool") return key.value?"있어요":"없어요";
        if(key.type==="mc")   return (key.correct+1)+"번";
        if(key.type==="markCells")  return (key.cells||[]).map(c=>"("+c+")").join(" ")||"없음";
        if(key.type==="markCount"){ const g=key.grid||{}; return Object.keys(g).map(k=>"("+k+")="+g[k]).join(" "); }
        if(key.type==="drawSil")    return "아래 그림 참고";
        return "—";
      }
      // 정답이 '그림'인 유형(삼면도 그리기)은 정답 그림도 함께 넘긴다.
      function answerFigureOf(pr,i){
        const st=S.state[i], key=st&&st.key; if(!key||key.type!=="drawSil") return null;
        const sh=shapeOf(pr,i); return sh?renderThreeViews(silsOf(sh)):null;
      }
      async function buildWorksheetPayload(){
        const problems=[];
        for(let i=0;i<S.probs.length;i++){
          const pr=S.probs[i];
          problems.push({
            n:i+1, type:pr.type, sub:pr.sub||null, level:pr.lv, edu:PRM.edu||null,
            ask:pr.ask||TYPES[pr.type].ask,
            figure: figureOf(pr,i),                                   // 제시물 그림(SVG/HTML) — 인쇄 시 벡터 그대로
            answerArea: answerAreaOf(pr,i),                           // 종이에서 답을 적는 자리(폼별)
            answerText: answerTextOf(pr,i), answerFigure: answerFigureOf(pr,i),
            // F2 직렬화(모양 재현이 필요한 후속 기능용). 결과 화면은 전 문항 채점 후에만
            // 도달하므로 explain 으로 모양이 복원돼 여기서 null 이 되지 않는다.
            shape: shapeOf(pr,i) && CORE ? CORE.serialize(coreShape(shapeOf(pr,i))) : null,
            correct: !!S.answered[i],
            scratch: SCRATCH ? SCRATCH.get(i) : null                 // {child,tutor} 2레이어(아이 풀이 / 첨삭) PNG dataURL — 문제 하단 병기용
          });
          if(i%3===2) await new Promise(r=>setTimeout(r,0));
        }
        const score=S.answered.filter(Boolean).length;
        return { meta:{ title:TYPES[S.type].title, grade:"초등 6학년", type:S.type,
          levels:PRM.levels, n:S.n, score, seed:S.seed, quizUrl:location.href,
          date:new Date().toISOString().slice(0,10), source:"quiz" }, problems };
      }
      // 연습장 획 → PNG 변환이 문항마다 동기로 돌아 10문항이면 200ms(태블릿은 그 3~4배)
      // 화면이 굳는다. 버튼을 먼저 '만드는 중'으로 바꿔 한 프레임 넘긴 뒤 무거운 일을 시작한다.
      async function exportWorksheet(){
        track("worksheet_export_click",{type:S.type,n:S.n});
        const btn=document.getElementById("worksheetBtn"); let label=null;
        if(btn){ label=btn.textContent; btn.disabled=true; btn.textContent="📄 문제지 만드는 중…"; }
        // 버튼 상태를 먼저 그린 뒤 무거운 일을 시작한다. rAF 는 탭이 백그라운드면 아예
        // 멈추므로(누르고 탭을 옮기면 영영 안 끝난다) 타이머와 경주시켜 반드시 진행시킨다.
        try{ await new Promise(r=>{ let done=false; const go=()=>{ if(!done){ done=true; r(); } };
               requestAnimationFrame(()=>setTimeout(go,0)); setTimeout(go,60); });
             await buildAndSend(); }
        finally{ if(btn){ btn.disabled=false; btn.textContent=label; } }
      }
      async function buildAndSend(){
        const payload=await buildWorksheetPayload();
        // /my "문제지·정답지" 로컬 축적.
        //   meta.url = worksheets 재현 주소(/my 기준 상대경로). 같은 seed·유형이라 **같은 문제**가
        //   다시 나온다. 단 아이의 연습장 필기는 이 세션에만 있으므로 재현본엔 없다.
        const LVC={"하":"1","중":"2","상":"3","최상":"4"};
        const wsUrl="../worksheets/?t="+encodeURIComponent(S.type+(PRM.sub?":"+PRM.sub:"")+":"+S.n)
                   +"&lv="+(PRM.levels||[]).map(l=>LVC[l]).filter(Boolean).sort().join("")
                   +"&seed="+encodeURIComponent(S.seed);
        if(window.CubeNest&&CubeNest.mydata) try{ CubeNest.mydata.add({
          kind:"worksheet", title:TYPES[S.type].title+" 문제지 "+S.n+"문항",
          sub:"정답지 포함", meta:{ type:S.type, seed:S.seed, n:S.n, url:wsUrl }
        }); }catch(e){}
        // worksheets 는 별도 페이지라 함수 호출로 넘길 수 없다(스크립트가 이 페이지에 없다).
        // ⚠ sessionStorage 는 안 된다 — noopener 로 연 탭은 새 브라우징 컨텍스트 그룹이라
        //   세션 스토리지를 물려받지 못한다. localStorage 에 한 번 쓰고 worksheets 가 읽자마자 지운다.
        try{ localStorage.setItem("cubenest_ws_payload", JSON.stringify(payload)); }
        catch(e){ alert("문제지 데이터가 너무 커서 저장하지 못했어요. 문항 수를 줄여 다시 시도해 주세요."); return; }
        // 같은 탭으로 이동한다. payload 를 만드는 데 await 가 걸려 클릭의 사용자 제스처가 이미
        // 만료돼 window.open 은 사실상 항상 차단된다 — 폴백에 기대는 대신 동작을 하나로 고정한다.
        // 퀴즈는 seed URL + localStorage 세션으로 복원되고, 문제지 화면의 '← 퀴즈로'가 그 URL 로 돌아간다.
        location.href="../../worksheets/?from=quiz";
      }
      // 결과 저장 = 로그인 필요(마스터 6.3 RLS / 6 Supabase OAuth). 로컬엔 이미 저장됨.
      function saveResult(){
        const authed=isLoggedIn();
        track("save_result_click",{loggedIn:authed});
        if(!authed){ AUTH ? AUTH.requireLogin("save_result")
                          : alert("결과 저장(클라우드)은 로그인이 필요해요.\n(지금 결과는 이 기기에 자동 저장돼 있어요.)"); return; }
        // 로그인됨 → 클라우드 저장 API는 다음 단계(DB 스키마 + RLS). 지금은 로컬 저장 안내까지.
        alert("클라우드 저장은 곧 제공돼요.\n\n· 저장 데이터는 RLS로 본인만 접근\n\n지금 결과는 이 기기에 자동 저장돼 있어요.");
      }
      // 공유: 같은 seed URL → 같은 퀴즈 재현. Web Share → 클립보드 폴백.
      function shareQuiz(){
        track("share_click",{});
        const url=location.href, sc=S.answered.filter(Boolean).length;
        const data={title:"CubeNest 쌓기나무 퀴즈", text:`나 ${S.n}문제 중 ${sc}개 맞혔어! 같은 문제 풀어볼래?`, url};
        if(navigator.share){ navigator.share(data).catch(()=>{}); return; }
        const done=()=>{const b=document.getElementById("shareBtn"); if(!b)return; const t=b.innerHTML; b.innerHTML="링크 복사됨!"; setTimeout(()=>{b.innerHTML=t;},1600);};
        if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(url).then(done).catch(()=>prompt("이 링크를 공유하세요:",url)); }
        else prompt("이 링크를 공유하세요:",url);
      }

      // 시드를 주소에 남겨 재현/공유 가능하게
      (function(){const u=new URL(location);if(!u.searchParams.get("seed")){u.searchParams.set("seed",PRM.seed);u.searchParams.set("type",PRM.type);u.searchParams.set("n",PRM.n);history.replaceState(null,"",u.toString());}})();

      // gen_config 정본 로드(리포) → 폴백(인라인) → 세션 생성 → 시작
      (async function init(){
        // gen-config는 서버 소유(정적 json 폐지). 클라는 INLINE_CONFIG 폴백만 유지(서버가 config 무시).
        if(window.CubeNest&&CubeNest.api&&CubeNest.api.__setConfig)CubeNest.api.__setConfig(GEN_CONFIG);
        Loader.show('generate');
        await buildSession();
        initScratch();
        // 이어풀기: 저장된 진행(위치·답·정오)·연습장 복원
        const saved=loadSession();
        if(saved && Array.isArray(saved.state)){
          S.state=saved.state.map(s=>s?{answered:!!s.answered,ok:!!s.ok,raw:s.raw,key:s.key||null,explain:s.explain||null}:null);
          S.answered=S.state.map(s=>s?!!s.ok:undefined);
          S.idx=Math.min(Math.max(saved.idx|0,0),S.n-1);
          try{ const sc=localStorage.getItem(SKEY+"_sc"); if(sc && SCRATCH) SCRATCH.load(JSON.parse(sc)); }catch(e){}
        }
        window.addEventListener("beforeunload",saveSession);
        // 헤더: 아래로 스크롤 시 숨김, 위로 스크롤 시 표시
        (function(){ const hdr=document.querySelector(".site-top"); if(!hdr)return; let lastY=window.scrollY||0, tick=false;
          window.addEventListener("scroll",()=>{ if(tick)return; tick=true; requestAnimationFrame(()=>{ const y=window.scrollY||0; if(Date.now()<hdrSuppress){ lastY=y; tick=false; return; } if(y>lastY&&y>64)hdr.classList.add("hide"); else if(y<lastY-2)hdr.classList.remove("hide"); lastY=y; tick=false; }); },{passive:true});
        })();
        track("quiz_run_start",{type:S.type,n:S.n,seed:S.seed});
        Loader.hide();   // 로드 완료 → 즉시 퀴즈 표시
        // /my "결과보기"(view=result): 복원된 채점 상태로 결과 화면. 없으면 세션 복원(마지막 위치)으로 폴백.
        if(PRM.view==="result" && saved && Array.isArray(saved.state) && saved.state.some(x=>x&&x.answered)){ showResult(); return; }
        renderProblem();
      })();
