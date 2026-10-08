/* Avni Tokur Eğitim – Frontend */
'use strict';
let TOKEN = localStorage.getItem('atk_token') || '';
let ME = null, STATE = null, PAGE = '';
const $ = s => document.querySelector(s);
const esc = s => String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function api(path, method='GET', body){
  const opt={method, headers:{}};
  if(TOKEN) opt.headers['Authorization']='Bearer '+TOKEN;
  if(body){ opt.headers['Content-Type']='application/json'; opt.body=JSON.stringify(body); }
  const r = await fetch(path, opt);
  const data = await r.json().catch(()=>({}));
  if(r.status===401 && path!=='/api/login'){ // oturum gecersiz -> cikis
    TOKEN=''; localStorage.removeItem('atk_token');
    if(!$('#login').classList.contains('login-wrap')){} location.reload(); throw new Error(data.error||'Oturum geçersiz');
  }
  if(!r.ok) throw new Error(data.error || ('HTTP '+r.status));
  return data;
}
async function mutate(action, extra={}){
  const r = await api('/api/mutate','POST',Object.assign({action},extra));
  if(r.state) STATE=r.state;
  return r;
}
function toast(msg, type='ok'){
  const t=$('#toast'); t.textContent=msg; t.className='toast '+type; t.classList.remove('hidden');
  clearTimeout(t._t); t._t=setTimeout(()=>t.classList.add('hidden'),2600);
}
let MODAL_FORCED=false;
function openModal(title, html, forced){
  MODAL_FORCED=!!forced;
  $('#modalTitle').textContent=title; $('#modalBody').innerHTML=html; $('#modal').classList.remove('hidden');
  $('#modalClose').style.display = forced ? 'none' : '';
}
function closeModal(){ if(MODAL_FORCED) return; $('#modal').classList.add('hidden'); }
$('#modalClose').onclick=closeModal;
$('#modal').onclick=e=>{ if(e.target.id==='modal') closeModal(); };

/* ---- LOGIN ---- */
$('#loginForm').onsubmit=async e=>{
  e.preventDefault(); $('#loginErr').textContent='';
  try{
    const r=await api('/api/login','POST',{username:$('#luser').value.trim(), password:$('#lpass').value});
    TOKEN=r.token; localStorage.setItem('atk_token',TOKEN); ME=r.user;
    await boot();
  }catch(err){ $('#loginErr').textContent=err.message; }
};
$('#logout').onclick=async()=>{ try{ await api('/api/logout','POST'); }catch(e){} TOKEN=''; localStorage.removeItem('atk_token'); location.reload(); };
function ownPwModal(forced){
  openModal(forced?'Şifrenizi Belirleyin':'Şifre Değiştir',
    `${forced?'<p class="muted" style="margin-bottom:12px">Güvenlik için ilk girişte şifrenizi değiştirmelisiniz.</p>':''}
     <div class="field"><label>Mevcut Şifre</label><input id="op" type="password"></div>
     <div class="field"><label>Yeni Şifre</label><input id="np" type="password"></div>
     <div class="field"><label>Yeni Şifre (tekrar)</label><input id="np2" type="password"></div>
     <p class="muted">En az 8 karakter, en az bir harf ve bir rakam içermeli.</p>
     <button class="btn btn-primary btn-block" id="pwSave">Kaydet</button>`, forced);
  $('#pwSave').onclick=async()=>{
    if($('#np').value!==$('#np2').value){ toast('Yeni şifreler aynı değil','err'); return; }
    try{ await mutate('changeOwnPassword',{oldPassword:$('#op').value,newPassword:$('#np').value});
      MODAL_FORCED=false; closeModal(); toast('Şifre güncellendi');
      if(ME) ME.mustChange=false; await refresh();
    }catch(e){ toast(e.message,'err'); }
  };
}
$('#pwBtn').onclick=()=>ownPwModal(false);

/* ---- BOOT ---- */
async function boot(){
  const s=await api('/api/state'); STATE=s; ME=s.user;
  $('#login').classList.add('hidden'); $('#app').classList.remove('hidden');
  const roleTr={admin:'Yönetici',teacher:'Öğretmen',parent:'Veli'}[ME.role]||ME.role;
  $('#whoami').innerHTML=`<b>${esc(ME.name)}</b>${roleTr} · ${esc(ME.username)}`;
  buildNav();
  if(ME.mustChange) ownPwModal(true);   // ilk giriste sifre degistirmeye zorla
}
function buildNav(){
  const menus={
    admin:[['genel','Genel Bakış'],['teachers','Öğretmenler'],['people','Öğrenci / Veli'],['struct','Sınıf & Ders'],['homework','Ödev Takibi'],['assign','Verilen Ödevler'],['exams','Sınav Notları'],['perf','Karne / Başarı'],['trials','Deneme Takibi'],['att','Devamsızlık'],['sched','Ders Programları'],['pay','Ödemeler'],['audit','İşlem Kayıtları']],
    teacher:[['tgenel','Panelim'],['tgive','Ödev Ver'],['thw','Ödev Sonuçları'],['texam','Sınav Notları'],['tperf','Karne / Başarı'],['ttrials','Deneme Takibi'],['tatt','Devamsızlık'],['tsched','Programım']],
    parent:[['pchild','Çocuğum'],['psched','Ders Programı'],['phw','Ödev Sonuçları'],['passign','Verilen Ödevler'],['pexam','Sınav Notları'],['pperf','Karne / Başarı'],['ptrials','Deneme Sonuçları'],['patt','Devamsızlık']]
  };
  const items=menus[ME.role]||[];
  $('#nav').innerHTML=items.map(([k,t])=>`<a data-p="${k}">${t}</a>`).join('');
  $('#nav').querySelectorAll('a').forEach(a=>a.onclick=()=>go(a.dataset.p));
  go(items[0][0]);
}
function go(p){
  if(p!==PAGE && !['trials','ttrials','ptrials'].includes(p)) TRIAL_VIEW={id:'',mode:'main'};
  PAGE=p;
  $('#nav').querySelectorAll('a').forEach(a=>a.classList.toggle('active',a.dataset.p===p));
  const fn=VIEWS[p]; const title=(($('#nav a[data-p="'+p+'"]')||{}).textContent)||'Panel';
  $('#pageTitle').textContent=title;
  $('#content').innerHTML = fn ? fn() : '<div class="empty">Sayfa bulunamadı</div>';
  if(wire[p]) wire[p]();
  enableDatePickers();
}
/* Telefonda tarih kutusuna dokununca takvimin açılmasını garanti et */
function enableDatePickers(){
  document.querySelectorAll('input[type="date"],input[type="month"]').forEach(el=>{
    if(el._dp) return; el._dp=true;
    const open=()=>{ try{ if(el.showPicker) el.showPicker(); }catch(e){} };
    el.addEventListener('click', open);
    el.addEventListener('focus', open);
  });
}
async function refresh(){ const s=await api('/api/state'); STATE=s; go(PAGE); }

/* yardimci */
function opts(arr,sel,valKey='id',txtKey='name',ph){ 
  return (ph?`<option value="">${ph}</option>`:'')+arr.map(o=>`<option value="${o[valKey]}" ${o[valKey]===sel?'selected':''}>${esc(o[txtKey])}</option>`).join('');
}
const VIEWS={}; const wire={};
let TRIAL_VIEW={id:'', mode:'main'}; /* deneme takibi ekran durumu */

/* ---- ortak yardimcilar ---- */
function card(k,v){ return `<div class="card"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`; }
function money(n){ const v=Number(n)||0; return v.toLocaleString('tr-TR')+' ₺'; }
function tbl(cols, rows){
  if(!rows.length) return '<div class="empty">Kayıt yok</div>';
  return `<div class="table-wrap"><table><thead><tr>${cols.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function clsName(id){ const c=(STATE.classes||[]).find(x=>x.id===id); return c?c.name:''; }
/* devamsizlik durumu -> rozet */
const ATT_LABEL={geldi:'Geldi', yok:'Gelmedi', gec:'Geç Geldi', izinli:'İzinli'};
function attBadge(s){
  if(s==='geldi') return '<span class="badge ok">Geldi</span>';
  if(s==='gec') return '<span class="badge warn">Geç Geldi</span>';
  if(s==='izinli') return '<span class="badge acc">İzinli</span>';
  return '<span class="badge err">Gelmedi</span>';
}
/* ---- Toplu giriş (sınıf listesi) yardımcıları ---- */
function rosterStatusTable(students, idp){
  if(!students.length) return '<div class="empty">Bu sınıfta öğrenci yok</div>';
  const rows=students.map((s,i)=>`<tr>
    <td>${i+1}</td><td><b>${esc(s.name)}</b></td>
    <td><select class="${idp}-st" data-id="${s.id}">
      <option value="geldi">Geldi</option><option value="yok">Gelmedi</option>
      <option value="gec">Geç Geldi</option><option value="izinli">İzinli</option></select></td>
    <td><input class="${idp}-nt" data-id="${s.id}" placeholder="not (isteğe bağlı)"></td></tr>`).join('');
  return `<div class="table-wrap roster"><table><thead><tr><th>#</th><th>Öğrenci</th><th>Durum</th><th>Not</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function collectStatus(idp){
  const recs=[];
  document.querySelectorAll('.'+idp+'-st').forEach(sel=>{
    const id=sel.dataset.id;
    const nt=document.querySelector('.'+idp+'-nt[data-id="'+id+'"]');
    recs.push({studentId:id, status:sel.value, note:nt?nt.value.trim():''});
  });
  return recs;
}
function rosterGradeTable(students, idp, cols){
  if(!students.length) return '<div class="empty">Bu sınıfta öğrenci yok</div>';
  const head=cols.map(c=>`<th>${esc(c.label)}</th>`).join('');
  const rows=students.map((s,i)=>`<tr><td>${i+1}</td><td><b>${esc(s.name)}</b></td>
    ${cols.map(c=>`<td><input class="${idp}-${c.key}" data-id="${s.id}" type="${c.type||'text'}" ${c.min!=null?'min="'+c.min+'"':''} style="max-width:120px"></td>`).join('')}</tr>`).join('');
  return `<div class="table-wrap roster"><table><thead><tr><th>#</th><th>Öğrenci</th>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
}
function studentsOfClass(cid){ return (STATE.students||[]).filter(s=>s.classId===cid); }
/* ---- Başarı / ortalama yardımcıları ---- */
function num(v){ if(v==null||v==='') return null; const n=parseFloat(String(v).replace(',','.')); return isNaN(n)?null:n; }
function gradeCls(v){ return v==null?'' : v>=85?'ok' : v>=50?'warn':'err'; }
function perfBySubject(exams, homeworks){
  const map={};
  const get=k=>(map[k]=map[k]||{subject:k, scores:[], examCount:0, d:0,y:0,b:0, hwCount:0});
  (exams||[]).forEach(e=>{ const r=get(e.subjectName||'—'); r.examCount++; const n=num(e.score); if(n!=null) r.scores.push(n); });
  (homeworks||[]).forEach(h=>{ const r=get(h.subjectName||'—'); r.hwCount++; r.d+=num(h.dogru)||0; r.y+=num(h.yanlis)||0; r.b+=num(h.bos)||0; });
  return Object.values(map).map(r=>{
    const examAvg = r.scores.length ? r.scores.reduce((a,b)=>a+b,0)/r.scores.length : null;
    const answered = r.d+r.y;
    const hwRate = answered>0 ? Math.round(r.d/answered*100) : null;
    return Object.assign(r,{examAvg,hwRate});
  }).sort((a,b)=>a.subject.localeCompare(b.subject,'tr'));
}
function perfCards(rows){
  if(!rows.length) return '<div class="empty">Henüz sınav notu veya ödev kaydı yok</div>';
  return `<div class="perf-grid">${rows.map(r=>{
    const avg = r.examAvg!=null ? r.examAvg.toFixed(1) : '—';
    const rate = r.hwRate;
    return `<div class="perf-card">
      <div class="perf-head"><h4>${esc(r.subject)}</h4></div>
      <div class="perf-row">
        <div class="perf-metric"><span class="perf-label">Sınav Ort.</span>
          <span class="perf-big ${gradeCls(r.examAvg)}">${avg}</span>
          <span class="perf-sub">${r.examCount} sınav</span></div>
        <div class="perf-metric"><span class="perf-label">Ödev Başarısı</span>
          <span class="perf-big ${gradeCls(rate)}">${rate!=null?('%'+rate):'—'}</span>
          <span class="perf-sub">${r.hwCount} ödev</span></div>
      </div>
      <div class="progress"><div class="progress-bar ${rate!=null?gradeCls(rate):'ok'}" style="width:${rate!=null?rate:0}%"></div></div>
      <div class="perf-foot">Doğru <b class="ok-t">${r.d}</b> · Yanlış <b class="err-t">${r.y}</b> · Boş <b>${r.b}</b></div>
    </div>`;
  }).join('')}</div>`;
}
function examAvgSummary(exams){
  const map={};
  (exams||[]).forEach(e=>{ const n=num(e.score); if(n==null) return; const k=e.subjectName||'—'; (map[k]=map[k]||[]).push(n); });
  const keys=Object.keys(map); if(!keys.length) return '';
  const all=[].concat(...keys.map(k=>map[k]));
  const overall=all.reduce((a,b)=>a+b,0)/all.length;
  const cards=keys.sort((a,b)=>a.localeCompare(b,'tr')).map(k=>{
    const arr=map[k]; const avg=arr.reduce((x,y)=>x+y,0)/arr.length;
    return card(k+' Ort.', avg.toFixed(1));
  }).join('');
  return `<div class="cards">${card('Genel Ortalama', overall.toFixed(1))}${cards}</div>`;
}
/* e-okul tarzı karne tablosu: öğrenci satırları × ders ortalama sütunları */
function gradeBoard(exams, students){
  exams=exams||[]; students=students||[];
  if(!students.length) return '<div class="empty">Bu sınıfta öğrenci yok</div>';
  const subjSet=[];
  exams.forEach(e=>{ const n=e.subjectName||'—'; if(!subjSet.includes(n)) subjSet.push(n); });
  subjSet.sort((a,b)=>a.localeCompare(b,'tr'));
  if(!subjSet.length) return '<div class="empty">Henüz sınav notu girilmemiş</div>';
  const rows=students.map(s=>{
    const his=exams.filter(e=>e.studentId===s.id);
    const bySub={}; subjSet.forEach(sn=>bySub[sn]=[]); const allScores=[];
    his.forEach(e=>{ const n=num(e.score); if(n==null) return; const sn=e.subjectName||'—';
      if(bySub[sn]) bySub[sn].push(n); allScores.push(n); });
    const subAvgs={}; subjSet.forEach(sn=>{ const arr=bySub[sn]; subAvgs[sn]=arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:null; });
    const overall=allScores.length?allScores.reduce((a,b)=>a+b,0)/allScores.length:null;
    return {student:s, subAvgs, overall};
  });
  const ranked=rows.slice().sort((a,b)=>{ if(a.overall==null&&b.overall==null) return 0; if(a.overall==null) return 1; if(b.overall==null) return -1; return b.overall-a.overall; });
  const rankMap={}; ranked.forEach((r,i)=>{ if(r.overall!=null) rankMap[r.student.id]=i+1; });
  const head=`<th>Sıra</th><th>Öğrenci</th>${subjSet.map(sn=>`<th>${esc(sn)}</th>`).join('')}<th>Genel Ort.</th>`;
  const body=ranked.map(r=>{
    const cells=subjSet.map(sn=>{ const v=r.subAvgs[sn]; return `<td>${v!=null?`<span class="gr ${gradeCls(v)}">${v.toFixed(1)}</span>`:'<span class="muted">—</span>'}</td>`; }).join('');
    const ov=r.overall, rank=rankMap[r.student.id];
    return `<tr><td>${rank?('<b>'+rank+'</b>'):'—'}</td><td style="text-align:left"><b>${esc(r.student.name)}</b></td>${cells}<td>${ov!=null?`<span class="gr ${gradeCls(ov)}">${ov.toFixed(1)}</span>`:'—'}</td></tr>`;
  }).join('');
  return `<div class="table-wrap ekboard"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}
