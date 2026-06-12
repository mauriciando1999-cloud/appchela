/**
 * Chela Sport 1972 - Portal Familiar
 * Powered by Envolvia
 */

const SB_URL = 'https://ekvzmfsdshyoeggudksm.supabase.co';
const SB_KEY = 'sb_publishable_Go6ZDuD9pg1pC3k-s89jiQ_65TEYGnd';
const _sb = supabase.createClient(SB_URL, SB_KEY);

let currentUser = { nombre: '', phone: '', pin: '' };
let estudiantesCached = []; 

// ==========================================
// 1. INICIALIZACIÓN
// ==========================================
window.onload = () => {
    const savedPhone = localStorage.getItem('userPhone');
    if (savedPhone) {
        abrirDashboard(savedPhone);
    }
    verificarEstadoNotificaciones();
    verificarHappyHour();
    
    // Revisar el Happy Hour cada minuto
    setInterval(verificarHappyHour, 60000); 
};

// ==========================================
// 2. NAVEGACIÓN Y MULTIMEDIA
// ==========================================
window.nextStep = function(stepId) {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    const target = document.getElementById('step-' + stepId);
    if(target) target.classList.add('active');
    window.scrollTo(0, 0);
};

window.toggleAudio = function() {
    const audio = document.getElementById('audio-instrucciones');
    const btn = document.getElementById('btn-audio');
    if (audio.paused) {
        audio.play().catch(e => console.log("Audio en espera de interacción."));
        btn.innerHTML = '<i class="fa-solid fa-pause text-white text-xl"></i>';
    } else {
        audio.pause();
        btn.innerHTML = '<i class="fa-solid fa-play text-white text-xl ml-1"></i>';
    }
};

// ==========================================
// 3. REGISTRO Y LOGIN DE FAMILIA
// ==========================================
window.guardarDatosRepresentante = function() {
    const nombre = document.getElementById('reg-nombre').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const pin = document.getElementById('reg-pin').value.trim();

    if(!nombre || !phone || !pin) return alert("⚠️ Rellena todos los campos.");
    if(pin.length < 4) return alert("⚠️ El PIN debe ser de 4 dígitos.");

    currentUser = { nombre, phone, pin };
    nextStep(3);
};

window.agregarCampoHijo = function() {
    const container = document.getElementById('contenedor-hijos');
    const totalHijos = container.querySelectorAll('input').length + 1;
    
    const div = document.createElement('div');
    div.className = "flex gap-2 mb-2";
    div.innerHTML = `
        <input type="text" class="hijo-nombre w-full p-4 rounded-xl text-white bg-slate-950 border border-slate-800" placeholder="Nombre del alumno ${totalHijos}">
        <button type="button" onclick="this.parentElement.remove()" class="bg-red-500/10 border border-red-500/20 text-red-400 px-4 rounded-xl active:scale-95 transition-all">
            <i class="fa-solid fa-trash"></i>
        </button>
    `;
    container.appendChild(div);
};

window.procesarRegistroFinal = async function() {
    const inputs = document.querySelectorAll('.hijo-nombre');
    let listaHijos = [];
    inputs.forEach(i => { if(i.value.trim()) listaHijos.push(i.value.trim()); });
    
    if(listaHijos.length === 0) return alert("⚠️ Agrega al menos un alumno.");

    const btn = document.getElementById('btn-save');
    btn.disabled = true; 
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Creando...';

    try {
        const promesas = listaHijos.map(h => _sb.from('estudiantes').insert([{
            name: h, 
            representante: currentUser.nombre, 
            phone: currentUser.phone, 
            pin_seguridad: currentUser.pin, 
            debt: 0, 
            limite_credito: 100, 
            bloqueado: false
        }]));
        await Promise.all(promesas);
        localStorage.setItem('userPhone', currentUser.phone);
        abrirDashboard(currentUser.phone);
    } catch (err) { 
        alert(err.message); 
        btn.disabled = false; 
        btn.innerHTML = 'Finalizar Registro';
    }
};

window.acceder = async function() {
    const phone = document.getElementById('login-phone').value.trim();
    const pin = document.getElementById('login-pin').value.trim();
    const btn = document.getElementById('btn-login');

    if(!phone || !pin) return alert("⚠️ Ingresa tus credenciales.");

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Verificando...';

    const { data, error } = await _sb.from('estudiantes')
        .select('*')
        .eq('phone', phone)
        .eq('pin_seguridad', pin);
    
    if(data && data.length > 0) {
        localStorage.setItem('userPhone', phone);
        abrirDashboard(phone);
    } else {
        alert("❌ PIN o Teléfono incorrectos.");
        btn.disabled = false;
        btn.innerHTML = 'Acceder';
    }
};

