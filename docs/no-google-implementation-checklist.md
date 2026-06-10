# 不走 Google 改版工程清單

## 目前必須替換的依賴

### index.html

目前仍使用：

- `API_ENDPOINT = script.google.com`
- `EMAIL_SEND_ENDPOINT = API_ENDPOINT`
- `apiJsonp()`
- `validateBatchCode`
- `submitResult`
- `fetch(..., mode: 'no-cors')`

正式版要改成：

- `API_BASE_URL`
- `POST /api/public/validate-pass`
- `POST /api/public/submit-result`
- 正常 JSON fetch
- 後端回傳明確成功或失敗狀態

### consultant_admin.html

目前仍使用：

- `ADMIN_API_ENDPOINT = script.google.com`
- `jsonp()`
- `adminLogin`
- `adminRegister`
- `adminBatchList`
- `adminCreateBatch`
- `adminUpdateBatch`
- `adminDeleteBatch`
- `adminList`
- `adminDownloadPdf`

正式版要改成：

- `/api/auth/login`
- `/api/auth/register-counselor`
- `/api/consultant/batches`
- `/api/consultant/results`
- `/api/consultant/results/:id/pdf`
- JWT token 存取
- 只顯示自己的批次與學員

### owner_admin.html

目前仍使用：

- `ADMIN_API_ENDPOINT = script.google.com`
- `adminOwnerConfig`
- `adminSaveLicensePlan`
- `adminSaveCounselorAuthorization`
- `adminResetCounselorPassword`
- 所有 batch / result API

正式版要改成：

- `/api/owner/dashboard`
- `/api/owner/counselors`
- `/api/owner/license-plans`
- `/api/owner/credits`
- `/api/owner/batches`
- `/api/owner/results`
- 最高管理者權限檢查

## 建議新專案結構

```text
/
  index.html
  admin.html
  consultant_admin.html
  owner_admin.html
  api/
    auth/
      login.js
      register-counselor.js
      forgot-password.js
      reset-password.js
    public/
      validate-pass.js
      submit-result.js
    consultant/
      me.js
      batches.js
      results.js
    owner/
      dashboard.js
      counselors.js
      license-plans.js
      credits.js
      batches.js
      results.js
  lib/
    db.js
    auth.js
    mail.js
    storage.js
    pdf.js
    validation.js
  database/
    no-google-schema.sql
  docs/
    no-google-production-plan.md
    no-google-implementation-checklist.md
```

## 環境變數

正式部署需要：

```text
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=career-reports
JWT_SECRET=
RESEND_API_KEY=
MAIL_FROM=
OWNER_USERNAME=ccazhu
OWNER_INITIAL_PASSWORD=
APP_BASE_URL=
```

## 第一版 MVP 功能範圍

第一版先做到可正式測試：

- 最高管理者登入
- 諮詢師登入
- 諮詢師建立批次短碼
- 學員驗證短碼
- 學員完成測驗送出
- 結果寫入資料庫
- PDF 上傳儲存
- 後台可下載 PDF
- 額度扣 1

第二版再做：

- 自動寄信
- 忘記密碼流程
- 授權方案完整金流紀錄
- 匯出報表
- 批次統計圖表

## 正式改版注意事項

- 不再使用 JSONP
- 不再使用 no-cors，因為 no-cors 看不到後端是否成功
- 所有送出都要有明確回傳
- 扣額度必須在資料庫 transaction 內完成
- PDF 與結果資料要同一個 resultId 綁定
- 前台不能暴露 service role key
- Supabase service role key 只能放在 Vercel API 後端
- 最高管理者功能不可出現在諮詢師頁
- 學員頁不能顯示任何後台文字

## 下一步

1. 建立 Vercel API 專案基礎檔
2. 安裝 Supabase、JWT、bcrypt、Resend 依賴
3. 建立 `lib/db.js`、`lib/auth.js`
4. 先完成登入與短碼驗證 API
5. 再把前台 `validateBatchCode` 改接新 API

