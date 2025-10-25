// Espera a que la página cargue
document.addEventListener('DOMContentLoaded', () => {

    // --- 1. DEFINICIÓN DE ELEMENTOS ---
    
    // Contenedores principales
    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');
    
    // Formularios Auth
    const formLogin = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');
    
    // Botones Auth
    const showRegisterBtn = document.getElementById('show-register');
    const showLoginBtn = document.getElementById('show-login');
    const showLoginDiv = document.getElementById('show-login-div');
    const btnLogout = document.getElementById('btn-logout');
    
    // Elementos UI
    const userEmailEl = document.getElementById('user-email');
    const loginErrorEl = document.getElementById('login-error');
    const registerErrorEl = document.getElementById('register-error');

    // --- NUEVOS ELEMENTOS DEL DASHBOARD ---
    const sidebarLinkMap = document.getElementById('sidebar-link-map');
    const sidebarLinkTable = document.getElementById('sidebar-link-table');
    
    const pageMap = document.getElementById('page-map');
    const pageTable = document.getElementById('page-table');
    const tableBody = document.getElementById('table-body');
    
    // Variables de la App (Mapa, etc.)
    let map = null;
    let marcadorTemporal = null;

    // --- 2. LÓGICA DE VISTAS (Mostrar/Ocultar) ---

    // Muestra la App (mapa) y oculta el Login
    function showApp(user) {
        authContainer.classList.add('hidden');
        appContainer.classList.remove('hidden');
        userEmailEl.textContent = user.email; // Muestra el email del usuario
        
        // Carga la página inicial del mapa y los datos de la tabla en segundo plano
        showPage('page-map');
        loadTableData();
        cargarStats(); // Carga las estadísticas (IA)
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
    }

    // Muestra el formulario de Registro
    function showRegisterForm() {
        formLogin.classList.add('hidden');
        showRegisterBtn.parentElement.classList.add('hidden');
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

    // --- NUEVA FUNCIÓN: NAVEGACIÓN DE PÁGINAS ---
    function showPage(pageId) {
        // Oculta todas las páginas
        pageMap.classList.add('hidden');
        pageTable.classList.add('hidden');
        
        // Muestra la página solicitada
        if (pageId === 'page-map') {
            pageMap.classList.remove('hidden');
            
            // Inicializa el mapa SÓLO la primera vez que se muestra
            if (!map) {
                initializeMap();
                cargarArboles();
            }
        } else if (pageId === 'page-table') {
            pageTable.classList.remove('hidden');
            // Opcional: recargar datos de la tabla cada vez que se visita
            // loadTableData(); 
        }
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
        showAuth();
        formLogin.reset();
        registerErrorEl.classList.add('hidden');
        loginErrorEl.classList.add('hidden');
    });

    // (D) Manejar botones de cambio de vista (Login/Registro)
    showRegisterBtn.addEventListener('click', showRegisterForm);
    showLoginBtn.addEventListener('click', showLoginForm);

    // --- NUEVO: Manejar navegación del Sidebar ---
    sidebarLinkMap.addEventListener('click', () => showPage('page-map'));
    sidebarLinkTable.addEventListener('click', () => showPage('page-table'));


    // --- 4. LÓGICA DE LA APLICACIÓN (MAPA Y FORMULARIOS) ---

    function initializeMap() {
        const centerManabi = [-0.9338, -80.4530];
        // Asignamos el mapa a la variable global 'map'
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
        
        if (!map) return; // Seguridad por si el mapa no está listo
        
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
    
    // --- NUEVA FUNCIÓN: Cargar datos en la tabla ---
    async function loadTableData() {
        try {
            const response = await fetch('/api/obtener_arboles');
            const arboles = await response.json();

            tableBody.innerHTML = ''; // Limpia la tabla antes de cargar

            if (arboles.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4">No hay árboles registrados todavía.</td></tr>';
                return;
            }

            arboles.forEach(arbol => {
                // Formatea la fecha para que sea legible
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
            
            // Limpia el formulario
            document.getElementById('form-plantar').reset();
            
            // Añade el marcador al mapa
            L.marker([latitud, longitud]).addTo(map).bindPopup(`<b>Especie:</b> ${especie}`);
            if (marcadorTemporal) {
                marcadorTemporal.remove();
                marcadorTemporal = null;
            }
            
            // Recarga las estadísticas y la tabla
            cargarStats();
            loadTableData();
        } else {
            alert('Error al plantar el árbol.');
        }
    });

    // --- 5. INICIO DE LA APP ---
    // Por defecto, siempre mostramos el login al cargar.
    showAuth(); 

});