// ==========================================
// 4. DASHBOARD Y REALTIME
// ==========================================
window.abrirDashboard = async function(phone) {
    nextStep('dashboard');
    
    const container = document.getElementById('lista-hijos');
    container.innerHTML = '<div class="text-center py-6 text-slate-500 font-medium"><i class="fa-solid fa-circle-notch fa-spin mr-2 text-indigo-500"></i>Sincronizando portal...</div>';
    
    const { data, error } = await _sb.from('estudiantes').select('*').eq('phone', phone);
    
    if(error || !data || data.length === 0) {
        container.innerHTML = '<p class="text-center text-red-400 py-4 text-xs font-bold">Error de sincronización o cuenta vacía.</p>';
        return;
    }
    
    document.getElementById('dashboard-bienvenida').innerText = `Hola, ${data[0].representante}`;
    
    estudiantesCached = data;
    renderizarListaHijos(data);

    // 1. Escuchar compras para Notificaciones
    _sb.channel('alertas-compras')
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'ventas'
        }, (payload) => {
            const venta = payload.new;
            const hijoAfectado = estudiantesCached.find(h => venta.estudiante_nombre && venta.estudiante_nombre.includes(h.name));
            
            if (hijoAfectado) {
                let resumenItems = "Productos varios";
                if (venta.items && Array.isArray(venta.items)) {
                    resumenItems = venta.items.map(i => `${i.qty}x ${i.name}`).join(', ');
                }
                
                dispararAlertaNativa(
                    `🛒 ¡Nueva Compra de ${hijoAfectado.name}!`, 
                    `Consumo: $${parseFloat(venta.total_usd).toFixed(2)}\nLlevó: ${resumenItems}`
                );
                
                solicitarDatosActualizados(phone);
            }
        })
        .subscribe();

    // 2. Escuchar actualizaciones de saldo/bloqueos
    _sb.channel('cambios-estudiantes')
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'estudiantes' 
        }, (payload) => {
            if (payload.new.phone === phone) {
                solicitarDatosActualizados(phone);
            }
        })
        .subscribe();
};

window.solicitarDatosActualizados = async function(phone) {
    const { data } = await _sb.from('estudiantes').select('*').eq('phone', phone);
    if (data) {
        estudiantesCached = data; 
        renderizarListaHijos(data);
    }
};

