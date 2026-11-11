# 智能提醒 Smart Reminder

Node.js + SQLite + Web Push 的提醒網頁。支援安裝為 PWA，並由伺服器在到期時發送推送通知。

## 本機啟動
1. 安裝 Node.js 22 或以上版本。
2. 複製 `.env.example` 為 `.env`，設定 `APP_PASSWORD`、`COOKIE_SECRET` 及 VAPID 金鑰。
3. 執行 `npm install`，再執行 `npm start`。

產生 VAPID 金鑰：
```bash
npx web-push generate-vapid-keys
```

## Render 部署
- 建立 Web Service，連接此 GitHub repository。
- Build Command: `npm install`
- Start Command: `npm start`
- 設定環境變數：`APP_PASSWORD`、`COOKIE_SECRET`、`VAPID_PUBLIC_KEY`、`VAPID_PRIVATE_KEY`、`VAPID_SUBJECT`。
- 掛載 Persistent Disk，並將 `DB_PATH` 設為磁碟內路徑，例如 `/var/data/reminders.db`。
- 必須使用 HTTPS。SQLite 資料需要持久磁碟；免費方案通常不提供持久磁碟。

## 注意
- 每個瀏覽器／裝置都要登入、允許通知並按「開啟推送通知」。
- 裝置離線、系統關閉通知或服務未運作時，通知可能延遲或無法送達。
- 請勿把真實密碼或 VAPID 私鑰提交到 GitHub。
