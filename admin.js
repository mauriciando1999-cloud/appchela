// admin.js - ERP Gerencial Envolvia
const SB_URL = 'https://ekvzmfsdshyoeggudksm.supabase.co';
const SB_KEY = 'sb_publishable_Go6ZDuD9pg1pC3k-s89jiQ_65TEYGnd';
const _sb = supabase.createClient(SB_URL, SB_KEY);
const ADMIN_EMAIL = 'mauriciando1999@gmail.com';
const URL_SISTEMA = 'https://appchela.vercel.app';

let state = { tasa: 45.30, tasaAyer: 45.00, gastos: [], ingresosMes: 0, gastosMes: 0, estudiantes: [] };

// ==========================================
// 1. INICIALIZACIÓN
// ==========================================
window.onload = async () => {
    const { data: { user } } = await _sb.auth.getUser();
    
    if(!user || user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        alert("Acceso denegado. Área exclusiva de gerencia.");
        return window.location.href = 'index.html';
    }

    await getBCV();
    await loadERP();
};

function handleLogout() { _sb.auth.signOut().then(() => window.location.href = 'index.html'); }

// ==========================================
// 2. INDICADOR BCV Y TENDENCIA
// ==========================================
async function getBCV() {
    try {
        const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
        const data = await res.json();
        
        if (data?.promedio) {
            state.tasa = parseFloat(data.promedio);
            state.tasaAyer = state.tasa - 0.05; // Simulación académica de tendencia
        }
        
        document.getElementById('bcv-val-admin').innerText = `Bs. ${state.tasa.toFixed(2)}`;
        analizarTendencia();
    } catch (e) { console.warn("DolarAPI no responde"); }
}

function analizarTendencia() {
    const card = document.getElementById('tendencia-card');
    const texto = document.getElementById('tendencia-texto');
    const icono = document.getElementById('tendencia-icono');

    if (state.tasa > state.tasaAyer) {
        card.classList.add('border-orange-500/30', 'bg-orange-950/20');
        texto.innerText = "Alza Detectada. Liquide facturas en Bs hoy.";
        texto.classList.replace('text-slate-500', 'text-orange-400');
        icono.innerHTML = '<i class="fa-solid fa-arrow-trend-up text-orange-500"></i>';
    } else {
        card.classList.add('border-emerald-500/30');
        texto.innerText = "Tasa Estable. Buen momento para negociar proveedores.";
        texto.classList.replace('text-slate-500', 'text-emerald-400');
        icono.innerHTML = '<i class="fa-solid fa-check-double text-emerald-500"></i>';
    }
}

// ==========================================
// 3. CARGA DE DATOS DEL ERP (INGRESOS Y GASTOS)
// ==========================================
async function loadERP() {
    // Definimos fechas (Hoy para tesorería, Todo el mes para Utilidad)
    const hoy = new Date().toISOString().split('T')[0];
    const primerDiaMes = new Date();
    primerDiaMes.setDate(1);
    const mesInicioStr = primerDiaMes.toISOString().split('T')[0];

    // A. CARGAR VENTAS (INGRESOS)
    const { data: sales } = await _sb.from('ventas').select('total_usd, metodo_pago, created_at').gte('created_at', mesInicioStr);
    
    let cajaHoy = { PM: 0, PUNTO: 0, EFECTIVO: 0 };
    state.ingresosMes = 0;

    if (sales) {
        sales.forEach(v => {
            const monto = parseFloat(v.total_usd);
            state.ingresosMes += monto; // Sumar al mes

            // Si la venta es de hoy, la metemos en la tesorería diaria
            if (v.created_at.startsWith(hoy)) {
                if(v.metodo_pago.includes('PAGO_MOVIL')) cajaHoy.PM += monto;
                else if(v.metodo_pago.includes('PUNTO')) cajaHoy.PUNTO += monto;
                else if(v.metodo_pago.includes('EFECTIVO')) cajaHoy.EFECTIVO += monto;
            }
        });
    }

    // B. CARGAR GASTOS (EGRESOS)
    // Usamos try-catch por si la tabla 'gastos' aún no ha sido creada en Supabase
    try {
        const { data: gastosData, error } = await _sb.from('gastos').select('*').order('estado', { ascending: false }).order('created_at', { ascending: false });
        if(error) throw error;
        
        state.gastos = gastosData || [];
        state.gastosMes = state.gastos.reduce((sum, g) => sum + parseFloat(g.monto_usd), 0);
    } catch(e) {
        console.warn("Tabla 'gastos' no encontrada. Ejecuta el SQL provisto.");
        state.gastos = [];
    }

    // C. CARGAR DEUDORES (Para botón masivo)
    const { data: estData } = await _sb.from('estudiantes').select('*');
    state.estudiantes = estData || [];

    renderDashboard(cajaHoy);
    renderGastos();
}

