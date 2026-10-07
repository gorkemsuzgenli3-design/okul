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
function openModal(title, html){
  $('#modalTitle').textContent=title; $('#modalBody').innerHTML=html; $('#modal').classList.remove('hidden');
}
function closeModal(){ $('#modal').classList.add('hidden'); }
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
$('#logout').onclick=()=>{ TOKEN=''; localStorage.removeItem('atk_token'); location.reload(); };
$('#pwBtn').onclick=()=>{
  openModal('Şifre Değiştir',
    `<div class="field"><label>Mevcut Şifre</label><input id="op" type="password"></div>
     <div class="field"><label>Yeni Şifre</label><input id="np" type="password"></div>
     <button class="btn btn-primary btn-block" id="pwSave">Kaydet</button>`);
  $('#pwSave').onclick=async()=>{
    try{ await mutate('changeOwnPassword',{oldPassword:$('#op').value,newPassword:$('#np').value});
      closeModal(); toast('Şifre güncellendi'); }catch(e){ toast(e.message,'err'); }
  };
};

/* ---- BOOT ---- */
async function boot(){
  const s=await api('/api/state'); STATE=s; ME=s.user;
  $('#login').classList.add('hidden'); $('#app').classList.remove('hidden');
  const roleTr={admin:'Yönetici',teacher:'Öğretmen',parent:'Veli'}[ME.role]||ME.role;
  $('#whoami').innerHTML=`<b>${esc(ME.name)}</b>${roleTr} · ${esc(ME.username)}`;
  buildNav();
}
function buildNav(){
  const menus={
    admin:[['genel','Genel Bakış'],['teachers','Öğretmenler'],['people','Öğrenci / Veli'],['struct','Sınıf & Ders'],['homework','Ödev Takibi'],['assign','Verilen Ödevler'],['exams','Sınav Notları'],['sched','Ders Programları'],['pay','Ödemeler']],
    teacher:[['tgenel','Panelim'],['tgive','Ödev Ver'],['thw','Ödev Sonuçları'],['texam','Sınav Notları'],['tsched','Programım']],
    parent:[['pchild','Çocuğum'],['psched','Ders Programı'],['phw','Ödev Sonuçları'],['passign','Verilen Ödevler'],['pexam','Sınav Notları']]
  };
  const items=menus[ME.role]||[];
  $('#nav').innerHTML=items.map(([k,t])=>`<a data-p="${k}">${t}</a>`).join('');
  $('#nav').querySelectorAll('a').forEach(a=>a.onclick=()=>go(a.dataset.p));
  go(items[0][0]);
}
function go(p){
  PAGE=p;
  $('#nav').querySelectorAll('a').forEach(a=>a.classList.toggle('active',a.dataset.p===p));
  const fn=VIEWS[p]; const title=(($('#nav a[data-p="'+p+'"]')||{}).textContent)||'Panel';
  $('#pageTitle').textContent=title;
  $('#content').innerHTML = fn ? fn() : '<div class="empty">Sayfa bulunamadı</div>';
  if(wire[p]) wire[p]();
}
async function refresh(){ const s=await api('/api/state'); STATE=s; go(PAGE); }

/* yardimci */
function opts(arr,sel,valKey='id',txtKey='name',ph){ 
  return (ph?`<option value="">${ph}</option>`:'')+arr.map(o=>`<option value="${o[valKey]}" ${o[valKey]===sel?'selected':''}>${esc(o[txtKey])}</option>`).join('');
}
const VIEWS={}; const wire={};

