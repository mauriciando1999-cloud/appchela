const SB_URL = 'https://ekvzmfsdshyoeggudksm.supabase.co';
const SB_KEY = 'sb_publishable_Go6ZDuD9pg1pC3k-s89jiQ_65TEYGnd';
const _sb = supabase.createClient(SB_URL, SB_KEY);
const ADMIN_EMAIL = 'mauriciando1999@gmail.com';

let state = { estudiantes: [], userRole: 'vendedor' };
let abonoTemporal = { id: null, deudaMax: 0 };

// 1. INICIALIZACIÓN Y AUTH
window.onload = async () => {
    const { data: { user } } = await _sb.auth.getUser();
    if(!user) return window.location.href = 'index.html';

    state.userRole = (user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) ? 'admin' : 'vendedor';
    
    // Mostrar botón admin si corresponde
    if(state.userRole === 'admin') {
        document.getElementById('btn-dashboard')?.classList.remove('hidden');
    }

    getBCV();
    syncCobranzas();
};

// 2. OBTENER TASA BCV
async function getBCV() {
    try {
        const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
        const data = await res.json();
        if (data?.promedio) {
            document.getElementById('bcv-val').innerText = `BCV: ${parseFloat(data.promedio).toFixed(2)}`;
        }
    } catch (e) {
        console.warn("Error tasa BCV");
    }
}

// 3. SINCRONIZACIÓN DE DATOS
async function syncCobranzas() {
    const { data, error } = await _sb.from('estudiantes').select('*').order('representante');
    if(error) return console.error(error);
    state.estudiantes = data || [];
    renderDeudores();
}

// 4. RENDERIZADO DE LISTA (Con Link Corregido)
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

        // --- LINK DE PAGO ROBUSTO ---
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
                <p class="text-[9px] text-slate-500 font-bold truncate">Rep: ${h.representante} • <span class="text-indigo-400">PIN: ${h.pin_seguridad || '----'}</span></p>
                <p class="text-[9px] text-indigo-400 mt-1 font-mono">${h.phone}</p>
            </div>
            
            <div class="flex items-center gap-2 shrink-0">
                <div class="text-right mr-2">
                    <p class="text-[8px] text-slate-500 uppercase font-black">Debe</p>
                    <p class="font-black text-sm text-red-400">$${debtNum.toFixed(2)}</p>
                </div>

                <button onclick="window.open('${urlWhatsApp}', '_blank')" class="bg-emerald-600 text-white w-9 h-9 rounded-full flex justify-center items-center active:scale-90 shadow-lg">
                    <i class="fa-brands fa-whatsapp text-sm"></i>
                </button>

                <button onclick="abrirModalAbono(${h.id}, '${h.name}', ${debtNum})" class="bg-indigo-600 text-white w-9 h-9 rounded-full flex justify-center items-center active:scale-90 shadow-lg ml-1">
                    <i class="fa-solid fa-dollar-sign text-xs"></i>
                </button>

                ${state.userRole === 'admin' ? `
                    <button onclick="toggleBloqueo(${h.id}, ${h.bloqueado})" class="w-9 h-9 rounded-full ${h.bloqueado ? 'bg-red-600' : 'bg-slate-800'} border border-slate-700 flex justify-center items-center ml-1 active:scale-90 shadow-sm">
                        <i class="fa-solid ${h.bloqueado ? 'fa-lock' : 'fa-lock-open'} text-[10px]"></i>
                    </button>
                ` : ''}
            </div>
        </div>`;
    }).join('');
    
    document.getElementById('total-deuda-global').innerText = `$${totalD.toFixed(2)}`;
    document.getElementById('count-deudores').innerText = countD;
}

// 5. GESTIÓN DE ABONOS
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
    const monto = parseFloat(document.getElementById('input-monto-abono').value);
    
    if (isNaN(monto) || monto <= 0 || monto > abonoTemporal.deudaMax + 0.1) {
        return alert("Monto inválido");
    }

    btn.disabled = true;
    btn.innerText = "Procesando...";

    try {
        const nuevaDeuda = Math.max(0, abonoTemporal.deudaMax - monto);
        
        // Actualizar Deuda
        await _sb.from('estudiantes').update({ debt: nuevaDeuda }).eq('id', abonoTemporal.id);
        
        // Registrar el abono como una venta para que sume a las estadísticas
        await _sb.from('ventas').insert([{
            id_orden: `ABO-${Date.now().toString().slice(-4)}`,
            total_usd: monto, 
            metodo_pago: 'ABONO_EFECTIVO', 
            status: 'completado', 
            items: [{ name: `Abono de Deuda`, qty: 1, price: monto }]
        }]);

        cerrarModalAbono();
        syncCobranzas();
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
        alert("Error al cambiar estatus: " + e.message);
    }
}