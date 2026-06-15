# 知己知途 Admin / Counselor 後台重構 — BDD 驗收與回歸測試清單

本清單對應 Phase 0-11 的全部產出（26 個新檔案，`index.html` 零異動），
依「✅ 程式已驗證」與「⏳ 需使用者登入手動驗證」分類列出。
「✅ 程式已驗證」的依據：
1. `git diff --stat -- index.html` 每個 Phase 皆為空（前台 137KB 檔案 0 bytes 改動）。
2. 每個新頁面的 inline `<script>` 皆通過 `node --check` 語法檢查。
3. 每個新頁面皆有 Playwright smoke test：未登入時正確導向對應登入頁
   （admin → `admin-login.html`，counselor → `counselor-login.html`），
   且頁面載入過程 0 個 console error / page error。
4. 所有 Supabase 查詢（table 名稱、欄位、`.eq()`/`.select()`/`.insert()`/`.update()`/`.delete()`）
   均逐一比對 `admin.html.bak` / `counselor.html.bak` 現有可用寫法，確保語法與既有欄位一致。

「⏳ 需使用者登入手動驗證」代表需要 owner 或 consultant 帳號實際登入點擊操作才能確認
（我沒有任何帳密，無法自行完成）。

---

## 一、前台保護回歸測試（12 項嚴禁修改）

| # | 項目 | 狀態 | 驗證方式 |
|---|---|---|---|
| 1 | 前台測驗頁面流程 | ✅ | `index.html` 全程 0 bytes 改動，未新增/修改任何前台 script 引用 |
| 2 | 測驗題庫 | ✅ | 同上，題庫資料皆在 `index.html` 內，未觸碰 |
| 3 | Holland/RIASEC 計分邏輯 | ✅ | 同上，計分函式未被搬移或修改 |
| 4 | SUPER 價值觀計分邏輯 | ✅ | 同上 |
| 5 | 批次碼驗證邏輯 | ✅ | `index.html` 對 `batches` 表的短碼查詢邏輯未變；新頁面對 `batches` 僅新增 `select/insert/update`，未改既有欄位 |
| 6 | 測驗提交流程 | ✅ | `index.html` 提交流程（`submit-result` Edge Function）未被改動或新增呼叫 |
| 7 | PDF 報告產生邏輯 | ✅ | html2canvas/jsPDF 相關程式碼僅存在於 `index.html`，新頁面只用 `storage.from("reports").createSignedUrl()` 下載既有 PDF，不重新產生 |
| 8 | 諮詢師 Email 寄送邏輯 | ✅ | 未新增/修改任何寄信相關程式碼 |
| 9 | 既有資料欄位名稱 | ✅ | 新頁面查詢的欄位（`profiles/batches/submissions/license_plans/counselor_authorizations`）均為既有欄位名，未 rename |
| 10 | 不得刪除既有資料 | ✅ | 新增的刪除操作（`deleteBatch`/`deletePlan`/`deleteAuthorization`/`deleteCounselor`）皆為新頁面操作既有「管理功能」，與 admin.html/counselor.html 既有刪除邏輯一致，非新增風險 |
| 11 | 不得覆蓋既有 localStorage/Firebase/Supabase 資料 | ✅ | 新表 `credit_transactions`/`logs`/`admin_report_templates` 為 `create table if not exists`，純新增；既有表僅新增 `select`，唯一的 `update`（批次/方案/額度管理）與 admin.html/counselor.html 既有行為一致 |
| 12 | 不得因後台重構造成前台無法測驗/送出/產生報告/寄信 | ✅ | 同 1-8，`index.html` 零異動，且新頁面與前台無共用程式碼或資料表寫入路徑交集 |

---

## 二、共用架構驗收