/* ---- ortak yardimcilar ---- */
function card(k,v){ return `<div class="card"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`; }
function tbl(cols, rows){
  if(!rows.length) return '<div class="empty">Kayıt yok</div>';
  return `<div class="table-wrap"><table><thead><tr>${cols.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function clsName(id){ const c=(STATE.classes||[]).find(x=>x.id===id); return c?c.name:''; }
function studentsOfClass(cid){ return (STATE.students||[]).filter(s=>s.classId===cid); }
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
    return [esc(t.name),esc(t.username),asg,
      `<button class="btn btn-sm" data-assign="${t.id}">Ders/Sınıf Ata</button>
       <button class="btn btn-sm" data-pw="${t.id}">Şifre</button>
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
      <button class="btn btn-primary btn-block" id="sv">Ekle</button>`);
    $('#sv').onclick=async()=>{ try{ await mutate('addUser',{role:'teacher',name:$('#n').value.trim(),username:$('#us').value.trim(),password:$('#pw').value});
      closeModal(); toast('Öğretmen eklendi'); go('teachers'); }catch(e){ toast(e.message,'err'); } };
  };
  $('#content').querySelectorAll('[data-assign]').forEach(b=>b.onclick=()=>assignModal(b.dataset.assign));
  $('#content').querySelectorAll('[data-pw]').forEach(b=>b.onclick=()=>pwModal(b.dataset.pw));
  $('#content').querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>delUser(b.dataset.del));
};
function pwModal(uid){
  openModal('Şifre Belirle',`<div class="field"><label>Yeni Şifre</label><input id="pw"></div>
    <button class="btn btn-primary btn-block" id="sv">Kaydet</button>`);
  $('#sv').onclick=async()=>{ try{ await mutate('setPassword',{userId:uid,password:$('#pw').value});
    closeModal(); toast('Şifre güncellendi'); }catch(e){ toast(e.message,'err'); } };
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

/* ---- ADMIN: Ogrenci / Veli ---- */
VIEWS.people=()=>{
  const stRows=(STATE.students||[]).map(s=>{
    const veli=(STATE.users||[]).find(u=>u.role==='parent'&&u.studentId===s.id);
    return [esc(s.name),esc(clsName(s.classId)), veli?esc(veli.username):'<span class="muted">yok</span>',
      veli?`<button class="btn btn-sm" data-pw="${veli.id}">Veli Şifre</button> <button class="btn btn-sm btn-danger" data-del="${veli.id}">Veli Sil</button>`
           :`<button class="btn btn-sm btn-primary" data-np="${s.id}">Veli Hesabı Aç</button>`];
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
      <button class="btn btn-primary btn-block" id="sv">Oluştur</button>`);
    $('#sv').onclick=async()=>{ try{ await mutate('addUser',{role:'parent',name:$('#n').value.trim(),username:$('#us').value.trim(),password:$('#pw').value,studentId:s.id});
      closeModal(); toast('Veli hesabı oluşturuldu'); go('people'); }catch(e){ toast(e.message,'err'); } };
  });
  $('#content').querySelectorAll('[data-pw]').forEach(b=>b.onclick=()=>pwModal(b.dataset.pw));
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

/* ---- ADMIN: salt-okunur listeler ---- */
VIEWS.homework=()=>{
  const rows=(STATE.grades.homework||[]).slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(h=>
    [esc(h.date),esc(h.studentName),esc(h.className),esc(h.subjectName),
     `<span class="badge ok">D ${esc(h.dogru)}</span> <span class="badge err">Y ${esc(h.yanlis)}</span> <span class="badge warn">B ${esc(h.bos)}</span>`]);
  return `<div class="panel"><div class="panel-head"><h3>Ödev Takibi</h3></div>${tbl(['Tarih','Öğrenci','Sınıf','Ders','Sonuç'],rows)}</div>`;
};
VIEWS.assign=()=>{
  const rows=(STATE.assignments||[]).map(a=>[esc(a.dueDate||'—'),esc(a.className),esc(a.subjectName),esc(a.title),esc(a.by||'')]);
  return `<div class="panel"><div class="panel-head"><h3>Verilen Ödevler</h3></div>${tbl(['Teslim','Sınıf','Ders','Ödev','Veren'],rows)}</div>`;
};
VIEWS.exams=()=>{
  const rows=(STATE.exams||[]).map(e=>[esc(e.date),esc(e.studentName),esc(e.className),esc(e.subjectName),esc(e.name),`<b>${esc(e.score)}</b>`]);
  return `<div class="panel"><div class="panel-head"><h3>Sınav Notları</h3></div>${tbl(['Tarih','Öğrenci','Sınıf','Ders','Sınav','Not'],rows)}</div>`;
};
VIEWS.sched=()=>schedHTML(STATE.schedule);
VIEWS.pay=()=>{
  const rows=(STATE.payments||[]).map(p=>Object.values(p).filter((v,i)=>i>0).map(v=>esc(v)));
  const cols=(STATE.payments&&STATE.payments[0])?Object.keys(STATE.payments[0]).filter(k=>k!=='id'):['Kayıt'];
  return `<div class="panel"><div class="panel-head"><h3>Ödemeler</h3></div>${tbl(cols,rows)}</div>`;
};

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
  const rows=(STATE.grades.homework||[]).slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(h=>
    [esc(h.date),esc(h.studentName),esc(h.className),esc(h.subjectName),
     `<span class="badge ok">D ${esc(h.dogru)}</span> <span class="badge err">Y ${esc(h.yanlis)}</span> <span class="badge warn">B ${esc(h.bos)}</span>`,
     `<button class="btn btn-sm btn-danger" data-dh="${h.id}">Sil</button>`]);
  return `<div class="panel"><div class="panel-head"><h3>Ödev Sonucu Gir</h3></div>
    <div class="row">${scsFields('h')}
      <div class="field"><label>Tarih</label><input id="hdate" type="date"></div>
      <div class="field"><label>Doğru</label><input id="hd" type="number"></div>
      <div class="field"><label>Yanlış</label><input id="hy" type="number"></div>
      <div class="field"><label>Boş</label><input id="hb" type="number"></div>
      <button class="btn btn-primary" id="hsave">Kaydet</button></div></div>
    <div class="panel"><div class="panel-head"><h3>Girilen Sonuçlar</h3></div>${tbl(['Tarih','Öğrenci','Sınıf','Ders','Sonuç','İşlem'],rows)}</div>`;
};
wire.thw=()=>{
  bindClassStudent('h');
  $('#hsave').onclick=async()=>{ try{ await mutate('addHomework',{subjectId:$('#hsub').value,classId:$('#hcls').value,studentId:$('#hstu').value,
    date:$('#hdate').value,dogru:$('#hd').value,yanlis:$('#hy').value,bos:$('#hb').value}); toast('Kaydedildi'); go('thw'); }catch(e){ toast(e.message,'err'); } };
  $('#content').querySelectorAll('[data-dh]').forEach(b=>b.onclick=async()=>{ try{ await mutate('deleteHomework',{id:b.dataset.dh}); toast('Silindi'); go('thw'); }catch(e){ toast(e.message,'err'); } });
};

