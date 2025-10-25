// Espera a que la página cargue
document.addEventListener('DOMContentLoaded', () => {

    // --- 1. DEFINICIÓN DE ELEMENTOS ---
    
    // Contenedores principales
    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');
    const authTitle = document.getElementById('auth-title');
    
    // Formularios Auth
    const formLogin = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');
    const formForgotPassword = document.getElementById('form-forgot-password');
    const formUpdatePassword = document.getElementById('form-update-password');
    
    // Botones Auth
    const showRegisterBtn = document.getElementById('show-register');
    const registerLink = document.getElementById('register-link');
    const showLoginBtn = document.getElementById('show-login');
    const showLoginDiv = document.getElementById('show-login-div');
    const showForgotPasswordBtn = document.getElementById('show-forgot-password');
    const btnLogout = document.getElementById('btn-logout');
    
    // Elementos UI Auth
    const userEmailEl = document.getElementById('user-email');
    const loginErrorEl = document.getElementById('login-error');
    const registerErrorEl = document.getElementById('register-error');
    const forgotErrorEl = document.getElementById('forgot-error');
    const forgotSuccessEl = document.getElementById('forgot-success');
    const updateErrorEl = document.getElementById('update-error');

    // Elementos del Dashboard
    const sidebarLinkMap = document.getElementById('sidebar-link-map');
    const sidebarLinkTable = document.getElementById('sidebar-link-table');
    
    const pageMap = document.getElementById('page-map');
    const pageTable = document.getElementById('page-table');
    const tableBody = document.getElementById('table-body');
    
    // Variables de la App (Mapa, etc.)
    let map = null;
    let marcadorTemporal = null;
    let currentAccessToken = null; // Para guardar el token de reseteo

    // --- 2. LÓGICA DE VISTAS (Mostrar/Ocultar) ---

    // Oculta todos los formularios de autenticación
    function hideAllAuthForms() {
        formLogin.classList.add('hidden');
        formRegister.classList.add('hidden');
        formForgotPassword.classList.add('hidden');
        formUpdatePassword.classList.add('hidden');
        registerLink.classList.add('hidden');
        showLoginDiv.classList.add('hidden');
    }

    // Muestra la App (mapa) y oculta el Login
    function showApp(user) {
        authContainer.classList.add('hidden');
        appContainer.classList.remove('hidden');
        userEmailEl.textContent = user.email; // Muestra el email del usuario
        
        showPage('page-map');
        loadTableData();
        cargarStats(); 
    }

    // Muestra el Login y oculta la App
    function showAuth() {
        authContainer.classList.remove('hidden');
        appContainer.classList.add('hidden');
        userEmailEl.textContent = '';
        if (map) {
            map.remove();
            map = null;
        }
        showLoginForm(); // Muestra el formulario de login por defecto
    }

    // Muestra el formulario de Registro
    function showRegisterForm() {
        hideAllAuthForms();
        authTitle.textContent = "Crea tu cuenta";
        formRegister.classList.remove('hidden');
        showLoginDiv.classList.remove('hidden');
    }

    // Muestra el formulario de Login
    function showLoginForm() {
        hideAllAuthForms();
        authTitle.textContent = "Bienvenido. Por favor, inicia sesión.";
        formLogin.classList.remove('hidden');
        registerLink.classList.remove('hidden');
    }

    // Muestra el formulario de Olvidé Contraseña
    function showForgotPasswordForm() {
        hideAllAuthForms();
        authTitle.textContent = "Recuperar Contraseña";
        formForgotPassword.classList.remove('hidden');
        showLoginDiv.classList.remove('hidden');
    }

    // Muestra el formulario de Actualizar Contraseña
    function showUpdatePasswordForm() {
        hideAllAuthForms();
        authTitle.textContent = "Crea tu nueva contraseña";
        formUpdatePassword.classList.remove('hidden');
    }

    // --- 3. LÓGICA DE AUTENTICACIÓN (API) ---

    // (A) Manejar Registro
    formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();
        registerErrorEl.classList.add('hidden');
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;

        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();

        if (response.ok) {
            alert('¡Registro exitoso! Revisa tu email para confirmar la cuenta y luego inicia sesión.');
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
        loginErrorEl.classList.add('hidden');
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        
        if (response.ok) {
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
        currentAccessToken = null; // Olvida el token de reseteo
        showAuth();
        formLogin.reset();
        registerErrorEl.classList.add('hidden');
        loginErrorEl.classList.add('hidden');
    });

    // (D) Botones de cambio de vista
    showRegisterBtn.addEventListener('click', showRegisterForm);
    showLoginBtn.addEventListener('click', showLoginForm);
    showForgotPasswordBtn.addEventListener('click', showForgotPasswordForm);

    // (E) NUEVO: Manejar "Olvidé Contraseña"
    formForgotPassword.addEventListener('submit', async (e) => {
        e.preventDefault();
        forgotErrorEl.classList.add('hidden');
        forgotSuccessEl.classList.add('hidden');

        const email = document.getElementById('forgot-email').value;
        
        const response = await fetch('/api/forgot_password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        
        if (response.ok) {
            forgotSuccessEl.textContent = "Correo enviado. Revisa tu bandeja de entrada.";
            forgotSuccessEl.classList.remove('hidden');
            formForgotPassword.reset();
        } else {
            forgotErrorEl.textContent = "Error al enviar el correo.";
            forgotErrorEl.classList.remove('hidden');
        }
    });

    // (F) NUEVO: Manejar "Actualizar Contraseña"
    formUpdatePassword.addEventListener('submit', async (e) => {
        e.preventDefault();
        updateErrorEl.classList.add('hidden');

        const new_password = document.getElementById('update-password').value;

        if (!currentAccessToken) {
            updateErrorEl.textContent = "Token inválido o expirado. Vuelve a pedir un correo de recuperación.";
            updateErrorEl.classList.remove('hidden');
            return;
        }

        const response = await fetch('/api/update_password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: currentAccessToken, new_password })
        });

        if (response.ok) {
            alert("¡Contraseña actualizada con éxito! Por favor, inicia sesión.");
            currentAccessToken = null; // Limpia el token
            showLoginForm();
        } else {
            updateErrorEl.textContent = "Error al actualizar la contraseña.";
            updateErrorEl.classList.remove('hidden');
        }
    });


    // --- 4. LÓGICA DE LA APLICACIÓN (MAPA Y FORMULARIOS) ---

    // (Manejar navegación del Sidebar)
    sidebarLinkMap.addEventListener('click', () => showPage('page-map'));
    sidebarLinkTable.addEventListener('click', () => showPage('page-table'));

    function initializeMap() {
        const centerManabi = [-0.9338, -80.4530];
        map = L.map('map').setView(centerManabi, 13);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(map);

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
        if (!map) return;
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
    
    async function loadTableData() {
        try {
            const response = await fetch('/api/obtener_arboles');
            const arboles = await response.json();
            tableBody.innerHTML = ''; 
            if (arboles.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4">No hay árboles registrados todavía.</td></tr>';
                return;
            }
            arboles.forEach(arbol => {
                const fecha = new Date(arbol.fecha_siembra).toLocaleString('es-ES');
                const fila = `
                    <tr class="hover:bg-gray-50">
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${arbol.id}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${arbol.especie}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${arbol.latitud.toFixed(6)}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${arbol.longitud.toFixed(6)}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${fecha}</td>
                    </tr>
                `;
                tableBody.innerHTML += fila;
            });
        } catch (error) {
            console.error("Error al cargar la tabla:", error);
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-red-600">Error al cargar los datos.</td></tr>';
        }
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
            if (marcadorTemporal) {
                marcadorTemporal.remove();
                marcadorTemporal = null;
            }
            cargarStats();
            loadTableData();
        } else {
            alert('Error al plantar el árbol.');
        }
    });

    // --- 5. INICIO DE LA APP ---
    
    // NUEVO: Verificador de Token de Reseteo
    function checkUrlForToken() {
        const hash = window.location.hash.substring(1); // Quita el '#'
        if (hash) {
            const params = new URLSearchParams(hash);
            const accessToken = params.get('access_token');
            const type = params.get('type');

            if (type === 'recovery' && accessToken) {
                console.log("Token de recuperación detectado:", accessToken);
                currentAccessToken = accessToken; // Guarda el token
                showUpdatePasswordForm(); // Muestra el formulario para actualizar
            } else {
                // Si hay hash pero no es de recovery, limpia la URL y muestra login
                window.history.pushState("", document.title, window.location.pathname + window.location.search);
                showAuth();
            }
        } else {
            // No hay hash, muestra el login normal
            showAuth(); 
        }
    }
    
    // Inicia la verificación en cuanto carga la página
    checkUrlForToken();

});