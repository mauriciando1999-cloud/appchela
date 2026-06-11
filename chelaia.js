// chelaia.js - Motor del Asistente Ejecutivo
const SB_URL = 'https://ekvzmfsdshyoeggudksm.supabase.co';
const SB_KEY = 'sb_publishable_Go6ZDuD9pg1pC3k-s89jiQ_65TEYGnd';
const _sb = supabase.createClient(SB_URL, SB_KEY);
const ADMIN_EMAIL = 'mauriciando1999@gmail.com';
const PIN_ADMIN = '1972'; // Define tu PIN de seguridad aquí

let state = {
    isAdminMode: false,
    productos: [],
    estudiantes: [],
    personal: [],
    ventasRecientes: []
};

// ==========================================
// INICIALIZACIÓN
// ==========================================
window.onload = async () => {
    const { data: { user } } = await _sb.auth.getUser();
    
    // Protección de ruta
    if(!user || user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        alert("Acceso denegado. Área exclusiva.");
        return window.location.href = 'index.html';
    }

    document.getElementById('ai-status').innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> Leyendo BD...';
    await cargarMemoriaIA();
    document.getElementById('ai-status').innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Sincronizado';
};

// ==========================================
// EXTRACCIÓN DE CONTEXTO
// ==========================================
async function cargarMemoriaIA() {
    try {
        const [prod, est, pers, vent] = await Promise.all([
            _sb.from('productos').select('id, name, stock, cost, price, proveedor'),
            _sb.from('estudiantes').select('id, name, representante, debt, limite_credito'),
            _sb.from('personal').select('id, name, debt'),
            _sb.from('ventas').select('*').order('created_at', { ascending: false }).limit(50) // Últimas 50 operaciones
        ]);

        state.productos = prod.data || [];
        state.estudiantes = est.data || [];
        state.personal = pers.data || [];
        state.ventasRecientes = vent.data || [];
    } catch (e) {
        console.error("Error al cargar la memoria:", e);
        alert("ChelaIA tuvo problemas leyendo la base de datos.");
    }
}

function generarContextoString() {
    // Convertimos la base de datos a un formato de texto ligero para la IA
    const inventarioStr = state.productos.map(p => `[ID:${p.id}] ${p.name} (Stock: ${p.stock}, Costo: $${p.cost}, Venta: $${p.price})`).join(' | ');
    const deudoresEstStr = state.estudiantes.filter(e => parseFloat(e.debt) > 0).map(e => `[ID:${e.id}] ${e.name}: -$${parseFloat(e.debt).toFixed(2)}`).join(' | ');
    
    return `
=== DATOS EN TIEMPO REAL CHELA SPORT ===
- PERMISOS DE ESCRITURA: ${state.isAdminMode ? 'ACTIVADOS (Puedes ejecutar SQL/Funciones si el usuario lo pide)' : 'DENEGADOS (Solo puedes leer y analizar)'}.
- INVENTARIO: ${inventarioStr || 'Vacío'}
- DEUDAS ALUMNOS: ${deudoresEstStr || 'Sin deudas'}
========================================
`;
}

// ==========================================
// CHAT Y COMUNICACIÓN CON SUPABASE EDGE
// ==========================================
window.enviarPregunta = async function() {
    const input = document.getElementById('chat-input');
    const pregunta = input.value.trim();
    if (!pregunta) return;

    // 1. Dibuja el mensaje del usuario
    agregarBurbuja('usuario', pregunta);
    input.value = '';
    
    // 2. Estado de carga
    const btn = document.getElementById('btn-send');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btn.disabled = true;
    const typingId = agregarBurbujaEscribiendo();

    try {
        // Empaquetamos la data. Enviamos la bandera isAdminMode para que 
        // la Edge Function sepa si debe rechazar comandos de actualización o no.
        const payload = {
            pregunta_usuario: pregunta,
            contexto_db: generarContextoString(),
            permiso_escritura: state.isAdminMode 
        };

        // 3. Llamada a la Edge Function
        const { data, error } = await _sb.functions.invoke('chelaia-brain', {
            body: payload
        });

        if (error) throw error;

        // 4. Mostrar respuesta
        document.getElementById(typingId).remove();
        agregarBurbuja('ia', data.respuesta || "No pude formular una respuesta.");
        
        // Si la IA hizo un cambio en la BD (nos devuelve un flag), refrescamos la memoria
        if(data.bd_modificada) {
            await cargarMemoriaIA();
        }

    } catch (e) {
        console.error(e);
        document.getElementById(typingId).remove();
        agregarBurbuja('ia', "❌ Error de conexión. Verifica que la Edge Function 'chelaia-brain' esté desplegada.");
    } finally {
        btn.innerHTML = '<i class="fa-solid fa-paper-plane text-sm"></i>';
        btn.disabled = false;
    }
}

