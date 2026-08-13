      /* ===== 시드 RNG ===== */
      function xmur3(s){let h=1779033703^s.length;for(let i=0;i<s.length;i++){h=Math.imul(h^s.charCodeAt(i),3432918353);h=h<<13|h>>>19;}return()=>{h=Math.imul(h^h>>>16,2246822507);h=Math.imul(h^h>>>13,3266489909);return(h^=h>>>16)>>>0;};}
      function mulberry32(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
      function rngFrom(str){const s=xmur3(str);return mulberry32(s());}

      /* ===== 유형 · 난이도 설정 ===== */
      const TYPES={
        count:{title:"개수 세기",ask:"쌓기나무는 모두 몇 개일까요?",form:"num",unit:"개"},
        volume:{title:"부피 구하기",ask:"이 모양의 부피는 얼마일까요?",form:"num",unit:"cm³",edge:true},
        surface:{title:"겉넓이 구하기",ask:"겉넓이는 얼마일까요? (바닥 포함)",form:"num",unit:"cm²",edge:true},
        heightmap:{title:"위에서 본 수 쓰기",ask:"위에서 본 모양의 각 칸에 쌓인 나무 수를 쓰세요.",form:"hm"},
        facesMc:{title:"위·앞·옆 모양 고르기",ask:"이 모양을 앞에서 본 모양을 고르세요.",form:"mc"},
        minmax:{title:"최소·최대",ask:"세 방향에서 본 모양이 되는 쌓기나무 개수는?",form:"num",unit:"개"},
        hidden:{title:"안 보이는 나무",ask:"안 보이게 숨길 수 있는 쌓기나무는 몇 개일까요?",form:"num",unit:"개"},
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
      const VIEWER=(window.CubeNest&&window.CubeNest.viewer)||null;
      function coreShape(sh){ return {gx:sh.gx, gy:sh.maxH, gz:sh.gz, edge:sh.edge, cells:sh.cells.map(c=>[c.x,c.y,c.z])}; }
      // 높이지도({"x,z":h}) → core/viewer 모양
      function hmapToShape(hm,edge){ const cells=[]; let gx=0,gz=0,gy=0; for(const k in hm){const p=k.split(",").map(Number),h=hm[k]; gx=Math.max(gx,p[0]+1); gz=Math.max(gz,p[1]+1); gy=Math.max(gy,h); for(let y=0;y<h;y++)cells.push([p[0],y,p[1]]);} return {gx,gy,gz,edge,cells}; }
      // 해설 내부 3D 뷰어(최소·최대 모양, 안 보이는 나무 강조) — 문항 전환 시 dispose
      let EXPVIEWS=[];
      function disposeExpViews(){ EXPVIEWS.forEach(v=>{try{v&&v.dispose&&v.dispose();}catch(e){}}); EXPVIEWS=[]; }
      // 오목(노치) 판정 — 마스터 v1.5.2 4.2: 노출면 > 2×(위+앞+옆 실루엣 넓이). core 공용.
      function isConcave(csh){ if(!CORE)return false; const s=CORE.silhouettes(csh); const sum=s.top.size+s.front.size+s.side.size; return CORE.exposedFaces(csh) > 2*sum; }
      // 안 보이는 나무: occ=겨냥도 뒤쪽 가림(초등, (x+1,y+1,z+1) 채워짐) / surround=이웃 가림(유아, 앞·위·옆 모두 채워짐)
      function hiddenCells(sh,mode){
        const set=new Set(sh.cells.map(c=>c.x+","+c.y+","+c.z));
        const has=(x,y,z)=>set.has(x+","+y+","+z);
        return sh.cells.filter(c=> mode==="surround"
          ? (has(c.x,c.y,c.z+1)&&has(c.x,c.y+1,c.z)&&has(c.x+1,c.y,c.z))
          : has(c.x+1,c.y+1,c.z+1));
      }
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
      function genShape(rng,cfg){
        const {gx,gz,maxH}=cfg;
        const ri=n=>Math.floor(rng()*n), rr=(a,b)=>a+Math.floor(rng()*(b-a+1));
        let f=Math.min(rr(cfg.fMin,cfg.fMax),gx*gz);
        const foot=new Set(); let sx=ri(gx),sz=ri(gz); foot.add(sx+","+sz);
        while(foot.size<f){
          const cand=[];
          foot.forEach(k=>{const[x,z]=k.split(",").map(Number);[[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dz])=>{const nx=x+dx,nz=z+dz;if(nx>=0&&nx<gx&&nz>=0&&nz<gz&&!foot.has(nx+","+nz))cand.push(nx+","+nz);});});
          if(!cand.length)break; foot.add(cand[ri(cand.length)]);
        }
        const arr=[...foot].map(k=>k.split(",").map(Number));
        const H={}; arr.forEach(([x,z])=>H[x+","+z]=1);
        let N=Math.max(arr.length,Math.min(rr(cfg.nMin,cfg.nMax),arr.length*maxH));
        let rem=N-arr.length;
        let guard=0;
        while(rem>0&&guard++<999){const opts=arr.filter(([x,z])=>H[x+","+z]<maxH);if(!opts.length)break;const[x,z]=opts[ri(opts.length)];H[x+","+z]++;rem--;}
        const hmap=Array.from({length:gx},()=>Array(gz).fill(0));
        const cells=[]; let count=0;
        arr.forEach(([x,z])=>{const h=H[x+","+z];hmap[x][z]=h;count+=h;for(let y=0;y<h;y++)cells.push({x,y,z});});
        const set=new Set(cells.map(c=>c.x+","+c.y+","+c.z));
        let pairs=0; cells.forEach(c=>{[[1,0,0],[0,1,0],[0,0,1]].forEach(([a,b,d])=>{if(set.has((c.x+a)+","+(c.y+b)+","+(c.z+d)))pairs++;});});
        const exposed=6*count-2*pairs;
        return {gx,gz,maxH,hmap,cells,count,pairs,exposed,edge:cfg.edge};
      }

      /* ===== 아이소 뷰어 ===== */
      function rot(p,k,gx,gz){const{x,y,z}=p;if(k===1)return{x:gz-1-z,y,z:x};if(k===2)return{x:gx-1-x,y,z:gz-1-z};if(k===3)return{x:z,y,z:gx-1-x};return{x,y,z};}
      function renderIso(sh,k,hiSet){
        const a=20,b=10,c=24;
        const ghost=!!hiSet;
        const cells=sh.cells.map(p=>rot(p,k,sh.gx,sh.gz));
        cells.sort((p,q)=>(p.x+p.z)-(q.x+q.z)||p.y-q.y);
        let minX=1e9,maxX=-1e9,minY=1e9,maxY=-1e9;
        const PT=(x,y,z)=>{const X=a*(x-z),Y=b*(x+z)-c*y;if(X<minX)minX=X;if(X>maxX)maxX=X;if(Y<minY)minY=Y;if(Y>maxY)maxY=Y;return [X,Y];};
        const P=(x,y,z)=>{const t=PT(x,y,z);return t[0]+","+t[1];};
        // 바닥 격자(회전된 발자국) — 기준 평면
        const g2gx=(k%2===1)?sh.gz:sh.gx, g2gz=(k%2===1)?sh.gx:sh.gz;
        let grid="";
        for(let i=0;i<=g2gx;i++){const A=PT(i,0,0),B=PT(i,0,g2gz);grid+=`<line x1="${A[0]}" y1="${A[1]}" x2="${B[0]}" y2="${B[1]}" stroke="#c3ccda" stroke-width="1"/>`;}
        for(let j=0;j<=g2gz;j++){const A=PT(0,0,j),B=PT(g2gx,0,j);grid+=`<line x1="${A[0]}" y1="${A[1]}" x2="${B[0]}" y2="${B[1]}" stroke="#c3ccda" stroke-width="1"/>`;}
        const q0=PT(0,0,0),q1=PT(g2gx,0,0),q2=PT(g2gx,0,g2gz),q3=PT(0,0,g2gz);
        grid+=`<polygon points="${q0.join(',')} ${q1.join(',')} ${q2.join(',')} ${q3.join(',')}" fill="none" stroke="#8a95a6" stroke-width="1.8" stroke-linejoin="round"/>`;
        // 큐브
        let poly="";
        for(const{x,y,z}of cells){
          const top=`${P(x,y+1,z)} ${P(x+1,y+1,z)} ${P(x+1,y+1,z+1)} ${P(x,y+1,z+1)}`;
          const left=`${P(x,y,z+1)} ${P(x+1,y,z+1)} ${P(x+1,y+1,z+1)} ${P(x,y+1,z+1)}`;
          const right=`${P(x+1,y,z)} ${P(x+1,y,z+1)} ${P(x+1,y+1,z+1)} ${P(x+1,y+1,z)}`;
          const hi=ghost && hiSet.has(x+","+y+","+z);
          const op=(ghost&&!hi)?0.28:1;
          const cL=hi?"#d84a5e":"#d8a76e",cR=hi?"#b83346":"#c8965a",cT=hi?"#ef7f8e":"#e6c9a0",st=hi?"#7c1f2c":"#9c6b30";
          poly+=`<polygon points="${left}" fill="${cL}" fill-opacity="${op}" stroke="${st}" stroke-width="1" stroke-linejoin="round"/><polygon points="${right}" fill="${cR}" fill-opacity="${op}" stroke="${st}" stroke-width="1" stroke-linejoin="round"/><polygon points="${top}" fill="${cT}" fill-opacity="${op}" stroke="${st}" stroke-width="1" stroke-linejoin="round"/>`;
        }
        // 위·앞·옆 라벨 — 회전과 함께 이동(원본 축 방향을 회전·투영)
        const ccx=(sh.gx-1)/2, ccz=(sh.gz-1)/2;
        const proj=(X,Y,Z)=>[a*(X-Z),b*(X+Z)-c*Y];
        const axisDir=(dx,dz)=>{const C=rot({x:ccx,y:0,z:ccz},k,sh.gx,sh.gz),A=rot({x:ccx+dx,y:0,z:ccz+dz},k,sh.gx,sh.gz);const pc=proj(C.x,C.y,C.z),pa=proj(A.x,A.y,A.z);let vx=pa[0]-pc[0],vy=pa[1]-pc[1];const m=Math.hypot(vx,vy)||1;return [vx/m,vy/m];};
        const cX=(minX+maxX)/2,cY=(minY+maxY)/2,R=Math.max(maxX-minX,maxY-minY)/2+12;
        const sD=axisDir(1,0),fD=axisDir(0,1);
        const lab=(x,y,t,col)=>`<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" fill="${col}" font-size="13" font-weight="800" text-anchor="middle" dominant-baseline="central" paint-order="stroke" stroke="#fff" stroke-width="3.5" stroke-linejoin="round">${t}</text>`;
        let labels=lab(cX,minY-12,"위","#3f8fd0")+lab(cX+fD[0]*R,cY+fD[1]*R,"앞","#4fae72")+lab(cX+sD[0]*R,cY+sD[1]*R,"옆","#d0546f");
        const pad=30,w=(maxX-minX)+pad*2,h=(maxY-minY)+pad*2;
        return `<svg viewBox="${minX-pad} ${minY-pad} ${w} ${h}" xmlns="http://www.w3.org/2000/svg">${grid}${poly}${labels}</svg>`;
      }
      // 실루엣(막대/격자)을 88×88 균일 박스에 중앙 배치 → 어떤 형태든 레이아웃 일정
      function renderSil(sil,color){
        const cols=sil.t==="bars"?sil.a.length:sil.cols, rows=sil.rows;
        const box=88,pad=8,avail=box-pad*2,s=Math.min(avail/cols,avail/rows,20);
        const gw=cols*s,gh=rows*s,ox=(box-gw)/2,oy=(box-gh)/2,gap=1;
        const cell=(cx,cy,on)=>`<rect x="${(cx+gap/2).toFixed(1)}" y="${(cy+gap/2).toFixed(1)}" width="${(s-gap).toFixed(1)}" height="${(s-gap).toFixed(1)}" rx="2.5" fill="${on?(color||'var(--accent)'):'var(--line-2)'}"/>`;
        let r="";
        if(sil.t==="bars"){ for(let x=0;x<cols;x++)for(let y=0;y<rows;y++) r+=cell(ox+x*s, oy+(rows-1-y)*s, y<sil.a[x]); }
        else { for(let z=0;z<sil.rows;z++)for(let x=0;x<sil.cols;x++) r+=cell(ox+x*s, oy+z*s, sil.g[z][x]); }
        return `<svg viewBox="0 0 ${box} ${box}" xmlns="http://www.w3.org/2000/svg">${r}</svg>`;
      }
      // 방향별 실루엣: 앞=x별 max_z, 옆=z별 max_x(막대) / 위=발자국(격자)
      function frontSil(sh){const a=[];for(let x=0;x<sh.gx;x++){let m=0;for(let z=0;z<sh.gz;z++)m=Math.max(m,sh.hmap[x][z]);a.push(m);}return {t:"bars",a,rows:Math.max(...a,1)};}
      // 위·앞·옆 그리기: 빈 격자 입력 + 정답 셀 판정(display row r=0=위쪽)
      function drawDims(sh){ const H=sh.maxH; return {H, top:{cols:sh.gx,rows:sh.gz}, front:{cols:sh.gx,rows:H}, side:{cols:sh.gz,rows:H}}; }
      function drawCorrect(sh,view,c,r){ const H=sh.maxH;
        if(view==="top") return topSil(sh).g[r][c];               // r=z, c=x
        if(view==="front") return (H-1-r) < frontSil(sh).a[c];    // c=x, 아래부터 채움
        return (H-1-r) < sideSil(sh).a[c];                        // side: c=옆에서 본 열(z 반전 반영)
      }
      function renderDrawInput(sh){
        const d=drawDims(sh);
        const grid=(view,cols,rows)=>{
          let cells=""; for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)cells+=`<button type="button" class="dcell" data-c="${c}" data-r="${r}"></button>`;
          const label=view==="top"?"위":view==="front"?"앞":"옆";
          return `<div class="dview"><div class="dgrid" data-view="${view}" style="grid-template-columns:repeat(${cols},24px)">${cells}</div><span>${label}</span></div>`;
        };
        return `<div class="draw">${grid("top",d.top.cols,d.top.rows)}${grid("front",d.front.cols,d.front.rows)}${grid("side",d.side.cols,d.side.rows)}</div><div class="hint">각 칸을 눌러 칠하세요. 위=발자국, 앞·옆=높이만큼 아래에서 위로.</div>`;
      }
      function sideSil(sh){const a=[];for(let z=0;z<sh.gz;z++){let m=0;for(let x=0;x<sh.gx;x++)m=Math.max(m,sh.hmap[x][z]);a.push(m);}a.reverse();return {t:"bars",a,rows:Math.max(...a,1)};}
      function topSil(sh){const g=[];for(let z=0;z<sh.gz;z++){const row=[];for(let x=0;x<sh.gx;x++)row.push(sh.hmap[x][z]>0);g.push(row);}return {t:"grid",g,cols:sh.gx,rows:sh.gz};}
      // 최소·최대/안 보이는 나무의 제시물: 위·앞·옆 세 방향 본 모양(2D)
      function renderThreeViews(sh){
        const B="#3f8fd0",G="#4fae72",R="#d0546f";
        const pv=(sil,color,label)=>`<div class="pv">${renderSil(sil,color)}<span>${label}</span></div>`;
        return `<div class="threeviews">${pv(topSil(sh),B,"위")}${pv(frontSil(sh),G,"앞")}${pv(sideSil(sh),R,"옆")}</div>`;
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
      // 위에서 본 수(각 칸 높이) 격자 — 개수 세기 해설용 2D 그림
      function renderTopNums(sh){
        const s=26,g=3,W=sh.gx*(s+g)+g,H=sh.gz*(s+g)+g;let r="";
        for(let z=0;z<sh.gz;z++)for(let x=0;x<sh.gx;x++){
          const h=sh.hmap[x][z],X=g+x*(s+g),Y=g+z*(s+g);
          r+=`<rect x="${X}" y="${Y}" width="${s}" height="${s}" rx="4" fill="${h>0?'var(--accent-soft)':'var(--line-2)'}"${h>0?' stroke="var(--accent)" stroke-width="1"':''}/>`;
          if(h>0)r+=`<text x="${X+s/2}" y="${Y+s/2+0.5}" text-anchor="middle" dominant-baseline="central" font-size="14" font-weight="800" fill="var(--accent-ink)">${h}</text>`;
        }
        return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${r}</svg>`;
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
        return {type,levels,n,seed,dim};
      }
      const PRM=loadParams();
      const S={type:PRM.type,seed:PRM.seed,n:PRM.n,idx:0,probs:[],answered:[]};
      function buildSession(){
        S.probs=[];
        const rngL=rngFrom(PRM.seed+":L");
        for(let i=0;i<PRM.n;i++){
          let lvPool=PRM.levels;
          if(PRM.type==="facesDraw"){ lvPool=PRM.levels.filter(l=>l!=="최상"); if(!lvPool.length)lvPool=["상"]; } // 그리기: 최상(5×5×5) 제외, 4×4×4 이하
          const lv=lvPool[Math.floor(rngL()*lvPool.length)];
          const rng=rngFrom(PRM.seed+":"+i), cfg=GEN_CONFIG.levels[lv];
          let sh=genShape(rng,cfg);
          // 겉넓이 오목 난이도 밴딩(마스터 v1.5.2 4.2). 하·중=오목없음 / 상=혼재 / 최상=오목있음
          if(PRM.type==="surface" && CORE){
            const want = lv==="최상" ? true : (lv==="상" ? null : false);
            if(want!==null){ let g=0; while(g++<60 && isConcave(coreShape(sh))!==want) sh=genShape(rng,cfg); }
          }
          // 최소·최대 / 안 보이는 나무: max>min(범위 있는) 모양으로 재샘플
          let rc=null;
          if(PRM.type==="minmax" && CORE){
            rc=CORE.reverseCounts(coreShape(sh)); let g=0;
            while(g++<40 && rc.maxCount<=rc.minCount){ sh=genShape(rng,cfg); rc=CORE.reverseCounts(coreShape(sh)); }
          }
          let hmode=null,hcells=null;
          if(PRM.type==="hidden"){
            hmode = (PRM.edu==="think") ? "surround" : "occ";  // 교과=겨냥도 가림 / 사고력=이웃 가림
            hcells=hiddenCells(sh,hmode); let g=0;
            while(g++<60 && hcells.length<1){ sh=genShape(rng,cfg); hcells=hiddenCells(sh,hmode); }
          }
          const pr={type:PRM.type,lv,sh};
          if(PRM.type==="facesMc"){
            const rngD=rngFrom(PRM.seed+":d"+i);
            const dir=["front","side","top"][Math.floor(rngD()*3)];
            const correct=dir==="front"?frontSil(sh):dir==="side"?sideSil(sh):topSil(sh);
            const built=makeSilOpts(correct,rngD);
            pr.opts=built.opts; pr.correct=built.correct; pr.dir=dir;
            pr.ask=(dir==="front"?"앞":dir==="side"?"옆":"위")+"에서 본 모양을 고르세요.";
          }
          if(rc){
            pr.rc=rc;
            const r=rngFrom(PRM.seed+":q"+i)(); const mode=r<0.34?"min":(r<0.67?"max":"diff");
            pr.which=mode;
            if(mode==="diff"){ pr.answer=rc.hidden; pr.ask="세 방향 모양이 같도록 쌓을 때, <b>최대와 최소의 차이</b>는 몇 개일까요?"; }
            else{ pr.answer=mode==="max"?rc.maxCount:rc.minCount; pr.ask="세 방향(위·앞·옆)에서 본 모양이 되려면, 쌓기나무는 <b>"+(mode==="max"?"최대":"최소")+"</b> 몇 개일까요?"; }
          }
          if(PRM.type==="hidden"){
            pr.hmode=hmode; pr.hcells=hcells; pr.answer=hcells.length;
            pr.ask = hmode==="surround"
              ? "다른 나무에 가려 <b>보이지 않는</b> 쌓기나무는 몇 개일까요?"
              : "겨냥도에서 뒤에 가려 <b>보이지 않는</b> 쌓기나무는 몇 개일까요?";
          }
          S.probs.push(pr);
        }
      }

      /* ===== 렌더 ===== */
      const qcard=document.getElementById("qcard"),resultEl=document.getElementById("result");
      let ROT=0,PICK=-1;
      function renderProblem(){
        ROT=0;PICK=-1;
        const pr=S.probs[S.idx],T=TYPES[pr.type],sh=pr.sh;
        document.getElementById("pg-type").textContent=T.title;
        document.getElementById("pg-num").textContent=(S.idx+1)+" / "+S.n;
        document.getElementById("pg-fill").style.width=(S.idx/S.n*100)+"%";
        let ans="";
        if(T.form==="num"){
          ans=`<div class="numin"><input id="ans" type="number" inputmode="numeric" autocomplete="off" placeholder="?"/><span class="unit">${T.unit}</span></div>`;
        }else if(T.form==="hm"){
          let cells="";
          for(let z=0;z<sh.gz;z++)for(let x=0;x<sh.gx;x++){
            const h=sh.hmap[x][z];
            cells+=`<div class="hmcell ${h>0?'fill':'empty'}" style="grid-column:${x+1};grid-row:${z+1}">${h>0?`<input data-x="${x}" data-z="${z}" type="number" inputmode="numeric" min="1" max="${sh.maxH}"/>`:''}</div>`;
          }
          ans=`<div class="hmgrid" style="grid-template-columns:repeat(${sh.gx},42px)">${cells}</div><div class="hint">색칠된 칸(위에서 보이는 칸)에만 수를 써요.</div>`;
        }else if(T.form==="mc"){
          ans=`<div class="opts">${pr.opts.map((v,i)=>`<button class="opt" data-i="${i}">${renderSil(v)}</button>`).join("")}</div>`;
        }else if(T.form==="draw"){
          ans=renderDrawInput(sh);
        }
        const askText=pr.ask||T.ask;
        const edgeTxt=T.edge?`<br>쌓기나무 한 모서리 = ${sh.edge}cm`:"";
        const isViews=pr.type==="minmax";
        const isHidden=pr.type==="hidden";
        const has3D=!!window.THREE && !!VIEWER && PRM.dim!=="2d" && !isViews && !isHidden;
        const viewLabel=isViews?"세 방향 본 모양":(isHidden?"2D 겨냥도":(has3D?"3D 문제":"2D 겨냥도"));
        const viewerHTML=isViews
          ? `<div class="viewer"><div class="rothint" style="text-align:center;margin-bottom:4px">위·앞·옆에서 본 모양이에요</div>${renderThreeViews(sh)}</div>`
          : isHidden
          ? `<div class="viewer"><div id="iso">${renderIso(sh,0)}</div><div class="rotcap">겨냥도(위·앞·옆에서 본 그림)에서 <b>안 보이는 나무</b>를 세어보세요</div></div>`
          : (has3D
          ? `<div class="viewer"><div id="v3d" class="v3d"></div><div class="rotrow2"><div class="rothint">손가락·마우스로 <b>돌려서</b> 위·앞·옆을 확인해요</div><button id="reset3d" class="rotbtn2" type="button">정면</button></div></div>`
          : `<div class="viewer"><div id="iso">${renderIso(sh,0)}</div><div class="rotrow"><button id="rl" class="rotbtn wide" type="button" aria-label="왼쪽으로 90도 돌리기">${ARC_CCW}<span>90°</span></button><div id="compass" class="compass" aria-hidden="true">${renderCompass(0)}</div><button id="rr" class="rotbtn wide" type="button" aria-label="오른쪽으로 90도 돌리기">${ARC_CW}<span>90°</span></button></div><div class="rotcap" id="rotcap">버튼으로 쌓기나무를 <b>돌려서</b> 뒤·옆면을 확인해요</div></div>`);
        qcard.innerHTML=`
          <div class="qhead"><span class="type">${T.title}</span><span class="lv">${pr.lv}</span><span class="mode">${viewLabel}</span><button type="button" id="feedbackBtn" class="qfb" aria-label="이 문제에 의견 보내기"><svg viewBox="0 0 24 24" fill="none"><path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg><span>의견</span></button></div>
          <div class="qtext">${askText}${edgeTxt}</div>
          ${viewerHTML}
          <div class="answer">${ans}</div>`;
        if(CURVIEW&&CURVIEW.dispose){CURVIEW.dispose();CURVIEW=null;} if(EXPLODE&&EXPLODE.dispose){EXPLODE.dispose();EXPLODE=null;} disposeExpViews();
        if(!isViews && !isHidden){
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
        const act0=document.getElementById("actions"); act0.hidden=false; act0.innerHTML=`<button class="btn" id="submit">제출</button>`;
        if(T.form==="mc"){qcard.querySelectorAll(".opt").forEach(b=>b.onclick=()=>{if(b.classList.contains("done"))return;PICK=+b.dataset.i;qcard.querySelectorAll(".opt").forEach(o=>o.classList.remove("sel"));b.classList.add("sel");});}
        if(T.form==="draw"){qcard.querySelectorAll(".dcell").forEach(b=>b.onclick=()=>{if(!b.disabled)b.classList.toggle("on");});}
        document.getElementById("submit").onclick=submit;
        document.getElementById("feedbackBtn").onclick=openFeedback;
        const first=qcard.querySelector("input");if(first)first.focus();
      }
      // 연습장 — 정적 HTML(#scratch) 1회 초기화. 문제 표시 때 SCRATCH.show()로 크기 맞춤·초기화.
      let SCRATCH=null;
      function initScratch(){
        const cv=document.getElementById("scratchpad"); if(!cv)return;
        const box=document.getElementById("scratch");
        const dpr=Math.min(window.devicePixelRatio||1,2), ctx=cv.getContext("2d");
        let penColor="#2d2d3a", eraser=false; const PEN=2.6*dpr, ERA=18*dpr;
        let undo=[];                 // 되돌리기 스냅샷(최대 5획)
        const store={}; let curIdx=null;   // 문항별 풀이 보존(PNG dataURL) — PDF 병기용
        function snapshot(){ try{ undo.push(ctx.getImageData(0,0,cv.width,cv.height)); if(undo.length>5)undo.shift(); }catch(e){} }
        function saveCur(){ if(curIdx!=null){ try{ store[curIdx]=cv.toDataURL("image/png"); }catch(e){} } }
        function doUndo(){ if(!undo.length)return; ctx.putImageData(undo.pop(),0,0); saveCur(); }
        function paint(url){ if(!url)return; const img=new Image(); img.onload=()=>{ try{ ctx.drawImage(img,0,0,cv.width,cv.height); }catch(e){} }; img.src=url; }
        // 리사이즈: 크기 같으면 무동작(지우지 않음), 다르면 기존 그림 보존해 재설정
        function fitKeep(){ const r=cv.getBoundingClientRect(); if(r.width<1)return;
          const w=Math.max(1,Math.round(r.width*dpr)), h=Math.max(1,Math.round(r.height*dpr));
          if(cv.width===w&&cv.height===h)return;
          let snap=null; if(cv.width>0&&cv.height>0){ try{ snap=document.createElement("canvas"); snap.width=cv.width; snap.height=cv.height; snap.getContext("2d").drawImage(cv,0,0); }catch(e){} }
          cv.width=w; cv.height=h; ctx.lineCap="round"; ctx.lineJoin="round"; undo=[];
          if(snap){ try{ ctx.drawImage(snap,0,0,w,h); }catch(e){} } saveCur();
        }
        // 문항 진입: 크기 맞추고 그 문항의 저장 풀이를 복원(없으면 빈 캔버스)
        function fitFor(idx){ const r=cv.getBoundingClientRect(); if(r.width<1)return;
          cv.width=Math.max(1,Math.round(r.width*dpr)); cv.height=Math.max(1,Math.round(r.height*dpr)); ctx.lineCap="round"; ctx.lineJoin="round"; undo=[]; paint(store[idx]);
        }
        const pos=e=>{const r=cv.getBoundingClientRect();return [(e.clientX-r.left)*cv.width/(r.width||1),(e.clientY-r.top)*cv.height/(r.height||1)];};
        let drawing=false,lx=0,ly=0;
        cv.addEventListener("pointerdown",e=>{drawing=true;snapshot();[lx,ly]=pos(e);ctx.globalCompositeOperation=eraser?"destination-out":"source-over";ctx.lineWidth=eraser?ERA:PEN;ctx.strokeStyle=penColor;cv.setPointerCapture&&cv.setPointerCapture(e.pointerId);});
        cv.addEventListener("pointermove",e=>{if(!drawing)return;const [x,y]=pos(e);ctx.beginPath();ctx.moveTo(lx,ly);ctx.lineTo(x,y);ctx.stroke();lx=x;ly=y;e.preventDefault();});
        const end=()=>{ if(drawing){drawing=false;saveCur();} }; cv.addEventListener("pointerup",end);cv.addEventListener("pointercancel",end);cv.addEventListener("pointerleave",end);
        const er=document.getElementById("eraser");
        box.querySelectorAll(".pen").forEach(b=>b.onclick=()=>{penColor=b.dataset.col;eraser=false;box.querySelectorAll(".pen").forEach(p=>p.classList.remove("on"));b.classList.add("on");if(er)er.classList.remove("on");});
        if(er)er.onclick=()=>{eraser=!eraser;er.classList.toggle("on",eraser);if(eraser)box.querySelectorAll(".pen").forEach(p=>p.classList.remove("on"));else{const on=box.querySelector(".pen");if(on)on.classList.add("on");penColor=on?on.dataset.col:penColor;}};
        const un=document.getElementById("scratchUndo"); if(un)un.onclick=doUndo;
        const clr=document.getElementById("scratchClear"); if(clr)clr.onclick=()=>{snapshot();ctx.clearRect(0,0,cv.width,cv.height);saveCur();};
        const fold=document.getElementById("scratchFold");
        if(localStorage.getItem("cubenest_scratch_fold")==="1") box.classList.add("collapsed");
        if(fold)fold.onclick=()=>{const c=box.classList.toggle("collapsed");localStorage.setItem("cubenest_scratch_fold",c?"1":"0");if(!c)requestAnimationFrame(fitKeep);};
        window.addEventListener("resize",()=>{ if(!box.hidden && !box.classList.contains("collapsed")) fitKeep(); });
        SCRATCH={
          show(idx){ if(curIdx!=null&&curIdx!==idx)saveCur(); box.hidden=false; curIdx=idx; if(!box.classList.contains("collapsed")) requestAnimationFrame(()=>fitFor(idx)); },
          hide(){ saveCur(); box.hidden=true; },
          get(idx){ return store[idx!=null?idx:curIdx]||null; },   // PDF/worksheets 연동용
          all(){ saveCur(); return Object.assign({},store); }
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
      function submit(){
        const pr=S.probs[S.idx],T=TYPES[pr.type],sh=pr.sh;
        let ok=false,sol="";
        if(T.form==="num"){
          const v=parseInt(document.getElementById("ans").value,10);
          if(isNaN(v)){document.getElementById("ans").focus();return;}
          let a;
          if(pr.type==="minmax"||pr.type==="hidden"){
            a=pr.answer; const rc=pr.rc;
            if(pr.type==="minmax"){
              let vis="";
              if(CORE){
                const rs=CORE.reverseShapes(coreShape(sh));
                const mn=hmapToShape(rs.min,sh.edge), mx=hmapToShape(rs.max,sh.edge);
                pr._mn=mn; pr._mx=mx;
                let vary=0; for(const k in rs.min) if(rs.min[k]!==rs.max[k]) vary++;
                const topGrid=renderMinMaxTop(rs.min,rs.max,sh.gx,sh.gz);
                const mark=`<b style="color:#c68a2e">색칠한 ${vary}칸</b>`;
                const txt = pr.which==="max"
                  ? `각 칸을 <b>앞·옆에서 본 높이 중 작은 값</b>까지 채우면 가장 많아요. 모두 더하면 최대 <b>${rc.maxCount}개</b>. ${mark}이 최대에서 더 쌓이는 자리예요.`
                  : pr.which==="min"
                  ? `${mark}을 <b>낮은 쪽 수</b>까지 낮추면 가장 적어요. 모두 더하면 최소 <b>${rc.minCount}개</b>. (나머지 칸은 항상 그 수예요)`
                  : `최대 <b>${rc.maxCount}</b> − 최소 <b>${rc.minCount}</b> = <b>${rc.hidden}개</b>.`;
                const grid3d = (VIEWER&&window.THREE)
                  ? `<div class="mm-views"><div class="mmv"><div class="mmv-h">최소 ${rc.minCount}개</div><div class="expv" id="expMin"></div></div><div class="mmv"><div class="mmv-h">최대 ${rc.maxCount}개</div><div class="expv" id="expMax"></div></div></div>`
                  : `<div class="mm-views"><div class="mmv"><div class="mmv-h">최소 ${rc.minCount}개</div>${renderIso(mn,0)}</div><div class="mmv"><div class="mmv-h">최대 ${rc.maxCount}개</div>${renderIso(mx,0)}</div></div>`;
                vis = `<div class="mm-txt">${txt}</div><div class="mm-top"><div class="mmv-h">위에서 본 모양 · 숫자=항상 그 높이<br><span style="color:#c68a2e">색칠=최소·최대 달라지는 칸</span></div>${topGrid}</div>${grid3d}`;
              }
              sol = vis;
            }else{
              const hiSet=new Set(pr.hcells.map(c=>c.x+","+c.y+","+c.z));
              const why = pr.hmode==="surround" ? "앞·위·옆이 모두 다른 나무로 막힌" : "겨냥도에서 뒤쪽에 가려진";
              const vis = (VIEWER&&window.THREE)
                ? `<div class="expv expv-hi" id="expHidden"></div>`
                : `<div class="sol-pic">${renderIso(sh,0,hiSet)}</div>`;
              sol = `<div class="sol-hidden">${vis}<div class="sol-list">${why} 쌓기나무는 <b>${pr.answer}개</b>예요. <span style="color:#c33a4f;font-weight:800">빨강</span>이 안 보이는 나무예요.</div></div>`;
            }
          }else{
            const st = CORE ? CORE.stats(coreShape(sh)) : null;   // §4 정본 계산(공용 모듈)
            a = st ? st.count : sh.count;
            if(pr.type==="volume"){
              a = st ? st.volume : sh.count*sh.edge**3;
              sol=`부피 = 쌓기나무 수 × 한 개의 부피 = ${st?st.count:sh.count} × (${sh.edge}cm × ${sh.edge}cm × ${sh.edge}cm) = <b>${a}cm³</b>`;
            }else if(pr.type==="surface"){
              if(st){
                const up=st.up,front=st.front,side=st.side,pairs=st.touchingPairs,face=`${sh.edge}cm × ${sh.edge}cm`;
                a=st.surfaceArea;
                sol=`<div class="sol-surf"><div>① <b>위·앞·옆으로</b> : 2×(위 ${up} + 앞 ${front} + 옆 ${side}) × (${face}) = <b>${a}cm²</b></div>`
                  +`<div>② <b>다른 해설</b> : 겉넓이 = (전체 면 수 − 맞닿은 면 수) × 한 면의 넓이 = (6×${st.count} − 2×${pairs}) × (${face}) = <b>${a}cm²</b></div></div>`
                  +projPanel(sh);
              }else{
                a=sh.exposed*sh.edge**2;
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
          ok=v===a;
        }else if(T.form==="hm"){
          ok=true;let bad=false;
          qcard.querySelectorAll(".hmcell input").forEach(inp=>{const x=+inp.dataset.x,z=+inp.dataset.z,cor=sh.hmap[x][z];const v=parseInt(inp.value,10);if(isNaN(v)||v!==cor){if(isNaN(v))bad=true;ok=false;inp.style.borderColor="var(--del)";}else{inp.style.borderColor="var(--add)";}inp.value=cor;inp.disabled=true;});
          if(bad)ok=false;
          sol="각 칸의 수 = 그 자리에 쌓인 나무의 <b>높이(층수)</b>예요. 초록색이 정답입니다.";
        }else if(T.form==="mc"){
          if(PICK<0)return;
          ok=PICK===pr.correct;
          qcard.querySelectorAll(".opt").forEach((o,i)=>{o.classList.add("done");if(i===pr.correct)o.classList.add("correct");else if(i===PICK)o.classList.add("wrong");o.style.pointerEvents="none";});
          sol=(pr.dir==="front"?"<b>앞</b>에서 보면 가로 각 줄에서 <b>가장 높은 층</b>까지 보여요."
              :pr.dir==="side"?"<b>옆</b>에서 보면 깊이 각 줄에서 <b>가장 높은 층</b>까지 보여요."
              :"<b>위</b>에서 보면 나무가 <b>있는 칸</b>이 모두 칠해져요(높이는 안 보여요).")
              +" 초록 테두리가 정답이에요.";
        }else if(T.form==="draw"){
          ok=true;
          ["top","front","side"].forEach(view=>{
            const g=qcard.querySelector(`.dgrid[data-view="${view}"]`);
            g.querySelectorAll(".dcell").forEach(cell=>{
              const c=+cell.dataset.c,r=+cell.dataset.r,should=drawCorrect(sh,view,c,r),has=cell.classList.contains("on");
              cell.disabled=true;
              if(should&&has)cell.classList.add("okcell");
              else if(should&&!has){cell.classList.add("misscell");ok=false;}
              else if(!should&&has){cell.classList.add("wrongcell");ok=false;}
            });
          });
          const vis3d = (VIEWER&&window.THREE) ? `<div class="expv expv-hi" id="expDraw"></div>` : `<div class="sol-pic">${renderIso(sh,0)}</div>`;
          sol=`<div class="sol-draw"><div class="sol-pic">${renderThreeViews(sh)}<span>정답</span></div>${vis3d}</div>`;
        }
        S.answered[S.idx]=ok;
        track("quiz_answer",{type:pr.type,level:pr.lv,correct:ok,idx:S.idx});
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
            const hH=document.getElementById("expHidden");
            if(hH) EXPVIEWS.push(VIEWER.createViewer(hH,{THREE:window.THREE,shape:coreShape(sh),highlightCells:pr.hcells.map(c=>[c.x,c.y,c.z]),highlightColor:"#e0455e",showLabels:true}));
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
        const act=document.getElementById("actions");
        act.innerHTML=`<button class="btn" id="next">${S.idx+1<S.n?"다음 →":"결과 보기"}</button>`;
        document.getElementById("next").onclick=next;
        document.getElementById("pg-fill").style.width=((S.idx+1)/S.n*100)+"%";
        playGrade(ok); playSound(ok);
      }
      function next(){if(S.idx+1<S.n){S.idx++;renderProblem();window.scrollTo({top:0,behavior:"smooth"});}else showResult();}

      function showResult(){
        if(CURVIEW&&CURVIEW.dispose){CURVIEW.dispose();CURVIEW=null;} if(EXPLODE&&EXPLODE.dispose){EXPLODE.dispose();EXPLODE=null;} disposeExpViews(); if(SCRATCH)SCRATCH.hide();
        const _fb=document.getElementById("fb"); if(_fb)_fb.hidden=true; const _ac=document.getElementById("actions"); if(_ac)_ac.hidden=true;
        qcard.style.display="none";document.getElementById("topbar").style.display="none";
        const score=S.answered.filter(Boolean).length;
        const dots=S.answered.map((o,i)=>`<span class="dot ${o?'o':'x'}">${i+1}</span>`).join("");
        try{localStorage.setItem("cubenest_quiz_last",JSON.stringify({type:S.type,seed:S.seed,n:S.n,score,ts:Date.now()}));}catch(e){}
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
          </div>
          <div class="share">
            <span>친구에게 이 퀴즈 공유하기</span>
            <button class="sharebtn" id="shareBtn" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>공유하기</button>
          </div>`;
        document.getElementById("replayBtn").onclick=()=>{track("replay_click",{type:S.type,seed:S.seed});replaySame();};
        document.getElementById("newBtn").onclick=()=>{track("new_quiz_click",{type:S.type});const u=new URL(location);u.searchParams.set("seed",Math.random().toString(36).slice(2,9));location.href=u.toString();};
        document.getElementById("saveBtn").onclick=saveResult;
        document.getElementById("shareBtn").onclick=shareQuiz;
        window.scrollTo({top:0,behavior:"smooth"});
      }
      // 같은 URL(같은 seed)로 똑같은 문제 다시
      function replaySame(){
        resultEl.className="result"; resultEl.innerHTML="";
        qcard.style.display=""; document.getElementById("topbar").style.display="";
        S.idx=0; S.answered=[]; document.getElementById("pg-fill").style.width="0%";
        renderProblem(); window.scrollTo({top:0,behavior:"smooth"});
      }
      // 결과 저장 = 로그인 필요(마스터 6.3 RLS / 6 Supabase OAuth). 로컬엔 이미 저장됨.
      function saveResult(){
        track("save_result_click",{loggedIn:false});
        alert("결과 저장(클라우드)은 로그인이 필요해요.\n\n· 로그인: Supabase OAuth(카카오 우선) · 성인 계정\n· 저장 데이터는 RLS로 본인만 접근\n\n로그인 기능은 준비 중입니다.\n(지금 결과는 이 기기에 자동 저장돼 있어요.)");
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
        try{ const r=await fetch("../../assets/js/quiz/gen-config.json",{cache:"no-store"}); if(r.ok){ const j=await r.json(); if(j&&j.levels) GEN_CONFIG=j; } }catch(e){}
        buildSession();
        initScratch();
        track("quiz_run_start",{type:S.type,n:S.n,seed:S.seed});
        renderProblem();
      })();
