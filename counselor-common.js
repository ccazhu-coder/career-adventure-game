// ============================================================
// counselor-common.js — 諮詢師後台共用設定 / 工具函式 / 版型
// 與 admin-common.js 使用相同的 Supabase 專案與金鑰、相同的共用
// 工具函式（esc/分頁等），但版型（Sidebar 導覽）完全獨立，僅供
// counselor-*.html 使用。諮詢師後台與最高權限後台入口分開，
// 諮詢師不可進入 admin 任何頁面（見 counselor-auth.js）。
// ============================================================
const SUPABASE_URL = "https://bkovbcdqhljrnpyhfqdq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrb3ZiY2RxaGxqcm5weWhmcWRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMzgwMjAsImV4cCI6MjA5NjcxNDAyMH0.zp5poRNp3f1Dsuehaatkqj4etXA61aNBLoGew57FGY4";
const SITE_BASE_URL = "https://ccazhu-coder.github.io/career-adventure-game/";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ------------------------------------------------------------
// 共用小工具（與 admin-common.js / counselor.html 既有命名一致）
// ------------------------------------------------------------
function esc(v){return String(v??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));}
function escAttr(v){return esc(v).replace(/'/g,"&#39;");}
function fmtTime(v){return v ? String(v).replace("T"," ").slice(0,19) : "";}
function showMsg(id,msg,bad=false){
  const el=document.getElementById(id);
  if(!el) return;
  el.textContent=msg;
  el.className="notice"+(bad?" error":" success");
  el.classList.remove("hidden");
}
function showHtmlMsg(id,html,kind=""){
  const el=document.getElementById(id);
  if(!el) return;
  el.innerHTML=html;
  el.className="notice"+(kind==="error"?" error":(kind==="success"?" success":""));
  el.classList.remove("hidden");
}
function hideMsg(id){const el=document.getElementById(id);if(el) el.classList.add("hidden");}
function copyText(text,msgId){
  navigator.clipboard.writeText(text).then(()=>showMsg(msgId,"連結已複製。")).catch(()=>showMsg(msgId,"無法自動複製，請手動選取連結。",true));
}
function copyBoxText(id,msgId){
  const text=document.getElementById(id)?.textContent||"";
  if(!text){showMsg(msgId,"這筆資料尚無可複製的內容。",true);return;}
  navigator.clipboard.writeText(text).then(()=>showMsg(msgId,"已複製內容。")).catch(()=>showMsg(msgId,"無法自動複製，請手動選取文字。",true));
}
function genShortCode(prefix){
  const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s="";
  for(let i=0;i<4;i++) s+=chars[Math.floor(Math.random()*chars.length)];
  const p=String(prefix||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
  return (p?p+"-":"")+s;
}
function toTimestamptz(localValue){
  if(!localValue) return null;
  return localValue.length===16 ? localValue+":00+08:00" : localValue+"+08:00";
}
function toLocalInput(tzValue){
  if(!tzValue) return "";
  const d=new Date(tzValue);
  if(isNaN(d.getTime())) return "";
  const tz=new Date(d.getTime()+8*3600*1000);
  return tz.toISOString().slice(0,16);
}

// ------------------------------------------------------------
// 分頁
// ------------------------------------------------------------
function paginate(items,page,pageSize){
  const total=items.length;
  const totalPages=Math.max(1,Math.ceil(total/pageSize));
  const cur=Math.min(Math.max(1,page),totalPages);
  const start=(cur-1)*pageSize;
  return {pageItems:items.slice(start,start+pageSize),page:cur,totalPages,total};
}
function renderPagination(containerId,page,totalPages,onChange){
  const el=document.getElementById(containerId);
  if(!el) return;
  if(totalPages<=1){el.innerHTML="";return;}
  let html=`<button class="btn" ${page<=1?"disabled":""} data-page="${page-1}">上一頁</button>`;
  for(let p=1;p<=totalPages;p++){
    if(totalPages>7 && p!==1 && p!==totalPages && Math.abs(p-page)>1){
      if(p===2||p===totalPages-1) html+=`<span class="muted">...</span>`;
      continue;
    }
    html+=`<button class="btn${p===page?" active":""}" data-page="${p}">${p}</button>`;
  }
  html+=`<button class="btn" ${page>=totalPages?"disabled":""} data-page="${page+1}">下一頁</button>`;
  el.innerHTML=html;
  el.querySelectorAll("button[data-page]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const p=parseInt(btn.getAttribute("data-page"),10);
      if(!isNaN(p)) onChange(p);
    });
  });
}

// ------------------------------------------------------------
// 我的額度餘額 = 既有 counselor_authorizations 快照（唯讀）
//             + 新 credit_transactions 帳本（依 RLS 僅可讀自己的）
// ------------------------------------------------------------
function sumBalance(authorizations,creditTx){
  const legacy=(authorizations||[]).reduce((s,a)=>s+((a.purchased_quantity||0)-(a.used_quantity||0)),0);
  const ledger=(creditTx||[]).reduce((s,t)=>s+(t.delta||0),0);
  return legacy+ledger;
}

// ------------------------------------------------------------
// 諮詢師後台版型：固定左側 Sidebar + 上方 Header
// ------------------------------------------------------------
const COUNSELOR_NAV=[
  {key:"counselor-dashboard",label:"儀表板",href:"counselor-dashboard.html"},
  {key:"counselor-batches",label:"批次管理",href:"counselor-batches.html"},
  {key:"counselor-students",label:"學員資料",href:"counselor-students.html"},
  {key:"counselor-reports",label:"報告查詢",href:"counselor-reports.html"},
  {key:"counselor-credits",label:"額度查詢",href:"counselor-credits.html"},
  {key:"counselor-profile",label:"帳號資料",href:"counselor-profile.html"},
  {key:"counselor-guide",label:"操作說明書",href:"counselor-guide.html",external:true},
];

function renderCounselorShell(activeKey,opts={}){
  const sidebar=document.getElementById("sidebar");
  const topbar=document.getElementById("topbar");
  if(sidebar){
    sidebar.innerHTML=`
      <div class="brand">知己知途<small>諮詢師後台</small></div>
      <nav>
        ${COUNSELOR_NAV.map(item=>`<a href="${item.href}" class="${item.key===activeKey?"active":""}${item.external?" guide-link":""}"${item.external?' target="_blank" rel="noopener"':""}>${esc(item.label)}</a>`).join("")}
        <a href="#" class="logout-link" onclick="counselorLogout();return false;">登出</a>
      </nav>`;
  }
  if(topbar){
    topbar.innerHTML=`
      <h1>${esc(opts.title||"")}</h1>
      <div class="right"><span class="pill" id="sessionLabel">${esc(opts.sessionLabel||"")}</span></div>`;
  }
}
