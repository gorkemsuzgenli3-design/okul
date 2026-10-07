/* Avni Tokur Eğitim – Frontend */
'use strict';
let TOKEN = localStorage.getItem('atk_token') || '';
let ME = null, STATE = null, PAGE = '';
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function api(path, method = 'GET', body) {
  const opt = { method, headers: {} };
  if (TOKEN) opt.headers['Authorization'] = 'Bearer ' + TOKEN;
  if (body) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
  const r = await fetch(path, opt);
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && path !== '/api/login') {
    TOKEN = ''; localStorage.removeItem('atk_token');
    if (!$('#login').classList.contains('login-wrap')) { } location.reload(); throw new Error(data.error || 'Oturum geçersiz');
  }
  if (!r.ok) throw new Error(data.error || ('HTTP ' + r.status));
  return data;
}

async function mutate(action, extra = {}) {
  const r = await api('/api/mutate', 'POST', Object.assign({ action }, extra));
  if (r.state) STATE = r.state;
  return r;
}

function toast(msg, type = 'ok') {
  const t = $('#toast'); t.textContent = msg; t.className = 'toast ' + type; t.classList.remove('hidden');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.add('hidden'), 2600);
}

let MODAL_FORCED = false;
function openModal(title, html, forced) {
  MODAL_FORCED = !!forced;
  $('#modalTitle').textContent = title; $('#modalBody').innerHTML = html; $('#modal').classList.remove('hidden');
  $('#modalClose').style.display = forced ? 'none' : '';
}

function closeModal() { if (MODAL_FORCED) return; $('#modal').classList.add('hidden'); }
$('#modalClose').onclick = closeModal;
$('#modal').onclick = e => { if (e.target.id === 'modal') closeModal(); };

/* ---- LOGIN ---- */
$('#loginForm').onsubmit = async e => {
  e.preventDefault(); $('#loginErr').textContent = '';
  try {
    const r = await api('/api/login', 'POST', { username: $('#luser').value.trim(), password: $('#lpass').value });
    TOKEN = r.token; localStorage.setItem('atk_token', TOKEN); ME = r.user;
    await boot();
  } catch (err) { $('#loginErr').textContent = err.message; }
};

$('#logout').onclick = async () => { try { await api('/api/logout', 'POST'); } catch (e) { } TOKEN = ''; localStorage.removeItem('atk_token'); location.reload(); };

function ownPwModal(forced) {
  openModal(forced ? 'Şifrenizi Belirleyin' : 'Şifre Değiştir',
    `${forced ? '<p class="muted" style="margin-bottom:12px">Güvenlik için ilk girişte şifrenizi değiştirmelisiniz.</p>' : ''}
     <div class="field"><label>Mevcut Şifre</label><input id="op" type="password"></div>
     <div class="field"><label>Yeni Şifre</label><input id="np" type="password"></div>
     <div class="field"><label>Yeni Şifre (tekrar)</label><input id="np2" type="password"></div>
     <p class="muted">En az 8 karakter, en az bir harf ve bir rakam içermeli.</p>
     <button class="btn btn-primary btn-block" id="pwSave">Kaydet</button>`, forced);
  $('#pwSave').onclick = async () => {
    if ($('#np').value !== $('#np2').value) { toast('Yeni şifreler aynı değil', 'err'); return; }
    try {
      await mutate('changeOwnPassword', { oldPassword: $('#op').value, newPassword: $('#np').value });
      MODAL_FORCED = false; closeModal(); toast('Şifre güncellendi');
      if (ME) ME.mustChange = false; await refresh();
    } catch (e) { toast(e.message, 'err'); }
  };
}
$('#pwBtn').onclick = () => ownPwModal(false);

/* ---- BOOT ---- */
async function boot() {
  const s = await api('/api/state'); STATE = s; ME = s.user;
  $('#login').classList.add('hidden'); $('#app').classList.remove('hidden');
  const roleTr = { admin: 'Yönetici', teacher: 'Öğretmen', parent: 'Veli' }[ME.role] || ME.role;
  $('#whoami').innerHTML = `<b>${esc(ME.name)}</b>${roleTr} · ${esc(ME.username)}`;
  buildNav();
  if (ME.mustChange) ownPwModal(true);
}

