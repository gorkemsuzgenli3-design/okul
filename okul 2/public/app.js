function payDetailModal(pid){
  const p=(STATE.payments||[]).find(x=>x.id===pid);
  if(!p) return;

  const list=(p.odemeler||[]).map((o,i)=>
    `<div class="sched-slot">
      <span>${esc(o.tarih||'-')}</span>
      <b>${money(o.miktar)}</b>
      <button class="btn btn-sm btn-danger" data-rmpay="${i}">Sil</button>
    </div>`
  ).join('') || '<div class="empty">Henüz tahsilat yok</div>';

  openModal('Ödeme Detayı – '+esc(p.isim||p.sheet),
   `<div class="cards" style="margin-bottom:14px">
      ${card('Ödenecek',money(p.odenecek))}
      ${card('Ödenen',money(p.odenen))}
      ${card('Kalan',money(p.kalan))}
    </div>

    <div class="panel" style="padding:12px">
      <div class="panel-head">
        <h3 style="font-size:.95rem">Tahsilat Geçmişi</h3>
      </div>
      <div class="sched">${list}</div>
    </div>

    <div class="panel" style="padding:12px;margin-top:12px">
      <div class="panel-head">
        <h3 style="font-size:.95rem">Yeni Tahsilat Ekle</h3>
      </div>

      <div class="field">
        <label>Tarih</label>
        <input id="ntar" type="date">
      </div>

      <div class="field">
        <label>Tutar (₺)</label>
        <input id="nmik" type="number" min="0" step="0.01" placeholder="Örn. 1000">
      </div>

      <button class="btn btn-primary btn-block" id="addInst">
        Tahsilat Ekle
      </button>
    </div>

    <div class="panel" style="padding:12px;margin-top:12px">
      <div class="panel-head">
        <h3 style="font-size:.95rem">Toplam Ücreti Düzenle</h3>
      </div>

      <div class="field">
        <label>Ödenecek Ücret (₺)</label>
        <input id="edue"
               type="number"
               min="0"
               step="0.01"
               value="${Number(p.odenecek)||0}">
      </div>

      <button class="btn btn-block" id="saveDue">
        Ücreti Kaydet
      </button>
    </div>`
  );

  /* =========================
     TAHSİLAT EKLE
     ========================= */

  const tarihInput=$('#ntar');
  const miktarInput=$('#nmik');
  const addButton=$('#addInst');

  // Tarihi otomatik bugün yap
  if(tarihInput && !tarihInput.value){
    tarihInput.value=new Date().toISOString().slice(0,10);
  }

  addButton.onclick=async()=>{

    const tarih=tarihInput.value.trim();
    const miktar=Number(miktarInput.value);

    // Tarih kontrolü
    if(!tarih){
      toast('Tahsilat tarihi gerekli','err');
      tarihInput.focus();
      return;
    }

    // Tutar kontrolü
    if(!Number.isFinite(miktar) || miktar<=0){
      toast('Geçerli bir tahsilat tutarı girin','err');
      miktarInput.focus();
      return;
    }

    // Güncel kalan borç
    const kalan=Number(p.kalan)||0;

    // Borç kapalıysa
    if(kalan<=0){
      toast('Bu öğrencinin borcu zaten kapatılmış','err');
      return;
    }

    // Fazla ödeme kontrolü
    if(miktar>kalan){
      toast(
        'Tahsilat tutarı kalan borçtan fazla olamaz. Kalan: '+money(kalan),
        'err'
      );
      miktarInput.focus();
      return;
    }

    // Butonu kilitle
    addButton.disabled=true;
    addButton.textContent='Kaydediliyor...';

    try{

      await mutate('addPayment',{
        paymentId:pid,
        tarih:tarih,
        miktar:miktar
      });

      toast('Tahsilat başarıyla eklendi');

      closeModal();

      // Ödeme listesini yenile
      await refresh();

    }catch(e){

      toast(
        e.message || 'Tahsilat kaydedilemedi',
        'err'
      );

      addButton.disabled=false;
      addButton.textContent='Tahsilat Ekle';
    }
  };


  /* =========================
     ÜCRET GÜNCELLE
     ========================= */

  $('#saveDue').onclick=async()=>{

    const odenecek=Number($('#edue').value);

    if(!Number.isFinite(odenecek) || odenecek<0){
      toast('Geçerli bir ücret girin','err');
      return;
    }

    try{

      await mutate('setPaymentDue',{
        paymentId:pid,
        odenecek:odenecek
      });

      toast('Ücret güncellendi');

      closeModal();

      await refresh();

    }catch(e){

      toast(
        e.message || 'Ücret güncellenemedi',
        'err'
      );
    }
  };


  /* =========================
     TAHSİLAT SİL
     ========================= */

  $('#modalBody')
    .querySelectorAll('[data-rmpay]')
    .forEach(btn=>{

      btn.onclick=async()=>{

        if(!confirm(
          'Bu tahsilat kaydını silmek istiyor musunuz?'
        )){
          return;
        }

        try{

          await mutate('deletePaymentInstallment',{
            paymentId:pid,
            index:Number(btn.dataset.rmpay)
          });

          toast('Tahsilat silindi');

          closeModal();

          await refresh();

        }catch(e){

          toast(
            e.message || 'Tahsilat silinemedi',
            'err'
          );
        }
      };

    });
}
