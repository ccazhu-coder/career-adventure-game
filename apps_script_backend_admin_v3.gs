/**
 * Apps Script 後台 v3：前台測驗寫入 Google Sheet、寄送 PDF、諮詢師後台登入/列表/PDF 下載。
 *
 * 使用方式：
 * 1. 打開 Apps Script，把原本 Code.gs 備份後替換成這份內容。
 * 2. 修改 CONFIG.SPREADSHEET_ID。
 * 3. 修改 CONFIG.REGISTRATION_CODE，交給允許使用後台的諮詢師註冊。
 * 4. 重新部署 Web App，執行身分選「我」，存取權建議選「知道連結的任何人」。
 */
const CONFIG = {
  SPREADSHEET_ID: "請填入你的 Google 試算表 ID",
  SHEET_NAME: "測驗回覆",
  REGISTRATION_CODE: "請改成一組不公開的諮詢師註冊碼",
  SESSION_TTL_SECONDS: 6 * 60 * 60
};

function doGet(e) {
  const p = (e && e.parameter) || {};
  const action = p.action || "";
  if (action === "adminDownloadPdf") return adminDownloadPdf_(p);

  const result = routeAdminJson_(p);
  return jsonp_(p.callback, result);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const record = payload.record || {};
    const now = new Date();
    record["送出時間"] = record["送出時間"] || now.toISOString();
    record["PDF寄送狀態"] = "待寄送";

    let pdfFile = null;
    try {
      if (payload.pdfBase64) {
        const blob = Utilities.newBlob(
          Utilities.base64Decode(payload.pdfBase64),
          "application/pdf",
          payload.fileName || "career_report.pdf"
        );
        pdfFile = DriveApp.createFile(blob);
        record["PDF檔案ID"] = pdfFile.getId();
        record["PDF檔名"] = pdfFile.getName();
      }

      if (payload.email && payload.pdfBase64) {
        MailApp.sendEmail({
          to: payload.email,
          subject: payload.subject || "職涯冒險島｜完整專業版測驗結果 PDF",
          body: `${payload.name || "學員"} 您好：\n\n附件是您的完整專業版測驗結果 PDF。\n\n祝順利展開職涯探索。`,
          attachments: pdfFile ? [pdfFile.getBlob()] : []
        });
      }
      record["PDF寄送狀態"] = "成功";
      record["PDF寄送時間"] = new Date().toISOString();
      record["PDF錯誤訊息"] = "";
    } catch (err) {
      record["PDF寄送狀態"] = "失敗";
      record["PDF錯誤訊息"] = String(err && err.message ? err.message : err);
    }

    appendRecord_(record);
    return textJson_({ ok: true });
  } catch (err) {
    return textJson_({ ok: false, message: String(err && err.message ? err.message : err) });
  } finally {
    lock.releaseLock();
  }
}

function routeAdminJson_(p) {
  try {
    if (p.action === "adminLogin") return adminLogin_(p.username, p.password);
    if (p.action === "adminRegister") return adminRegister_(p.username, p.password, p.displayName, p.registerCode);
    if (p.action === "adminList") return adminList_(p.token);
    return { ok: false, message: "未知的後台指令" };
  } catch (err) {
    return { ok: false, message: String(err && err.message ? err.message : err) };
  }
}

function adminLogin_(username, password) {
  username = String(username || "");
  password = String(password || "");
  const users = getAdminUsers_();
  const user = users[username];
  if (!user || user.passwordHash !== hashPassword_(password, user.salt)) {
    return { ok: false, message: "帳號或密碼錯誤" };
  }
  const token = Utilities.getUuid();
  CacheService.getScriptCache().put("admin:" + token, username, CONFIG.SESSION_TTL_SECONDS);
  return { ok: true, token, username, displayName: user.displayName || username };
}

