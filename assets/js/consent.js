/* CubeNest — 공유 동의(opt-in) · GA4 로더. index.html / playground/index.html 공용.
   cubenest_consent localStorage 키를 공유한다. */
const GA4_ID = 'G-1QX0F9RNGX';
const CONSENT_DENY_TTL = 24*60*60*1000;   // 거부 만료: 24시간

function getConsent(){
  try{
    const raw = localStorage.getItem('cubenest_consent');
    if(!raw) return null;
    if(raw === 'granted') return 'granted';
    if(raw.indexOf('denied:') === 0){
      const t = Number(raw.slice(7));
      return (Number.isFinite(t) && Date.now()-t < CONSENT_DENY_TTL) ? 'denied' : null;  // 만료 시 재질문
    }
    return null;
  }catch(e){ return null; }
}
function setConsent(v){
  try{ localStorage.setItem('cubenest_consent', v==='granted' ? 'granted' : ('denied:'+Date.now())); }catch(e){}
}
function loadGA(){
  if(!GA4_ID || window.__gaLoaded) return;
  window.__gaLoaded = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function(){ dataLayer.push(arguments); };
  gtag('js', new Date());
  gtag('consent','default',{ad_storage:'denied', ad_user_data:'denied', ad_personalization:'denied', analytics_storage:'granted'});
  gtag('config', GA4_ID);
  const s=document.createElement('script'); s.async=true;
  s.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(GA4_ID);
  document.head.appendChild(s);
}
const consentEl=document.getElementById('consent');
function consentDecide(v){
  setConsent(v);
  if(consentEl) consentEl.hidden=true;
  if(v==='granted'){
    loadGA();
    if(typeof track === 'function'){ try{ track('consent_granted'); }catch(e){} }
  }
}
(function initConsent(){
  const accept=document.getElementById('consentAccept'), deny=document.getElementById('consentDeny');
  if(accept) accept.addEventListener('click',()=>consentDecide('granted'));
  if(deny)   deny.addEventListener('click',()=>consentDecide('denied'));
  if(!GA4_ID) return;                                  // GA 미설정이면 배너 불필요
  const c=getConsent();
  if(c==='granted') loadGA();                          // 이전에 동의 → 바로 로드
  else if(!c && consentEl) consentEl.hidden=false;     // 이력 없음(또는 거부 24시간 만료) → 배너 표시
})();