function renderDashboard(cajaHoy) {
    // Render Tesorería Hoy
    document.getElementById('caja-pm').innerText = `$${cajaHoy.PM.toFixed(2)}`;
    document.getElementById('caja-pm-bs').innerText = `Bs. ${(cajaHoy.PM * state.tasa).toFixed(2)}`;

    document.getElementById('caja-punto').innerText = `$${cajaHoy.PUNTO.toFixed(2)}`;
    document.getElementById('caja-punto-bs').innerText = `Bs. ${(cajaHoy.PUNTO * state.tasa).toFixed(2)}`;

    document.getElementById('caja-efectivo').innerText = `$${cajaHoy.EFECTIVO.toFixed(2)}`;
    document.getElementById('caja-efectivo-bs').innerText = `Bs. ${(cajaHoy.EFECTIVO * state.tasa).toFixed(2)}`;

    // Render Utilidad Mensual
    document.getElementById('stat-ingresos').innerText = `+$${state.ingresosMes.toFixed(2)}`;
    document.getElementById('stat-egresos').innerText = `-$${state.gastosMes.toFixed(2)}`;
    
    const utilidad = state.ingresosMes - state.gastosMes;
    const utilEl = document.getElementById('stat-utilidad');
    const badge = document.getElementById('tendencia-badge');
    
    utilEl.innerText = `$${Math.abs(utilidad).toFixed(2)}`;
    
    if(utilidad >= 0) {
        utilEl.classList.replace('text-red-400', 'text-white');
        badge.innerHTML = '<i class="fa-solid fa-arrow-up"></i> Rentable';
        badge.className = 'bg-emerald-900/40 text-emerald-400 px-3 py-1 rounded-full text-[10px] font-black border border-emerald-500/30 flex items-center gap-1';
    } else {
        utilEl.classList.replace('text-white', 'text-red-400');
        badge.innerHTML = '<i class="fa-solid fa-arrow-down"></i> Pérdida';
        badge.className = 'bg-red-900/40 text-red-400 px-3 py-1 rounded-full text-[10px] font-black border border-red-500/30 flex items-center gap-1';
    }
}