/* basit yatay çubuk grafik (SVG/DOM, harici kütüphane yok) */
function barChart(items, max, mode){
  items=items||[]; if(!items.length) return '<div class="empty">Veri yok</div>';
  max=max||Math.max(1,...items.map(i=>Number(i.val)||0));
  return `<div class="bchart">${items.map(i=>{
    const val=Number(i.val)||0; const pct=max>0?Math.max(2,Math.round(val/max*100)):0;
    const cls = mode==='puan'?(gradeCls(val)||'acc'):'acc';
    return `<div class="bch-row"><div class="bch-label">${esc(i.label)}</div>
      <div class="bch-track"><div class="bch-fill ${cls}" style="width:${pct}%"></div></div>
      <div class="bch-val">${val}</div></div>`;
  }).join('')}</div>`;
}
/* yönetici/öğretmen: sınıf karne tablosu + öğrenci detayı */
function perfSelectorView(classes){
  return `<div class="panel"><div class="panel-head"><h3>Karne / Başarı Tablosu</h3></div>
    <p class="muted" style="margin-bottom:12px">Sınıf seçin; her öğrencinin ders ders sınav ortalaması ve genel ortalaması (e-okul tarzı) listelenir. Bir öğrenci seçerseniz detaylı başarı kartlarını görürsünüz.</p>
    <div class="row">
      <div class="field"><label>Sınıf</label><select id="pfCls">${opts(classes,'','id','name','Sınıf seçin')}</select></div>
      <div class="field"><label>Öğrenci (detay)</label><select id="pfStu"><option value="">Tüm sınıf tablosu</option></select></div>
    </div></div>
    <div id="pfBoard"><div class="empty">Sınıf seçince karne tablosu burada görünür</div></div>
    <div id="pfBody"></div>`;
}
function perfSelectorWire(){
  const cs=$('#pfCls'), ss=$('#pfStu'); if(!cs) return;
  const renderBoard=()=>{ const cid=cs.value;
    if(!cid){ $('#pfBoard').innerHTML='<div class="empty">Sınıf seçince karne tablosu burada görünür</div>'; return; }
    const ex=(STATE.exams||[]).filter(e=>e.classId===cid);
    $('#pfBoard').innerHTML=`<div class="panel"><div class="panel-head"><h3>${esc(clsName(cid))} Karne Tablosu</h3></div>${gradeBoard(ex, studentsOfClass(cid))}</div>`;
  };
  cs.onchange=()=>{ const list=studentsOfClass(cs.value);
    ss.innerHTML='<option value="">Tüm sınıf tablosu</option>'+(list.length?opts(list,'','id','name'):'');
    $('#pfBody').innerHTML=''; renderBoard(); };
  ss.onchange=()=>{ const sid=ss.value;
    if(!sid){ $('#pfBody').innerHTML=''; return; }
    const ex=(STATE.exams||[]).filter(e=>e.studentId===sid);
    const hw=((STATE.grades||{}).homework||[]).filter(h=>h.studentId===sid);
    const name=(studentsOfClass(cs.value).find(s=>s.id===sid)||{}).name||'';
    $('#pfBody').innerHTML = `<div class="panel"><div class="panel-head"><h3>${esc(name)} – Ders Bazında Detay</h3></div></div>`+perfCards(perfBySubject(ex,hw));
  };
}
function myClassIds(){ const set=new Set(); (ME.teach||[]).forEach(t=>t.classIds.forEach(c=>set.add(c))); return [...set]; }
function myClasses(){ const ids=new Set(myClassIds()); return (STATE.classes||[]).filter(c=>ids.has(c.id)); }
function schedHTML(obj){
  const keys=Object.keys(obj||{}); if(!keys.length) return '<div class="empty">Program bulunmuyor</div>';
  return keys.map(k=>{
    const days=obj[k]||[];
    return `<div class="panel"><div class="panel-head"><h3>${esc(k)}</h3></div>
      <div class="sched">${days.map(d=>`<div class="sched-day"><h4>${esc(d.gun)}</h4>
        ${(d.dersler||[]).map(s=>`<div class="sched-slot"><span>${esc(s.saat)}</span><b>${esc(s.ders||'—')}</b></div>`).join('')}
      </div>`).join('')}</div></div>`;
  }).join('');
}

/* ================= ADMIN ================= */
VIEWS.genel=()=>{
  const u=STATE.users||[];
  const t=u.filter(x=>x.role==='teacher').length, p=u.filter(x=>x.role==='parent').length;
  return `<div class="cards">
    ${card('Öğretmen',t)}${card('Öğrenci',(STATE.students||[]).length)}${card('Veli',p)}
    ${card('Sınıf',(STATE.classes||[]).length)}${card('Ders',(STATE.subjects||[]).length)}
    ${card('Ödev Kaydı',(STATE.grades.homework||[]).length)}</div>
    <div class="panel"><div class="panel-head"><h3>Hızlı Bilgi</h3></div>
    <p class="muted">Not: Matematik dersi yönetici panelinde listelenmez. Öğretmen atamaları, veli hesapları ve şifreler buradan yönetilir.</p></div>`;
};

VIEWS.teachers=()=>{
  const ts=(STATE.users||[]).filter(x=>x.role==='teacher');
  const sName=id=>{const s=(STATE.allSubjects||STATE.subjects).find(x=>x.id===id);return s?s.name:'?';};
  const rows=ts.map(t=>{
    const asg=(t.teach||[]).map(a=>`<span class="tag">${esc(sName(a.subjectId))} (${a.classIds.map(clsName).join(', ')||'—'})</span>`).join('')||'<span class="muted">atama yok</span>';
    const nameCell=`${esc(t.name)} ${t.active===false?'<span class="badge err">pasif</span>':''}${t.mustChange?' <span class="badge warn">şifre bekliyor</span>':''}`;
    return [nameCell,esc(t.username),asg,
      `<button class="btn btn-sm" data-edu="${t.id}">Düzenle</button>
       <button class="btn btn-sm" data-assign="${t.id}">Ders/Sınıf Ata</button>
       <button class="btn btn-sm" data-pw="${t.id}">Şifre</button>
       <button class="btn btn-sm" data-act="${t.id}" data-to="${t.active===false?1:0}">${t.active===false?'Aktifleştir':'Dondur'}</button>
       <button class="btn btn-sm btn-danger" data-del="${t.id}">Sil</button>`];
  });
  return `<div class="panel"><div class="panel-head"><h3>Öğretmenler</h3>
    <button class="btn btn-primary btn-sm" id="addTeacher">+ Öğretmen Ekle</button></div>
    ${tbl(['Ad','Kullanıcı','Atanmış Ders / Sınıf','İşlem'],rows)}</div>`;
};
wire.teachers=()=>{
  $('#addTeacher').onclick=()=>{
    openModal('Öğretmen Ekle',
     `<div class="field"><label>Ad Soyad</label><input id="n"></div>
      <div class="field"><label>Kullanıcı Adı</label><input id="us"></div>
      <div class="field"><label>Şifre</label><input id="pw"></div>
      <p class="muted">En az 8 karakter, bir harf + bir rakam. Öğretmen ilk girişte değiştirir.</p>
      <button class="btn btn-primary btn-block" id="sv">Ekle</button>`);
    $('#sv').onclick=async()=>{ try{ await mutate('addUser',{role:'teacher',name:$('#n').value.trim(),username:$('#us').value.trim(),password:$('#pw').value});
      closeModal(); toast('Öğretmen eklendi'); go('teachers'); }catch(e){ toast(e.message,'err'); } };
  };
  $('#content').querySelectorAll('[data-assign]').forEach(b=>b.onclick=()=>assignModal(b.dataset.assign));
  $('#content').querySelectorAll('[data-edu]').forEach(b=>b.onclick=()=>editUserModal(b.dataset.edu));
  $('#content').querySelectorAll('[data-pw]').forEach(b=>b.onclick=()=>pwModal(b.dataset.pw));
  $('#content').querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>toggleActive(b.dataset.act, b.dataset.to==='1'));
  $('#content').querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>delUser(b.dataset.del));
};
async function toggleActive(uid, to){
  try{ await mutate('setActive',{userId:uid,active:to}); toast(to?'Hesap aktifleştirildi':'Hesap donduruldu'); go(PAGE); }catch(e){ toast(e.message,'err'); }
}
function pwModal(uid){
  openModal('Şifre Belirle',`<div class="field"><label>Yeni Şifre</label><input id="pw"></div>
    <p class="muted">En az 8 karakter, en az bir harf ve bir rakam. Kullanıcı ilk girişte bu şifreyi değiştirmek zorunda kalır.</p>
    <button class="btn btn-primary btn-block" id="sv">Kaydet</button>`);
  $('#sv').onclick=async()=>{ try{ await mutate('setPassword',{userId:uid,password:$('#pw').value});
    closeModal(); toast('Şifre güncellendi'); go(PAGE); }catch(e){ toast(e.message,'err'); } };
}
async function delUser(uid){
  if(!confirm('Bu hesabı silmek istediğinize emin misiniz?')) return;
  try{ await mutate('deleteUser',{userId:uid}); toast('Silindi'); go(PAGE); }catch(e){ toast(e.message,'err'); }
}
function assignModal(uid){
  const t=(STATE.users||[]).find(x=>x.id===uid);
  const subs=STATE.subjects||[]; // Matematik haric
  const chosen={}; (t.teach||[]).forEach(a=>chosen[a.subjectId]=new Set(a.classIds));
  const body=`<p class="muted" style="margin-bottom:12px">Dersleri ve her ders için sınıfları seçin.</p>
    <div id="asgList">${subs.map(s=>`
      <div class="panel" style="padding:12px">
        <label style="display:flex;gap:8px;align-items:center;font-weight:600">
          <input type="checkbox" style="width:auto" data-sub="${s.id}" ${chosen[s.id]?'checked':''}> ${esc(s.name)}</label>
        <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px">
        ${(STATE.classes||[]).map(c=>`<label class="tag" style="cursor:pointer"><input type="checkbox" style="width:auto" data-c="${s.id}" value="${c.id}" ${chosen[s.id]&&chosen[s.id].has(c.id)?'checked':''}> ${esc(c.name)}</label>`).join('')}
        </div></div>`).join('')}</div>
    <button class="btn btn-primary btn-block" id="sv">Kaydet</button>`;
  openModal('Ders / Sınıf Ata – '+esc(t.name),body);
  $('#sv').onclick=async()=>{
    const teach=[];
    $('#asgList').querySelectorAll('[data-sub]').forEach(cb=>{
      if(cb.checked){ const sid=cb.dataset.sub;
        const classIds=[...document.querySelectorAll(`[data-c="${sid}"]:checked`)].map(x=>x.value);
        teach.push({subjectId:sid,classIds}); } });
    try{ await mutate('assignTeacher',{userId:uid,teach}); closeModal(); toast('Atama kaydedildi'); go('teachers'); }catch(e){ toast(e.message,'err'); }
  };
}
/* yönetici: kullanıcı (öğretmen/veli) bilgisi düzenle */
function editUserModal(uid){
  const t=(STATE.users||[]).find(x=>x.id===uid); if(!t) return;
  openModal('Bilgileri Düzenle – '+esc(t.name),
   `<div class="field"><label>Ad Soyad</label><input id="n" value="${esc(t.name||'')}"></div>
    <div class="field"><label>Kullanıcı Adı</label><input id="us" value="${esc(t.username||'')}"></div>
    <div class="field"><label>Telefon</label><input id="ph" value="${esc(t.phone||'')}" placeholder="05xx xxx xx xx"></div>
    <div class="field"><label>E-posta</label><input id="em" value="${esc(t.email||'')}" placeholder="ornek@eposta.com"></div>
    <button class="btn btn-primary btn-block" id="sv">Kaydet</button>`);
  $('#sv').onclick=async()=>{ try{ await mutate('updateUser',{userId:uid,name:$('#n').value.trim(),username:$('#us').value.trim(),phone:$('#ph').value.trim(),email:$('#em').value.trim()});
    closeModal(); toast('Bilgiler güncellendi'); go(PAGE); }catch(e){ toast(e.message,'err'); } };
}
/* yönetici: öğrenci bilgisi düzenle */
function editStudentModal(sid){
  const s=(STATE.students||[]).find(x=>x.id===sid); if(!s) return;
  openModal('Öğrenci Düzenle – '+esc(s.name),
   `<div class="field"><label>Ad Soyad</label><input id="n" value="${esc(s.name||'')}"></div>
    <div class="field"><label>Sınıf</label><select id="c">${opts(STATE.classes,s.classId,'id','name')}</select></div>
    <div class="field"><label>Okul No</label><input id="no" value="${esc(s.no||'')}"></div>
    <div class="field"><label>Veli Telefonu</label><input id="vt" value="${esc(s.veliTel||'')}" placeholder="05xx xxx xx xx"></div>
    <button class="btn btn-primary btn-block" id="sv">Kaydet</button>`);
  $('#sv').onclick=async()=>{ try{ await mutate('updateStudent',{studentId:sid,name:$('#n').value.trim(),classId:$('#c').value,no:$('#no').value.trim(),veliTel:$('#vt').value.trim()});
    closeModal(); toast('Öğrenci güncellendi'); go(PAGE); }catch(e){ toast(e.message,'err'); } };
}

