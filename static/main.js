// Espera a que la página cargue
document.addEventListener('DOMContentLoaded', () => {

    // --- 1. DEFINICIÓN DE ELEMENTOS ---
    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');

    const formLogin = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');

    const showRegisterBtn = document.getElementById('show-register');
    const showLoginBtn = document.getElementById('show-login');
    const showLoginDiv = document.getElementById('show-login-div');

    const btnLogout = document.getElementById('btn-logout');

    const userEmailEl = document.getElementById('user-email');
    const loginErrorEl = document.getElementById('login-error');
    const registerErrorEl = document.getElementById('register-error');

    // --- Variables de la App (Mapa, etc.) ---
    let map = null;
    let marcadorTemporal = null;

    // --- 2. LÓGICA DE VISTAS (Mostrar/Ocultar) ---

    // Muestra la App (mapa) y oculta el Login
    function showApp(user) {
        authContainer.classList.add('hidden');
        appContainer.classList.remove('hidden');
        userEmailEl.textContent = user.email; // Muestra el email del usuario

        // Inicializa el mapa SÓLO si no ha sido inicializado
        if (!map) {
            initializeMap();
            cargarArboles();
            cargarStats();
        }
    }

    // Muestra el Login y oculta la App
    function showAuth() {
        authContainer.classList.remove('hidden');
        appContainer.classList.add('hidden');
        userEmailEl.textContent = '';
        // Si el mapa existe, lo removemos para evitar errores
        if (map) {
            map.remove();
            map = null;
        }
    }

    // Muestra el formulario de Registro
    function showRegisterForm() {
        formLogin.classList.add('hidden');
        showRegisterBtn.parentElement.classList.add('hidden'); // Oculta "¿No tienes cuenta?"

        formRegister.classList.remove('hidden');
        showLoginDiv.classList.remove('hidden');
    }

    // Muestra el formulario de Login
    function showLoginForm() {
        formLogin.classList.remove('hidden');
        showRegisterBtn.parentElement.classList.remove('hidden');

        formRegister.classList.add('hidden');
        showLoginDiv.classList.add('hidden');
    }

    // --- 3. LÓGICA DE AUTENTICACIÓN (API) ---

    // (A) Manejar Registro
    formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();
        registerErrorEl.classList.add('hidden'); // Oculta errores previos

        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;

        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            alert('¡Registro exitoso! Por favor, inicia sesión.');
            formRegister.reset();
            showLoginForm();
        } else {
            console.error('Error de registro:', data.error);
            registerErrorEl.textContent = data.error.includes("User already registered") ? "El email ya está registrado." : "Error al registrar.";
            registerErrorEl.classList.remove('hidden');
        }
    });

    // (B) Manejar Login
    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginErrorEl.classList.add('hidden'); // Oculta errores previos

        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            // ¡ÉXITO! Guardamos la sesión y mostramos la app
            console.log("Sesión iniciada:", data.user);
            showApp(data.user);
        } else {
            console.error('Error de login:', data.error);
            loginErrorEl.textContent = "Email o contraseña incorrectos.";
            loginErrorEl.classList.remove('hidden');
        }
    });

    // (C) Manejar Logout
    btnLogout.addEventListener('click', () => {
        // Limpiamos la vista y volvemos al login
        showAuth();
        formLogin.reset();
        registerErrorEl.classList.add('hidden');
        loginErrorEl.classList.add('hidden');
    });

    // (D) Manejar botones de cambio de vista
    showRegisterBtn.addEventListener('click', showRegisterForm);
    showLoginBtn.addEventListener('click', showLoginForm);


    // --- 4. LÓGICA DE LA APLICACIÓN (MAPA Y FORMULARIOS) ---
    // (El código que ya teníamos, pero metido en funciones)

    function initializeMap() {
        const centerManabi = [-0.9338, -80.4530];
        map = L.map('map').setView(centerManabi, 13);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(map);

        // Manejar Clic en el Mapa
        map.on('click', (e) => {
            const lat = e.latlng.lat;
            const lng = e.latlng.lng;

            document.getElementById('latitud').value = lat.toFixed(6);
            document.getElementById('longitud').value = lng.toFixed(6);

            if (marcadorTemporal) {
                marcadorTemporal.setLatLng(e.latlng);
            } else {
                marcadorTemporal = L.marker(e.latlng, { draggable: true }).addTo(map);
            }
        });
    }

    async function cargarArboles() {
        const response = await fetch('/api/obtener_arboles'); 
        const arboles = await response.json();

        arboles.forEach(arbol => {
            L.marker([arbol.latitud, arbol.longitud]).addTo(map)
                .bindPopup(`<b>Especie:</b> ${arbol.especie}`);
        });
    }

    async function cargarStats() {
        const response = await fetch('/api/predecir_horas'); 
        const stats = await response.json();

        document.getElementById('stat-arboles').textContent = stats.arboles_totales;
        document.getElementById('stat-horas').textContent = stats.horas_estimadas.toFixed(1);
    }

    document.getElementById('form-plantar').addEventListener('submit', async (e) => {
        e.preventDefault(); 

        const especie = document.getElementById('especie').value;
        const latitud = document.getElementById('latitud').value;
        const longitud = document.getElementById('longitud').value;

        if (!especie || !latitud || !longitud) {
            alert('Por favor, complete la especie y seleccione un punto en el mapa.');
            return;
        }

        const datosArbol = {
            especie: especie,
            latitud: parseFloat(latitud),
            longitud: parseFloat(longitud)
        };

        const response = await fetch('/api/plantar_arbol', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datosArbol)
        });

        if (response.ok) {
            alert('¡Árbol plantado con éxito!');
            document.getElementById('form-plantar').reset();
            L.marker([latitud, longitud]).addTo(map).bindPopup(`<b>Especie:</b> ${especie}`);
            marcadorTemporal.remove();
            marcadorTemporal = null;
            cargarStats();
        } else {
            alert('Error al plantar el árbol.');
        }
    });

    // --- 5. VERIFICACIÓN INICIAL DE SESIÓN ---
    // Por defecto, siempre mostramos el login al cargar.
    showAuth(); 

});