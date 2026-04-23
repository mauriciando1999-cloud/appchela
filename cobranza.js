// --- LÓGICA DE COBRANZAS Y RECORDATORIOS (VERSIÓN FINAL) ---

let state = { 
    estudiantes: [], 
    userRole: 'vendedor',
    tasaBCV: 0 
};

let abonoTemporal = { id: null, deudaMax: 0 };

// 1. INICIALIZACIÓN Y SEGURIDAD
window.onload = async () => {
    // Verificamos sesión (Las constantes _sb y ADMIN_EMAIL vienen de config.js)
    const { data: { user } } = await _sb.auth.getUser();
    if(!user) return window.location.href = 'login.html';

    // Definir Rol
    state.userRole = (user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) ? 'admin' : 'vendedor';
    
    // UI según rol
    if(state.userRole === 'admin') {
        document.getElementById('btn-dashboard')?.classList.remove('hidden');
    }

    // Cargar Tasa y luego Datos
    await getBCV();
    syncCobranzas();
};

// 2. OBTENER TASA (DolarAPI)
async function getBCV() {
    try {
        const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
        const data = await res.json();
        if (data?.promedio) {
            state.tasaBCV = parseFloat(data.promedio);
            const el = document.getElementById('bcv-val');
            if(el) el.innerText = `BCV: ${state.tasaBCV.toFixed(2)}`;
        }
    } catch (e) {
        console.warn("No se pudo sincronizar la tasa BCV");
    }
}

// 3. SINCRONIZACIÓN DE DATOS
async function syncCobranzas() {
    const { data, error } = await _sb
        .from('estudiantes')
        .select('*')
        .order('name', { ascending: true });
    
    if (error) {
        console.error("Error Supabase:", error);
        return;
    }
    
    state.estudiantes = data; 
    renderDeudores(); 
}

// 4. RENDERIZADO DE LA LISTA (CON WHATSAPP + ABONO)
function renderDeudores() {
    const list = document.getElementById('lista-deudores');
    if(!list) return;
    
    const search = document.getElementById('search-deudor').value.toLowerCase();
    
    let filtered = state.estudiantes.filter(e => 
        e.name.toLowerCase().includes(search) || 
        e.representante.toLowerCase().includes(search) ||
        e.phone.includes(search)
    );

    let totalD = 0;
    let countD = 0;

    list.innerHTML = filtered.map(h => {
        const debtNum = parseFloat(h.debt || 0);
        if(debtNum > 0) { totalD += debtNum; countD++; }

        // --- GENERACIÓN DE LINK DE WHATSAPP ---
        const origin = window.location.origin;
        const linkPago = `${origin}/pago.html?estudiante=${h.id}&monto=${debtNum.toFixed(2)}`;

        const mensajeWa = encodeURIComponent(
            `*RECORDATORIO DE PAGO - CHELA SPORT 1972* 🏦\n\n` +
            `Hola, *${h.representante}*. Te saludamos de la proveeduría.\n\n` +
            `El saldo pendiente de *${h.name}* es de *$${debtNum.toFixed(2)}*.\n\n` +
            `Reporta tu pago móvil aquí: \n${linkPago}\n\n` +
            `¡Gracias!`
        );
        
        const phoneClean = h.phone.replace(/\D/g,'');
        const urlWhatsApp = `https://wa.me/${phoneClean}?text=${mensajeWa}`;

        return `
        <div class="bg-slate-900 border ${h.bloqueado ? 'border-red-900/40' : 'border-slate-800'} p-4 rounded-2xl flex justify-between items-center shadow-sm mb-3">
            <div class="flex-1 overflow-hidden pr-2">
                <div class="flex items-center gap-2 mb-1">
                    <p class="text-[11px] font-black uppercase text-white truncate leading-none">${h.name}</p>
                    ${h.bloqueado ? '<span class="bg-red-600/20 text-red-500 border border-red-500/30 text-[7px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest">Bloqueado</span>' : ''}
                </div>
                <p class="text-[9px] text-slate-500 font-bold truncate">Rep: ${h.representante}</p>
                <p class="text-[9px] text-indigo-400 mt-1 font-mono">${h.phone}</p>
            </div>
            
            <div class="flex items-center gap-2 shrink-0">
                <div class="text-right mr-2">
                    <p class="text-[8px] text-slate-500 uppercase font-black">Debe</p>
                    <p class="font-black text-sm text-red-400">$${debtNum.toFixed(2)}</p>
                </div>

                <button onclick="window.open('${urlWhatsApp}', '_blank')" class="bg-emerald-600 text-white w-9 h-9 rounded-full flex justify-center items-center active:scale-90 shadow-lg transition-transform">
                    <i class="fa-brands fa-whatsapp text-sm"></i>
                </button>

                <button onclick="abrirModalAbono(${h.id}, '${h.name}', ${debtNum})" class="bg-indigo-600 text-white w-9 h-9 rounded-full flex justify-center items-center active:scale-90 shadow-lg ml-1 transition-transform">
                    <i class="fa-solid fa-dollar-sign text-xs"></i>
                </button>

                ${state.userRole === 'admin' ? `
                    <button onclick="toggleBloqueo(${h.id}, ${h.bloqueado})" class="w-9 h-9 rounded-full ${h.bloqueado ? 'bg-red-600' : 'bg-slate-800'} border border-slate-700 flex justify-center items-center ml-1 active:scale-90 shadow-sm transition-all">
                        <i class="fa-solid ${h.bloqueado ? 'fa-lock' : 'fa-lock-open'} text-[10px]"></i>
                    </button>
                ` : ''}
            </div>
        </div>`;
    }).join('');
    
    document.getElementById('total-deuda-global').innerText = `$${totalD.toFixed(2)}`;
    document.getElementById('count-deudores').innerText = countD;
}

