/*! TBB Currency Converter — vanilla JS, zero-deps, CWV-friendly (c) thebukitbesi.com */
(function(w,d){
'use strict';

/* ===== Config ===== */
var ALLOW_HOSTS = ["thebukitbesi.com","localhost","127.0.0.1"]; // optional domain-allow
var DOMAIN_LOCK   = false; // set true if you want to lock execution to ALLOW_HOSTS
var CACHE_TTL_MS  = 60*60*1000; // 1 hour
var LS_KEY        = "tbbx_cc_cache_v1";

/* ===== Helpers ===== */
var $  = function(s,root){return (root||d).querySelector(s)};
var $$ = function(s,root){return Array.from((root||d).querySelectorAll(s))};

function okDomain(){
  if(!DOMAIN_LOCK) return true;
  var host=(w.location&&w.location.hostname||"").toLowerCase().replace(/^www\./,'');
  for(var i=0;i<ALLOW_HOSTS.length;i++){
    var dom=ALLOW_HOSTS[i].toLowerCase();
    if(host===dom||host.endsWith("."+dom)) return true;
  }
  return false;
}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,function(m){return({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m])})}
function readCache(){try{return JSON.parse(localStorage.getItem(LS_KEY)||"{}")}catch(e){return {}}}
function writeCache(o){try{localStorage.setItem(LS_KEY,JSON.stringify(o))}catch(e){}}

/* ISO 4217 minor units (partial; default=2). Extend as needed. */
var MINOR = {BHD:3,KWD:3,OMR:3,TND:3,JOD:3,LYD:3,IQD:3,JPY:0,KRW:0,VND:0,CLP:0,PYG:0,RWF:0,UGX:0,XAF:0,XOF:0,XPF:0,MGA:0,MRO:0,MRU:2,DEFAULT:2};
function minor(code){return (MINOR[code] != null ? MINOR[code] : MINOR.DEFAULT)}
function fmt(n,code){var d=minor(code);return Number(n).toLocaleString(undefined,{maximumFractionDigits:d,minimumFractionDigits:0})}
function precise(n,code){var d=minor(code);return Number(n).toFixed(Math.min(6,Math.max(d,2)))}

/* Providers */
var providers = {
  host:{
    name:"exchangerate.host",
    symbols:"https://api.exchangerate.host/symbols",
    latest:function(base){return "https://api.exchangerate.host/latest?base="+encodeURIComponent(base)},
    rate:function(from,to){return "https://api.exchangerate.host/convert?from="+encodeURIComponent(from)+"&to="+encodeURIComponent(to)}
  },
  frank:{
    name:"frankfurter",
    symbols:"https://api.frankfurter.dev/currencies",
    latest:function(base){return "https://api.frankfurter.dev/latest?from="+encodeURIComponent(base)},
    rate:function(from,to){return "https://api.frankfurter.dev/latest?from="+encodeURIComponent(from)+"&to="+encodeURIComponent(to)}
  }
};
/* Embedded “last-resort” rates (keeps UX alive offline) */
var EMBED = { base:"USD", date:"2025-01-01", rates:{MYR:4.20,SGD:1.34,EUR:0.90,IDR:15500,JPY:155,GBP:0.78} };

