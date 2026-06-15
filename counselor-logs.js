// ============================================================
// counselor-logs.js — 諮詢師後台操作紀錄寫入共用函式
// 寫入新表 logs（見 database/admin-backend-new-tables.sql）。
// 依 RLS，諮詢師僅可新增（insert）自己的操作紀錄，不可讀取
// logs 表（系統紀錄查詢僅 owner 可用，見 logs.html）。
// 寫入失敗不阻擋使用者操作（僅記錄警告）。
// ============================================================
async function logAction({actionType,targetType=null,targetId=null,before=null,after=null}){
  try{
    await sb.from("logs").insert({
      operator_id: currentSession?.user?.id || null,
      operator_name: currentProfile?.display_name || currentSession?.user?.email || null,
      operator_role: currentProfile?.role || null,
      action_type: actionType,
      target_type: targetType,
      target_id: targetId!=null ? String(targetId) : null,
      before_data: before,
      after_data: after,
      client_info: {ua: navigator.userAgent}
    });
  }catch(e){
    console.warn("logAction failed",e);
  }
}
