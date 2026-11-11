import 'dotenv/config';
import express from 'express';
import Database from 'better-sqlite3';
import webpush from 'web-push';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(process.env.DB_PATH || 'data/reminders.db');
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS reminders(id INTEGER PRIMARY KEY, title TEXT NOT NULL, due_at TEXT NOT NULL, sent INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS subscriptions(id INTEGER PRIMARY KEY, endpoint TEXT UNIQUE NOT NULL, data TEXT NOT NULL);
`);
app.use(express.json({limit:'64kb'}));
app.use(express.static(path.join(__dirname,'public')));
const sessions = new Set();
const secret = process.env.COOKIE_SECRET || 'development-only-change-me';
const token = () => crypto.createHmac('sha256',secret).update(process.env.APP_PASSWORD || '').digest('hex');
const auth = (req,res,next) => {
  const c = req.headers.cookie || '';
  if (c.includes('sr_session='+token())) return next();
  res.status(401).json({error:'請先登入'});
};
app.post('/api/login',(req,res)=>{
  if (!process.env.APP_PASSWORD || req.body.password !== process.env.APP_PASSWORD) return res.status(401).json({error:'密碼錯誤'});
  res.setHeader('Set-Cookie',`sr_session=${token()}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`);
  res.json({ok:true});
});
app.get('/api/config',(req,res)=>res.json({vapidPublicKey:process.env.VAPID_PUBLIC_KEY || ''}));
app.get('/api/reminders',auth,(req,res)=>res.json(db.prepare('SELECT * FROM reminders ORDER BY due_at').all()));
app.post('/api/reminders',auth,(req,res)=>{
  const {title,dueAt}=req.body;
  if (!title || !dueAt || !Number.isFinite(Date.parse(dueAt))) return res.status(400).json({error:'請提供提醒內容及有效日期時間'});
  const info=db.prepare('INSERT INTO reminders(title,due_at) VALUES(?,?)').run(String(title).slice(0,200),new Date(dueAt).toISOString());
  res.json({id:info.lastInsertRowid});
});
app.delete('/api/reminders/:id',auth,(req,res)=>{db.prepare('DELETE FROM reminders WHERE id=?').run(req.params.id);res.json({ok:true});});
app.post('/api/subscribe',auth,(req,res)=>{
  const s=req.body;
  if (!s?.endpoint) return res.status(400).json({error:'無效訂閱'});
  db.prepare('INSERT OR REPLACE INTO subscriptions(endpoint,data) VALUES(?,?)').run(s.endpoint,JSON.stringify(s));
  res.json({ok:true});
});
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com',process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);
  setInterval(async()=>{
    const due=db.prepare("SELECT * FROM reminders WHERE sent=0 AND due_at<=?").all(new Date().toISOString());
    const subs=db.prepare('SELECT * FROM subscriptions').all();
    for (const r of due) {
      let delivered=0;
      for (const s of subs) {
        try { await webpush.sendNotification(JSON.parse(s.data),JSON.stringify({title:'智能提醒',body:r.title,url:'/'})); delivered++; }
        catch(e) { if (e.statusCode===404 || e.statusCode===410) db.prepare('DELETE FROM subscriptions WHERE id=?').run(s.id); }
      }
      if (delivered>0) db.prepare('UPDATE reminders SET sent=1 WHERE id=?').run(r.id);
    }
  },10000);
}
const port=process.env.PORT || 3000;
app.listen(port,()=>console.log('Smart Reminder listening on '+port));