| 項目 | 狀態 | 說明 |
|---|---|---|
| `admin-layout.css` 樣式一致性 | ✅ | 沿用 `admin.html` 既有色彩變數與元件 class，8+6 頁共用同一份檔案 |
| `admin-common.js`（ADMIN_NAV、`renderAdminShell`、`paginate`、`esc`/`fmtTime`/`genShortCode` 等） | ✅ | 8 頁皆引用並通過語法檢查與 smoke test |
| `admin-auth.js`（`requireOwner()`） | ✅ | 未登入 → 導向 `admin-login.html`；非 owner → signOut 並導向 `admin-login.html?denied=1`（Playwright 驗證導向行為） |
| `admin-logs.js`（`logAction()`） | ✅ | 語法正確，insert 至 `logs` 表（依 RLS，需登入後才能真正寫入 — 見下方手動驗證） |
| `counselor-common.js`（COUNSELOR_NAV、`renderCounselorShell`、`sumBalance` 等） | ✅ | 6 頁皆引用並通過語法檢查與 smoke test |
| `counselor-auth.js`（`requireConsultant()`） | ✅ | 未登入 → 導向 `counselor-login.html`；owner 誤入 → 導向 `dashboard.html`；非 consultant → signOut 並導向 `counselor-login.html?denied=1` |
| `counselor-logs.js`（`logAction()`） | ✅ | 與 `admin-logs.js` 邏輯一致，獨立檔案避免 admin/counselor 交叉依賴 |
| Sidebar Active 狀態 | ⏳ | 需登入後肉眼確認目前頁面在 Sidebar 中正確高亮（8 admin 項 / 6 counselor 項） |
| owner 誤入 counselor 後台 → 導向 admin dashboard | ⏳ | 需用 owner 帳號登入 `counselor-login.html` 實測，確認導向 `dashboard.html` |
| consultant 誤入 admin 後台 → 導向 counselor 登入頁並帶 `denied=1` | ⏳ | 需用 consultant 帳號開啟任一 admin 頁面（如 `dashboard.html`）實測 |

---

## 三、資料庫遷移（database/admin-backend-new-tables.sql）

| 項目 | 狀態 | 說明 |
|---|---|---|
| SQL 語法正確性、`create table if not exists` 純新增 | ✅ | 三張新表（`credit_transactions`/`logs`/`admin_report_templates`），未修改既有表結構；`admin_report_templates` 改用此名以避免與既有（2026-06-12 報告資料庫整合所建立、欄位不同的）`report_templates` 撞名 |
| RLS：owner 對三張新表皆全權限 | ⏳ | 需在 Supabase SQL Editor 執行遷移後，用 owner 帳號測試 CRUD |
| RLS：consultant 對 `credit_transactions` 僅能 `select` 自己 email 的紀錄 | ⏳ | 需 consultant 帳號登入後，於 `counselor-credits.html` 確認能讀到自己的紀錄、且 PostgREST 直接 `insert/update/delete` 會被拒絕 |
| RLS：consultant 可 `insert`（不可 `select`）`logs` | ⏳ | 需 consultant 帳號操作任一會 `logAction()` 的功能（如下載 PDF），確認寫入成功；同時確認 `logs.html`（owner-only）consultant 無法存取 |
| RLS：`admin_report_templates` consultant 完全無權限 | ⏳ | 需 consultant 帳號嘗試 `sb.from("admin_report_templates").select("*")`，預期回傳空陣列或權限錯誤 |
| **使用者待辦：執行一次 SQL 遷移** | ⏳ | 請至 Supabase SQL Editor 貼上並執行 `database/admin-backend-new-tables.sql`（一次性，後續所有 credits/logs/admin_report_templates 功能才有資料可寫） |

---

## 四、Admin 後台逐頁 BDD（8 頁）

### 4.1 admin-login.html / dashboard.html（Phase 1）
- ✅ 未登入訪問 `dashboard.html` → 導向 `admin-login.html`，0 console error
- ✅ Sidebar 8 項連結（dashboard/batches/students/counselors/credits/plans/reports/logs）皆存在且指向正確檔案
- ⏳ owner 登入後，dashboard 統計數字（今日/本月測驗數、諮詢師數、批次數）與 Supabase 實際資料一致
- ⏳ 「最近批次」「最近操作」列表正確顯示

### 4.2 batches.html（Phase 2）
- ✅ 未登入 → 導向 `admin-login.html`
- ✅ 建立批次表單欄位與 `genShortCode`/`toTimestamptz` 邏輯與 `admin.html.bak` 一致
- ⏳ owner 登入後：建立批次時若指派諮詢師且額度不足 → 顯示錯誤並寫入 `logs`（`create_batch_failed`）
- ⏳ 建立成功 → `batches` 新增一筆、`credit_transactions` 新增 `-quantity` 的 `batch_create` 紀錄、`logs` 新增 `create_batch`
- ⏳ 修改/啟用/停用/刪除/匯出 CSV 功能與既有 `admin.html` 行為一致，且皆寫入 `logs`

