// ============================================================
// admin-logs.js — 操作紀錄寫入共用函式
// 寫入新表 logs（見 database/admin-backend-new-tables.sql），
// 不影響任何既有資料表。寫入失敗不阻擋使用者操作（僅記錄警告）。
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
