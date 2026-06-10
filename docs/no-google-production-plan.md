# 知己知途｜職涯探索冒險遊戲｜不走 Google 正式營運方案

## 1. 正式結論

正式營運版不再使用：

- Google Apps Script
- Google Sheet
- Google Drive
- Gmail / Apps Script 寄信

改為自有網站後端與資料庫。這樣短碼驗證、PDF 儲存、Email 寄送、諮詢師權限、額度扣抵都會穩定很多，也比較適合正式販售與多人同時施測。

## 2. 建議架構

前台與後台：

- Vercel：部署學員前台、諮詢師後台、最高管理者後台、API 後端

資料庫：

- Supabase PostgreSQL：儲存帳號、批次、短碼、學員測驗結果、授權方案、額度紀錄

檔案儲存：

- Supabase Storage：儲存學員 PDF 報告、諮詢師專業報告

Email：

- Resend：寄送 PDF 給學員與諮詢師

登入權限：

- 自建帳密 + JWT Session，先符合目前營運需求
- 之後若要強化，可改接 Supabase Auth

## 3. 權限分流

### 學員前台

學員只能：

- 輸入任務短碼
- 驗證短碼
- 填寫測驗
- 完成後下載自己的 PDF
- 收到 Email PDF

學員不能看到：

- 後台資料
- 諮詢師 Email
- 價值觀題目分類提示
- 其他學員資料

### 諮詢師後台

諮詢師可以：

- 註冊與登入
- 建立自己的施測批次
- 查看自己批次下的學員紀錄
- 下載學員 PDF
- 下載或複製諮詢師專業建議
- 查看自己的剩餘額度
- 啟用、停止、修改自己的批次

諮詢師不能：

- 看其他諮詢師資料
- 管理授權金額
- 修改最高管理者設定
- 任意增加自己的額度

### 最高管理者後台

最高管理者帳號：

- 帳號：ccazhu
- 權限：最高管理者

最高管理者可以：

- 查看所有諮詢師
- 建立、修改、停用諮詢師
- 設定授權方案與金額
- 增加、扣除、調整諮詢師額度
- 查看所有批次
- 查看所有學員報告
- 下載所有 PDF
- 重設諮詢師密碼
- 停用問題帳號

## 4. 短碼驗證流程

學員連結格式：

```text
https://正式網域/?c=98BYM5
```

前台呼叫：

```text
POST /api/public/validate-pass
```

後端檢查：

- 短碼是否存在
- 批次是否啟用
- 是否在開始時間與結束時間內
- 批次完成數是否小於名額
- 諮詢師帳號是否啟用
- 諮詢師剩餘額度是否足夠

通過後回傳：

- batchId
- shortCode
- batchName
- remainingSeats
- validUntil

不回傳：

- 諮詢師 Email
- 後台設定
- 內部 row id

## 5. 完成測驗流程

學員完成後：

1. 前台產生 PDF Blob
2. 前台送出測驗結果與 PDF 到後端
3. 後端重新驗證短碼
4. 後端用資料庫 transaction 寫入結果
5. 後端扣除諮詢師 1 個額度
6. PDF 上傳 Supabase Storage
7. 寄 PDF 給學員
8. 同步寄 PDF 與諮詢師專業建議給諮詢師
9. 回傳成功狀態

## 6. 30 人同時測驗處理

正式版要使用資料庫 transaction，不靠前端判斷。

同一個短碼 30 人同時送出時：

- 後端每一筆送出都進 transaction
- 檢查剩餘名額
- 檢查諮詢師額度
- 寫入 result
- 更新 batch.completed_count
- 寫入 credit ledger

如果第 31 人送出：

- 不寫入結果
- 不扣額度
- 回傳「此批次名額已滿」

## 7. Email 只寄一次

判斷規則：

- 同一個 resultId 只寄一次學員 PDF
- 同一個 resultId 只寄一次諮詢師報告
- Email 寄送結果寫入 `email_logs`

即使前端重複點擊，也不會重複寄同一份正式報告。

## 8. 額度計算

建議正式規則：

- 1 位學員完成 1 次測驗 = 消耗 1 個額度
- 例如單次測驗 100 元
- 諮詢師購買 30 份 = 3000 元，帳號增加 30 個額度
- 學員完成送出並成功建立報告後，才扣 1 個額度

不扣額度的情況：

- 只打開測驗
- 只驗證短碼
- 中途離開
- PDF 產生失敗且結果未正式入庫

要人工調整額度時，由最高管理者在後台新增一筆 credit ledger。

## 9. API 規劃

公開 API：

- `POST /api/public/validate-pass`
- `POST /api/public/submit-result`

登入 API：

- `POST /api/auth/login`
- `POST /api/auth/register-counselor`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

諮詢師 API：

- `GET /api/consultant/me`
- `GET /api/consultant/batches`
- `POST /api/consultant/batches`
- `PATCH /api/consultant/batches/:id`
- `DELETE /api/consultant/batches/:id`
- `GET /api/consultant/results`
- `GET /api/consultant/results/:id/pdf`
- `GET /api/consultant/results/:id/advice`

最高管理者 API：

- `GET /api/owner/dashboard`
- `GET /api/owner/counselors`
- `PATCH /api/owner/counselors/:id`
- `POST /api/owner/counselors/:id/reset-password`
- `GET /api/owner/license-plans`
- `POST /api/owner/license-plans`
- `PATCH /api/owner/license-plans/:id`
- `POST /api/owner/credits`
- `GET /api/owner/batches`
- `GET /api/owner/results`

## 10. 實作順序

第一階段：後端基礎

- 建立 Vercel API 專案
- 建立 Supabase 資料表
- 建立登入與 JWT session
- 建立最高管理者帳號

第二階段：短碼與批次

- 諮詢師建立批次
- 產生 6 碼短碼
- 學員前台驗證短碼
- 批次啟用、停止、修改、刪除

第三階段：測驗結果與 PDF

- 學員送出結果
- PDF 上傳 Storage
- 學員與諮詢師同步寄信
- 後台下載 PDF

第四階段：授權與額度

- 最高管理者建立方案
- 授權諮詢師額度
- 完成測驗自動扣額度
- 額度紀錄可追蹤

第五階段：正式 QA

- 手機、平板、電腦排版
- 30 人同時送出測試
- 短碼過期測試
- 名額滿測試
- Email 重複寄送測試
- 權限越權測試

