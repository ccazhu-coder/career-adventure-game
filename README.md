# 知己知途｜職涯探索冒險遊戲

正式營運版將改為不使用 Google Apps Script、Google Sheet、Google Drive。

## 網頁

- `index.html`：學員前台
- `admin.html`：後台入口
- `consultant_admin.html`：諮詢師後台
- `owner_admin.html`：最高管理者後台

## 後端

Vercel API：

- `api/public/validate-pass.js`：任務短碼驗證
- `api/auth/login.js`：後台登入
- `api/consultant/batches.js`：諮詢師批次管理
- `api/owner/dashboard.js`：最高管理者總覽

## 資料與檔案

- Supabase PostgreSQL：正式資料庫
- Supabase Storage：PDF 報告儲存
- Resend：Email 寄送

## 設定

1. 複製 `.env.example` 為 `.env.local`
2. 填入 Supabase、JWT、Resend、正式網域環境變數
3. 在 Supabase 執行 `database/no-google-schema.sql`
4. 部署到 Vercel

詳細方案請看：

- `docs/no-google-production-plan.md`
- `docs/no-google-implementation-checklist.md`