window.renderizarListaHijos = function(data) {
    const container = document.getElementById('lista-hijos');
    if (!container) return;
    
    container.innerHTML = '';
    let acumuladorDeuda = 0;
    const phone = data[0].phone;

    data.forEach(hijo => {
        const deudaActual = parseFloat(hijo.debt || 0);
        acumuladorDeuda += deudaActual;
        
        const btnBloqueo = hijo.bloqueado 
            ? `<button onclick="cambiarEstadoBloqueo('${hijo.id}', false, '${phone}')" class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold px-2.5 py-2 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1 w-full"><i class="fa-solid fa-lock-open text-[9px]"></i> Desbloquear</button>`
            : `<button onclick="cambiarEstadoBloqueo('${hijo.id}', true, '${phone}')" class="bg-red-500/10 text-red-400 border border-red-500/20 text-[11px] font-bold px-2.5 py-2 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1 w-full"><i class="fa-solid fa-lock text-[9px]"></i> Bloquear Cuenta</button>`;

        const btnLimite = `<button onclick="modificarLimiteCredito('${hijo.id}', ${hijo.limite_credito || 100}, '${phone}')" class="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[11px] font-bold px-2.5 py-2 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1 w-full"><i class="fa-solid fa-wallet text-[9px]"></i> Límite ($${hijo.limite_credito || 100})</button>`;

        const btnPagar = deudaActual > 0
            ? `<button onclick="procesarPago('${hijo.id}', ${deudaActual}, '${phone}', '${hijo.name}')" class="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 text-[11px] font-bold px-3 py-2 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1 w-full"><i class="fa-solid fa-receipt text-[9px]"></i> Pagar Deuda</button>`
            : '';
            
        const btnHistorial = `<button onclick="verHistorialAlumno('${hijo.name}')" class="w-full mt-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all flex justify-center items-center gap-2"><i class="fa-solid fa-list text-slate-400"></i> Historial Completo</button>`;

        const statusBadge = hijo.bloqueado 
            ? `<span class="bg-red-500/10 text-red-400 border border-red-500/20 text-[9px] uppercase font-black px-2 py-0.5 rounded-md tracking-wider">Bloqueado</span>`
            : `<span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] uppercase font-black px-2 py-0.5 rounded-md tracking-wider">Activo</span>`;

        container.innerHTML += `
            <div class="p-4 bg-slate-900 border border-slate-800/60 rounded-2xl flex flex-col shadow-inner glass mb-3">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <p class="font-bold text-sm text-slate-100">${hijo.name}</p>
                        <p class="text-xs font-semibold text-slate-400 mt-0.5">
                            Deuda: <span class="${deudaActual > 0 ? 'text-red-400 font-bold' : 'text-emerald-400'}">$${deudaActual.toFixed(2)}</span> 
                            <span class="text-slate-600 mx-1">|</span> 
                            Crédito Max: <span class="text-indigo-400">$${hijo.limite_credito || 100}</span>
                        </p>
                    </div>
                    <div>${statusBadge}</div>
                </div>
                
                <div class="grid grid-cols-2 gap-2 border-t border-slate-800/50 pt-3">
                    ${btnBloqueo}
                    ${btnLimite}
                    ${btnPagar ? `<div class="col-span-2">${btnPagar}</div>` : ''}
                </div>
                
                ${btnHistorial}
            </div>
        `;
    });
    
    const totalEl = document.getElementById('total-deuda');
    if (totalEl) totalEl.innerText = `$${acumuladorDeuda.toFixed(2)}`;
};

// ==========================================
// 5. LÍMITES Y BLOQUEOS
// ==========================================
window.modificarLimiteCredito = async function(id, limiteActual, phone) {
    const nuevoLimite = prompt(`Establecer nuevo límite de crédito:\n(Valor actual: $${limiteActual})`, limiteActual);
    
    if (nuevoLimite === null) return;
    const num = parseFloat(nuevoLimite);
    if (isNaN(num) || num < 0) return alert("⚠️ Monto inválido. Ingresa un número mayor o igual a 0.");

    const { error } = await _sb.from('estudiantes').update({ limite_credito: num }).eq('id', id);
    
    if (error) {
        alert("Error al guardar límite. " + error.message);
    } else {
        solicitarDatosActualizados(phone);
    }
};

window.cambiarEstadoBloqueo = async function(id, nuevoEstado, phone) {
    const { error } = await _sb.from('estudiantes').update({ bloqueado: nuevoEstado }).eq('id', id);
    if (error) {
        alert("Error al cambiar estado de bloqueo.");
    } else {
        solicitarDatosActualizados(phone);
    }
};