/* i18n (EN + BM). Pass data-lang on the wrapper: data-lang="ms" or "en" */
var I18N = {
  en:{
    title:"💱 TBB Currency Converter — Fast, Accurate, Ad-Free",
    amount:"Amount", from:"From", to:"To",
    convert:"Convert", swap:"Swap", quick:"Quick:",
    options:"Options", provider:"Provider",
    provider_host:"exchangerate.host", provider_frank:"Frankfurter (ECB)", provider_auto:"Auto (Best)",
    cache:"Cache rates in this browser", invert:"Show inverse rate",
    help:"Client-side only. ISO-accurate rounding. No tracking.",
    copying:"Copied!", copyfail:"Copy failed", linkcopied:"Link copied!",
    converting:"Converting…", unavailable:"Rate unavailable. Try other provider.",
    clipboard_label:"Copy", share_label:"Share"
  },
  ms:{
    title:"💱 Penukar Mata Wang TBB — Pantas, Tepat, Tanpa Iklan",
    amount:"Amaun", from:"Dari", to:"Ke",
    convert:"Tukar", swap:"Tukar Arah", quick:"Pantas:",
    options:"Tetapan", provider:"Penyedia",
    provider_host:"exchangerate.host", provider_frank:"Frankfurter (ECB)", provider_auto:"Auto (Terbaik)",
    cache:"Cache kadar dalam pelayar ini", invert:"Tunjuk kadar songsang",
    help:"100% sisi-klien. Pembundaran ISO yang tepat. Tiada penjejakan.",
    copying:"Disalin!", copyfail:"Salin gagal", linkcopied:"Pautan disalin!",
    converting:"Menukar…", unavailable:"Kadar tidak tersedia. Cuba penyedia lain.",
    clipboard_label:"Salin", share_label:"Kongsi"
  }
};

/* Main init (supports multiple widgets per page) */
function initAll(){
  if(!okDomain()) return;
  $$('.tbbx-cc-wrap[data-ready!="1"]').forEach(initWidget);
}