/* ---- ADMIN: Ogrenci / Veli ---- */
VIEWS.people=()=>{
  const stRows=(STATE.students||[]).map(s=>{
    const veli=(STATE.users||[]).find(u=>u.role==='parent'&&u.studentId===s.id);
    const veliCell = veli ? esc(veli.username)+(veli.active===false?' <span class="badge err">pasif</span>':'')+(veli.mustChange?' <span class="badge warn">şifre bekliyor</span>':'') : '<span class="muted">yok</span>';
    return [esc(s.name),esc(clsName(s.classId)), veliCell,
      `<button class="btn btn-sm" data-edstu="${s.id}">Düzenle</button> `+
      (veli?`<button class="btn btn-sm" data-edu="${veli.id}">Veli Bilgi</button> <button class="btn btn-sm" data-pw="${veli.id}">Veli Şifre</button> <button class="btn btn-sm" data-act="${veli.id}" data-to="${veli.active===false?1:0}">${veli.active===false?'Aktifleştir':'Dondur'}</button> <button class="btn btn-sm btn-danger" data-del="${veli.id}">Veli Sil</button>`
           :`<button class="btn btn-sm btn-primary" data-np="${s.id}">Veli Hesabı Aç</button>`)];
  });
  return `<div class="panel"><div class="panel-head"><h3>Öğrenciler</h3>
      <button class="btn btn-primary btn-sm" id="addStu">+ Öğrenci Ekle</button></div>
    ${tbl(['Öğrenci','Sınıf','Veli Kullanıcı','İşlem'],stRows)}</div>`;
};
wire.people=()=>{
  $('#addStu').onclick=()=>{
    openModal('Öğrenci Ekle',`<div class="field"><label>Ad Soyad</label><input id="n"></div>
      <div class="field"><label>Sınıf</label><select id="c">${opts(STATE.classes,'','id','name','Sınıf seçin')}</select></div>
      <button class="btn btn-primary btn-block" id="sv">Ekle</button>`);
    $('#sv').onclick=async()=>{ try{ await mutate('addStudent',{name:$('#n').value.trim(),classId:$('#c').value});
      closeModal(); toast('Öğrenci eklendi'); go('people'); }catch(e){ toast(e.message,'err'); } };
  };
  $('#content').querySelectorAll('[data-np]').forEach(b=>b.onclick=()=>{
    const s=(STATE.students||[]).find(x=>x.id===b.dataset.np);
    openModal('Veli Hesabı Aç – '+esc(s.name),
     `<div class="field"><label>Veli Adı</label><input id="n" value="${esc(s.name)} Velisi"></div>
      <div class="field"><label>Kullanıcı Adı</label><input id="us"></div>
      <div class="field"><label>Şifre</label><input id="pw"></div>
      <p class="muted">En az 8 karakter, bir harf + bir rakam. Veli ilk girişte değiştirir.</p>
      <button class="btn btn-primary btn-block" id="sv">Oluştur</button>`);
    $('#sv').onclick=async()=>{ try{ await mutate('addUser',{role:'parent',name:$('#n').value.trim(),username:$('#us').value.trim(),password:$('#pw').value,studentId:s.id});
      closeModal(); toast('Veli hesabı oluşturuldu'); go('people'); }catch(e){ toast(e.message,'err'); } };
  });
  $('#content').querySelectorAll('[data-pw]').forEach(b=>b.onclick=()=>pwModal(b.dataset.pw));
  $('#content').querySelectorAll('[data-edstu]').forEach(b=>b.onclick=()=>editStudentModal(b.dataset.edstu));
  $('#content').querySelectorAll('[data-edu]').forEach(b=>b.onclick=()=>editUserModal(b.dataset.edu));
  $('#content').querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>toggleActive(b.dataset.act, b.dataset.to==='1'));
  $('#content').querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>delUser(b.dataset.del));
};

/* ---- ADMIN: Sinif & Ders ---- */
VIEWS.struct=()=>{
  const cRows=(STATE.classes||[]).map(c=>[esc(c.name),studentsOfClass(c.id).length+' öğrenci']);
  const sRows=(STATE.subjects||[]).map(s=>[esc(s.name)]);
  return `<div class="panel"><div class="panel-head"><h3>Sınıflar</h3>
      <button class="btn btn-primary btn-sm" id="addCls">+ Sınıf</button></div>${tbl(['Sınıf','Öğrenci'],cRows)}</div>
    <div class="panel"><div class="panel-head"><h3>Dersler <span class="muted">(Matematik hariç)</span></h3>
      <button class="btn btn-primary btn-sm" id="addSub">+ Ders</button></div>${tbl(['Ders'],sRows)}</div>`;
};
wire.struct=()=>{
  $('#addCls').onclick=()=>{ openModal('Sınıf Ekle',`<div class="field"><label>Sınıf Adı</label><input id="n" placeholder="örn. 6.SINIF"></div><button class="btn btn-primary btn-block" id="sv">Ekle</button>`);
    $('#sv').onclick=async()=>{ try{ await mutate('addClass',{name:$('#n').value.trim()}); closeModal(); toast('Eklendi'); go('struct'); }catch(e){ toast(e.message,'err'); } }; };
  $('#addSub').onclick=()=>{ openModal('Ders Ekle',`<div class="field"><label>Ders Adı</label><input id="n"></div><button class="btn btn-primary btn-block" id="sv">Ekle</button>`);
    $('#sv').onclick=async()=>{ try{ await mutate('addSubject',{name:$('#n').value.trim()}); closeModal(); toast('Eklendi'); go('struct'); }catch(e){ toast(e.message,'err'); } }; };
};

/* ---- Ödev: düzenli görünüm yardımcıları ---- */
function hwSuccess(list){
  let d=0,y=0,b=0;
  (list||[]).forEach(h=>{ d+=(+h.dogru||0); y+=(+h.yanlis||0); b+=(+h.bos||0); });
  const tot=d+y+b; const rate=tot?Math.round(d/tot*100):0;
  return {d,y,b,tot,rate};
}
function hwBadges(h){
  return `<span class="badge ok">D ${esc(h.dogru)}</span> <span class="badge err">Y ${esc(h.yanlis)}</span> <span class="badge warn">B ${esc(h.bos)}</span>`;
}
/* Ödev kayıtlarını tarihe göre gruplar; genel özet + her tarih için ayrı kart */
function hwGrouped(records, mode){
  const list=(records||[]).slice();
  if(!list.length) return '<div class="empty">Henüz ödev sonucu yok</div>';
  const g=hwSuccess(list);
  const summary=`<div class="cards">
    ${card('Toplam Kayıt', list.length)}
    ${card('Toplam Soru', g.tot)}
    ${card('Genel Başarı', '%'+g.rate)}</div>`;
  const byDate={};
  list.forEach(h=>{ const d=h.date||'—'; (byDate[d]=byDate[d]||[]).push(h); });
  const dates=Object.keys(byDate).sort((a,b)=>b.localeCompare(a));
  const head = mode==='parent' ? ['Ders','Sonuç']
    : mode==='teacher' ? ['Öğrenci','Sınıf','Ders','Sonuç','İşlem']
    : ['Öğrenci','Sınıf','Ders','Sonuç'];
  const groups=dates.map(d=>{
    const grp=byDate[d]; const s=hwSuccess(grp);
    const rows=grp.map(h=>{
      if(mode==='parent') return [esc(h.subjectName), hwBadges(h)];
      if(mode==='teacher') return [esc(h.studentName),esc(h.className),esc(h.subjectName),hwBadges(h),`<button class="btn btn-sm btn-danger" data-dh="${h.id}">Sil</button>`];
      return [esc(h.studentName),esc(h.className),esc(h.subjectName),hwBadges(h)];
    });
    return `<div class="panel"><div class="panel-head"><h3>${esc(d)}</h3>
      <span class="muted">${grp.length} kayıt · %${s.rate} başarı</span></div>
      ${tbl(head, rows)}</div>`;
  }).join('');
  return summary+groups;
}

