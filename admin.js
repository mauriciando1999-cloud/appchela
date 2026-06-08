// admin.js - ERP Gerencial Envolvia (Facturación Agrupada y Cajas Bs)
const SB_URL = 'https://ekvzmfsdshyoeggudksm.supabase.co';
const SB_KEY = 'sb_publishable_Go6ZDuD9pg1pC3k-s89jiQ_65TEYGnd';
const _sb = supabase.createClient(SB_URL, SB_KEY);
const ADMIN_EMAIL = 'mauriciando1999@gmail.com';
const URL_SISTEMA = 'https://appchela.vercel.app';

let state = { tasa: 45.30, tasaAyer: 45.00, facturas: [], ingresosMes: 0, gastosMes: 0, estudiantes: [] };

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
            state.tasaAyer = state.tasa - 0.05; 
        }
        
        document.getElementById('bcv-val-admin').innerText = `Bs. ${state.tasa.toFixed(2)}`;
        analizarTendencia();
    } catch (e) { console.warn("DolarAPI no responde, usando tasa de respaldo."); }
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
// 3. CARGA DE DATOS DEL ERP (INGRESOS Y FACTURAS)
// ==========================================
async function loadERP() {
    const hoy = new Date().toISOString().split('T')[0];
    const primerDiaMes = new Date();
    primerDiaMes.setDate(1);
    const mesInicioStr = primerDiaMes.toISOString().split('T')[0];

    // A. CARGAR VENTAS (INGRESOS)
    const { data: sales } = await _sb.from('ventas').select('total_usd, metodo_pago, created_at').gte('created_at', mesInicioStr);
    
    // Contenedores de caja para HOY (Guardamos en USD para cálculos matemáticos precisos)
    let cajaHoy = { PM_USD: 0, PUNTO_USD: 0, EFECTIVO_USD: 0 };
    state.ingresosMes = 0;

    if (sales) {
        sales.forEach(v => {
            const montoUsd = parseFloat(v.total_usd);
            state.ingresosMes += montoUsd; 

            if (v.created_at.startsWith(hoy)) {
                if(v.metodo_pago.includes('PAGO_MOVIL')) cajaHoy.PM_USD += montoUsd;
                else if(v.metodo_pago.includes('PUNTO')) cajaHoy.PUNTO_USD += montoUsd;
                else if(v.metodo_pago.includes('EFECTIVO')) cajaHoy.EFECTIVO_USD += montoUsd;
            }
        });
    }

    // B. CARGAR FACTURAS (CUENTAS POR PAGAR)
    try {
        const { data: facturasData, error } = await _sb.from('facturas').select('*').order('created_at', { ascending: false });
        if(error) throw error;
        
        state.facturas = facturasData || [];
        state.gastosMes = state.facturas.filter(f => f.created_at.startsWith(mesInicioStr.slice(0,7))).reduce((sum, f) => sum + parseFloat(f.monto_usd), 0);
    } catch(e) {
        console.warn("Error cargando facturas. Verifica la tabla.", e);
        state.facturas = [];
    }

    // C. CARGAR DEUDORES (Para botón masivo)
    const { data: estData } = await _sb.from('estudiantes').select('*');
    state.estudiantes = estData || [];

    renderDashboard(cajaHoy);
    renderFacturasAgrupadas();
}

