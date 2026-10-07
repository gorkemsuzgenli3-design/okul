document.addEventListener('DOMContentLoaded', function() {
    // Örnek Veriler
    let schedules = [
        { id: 1, day: 'Pazartesi', time: '09:00 - 10:30', class: '10-A', subject: 'Matematik', teacher: 'Ahmet Yılmaz' },
        { id: 2, day: 'Salı', time: '10:45 - 12:15', class: '11-B', subject: 'Fizik', teacher: 'Mehmet Kaya' }
    ];

    let payments = [
        { id: 1, student: 'Ali Yılmaz', class: '10-A', amount: '1.500 TL', status: 'Ödendi' },
        { id: 2, student: 'Ayşe Demir', class: '11-B', amount: '1.500 TL', status: 'Bekliyor' },
        { id: 3, student: 'Can Öztürk', class: '10-A', amount: '1.500 TL', status: 'Gecikmede' }
    ];

    // Eleman Tanımlamaları
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const addScheduleBtn = document.getElementById('add-schedule-btn');
    const navBtns = document.querySelectorAll('.nav-btn');

    // Giriş Kontrolü
    if (loginBtn) {
        loginBtn.addEventListener('click', function() {
            const k = document.getElementById('username').value.trim();
            const s = document.getElementById('password').value.trim();

            if (k === 'admin' && s === '123') {
                document.getElementById('login-view').style.display = 'none';
                document.getElementById('dashboard-view').style.display = 'block';
                renderSchedules();
                renderPayments();
            } else {
                alert('Girdiğiniz bilgiler yanlış!\n\nKullanıcı adı: admin\nŞifre: 123');
            }
        });
    }

    // Çıkış
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            document.getElementById('dashboard-view').style.display = 'none';
            document.getElementById('login-view').style.display = 'flex';
            document.getElementById('username').value = '';
            document.getElementById('password').value = '';
        });
    }

    // Sekme Geçişleri
    navBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            navBtns.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

            this.classList.add('active');
            const targetTab = this.getAttribute('data-tab');
            document.getElementById(targetTab).classList.add('active');
        });
    });

    // Ders Programını Listeleme
    function renderSchedules() {
        const tbody = document.getElementById('schedule-list');
        tbody.innerHTML = '';
        schedules.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${item.day}</strong></td>
                <td>${item.time}</td>
                <td>${item.class}</td>
                <td>${item.subject}</td>
                <td>${item.teacher}</td>
                <td><button class="btn btn-danger" style="padding:4px 8px; font-size:12px;" onclick="deleteSchedule(${item.id})">Sil</button></td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Ders Ekleme
    if (addScheduleBtn) {
        addScheduleBtn.addEventListener('click', function() {
            const day = document.getElementById('sched-day').value;
            const time = document.getElementById('sched-time').value;
            const cls = document.getElementById('sched-class').value;
            const subject = document.getElementById('sched-subject').value;
            const teacher = document.getElementById('sched-teacher').value;

            if (!day || !time || !cls || !subject) {
                alert('Lütfen alanları doldurun.');
                return;
            }

            schedules.push({ id: Date.now(), day, time, class: cls, subject, teacher });
            renderSchedules();

            // Temizle
            document.getElementById('sched-day').value = '';
            document.getElementById('sched-time').value = '';
            document.getElementById('sched-class').value = '';
            document.getElementById('sched-subject').value = '';
            document.getElementById('sched-teacher').value = '';
        });
    }

    // Ders Silme Fonksiyonunu Global Yap
    window.deleteSchedule = function(id) {
        schedules = schedules.filter(s => s.id !== id);
        renderSchedules();
    };

    // Ödemeleri Listeleme
    function renderPayments() {
        const tbody = document.getElementById('payments-list');
        tbody.innerHTML = '';
        payments.forEach(item => {
            let badgeClass = 'badge-warning';
            if (item.status === 'Ödendi') badgeClass = 'badge-success';
            if (item.status === 'Gecikmede') badgeClass = 'badge-danger';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${item.student}</strong></td>
                <td>${item.class}</td>
                <td>${item.amount}</td>
                <td><span class="badge ${badgeClass}">${item.status}</span></td>
                <td>
                    <select onchange="updatePaymentStatus(${item.id}, this.value)">
                        <option value="Bekliyor" ${item.status==='Bekliyor'?'selected':''}>Bekliyor</option>
                        <option value="Ödendi" ${item.status==='Ödendi'?'selected':''}>Ödendi</option>
                        <option value="Gecikmede" ${item.status==='Gecikmede'?'selected':''}>Gecikmede</option>
                    </select>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Ödeme Durumu Güncelleme Fonksiyonunu Global Yap
    window.updatePaymentStatus = function(id, newStatus) {
        const p = payments.find(item => item.id === id);
        if (p) {
            p.status = newStatus;
            renderPayments();
        }
    };
});