/* ---- ADMIN: salt-okunur listeler ---- */
VIEWS.homework=()=>{
  return `<div class="panel"><div class="panel-head"><h3>Ödev Takibi</h3>
    <span class="muted">tarihe göre gruplanmış sonuçlar</span></div>
    <p class="muted">Aşağıda tüm sınıflardan girilen ödev sonuçları tarih tarih özetlenmiştir.</p></div>`
    + hwGrouped(STATE.grades.homework, 'admin');
};
VIEWS.assign=()=>{
  const rows=(STATE.assignments||[]).map(a=>[esc(a.dueDate||'—'),esc(a.className),esc(a.subjectName),esc(a.title),esc(a.by||'')]);
  return `<div class="panel"><div class="panel-head"><h3>Verilen Ödevler</h3></div>${tbl(['Teslim','Sınıf','Ders','Ödev','Veren'],rows)}</div>`;
};
VIEWS.exams=()=>{
  const rows=(STATE.exams||[]).map(e=>[esc(e.date),esc(e.studentName),esc(e.className),esc(e.subjectName),esc(e.name),`<b>${esc(e.score)}</b>`]);
  return `${examAvgSummary(STATE.exams)}<div class="panel"><div class="panel-head"><h3>Sınav Notları</h3></div>${tbl(['Tarih','Öğrenci','Sınıf','Ders','Sınav','Not'],rows)}</div>`;
};
VIEWS.perf=()=>perfSelectorView(STATE.classes||[]);
wire.perf=perfSelectorWire;
/* ---- ADMIN: Devamsızlık ---- */
/* Aylık devam özeti: her öğrenci için seçilen ayda durum sayıları */
function attSummaryRows(records, month, kind){
  const recs=(records||[]).filter(a=>a.kind===kind && (a.date||'').slice(0,7)===month);
  const map={};
  recs.forEach(a=>{ const k=(kind==='student'?a.studentId:a.teacherId)||a.id;
    map[k]=map[k]||{name:a.who||'', className:a.className||'', geldi:0,yok:0,gec:0,izinli:0,toplam:0};
    if(map[k][a.status]!=null) map[k][a.status]++; map[k].toplam++; });
  return Object.values(map).sort((a,b)=>(a.name||'').localeCompare(b.name||'','tr'));
}
function attSummaryTable(records, month, kind){
  const rows=attSummaryRows(records, month, kind);
  if(!rows.length) return '<div class="empty">Bu ay için kayıt yok</div>';
  const isStu=kind==='student';
  const head = isStu
    ? ['Öğrenci','Sınıf','Geldi','Geç','İzinli','Gelmedi','Devam (Geldi+Geç)']
    : ['Öğretmen','Geldi','Geç','İzinli','Gelmedi','Devam (Geldi+Geç)'];
  const body=rows.map(r=>{
    const devam=r.geldi+r.gec;
    const base = isStu ? [esc(r.name),esc(r.className)] : [esc(r.name)];
    return base.concat([
      `<span class="badge ok">${r.geldi}</span>`,
      `<span class="badge warn">${r.gec}</span>`,
      `<span class="badge acc">${r.izinli}</span>`,
      `<span class="badge err">${r.yok}</span>`,
      `<b>${devam}</b>`]);
  });
  return tbl(head, body);
}
/* Devamsızlık düzeltme modalı (yönetici + öğretmen) */
function attEditModal(id, backPage){
  const rec=(STATE.attendance||[]).find(a=>a.id===id);
  if(!rec){ toast('Kayıt bulunamadı','err'); return; }
  openModal('Devamsızlığı Düzelt',
    `<p class="muted" style="margin-bottom:12px">${esc(rec.date||'')} · ${esc(rec.who||'')}${rec.className?(' · '+esc(rec.className)):''}</p>
     <div class="field"><label>Durum</label><select id="aeSt">
       <option value="geldi">Geldi</option><option value="yok">Gelmedi</option>
       <option value="gec">Geç Geldi</option><option value="izinli">İzinli</option></select></div>
     <div class="field"><label>Not</label><input id="aeNt" value="${esc(rec.note||'')}" placeholder="not (isteğe bağlı)"></div>
     <button class="btn btn-primary btn-block" id="aeSave">Kaydet</button>`);
  $('#aeSt').value=rec.status;
  $('#aeSave').onclick=async()=>{
    try{ await mutate('updateAttendance',{id, status:$('#aeSt').value, note:$('#aeNt').value.trim()});
      closeModal(); toast('Devamsızlık güncellendi'); go(backPage); }catch(e){ toast(e.message,'err'); }
  };
}
VIEWS.att=()=>{
  const all=STATE.attendance||[];
  const curMonth=new Date().toISOString().slice(0,7);
  // detay listelerinde yalnızca devamsızlık (geldi dışı) göster; “geldi” sayıları aylık özette
  const stu=all.filter(a=>a.kind==='student' && a.status!=='geldi').slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const tea=all.filter(a=>a.kind==='teacher' && a.status!=='geldi').slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const stuRows=stu.map(a=>[esc(a.date),esc(a.who),esc(a.className||''),attBadge(a.status),esc(a.note||''),
    `<button class="btn btn-sm" data-edatt="${a.id}">Düzelt</button> <button class="btn btn-sm btn-danger" data-rmatt="${a.id}">Sil</button>`]);
  const teaRows=tea.map(a=>[esc(a.date),esc(a.who),attBadge(a.status),esc(a.note||''),
    `<button class="btn btn-sm" data-edatt="${a.id}">Düzelt</button> <button class="btn btn-sm btn-danger" data-rmatt="${a.id}">Sil</button>`]);
  const teaList=(STATE.teachers||[]).map((t,i)=>`<tr><td>${i+1}</td><td><b>${esc(t.name)}</b></td>
    <td><select class="ta-st" data-id="${t.id}"><option value="geldi">Geldi</option><option value="yok">Gelmedi</option>
      <option value="gec">Geç Geldi</option><option value="izinli">İzinli</option></select></td>
    <td><input class="ta-nt" data-id="${t.id}" placeholder="not (isteğe bağlı)"></td></tr>`).join('');
  return `<div class="cards">
      ${card('Öğrenci Devamsızlık Kaydı', stu.length)}
      ${card('Öğretmen Devamsızlık Kaydı', tea.length)}</div>
    <div class="tabs"><button class="tab active" data-tab="stu">Öğrenci Yoklaması</button>
      <button class="tab" data-tab="sum">Aylık Özet</button>
      <button class="tab" data-tab="tea">Öğretmen Yoklaması</button></div>
    <div data-pane="stu">
      <div class="panel"><div class="panel-head"><h3>Sınıf Yoklaması Al</h3></div>
        <div class="row">
          <div class="field"><label>Sınıf</label><select id="asCls">${opts(STATE.classes,'','id','name','Sınıf seçin')}</select></div>
          <div class="field"><label>Tarih</label><input id="asDate" type="date"></div></div>
        <div id="asRoster" style="margin-top:14px"><div class="empty">Sınıf seçince öğrenci listesi burada çıkar</div></div>
        <button class="btn btn-primary" id="asSave" style="margin-top:14px;display:none">Yoklamayı Kaydet</button>
        <p class="muted" style="margin-top:8px">Her öğrencinin durumu (Geldi / Gelmedi / Geç / İzinli) kaydedilir. “Geldi” sayılarını “Aylık Özet” sekmesinden görebilirsiniz.</p></div>
      <div class="panel"><div class="panel-head"><h3>Öğrenci Devamsızlık Kayıtları</h3><span class="muted">yalnızca gelmeyen/geç/izinli</span></div>
        ${tbl(['Tarih','Öğrenci','Sınıf','Durum','Not','İşlem'],stuRows)}</div></div>
    <div data-pane="sum" class="hidden">
      <div class="panel"><div class="panel-head"><h3>Aylık Devam Özeti</h3>
        <div class="field" style="margin:0"><input id="sumMonth" type="month" value="${curMonth}"></div></div>
        <p class="muted" style="margin-bottom:12px">Seçilen ayda her öğrencinin kaç gün geldiği, kaç gün gelmediği, geç kaldığı veya izinli olduğu aşağıda listelenir.</p>
        <div id="sumBody"></div></div></div>
    <div data-pane="tea" class="hidden">
      <div class="panel"><div class="panel-head"><h3>Öğretmen Yoklaması Al</h3></div>
        <div class="row"><div class="field"><label>Tarih</label><input id="atDate" type="date"></div></div>
        <div class="table-wrap roster" style="margin-top:14px"><table><thead><tr><th>#</th><th>Öğretmen</th><th>Durum</th><th>Not</th></tr></thead>
          <tbody>${teaList||'<tr><td colspan="4" class="muted">Öğretmen yok</td></tr>'}</tbody></table></div>
        <button class="btn btn-primary" id="atSave" style="margin-top:14px">Kaydet</button></div>
      <div class="panel"><div class="panel-head"><h3>Öğretmen Devamsızlık Kayıtları</h3></div>
        ${tbl(['Tarih','Öğretmen','Durum','Not','İşlem'],teaRows)}</div></div>`;
};
wire.att=()=>{
  $('#content').querySelectorAll('.tab').forEach(t=>t.onclick=()=>{
    $('#content').querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===t));
    $('#content').querySelectorAll('[data-pane]').forEach(p=>p.classList.toggle('hidden',p.dataset.pane!==t.dataset.tab));
  });
  const cs=$('#asCls'); if(cs) cs.onchange=()=>{
    const list=studentsOfClass(cs.value);
    $('#asRoster').innerHTML = cs.value ? rosterStatusTable(list,'as') : '<div class="empty">Sınıf seçince öğrenci listesi burada çıkar</div>';
    $('#asSave').style.display = (cs.value && list.length) ? '' : 'none';
  };
  const sv=$('#asSave'); if(sv) sv.onclick=async()=>{
    if(!$('#asDate').value){ toast('Tarih seçin','err'); return; }
    const records=collectStatus('as');
    if(!records.length){ toast('Öğrenci listesi boş','err'); return; }
    try{ const r=await mutate('addAttendanceBulk',{date:$('#asDate').value, records});
      toast((r.added||0)+' yoklama kaydı eklendi'); go('att'); }catch(e){ toast(e.message,'err'); } };
  const tsv=$('#atSave'); if(tsv) tsv.onclick=async()=>{
    if(!$('#atDate').value){ toast('Tarih seçin','err'); return; }
    const records=[];
    $('#content').querySelectorAll('.ta-st').forEach(sel=>{ const id=sel.dataset.id;
      const nt=$('#content').querySelector('.ta-nt[data-id="'+id+'"]'); records.push({teacherId:id,status:sel.value,note:nt?nt.value.trim():''}); });
    if(!records.length){ toast('Öğretmen listesi boş','err'); return; }
    try{ const r=await mutate('addTeacherAttendanceBulk',{date:$('#atDate').value, records});
      toast((r.added||0)+' yoklama kaydı eklendi'); go('att');
      $('#content').querySelector('.tab[data-tab="tea"]').click(); }catch(e){ toast(e.message,'err'); } };
  // aylık özet
  const sm=$('#sumMonth'); if(sm){ const draw=()=>{ $('#sumBody').innerHTML=attSummaryTable(STATE.attendance, sm.value, 'student'); }; sm.onchange=draw; draw(); }
  $('#content').querySelectorAll('[data-edatt]').forEach(b=>b.onclick=()=>attEditModal(b.dataset.edatt,'att'));
  $('#content').querySelectorAll('[data-rmatt]').forEach(b=>b.onclick=async()=>{
    if(!confirm('Bu devamsızlık kaydını silmek istiyor musunuz?')) return;
    try{ await mutate('deleteAttendance',{id:b.dataset.rmatt}); toast('Silindi'); go('att'); }catch(e){ toast(e.message,'err'); } });
};