// ==========================================
// 6. HISTORIAL DE COMPRAS
// ==========================================
window.verHistorialAlumno = async function(nombreAlumno) {
    const modal = document.getElementById('modal-historial-portal');
    const contenedor = document.getElementById('lista-historial-portal');
    
    if (!modal || !contenedor) return;

    modal.classList.remove('hidden');
    document.getElementById('historial-nombre-alumno').innerText = nombreAlumno;
    contenedor.innerHTML = '<div class="flex flex-col items-center justify-center mt-20"><i class="fa-solid fa-circle-notch fa-spin text-3xl text-indigo-500 mb-3"></i><p class="text-xs font-bold text-slate-400 uppercase tracking-widest">Buscando tickets...</p></div>';

    try {
        const { data, error } = await _sb.from('ventas')
            .select('created_at, total_usd, items, status, metodo_pago')
            .eq('estudiante_nombre', nombreAlumno)
            .order('created_at', { ascending: false })
            .limit(15);

        if (error) throw error;

        if (!data || data.length === 0) {
            contenedor.innerHTML = '<div class="text-center mt-20"><i class="fa-solid fa-box-open text-4xl text-slate-700 mb-3"></i><p class="text-xs font-bold text-slate-500 uppercase tracking-widest">No hay compras registradas</p></div>';
            return;
        }

        contenedor.innerHTML = data.map(venta => {
            const fecha = new Date(venta.created_at).toLocaleDateString('es-VE', { 
                weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute:'2-digit' 
            });
            let detallesItems = "Sin detalles";
            if (venta.items && Array.isArray(venta.items)) {
                detallesItems = venta.items.map(i => `<span class="font-bold text-white">${i.qty}x</span> ${i.name}`).join('<br>');
            }

            const colorStatus = venta.status === 'completado' 
                ? 'text-emerald-400 bg-emerald-400/10 border border-emerald-500/20' 
                : 'text-amber-400 bg-amber-400/10 border border-amber-500/20';

            const metodo = venta.metodo_pago ? venta.metodo_pago.replace('_', ' ') : 'N/A';

            return `
            <div class="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-sm">
                <div class="flex justify-between items-start mb-3 border-b border-slate-800 pb-3">
                    <div>
                        <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">${fecha}</p>
                        <p class="text-lg font-black text-white leading-none">$${parseFloat(venta.total_usd).toFixed(2)}</p>
                    </div>
                    <span class="px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${colorStatus}">${venta.status}</span>
                </div>
                <div class="text-[11px] text-slate-400 leading-relaxed">${detallesItems}</div>
                <div class="mt-3 pt-2 text-[9px] text-slate-500 font-bold uppercase tracking-widest text-right">Pagado vía: ${metodo}</div>
            </div>`;
        }).join('');

    } catch (e) {
        contenedor.innerHTML = `<div class="bg-red-500/10 border border-red-500/30 p-4 rounded-xl text-center mt-4"><p class="text-xs text-red-400 font-bold">Error al cargar historial.</p></div>`;
    }
};

window.procesarPago = function(id, deudaActual, phone, nombreEstudiante) {
    window.location.href = `pago.html?id=${id}&name=${encodeURIComponent(nombreEstudiante)}&debt=${deudaActual.toFixed(2)}&phone=${phone}`;
};

window.cerrarSesion = function() {
    localStorage.removeItem('userPhone');
    location.reload();
};

// ==========================================
// 7. HAPPY HOUR Y SUGERENCIAS
// ==========================================
window.verificarHappyHour = function() {
    const hora = new Date().getHours();
    const banner = document.getElementById('happy-hour-banner');
    if (!banner) return;
    
    if(hora >= 12 && hora < 14) { 
        banner.classList.remove('hidden');
    } else {
        banner.classList.add('hidden');
    }
};

window.abrirSugerencias = function() {
    const inputSug = document.getElementById('texto-sugerencia');
    const modalSug = document.getElementById('modal-sugerencias');
    if(inputSug) inputSug.value = '';
    if(modalSug) modalSug.classList.remove('hidden');
};

window.enviarSugerencia = async function() {
    const texto = document.getElementById('texto-sugerencia').value.trim();
    const userPhone = localStorage.getItem('userPhone');
    
    if(!texto) return alert("Por favor, escribe un mensaje.");
    if(!userPhone) return alert("Error: No se pudo identificar tu teléfono.");

    const btn = document.getElementById('btn-enviar-sugerencia');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';
    btn.disabled = true;

    try {
        const { error } = await _sb.from('sugerencias').insert([{
            representante_phone: userPhone,
            mensaje: texto,
            estado: 'nueva'
        }]);

        if (error) throw error; 

        alert("¡Gracias! Tu mensaje ha sido enviado a la gerencia de Chela Sport.");
        document.getElementById('modal-sugerencias').classList.add('hidden');
        document.getElementById('texto-sugerencia').value = '';

    } catch (e) {
        console.error("Error al enviar sugerencia:", e);
        alert(`Error al enviar el mensaje: ${e.message}`);
    } finally {
        btn.innerHTML = 'Enviar Mensaje Seguramente';
        btn.disabled = false;
    }
};

// ==========================================
// 8. ALERTAS NATIVAS
// ==========================================
window.verificarEstadoNotificaciones = function() {
    if (!("Notification" in window)) return;
    const btn = document.getElementById('btn-notificaciones');
    const txt = document.getElementById('txt-notificaciones');
    const icono = document.getElementById('icono-notificaciones');
    if (!btn || !txt || !icono) return;

    if (Notification.permission === "granted") {
        btn.classList.replace('text-slate-400', 'text-emerald-400');
        icono.classList.replace('text-indigo-400', 'text-emerald-400');
        txt.innerText = "Alertas de Consumo Activadas";
        btn.disabled = true;
    }
};