VIEWS.texam=()=>{
  const rows=(STATE.exams||[]).slice().reverse().map(e=>[esc(e.date),esc(e.studentName),esc(e.className),esc(e.subjectName),esc(e.name),`<b>${esc(e.score)}</b>`,
    `<button class="btn btn-sm btn-danger" data-de="${e.id}">Sil</button>`]);
  return `<div class="panel"><div class="panel-head"><h3>Sınav Notu Gir</h3></div>
    <div class="row">${scsFields('e')}
      <div class="field"><label>Sınav Adı</label><input id="ename"></div>
      <div class="field"><label>Not</label><input id="escore"></div>
      <div class="field"><label>Tarih</label><input id="edate" type="date"></div>
      <button class="btn btn-primary" id="esave">Kaydet</button></div></div>
    <div class="panel"><div class="panel-head"><h3>Girilen Notlar</h3></div>${tbl(['Tarih','Öğrenci','Sınıf','Ders','Sınav','Not','İşlem'],rows)}</div>`;
};
wire.texam=()=>{
  bindClassStudent('e');
  $('#esave').onclick=async()=>{ try{ await mutate('addExam',{subjectId:$('#esub').value,classId:$('#ecls').value,studentId:$('#estu').value,
    name:$('#ename').value.trim(),score:$('#escore').value,date:$('#edate').value}); toast('Kaydedildi'); go('texam'); }catch(e){ toast(e.message,'err'); } };
  $('#content').querySelectorAll('[data-de]').forEach(b=>b.onclick=async()=>{ try{ await mutate('deleteExam',{id:b.dataset.de}); toast('Silindi'); go('texam'); }catch(e){ toast(e.message,'err'); } });
};
VIEWS.tsched=()=>schedHTML(STATE.schedule);

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
  const rows=(STATE.grades.homework||[]).slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(h=>
    [esc(h.date),esc(h.subjectName),`<span class="badge ok">D ${esc(h.dogru)}</span> <span class="badge err">Y ${esc(h.yanlis)}</span> <span class="badge warn">B ${esc(h.bos)}</span>`]);
  return `<div class="panel"><div class="panel-head"><h3>Ödev Sonuçları</h3></div>${tbl(['Tarih','Ders','Sonuç'],rows)}</div>`;
};
VIEWS.passign=()=>{
  const rows=(STATE.assignments||[]).slice().reverse().map(a=>[esc(a.dueDate||'—'),esc(a.subjectName),esc(a.title),esc(a.desc||'')]);
  return `<div class="panel"><div class="panel-head"><h3>Verilen Ödevler</h3></div>${tbl(['Teslim','Ders','Ödev','Açıklama'],rows)}</div>`;
};
VIEWS.pexam=()=>{
  const rows=(STATE.exams||[]).slice().reverse().map(e=>[esc(e.date),esc(e.subjectName),esc(e.name),`<b>${esc(e.score)}</b>`]);
  return `<div class="panel"><div class="panel-head"><h3>Sınav Notları</h3></div>${tbl(['Tarih','Ders','Sınav','Not'],rows)}</div>`;
};

/* ---- otomatik oturum ---- */
if(TOKEN){ boot().catch(()=>{ TOKEN=''; localStorage.removeItem('atk_token'); }); }
