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
        btnLogout: document.getElementById('btn-logout'), // Dentro del dropdown ahora
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
        headerSearch: document.getElementById('header-search'),
        statArboles: document.getElementById('stat-arboles'), // Añadido para caché
        statHoras: document.getElementById('stat-horas') // Añadido para caché
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
        if (!name || typeof name !== 'string') return '?';
        const parts = name.trim().split(' ').filter(part => part.length > 0);
        if (parts.length === 0) return '?';
        if (parts.length === 1) return parts[0][0].toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    };

    const updateUserInfo = (userName, userEmail) => {
        const nameToDisplay = userName || userEmail?.split('@')[0] || 'Usuario';
        const emailToDisplay = userEmail || 'correo@ejemplo.com';
        
        if (els.userNameMenu) els.userNameMenu.textContent = nameToDisplay;
        if (els.userEmailMenu) els.userEmailMenu.textContent = emailToDisplay;
        if (els.userInitials) els.userInitials.textContent = getInitials(nameToDisplay);
        if (els.welcomeUserNameEl) els.welcomeUserNameEl.textContent = nameToDisplay.split(' ')[0];
    };

    const hideAllAuthForms = () => {
        [els.formLogin, els.formRegister, els.formForgotPassword, els.formUpdatePassword, els.registerLink, els.showLoginDiv]
            .filter(Boolean) // Filtrar elementos nulos si algún ID no existe
            .forEach(el => el.classList.add('hidden'));
    };

    // --- 3. LÓGICA DE VISTAS ---
    const showApp = (user) => {
        els.authContainer?.classList.add('hidden');
        els.appContainer?.classList.remove('hidden');
        if (user) {
            updateUserInfo(user.name || user.email?.split('@')[0], user.email);
        }
        showPage('page-map'); // Mostrar mapa por defecto
        initializeMapIfNeeded(); // Asegurar que el mapa se inicializa
        loadAppData(); // Cargar datos necesarios para la app
    };

    const showAuth = () => {
        els.authContainer?.classList.remove('hidden');
        els.appContainer?.classList.add('hidden');
        updateUserInfo('Usuario', 'usuario@ejemplo.com'); // Resetear UI
        els.userMenu?.classList.remove('active');
        els.langMenu?.classList.remove('active'); // Cerrar menú de idioma también
        if (map) { map.remove(); map = null; marcadorTemporal = null;} // Limpiar mapa
        showLoginForm(); // Mostrar login por defecto
    };

    const showAuthForm = (formId, title) => {
         hideAllAuthForms();
         if (els.authTitle) els.authTitle.textContent = title;

         const formElement = els[formId]; // Usar caché
         if (formElement) {
             formElement.classList.remove('hidden');
             // Podríamos añadir FormValidator.clearAllErrors(formElement) aquí si lo tuviéramos
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
    
    const showPage = (pageId) => {
        els.pageContents?.forEach(page => page.classList.add('hidden'));
        const pageToShow = document.getElementById(pageId); // Re-buscar por si acaso
        if (pageToShow) {
             pageToShow.classList.remove('hidden');
        } else {
            // Fallback a mapa si la página no existe
            pageId = 'page-map';
            document.getElementById(pageId)?.classList.remove('hidden');
        }

        // Initialize map only when navigating to it and it doesn't exist
        if (pageId === 'page-map') {
            setTimeout(initializeMapIfNeeded, 50); // Delay slightly for render
        }
        // Refresh table data when navigating to table
        if (pageId === 'page-table') {
            loadTableData();
        }

        // Update sidebar
        els.sidebarLinks?.forEach(link => {
            const isActive = link.dataset.page === pageId;
            link.classList.toggle('sidebar-active', isActive);
            // text-white is handled by sidebar-active now? Check CSS
        });

        // Clear search on page change
        if (els.headerSearch) els.headerSearch.value = '';
        if (pageId === 'page-table') filterTable(''); // Reset table filter
    };

    // --- 4. LÓGICA DEL MAPA ---
    const initializeMapIfNeeded = () => {
        if (map || !document.getElementById('map')) return; // Check if already exists or container is gone

        console.log('Initializing map...');
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
                // Usar icono rojo para el temporal
                const redIcon = L.icon({
                     iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                     shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                     iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
                 });
                marcadorTemporal = L.marker(e.latlng, { draggable: true, icon: redIcon }).addTo(map);
                 // Actualizar coords al arrastrar
                 marcadorTemporal.on('dragend', (ev) => {
                     const movedLatLng = ev.target.getLatLng();
                     document.getElementById('latitud').value = movedLatLng.lat.toFixed(6);
                     document.getElementById('longitud').value = movedLatLng.lng.toFixed(6);
                 });
            }
             map.panTo(e.latlng); // Centrar en el marcador temporal
        });
         map.invalidateSize(); // Asegurar tamaño correcto
        cargarArboles(); // Cargar árboles existentes al iniciar
    };

    // --- 5. CARGA DE DATOS ---
    const cargarArboles = async () => {
        if (!map) return; // No cargar si el mapa no está listo
        console.log("Cargando árboles plantados...");
        try {
            const response = await fetch('/api/obtener_arboles');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const arboles = await response.json();
            
            // Limpiar marcadores anteriores (excepto los predefinidos y el temporal)
            map.eachLayer(layer => {
                 if (layer instanceof L.Marker && layer !== marcadorTemporal && !layer.options.icon?.options?.iconUrl.includes('green')) {
                     map.removeLayer(layer);
                 }
             });

            arboles.forEach(arbol => {
                 // Usar icono azul por defecto para árboles plantados
                 const blueIcon = L.icon({
                     iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                     shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                     iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
                 });
                L.marker([arbol.latitud, arbol.longitud], { icon: blueIcon })
                    .addTo(map)
                    .bindPopup(`<b>Especie:</b> ${arbol.especie || 'N/A'}<br><b>ID:</b> ${arbol.id}`);
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
             // Reset stats on error
             if (els.statArboles) els.statArboles.textContent = '0';
             if (els.statHoras) els.statHoras.textContent = '0.0';
             // alert("Error al cargar estadísticas."); // Puede ser molesto
         }
    };

    const loadTableData = async () => {
        if (!els.tableBody) return;
        console.log("Cargando datos de la tabla...");
        // Podríamos añadir un estado de carga aquí
        els.tableBody.innerHTML = '<tr><td colspan="7" class="text-center p-4 text-gray-500">Cargando...</td></tr>'; // Colspan 7 ahora

        try {
            const response = await fetch('/api/obtener_arboles');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const arboles = await response.json();
            els.tableBody.innerHTML = ''; // Limpiar tabla

            if (!arboles || arboles.length === 0) {
                els.tableBody.innerHTML = '<tr><td colspan="7" class="text-center p-4 text-gray-500">No hay árboles registrados.</td></tr>'; // Colspan 7
                return;
            }

             // Ordenar por fecha más reciente (el backend ya lo hace, pero doble seguro)
             arboles.sort((a, b) => new Date(b.fecha_siembra) - new Date(a.fecha_siembra));

            arboles.forEach(arbol => {
                let fecha = 'Inválida';
                try {
                     fecha = new Date(arbol.fecha_siembra).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short', hour12: true });
                } catch (e) { console.warn(`Fecha inválida: ${arbol.fecha_siembra}`); }
                
                const usuario = arbol.user_email || 'Desconocido';

                els.tableBody.innerHTML += `
                    <tr class="hover:bg-gray-50 transition-colors" data-id="${arbol.id}">
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${arbol.id}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${arbol.especie || 'N/A'}</td>
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
            els.tableBody.innerHTML = '<tr><td colspan="7" class="text-center p-4 text-red-600">Error al cargar datos.</td></tr>'; // Colspan 7
        }
    };

     // Carga inicial de datos al mostrar la app
     const loadAppData = async () => {
         console.log("Cargando datos iniciales de la aplicación...");
         // Podríamos mostrar un spinner global aquí
         try {
             await Promise.all([
                 cargarStats(),
                 loadTableData() // Carga la tabla por defecto
             ]);
         } catch(error) {
              console.error("Error al cargar datos de la app:", error);
              alert("Error al cargar los datos iniciales de la aplicación.");
          } finally {
              // Ocultar spinner global
          }
      };

    // --- 6. DIÁLOGO DE CONFIRMACIÓN ---
    const showConfirmDialog = (message, onConfirm) => {
         const existingDialog = document.getElementById('confirm-dialog');
         if (existingDialog) existingDialog.remove(); // Remove previous if any

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
        dialog.addEventListener('click', (e) => { if (e.target === dialog) closeDialog(); }); // Click outside

         const escKeyHandler = (e) => { if (e.key === 'Escape') closeDialog(); };
        document.addEventListener('keydown', escKeyHandler);
    };

    // --- 7. EVENT LISTENERS ---
    
    // Auth Forms
    els.formRegister?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (els.registerErrorEl) els.registerErrorEl.classList.add('hidden');
        const [email, password, name, birthdate] = ['register-email', 'register-password', 'register-name', 'register-birth-date'].map(id => document.getElementById(id)?.value);

        if (!birthdate) {
            if (els.registerErrorEl) {
                 els.registerErrorEl.textContent = "Fecha de nacimiento requerida.";
                 els.registerErrorEl.classList.remove('hidden');
            }
            return;
        }
        
        // Podríamos añadir validación aquí con FormValidator si lo tuviéramos
        
        // Mostrar spinner si tuviéramos LoadingManager
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
        } finally {
            // Ocultar spinner
        }
    });

    els.formLogin?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (els.loginErrorEl) els.loginErrorEl.classList.add('hidden');
        const [email, password] = ['login-email', 'login-password'].map(id => document.getElementById(id)?.value);
        
        // Podríamos añadir validación aquí
        
        // Mostrar spinner
        try {
            const response = await fetch('/api/login', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Credenciales inválidas');
            
            showApp(data.user); // Llama a cargar datos dentro
        } catch (error) {
             console.error("Error login:", error);
             if (els.loginErrorEl) {
                 els.loginErrorEl.textContent = error.message;
                 els.loginErrorEl.classList.remove('hidden');
             } else {
                 alert(`Error al iniciar sesión: ${error.message}`);
             }
        } finally {
             // Ocultar spinner
         }
    });

    els.formForgotPassword?.addEventListener('submit', async (e) => {
         e.preventDefault();
         if (els.forgotErrorEl) els.forgotErrorEl.classList.add('hidden');
         if (els.forgotSuccessEl) els.forgotSuccessEl.classList.add('hidden');
         const email = document.getElementById('forgot-email')?.value;
         
         // Validación básica
         if (!email || !email.includes('@')) {
              if(els.forgotErrorEl) {
                   els.forgotErrorEl.textContent = 'Email inválido.';
                   els.forgotErrorEl.classList.remove('hidden');
               }
              return;
          }

         // Mostrar spinner
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
         } finally {
              // Ocultar spinner
          }
     });

     els.formUpdatePassword?.addEventListener('submit', async (e) => {
         e.preventDefault();
         if (els.updateErrorEl) els.updateErrorEl.classList.add('hidden');
         const new_password = document.getElementById('update-password')?.value;

         if (!currentAccessToken) {
              if (els.updateErrorEl) {
                  els.updateErrorEl.textContent = 'Token inválido o expirado.';
                  els.updateErrorEl.classList.remove('hidden');
              }
             return;
         }
         if (!new_password || new_password.length < 6) {
              if (els.updateErrorEl) {
                  els.updateErrorEl.textContent = 'Contraseña debe tener al menos 6 caracteres.';
                  els.updateErrorEl.classList.remove('hidden');
              }
              return;
          }

         // Mostrar spinner
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
         } finally {
              // Ocultar spinner
          }
     });

    // Auth Navigation Buttons
    els.showRegisterBtn?.addEventListener('click', showRegisterForm);
    els.showLoginBtn?.addEventListener('click', showLoginForm);
    els.showForgotPasswordBtn?.addEventListener('click', showForgotPasswordForm);
    
    // Logout Button (inside dropdown)
    els.btnLogout?.addEventListener('click', () => {
         // showConfirmDialog ya está definido arriba
         showConfirmDialog(
             '¿Estás seguro de que deseas cerrar sesión?',
             () => { // onConfirm
                 currentAccessToken = null; // Clear any recovery token
                 // Podríamos llamar a una API de logout si existiera
                 showAuth(); // Muestra pantalla de login y limpia UI
                 alert('Has cerrado sesión.'); // Usamos alert por ahora
             }
         );
     });

    // Sidebar Page Navigation
    els.sidebarLinks?.forEach(link => {
        link.addEventListener('click', () => showPage(link.dataset.page));
    });

    // Plantar Árbol Form
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
         // Podríamos añadir validación de coordenadas aquí si fuera necesario

        // Mostrar spinner
        try {
            const response = await fetch('/api/plantar_arbol', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    especie: especie.trim(),
                    latitud: parseFloat(latitud),
                    longitud: parseFloat(longitud),
                    // user_email y foto_url se añadirán aquí cuando se implemente
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Error del servidor');
            
            alert(`¡Árbol "${especie}" plantado exitosamente!`);
            form.reset(); // Limpiar formulario
            
            // Añadir marcador azul al mapa
             if (map) {
                 const blueIcon = L.icon({ /* ... icono azul ... */ }); // Definir icono azul si no está global
                  L.marker([data.latitud, data.longitud], { /* icon: blueIcon */ }) // Usar datos de la respuesta
                      .addTo(map)
                      .bindPopup(`<b>Especie:</b> ${data.especie}<br><b>ID:</b> ${data.id}`);
              }
            if (marcadorTemporal) { marcadorTemporal.remove(); marcadorTemporal = null; } // Limpiar marcador rojo
            
            // Recargar datos
            await cargarStats();
            await loadTableData();
        } catch (error) {
             console.error("Error al plantar:", error);
             alert(`Error al plantar árbol: ${error.message}`);
         } finally {
             // Ocultar spinner
         }
    });

    // Table Action Buttons (Delete/Edit) - Delegación de eventos
    els.tableBody?.addEventListener('click', async (e) => {
        const deleteButton = e.target.closest('.btn-delete');
        const editButton = e.target.closest('.btn-edit');

        if (deleteButton) {
            const arbolId = deleteButton.dataset.id;
            const filaArbol = deleteButton.closest('tr');
            const especie = filaArbol?.cells[1]?.textContent || `ID ${arbolId}`;

            showConfirmDialog(
                `¿Seguro que quieres eliminar "${especie}" (ID: ${arbolId})?`,
                async () => { // onConfirm
                    // Mostrar spinner
                    try {
                        const response = await fetch(`/api/eliminar_arbol/${arbolId}`, { method: 'DELETE' });
                        const result = await response.json();
                        if (!response.ok) throw new Error(result.error || 'Error del servidor');
                        
                        alert(result.message || 'Árbol eliminado.');
                        await loadTableData(); // Recargar tabla
                        await cargarStats(); // Recargar stats
                        // Falta eliminar marcador del mapa
                    } catch (error) {
                         console.error("Error al eliminar:", error);
                         alert(`Error al eliminar: ${error.message}`);
                     } finally {
                         // Ocultar spinner
                     }
                }
            );
        } else if (editButton) {
             const arbolId = editButton.dataset.id;
             alert(`Editar árbol ID ${arbolId} - Próximamente...`);
             // Aquí se abriría el modal de edición
         }
    });

    // --- 8. INICIO DE LA APP ---
    const checkUrlForToken = () => {
        const hash = window.location.hash.substring(1);
        if (hash) {
            const params = new URLSearchParams(hash);
            const accessToken = params.get('access_token');
            const type = params.get('type');
            
            // Limpiar hash de la URL
             window.history.replaceState(null, '', window.location.pathname + window.location.search);

            if (type === 'recovery' && accessToken) {
                currentAccessToken = accessToken;
                 showAuth(); // Asegurar que se muestra el contenedor auth
                showUpdatePasswordForm(); // Mostrar el form específico
            } else {
                 showAuth(); // Hash inválido o no de recuperación, ir a login
             }
        } else {
            showAuth(); // Sin hash, mostrar login
        }
    };

    checkUrlForToken(); // Verificar token al cargar la página

}); // Fin DOMContentLoaded