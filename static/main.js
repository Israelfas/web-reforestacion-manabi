document.addEventListener('DOMContentLoaded', () => {

    // --- 1. DEFINICIÓN DE ELEMENTOS ---
    const els = {
        authContainer: document.getElementById('auth-container'),
        appContainer: document.getElementById('app-container'),
        authTitle: document.getElementById('auth-title'),
        formLogin: document.getElementById('form-login'),
        formRegister: document.getElementById('form-register'),
        formForgotPassword: document.getElementById('form-forgot-password'),
        formUpdatePassword: document.getElementById('form-update-password'),
        showRegisterBtn: document.getElementById('show-register'),
        registerLink: document.getElementById('register-link'),
        showLoginBtn: document.getElementById('show-login'),
        showLoginDiv: document.getElementById('show-login-div'),
        showForgotPasswordBtn: document.getElementById('show-forgot-password'),
        btnLogout: document.getElementById('btn-logout'),
        welcomeUserNameEl: document.getElementById('welcome-user-name'),
        loginErrorEl: document.getElementById('login-error'),
        registerErrorEl: document.getElementById('register-error'),
        forgotErrorEl: document.getElementById('forgot-error'),
        forgotSuccessEl: document.getElementById('forgot-success'),
        updateErrorEl: document.getElementById('update-error'),
        sidebarLinks: document.querySelectorAll('.sidebar-link'),
        pageContents: document.querySelectorAll('.page-content'),
        tableBody: document.getElementById('table-body'),
        userAvatar: document.getElementById('user-avatar'),
        userMenu: document.getElementById('user-menu'),
        userInitials: document.getElementById('user-initials'),
        userNameMenu: document.getElementById('user-name-menu'),
        userEmailMenu: document.getElementById('user-email-menu'),
        headerSearch: document.getElementById('header-search')
    };
    
    let map = null, marcadorTemporal = null, currentAccessToken = null;

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

    // --- 2. FUNCIONES AUXILIARES ---
    const getInitials = (name) => {
        if (!name) return 'U';
        const parts = name.trim().split(' ');
        return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.substring(0, 2).toUpperCase();
    };

    const updateUserInfo = (userName, userEmail) => {
        if (els.userNameMenu) els.userNameMenu.textContent = userName;
        if (els.userEmailMenu) els.userEmailMenu.textContent = userEmail;
        if (els.userInitials) els.userInitials.textContent = getInitials(userName);
        if (els.welcomeUserNameEl) els.welcomeUserNameEl.textContent = userName.split(' ')[0];
    };

    const hideAllAuthForms = () => {
        [els.formLogin, els.formRegister, els.formForgotPassword, els.formUpdatePassword, els.registerLink, els.showLoginDiv]
            .forEach(el => el.classList.add('hidden'));
    };

    // --- 3. LÓGICA DE VISTAS ---
    const showApp = (user) => {
        els.authContainer.classList.add('hidden');
        els.appContainer.classList.remove('hidden');
        updateUserInfo(user.name || user.email.split('@')[0], user.email);
        showPage('page-map');
        loadTableData();
        cargarStats();
    };

    const showAuth = () => {
        els.authContainer.classList.remove('hidden');
        els.appContainer.classList.add('hidden');
        updateUserInfo('Usuario', 'usuario@ejemplo.com');
        if (els.userMenu) els.userMenu.classList.remove('active');
        if (map) { map.remove(); map = null; }
        showLoginForm();
    };

    const showRegisterForm = () => {
        hideAllAuthForms();
        els.authTitle.textContent = "Crea tu cuenta";
        els.formRegister.classList.remove('hidden');
        els.showLoginDiv.classList.remove('hidden');
    };

    const showLoginForm = () => {
        hideAllAuthForms();
        els.authTitle.textContent = "Bienvenido. Por favor, inicia sesión.";
        els.formLogin.classList.remove('hidden');
        els.registerLink.classList.remove('hidden');
    };

    const showForgotPasswordForm = () => {
        hideAllAuthForms();
        els.authTitle.textContent = "Recuperar Contraseña";
        els.formForgotPassword.classList.remove('hidden');
        els.showLoginDiv.classList.remove('hidden');
    };

    const showUpdatePasswordForm = () => {
        hideAllAuthForms();
        els.authTitle.textContent = "Crea tu nueva contraseña";
        els.formUpdatePassword.classList.remove('hidden');
    };
    
    const showPage = (pageId) => {
        els.pageContents.forEach(page => page.classList.add('hidden'));
        const pageToShow = document.getElementById(pageId);
        if (pageToShow) pageToShow.classList.remove('hidden');
        if (pageId === 'page-map' && !map) { initializeMap(); cargarArboles(); }
        els.sidebarLinks.forEach(link => {
            const isActive = link.dataset.page === pageId;
            link.classList.toggle('sidebar-active', isActive);
            link.classList.toggle('text-white', isActive);
        });
    };

    // --- 4. LÓGICA DEL DROPDOWN DE USUARIO ---
    if (els.userAvatar && els.userMenu) {
        els.userAvatar.addEventListener('click', (e) => {
            e.stopPropagation();
            els.userMenu.classList.toggle('active');
            const langMenu = document.getElementById('lang-menu');
            if (langMenu) langMenu.classList.remove('active');
        });

        document.addEventListener('click', (e) => {
            if (!els.userMenu.contains(e.target) && !els.userAvatar.contains(e.target)) {
                els.userMenu.classList.remove('active');
            }
        });

        els.userMenu.addEventListener('click', (e) => {
            if (!e.target.closest('#btn-logout') && !e.target.closest('#btn-config') && !e.target.closest('#btn-help')) {
                e.stopPropagation();
            }
        });
    }

    // --- CONFIGURACIÓN Y AYUDA ---
    document.getElementById('btn-config')?.addEventListener('click', () => {
        els.userMenu.classList.remove('active');
        alert('Función de Configuración en desarrollo.\n\nAquí podrás editar tu perfil, cambiar contraseña y ajustar preferencias.');
    });

    document.getElementById('btn-help')?.addEventListener('click', () => {
        els.userMenu.classList.remove('active');
        alert(`📚 AYUDA - Reforesta Manabí

🌳 Cómo usar la plataforma:

1. REGISTRAR SIEMBRA:
   - Haz clic en el mapa para seleccionar ubicación
   - Ingresa la especie del árbol
   - Presiona "Plantar Árbol"

2. VER REGISTROS:
   - Consulta todos los árboles plantados
   - Filtra por especie, fecha o usuario

3. ESTADÍSTICAS:
   - Visualiza árboles totales plantados
   - Horas de trabajo estimadas

¿Necesitas más ayuda?
Contacta: soporte@reforestamanabi.ec`);
    });

    // --- SELECTOR DE IDIOMA ---
    const langSelector = document.getElementById('lang-selector');
    const langMenu = document.getElementById('lang-menu');
    const currentLangEl = document.getElementById('current-lang');
    
    if (langSelector && langMenu) {
        langSelector.addEventListener('click', (e) => {
            e.stopPropagation();
            langMenu.classList.toggle('active');
            if (els.userMenu) els.userMenu.classList.remove('active');
        });

        document.addEventListener('click', (e) => {
            if (!langMenu.contains(e.target) && !langSelector.contains(e.target)) {
                langMenu.classList.remove('active');
            }
        });

        langMenu.querySelectorAll('[data-lang]').forEach(item => {
            item.addEventListener('click', function() {
                const lang = this.dataset.lang;
                const [checkEs, checkEn] = [document.getElementById('check-es'), document.getElementById('check-en')];
                
                if (lang === 'es') {
                    currentLangEl.textContent = 'Español';
                    checkEs?.classList.remove('hidden');
                    checkEn?.classList.add('hidden');
                    alert('Idioma cambiado a Español ✓');
                } else {
                    currentLangEl.textContent = 'English';
                    checkEn?.classList.remove('hidden');
                    checkEs?.classList.add('hidden');
                    alert('Language changed to English ✓\n\n(Full translation coming soon)');
                }
                langMenu.classList.remove('active');
            });
        });
    }

    // --- BÚSQUEDA EN HEADER ---
    const filterTable = (searchTerm) => {
        const rows = els.tableBody.querySelectorAll('tr');
        let visibleCount = 0;
        
        rows.forEach(row => {
            const isVisible = row.textContent.toLowerCase().includes(searchTerm);
            row.style.display = isVisible ? '' : 'none';
            if (isVisible) visibleCount++;
        });

        const noResultsRow = els.tableBody.querySelector('.no-results-row');
        if (visibleCount === 0 && searchTerm !== '') {
            if (!noResultsRow) {
                els.tableBody.innerHTML += `<tr class="no-results-row"><td colspan="6" class="text-center p-4 text-gray-500">No se encontraron resultados para "${searchTerm}"</td></tr>`;
            }
        } else if (noResultsRow) {
            noResultsRow.remove();
        }
    };

    if (els.headerSearch) {
        els.headerSearch.addEventListener('input', (e) => {
            const currentPage = document.querySelector('.page-content:not(.hidden)');
            if (currentPage?.id === 'page-table') filterTable(e.target.value.toLowerCase());
        });

        els.sidebarLinks.forEach(link => {
            link.addEventListener('click', () => { els.headerSearch.value = ''; });
        });
    }

    // --- 5. AUTENTICACIÓN (API) ---
    els.formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();
        els.registerErrorEl.classList.add('hidden');
        const [email, password, name, birthdate] = [
            document.getElementById('register-email').value,
            document.getElementById('register-password').value,
            document.getElementById('register-name').value,
            document.getElementById('register-birth-date').value
        ];

        if (!birthdate) {
            els.registerErrorEl.textContent = "Por favor, selecciona tu fecha de nacimiento.";
            els.registerErrorEl.classList.remove('hidden');
            return;
        }

        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name, birthdate })
        });
        const data = await response.json();

        if (response.ok) {
            alert('¡Registro exitoso! Revisa tu email para confirmar y luego inicia sesión.');
            els.formRegister.reset();
            showLoginForm();
        } else {
            els.registerErrorEl.textContent = data.error.includes("already registered") ? "Email ya registrado." : "Error al registrar.";
            els.registerErrorEl.classList.remove('hidden');
        }
    });

    els.formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        els.loginErrorEl.classList.add('hidden');
        const [email, password] = [
            document.getElementById('login-email').value,
            document.getElementById('login-password').value
        ];

        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();

        if (response.ok) {
            showApp(data.user);
        } else {
            els.loginErrorEl.textContent = "Email o contraseña incorrectos.";
            els.loginErrorEl.classList.remove('hidden');
        }
    });

    els.btnLogout.addEventListener('click', () => {
        currentAccessToken = null;
        showAuth();
        els.formLogin.reset();
        [els.registerErrorEl, els.loginErrorEl].forEach(el => el.classList.add('hidden'));
    });

    els.showRegisterBtn.addEventListener('click', showRegisterForm);
    els.showLoginBtn.addEventListener('click', showLoginForm);
    els.showForgotPasswordBtn.addEventListener('click', showForgotPasswordForm);

    els.formForgotPassword.addEventListener('submit', async (e) => {
        e.preventDefault();
        [els.forgotErrorEl, els.forgotSuccessEl].forEach(el => el.classList.add('hidden'));
        const email = document.getElementById('forgot-email').value;
        
        const response = await fetch('/api/forgot_password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        if (response.ok) {
            els.forgotSuccessEl.textContent = "Correo enviado.";
            els.forgotSuccessEl.classList.remove('hidden');
            els.formForgotPassword.reset();
        } else {
            els.forgotErrorEl.textContent = "Error al enviar.";
            els.forgotErrorEl.classList.remove('hidden');
        }
    });

    els.formUpdatePassword.addEventListener('submit', async (e) => {
        e.preventDefault();
        els.updateErrorEl.classList.add('hidden');
        const new_password = document.getElementById('update-password').value;

        if (!currentAccessToken) {
            els.updateErrorEl.textContent = "Token inválido.";
            els.updateErrorEl.classList.remove('hidden');
            return;
        }

        const response = await fetch('/api/update_password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: currentAccessToken, new_password })
        });

        if (response.ok) {
            alert("Contraseña actualizada. Inicia sesión.");
            currentAccessToken = null;
            showLoginForm();
        } else {
            els.updateErrorEl.textContent = "Error al actualizar.";
            els.updateErrorEl.classList.remove('hidden');
        }
    });

    // --- 6. MAPA Y FORMULARIOS ---
    els.sidebarLinks.forEach(link => {
        link.addEventListener('click', () => showPage(link.dataset.page));
    });

    const initializeMap = () => {
        map = L.map('map').setView([-0.958, -80.714], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap'
        }).addTo(map);

        puntosReforestacion.forEach(punto => {
            L.marker(punto.coords, { icon: greenIcon }).addTo(map)
                .bindPopup(`<b>${punto.nombre}</b><br>${punto.info}`);
        });

        map.on('click', (e) => {
            const { lat, lng } = e.latlng;
            document.getElementById('latitud').value = lat.toFixed(6);
            document.getElementById('longitud').value = lng.toFixed(6);
            
            if (marcadorTemporal) {
                marcadorTemporal.setLatLng(e.latlng);
            } else {
                marcadorTemporal = L.marker(e.latlng, { draggable: true }).addTo(map);
            }
        });
    };

    const cargarArboles = async () => {
        const response = await fetch('/api/obtener_arboles');
        const arboles = await response.json();
        if (!map) return;
        arboles.forEach(arbol => {
            L.marker([arbol.latitud, arbol.longitud]).addTo(map)
                .bindPopup(`<b>Especie:</b> ${arbol.especie}`);
        });
    };

    const cargarStats = async () => {
        const response = await fetch('/api/predecir_horas');
        const stats = await response.json();
        document.getElementById('stat-arboles').textContent = stats.arboles_totales;
        document.getElementById('stat-horas').textContent = stats.horas_estimadas.toFixed(1);
    };

    const loadTableData = async () => {
        try {
            const response = await fetch('/api/obtener_arboles');
            const arboles = await response.json();
            els.tableBody.innerHTML = '';

            if (arboles.length === 0) {
                els.tableBody.innerHTML = '<tr><td colspan="6" class="text-center p-4 text-gray-500">No hay árboles registrados.</td></tr>';
                return;
            }

            arboles.forEach(arbol => {
                const fecha = new Date(arbol.fecha_siembra).toLocaleString('es-ES', {
                    dateStyle: 'short',
                    timeStyle: 'short'
                });
                const usuario = arbol.user_email || 'Desconocido';
                els.tableBody.innerHTML += `
                    <tr class="hover:bg-gray-50 transition-colors">
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${arbol.id}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${arbol.especie}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${arbol.latitud.toFixed(6)}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${arbol.longitud.toFixed(6)}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${fecha}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${usuario}</td>
                    </tr>
                `;
            });
        } catch (error) {
            console.error("Error al cargar la tabla:", error);
            els.tableBody.innerHTML = '<tr><td colspan="6" class="text-center p-4 text-red-600">Error al cargar datos.</td></tr>';
        }
    };

    document.getElementById('form-plantar').addEventListener('submit', async (e) => {
        e.preventDefault();
        const [especie, latitud, longitud] = [
            document.getElementById('especie').value,
            document.getElementById('latitud').value,
            document.getElementById('longitud').value
        ];

        if (!especie || !latitud || !longitud) {
            alert('Completa la especie y selecciona un punto.');
            return;
        }

        const response = await fetch('/api/plantar_arbol', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                especie,
                latitud: parseFloat(latitud),
                longitud: parseFloat(longitud)
            })
        });

        if (response.ok) {
            alert('¡Árbol plantado exitosamente!');
            document.getElementById('form-plantar').reset();
            L.marker([latitud, longitud]).addTo(map).bindPopup(`<b>Especie:</b> ${especie}`);
            if (marcadorTemporal) { marcadorTemporal.remove(); marcadorTemporal = null; }
            cargarStats();
            loadTableData();
        } else {
            alert('Error al plantar árbol.');
        }
    });

    // --- 7. INICIO DE LA APP ---
    const checkUrlForToken = () => {
        const hash = window.location.hash.substring(1);
        if (hash) {
            const params = new URLSearchParams(hash);
            const accessToken = params.get('access_token');
            const type = params.get('type');
            
            if (type === 'recovery' && accessToken) {
                currentAccessToken = accessToken;
                showUpdatePasswordForm();
            } else {
                window.history.pushState("", document.title, window.location.pathname + window.location.search);
                showAuth();
            }
        } else {
            showAuth();
        }
    };

    checkUrlForToken();
});