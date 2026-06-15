// ============================================================
// admin-common.js — 最高權限後台共用設定 / 工具函式 / 版型
// 與 admin.html / counselor.html 使用相同的 Supabase 專案與金鑰，
// 僅讀寫既有表（profiles/batches/submissions/license_plans/
// counselor_authorizations）與新表（credit_transactions/logs/
// admin_report_templates），不影響前台測驗。
// ============================================================
const SUPABASE_URL = "https://bkovbcdqhljrnpyhfqdq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrb3ZiY2RxaGxqcm5weWhmcWRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMzgwMjAsImV4cCI6MjA5NjcxNDAyMH0.zp5poRNp3f1Dsuehaatkqj4etXA61aNBLoGew57FGY4";
const ADMIN_FUNCTION_URL = SUPABASE_URL + "/functions/v1/admin-counselors";
const SITE_BASE_URL = "https://ccazhu-coder.github.io/career-adventure-game/";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ------------------------------------------------------------
// 共用小工具（與 admin.html / counselor.html 既有命名一致）
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
// 諮詢師額度餘額 = 既有 counselor_authorizations 快照
//               + 新 credit_transactions 帳本（預設 0）
// ------------------------------------------------------------
function computeCounselorBalances(authorizations,creditTx){
  const balances={};
  (authorizations||[]).forEach(a=>{
    const email=(a.counselor_email||"").toLowerCase();
    if(!email) return;
    balances[email]=(balances[email]||0)+((a.purchased_quantity||0)-(a.used_quantity||0));
  });
  (creditTx||[]).forEach(t=>{
    const email=(t.counselor_email||"").toLowerCase();
    if(!email) return;
    balances[email]=(balances[email]||0)+(t.delta||0);
  });
  return balances;
}
async function getCounselorBalance(email){
  const lower=(email||"").toLowerCase();
  const [authRes,creditRes]=await Promise.all([
    sb.from("counselor_authorizations").select("purchased_quantity,used_quantity").eq("counselor_email",lower),
    sb.from("credit_transactions").select("delta").eq("counselor_email",lower)
  ]);
  const legacy=(authRes.data||[]).reduce((s,a)=>s+((a.purchased_quantity||0)-(a.used_quantity||0)),0);
  const ledger=(creditRes.data||[]).reduce((s,t)=>s+(t.delta||0),0);
  return legacy+ledger;
}

// ------------------------------------------------------------
// admin-counselors Edge Function（沿用 admin.html 既有呼叫方式）
// ------------------------------------------------------------
async function callAdminFunction(payload){
  const {data:{session}}=await sb.auth.getSession();
  if(!session) throw new Error("登入已逾時，請重新登入");
  const res=await fetch(ADMIN_FUNCTION_URL,{
    method:"POST",
    headers:{"Content-Type":"application/json",apikey:SUPABASE_ANON_KEY,Authorization:"Bearer "+session.access_token},
    body:JSON.stringify(payload)
  });
  const json=await res.json();
  if(!json.ok) throw new Error(json.error||"操作失敗");
  return json;
}

// ------------------------------------------------------------
// 最高權限後台版型：固定左側 Sidebar + 上方 Header
// ------------------------------------------------------------
const ADMIN_NAV=[
  {key:"dashboard",label:"儀表板",href:"dashboard.html"},
  {key:"batches",label:"批次管理",href:"batches.html"},
  {key:"students",label:"學員資料",href:"students.html"},
  {key:"counselors",label:"諮詢師管理",href:"counselors.html"},
  {key:"credits",label:"額度管理",href:"credits.html"},
  {key:"plans",label:"授權方案",href:"plans.html"},
  {key:"reports",label:"報告資料庫",href:"reports.html"},
  {key:"logs",label:"系統紀錄",href:"logs.html"},
];

function renderAdminShell(activeKey,opts={}){
  const sidebar=document.getElementById("sidebar");
  const topbar=document.getElementById("topbar");
  if(sidebar){
    sidebar.innerHTML=`
      <div class="brand">知己知途<small>最高權限後台</small></div>
      <nav>
        ${ADMIN_NAV.map(item=>`<a href="${item.href}" class="${item.key===activeKey?"active":""}">${esc(item.label)}</a>`).join("")}
        <a href="#" class="logout-link" onclick="adminLogout();return false;">登出</a>
      </nav>`;
  }
  if(topbar){
    topbar.innerHTML=`
      <h1>${esc(opts.title||"")}</h1>
      <div class="right"><span class="pill" id="sessionLabel">${esc(opts.sessionLabel||"")}</span></div>`;
  }
}