VIEWS.sched=()=>{
  const sch=STATE.schedule||{}; const keys=Object.keys(sch);
  const totalSlots=keys.reduce((s,k)=>s+(sch[k]||[]).reduce((a,d)=>a+(d.dersler||[]).length,0),0);
  const blocks = keys.length ? keys.map(k=>{
    const days=(sch[k]||[]);
    const cnt=days.reduce((a,d)=>a+(d.dersler||[]).length,0);
    const dayHtml = days.map(d=>`<div class="sched-day"><h4>${esc(d.gun)}</h4>
      ${(d.dersler||[]).map(s=>`<div class="sched-slot"><span class="slot-time">${esc(s.saat)}</span><b class="slot-ders">${esc(s.ders||'—')}</b>
        <button class="slot-x" title="Sil" data-rmslot="${esc(k)}|${esc(d.gun)}|${esc(s.saat)}">&times;</button></div>`).join('')
        || '<div class="muted" style="font-size:.82rem">Ders yok</div>'}
    </div>`).join('');
    return `<div class="panel sched-sheet"><div class="panel-head"><h3>${esc(k)} <span class="badge acc">${cnt} ders</span></h3>
      <div class="head-actions"><button class="btn btn-primary btn-sm" data-addslot="${esc(k)}">+ Ders Ekle</button>
      <button class="btn btn-sm btn-danger" data-rmsheet="${esc(k)}">Programı Sil</button></div></div>
      <div class="sched sched-cols">${dayHtml || '<div class="empty">Henüz ders eklenmedi — “+ Ders Ekle” ile başlayın</div>'}</div></div>`;
  }).join('') : '<div class="empty">Henüz program yok. “+ Yeni Program” ile oluşturun.</div>';
  return `<div class="cards">
      ${card('Program Sayısı', keys.length)}
      ${card('Toplam Ders', totalSlots)}</div>
    <div class="panel hero-panel"><div class="panel-head"><div><h3>Ders Programları</h3>
      <p class="muted" style="margin-top:4px">Her program bir sınıfa ya da öğrenciye ait ders takvimidir.</p></div>
      <button class="btn btn-primary btn-sm" id="schedAdd">+ Yeni Program</button></div></div>
    ${blocks}`;
};
wire.sched=()=>{
  const a=$('#schedAdd'); if(a) a.onclick=()=>{
    openModal('Yeni Program',
     `<div class="field"><label>Program Adı</label><input id="shn" placeholder="örn. 6.SINIF veya AHMET-7"></div>
      <button class="btn btn-primary btn-block" id="sv">Oluştur</button>`);
    $('#sv').onclick=async()=>{ const n=$('#shn').value.trim(); if(!n){ toast('Ad gerekli','err'); return; }
      try{ await mutate('addSchedSheet',{sheet:n}); closeModal(); toast('Program oluşturuldu'); go('sched'); }catch(e){ toast(e.message,'err'); } };
  };
  $('#content').querySelectorAll('[data-addslot]').forEach(b=>b.onclick=()=>schedSlotModal(b.dataset.addslot));
  $('#content').querySelectorAll('[data-rmslot]').forEach(b=>b.onclick=async()=>{
    const [sheet,gun,saat]=b.dataset.rmslot.split('|');
    try{ await mutate('deleteSchedSlot',{sheet,gun,saat}); toast('Silindi'); go('sched'); }catch(e){ toast(e.message,'err'); }
  });
  $('#content').querySelectorAll('[data-rmsheet]').forEach(b=>b.onclick=async()=>{
    if(!confirm('"'+b.dataset.rmsheet+'" programını silmek istiyor musunuz?')) return;
    try{ await mutate('deleteSchedSheet',{sheet:b.dataset.rmsheet}); toast('Program silindi'); go('sched'); }catch(e){ toast(e.message,'err'); }
  });
};
function schedSlotModal(sheet){
  const gunler=['PAZARTESİ','SALI','ÇARŞAMBA','PERŞEMBE','CUMA','CUMARTESİ','PAZAR'];
  openModal('Ders Ekle – '+esc(sheet),
   `<div class="field"><label>Gün</label><select id="sgun">${gunler.map(g=>`<option>${g}</option>`).join('')}</select></div>
    <div class="field"><label>Saat</label><input id="ssaat" placeholder="örn. 17.00-17.40"></div>
    <div class="field"><label>Ders</label><input id="sders" placeholder="örn. MATEMATİK"></div>
    <button class="btn btn-primary btn-block" id="sv">Kaydet</button>`);
  $('#sv').onclick=async()=>{
    const saat=$('#ssaat').value.trim(); if(!saat){ toast('Saat gerekli','err'); return; }
    try{ await mutate('setSchedSlot',{sheet, gun:$('#sgun').value, saat, ders:$('#sders').value.trim()});
      closeModal(); toast('Ders eklendi'); go('sched'); }catch(e){ toast(e.message,'err'); }
  };
}
VIEWS.audit=()=>{
  const trAct={login:'Giriş',logout:'Çıkış',addUser:'Hesap ekleme',deleteUser:'Hesap silme',setPassword:'Şifre belirleme',
    changeOwnPassword:'Şifre değiştirme',assignTeacher:'Ders atama',setActive:'Hesap durumu',addClass:'Sınıf ekleme',
    addSubject:'Ders ekleme',addStudent:'Öğrenci ekleme',addHomework:'Ödev sonucu',addExam:'Sınav notu',
    addAssignment:'Ödev verme',deleteHomework:'Ödev silme',deleteExam:'Sınav silme',deleteAssignment:'Ödev silme',
    addPaymentRecord:'Ödeme kaydı ekleme',addPayment:'Tahsilat ekleme',setPaymentDue:'Ücret düzenleme',
    deletePayment:'Ödeme kaydı silme',deletePaymentInstallment:'Tahsilat silme',
    addSchedSheet:'Program ekleme',deleteSchedSheet:'Program silme',setSchedSlot:'Ders ekleme/düzenleme',deleteSchedSlot:'Ders silme',
    addAttendance:'Öğrenci devamsızlığı',addTeacherAttendance:'Öğretmen devamsızlığı',deleteAttendance:'Devamsızlık silme',updateAttendance:'Devamsızlık düzeltme',
    addAttendanceBulk:'Toplu öğrenci yoklaması',addTeacherAttendanceBulk:'Toplu öğretmen yoklaması',
    addHomeworkBulk:'Toplu ödev sonucu',addExamBulk:'Toplu sınav notu'};
  const rows=(STATE.audit||[]).map(a=>[
    esc((a.at||'').replace('T',' ').slice(0,19)), esc(a.by),
    esc(trAct[a.action]||a.action), esc(a.detail||'')]);
  return `<div class="panel"><div class="panel-head"><h3>İşlem Kayıtları <span class="muted">(son 120)</span></h3></div>
    ${tbl(['Zaman','Kullanıcı','İşlem','Ayrıntı'],rows)}</div>`;
};
VIEWS.pay=()=>{
  const ps=STATE.payments||[];
  const totDue=ps.reduce((s,p)=>s+(Number(p.odenecek)||0),0);
  const totPaid=ps.reduce((s,p)=>s+(Number(p.odenen)||0),0);
  const totRem=ps.reduce((s,p)=>s+(Number(p.kalan)||0),0);
  const done=ps.filter(p=>(Number(p.kalan)||0)<=0 && (Number(p.odenecek)||0)>0).length;
  const pct = totDue>0 ? Math.round(totPaid/totDue*100) : 0;
  const cardsHtml = ps.length ? ps.map(p=>{
    const due=Number(p.odenecek)||0, paid=Number(p.odenen)||0, kalan=Number(p.kalan)||0;
    const r = due>0 ? Math.min(100, Math.round(paid/due*100)) : (paid>0?100:0);
    const cls = kalan<=0 ? 'ok' : (paid>0 ? 'warn' : 'err');
    const durum = kalan<=0 ? '<span class="badge ok">Tamamlandı</span>'
                : paid>0 ? '<span class="badge warn">Kısmi</span>'
                : '<span class="badge err">Ödenmedi</span>';
    return `<div class="pay-card">
      <div class="pay-top">
        <div><div class="pay-name">${esc(p.isim||p.sheet||'-')}</div>
          ${p.sheet?`<div class="muted" style="font-size:.78rem">${esc(p.sheet)}</div>`:''}</div>
        ${durum}
      </div>
      <div class="progress"><div class="progress-bar ${cls}" style="width:${r}%"></div></div>
      <div class="pay-nums">
        <div><span class="muted">Ödenen</span><b>${money(paid)}</b></div>
        <div><span class="muted">Kalan</span><b class="${kalan>0?'rem':''}">${money(kalan)}</b></div>
        <div><span class="muted">Toplam</span><b>${money(due)}</b></div>
      </div>
      <div class="pay-actions">
        <button class="btn btn-primary btn-sm" data-paydet="${p.id}">Detay / Tahsilat</button>
        ${kalan>0?`<button class="btn btn-sm" data-payrem="${p.id}">Hatırlatma</button>`:''}
        <button class="btn btn-sm btn-danger" data-paydel="${p.id}">Sil</button>
      </div></div>`;
  }).join('') : '<div class="empty">Henüz ödeme kaydı yok. “+ Yeni Kayıt” ile ekleyin.</div>';
  return `<div class="cards">
    ${card('Öğrenci Sayısı', ps.length)}
    ${card('Toplam Ücret', money(totDue))}
    ${card('Tahsil Edilen', money(totPaid))}
    ${card('Kalan Alacak', money(totRem))}</div>
    <div class="panel hero-panel"><div class="panel-head" style="margin-bottom:10px"><div>
        <h3>Genel Tahsilat Durumu</h3>
        <p class="muted" style="margin-top:4px">${done}/${ps.length} öğrenci ödemesini tamamladı · %${pct} tahsil edildi</p></div>
      <button class="btn btn-primary btn-sm" id="payAdd">+ Yeni Kayıt</button></div>
      <div class="progress lg"><div class="progress-bar ok" style="width:${pct}%"></div></div></div>
    <div class="pay-grid">${cardsHtml}</div>`;
};
wire.pay=()=>{
  const b=$('#payAdd'); if(b) b.onclick=payAddModal;
  $('#content').querySelectorAll('[data-paydet]').forEach(x=>x.onclick=()=>payDetailModal(x.dataset.paydet));
  $('#content').querySelectorAll('[data-payrem]').forEach(x=>x.onclick=()=>payReminderModal(x.dataset.payrem));
  $('#content').querySelectorAll('[data-paydel]').forEach(x=>x.onclick=()=>payDelete(x.dataset.paydel));
};
/* Hatirlatma metni olustur (panoya kopyalanabilir, gonderimi kullanici yapar) */
function copyText(txt){
  if(navigator.clipboard && navigator.clipboard.writeText){
    return navigator.clipboard.writeText(txt).then(()=>true).catch(()=>false);
  }
  try{ const ta=document.createElement('textarea'); ta.value=txt; ta.style.position='fixed'; ta.style.opacity='0';
    document.body.appendChild(ta); ta.select(); const ok=document.execCommand('copy'); document.body.removeChild(ta); return Promise.resolve(ok);
  }catch(e){ return Promise.resolve(false); }
}
function reminderText(p, tone){
  const ad=p.isim||p.sheet||'Öğrenci';
  const kalan=money(p.kalan);
  if(tone==='resmi'){
    return `Sayın Veli,\n\n${ad} adlı öğrencimize ait eğitim ücretinde ${kalan} tutarında ödenmemiş bakiye bulunduğunu bilgilerinize sunarız. Ödemenizi en kısa sürede tamamlamanızı rica ederiz.\n\nHerhangi bir sorunuz veya ödeme planı talebiniz olması halinde okul yönetimiyle iletişime geçebilirsiniz. Anlayışınız için teşekkür ederiz.\n\nSaygılarımızla,\nAvni Tokur Eğitim`;
  }
  if(tone==='kisa'){
    return `Sayın Veli, ${ad} adlı öğrencimizin eğitim ücretinde ${kalan} tutarında ödenmemiş bakiye bulunmaktadır. Ödemenizi en kısa sürede yapmanızı rica ederiz. Avni Tokur Eğitim`;
  }
  return `Merhaba 👋\n${ad} adlı öğrencimizin güncel ödeme durumu:\n• Kalan borç: ${kalan}\n\nÖdemenizi kolaylaştırmak için her türlü desteğe hazırız; taksitlendirme talebiniz varsa bizimle iletişime geçebilirsiniz. İlginiz için teşekkür ederiz.\n— Avni Tokur Eğitim`;
}
function payReminderModal(pid){
  const p=(STATE.payments||[]).find(x=>x.id===pid); if(!p) return;
  openModal('Hatırlatma Metni – '+esc(p.isim||p.sheet),
   `<div class="field"><label>Mesaj Türü</label>
      <select id="remtone"><option value="kisa">Kısa (SMS)</option><option value="nazik">Nazik (WhatsApp)</option><option value="resmi">Resmî (E-posta)</option></select></div>
    <div class="field"><label>Mesaj — düzenleyebilirsiniz</label>
      <textarea id="remtxt" style="min-height:170px"></textarea></div>
    <p class="muted">Bu metni kopyalayıp WhatsApp, SMS veya e-posta ile gönderebilirsiniz. Sistem otomatik mesaj göndermez.</p>
    <button class="btn btn-primary btn-block" id="remcopy">Metni Kopyala</button>`);
  const fill=()=>{ $('#remtxt').value=reminderText(p, $('#remtone').value); };
  fill(); $('#remtone').onchange=fill;
  $('#remcopy').onclick=async()=>{
    const ok=await copyText($('#remtxt').value);
    toast(ok?'Metin panoya kopyalandı':'Kopyalanamadı — metni elle seçip kopyalayın', ok?'ok':'err');
  };
}
function payAddModal(){
  openModal('Yeni Ödeme Kaydı',
   `<div class="field"><label>Öğrenci Adı Soyadı</label><input id="pisim"></div>
    <div class="field"><label>Program / Etiket <span class="muted">(isteğe bağlı)</span></label><input id="psheet" placeholder="örn. AHMET-7"></div>
    <div class="field"><label>Ödenecek Ücret (₺)</label><input id="pdue" type="number" min="0"></div>
    <div class="field"><label>Kayıt Tarihi</label><input id="pkayit" type="date"></div>
    <button class="btn btn-primary btn-block" id="sv">Ekle</button>`);
  $('#sv').onclick=async()=>{
    const isim=$('#pisim').value.trim(); if(!isim){ toast('İsim gerekli','err'); return; }
    try{ await mutate('addPaymentRecord',{isim, sheet:$('#psheet').value.trim(), odenecek:$('#pdue').value, kayit:$('#pkayit').value});
      closeModal(); toast('Kayıt eklendi'); go('pay'); }catch(e){ toast(e.message,'err'); }
  };
}
function payDetailModal(pid){
  const p=(STATE.payments||[]).find(x=>x.id===pid); if(!p) return;
  const list=(p.odemeler||[]).map((o,i)=>
    `<div class="sched-slot"><span>${esc(o.tarih||'-')}</span><b>${money(o.miktar)}</b>
       <button class="btn btn-sm btn-danger" data-rmpay="${i}">Sil</button></div>`).join('')
    || '<div class="empty">Henüz tahsilat yok</div>';
  openModal('Ödeme Detayı – '+esc(p.isim||p.sheet),
   `<div class="cards" style="margin-bottom:14px">
      ${card('Ödenecek',money(p.odenecek))}${card('Ödenen',money(p.odenen))}${card('Kalan',money(p.kalan))}</div>
    <div class="panel" style="padding:12px">
      <div class="panel-head"><h3 style="font-size:.95rem">Tahsilat Geçmişi</h3></div>
      <div class="sched">${list}</div>
    </div>
    <div class="panel" style="padding:12px;margin-top:12px">
      <div class="panel-head"><h3 style="font-size:.95rem">Yeni Tahsilat Ekle</h3></div>
      <div class="field"><label>Tarih</label><input id="ntar" type="date"></div>
      <div class="field"><label>Tutar (₺)</label><input id="nmik" type="number" min="0"></div>
      <button class="btn btn-primary btn-block" id="addInst">Tahsilat Ekle</button>
    </div>
    <div class="panel" style="padding:12px;margin-top:12px">
      <div class="panel-head"><h3 style="font-size:.95rem">Toplam Ücreti Düzenle</h3></div>
      <div class="field"><label>Ödenecek Ücret (₺)</label><input id="edue" type="number" min="0" value="${Number(p.odenecek)||0}"></div>
      <button class="btn btn-block" id="saveDue">Ücreti Kaydet</button>
    </div>`);
  $('#addInst').onclick=async()=>{
    try{ await mutate('addPayment',{paymentId:pid, tarih:$('#ntar').value, miktar:$('#nmik').value});
      toast('Tahsilat eklendi'); closeModal(); go('pay'); payDetailModal(pid); }catch(e){ toast(e.message,'err'); }
  };
  $('#saveDue').onclick=async()=>{
    try{ await mutate('setPaymentDue',{paymentId:pid, odenecek:$('#edue').value});
      toast('Ücret güncellendi'); closeModal(); go('pay'); payDetailModal(pid); }catch(e){ toast(e.message,'err'); }
  };
  $('#modalBody').querySelectorAll('[data-rmpay]').forEach(btn=>btn.onclick=async()=>{
    if(!confirm('Bu tahsilat kaydını silmek istiyor musunuz?')) return;
    try{ await mutate('deletePaymentInstallment',{paymentId:pid, index:Number(btn.dataset.rmpay)});
      toast('Silindi'); closeModal(); go('pay'); payDetailModal(pid); }catch(e){ toast(e.message,'err'); }
  });
}
async function payDelete(pid){
  if(!confirm('Bu ödeme kaydını tamamen silmek istiyor musunuz?')) return;
  try{ await mutate('deletePayment',{paymentId:pid}); toast('Silindi'); go('pay'); }catch(e){ toast(e.message,'err'); }
}

