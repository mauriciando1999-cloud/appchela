// --- LÓGICA DE COBRANZAS Y RECORDATORIOS (VERSIÓN LIMPIA) ---
// Nota: No declaramos SB_URL ni _sb aquí porque ya vienen cargados desde config.js

let state = { 
    estudiantes: [], 
    userRole: 'vendedor',
    tasaBCV: 0 
};

let abonoTemporal = { id: null, deudaMax: 0 };

// 1. INICIALIZACIÓN Y SEGURIDAD
window.onload = async () => {
    if (typeof _sb === 'undefined') return alert("Error: config.js no está cargando Supabase.");

    // Verificamos sesión
    const { data: { user }, error } = await _sb.auth.getUser();
    if (error || !user) return window.location.href = 'index.html';

    // Definir Rol directamente con tu correo para evitar colisiones de variables
    state.userRole = (user.email.toLowerCase() === 'mauriciando1999@gmail.com') ? 'admin' : 'vendedor';
    
    // UI según rol: Ocultar/Mostrar acceso a Admin
    const btnAdmin = document.getElementById('btn-admin');
    if (btnAdmin) {
        if (state.userRole === 'admin') {
            btnAdmin.classList.remove('hidden'); // Muestra si es Mauricio
        } else {
            btnAdmin.classList.add('hidden'); // Oculta si es vendedor
        }
    }

    // Cargar Tasa y luego Datos
    await getBCV();
    await syncCobranzas();
};

// 2. OBTENER TASA (DolarAPI)
async function getBCV() {
    try {
        const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
        const data = await res.json();
        if (data?.promedio) {
            state.tasaBCV = parseFloat(data.promedio);
            const el = document.getElementById('bcv-val');
            if (el) el.innerText = `BCV: ${state.tasaBCV.toFixed(2)}`;
        }
    } catch (e) {
        console.warn("No se pudo sincronizar la tasa BCV");
    }
}

// 3. SINCRONIZACIÓN DE DATOS
async function syncCobranzas() {
    try {
        const { data, error } = await _sb
            .from('estudiantes')
            .select('*')
            .order('name', { ascending: true });
        
        if (error) throw error;
        
        state.estudiantes = data || []; 
        renderDeudores(); 
    } catch (e) {
        console.error("Error cargando estudiantes:", e);
    }
}

// 4. RENDERIZADO DE LA LISTA (A PRUEBA DE FALLOS)
function renderDeudores() {
    const list = document.getElementById('lista-deudores');
    if (!list) return;
    
    const searchEl = document.getElementById('search-deudor');
    const search = searchEl ? searchEl.value.toLowerCase() : '';
    
    // Filtro a prueba de nulos
    let filtered = state.estudiantes.filter(e => {
        const nombre = (e.name || '').toLowerCase();
        const rep = (e.representante || '').toLowerCase();
        return nombre.includes(search) || rep.includes(search);
    });

    let totalD = 0;
    let countD = 0;

    list.innerHTML = filtered.map(h => {
        const debtNum = parseFloat(h.debt || 0);
        if (debtNum > 0) { totalD += debtNum; countD++; }

        // Protecciones contra datos vacíos en la BD
        const nombreFilt = h.name || 'Estudiante';
        const repFilt = h.representante || 'Representante';
        const phoneFilt = h.phone || '';
        const phoneClean = phoneFilt.replace(/\D/g,'');

        const origin = window.location.origin;
        const linkPago = `${origin}/pago.html?estudiante=${h.id}&monto=${debtNum.toFixed(2)}`;

        const mensajeWa = encodeURIComponent(
            `*RECORDATORIO DE PAGO - CHELA SPORT 1972* 🏦\n\n` +
            `Hola, *${repFilt}*. Te saludamos de la proveeduría.\n\n` +
            `El saldo pendiente de *${nombreFilt}* es de *$${debtNum.toFixed(2)}*.\n\n` +
            `Reporta tu pago móvil aquí: \n${linkPago}\n\n` +
            `¡Gracias!`
        );
        
        const urlWhatsApp = phoneClean ? `https://wa.me/${phoneClean}?text=${mensajeWa}` : '#';

        return `
        <div class="bg-slate-900 border ${h.bloqueado ? 'border-red-900/40' : 'border-slate-800'} p-4 rounded-2xl flex justify-between items-center shadow-sm mb-3">
            <div class="flex-1 overflow-hidden pr-2">
                <div class="flex items-center gap-2 mb-1">
                    <p class="text-[11px] font-black uppercase text-white truncate leading-none">${nombreFilt}</p>
                    ${h.bloqueado ? '<span class="bg-red-600/20 text-red-500 border border-red-500/30 text-[7px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest">Bloqueado</span>' : ''}
                </div>
                <p class="text-[9px] text-slate-500 font-bold truncate">Rep: ${repFilt}</p>
            </div>
            
            <div class="flex items-center gap-2 shrink-0">
                <div class="text-right mr-2">
                    <p class="text-[8px] text-slate-500 uppercase font-black">Debe</p>
                    <p class="font-black text-sm text-red-400">$${debtNum.toFixed(2)}</p>
                </div>

                <button onclick="${phoneClean ? `window.open('${urlWhatsApp}', '_blank')` : `alert('Este cliente no tiene teléfono registrado.')`}" class="bg-emerald-600 text-white w-9 h-9 rounded-full flex justify-center items-center active:scale-90 shadow-lg transition-transform">
                    <i class="fa-brands fa-whatsapp text-sm"></i>
                </button>

                <button onclick="abrirModalAbono(${h.id}, '${nombreFilt.replace(/'/g, "\\'")}', ${debtNum})" class="bg-indigo-600 text-white w-9 h-9 rounded-full flex justify-center items-center active:scale-90 shadow-lg ml-1 transition-transform">
                    <i class="fa-solid fa-dollar-sign text-xs"></i>
                </button>

                ${state.userRole === 'admin' ? `
                    <button onclick="toggleBloqueo(${h.id}, ${h.bloqueado ? true : false})" class="w-9 h-9 rounded-full ${h.bloqueado ? 'bg-red-600' : 'bg-slate-800'} border border-slate-700 flex justify-center items-center ml-1 active:scale-90 shadow-sm transition-all">
                        <i class="fa-solid ${h.bloqueado ? 'fa-lock' : 'fa-lock-open'} text-[10px]"></i>
                    </button>
                ` : ''}
            </div>
        </div>`;
    }).join('');
    
    const elTotal = document.getElementById('total-deuda-global');
    const elCount = document.getElementById('count-deudores');
    
    if (elTotal) elTotal.innerText = `$${totalD.toFixed(2)}`;
    if (elCount) elCount.innerText = countD;
}

