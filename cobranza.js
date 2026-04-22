const SB_URL = 'https://ekvzmfsdshyoeggudksm.supabase.co';
const SB_KEY = 'sb_publishable_Go6ZDuD9pg1pC3k-s89jiQ_65TEYGnd';
const _sb = supabase.createClient(SB_URL, SB_KEY);
const ADMIN_EMAIL = 'mauriciando1999@gmail.com';

let state = { estudiantes: [], userRole: 'vendedor' };
let abonoTemporal = { id: null, deudaMax: 0 };

window.onload = async () => {
    const { data: { user } } = await _sb.auth.getUser();
    if(!user) return window.location.href = 'index.html';

    state.userRole = (user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) ? 'admin' : 'vendedor';
    if(state.userRole === 'admin') document.getElementById('btn-dashboard').classList.remove('hidden');

    getBCV();
    syncCobranzas();
};

async function getBCV() {
    try {
        const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
        const data = await res.json();
        if (data?.promedio) document.getElementById('bcv-val').innerText = `BCV: ${parseFloat(data.promedio).toFixed(2)}`;
    } catch (e) {}
}

async function syncCobranzas() {
    const { data } = await _sb.from('estudiantes').select('*').order('representante');
    state.estudiantes = data || [];
    renderDeudores();
}

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

        // --- CONSTRUCCIÓN DE LINK ROBUSTA ---
        const origin = window.location.origin;
        // Forzamos la barra diagonal y el nombre exacto del archivo
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
                </div>
                <p class="text-[9px] text-slate-500 font-bold truncate">Rep: ${h.representante}</p>
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
            </div>
        </div>`;
    }).join('');
    
    document.getElementById('total-deuda-global').innerText = `$${totalD.toFixed(2)}`;
    document.getElementById('count-deudores').innerText = countD;
}

function abrirModalAbono(id, nombre, deuda) {
    if(deuda <= 0) return;
    abonoTemporal = { id, deudaMax: deuda };
    document.getElementById('abono-nombre').innerText = `Abono: ${nombre}`;
    document.getElementById('abono-deuda-actual').innerText = `$${deuda.toFixed(2)}`;
    document.getElementById('modal-abono').classList.remove('hidden');
}

function cerrarModalAbono() { document.getElementById('modal-abono').classList.add('hidden'); }

async function confirmarAbono() {
    const monto = parseFloat(document.getElementById('input-monto-abono').value);
    if (isNaN(monto) || monto <= 0 || monto > abonoTemporal.deudaMax + 0.1) return alert("Monto inválido");

    const nuevaDeuda = Math.max(0, abonoTemporal.deudaMax - monto);
    await _sb.from('estudiantes').update({ debt: nuevaDeuda }).eq('id', abonoTemporal.id);
    
    // Log de la transacción
    await _sb.from('ventas').insert([{
        id_orden: `ABO-${Date.now().toString().slice(-4)}`,
        total_usd: monto, metodo_pago: 'ABONO', status: 'completado', items: [{ name: "Abono", qty: 1, price: monto }]
    }]);

    cerrarModalAbono();
    syncCobranzas();
}

async function toggleBloqueo(id, estado) {
    if(!confirm("¿Cambiar estatus de bloqueo?")) return;
    await _sb.from('estudiantes').update({ bloqueado: !estado }).eq('id', id);
    syncCobranzas();
}