function adminRegister_(username, password, displayName, registerCode) {
  username = String(username || "").trim().toLowerCase();
  password = String(password || "");
  displayName = String(displayName || "").trim();
  registerCode = String(registerCode || "").trim();
  if (!username || !password || !displayName) return { ok: false, message: "請完整填寫註冊資料" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username) && !/^[a-zA-Z0-9._-]{4,40}$/.test(username)) {
    return { ok: false, message: "帳號請使用 Email，或 4-40 字元英文數字" };
  }
  if (password.length < 8) return { ok: false, message: "密碼至少需要 8 個字元" };
  if (registerCode !== CONFIG.REGISTRATION_CODE) return { ok: false, message: "註冊碼錯誤" };
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const users = getAdminUsers_();
    if (users[username]) return { ok: false, message: "此帳號已存在，請直接登入" };
    const salt = Utilities.getUuid();
    users[username] = {
      displayName,
      salt,
      passwordHash: hashPassword_(password, salt),
      createdAt: new Date().toISOString()
    };
    setAdminUsers_(users);
    return { ok: true, message: "註冊成功" };
  } finally {
    lock.releaseLock();
  }
}

function requireAdmin_(token) {
  const username = CacheService.getScriptCache().get("admin:" + String(token || ""));
  if (!username) throw new Error("登入已逾時，請重新登入");
  return username;
}

function getAdminUsers_() {
  const raw = PropertiesService.getScriptProperties().getProperty("ADMIN_USERS_JSON") || "{}";
  try { return JSON.parse(raw) || {}; } catch (e) { return {}; }
}

function setAdminUsers_(users) {
  PropertiesService.getScriptProperties().setProperty("ADMIN_USERS_JSON", JSON.stringify(users));
}

function hashPassword_(password, salt) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, `${salt}:${password}`, Utilities.Charset.UTF_8);
  return bytes.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, "0")).join("");
}

function adminList_(token) {
  requireAdmin_(token);
  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return { ok: true, records: [] };
  const headers = values[0].map(String);
  const records = values.slice(1).map((row, i) => {
    const obj = { _row: i + 2 };
    headers.forEach((h, idx) => obj[h] = row[idx]);
    return obj;
  }).reverse();
  return { ok: true, records };
}

function adminDownloadPdf_(p) {
  requireAdmin_(p.token);
  const rowNum = Number(p.row || 0);
  if (!rowNum || rowNum < 2) return HtmlService.createHtmlOutput("PDF 參數錯誤");
  const sheet = getSheet_();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const row = sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getValues()[0];
  const record = {};
  headers.forEach((h, idx) => record[h] = row[idx]);
  const fileId = record["PDF檔案ID"];
  if (!fileId) return HtmlService.createHtmlOutput("這筆資料沒有 PDF 檔案 ID");
  const file = DriveApp.getFileById(fileId);
  const base64 = Utilities.base64Encode(file.getBlob().getBytes());
  const name = String(record["PDF檔名"] || file.getName()).replace(/"/g, "");
  const html = `
    <script>
      const a = document.createElement('a');
      a.href = 'data:application/pdf;base64,${base64}';
      a.download = ${JSON.stringify(name)};
      document.body.appendChild(a);
      a.click();
      document.body.textContent = 'PDF 下載已開始，可以關閉此頁。';
    </script>`;
  return HtmlService.createHtmlOutput(html);
}

function appendRecord_(record) {
  const sheet = getSheet_();
  const headers = ensureHeaders_(sheet, Object.keys(record));
  const row = headers.map(h => record[h] !== undefined ? record[h] : "");
  sheet.appendRow(row);
}

function ensureHeaders_(sheet, newKeys) {
  let headers = [];
  if (sheet.getLastRow() >= 1 && sheet.getLastColumn() >= 1) {
    headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String).filter(Boolean);
  }
  const merged = headers.slice();
  newKeys.forEach(k => { if (merged.indexOf(k) === -1) merged.push(k); });
  if (merged.length !== headers.length) {
    sheet.getRange(1, 1, 1, merged.length).setValues([merged]);
  }
  return merged;
}

function getSheet_() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  return ss.getSheetByName(CONFIG.SHEET_NAME) || ss.insertSheet(CONFIG.SHEET_NAME);
}

function jsonp_(callback, data) {
  const cb = String(callback || "callback").replace(/[^\w.$]/g, "");
  return ContentService
    .createTextOutput(`${cb}(${JSON.stringify(data)});`)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function textJson_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
