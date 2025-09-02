/* ---------------- Config ---------------- */
    const PROXY_RAW = 'https://script.google.com/macros/s/AKfycbztzwYcRxD3mQ2MgD99ubT3-nW-nQJiU-thNoUrdRuMkrTIF1LilnEyCbysHP6Z7HYf/exec?url=';

    // ===== PnL API =====
    const PNL_API = 'https://script.google.com/macros/s/AKfycbxlUD8DcZ-yFA7Hc-A-_ZnRlm4HfqGVoybR-os4Y2hCAzVIE8Tfn9XDd3pMDspWmvTE/exec'; // <-- no ?url=
    const PNL_TOKEN = 'mWkV1zQ3WMVsoKKYXk2GJHOILSBIgPCK3KWCTsW4PLvV5i8M';

    /* ---- Custom Proxy + Fallbacks ---- */
    function getCustomProxy(){ return (localStorage.getItem('CUSTOM_PROXY')||'').trim(); }
    const PROXIES = [
      () => (PROXY_RAW || '').trim(),  // your hardcoded Apps Script
      () => getCustomProxy(),          // user-provided Apps Script
      'https://api.allorigins.win/raw?url=' // public fallback
    ];
    function wrapUrl(u, idx){
      const p = PROXIES[idx];
      const v = (typeof p === 'function') ? p() : p;
      if(!v) return null;
      if(v.endsWith('?url=') || v.endsWith('%3Furl%3D')) return v + encodeURIComponent(u);
      return v + encodeURIComponent(u);
    }
    async function fetchWithFallback(url, type='json', timeout=10000, options={}){
      let lastErr=null, used='';
      for(let i=0;i<PROXIES.length;i++){
        const wrapped = wrapUrl(url, i);
        if(!wrapped) continue;
        try{
          const c = new AbortController(); const to = setTimeout(()=>c.abort('timeout'), timeout);
          const res = await fetch(wrapped, Object.assign({signal:c.signal, cache:'no-store'}, options||{}));
          clearTimeout(to);
          if(!res.ok) throw new Error('HTTP '+res.status);
          used = (typeof PROXIES[i] === 'function') ? (PROXIES[i]===PROXIES[0]?'PROXY_RAW':'customProxy') : 'allorigins';
          const data = type==='json' ? await res.json() : await res.text();
          return {ok:true, used, data};
        }catch(e){ lastErr=e; }
      }
      return {ok:false, error:String(lastErr||'unknown'), used};
    }

    // Settings load/save + Test button
    const customProxyEl = document.getElementById('customProxy');
    const testBtn = document.getElementById('testFetch');
    const diagEl = document.getElementById('diag');
    (function setupSettings(){
      if(customProxyEl){ customProxyEl.value = getCustomProxy(); }
      const save = document.getElementById('saveKeys');
      if(save){
        save.addEventListener('click', ()=>{
          localStorage.setItem('GNEWS_KEY', (document.getElementById('gnews')||{}).value?.trim()||'');
          localStorage.setItem('ALPHA_KEY', (document.getElementById('alpha')||{}).value?.trim()||'');
          if(customProxyEl) localStorage.setItem('CUSTOM_PROXY', customProxyEl.value.trim());
          const sm=document.getElementById('saveMsg'); if(sm){ sm.textContent='Saved ✓'; setTimeout(()=>sm.textContent='',1200); }
        });
      }
      if(testBtn){
        testBtn.addEventListener('click', async()=>{
          if(diagEl) diagEl.textContent = 'Testing Yahoo 1m via fallbacks...';
          const url='https://query1.finance.yahoo.com/v8/finance/chart/SPY?range=1d&interval=1m&includePrePost=true';
          const r = await fetchWithFallback(url,'json',10000,{});
          if(r.ok){
            if(diagEl) diagEl.innerHTML = `<span class="chip ok">OK via <b>${r.used}</b></span>`;
            const c2=document.getElementById('conn2'); if(c2){ c2.className='chip ok'; c2.innerHTML='<i class="fa-solid fa-chart-line"></i> Data OK'; }
          }else{
            if(diagEl) diagEl.innerHTML = `<span class="chip bad">Failed: ${r.error}</span> • Try a Custom Proxy (Apps Script).`;
            const c2=document.getElementById('conn2'); if(c2){ c2.className='chip bad'; c2.innerHTML='<i class="fa-solid fa-chart-line"></i> Data FAIL'; }
          }
        });
      }
    
      // notifications header bell handles toggle
    })();


    /* ---------------- Nav / Tabs ---------------- */
    const panelSettings=document.getElementById('panel-settings');
    const panelPnL=document.getElementById('panel-pnl');
    const navPrep=document.getElementById('nav-prep'),navTrend=document.getElementById('nav-trend'),navSettings=document.getElementById('nav-settings'),navPnL=document.getElementById('nav-pnl'),navRisk=document.getElementById('nav-risk');

    function hidePanels(){panelSettings.style.display='none';panelPnL.style.display='none'}
    function setNav(active){
      [navPrep,navTrend,navSettings,navPnL,navRisk].forEach(n=>n.classList.toggle('active',n.id===active));
      hidePanels();
      if(active==='nav-settings') panelSettings.style.display='block';
      if(active==='nav-pnl') panelPnL.style.display='block';
      if(active==='nav-prep') setTab('prep');
      if(active==='nav-trend') setTab('trend');
      if(active==='nav-risk') setTab('risk');
    }
    navPrep.onclick=()=>setNav('nav-prep'); navTrend.onclick=()=>setNav('nav-trend'); navSettings.onclick=()=>setNav('nav-settings'); navPnL.onclick=()=>setNav('nav-pnl'); navRisk.onclick=()=>setNav('nav-risk');

    const tabPrep=document.getElementById('tab-prep'), tabTrend=document.getElementById('tab-trend'), tabRisk=document.getElementById('tab-risk');
    const prepOut=document.getElementById('prepOut'), trendOut=document.getElementById('trendOut'), riskOut=document.getElementById('riskOut');
    function setTab(which){
      tabPrep.classList.toggle('active',which==='prep');
      tabTrend.classList.toggle('active',which==='trend');
      tabRisk.classList.toggle('active',which==='risk');
      prepOut.style.display=(which==='prep')?'':'none';
      trendOut.style.display=(which==='trend')?'':'none';
      riskOut.style.display=(which==='risk')?'':'none';
    }

    
/* ===== Notifications bell (header quick toggle) ===== */
const bellBtn = document.getElementById('nav-bell');
const bellIcon = document.getElementById('bellIcon');
const mktReg = { start: null, end: null, etf: null };

function notifIsEnabled(){ return localStorage.getItem('NOTIFY_ENABLED')==='1'; }
function setNotifEnabled(on){
  localStorage.setItem('NOTIFY_ENABLED', on ? '1':'0');
  if(bellBtn){
    bellBtn.classList.toggle('active', !!on);
  }
  if(bellIcon){
    bellIcon.classList.remove('fa-regular','fa-solid');
    bellIcon.classList.add(on ? 'fa-solid' : 'fa-regular');
    bellIcon.classList.add('fa-bell');
  }
}
async function initBell(){
  if(!bellBtn) return;
  const on = notifIsEnabled && notifIsEnabled();
  setNotifEnabled(!!on);
  bellBtn.addEventListener('click', (e)=>{
    e.preventDefault(); e.stopPropagation();
    if(typeof openNotifSettings==='function'){ openNotifSettings(); }
  }, false);
}
function refreshMarketStatus(){
  const mktStatusEl = document.getElementById('mktStatus');
  if(!mktStatusEl) return;
  mktStatusEl.classList.remove('ok','bad','warn');
  let label = 'Market hours';
  if(mktReg.start && mktReg.end){
    const now = Date.now();
    const open = now >= mktReg.start && now <= mktReg.end;
    mktStatusEl.classList.add(open ? 'ok' : 'bad');
    label = open ? 'Market OPEN' : 'Market CLOSED';
  } else {
    mktStatusEl.classList.add('warn');
  }
  mktStatusEl.textContent = label;
}

function setMarketStatusFrom(regStart, regEnd, etf){
  mktReg.start = regStart||null;
  mktReg.end   = regEnd||null;
  if(etf) mktReg.etf = etf;
  refreshMarketStatus();
}

