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
    admin:[['genel','Genel Bakış'],['teachers','Öğretmenler'],['people','Öğrenci / Veli'],['struct','Sınıf & Ders'],['homework','Ödev Takibi'],['assign','Verilen Ödevler'],['exams','Sınav Notları'],['att','Devamsızlık'],['sched','Ders Programları'],['pay','Ödemeler'],['audit','İşlem Kayıtları']],
    teacher:[['tgenel','Panelim'],['tgive','Ödev Ver'],['thw','Ödev Sonuçları'],['texam','Sınav Notları'],['tatt','Devamsızlık'],['tsched','Programım']],
    parent:[['pchild','Çocuğum'],['psched','Ders Programı'],['phw','Ödev Sonuçları'],['passign','Verilen Ödevler'],['pexam','Sınav Notları'],['patt','Devamsızlık']]
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
function money(n){ const v=Number(n)||0; return v.toLocaleString('tr-TR')+' ₺'; }
function tbl(cols, rows){
  if(!rows.length) return '<div class="empty">Kayıt yok</div>';
  return `<div class="table-wrap"><table><thead><tr>${cols.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function clsName(id){ const c=(STATE.classes||[]).find(x=>x.id===id); return c?c.name:''; }
/* devamsizlik durumu -> rozet */
const ATT_LABEL={yok:'Gelmedi', gec:'Geç Geldi', izinli:'İzinli'};
function attBadge(s){
  if(s==='gec') return '<span class="badge warn">Geç Geldi</span>';
  if(s==='izinli') return '<span class="badge acc">İzinli</span>';
  return '<span class="badge err">Gelmedi</span>';
}
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
    const nameCell=`${esc(t.name)} ${t.active===false?'<span class="badge err">pasif</span>':''}${t.mustChange?' <span class="badge warn">şifre bekliyor</span>':''}`;
    return [nameCell,esc(t.username),asg,
      `<button class="btn btn-sm" data-assign="${t.id}">Ders/Sınıf Ata</button>
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

/* ---- ADMIN: Ogrenci / Veli ---- */
VIEWS.people=()=>{
  const stRows=(STATE.students||[]).map(s=>{
    const veli=(STATE.users||[]).find(u=>u.role==='parent'&&u.studentId===s.id);
    const veliCell = veli ? esc(veli.username)+(veli.active===false?' <span class="badge err">pasif</span>':'')+(veli.mustChange?' <span class="badge warn">şifre bekliyor</span>':'') : '<span class="muted">yok</span>';
    return [esc(s.name),esc(clsName(s.classId)), veliCell,
      veli?`<button class="btn btn-sm" data-pw="${veli.id}">Veli Şifre</button> <button class="btn btn-sm" data-act="${veli.id}" data-to="${veli.active===false?1:0}">${veli.active===false?'Aktifleştir':'Dondur'}</button> <button class="btn btn-sm btn-danger" data-del="${veli.id}">Veli Sil</button>`
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
      <p class="muted">En az 8 karakter, bir harf + bir rakam. Veli ilk girişte değiştirir.</p>
      <button class="btn btn-primary btn-block" id="sv">Oluştur</button>`);
    $('#sv').onclick=async()=>{ try{ await mutate('addUser',{role:'parent',name:$('#n').value.trim(),username:$('#us').value.trim(),password:$('#pw').value,studentId:s.id});
      closeModal(); toast('Veli hesabı oluşturuldu'); go('people'); }catch(e){ toast(e.message,'err'); } };
  });
  $('#content').querySelectorAll('[data-pw]').forEach(b=>b.onclick=()=>pwModal(b.dataset.pw));
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
/* ---- ADMIN: Devamsızlık ---- */
VIEWS.att=()=>{
  const all=STATE.attendance||[];
  const stu=all.filter(a=>a.kind==='student').slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const tea=all.filter(a=>a.kind==='teacher').slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const cnt=s=>s.length;
  const stuRows=stu.map(a=>[esc(a.date),esc(a.who),esc(a.className||''),attBadge(a.status),esc(a.note||''),
    `<button class="btn btn-sm btn-danger" data-rmatt="${a.id}">Sil</button>`]);
  const teaRows=tea.map(a=>[esc(a.date),esc(a.who),attBadge(a.status),esc(a.note||''),
    `<button class="btn btn-sm btn-danger" data-rmatt="${a.id}">Sil</button>`]);
  const durumSel=`<select id="astat"><option value="yok">Gelmedi</option><option value="gec">Geç Geldi</option><option value="izinli">İzinli</option></select>`;
  return `<div class="cards">
      ${card('Öğrenci Devamsızlığı', cnt(stu))}
      ${card('Öğretmen Devamsızlığı', cnt(tea))}</div>
    <div class="tabs"><button class="tab active" data-tab="stu">Öğrenci Devamsızlıkları</button>
      <button class="tab" data-tab="tea">Öğretmen Devamsızlıkları</button></div>
    <div data-pane="stu">
      <div class="panel"><div class="panel-head"><h3>Öğrenci Devamsızlığı Ekle</h3></div>
        <div class="row">
          <div class="field"><label>Sınıf</label><select id="acls">${opts(STATE.classes,'','id','name','Sınıf seçin')}</select></div>
          <div class="field"><label>Öğrenci</label><select id="astu"><option value="">Önce sınıf seçin</option></select></div>
          <div class="field"><label>Tarih</label><input id="adate" type="date"></div>
          <div class="field"><label>Durum</label>${durumSel}</div>
          <div class="field" style="flex:2"><label>Not (isteğe bağlı)</label><input id="anote" placeholder="örn. Rahatsızlık"></div>
          <button class="btn btn-primary" id="aSave">Kaydet</button></div></div>
      <div class="panel"><div class="panel-head"><h3>Öğrenci Devamsızlık Kayıtları</h3></div>
        ${tbl(['Tarih','Öğrenci','Sınıf','Durum','Not','İşlem'],stuRows)}</div></div>
    <div data-pane="tea" class="hidden">
      <div class="panel"><div class="panel-head"><h3>Öğretmen Devamsızlığı Ekle</h3></div>
        <div class="row">
          <div class="field"><label>Öğretmen</label><select id="atea">${opts(STATE.teachers||[],'','id','name','Öğretmen seçin')}</select></div>
          <div class="field"><label>Tarih</label><input id="atdate" type="date"></div>
          <div class="field"><label>Durum</label><select id="atstat"><option value="yok">Gelmedi</option><option value="gec">Geç Geldi</option><option value="izinli">İzinli</option></select></div>
          <div class="field" style="flex:2"><label>Not (isteğe bağlı)</label><input id="atnote"></div>
          <button class="btn btn-primary" id="atSave">Kaydet</button></div></div>
      <div class="panel"><div class="panel-head"><h3>Öğretmen Devamsızlık Kayıtları</h3></div>
        ${tbl(['Tarih','Öğretmen','Durum','Not','İşlem'],teaRows)}</div></div>`;
};
wire.att=()=>{
  $('#content').querySelectorAll('.tab').forEach(t=>t.onclick=()=>{
    $('#content').querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===t));
    $('#content').querySelectorAll('[data-pane]').forEach(p=>p.classList.toggle('hidden',p.dataset.pane!==t.dataset.tab));
  });
  const cs=$('#acls'); if(cs) cs.onchange=()=>{ const list=studentsOfClass(cs.value);
    $('#astu').innerHTML = list.length?opts(list,'','id','name','Öğrenci seçin'):'<option value="">Öğrenci yok</option>'; };
  const sv=$('#aSave'); if(sv) sv.onclick=async()=>{
    if(!$('#astu').value){ toast('Öğrenci seçin','err'); return; }
    if(!$('#adate').value){ toast('Tarih seçin','err'); return; }
    try{ await mutate('addAttendance',{studentId:$('#astu').value, date:$('#adate').value, status:$('#astat').value, note:$('#anote').value.trim()});
      toast('Devamsızlık eklendi'); go('att'); }catch(e){ toast(e.message,'err'); } };
  const tsv=$('#atSave'); if(tsv) tsv.onclick=async()=>{
    if(!$('#atea').value){ toast('Öğretmen seçin','err'); return; }
    if(!$('#atdate').value){ toast('Tarih seçin','err'); return; }
    try{ await mutate('addTeacherAttendance',{teacherId:$('#atea').value, date:$('#atdate').value, status:$('#atstat').value, note:$('#atnote').value.trim()});
      toast('Devamsızlık eklendi'); go('att');
      $('#content').querySelector('.tab[data-tab="tea"]').click(); }catch(e){ toast(e.message,'err'); } };
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
    addAttendance:'Öğrenci devamsızlığı',addTeacherAttendance:'Öğretmen devamsızlığı',deleteAttendance:'Devamsızlık silme'};
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
  $('#content').querySelectorAll('[data-paydel]').forEach(x=>x.onclick=()=>payDelete(x.dataset.paydel));
};
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
VIEWS.tatt=()=>{
  const recs=(STATE.attendance||[]).slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const rows=recs.map(a=>[esc(a.date),esc(a.who),esc(a.className||''),attBadge(a.status),esc(a.note||''),
    `<button class="btn btn-sm btn-danger" data-rmatt="${a.id}">Sil</button>`]);
  return `<div class="panel"><div class="panel-head"><h3>Öğrenci Devamsızlığı Ekle</h3></div>
    <div class="row">
      <div class="field"><label>Sınıf</label><select id="tacls">${opts(myClasses(),'','id','name','Sınıf seçin')}</select></div>
      <div class="field"><label>Öğrenci</label><select id="tastu"><option value="">Önce sınıf seçin</option></select></div>
      <div class="field"><label>Tarih</label><input id="tadate" type="date"></div>
      <div class="field"><label>Durum</label><select id="tastat"><option value="yok">Gelmedi</option><option value="gec">Geç Geldi</option><option value="izinli">İzinli</option></select></div>
      <div class="field" style="flex:2"><label>Not (isteğe bağlı)</label><input id="tanote"></div>
      <button class="btn btn-primary" id="taSave">Kaydet</button></div></div>
    <div class="panel"><div class="panel-head"><h3>Devamsızlık Kayıtları</h3></div>
      ${tbl(['Tarih','Öğrenci','Sınıf','Durum','Not','İşlem'],rows)}</div>`;
};
wire.tatt=()=>{
  const cs=$('#tacls'); if(cs) cs.onchange=()=>{ const list=studentsOfClass(cs.value);
    $('#tastu').innerHTML = list.length?opts(list,'','id','name','Öğrenci seçin'):'<option value="">Öğrenci yok</option>'; };
  const sv=$('#taSave'); if(sv) sv.onclick=async()=>{
    if(!$('#tastu').value){ toast('Öğrenci seçin','err'); return; }
    if(!$('#tadate').value){ toast('Tarih seçin','err'); return; }
    try{ await mutate('addAttendance',{studentId:$('#tastu').value, date:$('#tadate').value, status:$('#tastat').value, note:$('#tanote').value.trim()});
      toast('Devamsızlık eklendi'); go('tatt'); }catch(e){ toast(e.message,'err'); } };
  $('#content').querySelectorAll('[data-rmatt]').forEach(b=>b.onclick=async()=>{
    if(!confirm('Bu devamsızlık kaydını silmek istiyor musunuz?')) return;
    try{ await mutate('deleteAttendance',{id:b.dataset.rmatt}); toast('Silindi'); go('tatt'); }catch(e){ toast(e.message,'err'); } });
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
VIEWS.patt=()=>{
  const recs=(STATE.attendance||[]).slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const rows=recs.map(a=>[esc(a.date),attBadge(a.status),esc(a.note||'')]);
  return `<div class="panel"><div class="panel-head"><h3>Devamsızlık</h3></div>
    <p class="muted" style="margin-bottom:12px">Çocuğunuzun kayıtlı devamsızlık bilgileri aşağıda listelenmiştir.</p>
    ${tbl(['Tarih','Durum','Not'],rows)}</div>`;
};

/* ---- otomatik oturum ---- */
if(TOKEN){ boot().catch(()=>{ TOKEN=''; localStorage.removeItem('atk_token'); }); }