function renderDashboard(cajaHoy) {
    // Renderizado Bancario (Prioridad Bolívares para Banesco y Exterior)
    const pmBs = (cajaHoy.PM_USD * state.tasa).toFixed(2);
    document.getElementById('caja-pm-bs').innerText = `Bs. ${pmBs}`;
    document.getElementById('caja-pm').innerText = `$${cajaHoy.PM_USD.toFixed(2)}`;

    const puntoBs = (cajaHoy.PUNTO_USD * state.tasa).toFixed(2);
    document.getElementById('caja-punto-bs').innerText = `Bs. ${puntoBs}`;
    document.getElementById('caja-punto').innerText = `$${cajaHoy.PUNTO_USD.toFixed(2)}`;

    // Caja Chica (Prioridad Dólares)
    document.getElementById('caja-efectivo').innerText = `$${cajaHoy.EFECTIVO_USD.toFixed(2)}`;
    document.getElementById('caja-efectivo-bs').innerText = `Bs. ${(cajaHoy.EFECTIVO_USD * state.tasa).toFixed(2)}`;

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
// 4. AGRUPACIÓN Y PAGO DE FACTURAS POR PROVEEDOR
// ==========================================
function renderFacturasAgrupadas() {
    const list = document.getElementById('lista-gastos');
    
    // 1. Filtrar solo las pendientes
    const pendientes = state.facturas.filter(f => f.status === 'pendiente');

    if (pendientes.length === 0) {
        list.innerHTML = `<div class="p-6 text-center text-slate-500 text-xs font-bold">Sin cuentas por pagar pendientes.</div>`;
        return;
    }

    // 2. Agrupar por proveedor
    const agrupado = pendientes.reduce((acc, f) => {
        const prov = f.proveedor || 'Sin Nombre';
        if (!acc[prov]) acc[prov] = { facturas: [], totalUsd: 0 };
        acc[prov].facturas.push(f);
        acc[prov].totalUsd += parseFloat(f.monto_usd);
        return acc;
    }, {});

    // 3. Renderizar grupos
    list.innerHTML = Object.keys(agrupado).map(proveedor => {
        const data = agrupado[proveedor];
        const numFacturas = data.facturas.length;
        
        return `
        <div class="p-4 flex justify-between items-center bg-slate-900 border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors">
            <div class="flex-1 pr-2">
                <p class="text-[11px] font-black uppercase text-white truncate"><i class="fa-solid fa-truck text-slate-500 mr-2"></i>${proveedor}</p>
                <div class="flex gap-2 mt-1">
                    <span class="text-[9px] px-2 py-0.5 rounded-md font-bold uppercase tracking-widest bg-indigo-900/30 text-indigo-400 border border-indigo-500/30">
                        ${numFacturas} Factura${numFacturas > 1 ? 's' : ''}
                    </span>
                </div>
            </div>
            <div class="flex items-center gap-3">
                <div class="text-right">
                    <span class="font-black text-sm text-red-400 block leading-tight">$${data.totalUsd.toFixed(2)}</span>
                    <span class="text-[9px] font-bold text-slate-500">Bs. ${(data.totalUsd * state.tasa).toFixed(2)}</span>
                </div>
                <button onclick="abrirModalPagoProveedor('${proveedor}')" class="bg-indigo-600 text-white w-8 h-8 rounded-full flex justify-center items-center hover:bg-indigo-500 transition-transform active:scale-90 shadow-lg shadow-indigo-900/50" title="Pagar Facturas">
                    <i class="fa-solid fa-money-bill-wave text-[10px]"></i>
                </button>
            </div>
        </div>`;
    }).join('');
}

// Ventana Dinámica para pago múltiple
// admin.js - Función corregida y actualizada
function abrirModalPagoProveedor(proveedor) {
    const facturas = state.facturas.filter(f => f.status === 'pendiente' && (f.proveedor || 'Sin Nombre') === proveedor);
    
    let facturasHtml = facturas.map(f => `
        <label class="flex items-center p-3 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer hover:border-indigo-500/50 transition-colors">
            <input type="checkbox" value="${f.id}" data-monto="${f.monto_usd}" checked onchange="recalcularTotalModal()" class="chk-factura w-4 h-4 text-indigo-600 bg-slate-900 border-slate-700 rounded focus:ring-indigo-500 focus:ring-2 mr-3">
            <div class="flex-1">
                <p class="text-[10px] font-black text-white uppercase">${f.concepto}</p>
            </div>
            <div class="text-right">
                <p class="text-xs font-black text-red-400">$${parseFloat(f.monto_usd).toFixed(2)}</p>
            </div>
        </label>
    `).join('');

    // Declaramos modalHtml UNA SOLA VEZ usando backticks
    let modalHtml = `
        <div id="modal-pago-multiple" class="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex flex-col justify-end p-4 pb-10 transition-all">
            <div class="bg-slate-900 w-full max-w-md mx-auto rounded-[2.5rem] border border-slate-800 p-6 shadow-2xl relative flex flex-col max-h-[85vh]">
                <button onclick="document.getElementById('modal-pago-multiple').remove()" class="absolute top-4 right-4 text-slate-400 hover:text-white p-2 active:scale-90"><i class="fa-solid fa-xmark text-xl"></i></button>
                
                <h3 class="text-white font-black uppercase tracking-widest text-sm mb-4">Liquidar a ${proveedor}</h3>
                
                <div class="flex-1 overflow-y-auto space-y-2 mb-4 pr-1 no-scrollbar">
                    ${facturasHtml}
                </div>

                <!-- SELECTOR DE CUENTA (NUEVO) -->
                <div class="mb-4">
                    <label class="text-[9px] text-slate-500 font-black uppercase">Cuenta de Pago</label>
                    <select id="cuenta-pago-origen" class="w-full bg-slate-950 border border-slate-700 text-white p-3 rounded-xl text-xs font-bold mt-1 outline-none">
                        <option value="caja_chica">Caja Chica (Efectivo)</option>
                        <option value="banesco_pm">Banesco PM</option>
                        <option value="exterior_punto">Exterior Punto</option>
                    </select>
                </div>

                <div class="bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-4 text-center">
                    <p id="modal-total-usd" class="text-2xl font-black text-white">$0.00</p>
                </div>

                <button onclick="procesarPagoMultiple('${proveedor}')" id="btn-confirma-pago-prov" class="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl text-xs uppercase active:scale-95 shadow-lg shadow-emerald-900/30">
                    Registrar Pago
                </button>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    recalcularTotalModal();
}


async function procesarPagoMultiple(proveedor) {
    const checkboxes = document.querySelectorAll('.chk-factura:checked');
    const idsAPagar = Array.from(checkboxes).map(chk => chk.value);
    const cuenta = document.getElementById('cuenta-pago-origen').value;
    const montoTotal = document.getElementById('modal-total-usd').innerText.replace('$','');

    if(idsAPagar.length === 0) return alert("Selecciona al menos una factura.");

    try {
        // 1. Marcar facturas como pagadas
        await _sb.from('facturas').update({ status: 'pagado' }).in('id', idsAPagar);
        
        // 2. Registrar el gasto en la tabla de banco (esto es lo que reduce tu saldo)
        await _sb.from('pagos_banco').insert([{
            banco: cuenta,
            referencia: 'PAGO_PROV_' + proveedor,
            monto: parseFloat(montoTotal),
            usado: true // Esto marcará el egreso
        }]);

        alert(`✅ Pago registrado en ${cuenta}.`);
        document.getElementById('modal-pago-multiple').remove();
        loadERP(); // Recarga el dashboard con los nuevos saldos
    } catch (e) {
        alert("Error: " + e.message);
    }
}
// Mantenemos la creación manual de facturas/gastos extra por si acaso
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
        await _sb.from('facturas').insert([{ 
            concepto: concepto, 
            proveedor: categoria, // Usamos proveedor en lugar de categoria para unificar
            monto_usd: monto, 
            status: 'pendiente',
            fecha_vencimiento: new Date().toISOString().split('T')[0]
        }]);
        document.getElementById('modal-gasto').classList.add('hidden');
        loadERP(); 
    } catch (e) { alert("Error: " + e.message); } 
    finally {
        btn.innerHTML = '<i class="fa-solid fa-plus"></i> Añadir a Cuentas x Pagar';
        btn.disabled = false;
    }
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