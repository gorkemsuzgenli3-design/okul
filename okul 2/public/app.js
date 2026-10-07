// LocalStorage Veri Yapısı ve Başlangıç Değerleri
const defaultData = {
    users: [
        { id: 1, username: 'admin', password: '123', role: 'admin', name: 'Yönetici' },
        { id: 2, username: 'ogretmen', password: '123', role: 'teacher', name: 'Ahmet Yılmaz' },
        { id: 3, username: 'ogrenci', password: '123', role: 'student', name: 'Ali Demir' }
    ],
    schedules: [
        { id: 1, day: 'Pazartesi', time: '09:00 - 10:30', class: '10-A', subject: 'Matematik', teacher: 'Ahmet Yılmaz' },
        { id: 2, day: 'Salı', time: '10:45 - 12:15', class: '11-B', subject: 'Fizik', teacher: 'Mehmet Kaya' }
    ],
    payments: [
        { id: 1, studentName: 'Ali Demir', amount: 1500, date: '2023-10-01', status: 'Ödendi' },
        { id: 2, studentName: 'Ayşe Can', amount: 2000, date: '2023-10-05', status: 'Bekliyor' }
    ]
};

function getData(key) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultData[key];
}

function saveData(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

document.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem('users')) saveData('users', defaultData.users);
    if (!localStorage.getItem('schedules')) saveData('schedules', defaultData.schedules);
    if (!localStorage.getItem('payments')) saveData('payments', defaultData.payments);

    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (currentUser) {
        showDashboard(currentUser);
    } else {
        showLoginForm();
    }
});

function handleLogin(event) {
    event.preventDefault();
    const username = event.target.username.value;
    const password = event.target.password.value;

    const users = getData('users');
    const user = users.find(u => u.username === username && u.password === password);

    if (user) {
        localStorage.setItem('currentUser', JSON.stringify(user));
        showDashboard(user);
    } else {
        alert('Kullanıcı adı veya şifre hatalı!');
    }
}

function handleLogout() {
    localStorage.removeItem('currentUser');
    location.reload();
}

function showDashboard(user) {
    const app = document.getElementById('app');
    
    app.innerHTML = `
        <header class="navbar">
            <h2>Avni Tokur Eğitim Paneli</h2>
            <div class="user-info">
                <span>Hoşgeldiniz, <strong>${user.name}</strong> (${user.role.toUpperCase()})</span>
                <button onclick="handleLogout()" class="btn-logout">Çıkış Yap</button>
            </div>
        </header>

        <div class="container">
            <nav class="sidebar">
                <button onclick="showTab('schedules')" class="tab-btn active">Ders Programı</button>
                <button onclick="showTab('payments')" class="tab-btn">Ödemeler</button>
            </nav>

            <main class="content">
                <div id="tab-schedules" class="tab-content active">
                    <div class="section-header">
                        <h3>Ders Programları</h3>
                        ${user.role === 'admin' ? '<button onclick="openScheduleModal()" class="btn-add">+ Ders Ekle</button>' : ''}
                    </div>
                    <div id="schedule-list"></div>
                </div>

                <div id="tab-payments" class="tab-content" style="display:none;">
                    <div class="section-header">
                        <h3>Ödeme Yönetimi</h3>
                        ${user.role === 'admin' ? '<button onclick="openPaymentModal()" class="btn-add">+ Ödeme Ekle</button>' : ''}
                    </div>
                    
                    <div class="stats-cards">
                        <div class="card card-green">
                            <h4>Toplam Tahsilat</h4>
                            <p id="stat-paid">0 TL</p>
                        </div>
                        <div class="card card-orange">
                            <h4>Bekleyen Ödemeler</h4>
                            <p id="stat-pending">0 TL</p>
                        </div>
                        <div class="card card-blue">
                            <h4>Genel Toplam</h4>
                            <p id="stat-total">0 TL</p>
                        </div>
                    </div>

                    <div id="payment-list"></div>
                </div>
            </main>
        </div>
    `;

    loadSchedules();
    loadPayments();
}

function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

    document.getElementById(`tab-${tabName}`).style.display = 'block';
    event.target.classList.add('active');
}