async function updateMarketStatusInitial(){
  try{
    const sel = getSelectedFutures();
    const etf = FUTURES_TO_ETF[sel[0]||'ES']||'SPY';
    mktReg.etf = etf;
    const all = await fetchIntraday(etf);
    if(all && (all.regStart || all.regEnd)){
      setMarketStatusFrom(all.regStart, all.regEnd, etf);
    } else {
      refreshMarketStatus();
    }
  }catch(_){ refreshMarketStatus(); }
}

    const futuresSel=document.getElementById('futures');
    const startBtn=document.getElementById('start'), runTrendBtn=document.getElementById('runTrend'), runRiskBtn=document.getElementById('runRisk');
    const nowEl=document.getElementById('now'), focusEl=document.getElementById('focus'), summaryEl=document.getElementById('summary'), linksEl=document.getElementById('links');
    const keyStatusEl=document.getElementById('keyStatus'), gnewsEl=document.getElementById('gnews'), alphaEl=document.getElementById('alpha');
    const saveBtn=document.getElementById('saveKeys'), saveMsg=document.getElementById('saveMsg');

    const trendWinEl=document.getElementById('trendWin'), trendSymEl=document.getElementById('trendSym'), trendTimeEl=document.getElementById('trendTime'), trendSummaryEl=document.getElementById('trendSummary'), trendAdviceEl=document.getElementById('trendAdvice'), trendCanvas=document.getElementById('trendChart');
    const riskWinEl=document.getElementById('riskWin'), riskSymEl=document.getElementById('riskSym'), riskTimeEl=document.getElementById('riskTime'), riskSummaryEl=document.getElementById('riskSummary'), riskAdviceEl=document.getElementById('riskAdvice'), riskCanvas=document.getElementById('riskChart');
    const trendLegend=document.getElementById('trendLegend');
    const riskLegend=document.getElementById('riskLegend');

    /* ---------------- Timeframe ---------------- */
    let trendMinutes=15;
    const segBtns=document.querySelectorAll('.segbtn[data-tf]');
    function setTfActive(mins){
      segBtns.forEach(btn=>btn.classList.toggle('active',parseInt(btn.dataset.tf,10)===mins));
      trendMinutes=mins; trendWinEl.textContent=mins+'m'; riskWinEl.textContent=mins+'m';
    }
    segBtns.forEach(btn=>btn.addEventListener('click',()=>setTfActive(parseInt(btn.dataset.tf,10))));

    /* ---------------- Keys ---------------- */
    function loadKeys(){gnewsEl.value=localStorage.getItem('GNEWS_KEY')||'';alphaEl.value=localStorage.getItem('ALPHA_KEY')||''}
    function saveKeys(){localStorage.setItem('GNEWS_KEY',gnewsEl.value.trim());localStorage.setItem('ALPHA_KEY',alphaEl.value.trim());saveMsg.textContent='Saved ✓';setTimeout(()=>saveMsg.textContent='',1500)}
    if(saveBtn){loadKeys(); saveBtn.addEventListener('click',saveKeys);}

    /* ---------------- Futures helpers ---------------- */
    function getSelectedFutures(){return Array.from(futuresSel.selectedOptions).map(o=>o.value)}
    document.querySelectorAll('.bundle[data-bundle]').forEach(b=>b.addEventListener('click',()=>{const arr=b.dataset.bundle.split(',');for(const o of futuresSel.options)o.selected=arr.includes(o.value)}));

    function showPrepHeader(markets){nowEl.textContent=new Date().toLocaleString();focusEl.textContent=markets.join(', ')}
    function makeLinks(markets){const q=encodeURIComponent(markets.join(' ')||'ES NQ');linksEl.innerHTML=`<li><a target="_blank" href="https://www.google.com/search?q=index+futures">Index Futures Snapshot</a></li><li><a target="_blank" href="https://www.google.com/search?q=today+economic+calendar">Economic Calendar</a></li><li><a target="_blank" href="https://news.google.com/">Macro headlines</a></li><li><a target="_blank" href="https://news.google.com/search?q=${q}">News for ${markets.join(', ')}</a></li>`}

    /* ---------------- Maps ---------------- */
    const FUTURES_TO_ETF={ES:'SPY',NQ:'QQQ',YM:'DIA',RTY:'IWM',CL:'USO',GC:'GLD',ZN:'IEF','6E':'FXE'};
    const ETF_TO_STOOQ={SPY:'spy.us',QQQ:'qqq.us',DIA:'dia.us',IWM:'iwm.us',USO:'uso.us',GLD:'gld.us',IEF:'ief.us',FXE:'fxe.us'};

    /* ---------------- Sentiment rules ---------------- */
    const POS=['beat','surge','strong','record','optim','rally','up','gain','bull','expand','growth'];
    const NEG=['miss','fall','weak','cut','warn','down','bear','slump','contract','decline','risk','halt','ban','tariff'];
    function headlineScore(t){const s=t.toLowerCase();let n=0;POS.forEach(w=>{if(s.includes(w))n++});NEG.forEach(w=>{if(s.includes(w))n--});return n}
    function overallLabel(score){if(score>=2)return['Bullish','ok'];if(score<=-2)return['Bearish','bad'];return['Neutral','warn']}

    const CAUSE_RULES=[
      {key:'fed',label:'Fed/Rate outlook',pat:/(fed|powell|fomc|rate cut|rate hike|yield|treasury|dot plot|t-bill|t-note|t-bond)/i,w:2},
      {key:'cpi',label:'Inflation (CPI/PCE)',pat:/(cpi|pce|inflation|core inflation|ppi)/i,w:2},
      {key:'jobs',label:'Labor data',pat:/(nonfarm|nfp|payrolls|unemployment|jobless|initial claims|jolts)/i,w:2},
      {key:'gdp',label:'Growth data',pat:/(gdp|growth|pmis?)/i,w:1},
      {key:'earnings',label:'Earnings',pat:/(earnings|eps|revenue|guidance|beats?|miss(es)?|outlook|forecast)/i,w:2},
      {key:'mega',label:'Mega-cap tech',pat:/(apple|aapl|microsoft|msft|amazon|amzn|google|alphabet|googl|meta|fb|nvidia|nvda|tsla)/i,w:2},
      {key:'china',label:'China',pat:/(china|beijing|shanghai|pboc|property crisis|evergrande)/i,w:1},
      {key:'geopol',label:'Geopolitics',pat:/(war|missile|strike|conflict|israel|ukraine|taiwan|sanction|tariff|houthis?)/i,w:2},
      {key:'oil',label:'Oil/Energy',pat:/(oil|brent|wti|opec|opec\+|gasoline|refinery|energy prices?)/i,w:1},
      {key:'banks',label:'Banks/Credit',pat:/(bank(s)?|credit|default|downgrade|upgrade|capital|liquidity|stress test)/i,w:1},
      {key:'crypto',label:'Crypto',pat:/(bitcoin|btc|ethereum|eth|crypto|spot etf)/i,w:1},
      {key:'reg',label:'Regulation/Policy',pat:/(regulat(e|ion)|antitrust|probe|ftc|doj|ec|ban|export controls?)/i,w:1}
    ];
    const WHY_PCT=0.35;

    function topCausesFromHeadlines(headlines,max=3){
      const scores=new Map();const examples={};
      for(const h of (headlines||[])){for(const r of CAUSE_RULES){if(r.pat.test(h)){scores.set(r.key,(scores.get(r.key)||0)+r.w);if(!examples[r.key])examples[r.key]=h}}}
      return Array.from(scores.entries()).sort((a,b)=>b[1]-a[1]).slice(0,max).map(([key,score])=>({key,score,label:CAUSE_RULES.find(rr=>rr.key===key).label,sample:examples[key]}))
    }
    function moveDescriptor(pct){const ap=Math.abs(pct);if(ap>=2)return'surging';if(ap>=1)return'up solidly';if(ap>=0.5)return'firm';if(ap>=0.2)return'slightly higher';return'little changed'}
    function buildWhyNarrative({dayRes,headlines}){const parts=[];if(dayRes?.ok){const dir=dayRes.pct>=0?'higher':'lower',tone=moveDescriptor(dayRes.pct);parts.push(`Markets are ${tone} (${dayRes.pct.toFixed(2)}% ${dir} for ${dayRes.etf} at the last close).`)}const causes=topCausesFromHeadlines(headlines,3);if(causes.length){parts.push(`Likely drivers: ${causes.map(c=>c.label).join(', ')}.`);const s=causes[0].sample;if(s)parts.push(`e.g., “${s.replace(/"/g,'')}”.`)}else parts.push(`No dominant driver detected; tone appears mixed.`);return parts.join(' ')}

    /* ---------------- Fetch helpers ---------------- */
    async function fetchJsonOnce(u,t=9000){const c=new AbortController();const to=setTimeout(()=>c.abort('timeout'),t);try{const r=await fetch(u,{signal:c.signal,cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);return await r.json()}finally{clearTimeout(to)}}
    async function fetchJsonRetry(u,tries=2){let e=null;for(let i=0;i<tries;i++){try{return await fetchJsonOnce(u,i?12000:9000)}catch(x){e=x;await new Promise(r=>setTimeout(r,300))}}throw e}
    async function fetchTextOnce(u,t=9000){const c=new AbortController();const to=setTimeout(()=>c.abort('timeout'),t);try{const r=await fetch(u,{signal:c.signal,cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);return await r.text()}finally{clearTimeout(to)}}
    async function fetchTextRetry(u,tries=2){let e=null;for(let i=0;i<tries;i++){try{return await fetchTextOnce(u,i?12000:9000)}catch(x){e=x;await new Promise(r=>setTimeout(r,300))}}throw e}

    /* ---------------- Headlines ---------------- */
    async function getHeadlines(markets){
      const gkey=(localStorage.getItem('GNEWS_KEY')||'').trim();
      if(gkey){try{const q=encodeURIComponent(markets.join(' OR '));const url=`https://gnews.io/api/v4/search?q=${q}&lang=en&country=us&max=20&token=${gkey}`;const data=await fetchJsonRetry(url,2);const headlines=(data.articles||[]).map(a=>a.title||'').filter(Boolean);return {ok:true,source:'gnews',headlines}}catch(e){}}
      const q=encodeURIComponent(markets.join(' '));const rss=`https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en&t=${Date.now()}`;
      try{const xml=await fetchTextRetry(PROXY_RAW+encodeURIComponent(rss),2);const doc=new DOMParser().parseFromString(xml,'text/xml');const items=Array.from(doc.querySelectorAll('item>title'));const heads=items.map(n=>n.textContent||'').filter(Boolean);return {ok:heads.length>0,source:'rss-proxy',headlines:heads}}catch(e){return {ok:false,source:'rss-proxy',reason:String(e)}}}

    /* ---------------- Last day (Alpha→Yahoo→Stooq) ---------------- */
    async function getLastDayMove(markets){
      const akey=(localStorage.getItem('ALPHA_KEY')||'').trim();
      const etf=FUTURES_TO_ETF[markets[0]||'ES']||'SPY';
      if(akey){try{const url=`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${etf}&apikey=${akey}`;const data=await fetchJsonRetry(url,2);const s=data['Time Series (Daily)']||{};const d=Object.keys(s).sort().reverse();if(d.length>=2){const c0=parseFloat(s[d[0]]['4. close']), c1=parseFloat(s[d[1]]['4. close']);const pct=((c0-c1)/c1)*100, delta=c0-c1;const closes=d.slice(0,10).reverse().map(k=>parseFloat(s[k]['4. close'])).filter(n=>isFinite(n));return {ok:true,etf,latest:d[0],prior:d[1],pct,delta,closes,source:'alpha'}}}catch(e){}}
      try{const yUrl=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(etf)}?range=15d&interval=1d&t=${Date.now()}`;const yData=await fetchJsonRetry(PROXY_RAW+encodeURIComponent(yUrl)+'&cb='+Date.now(),2);const r=yData?.chart?.result?.[0];const closes=r?.indicators?.quote?.[0]?.close?.filter(v=>v!=null)||[];if(closes.length>=2){const c0=closes.at(-1), c1=closes.at(-2);const pct=((c0-c1)/c1)*100, delta=c0-c1;const ts=r.timestamp||[];const toDate=t=>{const d=new Date(t*1000);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};const latest=ts.length?toDate(ts.at(-1)):'', prior=ts.length>1?toDate(ts.at(-2)):'';return {ok:true,etf,latest,prior,pct,delta,closes:closes.slice(-10),source:'yahoo-proxy'}}}catch(e){}
      const sym=ETF_TO_STOOQ[etf]||'spy.us';const srcs=[`https://stooq.com/q/d/l/?s=${encodeURIComponent(sym)}&i=d&t=${Date.now()}`,`https://stooq.pl/q/d/l/?s=${encodeURIComponent(sym)}&i=d&t=${Date.now()}`];
      let lastErr=null;for(const u of srcs){try{const csv=await fetchTextRetry(PROXY_RAW+encodeURIComponent(u),2);const rows=csv.trim().split('\n');if(rows.length>=3){const last=rows.at(-1).split(','), prev=rows.at(-2).split(',');const c0=parseFloat(last[4]), c1=parseFloat(prev[4]);if(!isFinite(c0)||!isFinite(c1)) throw new Error('bad close');const pct=((c0-c1)/c1)*100, delta=c0-c1;const closes=rows.slice(-11).slice(1).map(r=>parseFloat(r.split(',')[4])).filter(v=>isFinite(v));return {ok:true,etf,latest:last[0],prior:prev[0],pct,delta,closes,source:u.includes('.pl')?'stooq-proxy(pl)':'stooq-proxy(com)'}}}catch(e){lastErr=e}}return {ok:false,reason:String(lastErr||'fetch failed')}}
    function sentimentFrom(h){const total=h.reduce((a,t)=>a+headlineScore(t),0);const [label,cls]=overallLabel(total);return {label,cls,total}}
    function drawSparkline(container,values){if(!values||values.length<2)return;const c=document.createElement('canvas');c.className='chart';container.appendChild(c);drawLineChart(c,values.map((v,i)=>({c:v,t:i})))}

    /* ---------------- Charts ---------------- */

    function quantile(arr, q){
      if(!arr || !arr.length) return NaN;
      const a=[...arr].sort((x,y)=>x-y); 
      const pos=(a.length-1)*q;
      const base=Math.floor(pos), rest=pos-base;
      if(a[base+1]!==undefined) return a[base]+rest*(a[base+1]-a[base]);
      return a[base];
    }

    function sizeCanvas(canvas){
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      const cssW = canvas.clientWidth || 700;
      const cssH = canvas.clientHeight || 190;
      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);
      return { ctx: canvas.getContext('2d'), w: canvas.width, h: canvas.height, dpr };
    }


      function drawCandleChart(canvas, bars, opts = {}) {
  const progressLast = Math.max(0, Math.min(1, Number(opts.progressFracLast || 1)));
  const robustZoom = opts.robustZoom !== false;

  // MUST get ctx,w,h before we can draw anything
  const { ctx, w, h } = sizeCanvas(canvas);        // ← required first
  ctx.clearRect(0, 0, w, h);

  if (!bars || bars.length < 2) {
    // Show "No data" overlay instead of leaving it blank
    ctx.fillStyle = '#aaa';
    ctx.font = '12px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No data', w / 2, h / 2);
    return;
  }
      const pad = 12;
      const highs = bars.map(b=>b.h), lows = bars.map(b=>b.l);
      let min = Math.min(...lows), max = Math.max(...highs);
      if(robustZoom && bars.length>=5){
        const ql = quantile(lows, 0.05), qh = quantile(highs, 0.95);
        min = Math.min(min, ql); max = Math.max(max, qh);
        // ensure a minimum relative range to keep candles visible
        const mid = (min+max)/2; const rel = (max-min)/Math.max(1e-9, mid);
        const minRel = 0.0015; // 0.15%
        if(rel < minRel){
          const pad = mid*minRel/2;
          min = mid - pad; max = mid + pad;
        }
        // small padding
        const pad2 = (max-min)*0.001;
        min -= pad2; max += pad2;
      }
      const range = (max-min)||1;
      const step = (w - pad*2) / (bars.length-1);
      const bodyFrac = 0.55; // candle body width fraction (mobile-friendly)
      const bodyW = Math.max(2, step * bodyFrac);

      // subtle grid
      ctx.strokeStyle = '#2d2d33';
      ctx.lineWidth = 1;
      for (let i=1;i<=3;i++){
        const y = pad + (h - pad*2) * (i/4);
        ctx.beginPath(); ctx.moveTo(pad,y); ctx.lineTo(w-pad,y); ctx.stroke();
      }

      // wicks + bodies
      for (let i=0;i<bars.length;i++){
        const b = bars[i];
        const x = pad + step*i;
        const yH = h - pad - ((b.h - min)/range)*(h - pad*2);
        const yL = h - pad - ((b.l - min)/range)*(h - pad*2);
        const yO = h - pad - ((b.o - min)/range)*(h - pad*2);
        const yC = h - pad - ((b.c - min)/range)*(h - pad*2);
        const up = b.c >= b.o;

        // wick (always full so you still see range)
        ctx.strokeStyle = up ? '#6abd74' : '#e05d5d';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x, yH); ctx.lineTo(x, yL); ctx.stroke();

        // body (last bar can render partially by time progress)
        const top = Math.min(yO, yC), bot = Math.max(yO, yC);
        ctx.fillStyle = up ? '#6abd74' : '#e05d5d';
        const widthScale = (i === bars.length-1) ? (progressLast || 1) : 1;
        const wBody = Math.max(2, bodyW * widthScale);
        ctx.fillRect(x - bodyW/2, top, wBody, Math.max(2, bot-top));
      }

      // overlays: VWAP across closes (proxy). Draw after candles.
      if (opts.vwap){
        let cumPV=0, cumV=0;
        ctx.beginPath();
        ctx.strokeStyle = '#7424ac';
        ctx.setLineDash([5,4]);
        ctx.lineWidth = 2;
        for (let i=0;i<bars.length;i++){
          const b = bars[i];
          const x = pad + step*i;
          cumPV += (b.c||b.o) * (b.v||1);
          cumV  += (b.v||1);
          const vwap = cumPV / Math.max(1,cumV);
          const y = h - pad - ((vwap - min)/range)*(h - pad*2);
          if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // optional close line for clarity
      if (opts.closeLine){
        ctx.beginPath();
        ctx.strokeStyle = '#6424ac';
        ctx.lineWidth = 1.75;
        for (let i=0;i<bars.length;i++){
          const b = bars[i];
          const x = pad + step*i;
          const y = h - pad - ((b.c - min)/range)*(h - pad*2);
          if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
        }
        ctx.stroke();
      }
    }

    // Simple tiny line chart for sparkline in Prep (unchanged)
    function drawLineChart(canvas,points){
      const {ctx,w,h}=sizeCanvas(canvas);
      if(!points || points.length<2) return;
      const pad=10; const min=Math.min(...points.map(p=>p.c)), max=Math.max(...points.map(p=>p.c)); const range=(max-min)||1;
      const step=(w-pad*2)/(points.length-1);
      ctx.beginPath();
      ctx.lineWidth=2; ctx.strokeStyle = '#6424ac';
      points.forEach((p,i)=>{const x=pad+step*i; const y=h-pad-((p.c-min)/range)*(h-pad*2); if(i===0)ctx.moveTo(x,y); else ctx.lineTo(x,y)});
      ctx.stroke();
    }

    /* ---------------- Prep summary ---------------- */
    async function buildSummary(markets){
      nowEl.textContent=new Date().toLocaleString();
      const gkey=(localStorage.getItem('GNEWS_KEY')||'').trim(), akey=(localStorage.getItem('ALPHA_KEY')||'').trim();
      keyStatusEl.textContent=(!gkey||!akey)?'Using proxy for any missing services.':'Using saved API keys where available.';
      summaryEl.innerHTML='<span class="spinner"></span> Analyzing...';
      let newsRes={ok:false,reason:'timeout'}, dayRes={ok:false,reason:'timeout'};
      try{newsRes=await getHeadlines(markets)}catch(e){newsRes={ok:false,reason:String(e)}}
      try{dayRes=await getLastDayMove(markets)}catch(e){dayRes={ok:false,reason:String(e)}}
      const parts=[];
      if(newsRes.ok&&newsRes.headlines?.length){
        const senti=sentimentFrom(newsRes.headlines);
        const overall=senti.total>=2?'lean <b>bullish</b>':(senti.total<=-2?'lean <b>bearish</b>':'look <b>mixed/neutral</b>');
        parts.push(`<div class="pill ${senti.cls}"><i class="fa-regular fa-newspaper"></i> News sentiment (${newsRes.source}): <strong>${senti.label}</strong></div>`);
        parts.push(`<p style="margin-top:8px">According to current news, <b>${markets.join(', ')}</b> ${overall} as of now.</p>`);
        const top=newsRes.headlines.slice(0,5).map(h=>`<li>${h}</li>`).join('');
        parts.push(`<details style="margin-top:6px"><summary>Top headlines</summary><ul>${top}</ul></details>`);
      } else {
        parts.push(`<div class="muted"><i class="fa-regular fa-newspaper"></i> News sentiment unavailable${newsRes.reason?' ('+newsRes.reason+')':''}</div>`);
      }
      if(dayRes.ok){
        const dir=dayRes.pct>=0?'▲':'▼',cls=dayRes.pct>=0?'ok':'bad';
        let weekendHint=''; try{const dL=new Date(dayRes.latest).getDay(),dP=new Date(dayRes.prior).getDay(); if(dL===1&&dP===5) weekendHint=' (Fri → Mon)';}catch(_){ }
        parts.push(`<div class="pill ${cls}" style="margin-top:8px"><i class="fa-solid fa-chart-line"></i> Prev day (${dayRes.etf}, ${dayRes.source}): ${dir} ${dayRes.pct.toFixed(2)}% (close ${dayRes.latest}${weekendHint})</div>`);
      } else {
        parts.push(`<div class="muted" style="margin-top:8px">Last day summary unavailable${dayRes.reason?' ('+dayRes.reason+')':''}</div>`);
      }
      try{
        const showWhy=dayRes?.ok&&Math.abs(dayRes.pct)>=WHY_PCT;
        if(showWhy){
          const why=buildWhyNarrative({dayRes,headlines:(newsRes.ok?newsRes.headlines:[])});
          parts.push(`<p style="margin-top:10px"><strong>Why?</strong> ${why}</p>`);
        }
      }catch(_){ }
      summaryEl.innerHTML=parts.join('');
      if(dayRes.ok&&dayRes.closes?.length) drawSparkline(summaryEl,dayRes.closes);
    }

    
/* ===== Notifications & Busy streak tracking ===== */
function notifyEnabled(){ return localStorage.getItem('NOTIFY_ENABLED')==='1' && ('Notification' in window); }
async function notifyNow(title, body){
  if(!notifyEnabled()) return;
  let perm = Notification.permission;
  if(perm==='default'){ try{ perm = await Notification.requestPermission(); }catch(_){ } }
  if(perm!=='granted') return;
  try{ new Notification(title, { body }); }catch(_){}
}

// track sustained busy (>= 5 minutes) based on our aligned 30s refresh
let _busyStreakMs = 0;
let _busyLastTick = Date.now();
let _busyNotified = false;
function busyTrackerTick(isBusy){
  const now = Date.now();
  const dt = Math.max(0, now - _busyLastTick);
  _busyLastTick = now;
  if(isBusy){
    _busyStreakMs += dt;
    if(!_busyNotified && _busyStreakMs >= 5*60*1000){
      _busyNotified = true;
      notifyNow('Market is busy!', `Tape has been busy for ${(Math.round(_busyStreakMs/6000)/10).toFixed(1)} min.`);
    }
  }else{
    _busyStreakMs = 0;
    _busyNotified = false;
  }
}

/* ===== Notifications settings UI + rules (enhanced) ===== */
(function(){
  const LS = {
    ENABLED:'NOTIFY_ENABLED',
    BUSY5:'NOTIFY_BUSY5',            // bool
    CONF_DROP:'NOTIFY_CONF_DROP',    // percent integer threshold e.g. 7
    WEARY:'NOTIFY_WEARY',            // bool
    FLIP:'NOTIFY_FLIP',              // bool
    SELECTED_ONLY:'NOTIFY_SEL_ONLY'  // bool
  };
  const DEFAULTS = { enabled:false, busy5:true, confDrop:7, weary:true, flip:true, selectedOnly:true };
  const read = (k, d)=>{
    try{ const v=localStorage.getItem(k); return v===null? d : (/^\d+$/.test(v)? Number(v): (v==='true'? true: (v==='false'? false: v))); }catch(_){ return d; }
  };
  const write = (k,v)=>{ try{ localStorage.setItem(k, String(v)); }catch(_){} };

  function getPrefs(){
    return {
      enabled: read(LS.ENABLED, DEFAULTS.enabled) ? true:false,
      busy5:   read(LS.BUSY5, DEFAULTS.busy5) ? true:false,
      confDrop: Number(read(LS.CONF_DROP, DEFAULTS.confDrop))||DEFAULTS.confDrop,
      weary:   read(LS.WEARY, DEFAULTS.weary) ? true:false,
      flip:    read(LS.FLIP, DEFAULTS.flip) ? true:false,
      selectedOnly: read(LS.SELECTED_ONLY, DEFAULTS.selectedOnly) ? true:false
    };
  }
  function savePrefs(p){
    write(LS.ENABLED, p.enabled? 'true':'false');
    write(LS.BUSY5, p.busy5? 'true':'false');
    write(LS.CONF_DROP, String(Math.max(1, Math.min(30, Math.round(p.confDrop||DEFAULTS.confDrop)))));
    write(LS.WEARY, p.weary? 'true':'false');
    write(LS.FLIP, p.flip? 'true':'false');
    write(LS.SELECTED_ONLY, p.selectedOnly? 'true':'false');
    // also reflect header bell state
    try{
      const bell=document.getElementById('nav-bell'), icon=document.getElementById('bellIcon');
      bell && bell.classList.toggle('active', !!p.enabled);
      if(icon){ icon.classList.remove('fa-regular','fa-solid'); icon.classList.add(p.enabled?'fa-solid':'fa-regular','fa-bell'); }
    }catch(_){}
  }
  // reuse earlier helpers
  window.notifIsEnabled = ()=> getPrefs().enabled;

  // Build and show settings using the existing explain modal
  window.openNotifSettings = async function(){
    const prefs = getPrefs();
    const html = `
      <form id="notifForm" class="formgrid" style="min-width:280px;max-width:520px">
        <label class="row"><span>Enable notifications</span>
          <input type="checkbox" id="nf_on" ${prefs.enabled?'checked':''} />
        </label>
        <hr/>
        <label class="row"><span>Alert if tape is <b>Busy ≥ 5 min</b></span>
          <input type="checkbox" id="nf_busy" ${prefs.busy5?'checked':''} />
        </label>
        <label class="row"><span>Alert on <b>confidence drop</b> ≥ <b id="nf_dropLbl">${prefs.confDrop}%</b></span>
          <input type="range" min="3" max="20" step="1" id="nf_drop" value="${prefs.confDrop}" />
        </label>
        <label class="row"><span>Alert when confidence in <b>50–60%</b> “weary” zone</span>
          <input type="checkbox" id="nf_weary" ${prefs.weary?'checked':''} />
        </label>
        <label class="row"><span>Alert on <b>signal flip</b> (e.g., Bullish → Neutral/Bearish)</span>
          <input type="checkbox" id="nf_flip" ${prefs.flip?'checked':''} />
        </label>
        <label class="row"><span>Only for <b>current/selected symbols</b></span>
          <input type="checkbox" id="nf_sel" ${prefs.selectedOnly?'checked':''} />
        </label>
        <p class="muted" style="font-size:12px;margin-top:10px">
          Notifications use your browser. You may need to allow them when prompted.
          Applies only while this tab is open.
        </p>
      </form>`;
    if(typeof openExplain==='function'){
      openExplain({title:'Notifications', html});
      // Bind interactions after the modal is inserted
      requestAnimationFrame(()=>{
        const $ = sel => document.querySelector('#explainModal '+sel);
        const on = $('#nf_on'), busy=$('#nf_busy'), dr=$('#nf_drop'), drLbl=$('#nf_dropLbl'), wy=$('#nf_weary'), fl=$('#nf_flip'), sel=$('#nf_sel');
        if(dr && drLbl){ dr.addEventListener('input', ()=> drLbl.textContent = dr.value+'%'); }
        const save = async()=>{
          const newPrefs = {
            enabled: !!(on && on.checked),
            busy5: !!(busy && busy.checked),
            confDrop: dr ? Number(dr.value||prefs.confDrop) : prefs.confDrop,
            weary: !!(wy && wy.checked),
            flip: !!(fl && fl.checked),
            selectedOnly: !!(sel && sel.checked)
          };
          // if enabling, request permission
          if(newPrefs.enabled && 'Notification' in window){
            try{
              if(Notification.permission==='default'){
                const perm = await Notification.requestPermission().catch(()=>{});
                if(perm!=='granted'){ newPrefs.enabled=false; }
              } else if(Notification.permission==='denied'){
                newPrefs.enabled=false;
              }
            }catch(_){}
          }
          savePrefs(newPrefs);
        };
        // Save on any change
        [on,busy,dr,wy,fl,sel].forEach(el=>{ if(el) el.addEventListener('change', save, false); });
      });
    }
  };

  /* ------- Rules evaluation ------- */
  const lastState = Object.create(null); // by symbol: {conf,lastLabel,lastNotifyTs}
  window.notifCheckPred = function(sym, pred, info){
    const prefs = getPrefs();
    if(!prefs.enabled) return;
    if(prefs.selectedOnly){
      try{
        const sel = (typeof getSelectedFutures==='function') ? getSelectedFutures() : null;
        if(Array.isArray(sel) && sel.length && !sel.includes(sym) && sym!==((sel[0]||'').toUpperCase())) return;
      }catch(_){}
    }
    const st = lastState[sym] || {};
    const confNow = Math.round((pred.conf||0)*100);
    const labelNow = String(pred.label||'').toLowerCase();

    // 1) Confidence drop alert
    if(typeof st.conf==='number'){
      const drop = st.conf - confNow;
      if(drop >= (prefs.confDrop||7)){
        notifyNow('Confidence dropped', `From ${st.conf}% to ${confNow}% on ${sym}.`);
      }
    }

    // 2) Weary zone alert (50–60%)
    if(prefs.weary && confNow>=50 && confNow<=60){
      notifyNow('Weary confidence zone', `${sym} confidence at ${confNow}%. Consider pausing.`);
    }

    // 3) Signal flip alert
    if(prefs.flip && st.label && st.label!=='bullish' && labelNow==='bullish'){
      // entering bullish
      notifyNow('Signal: Bullish', `${sym} turned Bullish (${confNow}%).`);
    } else if(prefs.flip && st.label && st.label==='bullish' && labelNow!=='bullish'){
      notifyNow('Signal changed', `${sym} flipped to ${pred.label} (${confNow}%).`);
    }

    // Save
    lastState[sym] = {conf:confNow, label:labelNow, t:Date.now()};
    // Busy tracking is handled separately by busyTrackerTick
  };

  // Replace bell click to open settings
  try{
    const bellBtn = document.getElementById('nav-bell');
    if(bellBtn){
      bellBtn.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); openNotifSettings(); }, {capture:true});
    }
  }catch(_){}
})();/* ---------------- Intraday fetch ---------------- */
    async function fetchIntraday(etf){
      const u = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(etf)}?range=1d&interval=1m&includePrePost=true&t=${Date.now()}`;
      const _r = (typeof fetchWithFallback==='function') ? await fetchWithFallback(u,'json',12000,{}) : null;
      const data = (_r && _r.ok) ? _r.data : await fetchJsonRetry(PROXY_RAW + encodeURIComponent(u), 2);
      const r = data?.chart?.result?.[0];
      const q = r?.indicators?.quote?.[0];
      const ts = r?.timestamp || [];
      const out = [];
      for (let i = 0; i < ts.length; i++) {
        const o=q?.open?.[i], h=q?.high?.[i], l=q?.low?.[i], _c = q?.close?.[i], v = q?.volume?.[i] ?? 0;
        const c = (_c!=null) ? _c : ((o!=null && h!=null && l!=null) ? (o+h+l)/3 : null);
        if (c != null && h!=null && l!=null && o!=null) out.push({ t: ts[i] * 1000, o, h, l, c, v });
      }

      // Pull regular trading period from Yahoo meta (NYSE session for ETFs)
      const reg = r?.meta?.currentTradingPeriod?.regular;
      const regStart = (reg?.start ? reg.start * 1000 : null);
      const regEnd   = (reg?.end   ? reg.end   * 1000 : null);

      return { bars: out, regStart, regEnd };
    }
    function filterToSession(bars, regStart, regEnd){
      if (regStart) {
        // Include post‑market data; just enforce lower bound from regular session start.
        // If there are no bars yet in the regular session (e.g. before market opens),
        // fall back to the full intraday history so pre‑market bars can be used.
        const sessionBars = bars.filter(b => b.t >= regStart);
        return sessionBars.length > 0 ? sessionBars : bars;
      }
      const MAX_MIN = 390; // fallback: last day of 1‑min bars
      return bars.slice(-MAX_MIN);
    }

    function lastBarProgress(bars){
      if(!bars || !bars.length) return 1;
      const last = bars.at(-1);
      const ageMs = Date.now() - (last.t||Date.now());
      const frac = ageMs/60000; // minute progress
      if(!isFinite(frac)) return 1;
      return Math.max(0.05, Math.min(1, frac)); // min visual width
    }
    function selectWindow(bars,minutes){
      if(!bars.length) return [];
      const cutoff=Date.now()-minutes*60*1000;
      const recent=bars.filter(b=>b.t>=cutoff);
      if(recent.length<Math.min(15,minutes)) return bars.slice(-Math.max(15,minutes));
      return recent;
    }
    function statsTrend(windowBars){
      if(windowBars.length<5) return {ok:false,reason:'not enough bars'};
      const closes=windowBars.map(b=>b.c), vols=windowBars.map(b=>b.v);
      const first=closes[0], last=closes.at(-1);
      const pct=(last-first)/first*100, delta=last-first;
      const rets=[]; for(let i=1;i<closes.length;i++){ const r=(closes[i]-closes[i-1])/closes[i-1]; if(isFinite(r)) rets.push(r); }
      const mean=rets.reduce((a,b)=>a+b,0)/Math.max(1,rets.length);
      const varr=rets.reduce((a,b)=>a+(b-mean)*(b-mean),0)/Math.max(1,rets.length);
      const std=Math.sqrt(varr);
      const median=arr=>{const a=[...arr].sort((x,y)=>x-y); const m=Math.floor(a.length/2); return a.length%2?a[m]:(a[m-1]+a[m])/2;};
      const volMed=median(vols), volAvg=vols.reduce((a,b)=>a+b,0)/vols.length, volRatio=volMed>0?volAvg/volMed:1;
      let sx=0,sy=0,sxx=0,sxy=0; for(let i=0;i<closes.length;i++){ sx+=i; sy+=closes[i]; sxx+=i*i; sxy+=i*closes[i]; }
      const n=closes.length, denom=(n*sxx - sx*sx)||1; const slope=(n*sxy - sx*sy)/denom; const slopePctPerHour=(slope/first)*60*100;
      let direction='Sideways',dirClass='warn'; if(pct>=0.2||slopePctPerHour>=0.5){direction='Uptrend';dirClass='ok'} else if(pct<=-0.2||slopePctPerHour<=-0.5){direction='Downtrend';dirClass='bad'}
      const busy=(std>=0.0006)||(volRatio>=1.20); const busyLabel=busy?'Busy':'Calmer',busyClass=busy?'ok':'warn';
      return {ok:true,pct,delta,std,volRatio,slopePctPerHour,direction,dirClass,busyLabel,busyClass,closes,bars:windowBars}
    }

    function drawTrend(canvas,bars,progressFrac){ drawCandleChart(canvas,bars,{vwap:true,closeLine:true,progressFracLast:progressFrac,robustZoom:true}); }

    function tradeSuggestion(info){
      if(!info?.ok) return {text:'—',action:'Wait'};
      if(info.direction==='Uptrend'&&info.busyLabel==='Busy') return {text:'Recommend: <b>Buy</b> (uptrend + active tape)',action:'Buy'};
      if(info.direction==='Downtrend'&&info.busyLabel==='Busy') return {text:'Recommend: <b>Sell</b> (downtrend + active tape)',action:'Sell'};
      if(info.direction==='Uptrend') return {text:'Recommend: <b>Buy (cautious)</b> (uptrend, calmer tape)',action:'Buy'};
      if(info.direction==='Downtrend') return {text:'Recommend: <b>Sell (cautious)</b> (downtrend, calmer tape)',action:'Sell'};
      return {text:'Recommend: <b>Wait</b> (sideways / mixed)',action:'Wait'};
    }

    function computeVWAP(bars){
      let cumPV=0,cumV=0; const out=[];
      for(const b of bars){ cumPV+= (b.c||b.o)*(b.v||1); cumV+= (b.v||1); out.push(cumPV/Math.max(1,cumV)); }
      return out;
    }
// === Smarter lean window: move vs noise, VWAP, consistency, slope ===
function leanWindowSmart(bars, minutesDesired){
  const lastN = (bars||[]).slice(-minutesDesired);
  if(lastN.length < 3) return null;

  const closes = lastN.map(b=>b.c);
  const first = closes[0], last = closes.at(-1);
  const pct = ((last-first)/Math.max(1e-9, first))*100;

  // up/down bar consistency
  let ups=0, downs=0;
  for(let i=1;i<closes.length;i++){
    const d = closes[i] - closes[i-1];
    if(d>0) ups++; else if(d<0) downs++;
  }

  // slope %/hr (linear regression on closes)
  let sx=0,sy=0,sxx=0,sxy=0; const n=closes.length;
  for(let i=0;i<n;i++){ sx+=i; sy+=closes[i]; sxx+=i*i; sxy+=i*closes[i]; }
  const denom=(n*sxx - sx*sx) || 1;
  const slope=(n*sxy - sx*sy)/denom;
  const slopePctPerHour=(slope/Math.max(1e-9, first))*60*100;

  // volatility (1m returns)
  const rets=[];
  for(let i=1;i<closes.length;i++){
    const r=(closes[i]-closes[i-1])/Math.max(1e-9, closes[i-1]);
    if(isFinite(r)) rets.push(r);
  }
  const mean=rets.reduce((a,b)=>a+b,0)/Math.max(1,rets.length);
  const varr=rets.reduce((a,b)=>a+(b-mean)*(b-mean),0)/Math.max(1,rets.length);
  const std=Math.sqrt(varr)||0;

  // VWAP alignment over the window
  const vwapArr = computeVWAP(lastN);
  const vwap = vwapArr.at(-1);
  const aboveVWAP = last > vwap;

  // z-score of the net move vs noise (normalized by sqrt(N))
  const z = std>0 ? Math.abs((last-first)/Math.max(1e-9, first)) / (std*Math.sqrt(lastN.length)) : 0;

  // combine into a micro-trend score
  let score = 0;
  score += Math.sign(pct) * Math.min(2, z);                        // net move vs noise
  score += (aboveVWAP ? 0.7 : -0.7);                               // VWAP anchor
  score += ((ups-downs)/Math.max(1, lastN.length-1)) * 0.8;        // bar consistency
  score += Math.tanh(slopePctPerHour/2.0) * 0.6;                   // gentle slope influence

  // classify
  let dir='Neutral', cls='warn';
  if(score >= 1.1){ dir='Bullish'; cls='ok'; }
  else if(score <= -1.1){ dir='Bearish'; cls='bad'; }

  // short reasons string
  const reasons = [
    `${pct>=0?'+':''}${pct.toFixed(2)}% / ${minutesDesired}m`,
    `${aboveVWAP?'above':'below'} VWAP`,
    `${ups}/${lastN.length-1} up-bars`,
    `${slopePctPerHour>=0?'+':''}${slopePctPerHour.toFixed(2)}%/hr slope`
  ].join(' • ');

  return {dir, cls, pct, score, reasons};
}


    function setLegend(el){
      if(!el) return;
      el.innerHTML = `
        <span class="item"><span class="swatch" style="background:#6abd74"></span> Up candle</span>
        <span class="item"><span class="swatch" style="background:#e05d5d"></span> Down candle</span>
        <span class="item"><span class="swatch line" style="color:#6424ac"></span> Close line</span>
        <span class="item"><span class="swatch line dashed" style="color:#7424ac"></span> VWAP (proxy)</span>`;
    }

    /* ---------------- Prediction (new purple blip) ---------------- */
    function marketPrediction(info, bars){
      if(!info?.ok || !bars?.length) return {label:'Neutral', conf:0.5, text:'Market bias unclear'};
      const N = Math.min(15, bars.length);
      const lastN = bars.slice(-N);
      const vwapArr = computeVWAP(lastN);
      const last = lastN.at(-1).c; const vwap = vwapArr.at(-1);
      let score = 0;
      // Direction & slope
      if(info.direction==='Uptrend') score += 1; else if(info.direction==='Downtrend') score -= 1;
      score += Math.tanh(info.slopePctPerHour/1.2); // smooth contribution
      // Above/below VWAP
      if(last > vwap) score += 0.6; else score -= 0.6;
      // Recent momentum
      let ups=0,downs=0; for(let i=1;i<lastN.length;i++){const d=lastN[i].c-lastN[i-1].c; if(d>0) ups++; else if(d<0) downs++;}
      if(ups>downs) score += 0.4; else if(downs>ups) score -= 0.4;
      // Volatility: calmer = lower confidence
      const volAdj = Math.max(0.35, Math.min(1, info.busyLabel==='Busy'?1:0.6));
      const conf = Math.max(0.5, Math.min(0.95, (0.6 + Math.abs(score)/3) * volAdj));
      const label = score>0.25? 'Bullish' : (score<-0.25? 'Bearish' : 'Range/Neutral');
      const text = label==='Bullish' ? 'likely to stay bullish' : (label==='Bearish' ? 'may turn/continue bearish' : 'likely range-bound');
      // Forecast the next 5-minute candle body based on the bias strength relative to volatility.
      let forecast;
      const absScore = Math.abs(score);
      if(absScore>1.2) forecast = (score>0 ? 'strong green' : 'strong red');
      else if(absScore>0.5) forecast = (score>0 ? 'green' : 'red');
      else forecast = 'doji/small candle';
      return {label,conf,text,forecast};
    }

    async function buildTrend(markets){
      const etf=FUTURES_TO_ETF[markets[0]||'ES']||'SPY';
      trendSymEl.textContent=etf; trendTimeEl.textContent=new Date().toLocaleString();
      trendSummaryEl.innerHTML='<span class="spinner"></span> Loading 1-minute bars...'; trendAdviceEl.innerHTML='';
      try{
        const all=await fetchIntraday(etf); try{ setMarketStatusFrom(all.regStart, all.regEnd, etf); }catch(_){} const sessionBars=filterToSession(all.bars, all.regStart, all.regEnd); const win=selectWindow(sessionBars,trendMinutes); const info=statsTrend(win);
        if(!info.ok){trendSummaryEl.innerHTML=`<span class="muted">Trend unavailable (${info.reason}
        // Busy notification tracker
        try{ busyTrackerTick(info.busyLabel==='Busy'); }catch(_){}
)</span>`;drawTrend(trendCanvas,[]);return}
        const dirPill=`<span class="pill ${info.dirClass}"><i class="fa-solid fa-arrow-trend-${info.direction==='Downtrend'?'down':'up'}"></i> ${info.direction}</span>`;
        const busyPill=`<span class="pill ${info.busyClass}"><i class="fa-solid fa-bolt"></i> ${info.busyLabel}</span>`;
        const pctStr=`${info.pct>=0?'▲':'▼'} ${info.pct.toFixed(2)}%`;
        const slopeStr=`${info.slopePctPerHour>=0?'+':''}${info.slopePctPerHour.toFixed(2)}%/hr slope`;
        const volStr=`σ(1m) ${(info.std*100).toFixed(3)}% • Vol ratio ${info.volRatio.toFixed(2)}×`;
        trendSummaryEl.innerHTML=`${dirPill} ${busyPill}<div style="margin-top:8px" class="muted">${pctStr} • ${slopeStr} • ${volStr}</div>`;
        drawTrend(trendCanvas,win, lastBarProgress(win));
        setLegend(trendLegend);
        const advice=tradeSuggestion(info);
        trendAdviceEl.innerHTML=`<div class="pill autoscroll" id="trendRecPill" style="margin-top:10px;background:#2b2a31;border-color:#3a3941"><i class="fa-solid fa-lightbulb"></i>&nbsp; ${advice.text}</div><div class="muted" style="margin-top:6px;font-size:12px">Disclaimer: This summary is generated solely from current market data in this app and is for informational purposes only. It is not financial advice.</div>`; if (window.matchMedia('(max-width: 520px)').matches) { applyMarquee(document.getElementById('trendRecPill')); }
        const refEl=document.getElementById('trendRef'); if(refEl){refEl.textContent=new Date().toLocaleTimeString();refEl.classList.remove('flash');void refEl.offsetWidth;refEl.classList.add('flash')}
      }catch(e){trendSummaryEl.innerHTML=`<span class="muted">Trend fetch failed (${String(e.message||e)})</span>`;drawTrend(trendCanvas,[])}
    }

    /* ---------------- Risk ---------------- */
    let riskMode='conservative';
    const riskModeSeg=document.getElementById('riskModeSeg');
    let riskCandlesN=3;
    const riskCandles=document.getElementById('riskCandles'), riskCandlesLabel=document.getElementById('riskCandlesLabel');
    // Track previous and pending values for the candles slider
    let prevSliderValue=parseInt(riskCandles?.value||'3',10)||3;
    let pendingSliderValue=null;
    // Flag to remember if the user has already accepted moving the candles slider.
    // Once set to true, further slider changes will skip confirmation and update immediately.
    let sliderConfirmed=false;

    // Update the position of the candles label so it sits above the slider
    // knob.  Called whenever the slider value or layout changes.
    function updateSliderBubble(){
      if(!riskCandles || !riskCandlesLabel) return;
      const min = parseInt(riskCandles.min,10)||0;
      const max = parseInt(riskCandles.max,10)||1;
      const val = parseInt(riskCandles.value,10)||min;
      const percent = (val - min) / Math.max(1, (max - min));
      // Compute horizontal offset relative to the slider row.  We use
      // boundingClientRect so that we subtract the row’s left position.
      const sliderRect = riskCandles.getBoundingClientRect();
      const rowRect    = riskCandles.parentElement.getBoundingClientRect();
      const width      = sliderRect.width;
      const left       = (sliderRect.left - rowRect.left) + percent * width;
      riskCandlesLabel.style.left = `${left}px`;
    }

    if(riskModeSeg){
      riskModeSeg.addEventListener('click',e=>{
        const btn=e.target.closest('.segbtn'); if(!btn) return;
        riskMode=btn.dataset.mode||'conservative';
        Array.from(riskModeSeg.querySelectorAll('.segbtn')).forEach(b=>b.classList.toggle('active',b===btn));
        const m=getSelectedFutures(); buildRisk(m.length?m:['ES']);
      });
    }
    if(riskCandles){
      const syncLabel=()=>{ riskCandlesLabel.textContent=`${riskCandles.value} candles`; };
      // Update label but do not commit value until confirmed
      riskCandles.addEventListener('input',()=>{
        // Reflect the live slider value in the label as the user drags, without committing.
        const val = parseInt(riskCandles.value,10) || prevSliderValue;
        riskCandlesLabel.textContent = `${val} candles`;
      });
      riskCandles.addEventListener('change',(e)=>{
        const newVal=parseInt(e.target.value,10)||3;
        if(newVal===prevSliderValue) { return; }
        // If the user has already confirmed slider changes, apply immediately without asking again.
        if(sliderConfirmed){
          prevSliderValue = newVal;
          riskCandles.value = newVal;
          // Update label to reflect new value
          if(riskCandlesLabel) riskCandlesLabel.textContent = `${newVal} candles`;
          // Immediately rebuild risk with new slider
          const sel=getSelectedFutures();
          buildRisk(sel.length? sel : ['ES']);
          return;
        }
        // Otherwise, show confirmation. Save pending value and revert slider display back to previous
        pendingSliderValue = newVal;
        riskCandles.value = prevSliderValue;
        syncLabel();
        const modal=document.getElementById('sliderConfirm');
        if(modal){
          modal.style.display='flex';
          // Bind click handlers to Accept and Cancel when modal shows.
          const acc=document.getElementById('sliderAccept');
          const can=document.getElementById('sliderCancel');
          if(acc){
            acc.onclick = () => {
              // commit the pending value and mark as confirmed
              if(typeof pendingSliderValue==='number') prevSliderValue = pendingSliderValue;
              sliderConfirmed = true;
              riskCandles.value = prevSliderValue;
              if(riskCandlesLabel) riskCandlesLabel.textContent = `${prevSliderValue} candles`;
              modal.style.display='none';
              const sel2=getSelectedFutures();
              buildRisk(sel2.length? sel2 : ['ES']);
            };
          }
          if(can){
            can.onclick = () => {
              modal.style.display='none';
              riskCandles.value = prevSliderValue;
              if(riskCandlesLabel) riskCandlesLabel.textContent = `${prevSliderValue} candles`;
            };
          }
        }
      });
      // Initial sync
      syncLabel();
    }

    // (Removed direct binding of sliderAccept/sliderCancel here; handlers are bound when the modal opens.)

    function lastNSignal(bars,N){
      const seg=(bars||[]).slice(-N); if(seg.length<N) return {text:'Recommend: <b>Wait</b> (need more bars)',action:'Wait',pct:0,up:false,dn:false};
      let up=true,dn=true; for(let i=1;i<seg.length;i++){if(!(seg[i].c>seg[i-1].c)) up=false; if(!(seg[i].c<seg[i-1].c)) dn=false;}
      const pct=((seg.at(-1).c - seg[0].c)/seg[0].c)*100;
      const base=0.05, thresh=base*(N/3);
      if(up && pct>=thresh) return {text:`Recommend: <b>Buy</b> (Aggressive: last ${N} ↑, +${pct.toFixed(2)}%)`,action:'Buy',pct,up:true,dn:false};
      if(dn && pct<=-thresh) return {text:`Recommend: <b>Sell</b> (Aggressive: last ${N} ↓, ${pct.toFixed(2)}%)`,action:'Sell',pct,up:false,dn:true};
      return {text:`Recommend: <b>Wait</b> (Aggressive: mixed/insufficient move)`,action:'Wait',pct,up:false,dn:false};
    }
    function conservativeSignal(info,bars,N){
      const seg=(bars||[]).slice(-N); if(seg.length<N||!info?.ok) return {text:'Recommend (Conservative): <b>Wait</b> (insufficient data)',action:'Wait'};
      let up=true,dn=true; for(let i=1;i<seg.length;i++){if(!(seg[i].c>seg[i-1].c)) up=false; if(!(seg[i].c<seg[i-1].c)) dn=false;}
      const pct=((seg.at(-1).c - seg[0].c)/seg[0].c)*100;
      const base=0.05, thresh=base*(N/3)*1.6;
      const alignUp = (info.direction==='Uptrend');
      const alignDn = (info.direction==='Downtrend');
      const busyOk  = (info.busyLabel==='Busy');

      if(up && pct>=thresh && (alignUp || busyOk)) return {text:`Recommend (Conservative): <b>Buy</b> (+${pct.toFixed(2)}% over ${N}m, aligned)`,action:'Buy'};
      if(dn && pct<=-thresh && (alignDn || busyOk)) return {text:`Recommend (Conservative): <b>Sell</b> (${pct.toFixed(2)}% over ${N}m, aligned)`,action:'Sell'};
      return {text:`Recommend (Conservative): <b>Wait</b> (safer bias)`,action:'Wait'};
    }
    function leanWindow(bars, minutesDesired){
      const lastN=(bars||[]).slice(-minutesDesired);
      if(lastN.length<2) return null;
      const first=lastN[0].c,last=lastN.at(-1).c; const pct=((last-first)/first)*100;
      let ups=0,downs=0; for(let i=1;i<lastN.length;i++){const d=lastN[i].c-lastN[i-1].c; if(d>0) ups++; else if(d<0) downs++;}
      const dir=(pct>0 || (Math.abs(pct)<1e-9 && ups>=downs))?'Bullish':'Bearish';
      const cls=dir==='Bullish'?'ok':'bad'; return {dir,cls,pct};
    }

    async function buildRisk(markets){
      const etf=FUTURES_TO_ETF[markets[0]||'ES']||'SPY';
      riskSymEl.textContent=etf; riskTimeEl.textContent=new Date().toLocaleString();
      // No need to reposition the candles label; it sits next to the mode buttons.
      riskSummaryEl.innerHTML='<span class="spinner"></span> Loading 1-minute bars...'; riskAdviceEl.innerHTML='';
      try{
        const all=await fetchIntraday(etf); try{ setMarketStatusFrom(all.regStart, all.regEnd, etf); }catch(_){}
        const sessionBars=filterToSession(all.bars, all.regStart, all.regEnd);
        const win=selectWindow(sessionBars,trendMinutes);
        const info=statsTrend(win);
        if(!info.ok){riskSummaryEl.innerHTML=`<span class="muted">Risk read unavailable (${info.reason}
        // Busy notification tracker
        try{ busyTrackerTick(info.busyLabel==='Busy'); }catch(_){}
)</span>`;drawTrend(riskCanvas,[]);return}

        const dirPill=`<span class="pill ${info.dirClass}"><i class="fa-solid fa-arrow-trend-${info.direction==='Downtrend'?'down':'up'}"></i> ${info.direction}</span>`;
        const busyPill=`<span class="pill ${info.busyClass}"><i class="fa-solid fa-bolt"></i> ${info.busyLabel}</span>`;
        const pctStr=`${info.pct>=0?'▲':'▼'} ${info.pct.toFixed(2)}%`;
        const slopeStr=`${info.slopePctPerHour>=0?'+':''}${info.slopePctPerHour.toFixed(2)}%/hr slope`;
        const volStr=`σ(1m) ${(info.std*100).toFixed(3)}% • Vol ratio ${info.volRatio.toFixed(2)}×`;
        riskSummaryEl.innerHTML=`${dirPill} ${busyPill}<div style="margin-top:8px" class="muted">${pctStr} • ${slopeStr} • ${volStr}</div>`;
        drawTrend(riskCanvas,win, lastBarProgress(win));
        setLegend(riskLegend);

        const N = Math.max(3, Math.min(15, riskCandlesN||3));
        let M = Math.min(6, win.length);
        if (M < 3) M = Math.min(3, win.length);

        let rec; if(riskMode==='aggressive'){ rec = lastNSignal(win, N); } else { rec = conservativeSignal(info, win, N); }
        // After computing the basic recommendation, perform breakout failure checks and append trade plan.
        {
          const seg=(win||[]).slice(-N);
          if(seg.length===N && rec && (rec.action==='Buy' || rec.action==='Sell')){
            let trigger=false;
            // Determine if the move has retraced beyond a volatility-scaled threshold; if so, revert to Wait.
            if(rec.action==='Buy'){
              let maxClose=-Infinity,lastClose=-Infinity;
              for(const b of seg){ if(b.c>maxClose) maxClose=b.c; }
              lastClose=seg.at(-1).c;
              const thresh=(info.std||0.0008)*3; // volatility-scaled threshold
              if(maxClose>0 && ((maxClose-lastClose)/maxClose)>thresh) trigger=true;
            } else if(rec.action==='Sell'){
              let minClose=Infinity,lastClose=Infinity;
              for(const b of seg){ if(b.c<minClose) minClose=b.c; }
              lastClose=seg.at(-1).c;
              const thresh=(info.std||0.0008)*3;
              if(minClose>0 && ((lastClose-minClose)/minClose)>thresh) trigger=true;
            }
            if(trigger){
              rec.action='Wait';
              rec.text=`Recommend: <b>Wait</b> (breakout retraced)`;
            }
            // Append trade management plan if still actionable
            if(rec.action==='Buy' || rec.action==='Sell'){
              const plan = riskMode==='aggressive' ? 'tight stop; partial profit & runner management' : 'loose stop; scaled targets';
              rec.text += ` – Plan: ${plan}`;
            }
          }
        }
        // Insert the recommendation pill and disclaimer.  Center the pill horizontally
        // within the advice container by using auto margins.
        // Build only the recommendation pill inside riskAdvice.  We'll move the disclaimer
        // outside and group the prediction/lean pills together on one line.
        riskAdviceEl.innerHTML = `
          <div class="pill autoscroll" id="riskRecPill" style="display:inline-flex;margin-top:10px;background:#2b2a31;border-color:#3a3941">
            <i class="fa-solid fa-lightbulb"></i>&nbsp; ${rec.text}
          </div>
        `;
        // Convert long recommendation text into a marquee if overflowing
        if (window.matchMedia('(max-width: 520px)').matches) { if (window.matchMedia('(max-width: 520px)').matches) { applyMarquee(document.getElementById('riskRecPill')); } }

        // NEW: Prediction blip (purple)
        const pred = marketPrediction(info, win);
        try{ notifCheckPred(etf, pred, info); }catch(_){}
        const pctConf = Math.round(pred.conf*100);
        const predEl = document.createElement('div');
        predEl.className='pill accent'; predEl.id='riskPredPill'; predEl.style.cursor='pointer'; predEl.title='Tap to see why';
        predEl.innerHTML = `<i class="fa-solid fa-crystal-ball"></i>&nbsp; Prediction: <b>${pred.text}</b> <span class="muted" style="margin-left:6px">(${pctConf}% conf)</span> <span class="muted" style="margin-left:6px">Next 5m: ${pred.forecast}</span>`;

        // Container for prediction and lean pills on the same line
        const pillRow = document.createElement('div');
        pillRow.style.display = 'flex';
        pillRow.style.gap = '8px';
        pillRow.style.flexWrap = 'wrap';
        pillRow.style.marginTop = '8px';
        // Attach click handler directly to the prediction pill before appending
        predEl.addEventListener('click', () => {
          const lastN = win.slice(-Math.min(15, win.length));
          const vwapArr = computeVWAP(lastN);
          const last = lastN.at(-1)?.c;
          const vwapVal = vwapArr.at(-1);
          let parts = [];
          parts.push(`Trend bias: <b>${info.direction}</b> (${info.direction==='Uptrend'?'+1':'Downtrend'==='Downtrend'?'-1':'0'} to score)`);
          parts.push(`Slope contribution: <b>${info.slopePctPerHour.toFixed(2)}%/hr</b> (tanh scaled)`);
          parts.push(`Price vs VWAP: <b>${last>vwapVal?'above':'below'}</b> VWAP`);
          let ups=0, downs=0;
          for(let i=1;i<lastN.length;i++){
            const d = lastN[i].c - lastN[i-1].c;
            if(d>0) ups++; else if(d<0) downs++;
          }
          parts.push(`Recent momentum: <b>${ups} up</b> vs <b>${downs} down</b>`);
          parts.push(`Confidence adjustment: tape is <b>${info.busyLabel}</b>`);
          openExplain({ title:'Why this prediction?', html:`<p>Prediction: <b>${pred.label}</b> (${Math.round(pred.conf*100)}% confidence)</p><ul style='margin-top:6px'>${parts.map(p=>`<li>${p}</li>`).join('')}</ul>` });
        });
        pillRow.appendChild(predEl);
        // We'll attach the recommendation pill handler after appending the pill row
    

        
const lean = leanWindowSmart(win, M);
if(lean){
  const pctStr = `${lean.pct>=0?'+':''}${lean.pct.toFixed(2)}%`;
  const extra = document.createElement('div');
  extra.className = `pill ${lean.cls}`;
  extra.title = `Score ${lean.score.toFixed(2)} • ${lean.reasons}`;
  extra.innerHTML =
    `<i class="fa-solid fa-clock-rotate-left"></i>&nbsp; Last <b>${M}m</b>: <b>${lean.dir}</b> (${pctStr}) ` +
    `<span class="muted" style="margin-left:6px">score ${lean.score.toFixed(2)}</span>`;
  extra.style.cursor='pointer';
  extra.addEventListener('click', ()=> {
    try {
      openExplain({
        title: 'Why this lean?',
        html: `<p><b>${lean.dir}</b> • score ${lean.score.toFixed(2)}</p>
               <ul style='margin-top:6px'>
                 ${lean.reasons.split(' • ').map(s=>`<li>${s}</li>`).join('')}
               </ul><p class='muted' style='margin-top:8px'>Interpretation: around <b>+1.1</b> is Bullish and <b>-1.1</b> is Bearish. Higher positive = stronger bull; more negative = stronger bear.</p>`
      });
    } catch(_) {}
  });
  pillRow.appendChild(extra);
}

        // Append the row of prediction/lean pills to the advice container
        riskAdviceEl.appendChild(pillRow);

        // Attach click handler to the recommendation pill after it exists.  We bind
        // this here because the element is inserted via innerHTML above.  When
        // clicked, it explains why the recommendation was given.
        {
          const recEl2 = document.getElementById('riskRecPill');
          if(recEl2){
            recEl2.onclick = () => {
              let logic='';
              if(riskMode==='aggressive'){
                logic = `Mode: <b>Aggressive</b> • Last <b>${N}</b> bars checked for consecutive moves.<br>Δ over window: <b>${rec.pct>=0?'+':''}${(rec.pct||0).toFixed(2)}%</b>.`;
              } else {
                logic = `Mode: <b>Conservative</b> • Aligns with window trend & tape.<br>Direction: <b>${info.direction}</b> • Tape: <b>${info.busyLabel}</b> • Δ window: <b>${info.pct>=0?'+':''}${info.pct.toFixed(2)}%</b>.`;
              }
              openExplain({ title:'Why this recommendation?', html:`<p>${rec.text}</p><p class='muted'>${logic}</p>` });
            };
            // Reapply marquee on mobile if needed after binding
            if(window.matchMedia('(max-width: 520px)').matches) { applyMarquee(recEl2); }
          }
        }

        // Move the disclaimer to just above the last refreshed row.  We create or update
        // a dedicated element with id=riskDisclaimer for this.
        {
          const refEl=document.getElementById('riskRef');
          if(refEl){
            const refRow=refEl.parentElement;
            let disc=document.getElementById('riskDisclaimer');
            if(!disc){
              disc=document.createElement('div');
              disc.id='riskDisclaimer';
              disc.className='muted';
              disc.style.marginTop='10px';
              disc.style.fontSize='12px';
              refRow.parentElement.insertBefore(disc, refRow);
            }
            disc.textContent='Disclaimer: This is an automated summary and not financial advice.';
          }
        }
        const refEl=document.getElementById('riskRef'); if(refEl){refEl.textContent=new Date().toLocaleTimeString();refEl.classList.remove('flash');void refEl.offsetWidth;refEl.classList.add('flash')}
        riskWinEl.textContent=`${trendMinutes}m`;
      }catch(e){riskSummaryEl.innerHTML=`<span class="muted">Risk fetch failed (${String(e.message||e)})</span>`;drawTrend(riskCanvas,[])}
    }

    /* ---------------- PnL chips ---------------- */
    const chipAK=document.getElementById('chipAK'), chipBG=document.getElementById('chipBG'), chipAKAll=document.getElementById('chipAKAll'), chipBGAll=document.getElementById('chipBGAll'), chipAKWrap=document.getElementById('chipAKWrap'), chipBGWrap=document.getElementById('chipBGWrap'); const chipAKAllWrap=document.getElementById('chipAKAllWrap'), chipBGAllWrap=document.getElementById('chipBGAllWrap');
    function setChipColor(elWrap,amount){
  elWrap.classList.remove('ok','bad','warn');
  const a = Number(amount)||0;
  if(a > 0) elWrap.classList.add('ok');
  else if(a < 0) elWrap.classList.add('bad');
  else elWrap.classList.add('warn');
}
    // ---------------- PnL totals with proxy fallback ----------------
async function pnlGetTotals(){
  if (!PNL_API || !PNL_TOKEN) {
    chipAK.textContent='N/A'; chipBG.textContent='N/A';
    chipAKAll.textContent='N/A'; chipBGAll.textContent='N/A';
    return;
  }
  const url = `${PNL_API}?token=${encodeURIComponent(PNL_TOKEN)}&ts=${Date.now()}`;

  async function tryDirect(){
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  }
  async function tryProxy(){
    if (typeof fetchWithFallback === 'function'){
      const fr = await fetchWithFallback(url, 'json', 12000, {});
      if (!fr.ok) throw new Error(fr.error || 'proxy fail');
      return fr.data;
    } else {
      throw new Error('no proxy');
    }
  }

  try {
    let j;
    try { j = await tryDirect(); }
    catch { j = await tryProxy(); }

    if (!j || !j.ok) throw new Error((j && j.error) || 'bad');

    const ak  = Number(j.today?.AK || 0);
    const bg  = Number(j.today?.BG || 0);
    const aka = Number(j.all?.AK   || 0);
    const bga = Number(j.all?.BG   || 0);

    chipAK.textContent    = `$${ak.toFixed(2)}`;
    chipBG.textContent    = `$${bg.toFixed(2)}`;
    chipAKAll.textContent = `$${aka.toFixed(2)}`;
    chipBGAll.textContent = `$${bga.toFixed(2)}`;
    setChipColor(chipAKWrap, aka); setChipColor(chipBGWrap, bga); setChipColor(chipAKAllWrap, aka); setChipColor(chipBGAllWrap, bga);
  } catch (e) {
    chipAK.textContent='N/A'; chipBG.textContent='N/A';
    chipAKAll.textContent='N/A'; chipBGAll.textContent='N/A';
    chipAKWrap.classList.add('warn'); chipBGWrap.classList.add('warn'); if (chipAKAllWrap) chipAKAllWrap.classList.add('warn'); if (chipBGAllWrap) chipBGAllWrap.classList.add('warn');
    // console.warn('[PnL] totals failed', e);
  }
}
// ------------- PnL: list today's entries & undo last -------------
// ------------- PnL: list today's entries (robust permutations) -------------






async function pnlUndoLast(){
  if (!PNL_API || !PNL_TOKEN) throw new Error('Missing API/token');
  const payload = { token: PNL_TOKEN, action:'undo' };

  async function tryDirect(){
    // Try POST (preflight-safe) then form-encoded
    try {
      const r = await fetch(PNL_API, {
        method: 'POST',
        headers: { 'Content-Type':'text/plain;charset=UTF-8', 'Accept':'application/json' },
        body: JSON.stringify(payload)
      });
      if (!r.ok) throw new Error('HTTP '+r.status);
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'undo failed');
      return j;
    } catch (e){
      const body = new URLSearchParams(payload).toString();
      const r2 = await fetch(PNL_API, {
        method: 'POST',
        headers: { 'Content-Type':'application/x-www-form-urlencoded', 'Accept':'application/json' },
        body
      });
      if (!r2.ok) throw new Error('HTTP '+r2.status);
      const txt = await r2.text();
      try { const j2 = JSON.parse(txt); if (!j2.ok) throw new Error(j2.error || 'undo failed'); return j2; }
      catch { return { ok:true, raw:txt }; }
    }
  }
  async function tryProxy(){
    if(typeof fetchWithFallback!=='function') throw new Error('no proxy');
    const url = `${PNL_API}?${new URLSearchParams(payload).toString()}`;
    const fr = await fetchWithFallback(url,'json',12000);
    if(!fr.ok) throw new Error(fr.error || 'proxy fail');
    const j = fr.data;
    if(!j || !j.ok) throw new Error(j?.error || 'undo failed');
    return j;
  }

  try { return await tryDirect(); }
  catch { return await tryProxy(); }
}


    /* ---------------- Prep flow ---------------- */
    function startAnalyze({linksOnly=false}={}){const sel=getSelectedFutures();const markets=sel.length?sel:['ES','NQ'];showPrepHeader(markets);makeLinks(markets);if(!linksOnly)buildSummary(markets);else summaryEl.innerHTML=`<span class="muted">Quick-links mode. Tap Analyze for auto-summary.</span>`;window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'})}

    /* ---------------- Events ---------------- */
    document.getElementById('start').addEventListener('click',()=>{setNav('nav-prep');setTab('prep');startAnalyze({linksOnly:false})});
    document.getElementById('runTrend').addEventListener('click',()=>{setNav('nav-trend');setTab('trend');const m=getSelectedFutures();buildTrend(m.length?m:['ES'])});
    document.getElementById('runRisk').addEventListener('click',()=>{setNav('nav-risk');setTab('risk');const m=getSelectedFutures();buildRisk(m.length?m:['ES'])});

    document.addEventListener('DOMContentLoaded',()=>{

      // Aligned 30s refresh: fires exactly at :00 and :30 to catch new minute bars
      function refreshAllCharts(){
        const m=getSelectedFutures();
        buildTrend(m.length?m:['ES']);
        buildRisk(m.length?m:['ES']);
      }
      function scheduleAlignedRefresh(){
        const now=new Date();
        const s=now.getSeconds(), ms=now.getMilliseconds();
        const until = ((30 - (s % 30)) % 30) * 1000 + (1000 - ms);
        setTimeout(()=>{
          refreshAllCharts();
          setInterval(refreshAllCharts, 30000);
        }, Math.max(50, until));
      }

      // auto-scroll the top stat chips like a ticker
      const strip=document.querySelector('.statstrip'); if(strip && window.matchMedia('(max-width: 520px)').matches) autoScrollContainer(strip, 18);
      pnlGetTotals(); setInterval(pnlGetTotals,120000); const btn=document.getElementById('logPnl'), msg=document.getElementById('pnlMsg');
      if(btn){btn.addEventListener('click',async()=>{try{const who=(document.querySelector('input[name="who"]:checked')||{}).value||'AK';const amt=(document.getElementById('pnlAmount')||{}).value||'';const note=(document.getElementById('pnlNote')||{}).value||'';if(!amt||isNaN(Number(amt))){msg.textContent='Enter a number (e.g. 125 or -75)';return}msg.textContent='Saving...';await pnlPostLog({user:who,amount:amt,note});msg.textContent='Saved ✓';document.getElementById('pnlAmount').value='';document.getElementById('pnlNote').value='';await pnlGetTotals();setTimeout(()=>msg.textContent='',1200)}catch(e){msg.textContent='Error: '+(e.message||e)}})}
      const undoBtn=document.getElementById('undoLast'); if(undoBtn) undoBtn.addEventListener('click', async ()=>{ const msg=document.getElementById('pnlMsg'); try{ if(msg) msg.textContent='Undoing...'; await pnlUndoLast(); if(msg) msg.textContent='Undone ✓'; await pnlGetTotals(); setTimeout(()=>{ if(msg) msg.textContent=''; }, 1200);} catch(e){ if(msg) msg.textContent='Undo failed: '+(e.message||e); } });
      setTfActive(15);

      // Start aligned refresh loop
      scheduleAlignedRefresh();
      initBell();

      // Initial market status
      updateMarketStatusInitial();
      // Update on selection/bundle changes
      try{ document.getElementById('futures').addEventListener('change', ()=>updateMarketStatusInitial()); }catch(_){}
      document.addEventListener('click', (ev)=>{ const b = ev.target && ev.target.closest && ev.target.closest('[data-bundle]'); if(b) setTimeout(updateMarketStatusInitial, 60); }, true);
    });

    
    
    
    function ensureExplainBindings(){
      const m=document.getElementById('explainModal'); if(!m||m.dataset.bound==='1') return;
      m.dataset.bound='1';
      const c=document.getElementById('explainClose');
      const close=()=>{ m.style.display='none'; };
      if(c){ c.addEventListener('click', (e)=>{ e.stopPropagation(); close(); }); }
      // click outside closes
      m.addEventListener('click', (e)=>{ if(e.target===m) close(); });
      // ESC closes
      window.addEventListener('keydown', (e)=>{ if(e.key==='Escape' && m.style.display!=='none') close(); });
    }
    function openExplain({title='Why?', html=''}){
      const m=document.getElementById('explainModal'); if(!m) return;
      ensureExplainBindings();
      const t=document.getElementById('explainTitle'); const b=document.getElementById('explainBody');
      t.textContent=title; b.innerHTML=html;
      m.style.display='flex';
    }

    function applyMarquee(el, minDur=10, pxPerSec=50){
      if(!el) return;
      // Only marquee if it would overflow
      if (el.scrollWidth <= el.clientWidth + 1) return;
      // If content fits, skip.
      const text = el.textContent.trim();
      if(!text) return;
      // Duplicate content for seamless loop
      el.classList.add('autoscroll');
      el.innerHTML = `<span class="track">${text}&nbsp;&nbsp;•&nbsp;&nbsp;${text}</span>`;
      // Duration proportional to content width
      requestAnimationFrame(()=>{
        const track = el.querySelector('.track');
        if(!track) return;
        const halfWidth = track.getBoundingClientRect().width/2;
        const dur = Math.max(minDur, halfWidth/pxPerSec);
        track.style.setProperty('--dur', dur+'s');
      });
    }
    function autoScrollContainer(el, pxPerSec=30){
      if(!el) return;
      el.style.scrollBehavior = 'auto';
      el.style.overflowX = 'auto';
      let last = performance.now();
      function step(t){
        const dt = (t-last)/1000; last = t;
        el.scrollLeft += pxPerSec * dt;
        if(el.scrollLeft >= el.scrollWidth - el.clientWidth - 1) el.scrollLeft = 0;
        requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

async function pnlPostLog({ user, amount, note }){
  if (!PNL_API) throw new Error('PNL_API missing');
  const payload = { token: PNL_TOKEN, user, amount, note };

  async function tryDirect(){
    // Try simple text/plain first (avoids CORS preflight in most browsers)
    try {
      const r = await fetch(PNL_API, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'save failed');
      return j;
    } catch(e){
      // Fallback: x-www-form-urlencoded (also avoids preflight)
      const body = new URLSearchParams(payload).toString();
      const r2 = await fetch(PNL_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
        body
      });
      if (!r2.ok) throw new Error('HTTP ' + r2.status);
      const txt = await r2.text();
      try {
        const j2 = JSON.parse(txt);
        if (!j2.ok) throw new Error(j2.error || 'save failed');
        return j2;
      } catch {
        // If Apps Script returns plain OK
        return { ok: true, raw: txt };
      }
    }
  }
  async function tryProxy(){
    if(typeof fetchWithFallback !== 'function') throw new Error('no proxy');
    const url = `${PNL_API}?${new URLSearchParams(payload).toString()}`;
    const fr = await fetchWithFallback(url,'json',12000);
    if(!fr.ok) throw new Error(fr.error || 'proxy fail');
    const j = fr.data;
    if(!j || !j.ok) throw new Error(j?.error || 'save failed');
    return j;
  }

  try { return await tryDirect(); }
  catch { return await tryProxy(); }
}
;

(function(){
  const riskCandles = document.getElementById('riskCandles');
  const riskCandlesLabel = document.getElementById('riskCandlesLabel');
  const fn = (typeof window.updateSliderBubble === 'function') ? window.updateSliderBubble : null;
  if(fn){ try{ fn(); }catch(e){} }
  if(riskCandles && fn){
    // guard against double-binding using a data-flag
    if(!riskCandles.dataset.bubbleWired){
      riskCandles.addEventListener('input', fn, {passive:true});
      riskCandles.dataset.bubbleWired = '1';
    }
  }
  // Always handle layout changes
  if(fn){ window.addEventListener('resize', fn); }
})();
;

// LITE_STICKY_QOL v2 (external JS build)
(function(){
  var cache = Object.create(null);
  var initialized = false;
  var preferSym = null;
  var building  = false;

  var LS_KEY = {
    sticky: 'riskTabs.sticky',
    order:  'riskTabs.order',
    pinned: 'riskTabs.pinned',
    last:   'riskTabs.lastActive'
  };
  function loadSet(key){ try{ return new Set(JSON.parse(localStorage.getItem(key)||'[]')); }catch(_){ return new Set(); } }
  function saveSet(key, set){ try{ localStorage.setItem(key, JSON.stringify(Array.from(set||[]))); }catch(_){ } }
  function loadMap(key){ try{ return JSON.parse(localStorage.getItem(key)||'{}')||{}; }catch(_){ return {}; } }
  function saveMap(key, obj){ try{ localStorage.setItem(key, JSON.stringify(obj||{})); }catch(_){ } }
  function loadArr(key){ try{ return JSON.parse(localStorage.getItem(key)||'[]')||[]; }catch(_){ return []; } }
  function saveArr(key, arr){ try{ localStorage.setItem(key, JSON.stringify(arr||[])); }catch(_){ } }
  function saveLast(sym){ try{ localStorage.setItem(LS_KEY.last, sym||''); }catch(_){ } }
  function loadLast(){ try{ return localStorage.getItem(LS_KEY.last)||null; }catch(_){ return null; } }

  var sticky = loadSet(LS_KEY.sticky);
  var pinned = loadMap(LS_KEY.pinned);
  var order  = loadArr(LS_KEY.order);

  function $(s, r){ return (r||document).querySelector(s); }
  function $all(s, r){ return Array.from((r||document).querySelectorAll(s)); }

  function riskPanel(){ return document.getElementById('panel-risk') || document.querySelector('[id^="panel-risk"]') || document.body; }
  function riskOut(){
    return document.getElementById('riskOut')
      || $('#panel-risk #riskOut')
      || $('#panel-risk [data-risk-out]')
      || $('#panel-risk .risk-out')
      || $('#panel-risk .card > div, #panel-risk .card section')
      || null;
  }
  function getSelect(){ return document.getElementById('futures'); }

  function symbolsFromChips(){
    var t = document.getElementById('multiSymbolTabs'); if (!t) return [];
    return $all('.tabbtn', t).map(function(b){
      var s=(b.dataset.sym||b.textContent||'').replace('×','').trim().toUpperCase();
      return /^[A-Z0-9]{1,4}$/.test(s)?s:null;
    }).filter(Boolean);
  }
  function selectedSymbols(){
    var sel = getSelect(); if (!sel) return [];
    var out=[];
    Array.from(sel.options).forEach(function(o){
      if (!o.selected) return;
      var tok=(o.value||o.text||o.innerText||'').trim().split(/\s|—|-/)[0].toUpperCase();
      if (/^[A-Z0-9]{1,4}$/.test(tok)) out.push(tok);
    });
    return out.filter((s,i,a)=>a.indexOf(s)===i);
  }
  function desiredSymbols(){
    var chips = symbolsFromChips();
    if (chips.length) return chips;
    return selectedSymbols();
  }

  function modeKey(){
    var root=riskPanel();
    var el=root.querySelector('[data-mode].active,[data-risk-mode].active,[aria-pressed="true"][data-mode],[aria-pressed="true"][data-risk-mode]');
    if (el) return (el.getAttribute('data-mode')||el.getAttribute('data-risk-mode')||'').toLowerCase();
    var btns=$all('button,.btn,[role="button"]',root);
    for (var i=0;i<btns.length;i++){
      var b=btns[i],t=(b.textContent||'').trim().toLowerCase();
      var pressed=b.matches('.active,[aria-pressed="true"]');
      if (pressed&&(t.includes('conservative')||t.includes('aggressive'))) return t.includes('conservative')?'conservative':'aggressive';
    }
    var sel=root.querySelector('select[name*="mode" i]'); if (sel) return (sel.value||'').toLowerCase();
    var rad=root.querySelector('input[type="radio"][name*="mode" i]:checked'); if (rad) return (rad.value||'').toLowerCase();
    return 'default';
  }
  function timeframeKey(){
    var root=riskPanel();
    var el=root.querySelector('[data-timeframe].active,[data-tf].active,[aria-pressed="true"][data-timeframe]');
    if (el) return (el.getAttribute('data-timeframe')||el.getAttribute('data-tf')||'').toLowerCase();
    var tfBtn=Array.from(root.querySelectorAll('button,.btn,.chip,.tag')).find(function(b){
      var active=b.matches('.active,[aria-pressed="true"]');
      var txt=(b.textContent||'').trim().toLowerCase();
      return active && (/^\d{1,3}\s*(m|min|minutes|h|hr|hour)s?$/i).test(txt);
    });
    if (tfBtn){ return (tfBtn.textContent||'').trim().toLowerCase().replace(/\s+/g,''); }
    return 'tf-default';
  }
  function ctxKey(sym){ return [sym, modeKey(), timeframeKey()].join('|'); }

  function ensureBar(){
    var out=riskOut(); if (!out) return null;
    var bar=document.getElementById('riskTabBar');
    if (!bar){
      bar=document.createElement('div'); bar.id='riskTabBar';
      out.parentNode.insertBefore(bar,out);
      var spacer=document.createElement('div'); spacer.className='spacer'; bar.appendChild(spacer);
      var menu=document.createElement('button'); menu.type='button'; menu.className='menuBtn'; menu.textContent='⋯';
      menu.addEventListener('click', function(ev){ ev.stopPropagation(); toggleContextMenu(ev.pageX, ev.pageY, null); }, false);
      bar.appendChild(menu);
    }else{
      if (!bar.querySelector('.spacer')){
        var spacer=document.createElement('div'); spacer.className='spacer'; bar.appendChild(spacer);
        var menu=document.createElement('button'); menu.type='button'; menu.className='menuBtn'; menu.textContent='⋯';
        menu.addEventListener('click', function(ev){ ev.stopPropagation(); toggleContextMenu(ev.pageX, ev.pageY, null); }, false);
        bar.appendChild(menu);
      }
    }
    return bar;
  }

  function shimmer(out){ if (out) out.innerHTML='<div class="risk-shimmer"></div>'; }

  function setActiveUI(sym){
    var bar=document.getElementById('riskTabBar'); if (!bar) return;
    $all('.rtab',bar).forEach(function(b){ b.classList.toggle('active', b.dataset.sym===sym); });
    try{ window.currentSymbol=sym; document.dispatchEvent(new CustomEvent('symbolchange',{detail:{symbol:sym,pane:'risk'}})); }catch(_){}
    try{ localStorage.setItem(LS_KEY.last, sym||''); }catch(_){}
  }
  function selectInDOM(sym){
    var sel=getSelect(); if (!sel) return;
    var idx=-1;
    for (var i=0;i<sel.options.length;i++){
      var o=sel.options[i]; var tok=(o.value||o.text||o.innerText||'').trim().split(/\s|—|-/)[0].toUpperCase();
      if (tok===sym){ o.selected=true; idx=i; }
    }
    if (idx>=0) sel.selectedIndex=idx;
    sel.dispatchEvent(new Event('input',{bubbles:true}));
    sel.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function findAnalyzeBtn(){
    return document.getElementById('btnAnalyzeRisk')
      || document.getElementById('btnRisk')
      || document.querySelector('[data-action="risk"]')
      || Array.from(document.querySelectorAll('button,.btn,[role="button"]')).find(function(el){
           var t=(el.textContent||'').toLowerCase(); return t.includes('analyze')&&t.includes('risk');
         }) || null;
  }
  function observeOnce(el,cb){
    if (!el || typeof MutationObserver==='undefined'){ setTimeout(cb,600); return; }
    var obs=new MutationObserver(function(){ obs.disconnect(); cb(); });
    obs.observe(el,{childList:true,subtree:true});
    setTimeout(function(){ try{obs.disconnect();}catch(_){ } try{ cb(); }catch(_){ } },2500);
  }
  function runAnalyze(sym){
    var out=riskOut(); if (!out) return;
    var btn=findAnalyzeBtn(); if (!btn) return;
    selectInDOM(sym); shimmer(out);
    observeOnce(out,function(){ try{ var html=out.innerHTML; if(!/risk-shimmer|Loading 1-minute bars/i.test(html)) cache[ctxKey(sym)]=html; }catch(_){ } });
    btn.click();
  }
  function activate(sym){
    preferSym=sym; setActiveUI(sym);
    var out=riskOut(); if (!out) return;
    var key=ctxKey(sym);
    if (cache[key]){ selectInDOM(sym); out.innerHTML = cache[key]; return; }
    if(/risk-shimmer|Loading 1-minute bars/i.test(cache[key])){ try{ delete cache[key]; }catch(_){ } } else { return; }
    runAnalyze(sym);
  }

  function togglePin(sym, btn){
    pinned[sym]=!pinned[sym]; if (!pinned[sym]) delete pinned[sym];
    saveMap(LS_KEY.pinned,pinned);
    if (btn) btn.classList.toggle('pinned', !!pinned[sym]);
  }

  function makeTab(sym){
    sticky.add(sym); saveSet(LS_KEY.sticky,sticky);
    if (order.indexOf(sym)===-1){ order.push(sym); saveArr(LS_KEY.order,order); }
    var b=document.createElement('button');
    b.type='button'; b.className='rtab'+(pinned[sym]?' pinned':''); b.dataset.sym=sym; b.draggable=true;
    b.innerHTML='<span class="label">'+sym+'</span> <span class="pin" title="Pin">📌</span> <span class="close" title="Close">×</span>';
    b.addEventListener('click',function(ev){
      var t=ev.target;
      if (t.classList && t.classList.contains('close')){
        sticky.delete(sym); saveSet(LS_KEY.sticky,sticky);
        var idx=order.indexOf(sym); if (idx>-1){ order.splice(idx,1); saveArr(LS_KEY.order,order); }
        b.remove();
        var active=document.querySelector('#riskTabBar .rtab.active');
        if (!active){
          var first=document.querySelector('#riskTabBar .rtab'); if (first) activate(first.dataset.sym);
          else { var o=riskOut(); if (o) o.innerHTML=''; }
        }
        return;
      }
      if (t.classList && t.classList.contains('pin')){ togglePin(sym,b); return; }
      activate(sym);
    },false);
    b.addEventListener('auxclick',function(ev){ if (ev.button===1){ ev.preventDefault(); b.querySelector('.close').click(); } });
    b.addEventListener('dragstart',function(ev){ ev.dataTransfer.setData('text/plain',sym); ev.dataTransfer.effectAllowed='move'; });
    b.addEventListener('dragover',function(ev){ ev.preventDefault(); ev.dataTransfer.dropEffect='move'; });
    b.addEventListener('drop',function(ev){
      ev.preventDefault(); var src=ev.dataTransfer.getData('text/plain'); if (!src||src===sym) return;
      var bar=document.getElementById('riskTabBar'); var srcBtn=bar.querySelector('.rtab[data-sym="'+src+'"]'); if (!srcBtn) return;
      var rect=b.getBoundingClientRect();
      if (ev.clientX < rect.left + rect.width/2){ bar.insertBefore(srcBtn,b); } else { bar.insertBefore(srcBtn,b.nextSibling); }
      order=Array.from(bar.querySelectorAll('.rtab')).map(function(x){ return x.dataset.sym; });
      saveArr(LS_KEY.order,order);
    });
    b.addEventListener('contextmenu',function(ev){ ev.preventDefault(); toggleContextMenu(ev.pageX,ev.pageY,sym); });
    return b;
  }

  function uniq(list){ var seen=new Set(), out=[]; list.forEach(function(s){ if (!seen.has(s)){ seen.add(s); out.push(s); } }); return out; }
  function existingTabSymbols(){
    var bar=document.getElementById('riskTabBar'); if (!bar) return [];
    return Array.from(bar.querySelectorAll('.rtab')).map(function(b){ return b.dataset.sym; });
  }

  function buildTabs(prefer){
    if (building) return; building=true;
    var bar=ensureBar(); if (!bar){ building=false; return; }

    var desired = desiredSymbols();
    var union = uniq([].concat(existingTabSymbols(), Array.from(sticky), desired));

    if (order && order.length){
      union.sort(function(a,b){
        var ia=order.indexOf(a), ib=order.indexOf(b);
        if (ia===-1 && ib===-1) return 0;
        if (ia===-1) return 1;
        if (ib===-1) return -1;
        return ia-ib;
      });
    }

    union.forEach(function(sym){
      if (!bar.querySelector('.rtab[data-sym="'+sym+'"]')){
        var btn=makeTab(sym);
        var spacer=bar.querySelector('.spacer');
        bar.insertBefore(btn, spacer || null);
      }else{
        var ex=bar.querySelector('.rtab[data-sym="'+sym+'"]');
        ex.classList.toggle('pinned', !!pinned[sym]);
      }
    });

    var last = prefer || preferSym || loadLast();
    var target = (last && union.indexOf(last)!==-1) ? last
                : (document.querySelector('#riskTabBar .rtab.active')||{}).dataset?.sym
                || union[0] || null;
    if (target){
      setActiveUI(target);
      var out=riskOut();
      if (out && !out.innerHTML.trim()){ activate(target); }
    }

    building=false;
  }

  var ctx=document.getElementById('riskContext');
  if (!ctx){ ctx=document.createElement('div'); ctx.id='riskContext'; document.body.appendChild(ctx); }
  function hideContext(){ ctx.style.display='none'; }
  function toggleContextMenu(x,y,sym){
    var bar=document.getElementById('riskTabBar'); if (!bar) return;
    var active=(document.querySelector('#riskTabBar .rtab.active')||{}).dataset?.sym || sym;
    ctx.innerHTML='';
    function add(label,fn){ var i=document.createElement('div'); i.className='mi'; i.textContent=label; i.addEventListener('click',function(ev){ ev.stopPropagation(); hideContext(); fn&&fn(); }); ctx.appendChild(i); }
    if (sym){
      add('Close', function(){ var b=bar.querySelector('.rtab[data-sym="'+sym+'"]'); if (b) b.querySelector('.close').click(); });
      add(pinned[sym]?'Unpin':'Pin', function(){ var b=bar.querySelector('.rtab[data-sym="'+sym+'"]'); if (b) togglePin(sym,b); });
      ctx.appendChild(document.createElement('hr'));
    }
    add('Close others', function(){
      Array.from(bar.querySelectorAll('.rtab')).forEach(function(b){ var s=b.dataset.sym; if (s!==active && !pinned[s]){ b.querySelector('.close').click(); } });
    });
    add('Close all (keep pinned)', function(){
      Array.from(bar.querySelectorAll('.rtab')).forEach(function(b){ var s=b.dataset.sym; if (!pinned[s]){ b.querySelector('.close').click(); } });
    });
    ctx.appendChild(document.createElement('hr'));
    add('Clear cache (active)', function(){ var key=ctxKey(active); delete cache[key]; });
    add('Clear cache (all)', function(){ cache = Object.create(null); });

    ctx.style.left=(x+4)+'px'; ctx.style.top=(y+4)+'px'; ctx.style.display='block';
  }
  document.addEventListener('click', hideContext, true);
  document.addEventListener('scroll', hideContext, true);
  window.addEventListener('blur', hideContext);

  document.addEventListener('keydown', function(e){
    var root=riskPanel(); if (!root.contains(document.activeElement) && !root.matches(':hover')) return;
    var bar=document.getElementById('riskTabBar'); if (!bar) return;
    var tabs=Array.from(bar.querySelectorAll('.rtab')); if (!tabs.length) return;
    var idx=Math.max(0,tabs.findIndex(x=>x.classList.contains('active')));
    function go(i){ if (i<0) i=tabs.length-1; if (i>=tabs.length) i=0; tabs[i].click(); }
    if ((e.ctrlKey||e.metaKey) && (e.key==='w'||e.key==='W')){ e.preventDefault(); var a=tabs[idx]; if (a) a.querySelector('.close').click(); return; }
    if ((e.ctrlKey && e.key==='PageUp') || (e.altKey && e.key==='ArrowLeft')){ e.preventDefault(); go(idx-1); return; }
    if ((e.ctrlKey && e.key==='PageDown') || (e.altKey && e.key==='ArrowRight')){ e.preventDefault(); go(idx+1); return; }
  }, true);

  function wireAnalyzeOnce(){
    if (initialized) return;
    var btn=findAnalyzeBtn(); if (!btn) return;
    initialized=true;
    btn.addEventListener('click', function(){
      setTimeout(function(){ buildTabs(preferSym||null); }, 300);
    }, false);
  }

  document.addEventListener('click', function(e){
    var root=riskPanel(); if (!root.contains(e.target)) return;
    var t=(e.target.textContent||'').toLowerCase();
    var looksMode=t.includes('conservative')||t.includes('aggressive')||e.target.matches('[data-mode],[data-risk-mode]');
    var looksTF=e.target.matches('[data-timeframe],[data-tf]')||/^\s*\d{1,3}\s*(m|min|minutes|h|hr|hour)s?\s*$/i.test((e.target.textContent||''));
    if (looksMode||looksTF){
      var out=riskOut(); if (!out) return;
      var el=document.querySelector('#riskTabBar .rtab.active'); var active=el?el.dataset.sym:preferSym;
      if (!active) return;
      observeOnce(out,function(){ try{ var html=out.innerHTML; if(!/risk-shimmer|Loading 1-minute bars/i.test(html)) cache[ctxKey(active)]=html; }catch(_){ } });
    }
  }, true);

  window.addEventListener('load', function(){
    try{ wireAnalyzeOnce(); }catch(_){}
    setTimeout(wireAnalyzeOnce, 500);
    setTimeout(wireAnalyzeOnce, 1200);
    setTimeout(function(){ buildTabs(localStorage.getItem(LS_KEY.last)||null); }, 600);
  });

  window.riskTabsForceRebuild = function(){ buildTabs(preferSym||null); };
})();
;

// Bridge v3: sync chips + select + force analyze on tab click (works for pinned tabs)
(function(){
  var pending = null;

  function $(s, r){ return (r||document).querySelector(s); }
  function $$(s, r){ return Array.from((r||document).querySelectorAll(s)); }

  // --- symbol helpers ---
  function symTok(s){
    return (s||'').replace(/[×✕✖📌★]/g,'').trim().split(/\s+/)[0].toUpperCase();
  }
  function getSymbolFromNode(node){
    if (!node) return null;
    var el = node.closest('.rtab,.tabbtn,[data-sym]') || node;
    var sym = el.getAttribute('data-sym') || el.getAttribute('aria-label') || el.textContent || '';
    sym = symTok(sym);
    return (/^[A-Z0-9]{1,4}$/).test(sym) ? sym : null;
  }

  // --- DOM sync: chips row (#multiSymbolTabs) ---
  function syncChips(sym){
    var row = document.getElementById('multiSymbolTabs');
    if (!row) return;
    var btn = row.querySelector('.tabbtn[data-sym="'+sym+'"]') || Array.from(row.querySelectorAll('.tabbtn')).find(function(b){ return symTok(b.textContent)===sym; });
    if (!btn) return;
    // mark active and move to front to be "primary"
    Array.from(row.querySelectorAll('.tabbtn')).forEach(function(b){ b.classList.toggle('active', b===btn); });
    if (btn.previousElementSibling){
      row.insertBefore(btn, row.firstElementChild || null);
    }
  }

  // --- DOM sync: multi-select ---
  function findMultiSelect(){
    var sel = document.getElementById('futures');
    if (sel) return sel;
    // Fallback: any multiple <select> inside the market chooser card
    var picks = $$('select[multiple]');
    if (picks.length) return picks[0];
    return null;
  }
  function setMultiSelect(sym){
    var sel = findMultiSelect(); if (!sel) return;
    var targetIndex = -1;
    for (var i=0;i<sel.options.length;i++) sel.options[i].selected = false;
    for (var j=0;j<sel.options.length;j++){
      var o = sel.options[j];
      var tok = symTok((o.value||o.text||o.innerText||''));
      if (tok === sym){ o.selected = true; targetIndex = j; break; }
    }
    if (targetIndex >= 0) sel.selectedIndex = targetIndex;
    sel.dispatchEvent(new Event('input',  {bubbles:true, cancelable:true}));
    sel.dispatchEvent(new Event('change', {bubbles:true, cancelable:true}));
  }

  // --- native refresh hooks or Analyze (Risk) ---
  function findAnalyzeBtn(){
    return document.getElementById('btnAnalyzeRisk')
        || document.getElementById('btnRisk')
        || document.querySelector('[data-action="risk"]')
        || Array.from(document.querySelectorAll('button, .btn, [role="button"]')).find(function(el){
             var t=(el.textContent||'').toLowerCase();
             return t.includes('analyze') && t.includes('risk');
           }) || null;
  }
  function nativeRefresh(sym){
    try{
      if (typeof window.refreshRisk === 'function'){ window.refreshRisk(sym); return true; }
      if (typeof window.renderSymbol === 'function'){ window.renderSymbol(sym); return true; }
      if (typeof window.refreshSymbol === 'function'){ window.refreshSymbol(sym); return true; }
    }catch(_){}
    return false;
  }
  function reAnalyze(sym){
    if (!sym) return;
    try{ if (pending) clearTimeout(pending); }catch(_){}
    pending = setTimeout(function(){
      syncChips(sym);
      setMultiSelect(sym);
      selectInDOM(sym);
      if (!nativeRefresh(sym)) {  try {    if (typeof window.buildRisk === 'function') {      const m = (typeof getSelectedFutures==='function') ? getSelectedFutures() : [sym];      window.buildRisk(Array.isArray(m)&&m.length?m:[sym]);    } else {      var btn = findAnalyzeBtn(); if (btn) btn.click();    }  } catch(_) {    var btn = findAnalyzeBtn(); if (btn) btn.click();  }}
    }, 50);
  }

  function bind(){
    var bar = document.getElementById('riskTabBar');
    if (!bar || bar.dataset._bridgedV3) return;
    bar.dataset._bridgedV3 = '1';

    function handler(e){
      var tab = e.target.closest('.rtab');
      if (!tab) return;
      if (e.type === 'auxclick' && e.button === 1) return; // middle-click for close
      if (e.target && e.target.classList && (e.target.classList.contains('close') || e.target.classList.contains('pin'))) return;
      var sym = getSymbolFromNode(tab);
      if (!sym) return;
      // Let internal handler mark active; then force re-analyze
      setTimeout(function(){  try{ activate(sym); }catch(_){ reAnalyze(sym); }  try{ if(typeof window.syncChips==='function'){ syncChips(sym); } }catch(_){ }  try{ if(typeof window.buildRisk==='function'){    const m=(typeof getSelectedFutures==='function')?getSelectedFutures():[sym];    window.buildRisk(Array.isArray(m)&&m.length?m:[sym]);  }}catch(_){ }},0);}
    bar.addEventListener('click', handler, false);
    bar.addEventListener('pointerup', handler, false);
    bar.addEventListener('auxclick', handler, false);
  }

  function observe(){
    var panel = document.getElementById('panel-risk') || document.body;
    if (!panel || typeof MutationObserver === 'undefined') return;
    var mo = new MutationObserver(function(){
      try{ bind(); }catch(_){}
    });
    mo.observe(panel, {childList:true, subtree:true});
  }

  function boot(){
    try{ bind(); }catch(_){}
    var tries = 10;
    (function again(){
      if (tries-- <= 0) return;
      setTimeout(function(){ try{ bind(); }catch(_){ } again(); }, 300);
    })();
    try{ observe(); }catch(_){}
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, {once:true});
  } else {
    boot();
  }
  window.addEventListener('load', function(){ try{ bind(); }catch(_){} });
})();
;

(()=>{
  const ready = (fn)=>{
    if (document.readyState === 'complete' || document.readyState === 'interactive') { setTimeout(fn,0); }
    else { document.addEventListener('DOMContentLoaded', fn); }
  };
  ready(()=>{
    try {
      const setNav = window.setNav || (function(){});
      const el = (id)=>document.getElementById(id);

      const navSettings = el('nav-settings') || document.querySelector('[data-nav="nav-settings"]');
      const navPnL      = el('nav-pnl')      || document.querySelector('[data-nav="nav-pnl"]');
      const navPrepId   = 'nav-prep';

      const makeToggle = (node, showId)=>{
        if (!node) return;
        node.onclick = (ev)=>{
          try { ev.preventDefault(); } catch(e){}
          const isActive = node.classList.contains('active');
          setNav(isActive ? navPrepId : showId);
          return false;
        };
      };

      makeToggle(navSettings, 'nav-settings');
      makeToggle(navPnL, 'nav-pnl');
    } catch(e){ /* no-op */ }
  });
})();
;

(()=>{
  const safe = (fn)=>{ try{ fn(); }catch(_){} };
  const getActiveNavId = ()=>{
    const a = document.querySelector('.topnav .active, [data-nav].active, .nav .active');
    return a?.id || a?.getAttribute?.('data-nav') || '';
  };
  const getSymbols = ()=>{
    // Try helper if present, else fallbacks
    let sel = [];
    try { if (typeof getSelectedFutures === 'function') sel = getSelectedFutures(); } catch(e){}
    if (!sel || (Array.isArray(sel) && sel.length===0)) {
      const guess = window.currentSymbol || window.lastSymbol || 'ES';
      sel = Array.isArray(guess) ? guess : [guess];
    }
    return sel;
  };

  // Delegate clicks on any [data-tf] buttons. Run after the app's handler.
  document.addEventListener('click', (ev)=>{
    const btn = ev.target.closest('[data-tf]');
    if (!btn) return;
    setTimeout(()=>{
      const navId = getActiveNavId();
      const syms = getSymbols();
      if (/nav-trend/.test(navId) && typeof window.buildTrend === 'function') {
        safe(()=>window.buildTrend(syms));
      } else if (/nav-risk/.test(navId) && typeof window.buildRisk === 'function') {
        safe(()=>window.buildRisk(syms));
      }
    }, 0);
  }, true);
})();
;

(()=>{
  const reapplyMarker = ()=>{
    try{
      if (typeof window.updateCandleMarker === 'function') { updateCandleMarker(); return; }
      if (typeof window.positionCandleMarker === 'function') { positionCandleMarker(); return; }
      if (typeof window.refreshMarker === 'function') { refreshMarker(); return; }
    }catch(_){}
  };
  document.addEventListener('risk:rendered', reapplyMarker);
  document.addEventListener('trend:rendered', reapplyMarker);
  // Fallback: after our forced rebuilds, try once on microtask
  setTimeout(reapplyMarker, 0);
})();
;

(()=>{
  const ensureRow = ()=>{
    let row = document.getElementById('multiSymbolTabs');
    if (!row) {
      const anchor = document.querySelector('div.card') || document.body;
      row = document.createElement('div');
      row.id = 'multiSymbolTabs';
      row.className = 'tabs';
      row.setAttribute('aria-label','Open symbols');
      anchor.parentNode.insertBefore(row, anchor);
    }
    return row;
  };

  const norm = s => (s||'').toUpperCase().trim().replace(/[^A-Z0-9]/g,'').slice(0,4);
  const valid = s => /^[A-Z0-9]{1,4}$/.test(s||'');

  function addChip(sym){
    sym = norm(sym);
    if (!valid(sym)) return;
    const row = ensureRow();
    let ex = row.querySelector('.tabbtn[data-sym="'+sym+'"]');
    if (!ex){
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tabbtn qt-chip';
      b.dataset.sym = sym;
      b.textContent = sym;
      b.addEventListener('click', ()=>{
        try { activate(sym); } catch(_) { try { reAnalyze(sym); } catch(e){} }
      }, false);
      row.insertBefore(b, row.firstChild);
      ex = b;
    }
    Array.from(row.querySelectorAll('.tabbtn')).forEach(btn=>btn.classList.toggle('active', btn===ex));
  }

  function selectedSymbolsFallback(){
    try{
      const sel = document.getElementById('futures');
      if (!sel) return [];
      const out = [];
      Array.from(sel.options).forEach(o=>{ if(o.selected){ const tok=(o.value||o.text||'').split(/[ \u2014-]/)[0].toUpperCase(); if(/^[A-Z0-9]{1,4}$/.test(tok)) out.push(tok);} });
      return Array.from(new Set(out));
    }catch(_){ return []; }
  }

  function addChipsForSelected(){
    let syms = [];
    try { if (typeof getSelectedFutures==='function') syms = getSelectedFutures() || []; } catch(_){}
    if (!Array.isArray(syms) || !syms.length) syms = selectedSymbolsFallback();
    if (Array.isArray(syms) && syms.length) syms.forEach(addChip);
  }

  // A) On futures selection change
  window.addEventListener('change', (ev)=>{
    if (ev.target && ev.target.closest && ev.target.closest('#futures')){
      setTimeout(addChipsForSelected, 0);
    }
  }, true);

  // B) On bundle click
  document.addEventListener('click', (ev)=>{
    const b = ev.target && ev.target.closest('[data-bundle]');
    if (b) setTimeout(addChipsForSelected, 60);
  }, true);

  // C) On Analyze (Risk) click
  document.addEventListener('click', (ev)=>{
    const btn = ev.target && ev.target.closest('button,.btn,[role="button"]');
    if (!btn) return;
    const txt = (btn.textContent||'').toLowerCase();
    const looksAnalyzeRisk = btn.matches('[data-action="risk"]') || (txt.includes('analyze') && txt.includes('risk'));
    if (looksAnalyzeRisk) setTimeout(addChipsForSelected, 200);
  }, true);

  // D) On Risk tab click (above risk card)
  document.addEventListener('click', (ev)=>{
    const rtab = ev.target && ev.target.closest('#riskTabBar .rtab');
    if (rtab && rtab.dataset && rtab.dataset.sym) setTimeout(()=>addChip(rtab.dataset.sym), 0);
  }, true);

  // E) First load
  window.addEventListener('load', ()=>{
    ensureRow();
    setTimeout(addChipsForSelected, 400);
  });
})();
;

(()=>{
  const $ = (s, r=document)=>r.querySelector(s);
  const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));

  // Prefer existing function if present
  const rebuild = ()=>{
    try { if (typeof window.riskTabsForceRebuild==='function') return window.riskTabsForceRebuild(); } catch(_){}
    try { if (typeof window.buildTabs==='function') return window.buildTabs(window.preferSym||null); } catch(_){}
  };

  // 1) Rebuild tabs when futures selection changes
  window.addEventListener('change', (e)=>{
    const sel = e.target && e.target.closest('#futures');
    if (sel) setTimeout(rebuild, 50);
  }, true);

  // 2) Rebuild after clicking a bundle
  document.addEventListener('click', (e)=>{
    const btn = e.target && e.target.closest('[data-bundle]');
    if (btn) setTimeout(rebuild, 120);
  }, true);

  // 3) Robust Analyze (Risk) detection using closest()
  document.addEventListener('click', (e)=>{
    const btn = e.target && e.target.closest('button,.btn,[role="button"]');
    if (!btn) return;
    const txt = (btn.textContent||'').toLowerCase();
    const looksAnalyzeRisk = btn.matches('[data-action="risk"]')
                           || (txt.includes('analyze') && txt.includes('risk'));
    if (looksAnalyzeRisk){
      setTimeout(rebuild, 300);
    }
  }, true);

  // 4) Also rebuild when a pinned Risk tab is clicked (ensures bar stays in sync)
  document.addEventListener('click', (e)=>{
    const rtab = e.target && e.target.closest('#riskTabBar .rtab');
    if (rtab) setTimeout(rebuild, 0);
  }, true);

  // 5) First load safety net
  window.addEventListener('load', ()=>{
    setTimeout(rebuild, 700);
  });
})();
;

(()=>{
  const row = document.getElementById('riskQuickTabs');
  if (!row) return;

  const LS = {
    ORDER: 'quickTabs.order',
    LAST:  'quickTabs.last',
    REFRESH: 'quickTabs.refresh'
  };

  const norm = s => (s||'').toUpperCase().trim().replace(/[^A-Z0-9]/g,'').slice(0,4);
  const valid = s => /^[A-Z0-9]{1,4}$/.test(s||'');

  let refreshTimer = null;

  function clearTimer(){
    if (refreshTimer){ try{ clearInterval(refreshTimer); }catch(_){ } refreshTimer=null; }
  }
  function startTimer(){
    clearTimer();
    const sel = row.querySelector('.qt-refresh');
    if (!sel) return;
    let v = sel.value || 'off';
    if (v === 'off') { v = '30'; sel.value = '30'; }
    localStorage.setItem(LS.REFRESH, v);
    const n = parseInt(v, 10);
    const ms = Number.isFinite(n) ? n*1000 : 0; // supports 15/30/60/120/etc
    if (!ms) return;
    refreshTimer = setInterval(()=>{
      const active = row.querySelector('.tabbtn.active');
      const sym = active && active.dataset.sym;
      if (!sym) return;
      try{ if (typeof selectInDOM==='function') selectInDOM(sym); }catch(_){}
      try{ if (typeof window.buildRisk==='function') window.buildRisk([sym]); }catch(_){}
    }, ms);
  }

  function ensureControls(){
    let ctl = row.querySelector('.qt-controls');
    if (ctl) return ctl;
    ctl = document.createElement('div');
    ctl.className = 'qt-controls';

    // Add-symbol UI
    const add = document.createElement('div');
    add.className = 'qt-add';
    const inp = document.createElement('input');
    inp.type = 'text'; inp.placeholder = 'SYM'; inp.maxLength = 4;
    const btn = document.createElement('button');
    btn.type = 'button'; btn.textContent = '+ Add';
    btn.addEventListener('click', ()=>{
      const s = norm(inp.value);
      if (!valid(s)) { inp.focus(); return; }
      ensureChip(s);
      activateChip(s);
      inp.value='';
    }, false);
    inp.addEventListener('keydown', (e)=>{ if (e.key==='Enter'){ e.preventDefault(); btn.click(); } });
    add.appendChild(inp); add.appendChild(btn);

    // Refresh dropdown (dynamic; includes 15s option)
    const sel = document.createElement('select');
    sel.className = 'qt-refresh';
    sel.innerHTML = ''
      + '<option value="off">Auto-refresh: Off</option>'
      + '<option value="15">Every 15s</option>'
      + '<option value="30">Every 30s</option>'
      + '<option value="60">Every 60s</option>'
      + '<option value="120">Every 120s</option>';
    let saved = localStorage.getItem(LS.REFRESH);
    if (!saved || saved === 'off') saved = '30';
    sel.value = saved;
    sel.addEventListener('change', startTimer, false);

    ctl.appendChild(add);
    ctl.appendChild(sel);
    row.appendChild(ctl);
    // Clear button
    const clr = document.createElement('button');
    clr.type='button'; clr.className='qt-clear'; clr.textContent='Clear selected'; clr.title='Remove the active chip';
    clr.addEventListener('click', (e)=>{  const active = row.querySelector('.tabbtn.active');  if (!active) return;  active.remove();  try{ localStorage.removeItem(LS.LAST); }catch(_){ }  try{ saveOrder(); }catch(_){ }  markActive(null);}, false);
    ctl.insertBefore(clr, sel);

    // Start timer per saved preference
    startTimer();
    return ctl;
  }

  function selectedSymbolsFallback(){
    try{
      const sel = document.getElementById('futures');
      if (!sel) return [];
      const out = [];
      Array.from(sel.options).forEach(o=>{
        if (o.selected){
          const tok=(o.value||o.text||o.innerText||'').split(/[ \u2014-]/)[0];
          const n = norm(tok); if (n) out.push(n);
        }
      });
      return Array.from(new Set(out));
    }catch(_){ return []; }
  }
  function getSyms(){
    try { if (typeof getSelectedFutures==='function') { const a=getSelectedFutures(); if (Array.isArray(a)&&a.length) return Array.from(new Set(a.map(norm).filter(valid))); } } catch(_){}
    return selectedSymbolsFallback();
  }

  function markActive(sym){
    Array.from(row.querySelectorAll('.tabbtn')).forEach(b=>b.classList.toggle('active', b.dataset.sym===sym));
    if (sym) localStorage.setItem(LS.LAST, sym);
    startTimer(); // maintain refresh for current active
  }

  function activateChip(sym){
    try{ if (typeof selectInDOM==='function') selectInDOM(sym); }catch(_){}
    try{ if (typeof window.buildRisk==='function') window.buildRisk([sym]); }catch(_){}
    markActive(sym);
  }

  function ensureChip(sym){
    sym = norm(sym);
    if (!valid(sym)) return null;
    let b = row.querySelector('.tabbtn[data-sym="'+sym+'"]');
    if (!b){
      b = document.createElement('button');
      b.type='button'; b.className = 'tabbtn qt-chip'; b.dataset.sym=sym; b.textContent=sym;
      b.setAttribute('draggable','true');
      b.addEventListener('click', ()=>activateChip(sym), false);
      b.addEventListener('auxclick', (e)=>{ if (e.button===1){ e.preventDefault(); b.remove(); saveOrder(); } }, false);
      // Drag reorder
      b.addEventListener('dragstart', (e)=>{ e.dataTransfer.setData('text/plain', sym); e.dataTransfer.effectAllowed='move'; }, false);
      b.addEventListener('dragover', (e)=>{ e.preventDefault(); e.dataTransfer.dropEffect='move'; }, false);
      b.addEventListener('drop', (e)=>{
        e.preventDefault();
        const src = e.dataTransfer.getData('text/plain');
        if (!src || src===sym) return;
        const srcBtn = row.querySelector('.tabbtn[data-sym="'+src+'"]');
        if (!srcBtn) return;
        const rect = b.getBoundingClientRect();
        if (e.clientX < rect.left + rect.width/2){ row.insertBefore(srcBtn, b); } else { row.insertBefore(srcBtn, b.nextSibling); }
        saveOrder();
      }, false);
      row.insertBefore(b, row.querySelector('.qt-controls') || null);
    }
    return b;
  }

  function currentOrder(){
    return Array.from(row.querySelectorAll('.tabbtn')).map(b=>b.dataset.sym);
  }
  function saveOrder(){
    localStorage.setItem(LS.ORDER, JSON.stringify(currentOrder()));
  }
  function applySavedOrder(){
    try{
      const raw = localStorage.getItem(LS.ORDER); if (!raw) return;
      const desired = JSON.parse(raw); if (!Array.isArray(desired)) return;
      desired.forEach(sym=>{
        const b = row.querySelector('.tabbtn[data-sym="'+sym+'"]');
        if (b) row.insertBefore(b, row.querySelector('.qt-controls') || null);
      });
    }catch(_){}
  }

  function rebuildChips(prefer=null){
    ensureControls();
    const syms = getSyms();
    syms.forEach(ensureChip);
    applySavedOrder();
    const last = prefer || localStorage.getItem(LS.LAST) || (syms[0]||null);
    if (last){
      ensureChip(last);
      markActive(last);
    }
  }

  // Wire to Analyze (Risk)
  document.addEventListener('click', (ev)=>{
    const btn = ev.target && ev.target.closest('button,.btn,[role="button"]');
    if (!btn) return;
    const txt = (btn.textContent||'').toLowerCase();
    const looksAnalyzeRisk = btn.matches('[data-action="risk"]') || (txt.includes('analyze') && txt.includes('risk'));
    if (looksAnalyzeRisk) setTimeout(()=>rebuildChips(), 250);
  }, true);

  // Also rebuild when selection changes or bundles clicked
  window.addEventListener('change', (ev)=>{
    if (ev.target && ev.target.closest && ev.target.closest('#futures')) setTimeout(()=>rebuildChips(), 0);
  }, true);
  document.addEventListener('click', (ev)=>{
    const b = ev.target && ev.target.closest('[data-bundle]'); if (b) setTimeout(()=>rebuildChips(), 80);
  }, true);

  // Keyboard: Ctrl+Left/Right to cycle chips
  document.addEventListener('keydown', (e)=>{
    if (!(e.ctrlKey || e.metaKey)) return;
    if (e.key!=='ArrowLeft' && e.key!=='ArrowRight') return;
    const chips = Array.from(row.querySelectorAll('.tabbtn'));
    if (!chips.length) return;
    const active = row.querySelector('.tabbtn.active');
    const idx = Math.max(0, chips.indexOf(active));
    e.preventDefault();
    const next = e.key==='ArrowLeft' ? (idx-1+chips.length)%chips.length : (idx+1)%chips.length;
    chips[next].click();
  }, true);

  // First load
  window.addEventListener('load', ()=>setTimeout(()=>rebuildChips(), 600));
})();
;

(()=>{
  function placeLabelRight(){
    try{
      const slider = document.getElementById('riskCandles');
      const label  = document.getElementById('riskCandlesLabel');
      if (!slider || !label) return;
      // Ensure label sits after slider and parent lays out horizontally
      const parent = slider.parentElement || slider.closest('div,section') || document.body;
      if (label.previousElementSibling !== slider){
        slider.after(label);
      }
      parent.style.display = 'flex';
      parent.style.alignItems = 'center';
      parent.style.gap = '8px';
      // Stop any previous absolute positioning
      label.style.left = 'auto';
      label.style.top = 'auto';
      label.style.transform = 'none';
      label.style.position = 'static';
    }catch(_){}
  }

  // Override bubble updater to only set text (no positioning)
  const safeOverride = ()=>{
    try{
      const prev = window.updateSliderBubble;
      window.updateSliderBubble = function(){
        try{
          const slider = document.getElementById('riskCandles');
          const label  = document.getElementById('riskCandlesLabel');
          if (!slider || !label) return;
          const v = parseInt(slider.value,10);
          label.textContent = (v||0) + (v===1?' candle':' candles');
          // keep static
          label.style.left='auto'; label.style.top='auto'; label.style.transform='none'; label.style.position='static';
        }catch(_){}
      };
    }catch(_){}
  };

  window.addEventListener('load', ()=>{ placeLabelRight(); safeOverride(); setTimeout(()=>{ try{window.updateSliderBubble&&window.updateSliderBubble();}catch(_){} }, 0); });
  window.addEventListener('resize', ()=>{ try{window.updateSliderBubble&&window.updateSliderBubble();}catch(_){} });
  document.addEventListener('input', (e)=>{ if (e && e.target && e.target.id==='riskCandles'){ try{ window.updateSliderBubble&&window.updateSliderBubble(); }catch(_){} } }, true);
})();
;

window.addEventListener('load', function(){
  try{
    var akW = document.getElementById('chipAKWrap');
    var akAll = document.getElementById('chipAKAll');
    if (akW && akAll && !akW.querySelector('.tag')){
      var t=document.createElement('span'); t.className='tag'; t.textContent='AK';
      akW.insertBefore(t, akAll);
    }
    var bgW = document.getElementById('chipBGWrap');
    var bgAll = document.getElementById('chipBGAll');
    if (bgW && bgAll && !bgW.querySelector('.tag')){
      var t2=document.createElement('span'); t2.className='tag'; t2.textContent='BG';
      bgW.insertBefore(t2, bgAll);
    }
  }catch(_){}
});
;

window.addEventListener('load', function(){
  try{
    var row = document.getElementById('riskQuickTabs');
    if (!row) return;
    document.querySelectorAll('.qt-chip').forEach(function(el){
      if (!row.contains(el)) el.remove();
    });
  }catch(_){}
});
;

// Delegated click handler: only runs if core functions exist
document.addEventListener('click', (ev)=>{
  const el = ev.target && (ev.target.closest ? ev.target.closest('#start, #runTrend, #runRisk') : null);
  if (!el) return;
  try{
    if (typeof window.setNav !== 'function' || typeof window.setTab !== 'function') return;
    if (el.id === 'start'){
      if (typeof window.startAnalyze === 'function'){
        window.setNav('nav-prep'); window.setTab('prep'); window.startAnalyze({linksOnly:false});
      }
    } else if (el.id === 'runTrend'){
      if (typeof window.buildTrend === 'function' && typeof window.getSelectedFutures === 'function'){
        window.setNav('nav-trend'); window.setTab('trend');
        const m = window.getSelectedFutures(); window.buildTrend(m.length? m : ['ES']);
      }
    } else if (el.id === 'runRisk'){
      if (typeof window.buildRisk === 'function' && typeof window.getSelectedFutures === 'function'){
        window.setNav('nav-risk'); window.setTab('risk');
        const m = window.getSelectedFutures(); window.buildRisk(m.length? m : ['ES']);
      }
    }
  }catch(e){ if (console && console.warn) console.warn('Analyze click failed:', e); }
});
;

// Keep Analyze buttons (Prep/Trend/Risk) visually "pressed" after click
(function(){
  function setAnalyzeActive(activeId){
    var ids = ['start','runTrend','runRisk'];
    ids.forEach(function(id){
      var el = document.getElementById(id);
      if(!el) return;
      var on = (id === activeId);
      el.classList.toggle('active', on);
      try{ el.setAttribute('aria-pressed', on ? 'true' : 'false'); }catch(_){}
    });
  }
  ['start','runTrend','runRisk'].forEach(function(id){
    var el = document.getElementById(id);
    if(!el) return;
    el.addEventListener('click', function(){ setAnalyzeActive(id); }, {capture:false, passive:true});
  });
})();
;

// Disable the global sticky-click from earlier for non-toggle buttons.
(function(){
  try{ localStorage.removeItem('GLASS_CLICKED_IDS'); }catch(_){}
  // On any click, if the element is not a known toggle, drop the 'clicked' class immediately.
  const toggles = new Set(['start','runTrend','runRisk','nav-prep','nav-trend','nav-risk','nav-settings','nav-pnl']);
  document.addEventListener('click', (ev)=>{
    const el = ev.target.closest('button, .btn, [role="button"], .tabbtn, .segbtn, input[type="button"], input[type="submit"]');
    if(!el) return;
    const isToggle = (el.id && toggles.has(el.id)) || el.classList.contains('tabbtn') || el.classList.contains('segbtn');
    if(!isToggle){
      // remove any leftover sticky class right after click
      setTimeout(()=>{ el.classList.remove('clicked'); }, 0);
    }
  }, true);
})();
;

(function(){
  const WATCH_KEY='STOCK_WATCH_ENABLED';
  const watchBtn=document.getElementById('nav-watch');
  function isEnabled(){ try{return localStorage.getItem(WATCH_KEY)==='1';}catch(_){return false;} }
  function setEnabled(v){ try{localStorage.setItem(WATCH_KEY,v?'1':'0');}catch(_){ } watchBtn && watchBtn.classList.toggle('active',!!v); }
  function ensurePerm(){ try{ if(!('Notification'in window))return; if(Notification.permission==='granted')return; if(Notification.permission!=='denied') Notification.requestPermission(()=>{});}catch(_){ } }
  function openWatchExplain(){
    const on=isEnabled();
    const html=`
      <div class="modal-head"><div class="icon"><i class="fa-regular fa-eye"></i></div><div class="title">Stock Watcher</div></div>
      <div class="row"><div class="left"><i class="fa-solid fa-bell"></i>Send a notification <b>each refresh</b> for the current Risk view.</div><input type="checkbox" id="sw_on" ${on?'checked':''} /></div>
      <div class="row"><div class="left"><i class="fa-solid fa-chart-line"></i>Includes <b>Recommendation</b> and <b>Prediction</b> for the active symbol.</div><span></span></div>
      <div class="row"><div class="left"><i class="fa-solid fa-filter"></i>Respects your selected symbols and timeframe.</div><span></span></div>
      <div class="hint">Uses your browser notifications. You may need to allow permission. Applies only while this tab is open.</div>
      <div class="actions"><button class="btn" id="sw_save">${on?'Save':'Start Watching'}</button><button class="btn secondary" id="sw_close">Close</button></div>`;
    if(typeof openExplain==='function'){
      openExplain({title:'',html});
      requestAnimationFrame(()=>{
        const $=s=>document.querySelector('#explainModal '+s);
        const tgl=$('#sw_on'), saveBtn=$('#sw_save'), closeBtn=$('#sw_close');
        if(tgl) tgl.addEventListener('change', ()=>{ const val=!!tgl.checked; setEnabled(val); if(val) ensurePerm(); });
        if(saveBtn) saveBtn.addEventListener('click', ()=>{ const val=!!(tgl && tgl.checked); setEnabled(val); if(val) ensurePerm(); const m=document.getElementById('explainModal'); if(m) m.style.display='none'; });
        if(closeBtn) closeBtn.addEventListener('click', ()=>{ const m=document.getElementById('explainModal'); if(m) m.style.display='none'; });
      });
    }
  }
  if(watchBtn){
    watchBtn.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); openWatchExplain(); });
    setEnabled(isEnabled());
  }
  // keep existing riskUpdate listener if present; otherwise no-op
})();
;

(function(){
  const WATCH_KEY='STOCK_WATCH_ENABLED';
  function isWatchOn(){ try{ return localStorage.getItem(WATCH_KEY)==='1'; }catch(_){ return false; } }
  function syncWatchBtn(){
    const btn=document.getElementById('nav-watch');
    if(!btn) return;
    btn.classList.toggle('active', isWatchOn());
  }
  document.addEventListener('DOMContentLoaded', syncWatchBtn);
  // If the explain modal toggles the setting, reflect immediately
  document.addEventListener('change', function(e){
    if(e && e.target && (e.target.id==='sw_on')){ setTimeout(syncWatchBtn, 0); }
  }, true);
  // Expose if needed
  window.syncWatchBtn = syncWatchBtn;
})();
;


(function(){
  function ctHourMinute(d){
    try{
      const parts = new Intl.DateTimeFormat('en-US', {timeZone:'America/Chicago', hour12:false, hour:'2-digit', minute:'2-digit'}).formatToParts(d);
      let hh=0, mm=0;
      for(const p of parts){ if(p.type==='hour') hh = parseInt(p.value,10); if(p.type==='minute') mm = parseInt(p.value,10); }
      return {hh, mm};
    }catch(_){ return {hh:d.getHours(), mm:d.getMinutes()}; }
  }
  function isTopstepOpen(d){
    const {hh, mm} = ctHourMinute(d||new Date());
    // Closed window: 15:10–17:00 CT daily
    const closed = ((hh>15 || (hh===15 && mm>=10)) && hh<17);
    return !closed;
  }
  function findMarketHoursChip(){
    // Prefer explicit ids if present
    let el = document.getElementById('marketHours') || document.getElementById('marketHoursChip');
    if(el) return el;
    // Fallback: look for a visible "Market hours" chip only (avoid touching other buttons)
    const candidates = document.querySelectorAll('.chip, .pill, [class*="chip"], [class*="pill"]');
    for(const c of candidates){
      const txt = (c.textContent||'').trim().toLowerCase();
      if(txt === 'market hours' || txt.indexOf('market hours') !== -1) return c;
    }
    return null;
  }
  function update(){
    const chip = findMarketHoursChip();
    if(!chip) return; // do nothing if it's not there
    const open = isTopstepOpen(new Date());
    chip.textContent = open ? 'Topstep: OPEN' : 'Topstep: CLOSED';
    chip.title = 'Topstep trading window: 5:00 pm – 3:10 pm CT';
    chip.classList.remove('ok','bad','warn');
    chip.classList.add(open ? 'ok' : 'bad');
  }
  function start(){
    try{ update(); }catch(_){}
    const now = new Date();
    const ms = (60-now.getSeconds())*1000 - now.getMilliseconds() + 50;
    setTimeout(function(){ update(); setInterval(update, 60000); }, Math.max(200, ms));
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
