// ============================================================
// counselor-auth.js — 諮詢師後台登入驗證 / 權限檢查 / 登出
// 規則：必須已登入 Supabase Auth 且 profiles.role === 'consultant'。
// owner 帳號誤入時導向最高權限後台 dashboard.html（不可互通）；
// 其他角色或未登入一律導回 counselor-login.html。
// 後續所有查詢都應加上 .eq('counselor_email', myEmail) 做資料隔離。
// ============================================================
const COUNSELOR_LOGIN_PAGE="counselor-login.html";
const OWNER_DASHBOARD_PAGE="dashboard.html";

let currentSession=null;
let currentProfile=null;
let myEmail="";

async function requireConsultant(){
  const {data:{session}}=await sb.auth.getSession();
  if(!session){
    location.href=COUNSELOR_LOGIN_PAGE;
    return null;
  }
  const {data:profile,error}=await sb.from("profiles").select("id,role,display_name,email").eq("id",session.user.id).maybeSingle();
  if(error || !profile){
    await sb.auth.signOut();
    location.href=COUNSELOR_LOGIN_PAGE+"?denied=1";
    return null;
  }
  if(profile.role==="owner"){
    location.href=OWNER_DASHBOARD_PAGE;
    return null;
  }
  if(profile.role!=="consultant"){
    await sb.auth.signOut();
    location.href=COUNSELOR_LOGIN_PAGE+"?denied=1";
    return null;
  }
  currentSession=session;
  currentProfile=profile;
  myEmail=(profile.email||session.user.email||"").toLowerCase();
  return {session,profile,email:myEmail};
}

async function counselorLogout(){
  await sb.auth.signOut();
  location.href=COUNSELOR_LOGIN_PAGE;
}
