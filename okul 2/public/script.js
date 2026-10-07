document.addEventListener('DOMContentLoaded', function() {
    var loginBtn = document.getElementById('login-btn');
    var logoutBtn = document.getElementById('logout-btn');

    if (loginBtn) {
        loginBtn.addEventListener('click', function() {
            var k = document.getElementById('username').value.trim();
            var s = document.getElementById('password').value.trim();

            if (k === 'admin' && s === '123') {
                document.getElementById('login-view').style.display = 'none';
                document.getElementById('dashboard-view').style.display = 'block';
            } else {
                alert('Girdiğiniz bilgiler yanlış!\n\nKullanıcı adı: admin\nŞifre: 123');
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            document.getElementById('dashboard-view').style.display = 'none';
            document.getElementById('login-view').style.display = 'flex';
            document.getElementById('username').value = '';
            document.getElementById('password').value = '';
        });
    }
});