// 5. GESTIÓN DE ABONOS (CON CONVERSIÓN VES/USD)
function abrirModalAbono(id, nombre, deuda) {
    if(deuda <= 0) return;
    abonoTemporal = { id, deudaMax: deuda };
    document.getElementById('abono-nombre').innerText = `Abono: ${nombre}`;
    document.getElementById('abono-deuda-actual').innerText = `$${deuda.toFixed(2)}`;
    document.getElementById('modal-abono').classList.remove('hidden');
}

function cerrarModalAbono() { 
    document.getElementById('modal-abono').classList.add('hidden'); 
    document.getElementById('input-monto-abono').value = '';
}

async function confirmarAbono() {
    const btn = document.getElementById('btn-confirma-abono');
    const inputMonto = document.getElementById('input-monto-abono');
    const moneda = document.getElementById('select-moneda-abono').value;
    
    let montoEscrito = parseFloat(inputMonto.value);
    
    if (isNaN(montoEscrito) || montoEscrito <= 0) return alert("⚠️ Ingresa un monto válido.");

    // --- LÓGICA MULTIMONEDA ---
    let montoUSD = montoEscrito;
    if (moneda === 'VES') {
        if (state.tasaBCV <= 0) return alert("❌ Tasa BCV no cargada.");
        montoUSD = montoEscrito / state.tasaBCV; 
    }

    if (montoUSD > abonoTemporal.deudaMax + 0.1) {
        return alert(`❌ El abono ($${montoUSD.toFixed(2)}) supera la deuda.`);
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Procesando...';

    try {
        const nuevaDeuda = Math.max(0, abonoTemporal.deudaMax - montoUSD);
        
        // Actualizar Deuda en Estudiantes
        await _sb.from('estudiantes').update({ debt: nuevaDeuda }).eq('id', abonoTemporal.id);
        
        // Registrar Venta (Dual: $ para reporte, Bs para auditoría)
        await _sb.from('ventas').insert([{
            id_orden: `ABO-${Date.now().toString().slice(-6)}`,
            total_usd: montoUSD,           // Esto alimenta tu ERP Gerencial
            monto_original: montoEscrito,   // Esto es lo que realmente entró (ej: 2000 Bs)
            moneda: moneda,                 // 'VES' o 'USD'
            tasa_referencia: state.tasaBCV,
            metodo_pago: moneda === 'VES' ? 'ABONO_BS' : 'ABONO_EFECTIVO', 
            status: 'completado',
            estudiante_id: abonoTemporal.id,
            estudiante_nombre: document.getElementById('abono-nombre').innerText.replace('Abono: ', '')
        }]);

        cerrarModalAbono();
        syncCobranzas();
        alert(`✅ Abono registrado por ${montoEscrito} ${moneda}`);
        
    } catch (e) {
        alert("Error: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = "Procesar Abono ✅";
    }
}

// 6. TOGGLE BLOQUEO (Solo Admin)
async function toggleBloqueo(id, estadoActual) {
    const accion = estadoActual ? "DESBLOQUEAR" : "BLOQUEAR";
    if(!confirm(`¿Deseas ${accion} el crédito para este representante?`)) return;

    try {
        const { error } = await _sb
            .from('estudiantes')
            .update({ bloqueado: !estadoActual })
            .eq('id', id);

        if(error) throw error;
        syncCobranzas();
    } catch (e) {
        alert("Error: " + e.message);
    }
}