// ==========================================
// SEGURIDAD Y MODO ESCRITURA
// ==========================================
window.activarModoAdmin = function() {
    if(state.isAdminMode) {
        // Apagar modo admin
        state.isAdminMode = false;
        actualizarBotonAdmin();
    } else {
        // Abrir modal para pedir contraseña
        document.getElementById('input-pin').value = '';
        document.getElementById('modal-password').classList.remove('hidden');
        document.getElementById('input-pin').focus();
    }
}

window.verificarPIN = function() {
    const pin = document.getElementById('input-pin').value;
    if(pin === PIN_ADMIN) {
        state.isAdminMode = true;
        document.getElementById('modal-password').classList.add('hidden');
        actualizarBotonAdmin();
        agregarBurbuja('ia', "🔓 **Modo Escritura Desbloqueado.**\nAhora puedes pedirme que actualice precios, registre compras, o altere saldos. ¿Qué modificamos?");
    } else {
        alert("PIN Incorrecto.");
    }
}

function actualizarBotonAdmin() {
    const btn = document.getElementById('btn-modo-admin');
    const icono = document.getElementById('icon-lock');
    
    if(state.isAdminMode) {
        btn.classList.replace('bg-slate-800', 'bg-red-600/20');
        btn.classList.replace('text-slate-400', 'text-red-500');
        btn.classList.replace('border-slate-700', 'border-red-500/50');
        btn.querySelector('span').innerText = 'Lectura/Escritura';
        icono.className = "fa-solid fa-unlock text-red-500";
    } else {
        btn.classList.replace('bg-red-600/20', 'bg-slate-800');
        btn.classList.replace('text-red-500', 'text-slate-400');
        btn.classList.replace('border-red-500/50', 'border-slate-700');
        btn.querySelector('span').innerText = 'Solo Lectura';
        icono.className = "fa-solid fa-lock";
    }
}

// ==========================================
// RENDERIZADO VISUAL DEL CHAT
// ==========================================
function agregarBurbuja(remitente, texto) {
    const chat = document.getElementById('chat-history');
    let html = '';
    
    // Soporte básico para Markdown (Negritas y saltos de línea)
    const textoFormateado = texto.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>').replace(/\n/g, '<br>');

    if (remitente === 'usuario') {
        html = `
        <div class="flex items-start justify-end gap-3 opacity-0 animate-[fadeInDown_0.3s_ease-out_forwards]">
            <div class="bg-indigo-600 border border-indigo-500 p-3.5 rounded-2xl rounded-tr-none shadow-md max-w-[85%]">
                <p class="text-xs text-white font-medium">${textoFormateado}</p>
            </div>
        </div>`;
    } else {
        html = `
        <div class="flex items-start gap-3 opacity-0 animate-[fadeInDown_0.3s_ease-out_forwards]">
            <div class="bg-indigo-600 w-8 h-8 rounded-full flex justify-center items-center shrink-0 shadow-[0_0_10px_rgba(79,70,229,0.5)] border border-indigo-400 mt-1">
                <i class="fa-solid fa-sparkles text-white text-[10px]"></i>
            </div>
            <div class="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl rounded-tl-none shadow-sm max-w-[85%]">
                <p class="text-xs text-slate-300 leading-relaxed">${textoFormateado}</p>
            </div>
        </div>`;
    }

    chat.insertAdjacentHTML('beforeend', html);
    chat.scrollTop = chat.scrollHeight;
}

function agregarBurbujaEscribiendo() {
    const chat = document.getElementById('chat-history');
    const id = 'typing-' + Date.now();
    const html = `
        <div id="${id}" class="flex items-start gap-3 opacity-0 animate-[fadeInDown_0.3s_ease-out_forwards]">
            <div class="bg-indigo-600 w-8 h-8 rounded-full flex justify-center items-center shrink-0">
                <i class="fa-solid fa-sparkles text-white text-[10px]"></i>
            </div>
            <div class="bg-slate-900 border border-slate-800 px-4 py-3.5 rounded-2xl rounded-tl-none flex items-center gap-1 typing-indicator">
                <span></span><span></span><span></span>
            </div>
        </div>`;
    chat.insertAdjacentHTML('beforeend', html);
    chat.scrollTop = chat.scrollHeight;
    return id;
}