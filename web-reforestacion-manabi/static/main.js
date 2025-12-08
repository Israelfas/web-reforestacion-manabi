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
        langSelector: document.getElementById('lang-selector'),
        langMenu: document.getElementById('lang-menu'),
        userInitials: document.getElementById('user-initials'),
        userNameMenu: document.getElementById('user-name-menu'),
        userEmailMenu: document.getElementById('user-email-menu'),
        headerSearch: document.getElementById('header-search'),
        statArboles: document.getElementById('stat-arboles'),
        statHoras: document.getElementById('stat-horas'),
        btnConfig: document.getElementById('btn-config'),
        btnHelp: document.getElementById('btn-help'),
        currentLangEl: document.getElementById('current-lang'),
        langMenuItems: document.querySelectorAll('#lang-menu .user-menu-item[data-lang]'),
        checkEs: document.getElementById('check-es'),
        checkEn: document.getElementById('check-en'),
        floatingHelpBtn: document.getElementById('floating-help-btn'),

        // --- Elementos Modales (Config y Ayuda) ---
        modalConfig: document.getElementById('modal-config'),
        modalHelp: document.getElementById('modal-help'),
        closeConfigBtn: document.getElementById('close-config'),
        closeHelpBtn: document.getElementById('close-help'),
        cancelBtn: document.getElementById('cancel-btn'),
        profileForm: document.getElementById('profile-form'),
        avatarPreview: document.getElementById('avatar-preview'),
        avatarInitials: document.getElementById('avatar-initials'),
        avatarInput: document.getElementById('avatar-input'),
        changeAvatarBtn: document.getElementById('change-avatar-btn'),
        successMsg: document.getElementById('success-msg'),
        errorMsg: document.getElementById('error-msg'),
        errorText: document.getElementById('error-text'),
        profileName: document.getElementById('profile-name'),
        profileEmail: document.getElementById('profile-email'),
        profileBirthdate: document.getElementById('profile-birthdate'),
        currentPassword: document.getElementById('current-password'),
        newPassword: document.getElementById('new-password'),
        confirmPassword: document.getElementById('confirm-password'),
        togglePasswordIcons: document.querySelectorAll('.toggle-password')
    };

    let map = null, marcadorTemporal = null, currentAccessToken = null, currentUser = null;
    let profileSelectedFile = null; // Para el avatar del perfil

    // ========================================
    // FUNCIONES DE GESTIÓN DE SESIÓN
    // ========================================
    const SESSION_KEY = 'reforesta_session';
    const USER_KEY = 'reforesta_user';

    const saveSession = (user, session) => {
        try {
            localStorage.setItem(USER_KEY, JSON.stringify(user));
            localStorage.setItem(SESSION_KEY, JSON.stringify({
                access_token: session.access_token,
                refresh_token: session.refresh_token,
                expires_at: session.expires_at
            }));
            console.log('✅ Sesión guardada correctamente');
        } catch (error) {
            console.error('❌ Error al guardar sesión:', error);
        }
    };

    const getSession = () => {
        try {
            const userStr = localStorage.getItem(USER_KEY);
            const sessionStr = localStorage.getItem(SESSION_KEY);
            
            if (!userStr || !sessionStr) return null;
            
            const user = JSON.parse(userStr);
            const session = JSON.parse(sessionStr);
            
            // Verificar si el token expiró
            if (session.expires_at && new Date(session.expires_at * 1000) < new Date()) {
                console.warn('⚠️ Sesión expirada');
                clearSession();
                return null;
            }
            
            return { user, session };
        } catch (error) {
            console.error('❌ Error al recuperar sesión:', error);
            return null;
        }
    };

    const clearSession = () => {
        try {
            localStorage.removeItem(USER_KEY);
            localStorage.removeItem(SESSION_KEY);
            console.log('🗑️ Sesión limpiada');
        } catch (error) {
            console.error('❌ Error al limpiar sesión:', error);
        }
    };

    const hasCompletedOnboarding = () => {
        return localStorage.getItem('onboarding_completed') === 'true';
    };

    const markOnboardingCompleted = () => {
        localStorage.setItem('onboarding_completed', 'true');
        // Mostrar botón flotante al completar
        if (els.floatingHelpBtn) els.floatingHelpBtn.classList.remove('hidden');
    };

    // ========================================
    // DATOS E ICONOS GLOBALES
    // ========================================

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
        if (!name || typeof name !== 'string') return '?';
        const parts = name.trim().split(' ').filter(part => part.length > 0);
        if (parts.length === 0) return '?';
        if (parts.length === 1) return parts[0][0].toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    };

    const updateUserInfo = (userName, userEmail) => {
        const nameToDisplay = userName || userEmail?.split('@')[0] || 'Usuario';
        const emailToDisplay = userEmail || 'correo@ejemplo.com';
        const initials = getInitials(nameToDisplay);

        // Obtener avatar_url del usuario actual
        const avatarUrl = currentUser?.user_metadata?.avatar_url || currentUser?.avatar_url || null;

        if (els.userNameMenu) els.userNameMenu.textContent = nameToDisplay;
        if (els.userEmailMenu) els.userEmailMenu.textContent = emailToDisplay;
        if (els.welcomeUserNameEl) els.welcomeUserNameEl.textContent = nameToDisplay.split(' ')[0];
        
        // Actualizar avatar en el header
        if (els.userAvatar) {
            if (avatarUrl) {
                // Mostrar imagen de avatar
                els.userAvatar.innerHTML = `<img src="${avatarUrl}" alt="${nameToDisplay}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
            } else {
                // Mostrar iniciales
                els.userAvatar.innerHTML = `<span id="user-initials">${initials}</span>`;
            }
        }
        
        // Actualizar iniciales en modal de config
        if (els.avatarInitials) els.avatarInitials.textContent = initials;
    };

    const hideAllAuthForms = () => {
        [els.formLogin, els.formRegister, els.formForgotPassword, els.formUpdatePassword, els.registerLink, els.showLoginDiv]
            .filter(Boolean)
            .forEach(el => el.classList.add('hidden'));
    };

    // --- 3. LÓGICA DE VISTAS ---
    const showApp = (user) => {
        currentUser = user; 
        els.authContainer?.classList.add('hidden');
        els.appContainer?.classList.remove('hidden');
        if (user) {
            updateUserInfo(user.user_metadata?.name || user.name || user.email?.split('@')[0], user.email);
        }
        
        // Mostrar botón flotante si ya completó el onboarding
        if (hasCompletedOnboarding() && els.floatingHelpBtn) {
            els.floatingHelpBtn.classList.remove('hidden');
        }

        navigateToPage('page-map');
        initializeMapIfNeeded();
        loadAppData();
    };

    const showAuth = () => {
        currentUser = null;
        els.authContainer?.classList.remove('hidden');
        els.appContainer?.classList.add('hidden');
        updateUserInfo('Usuario', 'usuario@ejemplo.com');
        els.userMenu?.classList.remove('active');
        els.langMenu?.classList.remove('active');
        if (map) { map.remove(); map = null; marcadorTemporal = null;}
        showLoginForm();
    };

    const showAuthForm = (formId, title) => {
         hideAllAuthForms();
         if (els.authTitle) els.authTitle.textContent = title;

         const formElement = els[formId];
         if (formElement) {
               formElement.classList.remove('hidden');
         } else {
               console.error(`Auth form with ID "${formId}" not found in els.`);
          }

         if (formId === 'formLogin') {
               els.registerLink?.classList.remove('hidden');
         } else {
               els.showLoginDiv?.classList.remove('hidden');
         }
      };

      const showLoginForm = () => showAuthForm('formLogin', "Bienvenido. Por favor, inicia sesión.");
      const showRegisterForm = () => showAuthForm('formRegister', "Crea tu cuenta");
      const showForgotPasswordForm = () => showAuthForm('formForgotPassword', "Recuperar Contraseña");
      const showUpdatePasswordForm = () => showAuthForm('formUpdatePassword', "Crea tu nueva contraseña");

    const navigateToPage = (pageId) => {
        els.pageContents?.forEach(page => page.classList.add('hidden'));
        const pageToShow = document.getElementById(pageId);
        if (pageToShow) {
             pageToShow.classList.remove('hidden');
        } else {
             pageId = 'page-map';
             document.getElementById(pageId)?.classList.remove('hidden');
        }

        if (pageId === 'page-map') {
             setTimeout(initializeMapIfNeeded, 50);
        }
        if (pageId === 'page-table') {
             loadTableData();
        }

        els.sidebarLinks?.forEach(link => {
             const isActive = link.dataset.page === pageId;
             link.classList.toggle('sidebar-active', isActive);
        });

        if (els.headerSearch) els.headerSearch.value = '';
        if (pageId === 'page-table') filterTable('');
    };

    // --- 4. LÓGICA DEL MAPA ---
    const initializeMapIfNeeded = () => {
        if (map || !document.getElementById('map')) return;

        console.log('Initializing map...');
        
        // ✅ NUEVO: Asegurar que el contenedor tenga tamaño correcto
        const mapContainer = document.getElementById('map');
        mapContainer.style.height = '500px';
        mapContainer.style.width = '100%';
        mapContainer.style.position = 'relative';
        mapContainer.style.zIndex = '1';
        
        map = L.map('map', {
            zoomControl: false 
        }).setView([-0.958, -80.714], 13);
        
        L.control.zoom({ position: 'topright' }).addTo(map);

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
                  const redIcon = L.icon({
                           iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                           shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                           iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
                      });
                  marcadorTemporal = L.marker(e.latlng, { draggable: true, icon: redIcon }).addTo(map);
                   marcadorTemporal.on('dragend', (ev) => {
                        const movedLatLng = ev.target.getLatLng();
                        document.getElementById('latitud').value = movedLatLng.lat.toFixed(6);
                        document.getElementById('longitud').value = movedLatLng.lng.toFixed(6);
                   });
             }
              map.panTo(e.latlng);
        });
         map.invalidateSize();
        cargarArboles();
    };

    // --- 5. CARGA DE DATOS Y FILTRADO ---
    const filterTable = (searchTerm) => {
        if (!els.tableBody) return;
        const term = searchTerm.toLowerCase();
        const rows = els.tableBody.querySelectorAll('tr');

        rows.forEach(row => {
             if (row.cells.length <= 1) {
                   row.style.display = '';
                   return;
             }

             const rowText = row.textContent || row.innerText;
             if (rowText.toLowerCase().includes(term)) {
                   row.style.display = '';
             } else {
                   row.style.display = 'none';
             }
        });
    };

    const cargarArboles = async () => {
        if (!map) return;
        console.log("Cargando árboles plantados...");
        try {
             const response = await fetch('/api/obtener_arboles');
             if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
             const arboles = await response.json();

             map.eachLayer(layer => {
                  if (layer instanceof L.Marker && layer !== marcadorTemporal && !layer.options.icon?.options?.iconUrl.includes('green')) {
                       map.removeLayer(layer);
                  }
             });

             arboles.forEach(arbol => {
                  const blueIcon = L.icon({
                           iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                           shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                           iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
                  });

                  const popupContent = `
                        <div class="text-center">
                             <b>Especie:</b> ${arbol.especie || 'N/A'}<br>
                             <b>ID:</b> ${arbol.id}
                             ${arbol.foto_url ? `<br><img src="${arbol.foto_url}" alt="${arbol.especie}" style="width:100%; max-width:200px; margin-top:8px; border-radius:4px;">` : ''}
                        </div>
                  `;

                  L.marker([arbol.latitud, arbol.longitud], { icon: blueIcon })
                        .addTo(map)
                        .bindPopup(popupContent);
             });
             console.log(`${arboles.length} árboles cargados en el mapa.`);
        } catch (error) {
             console.error("Error al cargar árboles:", error);
             alert("Error al cargar los árboles en el mapa.");
          }
    };

    const cargarStats = async () => {
        try {
             const response = await fetch('/api/predecir_horas');
              if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
             const stats = await response.json();
             if (els.statArboles) els.statArboles.textContent = stats.arboles_totales ?? '0';
             if (els.statHoras) els.statHoras.textContent = (stats.horas_estimadas ?? 0).toFixed(1);
        } catch (error) {
             console.error("Error al cargar estadísticas:", error);
             if (els.statArboles) els.statArboles.textContent = '0';
             if (els.statHoras) els.statHoras.textContent = '0.0';
          }
    };

    const loadTableData = async () => {
        if (!els.tableBody) return;
        console.log("Cargando datos de la tabla...");
        els.tableBody.innerHTML = '<tr><td colspan="8" class="text-center p-4 text-gray-500">Cargando...</td></tr>';

        try {
             const response = await fetch('/api/obtener_arboles');
             if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
             const arboles = await response.json();
             els.tableBody.innerHTML = '';

             if (!arboles || arboles.length === 0) {
                  els.tableBody.innerHTML = '<tr><td colspan="8" class="text-center p-4 text-gray-500">No hay árboles registrados.</td></tr>';
                  return;
             }

             arboles.sort((a, b) => new Date(b.fecha_siembra) - new Date(a.fecha_siembra));

             arboles.forEach(arbol => {
                  let fecha = 'Inválida';
                  try {
                        fecha = new Date(arbol.fecha_siembra).toLocaleString('es-ES', {
                             dateStyle: 'short',
                             timeStyle: 'short',
                             hour12: true
                        });
                  } catch (e) {
                        console.warn(`Fecha inválida: ${arbol.fecha_siembra}`);
                  }

                  const usuario = arbol.user_email || 'Desconocido';

                  const fotoHtml = arbol.foto_url
                        ? `<img src="${arbol.foto_url}" alt="${arbol.especie}" class="w-10 h-10 rounded-lg object-cover cursor-pointer hover:scale-110 transition-transform" onclick="window.open('${arbol.foto_url}', '_blank')" title="Click para ver en tamaño completo">`
                        : `<div class="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center" title="Sin foto">
                             <ion-icon name="image-outline" class="text-gray-400 text-xl"></ion-icon>
                          </div>`;

                  els.tableBody.innerHTML += `
                        <tr class="hover:bg-gray-50 transition-colors" data-id="${arbol.id}">
                             <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${arbol.id}</td>
                             <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${arbol.especie || 'N/A'}</td>
                             <td class="px-6 py-4 whitespace-nowrap">${fotoHtml}</td>
                             <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${arbol.latitud?.toFixed(6) || 'N/A'}</td>
                             <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${arbol.longitud?.toFixed(6) || 'N/A'}</td>
                             <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${fecha}</td>
                             <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 truncate" title="${usuario}">${usuario}</td>
                             <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                  <button class="btn-delete text-red-600 hover:text-red-800 transition duration-150" data-id="${arbol.id}" title="Eliminar ${arbol.id}">
                                       <ion-icon name="trash-outline" class="text-lg align-middle pointer-events-none"></ion-icon>
                                  </button>
                                  <button class="btn-edit text-blue-600 hover:text-blue-800 transition duration-150 ml-3" data-id="${arbol.id}" title="Editar ${arbol.id}">
                                       <ion-icon name="create-outline" class="text-lg align-middle pointer-events-none"></ion-icon>
                                  </button>
                             </td>
                        </tr>
                  `;
             });
             console.log(`${arboles.length} filas añadidas a la tabla.`);
        } catch (error) {
             console.error("Error al cargar la tabla:", error);
             els.tableBody.innerHTML = '<tr><td colspan="8" class="text-center p-4 text-red-600">Error al cargar datos.</td></tr>';
         }
    };

     const loadAppData = async () => {
           console.log("Cargando datos iniciales de la aplicación...");
           try {
                 await Promise.all([
                      cargarStats(),
                      loadTableData()
                 ]);
           } catch(error) {
                console.error("Error al cargar datos de la app:", error);
                alert("Error al cargar los datos iniciales de la aplicación.");
             }
      };

    // --- 6. DIÁLOGO DE CONFIRMACIÓN ---
    const showConfirmDialog = (message, onConfirm) => {
         const existingDialog = document.getElementById('confirm-dialog');
         if (existingDialog) existingDialog.remove();

        const dialog = document.createElement('div');
        dialog.id = 'confirm-dialog';
        dialog.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
        dialog.innerHTML = `
             <div class="bg-white rounded-lg p-6 max-w-md w-full shadow-2xl animate-fade-in-up">
                 <h3 class="text-xl font-bold mb-4 text-gray-900">Confirmar Acción</h3>
                 <p class="text-gray-600 mb-6">${message}</p>
                 <div class="flex gap-3 justify-end">
                      <button class="btn-cancel px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition text-gray-800 font-medium">Cancelar</button>
                      <button class="btn-confirm px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition font-medium">Confirmar</button>
                 </div>
             </div>
             <style>@keyframes fade-in-up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}.animate-fade-in-up{animation:fade-in-up .3s ease-out}</style>
        `;
        document.body.appendChild(dialog);

         const closeDialog = (callback) => {
              dialog.remove();
              document.removeEventListener('keydown', escKeyHandler);
              if (callback) callback();
         };

        dialog.querySelector('.btn-cancel').onclick = () => closeDialog();
        dialog.querySelector('.btn-confirm').onclick = () => closeDialog(onConfirm);
        dialog.addEventListener('click', (e) => { if (e.target === dialog) closeDialog(); });

         const escKeyHandler = (e) => { if (e.key === 'Escape') closeDialog(); };
        document.addEventListener('keydown', escKeyHandler);
    };

    // --- 7. EVENT LISTENERS ---

    // Dropdowns del Header
    els.userAvatar?.addEventListener('click', (e) => {
        e.stopPropagation();
        els.userMenu?.classList.toggle('active');
        els.langMenu?.classList.remove('active');
    });

    els.langSelector?.addEventListener('click', (e) => {
        e.stopPropagation();
        els.langMenu?.classList.toggle('active');
        els.userMenu?.classList.remove('active');
    });

    window.addEventListener('click', (e) => {
        if (!e.target.closest('.user-dropdown')) {
             els.userMenu?.classList.remove('active');
             els.langMenu?.classList.remove('active');
        }
    });

    // Botones Config y Ayuda
    els.btnConfig?.addEventListener('click', () => {
        openConfigModal();
        els.userMenu?.classList.remove('active');
    });
    els.btnHelp?.addEventListener('click', () => {
        openHelpModal();
        els.userMenu?.classList.remove('active');
    });

    els.langMenuItems?.forEach(item => {
        item.addEventListener('click', () => {
             const selectedLang = item.dataset.lang;
             const langText = item.querySelector('span').textContent;

             if (els.currentLangEl) els.currentLangEl.textContent = langText;
             if (els.checkEs) els.checkEs.classList.toggle('hidden', selectedLang !== 'es');
             if (els.checkEn) els.checkEn.classList.toggle('hidden', selectedLang !== 'en');

             console.log(`Idioma seleccionado: ${selectedLang}`);
             alert(`Idioma cambiado a ${langText} (funcionalidad de traducción pendiente)`);

             els.langMenu?.classList.remove('active');
        });
    });

    els.headerSearch?.addEventListener('keyup', () => {
        const tablePage = document.getElementById('page-table');
        if (tablePage && !tablePage.classList.contains('hidden')) {
             filterTable(els.headerSearch.value);
        }
    });

    // Auth Forms - REGISTRO
    els.formRegister?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (els.registerErrorEl) els.registerErrorEl.classList.add('hidden');
        const [email, password, passwordConfirm, name, birthdate] = [
             'register-email', 'register-password', 'register-password-confirm', 
             'register-name', 'register-birth-date'
        ].map(id => document.getElementById(id)?.value);

        if (!birthdate) {
             if (els.registerErrorEl) {
                  els.registerErrorEl.textContent = "Fecha de nacimiento requerida.";
                  els.registerErrorEl.classList.remove('hidden');
             }
             return;
        }
        
        if (password !== passwordConfirm) {
             if (els.registerErrorEl) {
                  els.registerErrorEl.textContent = "Las contraseñas no coinciden.";
                  els.registerErrorEl.classList.remove('hidden');
             }
             return;
        }
        
        if (password.length < 8) {
             if (els.registerErrorEl) {
                  els.registerErrorEl.textContent = "La contraseña debe tener al menos 8 caracteres.";
                  els.registerErrorEl.classList.remove('hidden');
             }
             return;
        }
        
        try {
             const response = await fetch('/api/register', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email, password, name, birthdate })
             });
             const data = await response.json();
             if (!response.ok) throw new Error(data.error || 'Error desconocido');

             alert('¡Registro exitoso! Revisa tu email para confirmar y luego inicia sesión.');
             els.formRegister?.reset();
             showLoginForm();
        } catch (error) {
             console.error("Error registro:", error);
             if (els.registerErrorEl) {
                  els.registerErrorEl.textContent = error.message.includes("already registered") ? "Email ya registrado." : `Error: ${error.message}`;
                  els.registerErrorEl.classList.remove('hidden');
             } else {
                  alert(`Error al registrar: ${error.message}`);
              }
        } 
    });

    // LOGIN CON PERSISTENCIA DE SESIÓN Y ONBOARDING
    els.formLogin?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (els.loginErrorEl) els.loginErrorEl.classList.add('hidden');
        
        const [email, password] = ['login-email', 'login-password'].map(id => document.getElementById(id)?.value);
        
        try {
            const response = await fetch('/api/login', {
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Credenciales inválidas');
            
            // Guardar sesión
            saveSession(data.user, data.session);
            
            // Mostrar app
            showApp(data.user);
            
            // Verificar onboarding
            if (!hasCompletedOnboarding()) {
                setTimeout(() => startOnboarding(), 1000);
            }
            
        } catch (error) {
            console.error("Error login:", error);
            if (els.loginErrorEl) {
                els.loginErrorEl.textContent = error.message;
                els.loginErrorEl.classList.remove('hidden');
            } else {
                alert(`Error al iniciar sesión: ${error.message}`);
            }
        } 
    });

    // FORGOT PASSWORD
    els.formForgotPassword?.addEventListener('submit', async (e) => {
         e.preventDefault();
         if (els.forgotErrorEl) els.forgotErrorEl.classList.add('hidden');
         if (els.forgotSuccessEl) els.forgotSuccessEl.classList.add('hidden');
         const email = document.getElementById('forgot-email')?.value;
         
         if (!email || !email.includes('@')) {
                 if(els.forgotErrorEl) {
                        els.forgotErrorEl.textContent = 'Email inválido.';
                        els.forgotErrorEl.classList.remove('hidden');
                      }
               return;
          }

         try {
               const response = await fetch('/api/forgot_password', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
               });
               const data = await response.json();
               if (!response.ok) throw new Error(data.error || 'Error del servidor');

               if (els.forgotSuccessEl) {
                      els.forgotSuccessEl.textContent = data.message || "Correo enviado.";
                      els.forgotSuccessEl.classList.remove('hidden');
                }
               els.formForgotPassword?.reset();
         } catch (error) {
               console.error("Error forgot password:", error);
               if (els.forgotErrorEl) {
                      els.forgotErrorEl.textContent = `Error: ${error.message}`;
                      els.forgotErrorEl.classList.remove('hidden');
               } else {
                      alert(`Error al solicitar recuperación: ${error.message}`);
                  }
         } 
     });

     // UPDATE PASSWORD
     els.formUpdatePassword?.addEventListener('submit', async (e) => {
         e.preventDefault();
         if (els.updateErrorEl) els.updateErrorEl.classList.add('hidden');
         const new_password = document.getElementById('update-password')?.value;
         const new_password_confirm = document.getElementById('update-password-confirm')?.value;

         if (!currentAccessToken) {
                 if (els.updateErrorEl) {
                      els.updateErrorEl.textContent = 'Token inválido o expirado.';
                      els.updateErrorEl.classList.remove('hidden');
                 }
               return;
         }
         
         if (new_password !== new_password_confirm) {
                 if (els.updateErrorEl) {
                      els.updateErrorEl.textContent = 'Las contraseñas no coinciden.';
                      els.updateErrorEl.classList.remove('hidden');
                 }
               return;
         }
         
         if (!new_password || new_password.length < 8) {
                 if (els.updateErrorEl) {
                      els.updateErrorEl.textContent = 'Contraseña debe tener al menos 8 caracteres.';
                      els.updateErrorEl.classList.remove('hidden');
                 }
                 return;
          }

         try {
               const response = await fetch('/api/update_password', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ access_token: currentAccessToken, new_password })
               });
               const data = await response.json();
               if (!response.ok) throw new Error(data.error || 'Error del servidor');

               alert(data.message || "Contraseña actualizada. Inicia sesión.");
               currentAccessToken = null;
               showLoginForm();
         } catch (error) {
               console.error("Error update password:", error);
               if (els.updateErrorEl) {
                      els.updateErrorEl.textContent = `Error: ${error.message}`;
                      els.updateErrorEl.classList.remove('hidden');
               } else {
                      alert(`Error al actualizar contraseña: ${error.message}`);
                }
         } 
     });

    // Auth Navigation Buttons
    els.showRegisterBtn?.addEventListener('click', showRegisterForm);
    els.showLoginBtn?.addEventListener('click', showLoginForm);
    els.showForgotPasswordBtn?.addEventListener('click', showForgotPasswordForm);

    // LOGOUT CON LIMPIEZA DE SESIÓN
    els.btnLogout?.addEventListener('click', () => {
        showConfirmDialog(
            '¿Estás seguro de que deseas cerrar sesión?',
            () => {
                clearSession();
                currentAccessToken = null;
                showAuth();
                alert('Has cerrado sesión correctamente.');
            }
        );
    });

    // Sidebar Page Navigation
    els.sidebarLinks?.forEach(link => {
        link.addEventListener('click', () => {
             const pageId = link.dataset.page;
             navigateToPage(pageId);

             if (pageId === 'page-charts') {
                  setTimeout(() => {
                        
                        if (typeof Chart !== 'undefined') {
                             loadCharts();
                        } else {
                             console.error('Chart.js no está cargado');
                             document.getElementById('charts-error')?.classList.remove('hidden');
                             document.getElementById('charts-loading')?.classList.add('hidden');
                        }
                  }, 100);
             }
        });
    });

    // --- FUNCIONALIDAD DE FOTO ---
    const fotoInput = document.getElementById('foto');
    const btnSelectFoto = document.getElementById('btn-select-foto');
    const btnRemoveFoto = document.getElementById('btn-remove-foto');
    const fotoPreview = document.getElementById('foto-preview');
    const fotoPreviewContainer = document.getElementById('foto-preview-container');
    const fotoInfo = document.getElementById('foto-info');
    const uploadProgress = document.getElementById('upload-progress');
    let selectedFile = null;
    let uploadedFotoUrl = null;

    btnSelectFoto?.addEventListener('click', () => fotoInput?.click());

    fotoInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
             alert('La foto no debe superar 5MB');
             fotoInput.value = '';
             return;
        }

        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
             alert('Formato no permitido. Use PNG, JPG o WEBP');
             fotoInput.value = '';
             return;
        }

        selectedFile = file;

        const reader = new FileReader();
        reader.onload = (event) => {
             fotoPreview.src = event.target.result;
             fotoPreviewContainer?.classList.remove('hidden');
             const sizeInKB = (file.size / 1024).toFixed(1);
             fotoInfo.textContent = `${file.name} (${sizeInKB} KB)`;
        };
        reader.readAsDataURL(file);
    });

    btnRemoveFoto?.addEventListener('click', () => {
        selectedFile = null;
        uploadedFotoUrl = null;
        fotoInput.value = '';
        fotoPreview.src = '';
        fotoPreviewContainer?.classList.add('hidden');
        fotoInfo.textContent = '';
    });

    const uploadFoto = async (file) => {
        const formData = new FormData();
        formData.append('foto', file);

        uploadProgress?.classList.remove('hidden');

        try {
             const response = await fetch('/api/upload_foto', {
                  method: 'POST',
                  body: formData
             });

             const data = await response.json();
             
             if (!response.ok) {
                  throw new Error(data.error || 'Error al subir la foto');
             }

             return data.foto_url;
        } catch (error) {
             console.error('Error uploading foto:', error);
             throw error;
        } finally {
             uploadProgress?.classList.add('hidden');
        }
    };

    // --- 8. FUNCIONALIDAD DE EDICIÓN DE ÁRBOLES ---
    const modalEditTree = document.getElementById('modal-edit-tree');
    const formEditTree = document.getElementById('form-edit-tree');
    const editFotoInput = document.getElementById('edit-foto');
    const btnSelectEditFoto = document.getElementById('btn-select-edit-foto');
    const btnRemoveEditFoto = document.getElementById('btn-remove-edit-foto');
    const editFotoPreview = document.getElementById('edit-foto-preview');
    const editFotoPreviewContainer = document.getElementById('edit-foto-preview-container');
    const editFotoInfo = document.getElementById('edit-foto-info');
    const editUploadProgress = document.getElementById('edit-upload-progress');
    const btnCloseEditModal = document.getElementById('btn-close-edit-modal');
    const btnCancelEdit = document.getElementById('btn-cancel-edit');
    const editCurrentFoto = document.getElementById('edit-current-foto');
    const editCurrentFotoContainer = document.getElementById('edit-current-foto-container');
    const editNoFotoContainer = document.getElementById('edit-no-foto-container');

    let editSelectedFile = null;
    let editUploadedFotoUrl = null;
    let currentTreeData = null;

    const openEditModal = async (arbolId) => {
        try {
             const response = await fetch(`/api/obtener_arboles`);
             if (!response.ok) throw new Error('Error al cargar datos');
             
             const arboles = await response.json();
             const arbol = arboles.find(a => a.id === parseInt(arbolId));
             
             if (!arbol) {
                  alert('Árbol no encontrado');
                  return;
             }
             currentTreeData = arbol;
             
             document.getElementById('edit-tree-id').value = arbol.id;
             document.getElementById('edit-especie').value = arbol.especie || '';
             document.getElementById('edit-latitud').value = arbol.latitud?.toFixed(6) || '';
             document.getElementById('edit-longitud').value = arbol.longitud?.toFixed(6) || '';
             
             if (arbol.foto_url) {
                  editCurrentFoto.src = arbol.foto_url;
                  editCurrentFotoContainer.classList.remove('hidden');
                  editNoFotoContainer.classList.add('hidden');
             } else {
                  editCurrentFotoContainer.classList.add('hidden');
                  editNoFotoContainer.classList.remove('hidden');
             }
             
             editSelectedFile = null;
             editUploadedFotoUrl = null;
             editFotoInput.value = '';
             editFotoPreviewContainer.classList.add('hidden');
             
             modalEditTree.classList.remove('hidden');
                  
        } catch (error) {
             console.error('Error al abrir modal de edición:', error);
             alert(`Error: ${error.message}`);
        }
    };

    const closeEditModal = () => {
        if(modalEditTree) modalEditTree.classList.add('hidden');
        if(formEditTree) formEditTree.reset();
        editSelectedFile = null;
        editUploadedFotoUrl = null;
        currentTreeData = null;
        if(editFotoPreviewContainer) editFotoPreviewContainer.classList.add('hidden');
    };

    btnCloseEditModal?.addEventListener('click', closeEditModal);
    btnCancelEdit?.addEventListener('click', closeEditModal);

    modalEditTree?.addEventListener('click', (e) => {
        if (e.target === modalEditTree) closeEditModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (modalEditTree && !modalEditTree.classList.contains('hidden')) {
                 closeEditModal();
            }
            if (els.modalConfig && els.modalConfig.classList.contains('active')) {
                els.modalConfig.classList.remove('active');
                resetProfileForm();
            }
            if (els.modalHelp && els.modalHelp.classList.contains('active')) {
                els.modalHelp.classList.remove('active');
            }
        }
    });

    btnSelectEditFoto?.addEventListener('click', () => editFotoInput?.click());

    editFotoInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
             alert('La foto no debe superar 5MB');
             editFotoInput.value = '';
             return;
        }
        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
             alert('Formato no permitido. Use PNG, JPG o WEBP');
             editFotoInput.value = '';
             return;
        }
        
        editSelectedFile = file;

        const reader = new FileReader();
        reader.onload = (event) => {
             editFotoPreview.src = event.target.result;
             editFotoPreviewContainer.classList.remove('hidden');
             
             const sizeInKB = (file.size / 1024).toFixed(1);
             editFotoInfo.textContent = `${file.name} (${sizeInKB} KB) - Esta foto reemplazará la actual`;
        };
        reader.readAsDataURL(file);
    });

    btnRemoveEditFoto?.addEventListener('click', () => {
        editSelectedFile = null;
        editUploadedFotoUrl = null;
        editFotoInput.value = '';
        editFotoPreview.src = '';
        editFotoPreviewContainer.classList.add('hidden');
        editFotoInfo.textContent = '';
    });

    formEditTree?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const arbolId = document.getElementById('edit-tree-id').value;
        const especie = document.getElementById('edit-especie').value.trim();
        
        if (!especie || especie.length < 2) {
             alert('La especie debe tener al menos 2 caracteres.');
             return;
        }
        
        const submitBtn = formEditTree.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<ion-icon name="hourglass-outline" class="inline align-middle mr-2 text-xl animate-spin"></ion-icon>Guardando...';
        
        try {
             let fotoUrlToSend = currentTreeData.foto_url; 
             
             if (editSelectedFile) {
                  try {
                       editUploadProgress.classList.remove('hidden');
                       const formData = new FormData();
                       formData.append('foto', editSelectedFile);
                       
                       const uploadResponse = await fetch('/api/upload_foto', {
                            method: 'POST',
                            body: formData
                       });
                       
                       const uploadData = await uploadResponse.json();
                       
                       if (!uploadResponse.ok) {
                            throw new Error(uploadData.error || 'Error al subir la foto');
                       }
                       
                       fotoUrlToSend = uploadData.foto_url;
                       console.log('Nueva foto subida:', fotoUrlToSend);
                           
                  } catch (error) {
                       throw new Error(`Error al subir la foto: ${error.message}`);
                  } finally {
                       editUploadProgress.classList.add('hidden');
                  }
             }
             
             const updateData = {
                  especie: especie,
                  foto_url: fotoUrlToSend
             };
             
             const response = await fetch(`/api/editar_arbol/${arbolId}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(updateData)
             });
             
             const data = await response.json();
             if (!response.ok) throw new Error(data.error || 'Error del servidor');
             
             alert(`¡Árbol "${especie}" actualizado exitosamente!${editSelectedFile ? ' (foto actualizada)' : ''}`);
             
             closeEditModal();
             
             await loadTableData();
             await cargarArboles(); 
                  
        } catch (error) {
             console.error("Error al editar árbol:", error);
             alert(`Error: ${error.message}`);
        } finally {
             submitBtn.disabled = false;
             submitBtn.innerHTML = originalBtnText;
        }
    });

    // --- FORMULARIO DE PLANTAR ---
    document.getElementById('form-plantar')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const [especie, latitud, longitud] = ['especie', 'latitud', 'longitud'].map(id => document.getElementById(id)?.value);

        if (!especie || !latitud || !longitud) {
             alert('Completa la especie y selecciona un punto en el mapa.');
             return;
        }
        if (especie.trim().length < 2) {
             alert('La especie debe tener al menos 2 caracteres.');
             return;
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<ion-icon name="hourglass-outline" class="inline align-middle mr-2 text-xl animate-spin"></ion-icon>Procesando...';

        try {
             if (selectedFile) {
                  try {
                       uploadedFotoUrl = await uploadFoto(selectedFile);
                       console.log('Foto subida:', uploadedFotoUrl);
                  } catch (error) {
                       throw new Error(`Error al subir la foto: ${error.message}`);
                  }
             }

             const response = await fetch('/api/plantar_arbol', {
                  method: 'POST', 
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                       especie: especie.trim(),
                       latitud: parseFloat(latitud),
                       longitud: parseFloat(longitud),
                       foto_url: uploadedFotoUrl || null
                  })
             });
             
             const data = await response.json();
             if (!response.ok) throw new Error(data.error || 'Error del servidor');
             
             alert(`¡Árbol "${especie}" plantado exitosamente!${selectedFile ? ' (con foto)' : ''}`);
             form.reset();
             
             if (btnRemoveFoto) btnRemoveFoto.click();
             
             if (map) {
                  const blueIcon = L.icon({
                           iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                           shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                           iconSize: [25, 41], 
                           iconAnchor: [12, 41], 
                           popupAnchor: [1, -34], 
                           shadowSize: [41, 41]
                  });
                  
                  const popupContent = `
                        <div class="text-center">
                             <b>Especie:</b> ${data.especie}<br>
                             <b>ID:</b> ${data.id}
                             ${data.foto_url ? `<br><img src="${data.foto_url}" alt="${data.especie}" style="width:100%; max-width:200px; margin-top:8px; border-radius:4px;">` : ''}
                        </div>
                  `;
                  
                  L.marker([data.latitud, data.longitud], { icon: blueIcon })
                        .addTo(map)
                        .bindPopup(popupContent);
             }
             
             if (marcadorTemporal) { 
                  marcadorTemporal.remove(); 
                  marcadorTemporal = null; 
             }
             
             await cargarStats();
             await loadTableData();
             
        } catch (error) {
             console.error("Error al plantar:", error);
             alert(`Error: ${error.message}`);
        } finally {
             submitBtn.disabled = false;
             submitBtn.innerHTML = originalBtnText;
        }
    });

    // --- TABLE ACTIONS ---
    els.tableBody?.addEventListener('click', async (e) => {
        const deleteButton = e.target.closest('.btn-delete');
        const editButton = e.target.closest('.btn-edit');
     
        if (deleteButton) {
             const arbolId = deleteButton.dataset.id;
             const filaArbol = deleteButton.closest('tr');
             const especie = filaArbol?.cells[1]?.textContent || `ID ${arbolId}`;
     
             showConfirmDialog(
                  `¿Seguro que quieres eliminar "${especie}" (ID: ${arbolId})?`,
                  async () => { 
                       try {
                            const response = await fetch(`/api/eliminar_arbol/${arbolId}`, { method: 'DELETE' });
                            const result = await response.json();
                            if (!response.ok) throw new Error(result.error || 'Error del servidor');
                            
                            alert(result.message || 'Árbol eliminado.');
                            await loadTableData(); 
                            await cargarStats(); 
                            await cargarArboles(); 
                       } catch (error) {
                            console.error("Error al eliminar:", error);
                            alert(`Error al eliminar: ${error.message}`);
                       }
                  }
             );
        } else if (editButton) {
             const arbolId = editButton.dataset.id;
             openEditModal(arbolId); 
        }
    });

    // AUTO-LOGIN Y VERIFICACIÓN DE TOKENS
    const checkUrlForToken = () => {
        const hash = window.location.hash.substring(1);
        
        if (hash) {
            const params = new URLSearchParams(hash);
            const accessToken = params.get('access_token');
            const type = params.get('type');
            
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
            
            if (type === 'recovery' && accessToken) {
                currentAccessToken = accessToken;
                showAuth();
                showUpdatePasswordForm();
                return;
            }
        }
        
        // Intentar auto-login desde localStorage
        const savedSession = getSession();
        
        if (savedSession) {
            console.log('🔄 Restaurando sesión guardada...');
            const { user, session } = savedSession;
            currentAccessToken = session.access_token;
            showApp(user);
        } else {
            console.log('👤 No hay sesión guardada, mostrando login...');
            showAuth();
        }
    };

    checkUrlForToken();

    // --- 9. FUNCIONALIDAD DE GRÁFICOS CON CHART.JS ---
    let chartArbolesMes = null;
    let chartTopEspecies = null;
    let chartEspeciesDona = null;

    if (typeof Chart !== 'undefined') {
        Chart.defaults.font.family = "'Poppins', sans-serif";
        Chart.defaults.color = '#6B7280';
    }

    const loadCharts = async () => {
        const chartsLoading = document.getElementById('charts-loading');
        const chartsContainer = document.getElementById('charts-container');
        const chartsError = document.getElementById('charts-error');

        if (chartsLoading) chartsLoading.classList.remove('hidden');
        if (chartsContainer) chartsContainer.classList.add('hidden');
        if (chartsError) chartsError.classList.add('hidden');

        try {
             console.log('Cargando datos para gráficos...');
             
             const response = await fetch('/api/estadisticas_graficos');
             if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
             
             const data = await response.json();
             console.log('Datos de gráficos recibidos:', data);

             if (chartArbolesMes) chartArbolesMes.destroy();
             if (chartTopEspecies) chartTopEspecies.destroy();
             if (chartEspeciesDona) chartEspeciesDona.destroy();

             renderChartArbolesMes(data.arboles_por_mes || {});
             renderChartTopEspecies(data.top_especies || {});
             renderChartEspeciesDona(data.top_especies || {});
             
             updateAdditionalStats(data);

             if (chartsLoading) chartsLoading.classList.add('hidden');
             if (chartsContainer) chartsContainer.classList.remove('hidden');

        } catch (error) {
             console.error('Error al cargar gráficos:', error);
             
             if (chartsLoading) chartsLoading.classList.add('hidden');
             if (chartsError) chartsError.classList.remove('hidden');
        }
    };

    const renderChartArbolesMes = (arbolesPorMes) => {
        const ctx = document.getElementById('chart-arboles-mes');
        if (!ctx) return;

        const labels = Object.keys(arbolesPorMes).map(mesAno => {
             const [year, month] = mesAno.split('-');
             const fecha = new Date(year, month - 1);
             return fecha.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
        });
        
        const values = Object.values(arbolesPorMes);

        chartArbolesMes = new Chart(ctx, {
             type: 'line',
             data: {
                  labels: labels,
                  datasets: [{
                       label: 'Árboles Plantados',
                       data: values,
                       borderColor: '#007a33',
                       backgroundColor: 'rgba(0, 122, 51, 0.1)',
                       fill: true,
                       tension: 0.4,
                       borderWidth: 3,
                       pointRadius: 5,
                       pointHoverRadius: 7,
                       pointBackgroundColor: '#007a33',
                       pointBorderColor: '#fff',
                       pointBorderWidth: 2
                  }]
             },
             options: {
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                       legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                 font: { size: 14, weight: '600' },
                                 padding: 15
                            }
                       },
                       tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            padding: 12,
                            titleFont: { size: 14, weight: 'bold' },
                            bodyFont: { size: 13 },
                            callbacks: {
                                 label: (context) => `${context.parsed.y} árboles plantados`
                            }
                       }
                  },
                  scales: {
                       y: {
                            beginAtZero: true,
                            ticks: {
                                 stepSize: 1,
                                 font: { size: 12 }
                            },
                            grid: {
                                 color: 'rgba(0, 0, 0, 0.05)'
                            }
                       },
                       x: {
                            ticks: {
                                 font: { size: 12 }
                            },
                            grid: {
                                 display: false
                            }
                       }
                  }
             }
        });
    };

    const renderChartTopEspecies = (topEspecies) => {
        const ctx = document.getElementById('chart-top-especies');
        if (!ctx) return;

        const especies = Object.keys(topEspecies);
        const cantidades = Object.values(topEspecies);

        const backgroundColors = especies.map((_, index) => {
             const hue = (index * 137.5) % 360; 
             return `hsla(${hue}, 65%, 55%, 0.8)`;
        });
        const borderColors = backgroundColors.map(color => color.replace('0.8', '1'));

        chartTopEspecies = new Chart(ctx, {
             type: 'bar',
             data: {
                  labels: especies,
                  datasets: [{
                       label: 'Cantidad de Árboles',
                       data: cantidades,
                       backgroundColor: backgroundColors,
                       borderColor: borderColors,
                       borderWidth: 2,
                       borderRadius: 8,
                       borderSkipped: false
                  }]
             },
             options: {
                  responsive: true,
                  maintainAspectRatio: false,
                  indexAxis: 'y', 
                  plugins: {
                       legend: {
                            display: false
                       },
                       tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            padding: 12,
                            titleFont: { size: 14, weight: 'bold' },
                            bodyFont: { size: 13 },
                            callbacks: {
                                 label: (context) => `${context.parsed.x} árboles`
                            }
                       }
                  },
                  scales: {
                       x: {
                            beginAtZero: true,
                            ticks: {
                                 stepSize: 1,
                                 font: { size: 12 }
                            },
                            grid: {
                                 color: 'rgba(0, 0, 0, 0.05)'
                            }
                       },
                       y: {
                            ticks: {
                                 font: { size: 12, weight: '500' }
                            },
                            grid: {
                                 display: false
                            }
                       }
                  }
             }
        });
    };

    const renderChartEspeciesDona = (topEspecies) => {
        const ctx = document.getElementById('chart-especies-dona');
        if (!ctx) return;

        const especies = Object.keys(topEspecies).slice(0, 5);
        const cantidades = Object.values(topEspecies).slice(0, 5);

        const colors = [
             'rgba(0, 122, 51, 0.8)',   
             'rgba(16, 185, 129, 0.8)',  
             'rgba(59, 130, 246, 0.8)',  
             'rgba(139, 92, 246, 0.8)',  
             'rgba(249, 115, 22, 0.8)'   
        ];

        chartEspeciesDona = new Chart(ctx, {
             type: 'doughnut',
             data: {
                  labels: especies,
                  datasets: [{
                       data: cantidades,
                       backgroundColor: colors,
                       borderColor: '#fff',
                       borderWidth: 3,
                       hoverOffset: 15
                  }]
             },
             options: {
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                       legend: {
                            position: 'right',
                            labels: {
                                 font: { size: 13, weight: '500' },
                                 padding: 15,
                                 generateLabels: (chart) => {
                                       const data = chart.data;
                                       return data.labels.map((label, i) => ({
                                            text: `${label} (${data.datasets[0].data[i]})`,
                                            fillStyle: data.datasets[0].backgroundColor[i],
                                            hidden: false,
                                            index: i
                                       }));
                                 }
                            }
                       },
                       tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            padding: 12,
                            titleFont: { size: 14, weight: 'bold' },
                            bodyFont: { size: 13 },
                            callbacks: {
                                 label: (context) => {
                                       const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                       const percentage = ((context.parsed / total) * 100).toFixed(1);
                                       return `${context.parsed} árboles (${percentage}%)`;
                                 }
                            }
                       }
                  }
             }
        });
    };

    const updateAdditionalStats = (data) => {
        const arbolesPorMes = data.arboles_por_mes || {};
        const topEspecies = data.top_especies || {};

        const totalArboles = Object.values(arbolesPorMes).reduce((a, b) => a + b, 0);
        const totalArbolesEl = document.getElementById('chart-total-trees');
        if (totalArbolesEl) totalArbolesEl.textContent = totalArboles;

        const especiesUnicas = Object.keys(topEspecies).length;
        const especiesUnicasEl = document.getElementById('chart-unique-species');
        if (especiesUnicasEl) especiesUnicasEl.textContent = especiesUnicas;

        if (Object.keys(arbolesPorMes).length > 0) {
             const mesActivo = Object.entries(arbolesPorMes).reduce((a, b) => a[1] > b[1] ? a : b);
             const [year, month] = mesActivo[0].split('-');
             const fecha = new Date(year, month - 1);
             const mesNombre = fecha.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
             
             const mesActivoEl = document.getElementById('chart-most-active-month');
             if (mesActivoEl) mesActivoEl.textContent = mesNombre;
        }

        const mesesConDatos = Object.keys(arbolesPorMes).length;
        const promedio = mesesConDatos > 0 ? (totalArboles / mesesConDatos).toFixed(1) : 0;
        const promedioEl = document.getElementById('stat-promedio-mes');
        if (promedioEl) promedioEl.textContent = promedio;

        if (Object.keys(topEspecies).length > 0) {
             const especieTop = Object.entries(topEspecies)[0];
             const especieTopEl = document.getElementById('stat-top-especie');
             if (especieTopEl) especieTopEl.textContent = `${especieTop[0]} (${especieTop[1]})`;
        }

        const ultimoRegistroEl = document.getElementById('stat-ultimo-registro');
        if (ultimoRegistroEl && Object.keys(arbolesPorMes).length > 0) {
             const ultimoMes = Object.keys(arbolesPorMes).pop();
             const [year, month] = ultimoMes.split('-');
             const fecha = new Date(year, month - 1);
             ultimoRegistroEl.textContent = fecha.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
        }
    };

    document.getElementById('btn-refresh-charts')?.addEventListener('click', loadCharts);
    document.getElementById('btn-retry-charts')?.addEventListener('click', loadCharts);

    // --- 10. FUNCIONALIDAD DE MODO OSCURO ---
    const btnToggleDarkMode = document.getElementById('btn-toggle-dark-mode');
    const iconDarkMode = document.getElementById('icon-dark-mode');

    const initDarkMode = () => {
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
             enableDarkMode();
        } else {
             disableDarkMode();
        }
    };

    const enableDarkMode = () => {
        document.documentElement.setAttribute('data-theme', 'dark');
        if (iconDarkMode) iconDarkMode.name = 'sunny-outline';
        localStorage.setItem('theme', 'dark');
    };

    const disableDarkMode = () => {
        document.documentElement.removeAttribute('data-theme');
        if (iconDarkMode) iconDarkMode.name = 'moon-outline';
        localStorage.setItem('theme', 'light');
    };

    btnToggleDarkMode?.addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        
        if (isDark) {
             disableDarkMode();
        } else {
             enableDarkMode();
        }
        
        const chartsPage = document.getElementById('page-charts');
        if (chartsPage && !chartsPage.classList.contains('hidden')) {
             setTimeout(() => {
                  if (chartArbolesMes) chartArbolesMes.destroy();
                  if (chartTopEspecies) chartTopEspecies.destroy();
                  if (chartEspeciesDona) chartEspeciesDona.destroy();
                  loadCharts();
             }, 100);
        }
    });

    initDarkMode();

    // MODAL DE CONFIGURACIÓN DE PERFIL - VERSIÓN MEJORADA
    const openConfigModal = () => {
        if (!els.modalConfig) return;
        
        if (!currentUser) {
            console.error("No hay usuario logueado para cargar el perfil.");
            els.profileName.value = "Usuario";
            els.profileEmail.value = "correo@ejemplo.com";
            els.avatarInitials.textContent = "U";
            return;
        }

        els.modalConfig.classList.add('active');
        
        // Cargar datos actuales del usuario
        const userName = currentUser.user_metadata?.name || currentUser.name || currentUser.email?.split('@')[0] || 'Usuario';
        const userEmail = currentUser.email || '';
        const userBirthdate = currentUser.user_metadata?.birthdate || currentUser.birthdate || '';
        const avatarUrl = currentUser.user_metadata?.avatar_url || currentUser.avatar_url || '';

        if (els.profileName) els.profileName.value = userName;
        if (els.profileEmail) els.profileEmail.value = userEmail;
        if (els.profileBirthdate) els.profileBirthdate.value = userBirthdate;
        
        // Mostrar avatar o iniciales
        profileSelectedFile = null;
        if (els.avatarInput) els.avatarInput.value = '';
        
        if (avatarUrl && els.avatarPreview) {
            // Mostrar imagen de avatar
            els.avatarPreview.innerHTML = `
                <img src="${avatarUrl}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">
                <div class="avatar-upload-overlay">
                    <ion-icon name="camera-outline" class="text-4xl text-white"></ion-icon>
                </div>
            `;
        } else {
            // Mostrar iniciales
            const initials = getInitials(userName);
            if (els.avatarPreview) {
                els.avatarPreview.innerHTML = `
                    <span id="avatar-initials">${initials}</span>
                    <div class="avatar-upload-overlay">
                        <ion-icon name="camera-outline" class="text-4xl text-white"></ion-icon>
                    </div>
                `;
            }
            if (els.avatarInitials) els.avatarInitials.textContent = initials;
        }
    };

    const openHelpModal = () => {
        if (!els.modalHelp) return;
        els.modalHelp.classList.add('active');
    };

    // Cerrar modales
    els.closeConfigBtn?.addEventListener('click', () => {
        els.modalConfig?.classList.remove('active');
        resetProfileForm();
    });

    els.closeHelpBtn?.addEventListener('click', () => {
        els.modalHelp?.classList.remove('active');
    });

    els.cancelBtn?.addEventListener('click', () => {
        els.modalConfig?.classList.remove('active');
        resetProfileForm();
    });

    // Cerrar al hacer clic fuera
    [els.modalConfig, els.modalHelp].forEach(modal => {
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
                if (modal === els.modalConfig) {
                    resetProfileForm();
                }
            }
        });
    });

    // Cambiar avatar
    els.changeAvatarBtn?.addEventListener('click', () => {
        els.avatarInput?.click();
    });

    els.avatarInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            showProfileError('La imagen no debe superar 5MB');
            return;
        }
        
        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            showProfileError('Formato no permitido. Use PNG, JPG o WEBP');
            return;
        }

        profileSelectedFile = file;

        const reader = new FileReader();
        reader.onload = (event) => {
            if (!els.avatarPreview) return;
            els.avatarPreview.innerHTML = '';
            
            const img = document.createElement('img');
            img.src = event.target.result;
            img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; border-radius: 50%;';
            els.avatarPreview.appendChild(img);

            const overlay = document.createElement('div');
            overlay.className = 'avatar-upload-overlay';
            overlay.innerHTML = '<ion-icon name="camera-outline" class="text-4xl text-white"></ion-icon>';
            els.avatarPreview.appendChild(overlay);
        };
        reader.readAsDataURL(file);
    });

    // Enviar formulario de perfil
    els.profileForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = els.profileName.value.trim();
        const birthdate = els.profileBirthdate.value;
        const currentPassword = els.currentPassword.value;
        const newPassword = els.newPassword.value;
        const confirmPassword = els.confirmPassword.value;

        // Validaciones
        if (!name || name.length < 2) {
            showProfileError('El nombre debe tener al menos 2 caracteres');
            return;
        }

        // Validación de cambio de contraseña
        if (currentPassword || newPassword || confirmPassword) {
            if (!currentPassword) {
                showProfileError('Debes ingresar tu contraseña actual');
                return;
            }
            if (newPassword.length < 8) {
                showProfileError('La nueva contraseña debe tener al menos 8 caracteres');
                return;
            }
            if (newPassword !== confirmPassword) {
                showProfileError('Las contraseñas nuevas no coinciden');
                return;
            }
        }

        const submitBtn = els.profileForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<ion-icon name="hourglass-outline" class="inline align-middle mr-2 text-xl animate-spin"></ion-icon>Guardando...';

        try {
            let avatarUrl = currentUser.user_metadata?.avatar_url || currentUser.avatar_url || null;
            
            // 1. Si hay un avatar nuevo, subirlo primero
            if (profileSelectedFile) {
                const savedSession = getSession();
                if (!savedSession) {
                    throw new Error('Sesión no válida');
                }
                
                const formData = new FormData();
                formData.append('avatar', profileSelectedFile);
                
                const uploadResponse = await fetch('/api/upload_avatar', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${savedSession.session.access_token}`
                    },
                    body: formData
                });
                
                const uploadData = await uploadResponse.json();
                if (!uploadResponse.ok) {
                    throw new Error(uploadData.error || 'Error al subir avatar');
                }
                
                avatarUrl = uploadData.avatar_url;
                console.log('✅ Avatar subido:', avatarUrl);
            }
            
            // 2. Actualizar perfil
            const savedSession = getSession();
            if (!savedSession) {
                throw new Error('Sesión no válida');
            }
            
            const updateData = {
                name: name,
                birthdate: birthdate,
                avatar_url: avatarUrl
            };
            
            // Agregar contraseñas si se quiere cambiar
            if (currentPassword && newPassword) {
                updateData.current_password = currentPassword;
                updateData.new_password = newPassword;
            }
            
            const response = await fetch('/api/update_profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${savedSession.session.access_token}`
                },
                body: JSON.stringify(updateData)
            });
            
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Error al actualizar perfil');
            }
            
            console.log('✅ Perfil actualizado:', data);
            
            // 3. Actualizar usuario global y localStorage
            currentUser = data.user;
            saveSession(data.user, savedSession.session);
            
            // 4. Actualizar UI globalmente
            updateUserInfo(name, currentUser.email);
            
            // 5. Actualizar preview del avatar en el modal si cambió
            if (avatarUrl && els.avatarPreview) {
                els.avatarPreview.innerHTML = `
                    <img src="${avatarUrl}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">
                    <div class="avatar-upload-overlay">
                        <ion-icon name="camera-outline" class="text-4xl text-white"></ion-icon>
                    </div>
                `;
            }
            
            showProfileSuccess();
            profileSelectedFile = null;

            setTimeout(() => {
                els.modalConfig?.classList.remove('active');
                resetProfileForm();
            }, 2000);

        } catch (error) {
            console.error("Error al actualizar perfil:", error);
            showProfileError('Error al actualizar el perfil: ' + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    });

    function showProfileSuccess() {
        els.successMsg?.classList.add('show');
        els.errorMsg?.classList.remove('show');
        setTimeout(() => {
            els.successMsg?.classList.remove('show');
        }, 3000);
    }

    function showProfileError(message) {
        if (els.errorText) els.errorText.textContent = message;
        els.errorMsg?.classList.add('show');
        els.successMsg?.classList.remove('show');
        setTimeout(() => {
            els.errorMsg?.classList.remove('show');
        }, 5000);
    }

    function resetProfileForm() {
        els.successMsg?.classList.remove('show');
        els.errorMsg?.classList.remove('show');
        if (els.currentPassword) els.currentPassword.value = '';
        if (els.newPassword) els.newPassword.value = '';
        if (els.confirmPassword) els.confirmPassword.value = '';
        
        // Restablecer visibilidad de contraseñas
        els.togglePasswordIcons?.forEach(icon => {
            const targetId = icon.dataset.target;
            const input = document.getElementById(targetId);
            if (input) input.type = 'password';
            icon.name = 'eye-outline';
        });
    }

    // ========================================
    // SISTEMA DE ONBOARDING CORREGIDO
    // ========================================

    let currentOnboardingStep = 0;

    const onboardingSteps = [
        {
            title: "¡Bienvenido a Reforesta Manabí! 🌳",
            description: "Te mostraremos cómo usar la plataforma para registrar árboles y contribuir a la reforestación. Este tour tomará menos de 1 minuto.",
            icon: "leaf",
            target: null,
            position: "center"
        },
        {
            title: "Registra tu primer árbol 🌱",
            description: "Haz clic en el mapa para seleccionar la ubicación donde plantaste el árbol. Luego completa la especie y opcionalmente añade una foto.",
            icon: "location",
            target: "#map",
            position: "center-below" 
        },
        {
            title: "Visualiza tus registros 📋",
            description: "Aquí verás todos los árboles plantados con detalles completos. Puedes editar o eliminar registros haciendo clic en los iconos de acción.",
            icon: "list",
            target: '[data-page="page-table"]',
            position: "right"
        },
        {
            title: "Estadísticas en tiempo real 📊",
            description: "Consulta gráficos detallados sobre árboles plantados, especies más comunes y tendencias mensuales de reforestación.",
            icon: "stats-chart",
            target: '[data-page="page-charts"]',
            position: "right"
        },
        {
            title: "Tu perfil y configuración ⚙️",
            description: "Haz clic en tu avatar para actualizar tu información personal, cambiar tu contraseña y personalizar tu experiencia. ¡Ahora estás listo para comenzar!",
            icon: "person-circle",
            target: "#user-avatar",
            position: "bottom-left"
        }
    ];

    const startOnboarding = () => {
        currentOnboardingStep = 0;
        const overlay = document.getElementById('onboarding-overlay');
        if (!overlay) {
            console.error('❌ Elemento de onboarding no encontrado');
            return;
        }
        
        // Asegurarse de que estamos en la página del mapa
        navigateToPage('page-map');
        
        overlay.classList.remove('hidden');
        
        // Pequeño delay para que el DOM se actualice
        setTimeout(() => {
            showOnboardingStep(0);
        }, 100);
    };

    const showOnboardingStep = (stepIndex) => {
        const step = onboardingSteps[stepIndex];
        if (!step) return;
        
        // ✅ CORRECCIÓN: Asegurar z-index bajo del mapa
        if (map && map.getContainer()) {
            map.getContainer().style.zIndex = '1';
            map.getContainer().style.position = 'relative';
        }
        
        // ✅ NUEVO: Forzar recalculación del mapa si es el paso del mapa
        if (step.target === '#map' && map) {
            setTimeout(() => {
                map.invalidateSize();
                // Asegurar que el mapa esté por debajo
                const mapContainer = document.querySelector('#map');
                if (mapContainer) {
                    mapContainer.style.zIndex = '1';
                }
            }, 100);
        }
        
        // Actualizar contenido del tooltip
        const titleEl = document.getElementById('onboarding-title');
        const descEl = document.getElementById('onboarding-description');
        const iconEl = document.getElementById('onboarding-icon');
        const counterEl = document.getElementById('onboarding-step-counter');
        const nextBtn = document.getElementById('onboarding-next');
        const prevBtn = document.getElementById('onboarding-prev');
        
        if (titleEl) titleEl.textContent = step.title;
        if (descEl) descEl.textContent = step.description;
        if (counterEl) counterEl.textContent = `${stepIndex + 1}/${onboardingSteps.length}`;
        
        // Actualizar icono
        if (iconEl) {
            iconEl.innerHTML = `<ion-icon name="${step.icon}" class="text-3xl text-white"></ion-icon>`;
        }
        
        // Actualizar botones
        if (prevBtn) {
            if (stepIndex === 0) {
                prevBtn.classList.add('hidden');
            } else {
                prevBtn.classList.remove('hidden');
            }
        }
        
        if (nextBtn) {
            if (stepIndex === onboardingSteps.length - 1) {
                nextBtn.innerHTML = '<ion-icon name="checkmark-outline" class="inline align-middle mr-1"></ion-icon>¡Entendido!';
            } else {
                nextBtn.textContent = 'Siguiente';
            }
        }
        
        // Actualizar dots indicadores
        const dots = document.querySelectorAll('.onboarding-dot');
        dots.forEach((dot, index) => {
            if (index === stepIndex) {
                dot.classList.remove('bg-gray-300');
                dot.classList.add('bg-repsol-green');
            } else {
                dot.classList.remove('bg-repsol-green');
                dot.classList.add('bg-gray-300');
            }
        });
        
        // Manejar spotlight y tooltip
        const spotlight = document.getElementById('onboarding-spotlight');
        const tooltip = document.getElementById('onboarding-tooltip');
        
        // Limpiar highlights anteriores
        document.querySelectorAll('.onboarding-highlight').forEach(el => {
            el.classList.remove('onboarding-highlight');
            el.style.position = '';
            el.style.zIndex = '';
        });
        
        if (step.target) {
            const targetEl = document.querySelector(step.target);
            
            if (!targetEl) {
                console.warn(`⚠️ Elemento no encontrado: ${step.target}`);
                positionTooltipCenter(tooltip, spotlight);
                return;
            }
            
            // Hacer scroll al elemento si está fuera de vista
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Esperar un momento para que termine el scroll
            setTimeout(() => {
                // ✅ CORRECCIÓN: No aplicar z-index alto si es el mapa
                if (step.target !== '#map') {
                    targetEl.classList.add('onboarding-highlight');
                } else {
                    // Para el mapa, solo agregar borde visual sin cambiar z-index
                    targetEl.style.outline = '4px solid rgba(0, 122, 51, 0.6)';
                    targetEl.style.outlineOffset = '4px';
                }
                
                // Calcular posición del elemento
                const rect = targetEl.getBoundingClientRect();
                const padding = 10;
                
                // Posicionar spotlight
                if (spotlight) {
                    spotlight.style.top = `${rect.top - padding}px`;
                    spotlight.style.left = `${rect.left - padding}px`;
                    spotlight.style.width = `${rect.width + padding * 2}px`;
                    spotlight.style.height = `${rect.height + padding * 2}px`;
                    spotlight.classList.remove('hidden');
                }
                
                // Posicionar tooltip según la posición definida
                if (tooltip) {
                    positionTooltip(tooltip, rect, step.position);
                }
            }, 300);
            
        } else {
            // Sin target, centrar tooltip
            positionTooltipCenter(tooltip, spotlight);
        }
    };

    const positionTooltip = (tooltip, targetRect, position) => {
        if (!tooltip) return;
        
        tooltip.style.position = 'fixed';
        tooltip.style.maxWidth = '28rem';
        tooltip.style.width = 'calc(100% - 2rem)';
        
        const tooltipRect = tooltip.getBoundingClientRect();
        const spacing = 20;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let top, left;
        
        switch(position) {
            case 'right':
                top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
                left = targetRect.right + spacing;
                
                // Si se sale de la pantalla, cambiar a left
                if (left + tooltipRect.width > viewportWidth) {
                    left = targetRect.left - tooltipRect.width - spacing;
                }
                break;
                
            case 'left':
                top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
                left = targetRect.left - tooltipRect.width - spacing;
                
                // Si se sale de la pantalla, cambiar a right
                if (left < 0) {
                    left = targetRect.right + spacing;
                }
                break;
                
            case 'bottom':
                top = targetRect.bottom + spacing;
                left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
                break;
                
            case 'bottom-left':
                top = targetRect.bottom + spacing;
                left = targetRect.left - tooltipRect.width + targetRect.width;
                
                // Ajustar si se sale por la izquierda
                if (left < spacing) {
                    left = spacing;
                }
                break;
                
            case 'center-below':
                top = targetRect.bottom + spacing;
                left = (viewportWidth / 2) - (tooltipRect.width / 2);
                break;
                
            default: // center
                top = (viewportHeight / 2) - (tooltipRect.height / 2);
                left = (viewportWidth / 2) - (tooltipRect.width / 2);
        }
        
        // Asegurar que no se salga de la pantalla
        top = Math.max(spacing, Math.min(top, viewportHeight - tooltipRect.height - spacing));
        left = Math.max(spacing, Math.min(left, viewportWidth - tooltipRect.width - spacing));
        
        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;
        tooltip.style.transform = 'none';
    };

    const positionTooltipCenter = (tooltip, spotlight) => {
        if (spotlight) spotlight.classList.add('hidden');
        
        if (tooltip) {
            tooltip.style.position = 'fixed';
            tooltip.style.top = '50%';
            tooltip.style.left = '50%';
            tooltip.style.transform = 'translate(-50%, -50%)';
            tooltip.style.maxWidth = '28rem';
            tooltip.style.width = 'calc(100% - 2rem)';
        }
    };

    const endOnboarding = () => {
        const overlay = document.getElementById('onboarding-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
        
        // Limpiar highlights y estilos
        document.querySelectorAll('.onboarding-highlight').forEach(el => {
            el.classList.remove('onboarding-highlight');
            el.style.position = '';
            el.style.zIndex = '';
            el.style.outline = ''; // ✅ NUEVO: Limpiar outline del mapa
            el.style.outlineOffset = '';
        });
        
        // ✅ CORRECCIÓN: Restaurar z-index del mapa
        const mapEl = document.getElementById('map');
        if (mapEl) {
            mapEl.style.zIndex = '1';
            mapEl.style.position = 'relative';
        }
        
        // ✅ CORRECCIÓN: Forzar re-renderizado del mapa
        if (map) {
            setTimeout(() => {
                map.invalidateSize();
                console.log('🗺️ Mapa recalibrado después de onboarding');
            }, 100);
        }
        
        // Marcar como completado
        markOnboardingCompleted();
        console.log('✅ Onboarding completado');
        
        // Mostrar mensaje de éxito
        alert('¡Tour completado! 🎉\n\nYa conoces las funciones básicas de Reforesta Manabí.\nPuedes volver a ver este tour desde el menú de Ayuda.');
    };

    // Event listeners del onboarding
    document.getElementById('onboarding-next')?.addEventListener('click', () => {
        currentOnboardingStep++;
        if (currentOnboardingStep >= onboardingSteps.length) {
            endOnboarding();
        } else {
            showOnboardingStep(currentOnboardingStep);
        }
    });

    document.getElementById('onboarding-prev')?.addEventListener('click', () => {
        if (currentOnboardingStep > 0) {
            currentOnboardingStep--;
            showOnboardingStep(currentOnboardingStep);
        }
    });

    document.getElementById('onboarding-skip')?.addEventListener('click', () => {
        showConfirmDialog(
            '¿Seguro que quieres omitir el tour? Puedes volver a verlo desde el menú de Ayuda.',
            () => {
                endOnboarding();
            }
        );
    });

    // Detectar redimensionamiento de ventana para reposicionar
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            const overlay = document.getElementById('onboarding-overlay');
            if (overlay && !overlay.classList.contains('hidden')) {
                showOnboardingStep(currentOnboardingStep);
            }
        }, 250);
    });

    // Agregar opción para reiniciar onboarding en el modal de ayuda
    const addRestartOnboardingOption = () => {
        const helpModal = document.getElementById('modal-help');
        if (!helpModal) return;
        
        const helpContent = helpModal.querySelector('.modal-content .space-y-6');
        if (!helpContent) return;
        
        // Verificar si ya existe para no duplicar
        if (document.getElementById('restart-onboarding-btn')) return;
        
        const restartButton = document.createElement('div');
        restartButton.id = 'restart-onboarding-btn';
        restartButton.className = 'border-2 border-repsol-green rounded-lg p-4 bg-green-50 cursor-pointer hover:bg-green-100 transition-all duration-200 hover:shadow-md';
        restartButton.innerHTML = `
            <h3 class="font-semibold text-gray-900 mb-2 flex items-center">
                <ion-icon name="refresh-outline" class="text-repsol-green mr-2 text-xl"></ion-icon>
                Ver tour de bienvenida nuevamente
            </h3>
            <p class="text-gray-600 text-sm">
                Si necesitas repasar cómo usar la plataforma, haz clic aquí para ver el tour interactivo otra vez.
            </p>
        `;
        
        restartButton.addEventListener('click', () => {
            document.getElementById('modal-help')?.classList.remove('active');
            setTimeout(() => startOnboarding(), 300);
        });
        
        // Insertar al final del contenido de ayuda
        helpContent.appendChild(restartButton);
        console.log('✅ Botón de reinicio de onboarding agregado');
    };

    // Botón flotante de ayuda
    if (els.floatingHelpBtn) {
        els.floatingHelpBtn.addEventListener('click', () => {
            startOnboarding();
        });
    }

    // Ejecutar cuando el DOM esté listo
    setTimeout(addRestartOnboardingOption, 1000);

}); // Fin DOMContentLoaded