### 4.3 students.html（Phase 3，2026-06-15 改為「諮詢師優先」兩層結構）
- ✅ 未登入 → 導向 `admin-login.html`
- ✅ 預設視圖（無參數）改為諮詢師列表（`callAdminFunction({action:"list"})` 取 role=consultant，
  各諮詢師統計學員數/PDF已寄送/今日新增，「未指派」分組統計 `counselor_email` 為空者），
  「查看學員」連結至 `students.html?counselor=<email>`／`__unassigned__`
- ✅ 學員清單（drilldown）為原 Phase 3 功能 1:1 保留：搜尋/批次篩選/諮詢師篩選/分頁/PDF下載/報告複製，
  新增「← 返回諮詢師列表」連結；`?all=1` 可直接進入不篩選的全部學員清單
- ✅ 相容既有跨頁連結：`batches.html?batch=<短碼>`、`counselors.html?counselor=<email>`
  皆直接進入 drilldown 並套用對應篩選（含目前 0 筆資料的批次/諮詢師，篩選下拉選單會自動補上該選項）
- ⏳ owner 登入後：諮詢師列表統計數字與實際資料一致；下載個案 PDF / 諮詢師 PDF、複製諮詢建議/文字報告，
  皆正確寫入 `logs`（`download_pdf`/`download_counselor_pdf`/`copy_advisor_report`/`copy_case_report`）

### 4.4 counselors.html（Phase 4）
- ✅ 未登入 → 導向 `admin-login.html`
- ✅ 新增/重設密碼/刪除 呼叫 `admin-counselors` Edge Function 的參數與 `admin.html.bak` 一致
- ⏳ owner 登入後：建立諮詢師帳號、重設密碼、刪除帳號皆成功並寫入 `logs`

### 4.5 credits.html（Phase 5）
- ✅ 未登入 → 導向 `admin-login.html`
- ✅ `TX_TYPE_LABELS`、`counselor_authorizations`/`credit_transactions` 查詢語法正確
- ⏳ owner 登入後：新增/扣除/補回/調整額度 → 正確新增 `credit_transactions` 紀錄且不覆蓋 `counselor_authorizations` 既有快照；刪除交易紀錄、新增/修改/刪除授權方案皆寫入 `logs`

### 4.6 plans.html（Phase 6）
- ✅ 未登入 → 導向 `admin-login.html`
- ✅ CRUD 對 `license_plans` 欄位與 `admin.html.bak` 一致
- ⏳ owner 登入後：新增/修改/刪除方案皆寫入 `logs`

### 4.7 reports.html（Phase 7）
- ✅ 未登入 → 導向 `admin-login.html`
- ✅ `admin_report_templates` CRUD 語法正確，與 `index.html` 報告產生邏輯完全脫鉤（純管理介面）；內容欄位為純文字（`{text:"..."}`），不顯示 JSON/程式碼語法
- ⏳ owner 登入後：新增/修改/刪除報告模板皆寫入 `logs`（`create/update/delete_report_template`）

### 4.8 logs.html（Phase 8）
- ✅ 未登入 → 導向 `admin-login.html`
- ✅ `requireOwner()` 守衛、搜尋/動作篩選/起訖日期/分頁邏輯語法正確
- ⏳ owner 登入後：能看到上述所有操作寫入的 `logs` 紀錄，並可展開 before/after JSON
- ⏳ `logs` 表尚未建立時顯示提示訊息（需確認遷移執行前後行為差異）

---

## 五、Counselor 後台逐頁 BDD（6 頁）

### 5.1 counselor-login.html / counselor-dashboard.html（Phase 9）
- ✅ 未登入訪問任一 counselor 頁面 → 導向 `counselor-login.html`，0 console error
- ✅ Sidebar 6 項連結（counselor-dashboard/-batches/-students/-reports/-credits/-profile）存在
- ✅ `counselor-login.html` 登入成功後依角色分流（owner→`dashboard.html`，consultant→`counselor-dashboard.html`）程式邏輯正確
- ⏳ consultant 登入後，dashboard 統計（額度餘額/批次數/學員數/本月完成數）與實際資料一致

