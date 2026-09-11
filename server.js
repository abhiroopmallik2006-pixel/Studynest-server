import express from "express";
import Database from "better-sqlite3";
import multer from "multer";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.dirname(fileURLToPath(import.meta.url));
const dataDir=process.env.DATA_DIR||path.join(root,"data");
const uploadDir=path.join(dataDir,"uploads");
fs.mkdirSync(uploadDir,{recursive:true});
const db=new Database(path.join(dataDir,"studynest.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id INTEGER NOT NULL,expires_at INTEGER NOT NULL,FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS tasks(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,title TEXT NOT NULL,subject TEXT NOT NULL,due_date TEXT,priority TEXT NOT NULL DEFAULT 'medium',completed INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS resources(id INTEGER PRIMARY KEY AUTOINCREMENT,uploader_id INTEGER NOT NULL,title TEXT NOT NULL,subject TEXT NOT NULL,category TEXT NOT NULL,original_name TEXT NOT NULL,stored_name TEXT NOT NULL,mime_type TEXT NOT NULL,size INTEGER NOT NULL,created_at TEXT NOT NULL,FOREIGN KEY(uploader_id) REFERENCES users(id));
CREATE INDEX IF NOT EXISTS idx_tasks_user_status_due ON tasks(user_id,completed,due_date);
CREATE INDEX IF NOT EXISTS idx_resources_created ON resources(created_at DESC);
`);

const app=express();
app.disable("x-powered-by");
app.use(express.json({limit:"256kb"}));
app.use(express.urlencoded({extended:false}));
app.use(express.static(path.join(root,"public"),{extensions:["html"]}));
const secret=process.env.SESSION_SECRET||"local-development-secret-change-me";
const inviteCode=process.env.INVITE_CODE||"STUDYNEST-DEMO";
const allowedExt=new Set([".pdf",".doc",".docx",".ppt",".pptx",".xls",".xlsx",".txt",".png",".jpg",".jpeg"]);
const upload=multer({storage:multer.diskStorage({destination:uploadDir,filename:(_r,file,cb)=>cb(null,`${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`)}),limits:{fileSize:25*1024*1024},fileFilter:(_r,file,cb)=>cb(null,allowedExt.has(path.extname(file.originalname).toLowerCase()))});

function cookies(req){return Object.fromEntries((req.headers.cookie||"").split(";").filter(Boolean).map(v=>{const i=v.indexOf("=");return[decodeURIComponent(v.slice(0,i).trim()),decodeURIComponent(v.slice(i+1))]}))}
function tokenHash(token){return crypto.createHmac("sha256",secret).update(token).digest("hex")}
function auth(req,res,next){const token=cookies(req).studynest_session;if(!token)return res.status(401).json({error:"Sign in required"});const row=db.prepare("SELECT users.id,users.name,users.email FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires_at>?").get(tokenHash(token),Date.now());if(!row)return res.status(401).json({error:"Session expired"});req.user=row;next()}
function passwordHash(password,salt=crypto.randomBytes(16).toString("hex")){return `${salt}:${crypto.scryptSync(password,salt,64).toString("hex")}`}
function verifyPassword(password,stored){const[salt,hash]=stored.split(":");const actual=crypto.scryptSync(password,salt,64);const expected=Buffer.from(hash,"hex");return actual.length===expected.length&&crypto.timingSafeEqual(actual,expected)}
function setSession(res,userId){const token=crypto.randomBytes(32).toString("base64url");db.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)").run(tokenHash(token),userId,Date.now()+30*24*60*60*1000);res.cookie("studynest_session",token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",maxAge:30*24*60*60*1000,path:"/"})}

app.get("/health",(_req,res)=>res.json({ok:true}));
app.post("/api/auth/signup",(req,res)=>{const{name,email,password,invite}=req.body;if(String(invite)!==inviteCode)return res.status(403).json({error:"Invalid invite code"});if(!name||!email||String(password).length<8)return res.status(400).json({error:"Name, email and 8+ character password required"});try{const result=db.prepare("INSERT INTO users(name,email,password_hash,created_at) VALUES(?,?,?,?)").run(String(name).trim().slice(0,80),String(email).trim().toLowerCase().slice(0,160),passwordHash(String(password)),new Date().toISOString());setSession(res,result.lastInsertRowid);res.status(201).json({ok:true})}catch(e){if(String(e).includes("UNIQUE"))return res.status(409).json({error:"Email already registered"});throw e}});
app.post("/api/auth/login",(req,res)=>{const user=db.prepare("SELECT * FROM users WHERE email=?").get(String(req.body.email||"").trim().toLowerCase());if(!user||!verifyPassword(String(req.body.password||""),user.password_hash))return res.status(401).json({error:"Invalid email or password"});setSession(res,user.id);res.json({ok:true})});
app.post("/api/auth/logout",auth,(req,res)=>{const token=cookies(req).studynest_session;db.prepare("DELETE FROM sessions WHERE token_hash=?").run(tokenHash(token));res.clearCookie("studynest_session",{path:"/"});res.json({ok:true})});
app.get("/api/me",auth,(req,res)=>res.json(req.user));

app.get("/api/tasks",auth,(req,res)=>res.json(db.prepare("SELECT id,title,subject,due_date AS dueDate,priority,completed,created_at AS createdAt FROM tasks WHERE user_id=? ORDER BY completed,due_date IS NULL,due_date,id DESC").all(req.user.id).map(t=>({...t,completed:Boolean(t.completed)}))));
app.post("/api/tasks",auth,(req,res)=>{const title=String(req.body.title||"").trim().slice(0,160),subject=String(req.body.subject||"").trim().slice(0,100),priority=["low","medium","high"].includes(req.body.priority)?req.body.priority:"medium";if(!title||!subject)return res.status(400).json({error:"Title and subject required"});const r=db.prepare("INSERT INTO tasks(user_id,title,subject,due_date,priority,created_at) VALUES(?,?,?,?,?,?)").run(req.user.id,title,subject,req.body.dueDate||null,priority,new Date().toISOString());res.status(201).json({id:r.lastInsertRowid})});
app.patch("/api/tasks/:id",auth,(req,res)=>{const r=db.prepare("UPDATE tasks SET completed=? WHERE id=? AND user_id=?").run(req.body.completed?1:0,Number(req.params.id),req.user.id);if(!r.changes)return res.status(404).json({error:"Task not found"});res.json({ok:true})});
app.delete("/api/tasks/:id",auth,(req,res)=>{db.prepare("DELETE FROM tasks WHERE id=? AND user_id=?").run(Number(req.params.id),req.user.id);res.json({ok:true})});

app.get("/api/resources",auth,(_req,res)=>res.json(db.prepare("SELECT resources.id,title,subject,category,original_name AS filename,size,resources.created_at AS createdAt,users.name AS uploader FROM resources JOIN users ON users.id=resources.uploader_id ORDER BY resources.id DESC").all()));
app.post("/api/resources",auth,upload.single("file"),(req,res)=>{if(!req.file)return res.status(400).json({error:"Valid file required"});const title=String(req.body.title||"").trim().slice(0,160),subject=String(req.body.subject||"").trim().slice(0,100),category=String(req.body.category||"Notes").slice(0,40);if(!title||!subject){fs.unlinkSync(req.file.path);return res.status(400).json({error:"Title and subject required"})}const r=db.prepare("INSERT INTO resources(uploader_id,title,subject,category,original_name,stored_name,mime_type,size,created_at) VALUES(?,?,?,?,?,?,?,?,?)").run(req.user.id,title,subject,category,req.file.originalname,req.file.filename,req.file.mimetype,req.file.size,new Date().toISOString());res.status(201).json({id:r.lastInsertRowid})});
app.get("/api/resources/:id/download",auth,(req,res)=>{const file=db.prepare("SELECT * FROM resources WHERE id=?").get(Number(req.params.id));if(!file)return res.status(404).send("Not found");const target=path.join(uploadDir,file.stored_name);if(!fs.existsSync(target))return res.status(404).send("File unavailable");res.type(file.mime_type);res.download(target,file.original_name)});

app.use((err,req,res,next)=>{if(err instanceof multer.MulterError)return res.status(400).json({error:err.code==="LIMIT_FILE_SIZE"?"File must be under 25 MB":err.message});console.error(err);res.status(500).json({error:"Something went wrong"})});
const port=Number(process.env.PORT||3000);
app.listen(port,"0.0.0.0",()=>console.log(`StudyNest running on port ${port}`));
