/* ================================================================
   Avni Tokur Eğitim – Okul Yönetim Sistemi (Backend)
   Saf Node.js (http + crypto + fs). HARİCİ BAĞIMLILIK YOK.
   Çalıştırma:  node server.js    (varsayılan http://localhost:3000)
   ================================================================ */
'use strict';
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';          // 0.0.0.0 = tüm ağlardan erişilebilir
const SSL_KEY  = process.env.SSL_KEY  || '';          // HTTPS için özel anahtar dosyası (opsiyonel)
const SSL_CERT = process.env.SSL_CERT || '';          // HTTPS için sertifika dosyası (opsiyonel)
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

/* ---------------- Veritabani (JSON dosyasi) ---------------- */
let DB = null;
function saveDB(){
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(DB, null, 1));
  fs.renameSync(tmp, DB_FILE);               // atomik yazma
  try{ fs.chmodSync(DB_FILE, 0o600); }catch(e){}   // sadece sahibi okuyabilsin
}
function loadDB(){
  if (fs.existsSync(DB_FILE)) { DB = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  else { DB = buildSeed(); saveDB(); console.log('Yeni veritabani olusturuldu:', DB_FILE); }
}
function backupDB(){
  try{
    const dir = path.join(DATA_DIR,'backups'); if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true});
    const f = path.join(dir, 'db-'+nowISO().slice(0,10)+'.json');
    if(!fs.existsSync(f) && fs.existsSync(DB_FILE)){ fs.copyFileSync(DB_FILE, f); try{fs.chmodSync(f,0o600);}catch(e){} }
    const keep = fs.readdirSync(dir).filter(x=>x.startsWith('db-')).sort();
    while(keep.length>7){ try{ fs.unlinkSync(path.join(dir,keep.shift())); }catch(e){ break; } }
  }catch(e){ /* yedek hatasi sunucuyu durdurmaz */ }
}

