// ============================================================
// admin-auth.js — 最高權限後台登入驗證 / 權限檢查 / 登出
// 規則：必須已登入 Supabase Auth 且 profiles.role === 'owner'。
// 非 owner（含 counselor）一律導回 admin-login.html，不可進入
// 任何最高權限後台頁面（與 counselor 後台入口分開）。
// ============================================================
const ADMIN_LOGIN_PAGE="admin-login.html";

let currentSession=null;
let currentProfile=null;

async function requireOwner(){
  const {data:{session}}=await sb.auth.getSession();
  if(!session){
    location.href=ADMIN_LOGIN_PAGE;
    return null;
  }
  const {data:profile,error}=await sb.from("profiles").select("id,role,display_name,email").eq("id",session.user.id).maybeSingle();
  if(error || !profile || profile.role!=="owner"){
    await sb.auth.signOut();
    location.href=ADMIN_LOGIN_PAGE+"?denied=1";
    return null;
  }
  currentSession=session;
  currentProfile=profile;
  return {session,profile};
}

async function adminLogout(){
  await sb.auth.signOut();
  location.href=ADMIN_LOGIN_PAGE;
}