window.solicitarNotificaciones = async function() {
    if (!("Notification" in window)) return alert("⚠️ Tu dispositivo no soporta notificaciones nativas.");
    
    const permiso = await Notification.requestPermission();
    if (permiso === "granted") {
        window.verificarEstadoNotificaciones();
        window.dispararAlertaNativa("¡Conectado!", "Recibirás una alerta cada vez que se registre una compra.");
    } else {
        alert("❌ Permiso denegado. Añade la app a tu Pantalla de Inicio si usas iOS o habilita las alertas en tu navegador.");
    }
};

window.dispararAlertaNativa = async function(titulo, cuerpo) {
    if (Notification.permission !== "granted") return;
    if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
            registration.showNotification(titulo, { 
                body: cuerpo, 
                icon: "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/svgs/solid/bell.svg" 
            });
            return;
        }
    }
    try { new Notification(titulo, { body: cuerpo }); } catch(e) {}
};
    });
    
    if (listaHijos.length === 0) {
        return alert("⚠️ Debes asignar el nombre de por lo menos un (1) alumno.");
    }

    const btn = document.getElementById('btn-save');
    btn.disabled = true; 
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Guardando registros...';

    try {
        // Enviar inserciones de forma concurrente para acelerar el proceso
        const promesas = listaHijos.map(hijo => _sb.from('estudiantes').insert([{
            name: hijo, 
            representante: currentUser.nombre, 
            phone: currentUser.phone, 
            pin_seguridad: currentUser.pin, 
            debt: 0, 
            limite_credito: 100, 
            bloqueado: false
        }]));
        
        await Promise.all(promesas);
        
        // Login automático tras registro exitoso
        localStorage.setItem('userPhone', currentUser.phone);
        abrirDashboard(currentUser.phone);
        
    } catch (err) { 
        alert("Ocurrió un error inesperado de red: " + err.message); 
        btn.disabled = false; 
        btn.innerHTML = 'Finalizar Registro y Entrar';
    }
}


// --- 6. ACCESO / CONTROL DE LOGIN ---
async function acceder() {
    const phone = document.getElementById('login-phone').value.trim();
    const pin = document.getElementById('login-pin').value.trim();
    const btn = document.getElementById('btn-login');

    if (!phone || !pin) return alert("⚠️ Rellena todos tus datos de acceso.");

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Validando identidad...';

    const { data, error } = await _sb.from('estudiantes')
        .select('*')
        .eq('phone', phone)
        .eq('pin_seguridad', pin);
    
    if (error) {
        alert("Error de conexión: " + error.message);
        btn.disabled = false;
        btn.innerHTML = 'Acceder al Dashboard';
        return;
    }

    if (data && data.length > 0) {
        // Guardar sesión persistente local
        localStorage.setItem('userPhone', phone);
        abrirDashboard(phone);
    } else {
        alert("❌ El número de teléfono o el PIN de seguridad ingresados son incorrectos.");
        btn.disabled = false;
        btn.innerHTML = 'Acceder al Dashboard';
    }
}