/* ---------------- Parola (scrypt) ve Token (HMAC) ---------------- */
function hashPassword(pw){
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pw), salt, 64).toString('hex');
  return { salt, hash };
}
function verifyPassword(pw, rec){
  if(!rec || !rec.salt) return false;
  const h = crypto.scryptSync(String(pw), rec.salt, 64).toString('hex');
  const a = Buffer.from(h,'hex'), b = Buffer.from(rec.hash,'hex');
  return a.length===b.length && crypto.timingSafeEqual(a,b);
}
/* Sifre guclu mu? (en az 8 karakter, harf + rakam) */
function checkPassword(pw){
  pw = String(pw||'');
  if(pw.length < 8) return 'Sifre en az 8 karakter olmali';
  if(!/[A-Za-z\u00e7\u011f\u0131\u00f6\u015f\u00fc\u00c7\u011e\u0130\u00d6\u015e\u00dc]/.test(pw) || !/[0-9]/.test(pw))
    return 'Sifre en az bir harf ve bir rakam icermeli';
  return null;
}
function b64url(s){ return Buffer.from(s).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function sign(payloadObj){
  const p = b64url(JSON.stringify(payloadObj));
  const sig = crypto.createHmac('sha256', DB.meta.secret).update(p).digest('base64')
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  return p + '.' + sig;
}
function verifyToken(tok){
  if(!tok || tok.indexOf('.')<0) return null;
  const [p, sig] = tok.split('.');
  const exp = crypto.createHmac('sha256', DB.meta.secret).update(p).digest('base64')
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  if(sig !== exp) return null;
  let payload; try{ payload = JSON.parse(Buffer.from(p.replace(/-/g,'+').replace(/_/g,'/'),'base64').toString()); }catch(e){ return null; }
  if(payload.exp && Date.now() > payload.exp) return null;
  return payload;
}

/* ---------------- Yardimcilar ---------------- */
const TRMAP = {'ç':'c','ğ':'g','ı':'i','İ':'i','ö':'o','ş':'s','ü':'u','Ç':'c','Ğ':'g','Ö':'o','Ş':'s','Ü':'u'};
function slug(s){ return String(s).replace(/[çğıİöşüÇĞÖŞÜ]/g,c=>TRMAP[c]||c).toLowerCase().replace(/[^a-z0-9]+/g,''); }
let _idc = 1;
function uid(prefix){ return prefix + '_' + Date.now().toString(36) + '_' + (_idc++).toString(36); }
function nowISO(){ return new Date().toISOString(); }

function ensureUsername(db, base){
  let u = base || 'kullanici', i = 1;
  const taken = new Set(db.users.map(x=>x.username));
  while(taken.has(u)){ u = base + (++i); }
  return u;
}

/* ---------------- Baslangic verisi (seed) ---------------- */
function buildSeed(){
  const src = JSON.parse(fs.readFileSync(path.join(__dirname,'seed_source.json'),'utf8'));
  const db = { meta:{ secret:crypto.randomBytes(32).toString('hex'), created:nowISO(), excludeAdminSubjects:['Matematik'] },
    subjects:[], classes:[], students:[], users:[],
    grades:{homework:[], exam:[]}, assignments:[], attendance:[],
    schedule:{}, payments:[], audit:[] };

  const subjNames=['Matematik','Fizik','İngilizce','Sosyal','Coğrafya','Türkçe','Edebiyat','Fen'];
  const subjId={}; subjNames.forEach(n=>{const id=uid('s');db.subjects.push({id,name:n});subjId[n]=id;});

  const classNames=['3.SINIF','5.SINIF','7.SINIF','8.SINIF','9.SINIF','10.SINIF','11.SINIF','12.SINIF'];
  const classId={}; classNames.forEach(n=>{const id=uid('c');db.classes.push({id,name:n});classId[n]=id;});

  const roster={ '5.SINIF':['ASİL','ARİF'], '7.SINIF':['GÖNÜL','AHMET','FURKAN'],
    '8.SINIF':['YUSUF','ÖMER','NECMETTİN','NEHİR','BUĞLEM','HAMZA'],
    '11.SINIF':['İDİL','ESLEM','İREM','YUSUF'], '3.SINIF':['ALPARSLAN'] };
  const stuId={};
  for(const [cls,names] of Object.entries(roster)){
    names.forEach(nm=>{const id=uid('st');db.students.push({id,name:nm,classId:classId[cls]});stuId[cls+'|'+nm]=id;});
  }

  const sheetMap={ '5.SINIF':['Matematik','5.SINIF'], '7.SINIF':['Matematik','7.SINIF'],
    '8.SINIF':['Matematik','8.SINIF'], '11.SINIF MATEMATİK':['Matematik','11.SINIF'],
    '11.SINIF FİZİK':['Fizik','11.SINIF'] };
  for(const [sheet,g] of Object.entries(src.grades)){
    const mm=sheetMap[sheet]; if(!mm) continue;
    const subj=mm[0], cls=mm[1];
    for(const s of g.students){
      const sid=stuId[cls+'|'+s.name]; if(!sid) continue;
      for(const r of s.records){ if(!r.date) continue;
        db.grades.homework.push({id:uid('h'),subjectId:subjId[subj],classId:classId[cls],studentId:sid,
          date:r.date, dogru:r.dogru==null?'':r.dogru, yanlis:r.yanlis==null?'':r.yanlis, bos:r.bos==null?'':r.bos,
          by:'(içe aktarıldı)', at:nowISO()});
      }
    }
  }

  db.schedule = src.schedule || {};
  db.payments = (src.payments||[]).map(p=>({id:uid('p'), ...p}));

  // admin
  db.users.push(Object.assign({id:uid('u'), role:'admin', name:'Yönetici', username:'yonetici', active:true, mustChangePassword:true, tokenVersion:1}, hashPassword('admin123')));
  // teachers
  const allC = classNames.map(n=>classId[n]);
  const teachers=[
    {name:'Görkem', subs:['Matematik','Fizik'], sheet:'GÖRKEM'},
    {name:'Elif',   subs:['İngilizce'],         sheet:'ELİF'},
    {name:'Ebruşah',subs:['Sosyal','Coğrafya'], sheet:'EBRUŞAH'},
    {name:'Ebru',   subs:['Türkçe','Edebiyat'], sheet:'EBRU'},
    {name:'Zehra',  subs:['Türkçe','Edebiyat'], sheet:'ZEHRA'},
    {name:'Pervin', subs:['Fen'],               sheet:'FEN'},
  ];
  teachers.forEach(t=>{
    const u=ensureUsername(db, slug(t.name));
    db.users.push(Object.assign({id:uid('u'), role:'teacher', name:t.name, username:u,
      teach:t.subs.map(sn=>({subjectId:subjId[sn], classIds:[...allC]})), scheduleSheet:t.sheet,
      active:true, mustChangePassword:true, tokenVersion:1}, hashPassword(u+'123')));
  });
  // parents
  db.students.forEach(st=>{
    const base=slug(st.name)+'veli';
    const u=ensureUsername(db, base);
    db.users.push(Object.assign({id:uid('u'), role:'parent', name:st.name+' Velisi', username:u, studentId:st.id,
      active:true, mustChangePassword:true, tokenVersion:1}, hashPassword(slug(st.name)+'123')));
  });
  return db;
}

/* ---------------- Rol / goruntuleme yardimcilari ---------------- */
function publicUser(u){
  const o = { id:u.id, role:u.role, name:u.name, username:u.username,
    active: u.active!==false, mustChange: !!u.mustChangePassword };
  if(u.studentId) o.studentId = u.studentId;
  if(u.teach) o.teach = u.teach;
  if(u.scheduleSheet) o.scheduleSheet = u.scheduleSheet;
  return o;
}
function byId(arr,id){ return arr.find(x=>x.id===id); }
function subjName(id){ const s=byId(DB.subjects,id); return s?s.name:''; }
function className(id){ const c=byId(DB.classes,id); return c?c.name:''; }
function studentName(id){ const s=byId(DB.students,id); return s?s.name:''; }
function adminSubjects(){ const ex=DB.meta.excludeAdminSubjects||[]; return DB.subjects.filter(s=>!ex.includes(s.name)); }

function teacherCan(u, subjectId, classId){
  if(!u.teach) return false;
  const t = u.teach.find(x=>x.subjectId===subjectId);
  if(!t) return false;
  return !classId || t.classIds.includes(classId);
}

/* Role gore state uretimi */
function buildState(u){
  const st = { user: publicUser(u), subjects:[], classes:DB.classes, students:[],
    grades:{homework:[]}, exams:[], assignments:[], schedule:{}, payments:[], users:[] };

  if(u.role==='admin'){
    st.subjects = adminSubjects();
    st.students = DB.students.map(s=>({...s, className:className(s.classId)}));
    st.grades.homework = DB.grades.homework;
    st.exams = DB.grades.exam;
    st.assignments = DB.assignments;
    st.schedule = DB.schedule;
    st.payments = DB.payments;
    st.users = DB.users.map(publicUser);
    st.allSubjects = DB.subjects; // iç referans (atama kontrolü için)
    st.audit = (DB.audit||[]).slice(-120).reverse(); // son islemler
  } else if(u.role==='teacher'){
    const mySubIds = (u.teach||[]).map(t=>t.subjectId);
    st.subjects = DB.subjects.filter(s=>mySubIds.includes(s.id));
    const myClassIds = new Set();
    (u.teach||[]).forEach(t=>t.classIds.forEach(c=>myClassIds.add(c)));
    st.students = DB.students.filter(s=>myClassIds.has(s.classId)).map(s=>({...s, className:className(s.classId)}));
    st.grades.homework = DB.grades.homework.filter(h=>mySubIds.includes(h.subjectId));
    st.exams = DB.grades.exam.filter(e=>mySubIds.includes(e.subjectId));
    st.assignments = DB.assignments.filter(a=>mySubIds.includes(a.subjectId));
    if(u.scheduleSheet && DB.schedule[u.scheduleSheet]) st.schedule[u.scheduleSheet]=DB.schedule[u.scheduleSheet];
  } else if(u.role==='parent'){
    const child = byId(DB.students, u.studentId);
    st.child = child ? {...child, className:className(child.classId)} : null;
    if(child){
      st.grades.homework = DB.grades.homework.filter(h=>h.studentId===child.id)
        .map(h=>({...h, subjectName:subjName(h.subjectId)}));
      st.exams = DB.grades.exam.filter(e=>e.studentId===child.id)
        .map(e=>({...e, subjectName:subjName(e.subjectId)}));
      st.assignments = DB.assignments.filter(a=>a.classId===child.classId)
        .map(a=>({...a, subjectName:subjName(a.subjectId)}));
      // ders programi: sinif sayfasi + ogrenci ozel sayfalari
      const cn = className(child.classId);
      Object.keys(DB.schedule).forEach(k=>{
        if(k===cn || k.toUpperCase().startsWith(child.name.toUpperCase()+'-') || k.toUpperCase().startsWith(child.name.toUpperCase()+' '))
          st.schedule[k]=DB.schedule[k];
      });
    }
    st.subjects = DB.subjects;
  }
  // isim zenginlestirme (homework/exam/assignment icin)
  st.grades.homework = st.grades.homework.map(h=>({...h, subjectName:h.subjectName||subjName(h.subjectId),
    className:className(h.classId), studentName:studentName(h.studentId)}));
  st.exams = st.exams.map(e=>({...e, subjectName:e.subjectName||subjName(e.subjectId),
    className:className(e.classId), studentName:studentName(e.studentId)}));
  st.assignments = st.assignments.map(a=>({...a, subjectName:a.subjectName||subjName(a.subjectId),
    className:className(a.classId)}));
  return st;
}

function audit(u, action, detail){ DB.audit.push({at:nowISO(), by:u?u.username:'?', action, detail}); if(DB.audit.length>1000) DB.audit.shift(); }

/* Odeme kaydinin odenen/kalan degerlerini tahsilat listesinden yeniden hesapla */
function recalcPayment(p){
  const paid = (p.odemeler||[]).reduce((s,x)=>s+(Number(x.miktar)||0),0);
  p.odenen = paid;
  p.kalan = (Number(p.odenecek)||0) - paid;
  return p;
}

/* ---------------- Mutate (yazma) islemleri ---------------- */
function handleMutate(u, body){
  const a = body.action;
  const need = (cond,msg)=>{ if(!cond){ const e=new Error(msg||'Geçersiz istek'); e.code=400; throw e; } };
  const adminOnly = ()=>{ if(u.role!=='admin'){ const e=new Error('Yetkiniz yok'); e.code=403; throw e; } };
  const canTeach = (sid,cid)=>{ if(u.role==='admin') return; if(!teacherCan(u,sid,cid)){ const e=new Error('Bu ders/sınıf için yetkiniz yok'); e.code=403; throw e; } };

  // Varsayilan/sifirlanan sifreyle giren kullanici once sifresini degistirmeli
  if(u.mustChangePassword && a!=='changeOwnPassword'){ const e=new Error('Devam etmek için önce şifrenizi değiştirmelisiniz'); e.code=403; throw e; }

  switch(a){
    /* ---- ADMIN ---- */
    case 'addClass': { adminOnly(); need(body.name,'Sınıf adı gerekli');
      if(DB.classes.some(c=>c.name===body.name)){ const e=new Error('Bu sınıf zaten var'); e.code=400; throw e; }
      const c={id:uid('c'), name:body.name}; DB.classes.push(c); audit(u,'addClass',c.name); return {ok:true, id:c.id}; }
    case 'addSubject': { adminOnly(); need(body.name,'Ders adı gerekli');
      if(DB.subjects.some(s=>s.name===body.name)){ const e=new Error('Bu ders zaten var'); e.code=400; throw e; }
      const s={id:uid('s'), name:body.name}; DB.subjects.push(s); audit(u,'addSubject',s.name); return {ok:true, id:s.id}; }
    case 'addStudent': { adminOnly(); need(body.name && body.classId,'İsim ve sınıf gerekli');
      need(byId(DB.classes,body.classId),'Sınıf bulunamadı');
      const st={id:uid('st'), name:body.name, classId:body.classId}; DB.students.push(st);
      audit(u,'addStudent',st.name); return {ok:true, id:st.id}; }
    case 'addUser': { adminOnly(); need(body.name && body.username && body.password && body.role,'Eksik alan');
      need(['teacher','parent','admin'].includes(body.role),'Geçersiz rol');
      { const pe=checkPassword(body.password); if(pe){ const e=new Error(pe); e.code=400; throw e; } }
      if(DB.users.some(x=>x.username===body.username)){ const e=new Error('Bu kullanıcı adı alınmış'); e.code=400; throw e; }
      const nu=Object.assign({id:uid('u'), role:body.role, name:body.name, username:body.username,
        active:true, mustChangePassword:true, tokenVersion:1}, hashPassword(body.password));
      if(body.role==='parent'){ need(body.studentId && byId(DB.students,body.studentId),'Veli için öğrenci seçin'); nu.studentId=body.studentId; }
      if(body.role==='teacher'){ nu.teach = Array.isArray(body.teach)?body.teach:[]; nu.scheduleSheet=body.scheduleSheet||''; }
      DB.users.push(nu); audit(u,'addUser',body.role+':'+body.username); return {ok:true, id:nu.id}; }
    case 'setPassword': { adminOnly(); need(body.userId && body.password,'Eksik alan');
      { const pe=checkPassword(body.password); if(pe){ const e=new Error(pe); e.code=400; throw e; } }
      const tu=byId(DB.users,body.userId); need(tu,'Kullanıcı bulunamadı');
      Object.assign(tu, hashPassword(body.password));
      tu.mustChangePassword = true;                 // kullanici ilk giriste kendi belirlesin
      tu.tokenVersion = (tu.tokenVersion||1) + 1;    // eski oturumlari gecersiz kil
      audit(u,'setPassword',tu.username); return {ok:true}; }
    case 'assignTeacher': { adminOnly(); need(body.userId && Array.isArray(body.teach),'Eksik alan');
      const tu=byId(DB.users,body.userId); need(tu && tu.role==='teacher','Öğretmen bulunamadı');
      tu.teach = body.teach.map(t=>({subjectId:t.subjectId, classIds:Array.isArray(t.classIds)?t.classIds:[]}));
      if(typeof body.scheduleSheet==='string') tu.scheduleSheet=body.scheduleSheet;
      audit(u,'assignTeacher',tu.username); return {ok:true}; }
    case 'deleteUser': { adminOnly(); need(body.userId,'Eksik alan');
      const tu=byId(DB.users,body.userId); need(tu,'Kullanıcı bulunamadı');
      need(tu.id!==u.id,'Kendinizi silemezsiniz');
      DB.users = DB.users.filter(x=>x.id!==body.userId); audit(u,'deleteUser',tu.username); return {ok:true}; }
    case 'setActive': { adminOnly(); need(body.userId,'Eksik alan');
      const tu=byId(DB.users,body.userId); need(tu,'Kullanıcı bulunamadı'); need(tu.id!==u.id,'Kendi hesabınızı kapatamazsınız');
      tu.active = !!body.active;
      if(!tu.active) tu.tokenVersion = (tu.tokenVersion||1)+1; // pasifte oturumu kes
      audit(u,'setActive',tu.username+'='+tu.active); return {ok:true}; }

    /* ---- ADMIN: ÖDEMELER ---- */
    case 'addPaymentRecord': { adminOnly(); need(body.isim,'İsim gerekli');
      const due=Number(body.odenecek)||0;
      const p={id:uid('p'), sheet:(body.sheet||body.isim), isim:body.isim, odenecek:due, odenen:0, kalan:due,
        kayit:(body.kayit||nowISO().slice(0,10)), ek:(body.ek||null), odemeler:[]};
      DB.payments.push(p); audit(u,'addPaymentRecord',p.isim); return {ok:true, id:p.id}; }
    case 'setPaymentDue': { adminOnly(); need(body.paymentId,'Eksik alan');
      const p=byId(DB.payments,body.paymentId); need(p,'Ödeme kaydı bulunamadı');
      const due=Number(body.odenecek); need(!isNaN(due)&&due>=0,'Geçerli bir ücret girin');
      p.odenecek=due; recalcPayment(p);
      audit(u,'setPaymentDue',(p.isim||p.sheet)+'='+due); return {ok:true}; }
    case 'addPayment': { adminOnly(); need(body.paymentId,'Eksik alan');
      const p=byId(DB.payments,body.paymentId); need(p,'Ödeme kaydı bulunamadı');
      const amt=Number(body.miktar); need(!isNaN(amt)&&amt>0,'Geçerli bir tutar girin');
      p.odemeler=p.odemeler||[];
      p.odemeler.push({tarih:(body.tarih||nowISO().slice(0,10)), miktar:amt});
      recalcPayment(p); audit(u,'addPayment',(p.isim||p.sheet)+' +'+amt); return {ok:true}; }
    case 'deletePaymentInstallment': { adminOnly(); need(body.paymentId,'Eksik alan');
      const p=byId(DB.payments,body.paymentId); need(p,'Ödeme kaydı bulunamadı');
      const i=Number(body.index); need(p.odemeler&&p.odemeler[i]!==undefined,'Tahsilat bulunamadı');
      p.odemeler.splice(i,1); recalcPayment(p);
      audit(u,'deletePaymentInstallment',p.isim||p.sheet); return {ok:true}; }
    case 'deletePayment': { adminOnly(); need(body.paymentId,'Eksik alan');
      const p=byId(DB.payments,body.paymentId); need(p,'Ödeme kaydı bulunamadı');
      DB.payments=DB.payments.filter(x=>x.id!==body.paymentId);
      audit(u,'deletePayment',p.isim||p.sheet); return {ok:true}; }

    /* ---- ADMIN: DERS PROGRAMI ---- */
    case 'addSchedSheet': { adminOnly(); need(body.sheet,'Program adı gerekli');
      if(DB.schedule[body.sheet]){ const e=new Error('Bu program zaten var'); e.code=400; throw e; }
      DB.schedule[body.sheet]=[]; audit(u,'addSchedSheet',body.sheet); return {ok:true}; }
    case 'deleteSchedSheet': { adminOnly(); need(body.sheet,'Eksik alan');
      need(DB.schedule[body.sheet],'Program bulunamadı'); delete DB.schedule[body.sheet];
      audit(u,'deleteSchedSheet',body.sheet); return {ok:true}; }
    case 'setSchedSlot': { adminOnly(); need(body.sheet && body.gun && body.saat,'Gün ve saat gerekli');
      need(DB.schedule[body.sheet],'Program bulunamadı');
      let day=DB.schedule[body.sheet].find(d=>d.gun===body.gun);
      if(!day){ day={gun:body.gun, dersler:[]}; DB.schedule[body.sheet].push(day); }
      day.dersler=day.dersler||[];
      const ex=day.dersler.find(s=>s.saat===body.saat);
      if(ex){ ex.ders=(body.ders||null); } else { day.dersler.push({saat:body.saat, ders:(body.ders||null)}); }
      audit(u,'setSchedSlot',body.sheet+' '+body.gun+' '+body.saat); return {ok:true}; }
    case 'deleteSchedSlot': { adminOnly(); need(body.sheet && body.gun && body.saat,'Eksik alan');
      const days=DB.schedule[body.sheet]; need(days,'Program bulunamadı');
      const day=days.find(d=>d.gun===body.gun);
      if(day){ day.dersler=(day.dersler||[]).filter(s=>s.saat!==body.saat);
        if(!day.dersler.length) DB.schedule[body.sheet]=days.filter(d=>d.gun!==body.gun); }
      audit(u,'deleteSchedSlot',body.sheet+' '+body.gun+' '+body.saat); return {ok:true}; }

    /* ---- TEACHER ---- */
    case 'addHomework': { need(u.role==='teacher' || u.role==='admin','Yetkiniz yok');
      need(body.subjectId && body.classId && body.studentId && body.date,'Eksik alan');
      if(u.role==='teacher') canTeach(body.subjectId,body.classId);
      const h={id:uid('h'), subjectId:body.subjectId, classId:body.classId, studentId:body.studentId,
        date:body.date, dogru:body.dogru||'', yanlis:body.yanlis||'', bos:body.bos||'', by:u.name, at:nowISO()};
      DB.grades.homework.push(h); audit(u,'addHomework',studentName(body.studentId)); return {ok:true, id:h.id}; }
    case 'addExam': { need(u.role==='teacher' || u.role==='admin','Yetkiniz yok');
      need(body.subjectId && body.classId && body.studentId && body.name,'Eksik alan');
      if(u.role==='teacher') canTeach(body.subjectId,body.classId);
      const e={id:uid('e'), subjectId:body.subjectId, classId:body.classId, studentId:body.studentId,
        name:body.name, score:body.score||'', date:body.date||nowISO().slice(0,10), by:u.name, at:nowISO()};
      DB.grades.exam.push(e); audit(u,'addExam',studentName(body.studentId)); return {ok:true, id:e.id}; }
    case 'addAssignment': { need(u.role==='teacher' || u.role==='admin','Yetkiniz yok');
      need(body.subjectId && body.classId && body.title,'Eksik alan');
      if(u.role==='teacher') canTeach(body.subjectId,body.classId);
      const g={id:uid('g'), subjectId:body.subjectId, classId:body.classId, title:body.title,
        desc:body.desc||'', dueDate:body.dueDate||'', by:u.name, at:nowISO()};
      DB.assignments.push(g); audit(u,'addAssignment',body.title); return {ok:true, id:g.id}; }
    case 'deleteHomework': { need(u.role==='teacher'||u.role==='admin','Yetkiniz yok'); need(body.id,'Eksik');
      DB.grades.homework = DB.grades.homework.filter(h=>h.id!==body.id); audit(u,'deleteHomework',body.id); return {ok:true}; }
    case 'deleteAssignment': { need(u.role==='teacher'||u.role==='admin','Yetkiniz yok'); need(body.id,'Eksik');
      DB.assignments = DB.assignments.filter(x=>x.id!==body.id); audit(u,'deleteAssignment',body.id); return {ok:true}; }
    case 'deleteExam': { need(u.role==='teacher'||u.role==='admin','Yetkiniz yok'); need(body.id,'Eksik');
      DB.grades.exam = DB.grades.exam.filter(x=>x.id!==body.id); audit(u,'deleteExam',body.id); return {ok:true}; }

    /* ---- SELF (herkes kendi sifresi) ---- */
    case 'changeOwnPassword': { need(body.oldPassword && body.newPassword,'Eksik alan');
      need(verifyPassword(body.oldPassword, u),'Mevcut şifre hatalı');
      { const pe=checkPassword(body.newPassword); if(pe){ const e=new Error(pe); e.code=400; throw e; } }
      Object.assign(u, hashPassword(body.newPassword));
      u.mustChangePassword = false;
      audit(u,'changeOwnPassword',u.username); return {ok:true}; }

    default: { const e=new Error('Bilinmeyen islem: '+a); e.code=400; throw e; }
  }
}

/* ---------------- HTTP sunucu ---------------- */
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const SECHDR={
  'X-Content-Type-Options':'nosniff',
  'X-Frame-Options':'DENY',
  'Referrer-Policy':'no-referrer',
  'Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'"
};
function sendJSON(res,code,obj){ const b=Buffer.from(JSON.stringify(obj));
  res.writeHead(code,Object.assign({'Content-Type':'application/json; charset=utf-8','Content-Length':b.length}, SECHDR)); res.end(b); }
function readBody(req){ return new Promise((resolve,reject)=>{ let d=''; let n=0;
  req.on('data',c=>{ n+=c.length; if(n>1e6){ reject(new Error('too big')); req.destroy(); } d+=c; });
  req.on('end',()=>{ try{ resolve(d?JSON.parse(d):{}); }catch(e){ reject(new Error('geçersiz JSON')); } });
  req.on('error',reject); }); }
function authUser(req){ const h=req.headers['authorization']||''; const tok=h.replace(/^Bearer\s+/i,''); const p=verifyToken(tok); if(!p) return null;
  const u=byId(DB.users,p.uid); if(!u) return null;
  if(u.active===false) return null;
  if((u.tokenVersion||1)!==(p.tv||1)) return null;   // sifre degisimi/pasiflik eski tokeni gecersiz kilar
  return u; }
function clientIP(req){ return (req.headers['x-forwarded-for']||'').split(',')[0].trim() || req.socket.remoteAddress || '?'; }

/* Kaba kuvvet (brute-force) korumasi: IP+kullanici basina deneme sayaci */
const ATTEMPTS = new Map();  // key -> {count, until}
const MAX_TRY=5, LOCK_MS=10*60*1000;
function loginLocked(key){ const a=ATTEMPTS.get(key); if(a && a.until && Date.now()<a.until) return Math.ceil((a.until-Date.now())/60000); return 0; }
function loginFail(key){ const a=ATTEMPTS.get(key)||{count:0,until:0}; a.count++; if(a.count>=MAX_TRY){ a.until=Date.now()+LOCK_MS; a.count=0; } ATTEMPTS.set(key,a); }
function loginOK(key){ ATTEMPTS.delete(key); }

function serveStatic(req,res){
  let p = decodeURIComponent(req.url.split('?')[0]);
  if(p==='/') p='/index.html';
  const fp = path.join(PUBLIC_DIR, path.normalize(p).replace(/^(\.\.[\/\\])+/,''));
  if(!fp.startsWith(PUBLIC_DIR)){ res.writeHead(403); return res.end('403'); }
  fs.readFile(fp,(err,data)=>{ if(err){ res.writeHead(404,Object.assign({'Content-Type':'text/plain; charset=utf-8'},SECHDR)); return res.end('404 Bulunamadı'); }
    res.writeHead(200,Object.assign({'Content-Type':MIME[path.extname(fp)]||'application/octet-stream'},SECHDR)); res.end(data); });
}

const requestHandler = async (req,res)=>{
  const url = req.url.split('?')[0];
  try{
    if(url==='/api/login' && req.method==='POST'){
      const b=await readBody(req);
      const uname=(b.username||'').trim();
      const key=clientIP(req)+'|'+uname;
      const lockMin=loginLocked(key);
      if(lockMin) return sendJSON(res,429,{error:'Çok fazla hatalı deneme. '+lockMin+' dakika sonra tekrar deneyin.'});
      const user = DB.users.find(x=>x.username===uname);
      if(!user || !verifyPassword(b.password, user)){ loginFail(key); return sendJSON(res,401,{error:'Kullanıcı adı veya şifre hatalı'}); }
      if(user.active===false) return sendJSON(res,403,{error:'Hesabınız pasif durumda. Yöneticinize başvurun.'});
      loginOK(key);
      const token = sign({uid:user.id, tv:(user.tokenVersion||1), exp:Date.now()+24*3600*1000});
      audit(user,'login',''); saveDB();
      return sendJSON(res,200,{token, user:publicUser(user)});
    }
    if(url==='/api/logout' && req.method==='POST'){
      const u=authUser(req); if(u){ u.tokenVersion=(u.tokenVersion||1)+1; saveDB(); }  // tokeni gecersiz kil
      return sendJSON(res,200,{ok:true});
    }
    if(url==='/api/state' && req.method==='GET'){
      const u=authUser(req); if(!u) return sendJSON(res,401,{error:'Oturum geçersiz'});
      return sendJSON(res,200, buildState(u));
    }
    if(url==='/api/mutate' && req.method==='POST'){
      const u=authUser(req); if(!u) return sendJSON(res,401,{error:'Oturum geçersiz'});
      const b=await readBody(req);
      let out; try{ out=handleMutate(u,b); }catch(e){ return sendJSON(res, e.code||500, {error:e.message}); }
      saveDB();
      return sendJSON(res,200, Object.assign({}, out, {state: buildState(u)}));
    }
    if(url.startsWith('/api/')) return sendJSON(res,404,{error:'Bilinmeyen uç nokta'});
    return serveStatic(req,res);
  }catch(e){ return sendJSON(res,400,{error:e.message||'Hata'}); }
};

loadDB();
backupDB();
let server, scheme='http';
if(SSL_KEY && SSL_CERT && fs.existsSync(SSL_KEY) && fs.existsSync(SSL_CERT)){
  server = https.createServer({ key:fs.readFileSync(SSL_KEY), cert:fs.readFileSync(SSL_CERT) }, requestHandler);
  scheme='https';
} else {
  server = http.createServer(requestHandler);
}
server.listen(PORT, HOST, ()=>{
  console.log('Avni Tokur Eğitim Okul Yönetim Sistemi');
  console.log('Sunucu çalışıyor: '+scheme+'://localhost:'+PORT+'  (HOST='+HOST+', protokol='+scheme.toUpperCase()+')');
  if(HOST==='0.0.0.0') console.log('Aynı ağdan / internetten erişim: '+scheme+'://<SUNUCU-IP-veya-ALAN-ADI>:'+PORT);
  if(scheme==='http') console.log('UYARI: Internete açarken HTTPS kullanın (SSL_KEY/SSL_CERT) — şifreler açık metin gitmesin.');
  console.log('Varsayılan giriş -> kullanıcı: yonetici / şifre: admin123');
});