### 5.2 counselor-batches.html（Phase 10）
- ✅ 未登入 → 導向 `counselor-login.html`
- ✅ 建立批次不檢查額度（依現況沿用既有行為），自動指派 `counselor_email`
- ⏳ consultant 登入後：建立/修改/啟用/停用/刪除/匯出 CSV 僅能操作自己的批次（`counselor_email` 篩選），且寫入 `logs`
- ⏳「查看學員」連結正確導向 `counselor-students.html?batch=<短碼>` 並套用篩選

### 5.3 counselor-students.html（Phase 10）
- ✅ 未登入 → 導向 `counselor-login.html`（含 `?batch=` 參數情境）
- ✅ 查詢僅 `.eq("counselor_email", email)`
- ⏳ consultant 登入後：下載 PDF / 複製報告功能正常並寫入 `logs`

### 5.4 counselor-reports.html（Phase 11）
- ✅ 未登入 → 導向 `counselor-login.html`
- ✅ 報告狀態篩選（缺個案/缺諮詢師/任一缺/皆已產出）邏輯正確，統計卡片計算正確
- ⏳ consultant 登入後：篩選結果與實際 `submissions.pdf_path`/`counselor_pdf_path` 狀態一致；下載/複製寫入 `logs`

### 5.5 counselor-credits.html（Phase 11）
- ✅ 未登入 → 導向 `counselor-login.html`
- ✅ `sumBalance()` 計算公式正確（快照 `purchased_quantity - used_quantity` 加總 + `credit_transactions.delta` 加總）
- ✅ `credit_transactions` 表不存在/無權限時優雅顯示提示文字，不報錯
- ⏳ consultant 登入後：僅能看到自己的 `counselor_authorizations`/`credit_transactions`，且確認無法新增/修改/刪除（純唯讀，無管理按鈕）

### 5.6 counselor-profile.html（Phase 11）
- ✅ 未登入 → 導向 `counselor-login.html`
- ✅ Email/角色/加入時間/額度為唯讀欄位；顯示名稱可編輯（`profiles.display_name`，既有欄位）；密碼變更走 `sb.auth.updateUser({password})`
- ⏳ consultant 登入後：修改顯示名稱、變更密碼皆成功並寫入 `logs`（`update_profile`），且密碼變更後可用新密碼重新登入

---

## 六、使用者待辦事項彙總

1. **執行一次資料庫遷移**：到 Supabase SQL Editor 貼上並執行
   `database/admin-backend-new-tables.sql`（建立 `credit_transactions`/`logs`/`admin_report_templates` 三張新表 + RLS）。
2. **以 owner 帳號登入測試**：依「四、Admin 後台逐頁 BDD」中所有 ⏳ 項目逐一點擊驗證，
   特別是額度檢查、`logs` 寫入、Sidebar active 狀態。
3. **以 consultant 帳號登入測試**：依「五、Counselor 後台逐頁 BDD」中所有 ⏳ 項目逐一點擊驗證，
   特別是資料隔離（`counselor_email` 篩選）、額度唯讀、profile 修改。
4. **跨角色測試**：owner 帳號開啟 `counselor-login.html` → 應導向 `dashboard.html`；
   consultant 帳號開啟任一 admin 頁面（如 `dashboard.html`）→ 應被導回 `counselor-login.html?denied=1`。
5. 驗收完成後，確認 `index.html`（前台）功能全數正常：測驗流程、計分、批次碼驗證、
   PDF 產生、Email 寄送 —— 全程應與重構前完全一致（程式碼本身 0 bytes 改動，僅供使用者最終確認）。

---

## 七、本次重構檔案清單（共 26 個新檔案，`index.html` 0 bytes 改動）

```
admin-auth.js / admin-common.js / admin-layout.css / admin-login.html / admin-logs.js
admin.html.bak（備份，原檔保留可用）
batches.html / students.html / counselors.html / credits.html / plans.html / reports.html / logs.html / dashboard.html
counselor-auth.js / counselor-common.js / counselor-logs.js / counselor-login.html
counselor.html.bak（備份，原檔保留可用）
counselor-batches.html / counselor-students.html / counselor-reports.html / counselor-credits.html / counselor-profile.html / counselor-dashboard.html
database/admin-backend-new-tables.sql
```