// Oturum jetonu varsa sayfayı yenilediğinde veya ilk açılışta doğrudan boot çalıştır
if (TOKEN) {
  boot().catch(() => {
    TOKEN = '';
    localStorage.removeItem('atk_token');
  });
}

function buildNav() {
  const menus = {
    admin: [['genel', 'Genel Bakış'], ['teachers', 'Öğretmenler'], ['people', 'Öğrenci / Veli'], ['struct', 'Sınıf & Ders'], ['homework', 'Ödev Takibi'], ['assign', 'Verilen Ödevler'], ['exams', 'Sınav Notları'], ['sched', 'Ders Programları'], ['pay', 'Ödemeler'], ['audit', 'İşlem Kayıtları']],
    teacher: [['tgenel', 'Panelim'], ['tgive', 'Ödev Ver'], ['thw', 'Ödev Sonuçları'], ['texam', 'Sınav Notları'], ['tsched', 'Programım']],
    parent: [['pchild', 'Çocuğum'], ['psched', 'Ders Programı'], ['phw', 'Ödev Sonuçları'], ['passign', 'Verilen Ödevler'], ['pexam', 'Sınav Notları']]
  };
  const items = menus[ME.role] || [];
  $('#nav').innerHTML = items.map(([k, t]) => `<a data-p="${k}">${t}</a>`).join('');
  $('#nav').querySelectorAll('a').forEach(a => a.onclick = () => go(a.dataset.p));
  go(items[0][0]);
}

function go(p) {
  PAGE = p;
  $('#nav').querySelectorAll('a').forEach(a => a.classList.toggle('active', a.dataset.p === p));
  const fn = VIEWS[p]; const title = (($('#nav a[data-p="' + p + '"]') || {}).textContent) || 'Panel';
  $('#pageTitle').textContent = title;
  $('#content').innerHTML = fn ? fn() : '<div class="empty">Sayfa bulunamadı</div>';
  if (wire[p]) wire[p]();
}

async function refresh() { const s = await api('/api/state'); STATE = s; go(PAGE); }

/* YARDIMCI FONKSİYONLAR */
function opts(arr, sel, valKey = 'id', txtKey = 'name', ph) {
  return (ph ? `<option value="">${ph}</option>` : '') + arr.map(o => `<option value="${o[valKey]}" ${o[valKey] === sel ? 'selected' : ''}>${esc(o[txtKey])}</option>`).join('');
}

const VIEWS = {}; const wire = {};