async function initWidget(root){
  root.setAttribute('data-ready','1');
  var lang = (root.getAttribute('data-lang')||'en').toLowerCase();
  var L = I18N[lang] || I18N.en;

  var amt = $('.tbbx-amt',root),
      from = $('.tbbx-from',root),
      to = $('.tbbx-to',root),
      out = $('.tbbx-out',root),
      rateinfo = $('.tbbx-rateinfo',root),
      btnConvert = $('.tbbx-convert',root),
      btnSwap = $('.tbbx-swap',root),
      chips = $$('.tbbx-chip',root),
      providerSel = $('.tbbx-provider',root),
      cacheChk = $('.tbbx-cache',root),
      invertChk = $('.tbbx-invert',root),
      btnCopy = $('.tbbx-copy',root),
      btnShare = $('.tbbx-share',root),
      titleEl = $('.tbbx-cc-title',root),
      helpEl = $('.tbbx-help',root),
      quickLabel = $('.tbbx-quick-label',root),
      providerLabel = $('.tbbx-provider-label',root);

  // Localize labels
  if(titleEl) titleEl.textContent = L.title;
  if(quickLabel) quickLabel.textContent = L.quick;
  if(providerLabel) providerLabel.textContent = L.provider;
  $$('.tbbx-label-amount',root).forEach(function(n){n.textContent=L.amount});
  $$('.tbbx-label-from',root).forEach(function(n){n.textContent=L.from});
  $$('.tbbx-label-to',root).forEach(function(n){n.textContent=L.to});
  if(btnConvert) btnConvert.textContent = L.convert;
  if(btnSwap) btnSwap.setAttribute('title',L.swap);
  if($('option[value="host"]',root)) $('option[value="host"]',root).textContent = L.provider_host;
  if($('option[value="frank"]',root)) $('option[value="frank"]',root).textContent = L.provider_frank;
  if($('option[value="auto"]',root)) $('option[value="auto"]',root).textContent = L.provider_auto;
  if($('.tbbx-cache-label',root)) $('.tbbx-cache-label',root).textContent = L.cache;
  if($('.tbbx-invert-label',root)) $('.tbbx-invert-label',root).textContent = L.invert;
  if(helpEl) helpEl.textContent = L.help;
  if(btnCopy) btnCopy.textContent = L.clipboard_label;
  if(btnShare) btnShare.textContent = L.share_label;

  // Symbols
  var SYMBOLS = await loadSymbols(
    (providerSel && providerSel.value==='frank') ? ['frank','host'] : ['host','frank']
  );
  fillSelect(from, SYMBOLS, ['MYR','USD','SGD','EUR','JPY']);
  fillSelect(to, SYMBOLS, ['USD','MYR','SGD','EUR','JPY']);

  // Defaults per language
  if(lang==='ms'){ from.value='MYR'; to.value='USD'; }
  else { from.value='USD'; to.value='MYR'; }
  if(amt) amt.value='100';

  // Events
  if(btnConvert) btnConvert.addEventListener('click', convert, {passive:true});
  if(btnSwap) btnSwap.addEventListener('click', swap, {passive:true});
  [from,to].forEach(function(el){ if(el) el.addEventListener('change', convert, {passive:true}) });
  if(amt) amt.addEventListener('keydown', function(e){ if(e.key==='Enter'){e.preventDefault();convert();}}, {passive:false});
  chips.forEach(function(ch){ ch.addEventListener('click', function(){ amt.value=ch.getAttribute('data-amt'); convert(); }, {passive:true})});
  if(providerSel) providerSel.addEventListener('change', function(){ localStorage.setItem('tbbx_provider', providerSel.value); convert(); }, {passive:true});
  if(invertChk) invertChk.addEventListener('change', convert, {passive:true});
  if(btnCopy) btnCopy.addEventListener('click', copyResult, {passive:true});
  if(btnShare) btnShare.addEventListener('click', shareResult, {passive:true});

  // Defer first run
  if ('requestIdleCallback' in w) { w.requestIdleCallback(convert,{timeout:1200}); } else { setTimeout(convert,0); }

  /* ---- Functions ---- */
  async function loadSymbols(order){
    for(var i=0;i<order.length;i++){
      var k = order[i];
      try{
        if(k==='host'){
          var h = await fetchJSON(providers.host.symbols);
          var list = Object.keys(h.symbols||{}).map(function(code){return {code:code,name:h.symbols[code].description}});
          if(list.length) return list;
        }else{
          var f = await fetchJSON(providers.frank.symbols);
          var list2 = Object.keys(f||{}).map(function(code){return {code:code,name:f[code]}});
          if(list2.length) return list2;
        }
      }catch(e){}
    }
    return [{code:'USD',name:'US Dollar'},{code:'MYR',name:'Malaysian Ringgit'},{code:'SGD',name:'Singapore Dollar'},{code:'EUR',name:'Euro'},{code:'JPY',name:'Japanese Yen'},{code:'IDR',name:'Indonesian Rupiah'},{code:'GBP',name:'British Pound'}];
  }
  function fillSelect(el, list, prefer){
    if(!el) return;
    var pref=list.filter(function(x){return (prefer||[]).includes(x.code)});
    var rest=list.filter(function(x){return !(prefer||[]).includes(x.code)}).sort(function(a,b){return a.code.localeCompare(b.code)});
    el.innerHTML=[].concat(pref,rest).map(function(c){return '<option value="'+c.code+'">'+c.code+' — '+escapeHTML(c.name)+'</option>'}).join('');
  }
  async function fetchJSON(url){
    var r = await fetch(url,{mode:'cors',cache:'no-store'});
    if(!r.ok) throw new Error('HTTP '+r.status);
    return await r.json();
  }
  async function getRate(fromC,toC,providerPref){
    var now=Date.now(), key=(providerPref||'auto')+':'+fromC+'->'+toC, cache=readCache();
    if($('.tbbx-cache',root)?.checked && cache[key] && (now-cache[key].ts)<CACHE_TTL_MS){
      return { rate:cache[key].rate, date:cache[key].date, provider:cache[key].provider, cached:true };
    }
    var order = (providerPref==='frank')?['frank']: (providerPref==='host'?['host']:['host','frank']);
    for(var i=0;i<order.length;i++){
      var p=order[i];
      try{
        if(p==='host'){
          var data=await fetchJSON(providers.host.rate(fromC,toC));
          var rate=Number(data.result); if(!isFinite(rate)||rate<=0) throw 0;
          var date=(data.date||'').slice(0,10);
          if($('.tbbx-cache',root)?.checked){ cache[key]={rate:rate,date:date,provider:p,ts:now}; writeCache(cache); }
          return { rate:rate, date:date, provider:p, cached:false };
        }else{
          var data2=await fetchJSON(providers.frank.rate(fromC,toC));
          var rate2=Number(data2.rates?.[toC]); if(!isFinite(rate2)||rate2<=0) throw 0;
          var date2=(data2.date||'').slice(0,10);
          if($('.tbbx-cache',root)?.checked){ cache[key]={rate:rate2,date:date2,provider:p,ts:now}; writeCache(cache); }
          return { rate:rate2, date:date2, provider:p, cached:false };
        }
      }catch(e){}
    }
    // embedded
    var base=EMBED.base, rate3=1;
    if(fromC===toC) rate3=1;
    else if(fromC===base && EMBED.rates[toC]) rate3=EMBED.rates[toC];
    else if(toC===base && EMBED.rates[fromC]) rate3=1/EMBED.rates[fromC];
    else if(EMBED.rates[fromC] && EMBED.rates[toC]) rate3=EMBED.rates[toC]/EMBED.rates[fromC];
    if(!isFinite(rate3)) throw new Error('no-embed');
    return { rate:rate3, date:EMBED.date, provider:'embedded', cached:true };
  }
  async function convert(){
    if(!amt||!from||!to||!out) return;
    var fromC=from.value, toC=to.value, val=Math.max(0, Number(amt.value||0));
    if(!fromC||!toC||!isFinite(val)) return;
    out.textContent = L.converting;
    try{
      var pref = $('.tbbx-provider',root)?.value || localStorage.getItem('tbbx_provider') || 'auto';
      var g = await getRate(fromC,toC,pref);
      var inv = $('.tbbx-invert',root)?.checked ? (1/g.rate) : g.rate;
      var result = val * inv;
      out.textContent = fmt(val,fromC)+' '+fromC+' = '+fmt(result,toC)+' '+toC;
      if(rateinfo) rateinfo.textContent = 'Rate: 1 '+fromC+' = '+precise(inv,toC)+' '+toC+' ('+g.provider+(g.cached?' • cached':'')+' • '+(g.date||'today')+')';
      out.setAttribute('data-raw', String(result));
    }catch(e){
      out.textContent = L.unavailable;
      if(rateinfo) rateinfo.textContent='';
    }
  }
  function swap(){ var a=from.value; from.value=to.value; to.value=a; convert(); }
  async function copyResult(){
    try{ await navigator.clipboard.writeText(out.textContent+(rateinfo?(' ('+rateinfo.textContent+')'):''));
      toast(L.copying);
    }catch(_){ toast(L.copyfail); }
  }
  async function shareResult(){
    var text = out.textContent+' • '+(rateinfo?rateinfo.textContent:'');
    var url = w.location.href.split('#')[0];
    try{
      if(navigator.share){ await navigator.share({title:'Currency Converter',text:text,url:url}); }
      else{ await navigator.clipboard.writeText(text+' '+url); toast(L.linkcopied); }
    }catch(_){}
  }
  function toast(msg){
    var t = d.getElementById('tbbx-toast');
    if(!t){ t=d.createElement('div'); t.id='tbbx-toast';
      t.style.cssText='position:fixed;inset:auto 12px 12px auto;background:var(--tbbx-fg);color:var(--tbbx-bg);padding:8px 12px;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,.2);z-index:9999;font:inherit;transition:opacity .25s';
      d.body.appendChild(t);
    }
    t.textContent=msg; t.style.opacity='1'; clearTimeout(t._id); t._id=setTimeout(function(){t.style.opacity='0'},1400);
  }
}

/* Autoinit */
if('requestIdleCallback' in w){ w.requestIdleCallback(initAll, {timeout:1200}); } else { w.addEventListener('DOMContentLoaded', initAll, {once:true}); }
})(window,document);