/* ================= ÖĞRETMEN ================= */
VIEWS.tgenel=()=>{
  const subs=(STATE.subjects||[]).map(s=>`<span class="tag">${esc(s.name)}</span>`).join('')||'<span class="muted">yok</span>';
  const cls=myClasses().map(c=>`<span class="tag">${esc(c.name)}</span>`).join('')||'<span class="muted">yok</span>';
  return `<div class="cards">${card('Derslerim',(STATE.subjects||[]).length)}${card('Sınıflarım',myClasses().length)}
    ${card('Öğrencilerim',(STATE.students||[]).length)}${card('Verdiğim Ödev',(STATE.assignments||[]).length)}</div>
    <div class="panel"><div class="panel-head"><h3>Derslerim</h3></div><div>${subs}</div></div>
    <div class="panel"><div class="panel-head"><h3>Sınıflarım</h3></div><div>${cls}</div></div>`;
};

/* ortak: ders -> sinif -> ogrenci secici alanlari */
function scsFields(idp, withStudent){
  const stu = withStudent===false ? '' :
    `<div class="field"><label>Öğrenci</label><select id="${idp}stu"><option value="">Önce sınıf seçin</option></select></div>`;
  return `<div class="field"><label>Ders</label><select id="${idp}sub">${opts(STATE.subjects,'','id','name','Ders seçin')}</select></div>
    <div class="field"><label>Sınıf</label><select id="${idp}cls">${opts(myClasses(),'','id','name','Sınıf seçin')}</select></div>
    ${stu}`;
}
function bindClassStudent(idp){
  const cs=$('#'+idp+'cls'); if(!cs) return;
  cs.onchange=()=>{ const list=studentsOfClass(cs.value);
    $('#'+idp+'stu').innerHTML = list.length?opts(list,'','id','name','Öğrenci seçin'):'<option value="">Öğrenci yok</option>'; };
}

VIEWS.tgive=()=>{
  const rows=(STATE.assignments||[]).slice().reverse().map(a=>[esc(a.dueDate||'—'),esc(a.className),esc(a.subjectName),esc(a.title),
    `<button class="btn btn-sm btn-danger" data-dg="${a.id}">Sil</button>`]);
  return `<div class="panel"><div class="panel-head"><h3>Yeni Ödev Ver</h3></div>
    <div class="row">${scsFields('g', false)}
      <div class="field"><label>Ödev Başlığı</label><input id="gtitle"></div>
      <div class="field"><label>Teslim Tarihi</label><input id="gdue" type="date"></div></div>
    <div class="field" style="margin-top:10px"><label>Açıklama</label><textarea id="gdesc"></textarea></div>
    <button class="btn btn-primary" id="gsave" style="margin-top:12px">Ödevi Kaydet</button></div>
    <div class="panel"><div class="panel-head"><h3>Verdiğim Ödevler</h3></div>${tbl(['Teslim','Sınıf','Ders','Ödev','İşlem'],rows)}</div>`;
};
wire.tgive=()=>{
  $('#gsave').onclick=async()=>{ try{ await mutate('addAssignment',{subjectId:$('#gsub').value,classId:$('#gcls').value,
    title:$('#gtitle').value.trim(),desc:$('#gdesc').value.trim(),dueDate:$('#gdue').value}); toast('Ödev verildi'); go('tgive'); }catch(e){ toast(e.message,'err'); } };
  $('#content').querySelectorAll('[data-dg]').forEach(b=>b.onclick=async()=>{ try{ await mutate('deleteAssignment',{id:b.dataset.dg}); toast('Silindi'); go('tgive'); }catch(e){ toast(e.message,'err'); } });
};

VIEWS.thw=()=>{
  return `<div class="panel"><div class="panel-head"><h3>Sınıf Ödev Sonuçları (Toplu)</h3></div>
    <div class="row">
      <div class="field"><label>Ders</label><select id="hwSub">${opts(STATE.subjects,'','id','name','Ders seçin')}</select></div>
      <div class="field"><label>Sınıf</label><select id="hwCls">${opts(myClasses(),'','id','name','Sınıf seçin')}</select></div>
      <div class="field"><label>Tarih</label><input id="hwDate" type="date"></div></div>
    <div id="hwRoster" style="margin-top:14px"><div class="empty">Ders ve sınıf seçince öğrenci listesi burada çıkar</div></div>
    <button class="btn btn-primary" id="hwSave" style="margin-top:14px;display:none">Hepsini Kaydet</button>
    <p class="muted" style="margin-top:8px">Yalnızca en az bir değer (doğru/yanlış/boş) girilen öğrenciler kaydedilir.</p></div>
    <div class="panel"><div class="panel-head"><h3>Girilen Sonuçlar</h3><span class="muted">tarihe göre gruplu</span></div>
    <p class="muted">Aşağıda daha önce girdiğiniz ödev sonuçları tarih tarih özetlenmiştir.</p></div>`
    + hwGrouped(STATE.grades.homework, 'teacher');
};
wire.thw=()=>{
  const refresh=()=>{ const sid=$('#hwSub').value, cid=$('#hwCls').value;
    const list = cid?studentsOfClass(cid):[];
    $('#hwRoster').innerHTML = (sid&&cid) ? rosterGradeTable(list,'hw',[{label:'Doğru',key:'d',type:'number',min:0},{label:'Yanlış',key:'y',type:'number',min:0},{label:'Boş',key:'b',type:'number',min:0}]) : '<div class="empty">Ders ve sınıf seçince öğrenci listesi burada çıkar</div>';
    $('#hwSave').style.display = (sid&&cid&&list.length) ? '' : 'none';
  };
  $('#hwSub').onchange=refresh; $('#hwCls').onchange=refresh;
  $('#hwSave').onclick=async()=>{
    if(!$('#hwDate').value){ toast('Tarih seçin','err'); return; }
    const records=[];
    document.querySelectorAll('.hw-d').forEach(inp=>{ const id=inp.dataset.id;
      const d=inp.value, y=(document.querySelector('.hw-y[data-id="'+id+'"]')||{}).value||'', b=(document.querySelector('.hw-b[data-id="'+id+'"]')||{}).value||'';
      if(d!==''||y!==''||b!=='') records.push({studentId:id,dogru:d,yanlis:y,bos:b}); });
    if(!records.length){ toast('Değer girilen öğrenci yok','err'); return; }
    try{ const r=await mutate('addHomeworkBulk',{subjectId:$('#hwSub').value,classId:$('#hwCls').value,date:$('#hwDate').value,records});
      toast((r.added||0)+' sonuç kaydedildi'); go('thw'); }catch(e){ toast(e.message,'err'); } };
  $('#content').querySelectorAll('[data-dh]').forEach(b=>b.onclick=async()=>{ try{ await mutate('deleteHomework',{id:b.dataset.dh}); toast('Silindi'); go('thw'); }catch(e){ toast(e.message,'err'); } });
};