// ==========================================
// 4. CONTROL DE CUENTAS POR PAGAR (GASTOS)
// ==========================================
function renderGastos() {
    const list = document.getElementById('lista-gastos');
    
    if (state.gastos.length === 0) {
        list.innerHTML = `<div class="p-6 text-center text-slate-500 text-xs font-bold">Sin cuentas por pagar.</div>`;
        return;
    }

    list.innerHTML = state.gastos.map(g => {
        const isPagado = g.estado === 'pagado';
        const color = isPagado ? 'text-slate-500 line-through' : 'text-white';
        const badgeColor = isPagado ? 'bg-slate-800 text-slate-500' : 'bg-red-900/30 text-red-400 border border-red-500/30';
        
        const btnAccion = isPagado 
            ? `<i class="fa-solid fa-check-circle text-emerald-500 text-xl"></i>`
            : `<button onclick="pagarGasto(${g.id})" class="bg-slate-800 text-emerald-400 w-8 h-8 rounded-full flex justify-center items-center hover:bg-emerald-900 transition-colors border border-slate-700" title="Marcar como pagado"><i class="fa-solid fa-check text-xs"></i></button>`;

        return `
        <div class="p-4 flex justify-between items-center bg-slate-900">
            <div class="flex-1 pr-2">
                <p class="text-[11px] font-black uppercase ${color} truncate">${g.concepto}</p>
                <div class="flex gap-2 mt-1">
                    <span class="text-[8px] px-2 py-0.5 rounded-md font-bold uppercase tracking-widest ${badgeColor}">${g.categoria}</span>
                </div>
            </div>
            <div class="flex items-center gap-3">
                <span class="font-black text-sm ${isPagado ? 'text-slate-600' : 'text-red-400'}">$${parseFloat(g.monto_usd).toFixed(2)}</span>
                ${btnAccion}
            </div>
        </div>`;
    }).join('');
}

function abrirModalGasto() {
    document.getElementById('gasto-concepto').value = '';
    document.getElementById('gasto-monto').value = '';
    document.getElementById('modal-gasto').classList.remove('hidden');
}

async function guardarGasto() {
    const concepto = document.getElementById('gasto-concepto').value.trim();
    const categoria = document.getElementById('gasto-categoria').value;
    const monto = parseFloat(document.getElementById('gasto-monto').value);

    if(!concepto || isNaN(monto) || monto <= 0) return alert("⚠️ Llena el concepto y un monto válido.");

    const btn = document.getElementById('btn-save-gasto');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Registrando...';
    btn.disabled = true;

    try {
        await _sb.from('gastos').insert([{ concepto, categoria, monto_usd: monto, estado: 'pendiente' }]);
        document.getElementById('modal-gasto').classList.add('hidden');
        loadERP(); // Recarga todo el dashboard
    } catch (e) {
        alert("Error: Asegúrate de haber creado la tabla 'gastos' en Supabase. Detalles: " + e.message);
    } finally {
        btn.innerHTML = '<i class="fa-solid fa-plus"></i> Añadir a Cuentas x Pagar';
        btn.disabled = false;
    }
}

async function pagarGasto(id) {
    if(!confirm("¿Marcar esta factura de la empresa como PAGADA?")) return;
    
    try {
        await _sb.from('gastos').update({ estado: 'pagado' }).eq('id', id);
        loadERP();
    } catch (e) { alert(e.message); }
}

// ==========================================
// 5. COBRANZA MASIVA IA
// ==========================================
async function cobranzaMasiva() {
    const deudores = state.estudiantes.filter(e => parseFloat(e.debt) > 0);
    if (deudores.length === 0) return alert("¡Excelente! Tus clientes están al día. 🎉");

    if (!confirm(`Se enviarán avisos de cobro a ${deudores.length} clientes morosos.\n\n¿Disparar campaña?`)) return;

    for (let i = 0; i < deudores.length; i++) {
        const d = deudores[i];
        const monto = parseFloat(d.debt).toFixed(2);
        const link = `${URL_SISTEMA}/pago.html?estudiante=${d.id}&monto=${monto}`;
        
        const msg = encodeURIComponent(`*AVISO DE FACTURACIÓN - CHELA SPORT* 🏦\n\nEstimado/a ${d.representante}, este es un mensaje automático del departamento administrativo.\n\nSu cuenta mantiene un saldo pendiente de *$${monto}*.\n\nPara solventar este monto vía Pago Móvil, ingrese al siguiente enlace seguro:\n${link}\n\n_Ignorar si ya realizó el pago._`);
        
        const urlWa = `https://wa.me/${d.phone}?text=${msg}`;
        setTimeout(() => { window.open(urlWa, '_blank'); }, i * 2000); 
    }
    
    alert("Procesando ventanas. Dale 'Enviar' en cada pestaña de WhatsApp que se abra.");
}