function card(k, v) { return `<div class="card"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`; }
function money(n) { const v = Number(n) || 0; return v.toLocaleString('tr-TR') + ' ₺'; }
function tbl(cols, rows) {
  if (!rows.length) return '<div class="empty">Kayıt yok</div>';
  return `<div class="table-wrap"><table><thead><tr>${cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function clsName(id) { const c = (STATE.classes || []).find(x => x.id === id); return c ? c.name : ''; }
function studentsOfClass(cid) { return (STATE.students || []).filter(s => s.classId === cid); }
function myClassIds() { const set = new Set(); (ME.teach || []).forEach(t => t.classIds.forEach(c => set.add(c))); return [...set]; }
function myClasses() { const ids = new Set(myClassIds()); return (STATE.classes || []).filter(c => ids.has(c.id)); }

function schedHTML(obj) {
  const keys = Object.keys(obj || {}); if (!keys.length) return '<div class="empty">Program bulunmuyor</div>';
  return keys.map(k => {
    const days = obj[k] || [];
    return `<div class="panel"><div class="panel-head"><h3>${esc(k)}</h3></div>
      <div class="sched">${days.map(d => `<div class="sched-day"><h4>${esc(d.gun)}</h4>${(d.dersler || []).map(s => `<div class="sched-slot"><span>${esc(s.saat)}</span><b>${esc(s.ders || '—')}</b></div>`).join('')}
      </div>`).join('')}</div></div>`;
  }).join('');
}

/* ================= ADMIN ================= */
VIEWS.genel = () => {
  const u = STATE.users || [];
  const t = u.filter(x => x.role === 'teacher').length, p = u.filter(x => x.role === 'parent').length;
  return `<div class="cards">
    ${card('Öğretmen', t)}${card('Öğrenci', (STATE.students || []).length)}${card('Veli', p)}
    ${card('Sınıf', (STATE.classes || []).length)}${card('Ders', (STATE.subjects || []).length)}
    ${card('Ödev Kaydı', (STATE.grades.homework || []).length)}</div>
    <div class="panel"><div class="panel-head"><h3>Hızlı Bilgi</h3></div>
    <p class="muted">Not: Matematik dersi yönetici panelinde listelenmez. Öğretmen atamaları, veli hesapları ve şifreler buradan yönetilir.</p></div>`;
};

VIEWS.teachers = () => {
  const ts = (STATE.users || []).filter(x => x.role === 'teacher');
  const sName = id => {
    const list = STATE.allSubjects || STATE.subjects || [];
    const s = list.find(x => x.id === id);
    return s ? s.name : '?';
  };
  const rows = ts.map(t => {
    const asg = (t.teach || []).map(a => `<span class="tag">${esc(sName(a.subjectId))} (${a.classIds.map(clsName).join(', ') || '—'})</span>`).join('') || '<span class="muted">atama yok</span>';
    const nameCell = `${esc(t.name)} ${t.active === false ? '<span class="badge err">pasif</span>' : ''}${t.mustChange ? ' <span class="badge warn">şifre bekliyor</span>' : ''}`;
    return [nameCell, esc(t.username), asg,
      `<button class="btn btn-sm" data-assign="${t.id}">Ders/Sınıf Ata</button>
       <button class="btn btn-sm" data-pw="${t.id}">Şifre</button>
       <button class="btn btn-sm" data-act="${t.id}" data-to="${t.active === false ? 1 : 0}">${t.active === false ? 'Aktifleştir' : 'Dondur'}</button>
       <button class="btn btn-sm btn-danger" data-del="${t.id}">Sil</button>`];
  });
  return `<div class="panel"><div class="panel-head"><h3>Öğretmenler</h3>
    <button class="btn btn-primary btn-sm" id="addTeacher">+ Öğretmen Ekle</button></div>
    ${tbl(['Ad', 'Kullanıcı', 'Atanmış Ders / Sınıf', 'İşlem'], rows)}</div>`;
};

wire.teachers = () => {
  $('#addTeacher').onclick = () => {
    openModal('Öğretmen Ekle',
      `<div class="field"><label>Ad Soyad</label><input id="n"></div>
       <div class="field"><label>Kullanıcı Adı</label><input id="us"></div>
       <div class="field"><label>Şifre</label><input id="pw"></div>
       <p class="muted">En az 8 karakter, bir harf + bir rakam. Öğretmen ilk girişte değiştirir.</p>
       <button class="btn btn-primary btn-block" id="sv">Ekle</button>`);
    $('#sv').onclick = async () => {
      try {
        await mutate('addUser', { role: 'teacher', name: $('#n').value.trim(), username: $('#us').value.trim(), password: $('#pw').value });
        closeModal(); toast('Öğretmen eklendi'); go('teachers');
      } catch (e) { toast(e.message, 'err'); }
    };
  };
  $('#content').querySelectorAll('[data-assign]').forEach(b => b.onclick = () => assignModal(b.dataset.assign));
  $('#content').querySelectorAll('[data-pw]').forEach(b => b.onclick = () => pwModal(b.dataset.pw));
  $('#content').querySelectorAll('[data-act]').forEach(b => b.onclick = () => toggleActive(b.dataset.act, b.dataset.to === '1'));
  $('#content').querySelectorAll('[data-del]').forEach(b => b.onclick = () => delUser(b.dataset.del));
};

async function toggleActive(uid, to) {
  try { await mutate('setActive', { userId: uid, active: to }); toast(to ? 'Hesap aktifleştirildi' : 'Hesap donduruldu'); go(PAGE); } catch (e) { toast(e.message, 'err'); }
}

function pwModal(uid) {
  openModal('Şifre Belirle', `<div class="field"><label>Yeni Şifre</label><input id="pw"></div>
    <p class="muted">En az 8 karakter, en az bir harf ve bir rakam. Kullanıcı ilk girişte bu şifreyi değiştirmek zorunda kalır.</p>
    <button class="btn btn-primary btn-block" id="sv">Kaydet</button>`);
  $('#sv').onclick = async () => {
    try {
      await mutate('setPassword', { userId: uid, password: $('#pw').value });
      closeModal(); toast('Şifre güncellendi'); go(PAGE);
    } catch (e) { toast(e.message, 'err'); }
  };
}

async function delUser(uid) {
  if (!confirm('Bu hesabı silmek istediğinize emin misiniz?')) return;
  try { await mutate('deleteUser', { userId: uid }); toast('Silindi'); go(PAGE); } catch (e) { toast(e.message, 'err'); }
}

function assignModal(uid) {
  const t = (STATE.users || []).find(x => x.id === uid);
  const subs = STATE.subjects || [];
  const chosen = {}; (t.teach || []).forEach(a => chosen[a.subjectId] = new Set(a.classIds));
  const body = `<p class="muted" style="margin-bottom:12px">Dersleri ve her ders için sınıfları seçin.</p>
    <div id="asgList">${subs.map(s => `
      <div class="panel" style="padding:12px">
        <label style="display:flex;gap:8px;align-items:center;font-weight:600">
          <input type="checkbox" style="width:auto" data-sub="${s.id}" ${chosen[s.id] ? 'checked' : ''}>${esc(s.name)}</label>
        <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px">
        ${(STATE.classes || []).map(c => `<label class="tag" style="cursor:pointer"><input type="checkbox" style="width:auto" data-c="${s.id}" value="${c.id}" ${chosen[s.id] && chosen[s.id].has(c.id) ? 'checked' : ''}> ${esc(c.name)}</label>`).join('')}
        </div></div>`).join('')}</div>
    <button class="btn btn-primary btn-block" id="sv">Kaydet</button>`;
  openModal('Ders / Sınıf Ata – ' + esc(t.name), body);
  $('#sv').onclick = async () => {
    const teach = [];
    $('#asgList').querySelectorAll('[data-sub]').forEach(cb => {
      if (cb.checked) {
        const sid = cb.dataset.sub;
        const classIds = [...document.querySelectorAll(`[data-c="${sid}"]:checked`)].map(x => x.value);
        teach.push({ subjectId: sid, classIds });
      }
    });
    try { await mutate('assignTeacher', { userId: uid, teach }); closeModal(); toast('Atama kaydedildi'); go('teachers'); } catch (e) { toast(e.message, 'err'); }
  };
}

/* ---- ADMIN: ÖĞRENCİ / VELİ ---- */
VIEWS.people = () => {
  const stRows = (STATE.students || []).map(s => {
    const veli = (STATE.users || []).find(u => u.role === 'parent' && u.studentId === s.id);
    const veliCell = veli ? esc(veli.username) + (veli.active === false ? ' <span class="badge err">pasif</span>' : '') + (veli.mustChange ? ' <span class="badge warn">şifre bekliyor</span>' : '') : '<span class="muted">yok</span>';
    return [esc(s.name), esc(clsName(s.classId)), veliCell,
    veli ? `<button class="btn btn-sm" data-pw="${veli.id}">Veli Şifre</button> <button class="btn btn-sm" data-act="${veli.id}" data-to="${veli.active === false ? 1 : 0}">${veli.active === false ? 'Aktifleştir' : 'Dondur'}</button> <button class="btn btn-sm btn-danger" data-del="${veli.id}">Veli Sil</button>`
      : `<button class="btn btn-sm btn-primary" data-np="${s.id}">Veli Hesabı Aç</button>`];
  });
  return `<div class="panel"><div class="panel-head"><h3>Öğrenciler</h3>
      <button class="btn btn-primary btn-sm" id="addStu">+ Öğrenci Ekle</button></div>
    ${tbl(['Öğrenci', 'Sınıf', 'Veli Kullanıcı', 'İşlem'], stRows)}</div>`;
};

wire.people = () => {
  $('#addStu').onclick = () => {
    openModal('Öğrenci Ekle', `<div class="field"><label>Ad Soyad</label><input id="n"></div>
      <div class="field"><label>Sınıf</label><select id="c">${opts(STATE.classes, '', 'id', 'name', 'Sınıf seçin')}</select></div>
      <button class="btn btn-primary btn-block" id="sv">Ekle</button>`);
    $('#sv').onclick = async () => {
      try {
        await mutate('addStudent', { name: $('#n').value.trim(), classId: $('#c').value });
        closeModal(); toast('Öğrenci eklendi'); go('people');
      } catch (e) { toast(e.message, 'err'); }
    };
  };
  $('#content').querySelectorAll('[data-np]').forEach(b => b.onclick = () => {
    const s = (STATE.students || []).find(x => x.id === b.dataset.np);
    openModal('Veli Hesabı Aç – ' + esc(s.name),
      `<div class="field"><label>Veli Adı</label><input id="n" value="${esc(s.name)} Velisi"></div>
       <div class="field"><label>Kullanıcı Adı</label><input id="us"></div>
       <div class="field"><label>Şifre</label><input id="pw"></div>
       <p class="muted">En az 8 karakter, bir harf + bir rakam. Veli ilk girişte değiştirir.</p>
       <button class="btn btn-primary btn-block" id="sv">Oluştur</button>`);
    $('#sv').onclick = async () => {
      try {
        await mutate('addUser', { role: 'parent', name: $('#n').value.trim(), username: $('#us').value.trim(), password: $('#pw').value, studentId: s.id });
        closeModal(); toast('Veli hesabı oluşturuldu'); go('people');
      } catch (e) { toast(e.message, 'err'); }
    };
  });
  $('#content').querySelectorAll('[data-pw]').forEach(b => b.onclick = () => pwModal(b.dataset.pw));
  $('#content').querySelectorAll('[data-act]').forEach(b => b.onclick = () => toggleActive(b.dataset.act, b.dataset.to === '1'));
  $('#content').querySelectorAll('[data-del]').forEach(b => b.onclick = () => delUser(b.dataset.del));
};

/* ---- ADMIN: SINIF & DERS ---- */
VIEWS.struct = () => {
  const cRows = (STATE.classes || []).map(c => [esc(c.name), studentsOfClass(c.id).length + ' öğrenci']);
  const sRows = (STATE.subjects || []).map(s => [esc(s.name)]);
  return `<div class="panel"><div class="panel-head"><h3>Sınıflar</h3>
      <button class="btn btn-primary btn-sm" id="addCls">+ Sınıf</button></div>${tbl(['Sınıf', 'Öğrenci'], cRows)}</div>
    <div class="panel"><div class="panel-head"><h3>Dersler <span class="muted">(Matematik hariç)</span></h3>
      <button class="btn btn-primary btn-sm" id="addSub">+ Ders</button></div>${tbl(['Ders'], sRows)}</div>`;
};

wire.struct = () => {
  $('#addCls').onclick = () => {
    openModal('Sınıf Ekle', `<div class="field"><label>Sınıf Adı</label><input id="n" placeholder="örn. 6.SINIF"></div><button class="btn btn-primary btn-block" id="sv">Ekle</button>`);
    $('#sv').onclick = async () => { try { await mutate('addClass', { name: $('#n').value.trim() }); closeModal(); toast('Eklendi'); go('struct'); } catch (e) { toast(e.message, 'err'); } };
  };
  $('#addSub').onclick = () => {
    openModal('Ders Ekle', `<div class="field"><label>Ders Adı</label><input id="n"></div><button class="btn btn-primary btn-block" id="sv">Ekle</button>`);
    $('#sv').onclick = async () => { try { await mutate('addSubject', { name: $('#n').value.trim() }); closeModal(); toast('Eklendi'); go('struct'); } catch (e) { toast(e.message, 'err'); } };
  };
};

/* ---- ADMIN: LİSTELER ---- */
VIEWS.homework = () => {
  const rows = (STATE.grades.homework || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(h =>
    [esc(h.date), esc(h.studentName), esc(h.className), esc(h.subjectName),
    `<span class="badge ok">D ${esc(h.dogru)}</span> <span class="badge err">Y ${esc(h.yanlis)}</span> <span class="badge warn">B ${esc(h.bos)}</span>`]);
  return `<div class="panel"><div class="panel-head"><h3>Ödev Takibi</h3></div>${tbl(['Tarih', 'Öğrenci', 'Sınıf', 'Ders', 'Sonuç'], rows)}</div>`;
};

VIEWS.assign = () => {
  const rows = (STATE.assignments || []).map(a => [esc(a.dueDate || '—'), esc(a.className), esc(a.subjectName), esc(a.title), esc(a.by || '')]);
  return `<div class="panel"><div class="panel-head"><h3>Verilen Ödevler</h3></div>${tbl(['Teslim', 'Sınıf', 'Ders', 'Ödev', 'Veren'], rows)}</div>`;
};

VIEWS.exams = () => {
  const rows = (STATE.exams || []).map(e => [esc(e.date), esc(e.studentName), esc(e.className), esc(e.subjectName), esc(e.name), `<b>${esc(e.score)}</b>`]);
  return `<div class="panel"><div class="panel-head"><h3>Sınav Notları</h3></div>${tbl(['Tarih', 'Öğrenci', 'Sınıf', 'Ders', 'Sınav', 'Not'], rows)}</div>`;
};

VIEWS.sched = () => {
  const sch = STATE.schedule || {}; const keys = Object.keys(sch);
  const blocks = keys.length ? keys.map(k => {
    const days = sch[k] || [];
    const dayHtml = days.map(d => `<div class="sched-day"><h4>${esc(d.gun)}</h4>
      ${(d.dersler || []).map(s => `<div class="sched-slot"><span>${esc(s.saat)}</span><b>${esc(s.ders || '—')}</b>
        <button class="btn btn-sm btn-danger" data-rmslot="${esc(k)}|${esc(d.gun)}\vert{}${esc(s.saat)}">Sil</button></div>`).join('')
      || '<div class="muted" style="font-size:.82rem">Ders yok</div>'}
    </div>`).join('');
    return `<div class="panel"><div class="panel-head"><h3>${esc(k)}</h3>
      <div><button class="btn btn-sm" data-addslot="${esc(k)}">+ Ders Ekle</button>
      <button class="btn btn-sm btn-danger" data-rmsheet="${esc(k)}">Programı Sil</button></div></div>
      <div class="sched">${dayHtml || '<div class="empty">Boş program</div>'}</div></div>`;
  }).join('') : '<div class="empty">Program bulunmuyor</div>';
  return `<div class="panel"><div class="panel-head"><h3>Ders Programları</h3>
      <button class="btn btn-primary btn-sm" id="schedAdd">+ Yeni Program</button></div>
      <p class="muted">Her program bir sınıfa ya da öğrenciye ait ders takvimidir. Buradan ekleyip düzenleyebilirsiniz.</p></div>
    ${blocks}`;
};

wire.sched = () => {
  const a = $('#schedAdd'); if (a) a.onclick = () => {
    openModal('Yeni Program',
      `<div class="field"><label>Program Adı</label><input id="shn" placeholder="örn. 6.SINIF veya AHMET-7"></div>
       <button class="btn btn-primary btn-block" id="sv">Oluştur</button>`);
    $('#sv').onclick = async () => {
      const n = $('#shn').value.trim(); if (!n) { toast('Ad gerekli', 'err'); return; }
      try { await mutate('addSchedSheet', { sheet: n }); closeModal(); toast('Program oluşturuldu'); go('sched'); } catch (e) { toast(e.message, 'err'); }
    };
  };
  $('#content').querySelectorAll('[data-addslot]').forEach(b => b.onclick = () => schedSlotModal(b.dataset.addslot));
  $('#content').querySelectorAll('[data-rmslot]').forEach(b => b.onclick = async () => {
    const [sheet, gun, saat] = b.dataset.rmslot.split('|');
    try { await mutate('deleteSchedSlot', { sheet, gun, saat }); toast('Silindi'); go('sched'); } catch (e) { toast(e.message, 'err'); }
  });
  $('#content').querySelectorAll('[data-rmsheet]').forEach(b => b.onclick = async () => {
    if (!confirm('"' + b.dataset.rmsheet + '" programını silmek istiyor musunuz?')) return;
    try { await mutate('deleteSchedSheet', { sheet: b.dataset.rmsheet }); toast('Program silindi'); go('sched'); } catch (e) { toast(e.message, 'err'); }
  });
};

function schedSlotModal(sheet) {
  const gunler = ['PAZARTESİ', 'SALI', 'ÇARŞAMBA', 'PERŞEMBE', 'CUMA', 'CUMARTESİ', 'PAZAR'];
  openModal('Ders Ekle – ' + esc(sheet),
    `<div class="field"><label>Gün</label><select id="sgun">${gunler.map(g => `<option>${g}</option>`).join('')}</select></div>
    <div class="field"><label>Saat</label><input id="ssaat" placeholder="örn. 17.00-17.40"></div>
    <div class="field"><label>Ders</label><input id="sders" placeholder="örn. MATEMATİK"></div>
    <button class="btn btn-primary btn-block" id="sv">Kaydet</button>`);
  $('#sv').onclick = async () => {
    const saat = $('#ssaat').value.trim(); if (!saat) { toast('Saat gerekli', 'err'); return; }
    try {
      await mutate('setSchedSlot', { sheet, gun: $('#sgun').value, saat, ders: $('#sders').value.trim() });
      closeModal(); toast('Ders eklendi'); go('sched');
    } catch (e) { toast(e.message, 'err'); }
  };
}

VIEWS.audit = () => {
  const trAct = {
    login: 'Giriş', logout: 'Çıkış', addUser: 'Hesap ekleme', deleteUser: 'Hesap silme', setPassword: 'Şifre belirleme',
    changeOwnPassword: 'Şifre değiştirme', assignTeacher: 'Ders atama', setActive: 'Hesap durumu', addClass: 'Sınıf ekleme',
    addSubject: 'Ders ekleme', addStudent: 'Öğrenci ekleme', addHomework: 'Ödev sonucu', addExam: 'Sınav notu',
    addAssignment: 'Ödev verme', deleteHomework: 'Ödev silme', deleteExam: 'Sınav silme', deleteAssignment: 'Ödev silme',
    addPaymentRecord: 'Ödeme kaydı ekleme', addPayment: 'Tahsilat ekleme', setPaymentDue: 'Ücret düzenleme',
    deletePayment: 'Ödeme kaydı silme', deletePaymentInstallment: 'Tahsilat silme',
    addSchedSheet: 'Program ekleme', deleteSchedSheet: 'Program silme', setSchedSlot: 'Ders ekleme/düzenleme', deleteSchedSlot: 'Ders silme'
  };
  const rows = (STATE.audit || []).map(a => [
    esc((a.at || '').replace('T', ' ').slice(0, 19)), esc(a.by),
    esc(trAct[a.action] || a.action), esc(a.detail || '')]);
  return `<div class="panel"><div class="panel-head"><h3>İşlem Kayıtları <span class="muted">(son 120)</span></h3></div>
    ${tbl(['Zaman', 'Kullanıcı', 'İşlem', 'Ayrıntı'], rows)}</div>`;
};

VIEWS.pay = () => {
  const ps = STATE.payments || [];
  const totDue = ps.reduce((s, p) => s + (Number(p.odenecek) || 0), 0);
  const totPaid = ps.reduce((s, p) => s + (Number(p.odenen) || 0), 0);
  const totRem = ps.reduce((s, p) => s + (Number(p.kalan) || 0), 0);
  const rows = ps.map(p => {
    const kalan = Number(p.kalan) || 0;
    const durum = kalan <= 0 ? '<span class="badge ok">Tamamlandı</span>'
      : (Number(p.odenen) || 0) > 0 ? '<span class="badge warn">Kısmi</span>'
        : '<span class="badge err">Ödenmedi</span>';
    return [
      esc(p.isim || p.sheet || '-'),
      esc(p.sheet || ''),
      money(p.odenecek),
      money(p.odenen),
      '<b>' + money(p.kalan) + '</b>',
      esc(p.kayit || ''),
      durum,
      '<button class="btn btn-sm" data-paydet="' + p.id + '">Detay / Tahsilat</button> ' +
      '<button class="btn btn-sm btn-danger" data-paydel="' + p.id + '">Sil</button>'
    ];
  });
  return `<div class="cards">
    ${card('Öğrenci Sayısı', ps.length)}
    ${card('Toplam Ücret', money(totDue))}
    ${card('Tahsil Edilen', money(totPaid))}
    ${card('Kalan Alacak', money(totRem))}</div>
    <div class="panel"><div class="panel-head"><h3>Ödemeler</h3>
      <button class="btn btn-primary btn-sm" id="payAdd">+ Yeni Kayıt</button></div>
    ${tbl(['İsim', 'Program', 'Ödenecek', 'Ödenen', 'Kalan', 'Kayıt', 'Durum', 'İşlem'], rows)}</div>`;
};

wire.pay = () => {
  const b = $('#payAdd'); if (b) b.onclick = payAddModal;
  $('#content').querySelectorAll('[data-paydet]').forEach(x => x.onclick = () => payDetailModal(x.dataset.paydet));
  $('#content').querySelectorAll('[data-paydel]').forEach(x => x.onclick = () => payDelete(x.dataset.paydel));
};

function payAddModal() {
  openModal('Yeni Ödeme Kaydı',
    `<div class="field"><label>Öğrenci Adı Soyadı</label><input id="pisim"></div>
    <div class="field"><label>Program / Etiket <span class="muted">(isteğe bağlı)</span></label><input id="psheet" placeholder="örn. AHMET-7"></div>
    <div class="field"><label>Ödenecek Ücret (₺)</label><input id="pdue" type="number" min="0"></div>
    <div class="field"><label>Kayıt Tarihi</label><input id="pkayit" type="date"></div>
    <button class="btn btn-primary btn-block" id="sv">Ekle</button>`);
  $('#sv').onclick = async () => {
    const isim = $('#pisim').value.trim(); if (!isim) { toast('İsim gerekli', 'err'); return; }
    try {
      await mutate('addPaymentRecord', { isim, sheet: $('#psheet').value.trim(), odenecek: $('#pdue').value, kayit: $('#pkayit').value });
      closeModal(); toast('Kayıt eklendi'); go('pay');
    } catch (e) { toast(e.message, 'err'); }
  };
}

function payDetailModal(pid) {
  const p = (STATE.payments || []).find(x => x.id === pid); if (!p) return;
  const list = (p.odemeler || []).map((o, i) =>
    `<div class="sched-slot"><span>${esc(o.tarih || '-')}</span><b>${money(o.miktar)}</b>
       <button class="btn btn-sm btn-danger" data-rmpay="${i}">Sil</button></div>`).join('')
    || '<div class="empty">Henüz tahsilat yok</div>';

  const bodyHtml = `<div class="cards" style="margin-bottom:14px">
      ${card('Ödenecek', money(p.odenecek))}${card('Ödenen', money(p.odenen))}${card('Kalan', money(p.kalan))}</div>
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
      <div class="field"><label>Ödenecek Ücret (₺)</label><input id="edue" type="number" min="0" value="${Number(p.odenecek) || 0}"></div>
      <button class="btn btn-block" id="saveDue">Ücreti Kaydet</button>
    </div>`;

  openModal('Ödeme Detayı – ' + esc(p.isim || p.sheet), bodyHtml);

  const addInstBtn = $('#addInst');
  if (addInstBtn) {
    addInstBtn.onclick = async () => {
      const tarih = $('#ntar').value;
      const miktar = $('#nmik').value;
      if (!miktar) { toast('Lütfen bir tutar girin', 'err'); return; }
      try {
        await mutate('addPayment', { paymentId: pid, tarih, miktar: Number(miktar) });
        toast('Tahsilat eklendi');
        closeModal();
        await refresh();
        payDetailModal(pid);
      } catch (e) {
        toast(e.message, 'err');
      }
    };
  }

  const saveDueBtn = $('#saveDue');
  if (saveDueBtn) {
    saveDueBtn.onclick = async () => {
      try {
        await mutate('setPaymentDue', { paymentId: pid, odenecek: Number($('#edue').value) });
        toast('Ücret güncellendi');
        closeModal();
        await refresh();
        payDetailModal(pid);
      } catch (e) {
        toast(e.