VIEWS.texam=()=>{
  const rows=(STATE.exams||[]).slice().reverse().map(e=>[esc(e.date),esc(e.studentName),esc(e.className),esc(e.subjectName),esc(e.name),`<b>${esc(e.score)}</b>`,
    `<button class="btn btn-sm btn-danger" data-de="${e.id}">Sil</button>`]);
  return `${examAvgSummary(STATE.exams)}<div class="panel"><div class="panel-head"><h3>Sınıf Sınav Notları (Toplu)</h3></div>
    <div class="row">
      <div class="field"><label>Ders</label><select id="exSub">${opts(STATE.subjects,'','id','name','Ders seçin')}</select></div>
      <div class="field"><label>Sınıf</label><select id="exCls">${opts(myClasses(),'','id','name','Sınıf seçin')}</select></div>
      <div class="field"><label>Sınav Adı</label><input id="exName" placeholder="örn. 1. Yazılı"></div>
      <div class="field"><label>Tarih</label><input id="exDate" type="date"></div></div>
    <div id="exRoster" style="margin-top:14px"><div class="empty">Ders ve sınıf seçince öğrenci listesi burada çıkar</div></div>
    <button class="btn btn-primary" id="exSave" style="margin-top:14px;display:none">Hepsini Kaydet</button>
    <p class="muted" style="margin-top:8px">Yalnızca not girilen öğrenciler kaydedilir.</p></div>
    <div class="panel"><div class="panel-head"><h3>Girilen Notlar</h3></div>${tbl(['Tarih','Öğrenci','Sınıf','Ders','Sınav','Not','İşlem'],rows)}</div>`;
};
wire.texam=()=>{
  const refresh=()=>{ const sid=$('#exSub').value, cid=$('#exCls').value;
    const list = cid?studentsOfClass(cid):[];
    $('#exRoster').innerHTML = (sid&&cid) ? rosterGradeTable(list,'ex',[{label:'Not',key:'s',type:'text'}]) : '<div class="empty">Ders ve sınıf seçince öğrenci listesi burada çıkar</div>';
    $('#exSave').style.display = (sid&&cid&&list.length) ? '' : 'none';
  };
  $('#exSub').onchange=refresh; $('#exCls').onchange=refresh;
  $('#exSave').onclick=async()=>{
    if(!$('#exName').value.trim()){ toast('Sınav adı girin','err'); return; }
    const records=[];
    document.querySelectorAll('.ex-s').forEach(inp=>{ if(inp.value!=='') records.push({studentId:inp.dataset.id,score:inp.value}); });
    if(!records.length){ toast('Not girilen öğrenci yok','err'); return; }
    try{ const r=await mutate('addExamBulk',{subjectId:$('#exSub').value,classId:$('#exCls').value,name:$('#exName').value.trim(),date:$('#exDate').value,records});
      toast((r.added||0)+' not kaydedildi'); go('texam'); }catch(e){ toast(e.message,'err'); } };
  $('#content').querySelectorAll('[data-de]').forEach(b=>b.onclick=async()=>{ try{ await mutate('deleteExam',{id:b.dataset.de}); toast('Silindi'); go('texam'); }catch(e){ toast(e.message,'err'); } });
};
VIEWS.tatt=()=>{
  const curMonth=new Date().toISOString().slice(0,7);
  const recs=(STATE.attendance||[]).filter(a=>a.status!=='geldi').slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const rows=recs.map(a=>[esc(a.date),esc(a.who),esc(a.className||''),attBadge(a.status),esc(a.note||''),
    `<button class="btn btn-sm" data-edatt="${a.id}">Düzelt</button> <button class="btn btn-sm btn-danger" data-rmatt="${a.id}">Sil</button>`]);
  return `<div class="tabs"><button class="tab active" data-tab="al">Yoklama Al</button>
      <button class="tab" data-tab="sum">Aylık Özet</button></div>
    <div data-pane="al">
    <div class="panel"><div class="panel-head"><h3>Sınıf Yoklaması Al</h3></div>
    <div class="row">
      <div class="field"><label>Sınıf</label><select id="taCls">${opts(myClasses(),'','id','name','Sınıf seçin')}</select></div>
      <div class="field"><label>Tarih</label><input id="taDate" type="date"></div></div>
    <div id="taRoster" style="margin-top:14px"><div class="empty">Sınıf seçince öğrenci listesi burada çıkar</div></div>
    <button class="btn btn-primary" id="taSave" style="margin-top:14px;display:none">Yoklamayı Kaydet</button>
    <p class="muted" style="margin-top:8px">Her öğrencinin durumu (Geldi / Gelmedi / Geç / İzinli) kaydedilir. “Geldi” sayılarını “Aylık Özet” sekmesinden görebilirsiniz.</p></div>
    <div class="panel"><div class="panel-head"><h3>Devamsızlık Kayıtları</h3><span class="muted">yalnızca gelmeyen/geç/izinli</span></div>
      ${tbl(['Tarih','Öğrenci','Sınıf','Durum','Not','İşlem'],rows)}</div></div>
    <div data-pane="sum" class="hidden">
      <div class="panel"><div class="panel-head"><h3>Aylık Devam Özeti</h3>
        <div class="field" style="margin:0"><input id="sumMonth" type="month" value="${curMonth}"></div></div>
        <p class="muted" style="margin-bottom:12px">Seçilen ayda sınıflarınızdaki her öğrencinin kaç gün geldiği, gelmediği, geç kaldığı veya izinli olduğu listelenir.</p>
        <div id="sumBody"></div></div></div>`;
};
wire.tatt=()=>{
  $('#content').querySelectorAll('.tab').forEach(t=>t.onclick=()=>{
    $('#content').querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===t));
    $('#content').querySelectorAll('[data-pane]').forEach(p=>p.classList.toggle('hidden',p.dataset.pane!==t.dataset.tab));
  });
  const cs=$('#taCls'); if(cs) cs.onchange=()=>{
    const list=studentsOfClass(cs.value);
    $('#taRoster').innerHTML = cs.value ? rosterStatusTable(list,'ta') : '<div class="empty">Sınıf seçince öğrenci listesi burada çıkar</div>';
    $('#taSave').style.display = (cs.value && list.length) ? '' : 'none';
  };
  const sv=$('#taSave'); if(sv) sv.onclick=async()=>{
    if(!$('#taDate').value){ toast('Tarih seçin','err'); return; }
    const records=collectStatus('ta');
    if(!records.length){ toast('Öğrenci listesi boş','err'); return; }
    try{ const r=await mutate('addAttendanceBulk',{date:$('#taDate').value, records});
      toast((r.added||0)+' yoklama kaydı eklendi'); go('tatt'); }catch(e){ toast(e.message,'err'); } };
  const sm=$('#sumMonth'); if(sm){ const draw=()=>{ $('#sumBody').innerHTML=attSummaryTable(STATE.attendance, sm.value, 'student'); }; sm.onchange=draw; draw(); }
  $('#content').querySelectorAll('[data-edatt]').forEach(b=>b.onclick=()=>attEditModal(b.dataset.edatt,'tatt'));
  $('#content').querySelectorAll('[data-rmatt]').forEach(b=>b.onclick=async()=>{
    if(!confirm('Bu devamsızlık kaydını silmek istiyor musunuz?')) return;
    try{ await mutate('deleteAttendance',{id:b.dataset.rmatt}); toast('Silindi'); go('tatt'); }catch(e){ toast(e.message,'err'); } });
};
VIEWS.tsched=()=>schedHTML(STATE.schedule);
VIEWS.tperf=()=>perfSelectorView(myClasses());
wire.tperf=perfSelectorWire;

