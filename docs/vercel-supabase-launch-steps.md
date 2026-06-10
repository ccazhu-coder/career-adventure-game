# 正式上線步驟｜Vercel + Supabase + Resend

## 1. Supabase

1. 建立 Supabase project
2. 到 SQL Editor 執行：

```text
database/no-google-schema.sql
```

3. 建立 Storage bucket：

```text
career-reports
```

建議先設為 private。

## 2. Resend

1. 建立 Resend 帳號
2. 驗證寄件網域或先用 Resend 測試寄件信箱
3. 取得 `RESEND_API_KEY`
4. 設定 `MAIL_FROM`

範例：

```text
MAIL_FROM=知己知途 <report@your-domain.com>
```

## 3. Vercel

1. New Project
2. Import GitHub repo：

```text
ccazhu-coder/career-adventure-game
```

3. Framework Preset 選 Other
4. Build command 可留空
5. Output directory 可留空
6. 設定 Environment Variables：

```text
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=career-reports
JWT_SECRET=
RESEND_API_KEY=
MAIL_FROM=
OWNER_USERNAME=ccazhu
OWNER_INITIAL_PASSWORD=
COUNSELOR_REGISTER_CODE=CAREER-2026
SETUP_KEY=
APP_BASE_URL=https://your-vercel-domain.vercel.app
APP_ALLOWED_ORIGIN=https://your-vercel-domain.vercel.app
```

## 4. 初始化最高管理者

部署完成後呼叫一次：

```text
POST https://your-vercel-domain.vercel.app/api/setup-owner
```

Body：

```json
{
  "setupKey": "你的 SETUP_KEY",
  "email": "pucezhang@gmail.com",
  "displayName": "知己知途最高管理者"
}
```

完成後即可用：

```text
帳號：ccazhu
密碼：OWNER_INITIAL_PASSWORD
```

登入最高管理者後台。

## 5. 正式測試順序

1. 開啟 `/owner_admin.html`
2. 用 `ccazhu` 登入
3. 建立授權方案
4. 諮詢師註冊或由最高管理者管理
5. 給諮詢師額度
6. 到 `/consultant_admin.html` 建立批次短碼
7. 用 `/?c=短碼` 進入學員前台
8. 完成測驗
9. 確認學員收到 PDF
10. 確認諮詢師後台可下載 PDF 與複製專業建議