function loadSchedules() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const schedules = getData('schedules');
    const container = document.getElementById('schedule-list');

    let html = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Gün</th>
                    <th>Saat</th>
                    <th>Sınıf</th>
                    <th>Ders</th>
                    <th>Öğretmen</th>
                    ${currentUser.role === 'admin' ? '<th>İşlem</th>' : ''}
                </tr>
            </thead>
            <tbody>
    `;

    schedules.forEach(item => {
        html += `
            <tr>
                <td>${item.day}</td>
                <td>${item.time}</td>
                <td>${item.class}</td>
                <td>${item.subject}</td>
                <td>${item.teacher}</td>
                ${currentUser.role === 'admin' ? `
                    <td>
                        <button onclick="deleteSchedule(${item.id})" class="btn-delete">Sil</button>
                    </td>
                ` : ''}
            </tr>
        `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

function deleteSchedule(id) {
    if (confirm('Bu ders kaydını silmek istediğinize emin misiniz?')) {
        let schedules = getData('schedules');
        schedules = schedules.filter(s => s.id !== id);
        saveData('schedules', schedules);
        loadSchedules();
    }
}

function openScheduleModal() {
    const day = prompt("Gün:");
    const time = prompt("Saat (Örn: 09:00 - 10:00):");
    const className = prompt("Sınıf:");
    const subject = prompt("Ders Adı:");
    const teacher = prompt("Öğretmen:");

    if (day && time && subject) {
        const schedules = getData('schedules');
        schedules.push({ id: Date.now(), day, time, class: className, subject, teacher });
        saveData('schedules', schedules);
        loadSchedules();
    }
}

function loadPayments() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const payments = getData('payments');
    const container = document.getElementById('payment-list');

    let totalPaid = 0;
    let totalPending = 0;

    let html = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Öğrenci Adı</th>
                    <th>Tutar</th>
                    <th>Tarih</th>
                    <th>Durum</th>
                    ${currentUser.role === 'admin' ? '<th>İşlem</th>' : ''}
                </tr>
            </thead>
            <tbody>
    `;

    payments.forEach(item => {
        const amount = Number(item.amount);
        if (item.status === 'Ödendi') totalPaid += amount;
        else totalPending += amount;

        html += `
            <tr>
                <td>${item.studentName}</td>
                <td>${amount.toLocaleString('tr-TR')} TL</td>
                <td>${item.date}</td>
                <td><span class="badge ${item.status === 'Ödendi' ? 'bg-success' : 'bg-warning'}">${item.status}</span></td>
                ${currentUser.role === 'admin' ? `
                    <td>
                        <button onclick="togglePaymentStatus(${item.id})" class="btn-edit">Durum Değiştir</button>
                        <button onclick="deletePayment(${item.id})" class="btn-delete">Sil</button>
                    </td>
                ` : ''}
            </tr>
        `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;

    document.getElementById('stat-paid').innerText = totalPaid.toLocaleString('tr-TR') + ' TL';
    document.getElementById('stat-pending').innerText = totalPending.toLocaleString('tr-TR') + ' TL';
    document.getElementById('stat-total').innerText = (totalPaid + totalPending).toLocaleString('tr-TR') + ' TL';
}

function togglePaymentStatus(id) {
    let payments = getData('payments');
    const payment = payments.find(p => p.id === id);
    if (payment) {
        payment.status = payment.status === 'Ödendi' ? 'Bekliyor' : 'Ödendi';
        saveData('payments', payments);
        loadPayments();
    }
}

function deletePayment(id) {
    if (confirm('Bu ödeme kaydını silmek istediğinize emin misiniz?')) {
        let payments = getData('payments');
        payments = payments.filter(p => p.id !== id);
        saveData('payments', payments);
        loadPayments();
    }
}

function openPaymentModal() {
    const studentName = prompt("Öğrenci Adı Soyadı:");
    const amount = prompt("Tutar (TL):");
    const date = prompt("Tarih (YYYY-AA-GG):", new Date().toISOString().split('T')[0]);
    const status = confirm("Ödeme alındı mı? (Tamam = Ödendi, İptal = Bekliyor)") ? "Ödendi" : "Bekliyor";

    if (studentName && amount) {
        const payments = getData('payments');
        payments.push({ id: Date.now(), studentName, amount: Number(amount), date, status });
        saveData('payments', payments);
        loadPayments();
    }
}

function showLoginForm() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="login-container">
            <form onsubmit="handleLogin(event)" class="login-card">
                <h2>Avni Tokur Eğitim</h2>
                <p>Lütfen giriş yapın</p>
                <div class="form-group">
                    <label>Kullanıcı Adı</label>
                    <input type="text" name="username" required placeholder="admin / ogretmen / ogrenci">
                </div>
                <div class="form-group">
                    <label>Şifre</label>
                    <input type="password" name="password" required placeholder="123">
                </div>
                <button type="submit" class="btn-submit">Giriş Yap</button>
            </form>
        </div>
    `;
}