// 5. GESTIÓN DE ABONOS (CON CONVERSIÓN VES/USD)
window.abrirModalAbono = function(id, nombre, deuda) {
    if(deuda <= 0) return;
    abonoTemporal = { id, deudaMax: deuda };
    
    const elNombre = document.getElementById('abono-nombre');
    const elDeuda = document.getElementById('abono-deuda-actual');
    const modal = document.getElementById('modal-abono');
    
    if (elNombre) elNombre.innerText = `Abono: ${nombre}`;
    if (elDeuda) elDeuda.innerText = `$${deuda.toFixed(2)}`;
    if (modal) modal.classList.remove('hidden');
}

window.cerrarModalAbono = function() { 
    const modal = document.getElementById('modal-abono');
    const input = document.getElementById('input-monto-abono');
    
    if (modal) modal.classList.add('hidden'); 
    if (input) input.value = '';
}

window.confirmarAbono = async function() {
    const btn = document.getElementById('btn-confirma-abono');
    const inputMonto = document.getElementById('input-monto-abono');
    const selectMoneda = document.getElementById('select-moneda-abono');
    
    if (!btn || !inputMonto || !selectMoneda) return;
    
    let montoEscrito = parseFloat(inputMonto.value);
    const moneda = selectMoneda.value;
    
    if (isNaN(montoEscrito) || montoEscrito <= 0) return alert("⚠️ Ingresa un monto válido.");

    let montoUSD = moneda === 'VES' ? (montoEscrito / state.tasaBCV) : montoEscrito;

    if (montoUSD > abonoTemporal.deudaMax + 0.1) {
        return alert(`❌ El abono ($${montoUSD.toFixed(2)}) supera la deuda.`);
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>';

    try {
        const nuevaDeuda = Math.max(0, abonoTemporal.deudaMax - montoUSD);
        
        await _sb.from('estudiantes').update({ debt: nuevaDeuda }).eq('id', abonoTemporal.id);
        
        await _sb.from('ventas').insert([{
            id_orden: `ABO-${Date.now().toString().slice(-6)}`,
            total_usd: montoUSD,
            metodo_pago: moneda === 'VES' ? 'PAGO_MOVIL' : 'EFECTIVO',
            status: 'completado',
            estudiante_nombre: document.getElementById('abono-nombre').innerText.replace('Abono: ', '')
        }]);

        cerrarModalAbono();
        await syncCobranzas();
        alert(`✅ Abono registrado exitosamente.`);
        
    } catch (e) {
        alert("Error al procesar: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = "Procesar Abono ✅";
    }
}

// 6. TOGGLE BLOQUEO (Solo Admin)
window.toggleBloqueo = async function(id, estadoActual) {
    if(!confirm(`¿Deseas cambiar el estado de bloqueo para este representante?`)) return;

    try {
        await _sb.from('estudiantes').update({ bloqueado: !estadoActual }).eq('id', id);
        await syncCobranzas();
    } catch (e) {
        alert("Error: " + e.message);
    }
}