/* ================= DENEME TAKİBİ (dershane tarzı) ================= */
function allSubjectsList(){ return STATE.allSubjects || STATE.subjects || []; }
function trialSubjName(id){ const s=allSubjectsList().find(x=>x.id===id); return s?s.name:'?'; }
function normName(s){ return String(s||'').toLocaleUpperCase('tr-TR').replace(/\s+/g,' ').trim(); }
/* Sınav türü şablonları: lise -> TYT/AYT, ortaokul -> LGS. Yanlış katsayısı (div) ve ders+soru şablonu. */
const TRIAL_TYPES={
  TYT:{label:'TYT', group:'Lise', div:4, tpl:[
    {names:['TÜRKÇE'],q:40},{names:['SOSYAL BİLİMLER','SOSYAL'],q:20},
    {names:['TEMEL MATEMATİK','MATEMATİK'],q:40},{names:['FEN BİLİMLERİ','FEN'],q:20}]},
  AYT:{label:'AYT', group:'Lise', div:4, tpl:[
    {names:['MATEMATİK'],q:40},{names:['FİZİK'],q:14},{names:['KİMYA'],q:13},{names:['BİYOLOJİ'],q:13},
    {names:['EDEBİYAT','TÜRK DİLİ VE EDEBİYATI'],q:24},{names:['TARİH'],q:21},{names:['COĞRAFYA'],q:17}]},
  LGS:{label:'LGS', group:'Ortaokul', div:3, tpl:[
    {names:['TÜRKÇE'],q:20},{names:['MATEMATİK'],q:20},{names:['FEN BİLİMLERİ','FEN'],q:20},
    {names:['İNKILAP','T.C. İNKILAP TARİHİ','SOSYAL'],q:10},{names:['DİN KÜLTÜRÜ','DİN'],q:10},{names:['İNGİLİZCE'],q:10}]},
  OZEL:{label:'Serbest / Özel', group:'', div:4, tpl:[]}
};
function trialTypeLabel(type){ const t=TRIAL_TYPES[type]; return t?(type==='OZEL'?'Özel':type):'Özel'; }
function trialDivOf(type){ const t=TRIAL_TYPES[type]; return t?t.div:4; }
function trialNetRule(type){ return 'Net = D − Y/'+trialDivOf(type); }
function trialTypeBadge(type){ return `<span class="badge acc">${esc(trialTypeLabel(type))}</span>`; }
/* ana liste: denemeler + yeni deneme formu (yalnızca yönetici) */
function trialMainHTML(trials, classes, canEdit){
  trials=(trials||[]).slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const cards = trials.length ? trials.map(t=>{
    const btns = `<button class="btn btn-sm btn-primary" data-trep="${t.id}">Sonuç / Grafik</button>`
      + (canEdit?` <button class="btn btn-sm" data-tent="${t.id}">Sonuç Gir</button> <button class="btn btn-sm btn-danger" data-tdel="${t.id}">Sil</button>`:'');
    return `<div class="panel" style="padding:14px">
      <div class="panel-head"><h3 style="margin:0">${esc(t.name)} ${trialTypeBadge(t.type)}</h3><span class="muted">${esc(t.className||'')} · ${esc(t.date||'')}</span></div>
      <div class="cards" style="margin:10px 0">${card('Toplam Soru',t.totalQ||0)}${card('Katılan',t.participants||0)}${card('Sınıf Ort. Net',t.classAvgNet!=null?t.classAvgNet:0)}${card('Sınıf Ort. Puan',t.classAvg!=null?t.classAvg:0)}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${btns}</div></div>`;
  }).join('') : '<div class="empty">Henüz deneme eklenmemiş</div>';
  const addBtn = canEdit ? `<button class="btn btn-primary btn-sm" id="trAdd">+ Deneme Ekle</button>` : '';
  const intro = canEdit
    ? 'Sınav türünü seçin (liseler için TYT/AYT, ortaokullar için LGS), dersler ve soru sayıları otomatik gelir. Her öğrencinin doğru/yanlış/boş bilgisini girin; net ve tahmini puan otomatik hesaplanır. Sonuç ekranında sıralama ve ders bazında grafikler görünür.'
    : 'Sadece ilgili sınıflarınıza ait deneme sonuçlarını görüntüleyebilirsiniz. Sonuçları yönetici girer.';
  return `<div class="panel"><div class="panel-head"><h3>Deneme Takibi</h3>${addBtn}</div>
    <p class="muted">${intro}</p></div>${cards}`;
}
/* yeni deneme oluşturma formu (sınav türü + şablon) */
function trialAddModal(classes){
  const subs=allSubjectsList();
  const typeOpts=Object.keys(TRIAL_TYPES).map(k=>`<option value="${k}">${esc(TRIAL_TYPES[k].label)}${TRIAL_TYPES[k].group?(' – '+TRIAL_TYPES[k].group):''}</option>`).join('');
  openModal('Yeni Deneme',
   `<div class="field"><label>Sınav Türü</label><select id="ttype">${typeOpts}</select></div>
    <p class="muted" id="truleInfo" style="margin:-4px 0 8px"></p>
    <div class="field"><label>Deneme Adı</label><input id="tn" placeholder="örn. TYT Deneme 1"></div>
    <div class="field"><label>Sınıf</label><select id="tc">${opts(classes,'','id','name','Sınıf seçin')}</select></div>
    <div class="field"><label>Tarih</label><input id="td" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
    <label style="font-weight:600;display:block;margin:10px 0 6px">Dersler ve Soru Sayıları</label>
    <p class="muted" style="margin-bottom:8px">Sınav türüne göre soru sayıları otomatik dolar; gerekirse değiştirin (0 = dahil değil).</p>
    <div id="tsubs">${subs.map(s=>`<div class="row" style="align-items:center;gap:10px;margin-bottom:6px">
      <div style="flex:1">${esc(s.name)}</div>
      <input type="number" min="0" style="width:110px" data-sq="${s.id}" data-sn="${esc(normName(s.name))}" placeholder="soru"></div>`).join('')}</div>
    <button class="btn btn-primary btn-block" id="tsv">Oluştur</button>`);
  const applyTpl=()=>{
    const type=$('#ttype').value; const def=TRIAL_TYPES[type];
    $('#truleInfo').textContent = def.group ? (def.group+' sınavı — '+trialNetRule(type)) : trialNetRule(type);
    document.querySelectorAll('[data-sq]').forEach(inp=>{ inp.value=''; });
    (def.tpl||[]).forEach(item=>{
      for(const inp of document.querySelectorAll('[data-sq]')){
        if(item.names.map(normName).includes(inp.dataset.sn)){ inp.value=item.q; break; }
      }
    });
    if(!$('#tn').value){ const cls=$('#tc'); const cn=cls&&cls.selectedIndex>0?cls.options[cls.selectedIndex].text:''; }
  };
  $('#ttype').onchange=applyTpl; applyTpl();
  $('#tsv').onclick=async()=>{
    const type=$('#ttype').value;
    const subjects=[...document.querySelectorAll('[data-sq]')].map(i=>({subjectId:i.dataset.sq,qCount:Number(i.value)||0})).filter(s=>s.qCount>0);
    try{ await mutate('addTrial',{name:$('#tn').value.trim(),type,classId:$('#tc').value,date:$('#td').value,subjects});
      closeModal(); toast('Deneme oluşturuldu'); go(PAGE); }catch(e){ toast(e.message,'err'); }
  };
}
/* sonuç giriş ekranı: öğrenci × ders D/Y/B tablosu */
function trialEnterHTML(t){
  if(!t) return '<div class="empty">Deneme bulunamadı</div>';
  const subs=t.subjects||[];
  const head=`<th style="text-align:left">Öğrenci</th>`+subs.map(s=>`<th>${esc(s.subjectName)}<br><span class="muted">${s.qCount} soru · D/Y/B</span></th>`).join('');
  const body=(t.rows||[]).map(r=>{
    const cells=subs.map(s=>{ const c=(r.cells||{})[s.subjectId]||{};
      return `<td><div style="display:flex;gap:4px;justify-content:center" data-stu="${r.studentId}" data-sub="${s.subjectId}">
        <input type="number" min="0" class="tcell td" style="width:46px" value="${c.d!=null?c.d:''}" placeholder="D">
        <input type="number" min="0" class="tcell ty" style="width:46px" value="${c.y!=null?c.y:''}" placeholder="Y">
        <input type="number" min="0" class="tcell tb" style="width:46px" value="${c.b!=null?c.b:''}" placeholder="B"></div></td>`;
    }).join('');
    return `<tr><td style="text-align:left"><b>${esc(r.studentName)}</b></td>${cells}</tr>`;
  }).join('');
  return `<div class="panel"><div class="panel-head"><h3>${esc(t.name)} ${trialTypeBadge(t.type)} – Sonuç Girişi</h3>
      <div style="display:flex;gap:8px"><button class="btn btn-sm" id="trBack">← Geri</button><button class="btn btn-primary btn-sm" id="trSave">Kaydet</button></div></div>
    <p class="muted" style="margin-bottom:10px">${esc(t.className||'')} · Her ders için Doğru / Yanlış / Boş girin. ${trialNetRule(t.type)}. Boş bırakılan öğrenci sıralamaya girmez.</p>
    <div class="table-wrap ekboard"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div></div>`;
}
/* sonuç + sıralama + ders bazında grafik ekranı */
function trialReportHTML(t, readOnlyMine){
  if(!t) return '<div class="empty">Deneme bulunamadı</div>';
  const subs=t.subjects||[];
  const chart = barChart((t.subjAvg||[]).map(s=>({label:s.subjectName+' ('+s.qCount+')', val:s.avgNet})), null, 'net');
  let tableHTML;
  if(readOnlyMine){
    const m=t.mine;
    if(!m||!m.hasData){ tableHTML='<div class="empty">Bu deneme için çocuğunuzun sonucu henüz girilmemiş</div>'; }
    else {
      const rowCells=subs.map(s=>{ const c=(m.cells||{})[s.subjectId];
        return `<tr><td style="text-align:left">${esc(s.subjectName)}</td><td>${c?c.d:'—'}</td><td>${c?c.y:'—'}</td><td>${c?c.b:'—'}</td><td><b>${c?c.net:'—'}</b></td></tr>`;
      }).join('');
      tableHTML=`<div class="cards" style="margin-bottom:12px">${card('Toplam Net',m.totalNet)}${card('Puan',m.puan)}${card('Sınıf Sırası',(m.rank||'—')+' / '+(t.participants||0))}${card('Sınıf Ort.',t.classAvg||0)}</div>
        <div class="table-wrap"><table><thead><tr><th style="text-align:left">Ders</th><th>D</th><th>Y</th><th>B</th><th>Net</th></tr></thead><tbody>${rowCells}</tbody></table></div>`;
    }
  } else {
    const ranked=(t.rows||[]).filter(r=>r.hasData).sort((a,b)=>b.totalNet-a.totalNet);
    if(!ranked.length){ tableHTML='<div class="empty">Henüz sonuç girilmemiş</div>'; }
    else {
      const head=`<th>Sıra</th><th style="text-align:left">Öğrenci</th>`+subs.map(s=>`<th>${esc(s.subjectName)}<br><span class="muted">net</span></th>`).join('')+`<th>Toplam Net</th><th>Puan</th>`;
      const body=ranked.map(r=>{
        const cells=subs.map(s=>{ const c=(r.cells||{})[s.subjectId]; return `<td>${c?c.net:'<span class="muted">—</span>'}</td>`; }).join('');
        return `<tr><td><b>${r.rank}</b></td><td style="text-align:left"><b>${esc(r.studentName)}</b></td>${cells}<td><b>${r.totalNet}</b></td><td><span class="gr ${gradeCls(r.puan)}">${r.puan}</span></td></tr>`;
      }).join('');
      tableHTML=`<div class="table-wrap ekboard"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
    }
  }
  return `<div class="panel"><div class="panel-head"><h3>${esc(t.name)} ${trialTypeBadge(t.type)} – Sonuç</h3>
      <div style="display:flex;gap:8px"><button class="btn btn-sm" id="trBack">← Geri</button></div></div>
    <p class="muted">${esc(t.className||'')} · ${esc(t.date||'')} · Toplam ${t.totalQ||0} soru · ${t.participants||0} katılımcı · ${trialNetRule(t.type)} · Puan 100–500 (tahmini)</p></div>
    <div class="panel"><div class="panel-head"><h3>Ders Bazında Ortalama Net</h3></div>${chart}</div>
    <div class="panel"><div class="panel-head"><h3>${readOnlyMine?'Çocuğumun Sonucu':'Sıralama'}</h3></div>${tableHTML}</div>`;
}
/* ortak render: scope -> {trials, classes, canEdit, readOnlyMine} */
function renderTrials(trials, classes, canEdit, readOnlyMine){
  const v=TRIAL_VIEW;
  if(v.mode==='enter' && canEdit){
    const t=(trials||[]).find(x=>x.id===v.id);
    return trialEnterHTML(t);
  }
  if(v.mode==='report'){
    const t=(trials||[]).find(x=>x.id===v.id);
    return trialReportHTML(t, readOnlyMine);
  }
  return trialMainHTML(trials, classes, canEdit);
}
function wireTrials(trials, classes, canEdit){
  const v=TRIAL_VIEW;
  if(v.mode==='main'){
    if(canEdit){ const a=$('#trAdd'); if(a) a.onclick=()=>trialAddModal(classes); }
    $('#content').querySelectorAll('[data-trep]').forEach(b=>b.onclick=()=>{ TRIAL_VIEW={id:b.dataset.trep,mode:'report'}; go(PAGE); });
    if(canEdit){
      $('#content').querySelectorAll('[data-tent]').forEach(b=>b.onclick=()=>{ TRIAL_VIEW={id:b.dataset.tent,mode:'enter'}; go(PAGE); });
      $('#content').querySelectorAll('[data-tdel]').forEach(b=>b.onclick=async()=>{
        if(!confirm('Bu denemeyi silmek istediğinize emin misiniz?')) return;
        try{ await mutate('deleteTrial',{trialId:b.dataset.tdel}); toast('Silindi'); go(PAGE); }catch(e){ toast(e.message,'err'); } });
    }
    return;
  }
  const back=$('#trBack'); if(back) back.onclick=()=>{ TRIAL_VIEW={id:'',mode:'main'}; go(PAGE); };
  if(v.mode==='enter' && canEdit){
    const sv=$('#trSave'); if(sv) sv.onclick=async()=>{
      const map={};
      $('#content').querySelectorAll('[data-stu]').forEach(cell=>{
        const sid=cell.dataset.stu, sub=cell.dataset.sub;
        const d=cell.querySelector('.td').value, y=cell.querySelector('.ty').value, b=cell.querySelector('.tb').value;
        if(d===''&&y===''&&b==='') return;
        map[sid]=map[sid]||{}; map[sid][sub]={d,y,b};
      });
      const records=Object.keys(map).map(sid=>({studentId:sid,cells:map[sid]}));
      try{ const r=await mutate('saveTrialResults',{trialId:v.id,records}); toast('Kaydedildi ('+(r.saved||0)+' öğrenci)'); TRIAL_VIEW={id:v.id,mode:'report'}; go(PAGE); }catch(e){ toast(e.message,'err'); }
    };
  }
}
VIEWS.trials=()=>renderTrials(STATE.trials, STATE.classes||[], true, false);
wire.trials=()=>wireTrials(STATE.trials, STATE.classes||[], true);
VIEWS.ttrials=()=>renderTrials(STATE.trials, myClasses(), false, false);
wire.ttrials=()=>wireTrials(STATE.trials, myClasses(), false);
VIEWS.ptrials=()=>renderTrials(STATE.trials, [], false, true);
wire.ptrials=()=>wireTrials(STATE.trials, [], false);

/* ================= VELİ ================= */
VIEWS.pchild=()=>{
  const c=STATE.child; if(!c) return '<div class="empty">Öğrenci kaydı bulunamadı</div>';
  return `<div class="cards">${card('Öğrenci',c.name)}${card('Sınıf',c.className)}
    ${card('Ödev Kaydı',(STATE.grades.homework||[]).length)}${card('Sınav',(STATE.exams||[]).length)}
    ${card('Verilen Ödev',(STATE.assignments||[]).length)}</div>
    <div class="panel"><div class="panel-head"><h3>${esc(c.name)}</h3></div>
    <p class="muted">Sınıf: ${esc(c.className)}. Soldaki menüden ders programını, ödev sonuçlarını, verilen ödevleri ve sınav notlarını görebilirsiniz.</p></div>`;
};
VIEWS.psched=()=>schedHTML(STATE.schedule);
VIEWS.phw=()=>{
  return `<div class="panel"><div class="panel-head"><h3>Ödev Sonuçları</h3>
    <span class="muted">tarihe göre gruplu</span></div>
    <p class="muted">Çocuğunuzun ödev sonuçları tarih tarih aşağıda özetlenmiştir.</p></div>`
    + hwGrouped(STATE.grades.homework, 'parent');
};
VIEWS.passign=()=>{
  const rows=(STATE.assignments||[]).slice().reverse().map(a=>[esc(a.dueDate||'—'),esc(a.subjectName),esc(a.title),esc(a.desc||'')]);
  return `<div class="panel"><div class="panel-head"><h3>Verilen Ödevler</h3></div>${tbl(['Teslim','Ders','Ödev','Açıklama'],rows)}</div>`;
};
VIEWS.pexam=()=>{
  const rows=(STATE.exams||[]).slice().reverse().map(e=>[esc(e.date),esc(e.subjectName),esc(e.name),`<b>${esc(e.score)}</b>`]);
  return `${examAvgSummary(STATE.exams)}<div class="panel"><div class="panel-head"><h3>Sınav Notları</h3></div>${tbl(['Tarih','Ders','Sınav','Not'],rows)}</div>`;
};
VIEWS.pperf=()=>{
  const c=STATE.child;
  const rows=perfBySubject(STATE.exams, (STATE.grades||{}).homework||[]);
  const board = c ? `<div class="panel"><div class="panel-head"><h3>Karne Tablosu</h3></div>${gradeBoard(STATE.exams||[], [c])}</div>` : '';
  return `<div class="panel"><div class="panel-head"><h3>${esc(c?c.name:'Çocuğum')} – Ders Bazında Başarı</h3></div>
    <p class="muted">Her ders için sınav ortalaması ve ödev başarı oranı aşağıda gösterilmektedir.</p></div>`+board+perfCards(rows);
};
VIEWS.patt=()=>{
  const all=STATE.attendance||[];
  const curMonth=new Date().toISOString().slice(0,7);
  // detayda yalnızca devamsızlık (geldi dışı); “geldi” sayıları aylık özette
  const recs=all.filter(a=>a.status!=='geldi').slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const rows=recs.map(a=>[esc(a.date),attBadge(a.status),esc(a.note||'')]);
  return `<div class="tabs"><button class="tab active" data-tab="det">Devamsızlık</button>
      <button class="tab" data-tab="sum">Aylık Özet</button></div>
    <div data-pane="det">
      <div class="panel"><div class="panel-head"><h3>Devamsızlık Kayıtları</h3><span class="muted">yalnızca gelmeyen/geç/izinli</span></div>
        <p class="muted" style="margin-bottom:12px">Çocuğunuzun gelmediği, geç kaldığı veya izinli olduğu günler aşağıda listelenmiştir. “Geldi” günlerini “Aylık Özet” sekmesinden görebilirsiniz.</p>
        ${tbl(['Tarih','Durum','Not'],rows)}</div></div>
    <div data-pane="sum" class="hidden">
      <div class="panel"><div class="panel-head"><h3>Aylık Devam Özeti</h3>
        <input id="sumMonth" type="month" value="${curMonth}"></div>
        <p class="muted" style="margin-bottom:12px">Seçilen ayda çocuğunuzun kaç derse geldiği, kaçına geç/izinli/gelmedi olduğu aşağıda gösterilir.</p>
        <div id="sumBody"></div></div></div>`;
};
wire.patt=()=>{
  $('#content').querySelectorAll('.tab').forEach(t=>t.onclick=()=>{
    $('#content').querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===t));
    $('#content').querySelectorAll('[data-pane]').forEach(p=>p.classList.toggle('hidden',p.dataset.pane!==t.dataset.tab));
  });
  const sm=$('#sumMonth'); if(sm){ const draw=()=>{ $('#sumBody').innerHTML=attSummaryTable(STATE.attendance, sm.value, 'student'); }; sm.onchange=draw; draw(); }
};

/* ---- otomatik oturum ---- */
if(TOKEN){ boot().catch(()=>{ TOKEN=''; localStorage.removeItem('atk_token'); }); }