// --- 7. PANEL DE CONTROL (DASHBOARD) ---
async function abrirDashboard(phone) {
    // Mover la UI a la pantalla de dashboard
    nextStep('dashboard');
    
    const container = document.getElementById('lista-hijos');
    container.innerHTML = '<div class="text-center py-6 text-slate-500 font-medium"><i class="fa-solid fa-circle-notch fa-spin mr-2 text-indigo-500"></i>Sincronizando portal...</div>';
    
    // Obtener todos los alumnos asociados a ese número telefónico
    const { data, error } = await _sb.from('estudiantes').select('*').eq('phone', phone);
    
    if (error || !data || data.length === 0) {
        container.innerHTML = '<p class="text-center text-red-400 py-4 text-xs font-bold">Error al sincronizar datos familiares o cuenta inexistente.</p>';
        return;
    }
    
    // Renderizar el nombre del representante titular en el saludo
    document.getElementById('dashboard-bienvenida').innerText = `Hola, ${data[0].representante}`;
    
    container.innerHTML = '';
    let acumuladorDeuda = 0;
    
    // Inyectar dinámicamente las tarjetas con controles interactivos
    data.forEach(hijo => {
        acumuladorDeuda += parseFloat(hijo.debt || 0);
        
        // Configurar botones de acción contextuales según estado de bloqueo
        const btnBloqueo = hijo.bloqueado 
            ? `<button onclick="cambiarEstadoBloqueo('${hijo.id}', false, '${phone}')" class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold px-3 py-2 rounded-xl active:scale-95 transition-all flex items-center gap-1"><i class="fa-solid fa-lock-open text-[10px]"></i> Activar</button>`
            : `<button onclick="cambiarEstadoBloqueo('${hijo.id}', true, '${phone}')" class="bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-bold px-3 py-2 rounded-xl active:scale-95 transition-all flex items-center gap-1"><i class="fa-solid fa-lock text-[10px]"></i> Bloquear</button>`;

        const btnLimite = `<button onclick="modificarLimiteCredito('${hijo.id}', ${hijo.limite_credito || 100}, '${phone}')" class="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/80 text-xs font-bold px-3 py-2 rounded-xl active:scale-95 transition-all flex items-center gap-1"><i class="fa-solid fa-pen text-[9px]"></i> Límite</button>`;

        // Badge visual superior de estado
        const statusBadge = hijo.bloqueado 
            ? `<span class="bg-red-500/10 text-red-400 border border-red-500/20 text-[9px] uppercase font-black px-2 py-0.5 rounded-md tracking-wider">Bloqueado</span>`
            : `<span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] uppercase font-black px-2 py-0.5 rounded-md tracking-wider">Activo</span>`;

        container.innerHTML += `
            <div class="p-4 bg-slate-900 border border-slate-900/60 rounded-2xl flex flex-col gap-3 shadow-inner glass">
                <div class="flex justify-between items-start">
                    <div>
                        <p class="font-bold text-sm text-slate-100">${hijo.name}</p>
                        <p class="text-xs font-semibold text-slate-400 mt-0.5">
                            Deuda: <span class="${hijo.debt > 0 ? 'text-amber-400' : 'text-slate-400'}">$${hijo.debt || 0}</span> 
                            <span class="text-slate-600 mx-1">|</span> 
                            Límite: <span class="text-indigo-400">$${hijo.limite_credito || 100}</span>
                        </p>
                    </div>
                    <div>
                        ${statusBadge}
                    </div>
                </div>
                <!-- Barra de acciones rápidas para el representante -->
                <div class="flex gap-2 justify-end border-t border-slate-800/60 pt-2.5">
                    ${btnLimite}
                    ${btnBloqueo}
                </div>
            </div>
        `;
    });
    
    // Actualizar el acumulador de la deuda consolidada de la familia
    document.getElementById('total-deuda').innerText = `$${acumuladorDeuda.toFixed(2)}`;
}


// --- 8. ACCIONES ADMINISTRATIVAS DE CRÉDITO ---

/**
 * Modifica de forma remota el estado lógico 'bloqueado' de un alumno específico
 */
async function cambiarEstadoBloqueo(id, nuevoEstado, phone) {
    const { error } = await _sb.from('estudiantes')
        .update({ bloqueado: nuevoEstado })
        .eq('id', id);

    if (error) {
        alert("⚠️ No se pudo actualizar el estado de bloqueo: " + error.message);
    } else {
        // Refrescar de forma reactiva la UI del Dashboard
        abrirDashboard(phone);
    }
}

/**
 * Solicita una entrada numérica segura para cambiar la restricción de consumo máximo (limite_credito)
 */
async function modificarLimiteCredito(id, limiteActual, phone) {
    const nuevoLimite = prompt(`Establecer nuevo límite de crédito diario/semanal:\n(Valor actual: $${limiteActual})`, limiteActual);
    
    // Controlar cancelación explícita por parte del cliente
    if (nuevoLimite === null) return;
    
    const limiteNumerico = parseFloat(nuevoLimite);
    if (isNaN(limiteNumerico) || limiteNumerico < 0) {
        return alert("⚠️ Operación inválida. Debes ingresar una cifra numérica válida y mayor o igual a 0.");
    }

    const { error } = await _sb.from('estudiantes')
        .update({ limite_credito: limiteNumerico })
        .eq('id', id);

    if (error) {
        alert("⚠️ Falló la sincronización del nuevo límite en Supabase: " + error.message);
    } else {
        // Refrescar Dashboard con los nuevos balances
        abrirDashboard(phone);
    }
}


// --- 9. CIERRE DE SESIÓN SEGURO ---
function cerrarSesion() {
    localStorage.removeItem('userPhone');
    location.reload(); // Recarga la página vacía para volver al paso 1
}
