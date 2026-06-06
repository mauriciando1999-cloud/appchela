/**
 * Chela Sport 1972 - Portal Familiar
 * Powered by Envolvia IA (v2.2)
 * Lógica de negocio, autenticación persistente y controles de crédito avanzados.
 */

// --- 1. CONFIGURACIÓN E INICIALIZACIÓN ---
const SB_URL = 'https://ekvzmfsdshyoeggudksm.supabase.co';
const SB_KEY = 'sb_publishable_Go6ZDuD9pg1pC3k-s89jiQ_65TEYGnd';

// Inicializar cliente de Supabase
const _sb = supabase.createClient(SB_URL, SB_KEY);

// Estado de sesión temporal en memoria reactiva
let currentUser = { nombre: '', phone: '', pin: '' };


// --- 2. CICLO DE VIDA DE LA APLICACIÓN ---
window.onload = () => {
    // Verificar si el representante ya tiene una sesión iniciada localmente
    const savedPhone = localStorage.getItem('userPhone');
    if (savedPhone) {
        abrirDashboard(savedPhone);
    }
};


// --- 3. ENRUTADOR / NAVEGACIÓN INTERNA ---
function nextStep(stepId) {
    // Ocultar todos los contenedores de pasos
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    
    // Mostrar el paso solicitado si existe
    const target = document.getElementById('step-' + stepId);
    if (target) {
        target.classList.add('active');
    }
    // Forzar scroll al inicio para mejorar la UX en móviles
    window.scrollTo(0, 0);
}


// --- 4. REPRODUCTOR DE INSTRUCCIONES ---
function toggleAudio() {
    const audio = document.getElementById('audio-instrucciones');
    const btn = document.getElementById('btn-audio');
    
    if (audio.paused) {
        audio.play().catch(e => {
            console.warn("El audio fue bloqueado por las políticas del navegador hasta que interactúes con la app.");
        });
        btn.innerHTML = '<i class="fa-solid fa-pause text-white text-xl"></i>';
    } else {
        audio.pause();
        btn.innerHTML = '<i class="fa-solid fa-play text-white text-xl ml-1"></i>';
    }
}


// --- 5. LÓGICA DE REGISTRO DE FAMILIA ---

/**
 * Paso 1: Valida los datos del representante y los retiene en memoria
 */
function guardarDatosRepresentante() {
    const nombre = document.getElementById('reg-nombre').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const pin = document.getElementById('reg-pin').value.trim();

    if (!nombre || !phone || !pin) {
        return alert("⚠️ Por favor rellena todos los campos del representante.");
    }
    if (pin.length < 4) {
        return alert("⚠️ El PIN de seguridad debe contener exactamente 4 números.");
    }

    // Guardar datos temporalmente
    currentUser = { nombre, phone, pin };
    nextStep(3);
}

/**
 * Paso 2: Añadir inputs dinámicos en el DOM para registrar múltiples alumnos
 */
function agregarCampoHijo() {
    const container = document.getElementById('contenedor-hijos');
    const totalHijos = container.querySelectorAll('input').length + 1;
    
    const div = document.createElement('div');
    div.className = "flex gap-2 animation-fadeIn";
    div.innerHTML = `
        <input type="text" class="hijo-nombre w-full p-4 rounded-xl text-white" placeholder="Nombre del alumno ${totalHijos}">
        <button type="button" onclick="this.parentElement.remove()" class="bg-red-500/10 border border-red-500/20 text-red-400 px-4 rounded-xl active:scale-95 transition-all">
            <i class="fa-solid fa-trash"></i>
        </button>
    `;
    container.appendChild(div);
}

/**
 * Paso 3: Procesa la lista de alumnos e inserta en lote en Supabase
 */
async function procesarRegistroFinal() {
    const inputs = document.querySelectorAll('.hijo-nombre');
    let listaHijos = [];
    
    inputs.forEach(i => { 
        if (i.value.trim()) listaHijos.push(i.value.trim()); 
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