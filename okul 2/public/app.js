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

// Verileri Yükle
function getData(key) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultData[key];
}

// Verileri Kaydet
function saveData(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

// Uygulama Başlangıç Kontrolü
document.addEventListener('DOMContentLoaded', () => {
    // Varsayılan verileri doldur
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

// Giriş İşlemi
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

// Çıkış İşlemi
function handleLogout() {
    localStorage.removeItem('currentUser');
    location.reload();
}

// Dashboard Gösterimi
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
                <button onclick
