document.addEventListener('DOMContentLoaded', () => {

    // --- 1. DEFINICIÓN DE ELEMENTOS ---
    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');
    const authTitle = document.getElementById('auth-title');
    const formLogin = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');
    const formForgotPassword = document.getElementById('form-forgot-password');
    const formUpdatePassword = document.getElementById('form-update-password');
    const showRegisterBtn = document.getElementById('show-register');
    const registerLink = document.getElementById('register-link');
    const showLoginBtn = document.getElementById('show-login');
    const showLoginDiv = document.getElementById('show-login-div');
    const showForgotPasswordBtn = document.getElementById('show-forgot-password');
    const btnLogout = document.getElementById('btn-logout');
    const userEmailEl = document.getElementById('user-email');
    const welcomeUserNameEl = document.getElementById('welcome-user-name'); 
    const loginErrorEl = document.getElementById('login-error');
    const registerErrorEl = document.getElementById('register-error');
    const forgotErrorEl = document.getElementById('forgot-error');
    const forgotSuccessEl = document.getElementById('forgot-success');
    const updateErrorEl = document.getElementById('update-error');
    const sidebarLinks = document.querySelectorAll('.sidebar-link');
    const pageContents = document.querySelectorAll('.page-content');
    const tableBody = document.getElementById('table-body');
    
    // --- CAMBIO: Eliminamos los selects de fecha que no existen ---
    // const birthDaySelect = ... (eliminado)
    // const birthMonthSelect = ... (eliminado)
    // const birthYearSelect = ... (eliminado)
    
    let map = null;
    let marcadorTemporal = null;
    let currentAccessToken = null;

    // Puntos de Reforestación y Icono
    const puntosReforestacion = [
        { nombre: "Parque Forestal", coords: [-0.9575, -80.7100], info: "Zona prioritaria cerca del río." },
        { nombre: "Playa El Murciélago (Extremo Norte)", coords: [-0.9410, -80.7450], info: "Área para vegetación costera." },
        { nombre: "Cerro Montecristi (Base)", coords: [-0.9980, -80.6550], info: "Ideal para especies nativas." }
    ];
    const greenIcon = new L.Icon({ 
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
    });


    // --- 2. LÓGICA DE VISTAS ---

    function hideAllAuthForms() { 
        formLogin.classList.add('hidden'); formRegister.classList.add('hidden'); formForgotPassword.classList.add('hidden'); formUpdatePassword.classList.add('hidden'); registerLink.classList.add('hidden'); showLoginDiv.classList.add('hidden');
    }
    function showApp(user) { 
        authContainer.classList.add('hidden'); appContainer.classList.remove('hidden'); userEmailEl.textContent = user.email; welcomeUserNameEl.textContent = user.name || user.email.split('@')[0]; showPage('page-map'); loadTableData(); cargarStats(); 
    }
    function showAuth() { 
         authContainer.classList.remove('hidden'); appContainer.classList.add('hidden'); userEmailEl.textContent = ''; welcomeUserNameEl.textContent = 'Usuario'; if (map) { map.remove(); map = null; } showLoginForm(); 
    }
    function showRegisterForm() { 
         hideAllAuthForms(); authTitle.textContent = "Crea tu cuenta"; formRegister.classList.remove('hidden'); showLoginDiv.classList.remove('hidden'); 
    }
    function showLoginForm() { 
         hideAllAuthForms(); authTitle.textContent = "Bienvenido. Por favor, inicia sesión."; formLogin.classList.remove('hidden'); registerLink.classList.remove('hidden'); 
    }
    function showForgotPasswordForm() { 
         hideAllAuthForms(); authTitle.textContent = "Recuperar Contraseña"; formForgotPassword.classList.remove('hidden'); showLoginDiv.classList.remove('hidden'); 
    }
    function showUpdatePasswordForm() { 
         hideAllAuthForms(); authTitle.textContent = "Crea tu nueva contraseña"; formUpdatePassword.classList.remove('hidden'); 
    }
    function showPage(pageId) { 
        pageContents.forEach(page => page.classList.add('hidden')); const pageToShow = document.getElementById(pageId); if (pageToShow) { pageToShow.classList.remove('hidden'); } if (pageId === 'page-map' && !map) { initializeMap(); cargarArboles(); } sidebarLinks.forEach(link => { link.classList.toggle('sidebar-active', link.dataset.page === pageId); link.classList.toggle('text-white', link.dataset.page === pageId); });
    }
    
    // --- CAMBIO: Eliminamos las funciones de fecha que no se usan ---
    // function populateDays() { ... } (eliminada)
    // function populateYears() { ... } (eliminada)

    // --- 3. LÓGICA DE AUTENTICACIÓN (API) ---

    // --- ¡¡AQUÍ ESTÁ LA CORRECCIÓN!! ---
    formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();
        registerErrorEl.classList.add('hidden');
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const name = document.getElementById('register-name').value; 
        
        // Lee el valor directamente del <input type="date">
        const birthdate = document.getElementById('register-birth-date').value;

        // Valida que la fecha no esté vacía
        if (!birthdate) {
            registerErrorEl.textContent = "Por favor, selecciona tu fecha de nacimiento.";
            registerErrorEl.classList.remove('hidden');
            return; 
        }
        // --- FIN DE LA CORRECCIÓN ---

        const response = await fetch('/api/register', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ email, password, name, birthdate }) // Envía la fecha leída
        });
        const data = await response.json();

        if (response.ok) {
            alert('¡Registro exitoso! Revisa tu email para confirmar y luego inicia sesión.');
            formRegister.reset(); showLoginForm();
        } else {
            console.error('Error de registro:', data.error); registerErrorEl.textContent = data.error.includes("already registered") ? "Email ya registrado." : "Error al registrar."; registerErrorEl.classList.remove('hidden');
        }
    });

    formLogin.addEventListener('submit', async (e) => { 
        e.preventDefault(); loginErrorEl.classList.add('hidden'); const email = document.getElementById('login-email').value; const password = document.getElementById('login-password').value; const response = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }); const data = await response.json(); if (response.ok) { console.log("Sesión iniciada:", data.user); showApp(data.user); } else { console.error('Error de login:', data.error); loginErrorEl.textContent = "Email o contraseña incorrectos."; loginErrorEl.classList.remove('hidden'); }
    });

    btnLogout.addEventListener('click', () => { 
         currentAccessToken = null; showAuth(); formLogin.reset(); registerErrorEl.classList.add('hidden'); loginErrorEl.classList.add('hidden'); 
    });
    showRegisterBtn.addEventListener('click', showRegisterForm);
    showLoginBtn.addEventListener('click', showLoginForm);
    showForgotPasswordBtn.addEventListener('click', showForgotPasswordForm);

    formForgotPassword.addEventListener('submit', async (e) => { 
        e.preventDefault(); forgotErrorEl.classList.add('hidden'); forgotSuccessEl.classList.add('hidden'); const email = document.getElementById('forgot-email').value; const response = await fetch('/api/forgot_password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }); if (response.ok) { forgotSuccessEl.textContent = "Correo enviado."; forgotSuccessEl.classList.remove('hidden'); formForgotPassword.reset(); } else { forgotErrorEl.textContent = "Error al enviar."; forgotErrorEl.classList.remove('hidden'); }
    });

    formUpdatePassword.addEventListener('submit', async (e) => { 
        e.preventDefault(); updateErrorEl.classList.add('hidden'); const new_password = document.getElementById('update-password').value; if (!currentAccessToken) { updateErrorEl.textContent = "Token inválido."; updateErrorEl.classList.remove('hidden'); return; } const response = await fetch('/api/update_password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ access_token: currentAccessToken, new_password }) }); if (response.ok) { alert("Contraseña actualizada. Inicia sesión."); currentAccessToken = null; showLoginForm(); } else { updateErrorEl.textContent = "Error al actualizar."; updateErrorEl.classList.remove('hidden'); }
    });


    // --- 4. LÓGICA DE LA APLICACIÓN (MAPA Y FORMULARIOS) ---

    sidebarLinks.forEach(link => { link.addEventListener('click', () => showPage(link.dataset.page)); });

    function initializeMap() { 
        const centerManta = [-0.958, -80.714]; map = L.map('map').setView(centerManta, 13); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map); puntosReforestacion.forEach(punto => { L.marker(punto.coords, { icon: greenIcon }).addTo(map).bindPopup(`<b>${punto.nombre}</b><br>${punto.info}`); }); map.on('click', (e) => { const lat = e.latlng.lat; const lng = e.latlng.lng; document.getElementById('latitud').value = lat.toFixed(6); document.getElementById('longitud').value = lng.toFixed(6); if (marcadorTemporal) { marcadorTemporal.setLatLng(e.latlng); } else { marcadorTemporal = L.marker(e.latlng, { draggable: true }).addTo(map); } });
    }

    async function cargarArboles() { 
        const response = await fetch('/api/obtener_arboles'); const arboles = await response.json(); if (!map) return; arboles.forEach(arbol => { L.marker([arbol.latitud, arbol.longitud]).addTo(map).bindPopup(`<b>Especie:</b> ${arbol.especie}`); });
    }

    async function cargarStats() { 
        const response = await fetch('/api/predecir_horas'); const stats = await response.json(); document.getElementById('stat-arboles').textContent = stats.arboles_totales; document.getElementById('stat-horas').textContent = stats.horas_estimadas.toFixed(1);
f    }
    
    async function loadTableData() { 
        try { const response = await fetch('/api/obtener_arboles'); const arboles = await response.json(); tableBody.innerHTML = ''; if (arboles.length === 0) { tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4">No hay árboles registrados.</td></tr>'; return; } arboles.forEach(arbol => { const fecha = new Date(arbol.fecha_siembra).toLocaleString('es-ES'); const fila = `<tr class="hover:bg-gray-50"><td class"px-6 py-4 ...">${arbol.id}</td><td class="px-6 py-4 ...">${arbol.especie}</td><td class="px-6 py-4 ...">${arbol.latitud.toFixed(6)}</td><td class="px-6 py-4 ...">${arbol.longitud.toFixed(6)}</td><td class="px-6 py-4 ...">${fecha}</td></tr>`; tableBody.innerHTML += fila; }); } catch (error) { console.error("Error al cargar la tabla:", error); tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-red-600">Error al cargar datos.</td></tr>'; }
    }

    document.getElementById('form-plantar').addEventListener('submit', async (e) => { 
        e.preventDefault(); const especie = document.getElementById('especie').value; const latitud = document.getElementById('latitud').value; const longitud = document.getElementById('longitud').value; if (!especie || !latitud || !longitud) { alert('Completa la especie y selecciona un punto.'); return; } const datosArbol = { especie: especie, latitud: parseFloat(latitud), longitud: parseFloat(longitud) }; const response = await fetch('/api/plantar_arbol', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datosArbol) }); if (response.ok) { alert('Árbol plantado.'); document.getElementById('form-plantar').reset(); L.marker([latitud, longitud]).addTo(map).bindPopup(`<b>Especie:</b> ${especie}`); if (marcadorTemporal) { marcadorTemporal.remove(); marcadorTemporal = null; } cargarStats(); loadTableData(); } else { alert('Error al plantar.'); }
    });

    // --- 5. INICIO DE LA APP ---
    
    function checkUrlForToken() { 
        const hash = window.location.hash.substring(1); if (hash) { const params = new URLSearchParams(hash); const accessToken = params.get('access_token'); const type = params.get('type'); if (type === 'recovery' && accessToken) { currentAccessToken = accessToken; showUpdatePasswordForm(); } else { window.history.pushState("", document.title, window.location.pathname + window.location.search); showAuth(); } } else { showAuth(); }
tran  }
    
    // --- CAMBIO: Eliminamos las llamadas a las funciones de fecha ---
    // populateDays(); (eliminada)
    // populateYears(); (eliminada)
    
    // Inicia la verificación de token (como antes)
    checkUrlForToken();

});