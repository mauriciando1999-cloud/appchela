// =====================================================================
// admin.js - ERP Gerencial Envolvia (Arquitectura B2B Cero Fricción)
// =====================================================================
const SB_URL = 'https://ekvzmfsdshyoeggudksm.supabase.co';
const SB_KEY = 'sb_publishable_Go6ZDuD9pg1pC3k-s89jiQ_65TEYGnd';
const _sb = supabase.createClient(SB_URL, SB_KEY);
const ADMIN_EMAIL = 'mauriciando1999@gmail.com';
const URL_SISTEMA = 'https://appchela.vercel.app';

let state = { 
    tasa: 45.30, 
    tasaAyer: 45.00, 
    facturas: [], 
    ingresosMes: 0, 
    gastosMes: 0, 
    estudiantes: [] 
};

// ==========================================
// 1. INICIALIZACIÓN ULTRARRÁPIDA
// ==========================================
window.onload = async () => {
    const { data: { user } } = await _sb.auth.getUser();
    
    if(!user || user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        alert("Acceso denegado. Área exclusiva de gerencia.");
        return window.location.href = 'index.html';
    }

    await getBCV();
    await loadERP(); // Carga todo el ecosistema
};

function handleLogout() { _sb.auth.signOut().then(() => window.location.href = 'index.html'); }

// ==========================================
// 2. MOTOR BANCARIO Y FLUJO DE CAJA REAL
// ==========================================
async function loadERP() {
    // Obtenemos el inicio de mes para aislar la utilidad mensual
    const date = new Date();
    const mesInicioStr = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];

    // ⚡ MAGIA B2B: Extraemos TODA la data en una sola llamada paralela (Máxima Eficiencia)
    const [ventasRes, pagosRes, facturasRes, estRes] = await Promise.all([
        _sb.from('ventas').select('total_usd, metodo_pago, created_at, status'),
        _sb.from('pagos_banco').select('monto, banco'),
        _sb.from('facturas').select('*').order('created_at', { ascending: false }),
        _sb.from('estudiantes').select('id, name, representante, phone, debt')
    ]);

    const sales = ventasRes.data || [];
    const pagosBanco = pagosRes.data || [];
    state.facturas = facturasRes.data || [];
    state.estudiantes = estRes.data || [];

    // --- A. CÁLCULO DE CAJAS REALES (Histórico Completo) ---
    // Envolvia calcula el dinero real: Todo lo que entró menos todo lo que salió
    let caja = { banesco_pm: 0, exterior_punto: 0, caja_chica: 0 };

    sales.forEach(v => {
        // Solo sumamos dinero de ventas completadas o pendientes de pago móvil que ya entraron
        const m = parseFloat(v.total_usd || 0);
        if (v.metodo_pago.includes('PAGO_MOVIL')) caja.banesco_pm += m;
        else if (v.metodo_pago.includes('PUNTO')) caja.exterior_punto += m;
        else if (v.metodo_pago.includes('EFECTIVO')) caja.caja_chica += m;
    });

    // Restamos las liquidaciones a proveedores
    pagosBanco.forEach(p => {
        const m = parseFloat(p.monto || 0);
        if (p.banco === 'banesco_pm') caja.banesco_pm -= m;
        else if (p.banco === 'exterior_punto') caja.exterior_punto -= m;
        else if (p.banco === 'caja_chica') caja.caja_chica -= m;
    });

    // --- B. RENDIMIENTO MENSUAL (Solo este mes) ---
    state.ingresosMes = sales
        .filter(v => v.created_at >= mesInicioStr)
        .reduce((sum, v) => sum + parseFloat(v.total_usd || 0), 0);
        
    state.gastosMes = state.facturas
        .filter(f => f.created_at >= mesInicioStr)
        .reduce((sum, f) => sum + parseFloat(f.monto_usd || 0), 0);

    // Pintamos la interfaz
    renderDashboard(caja);
    renderFacturasAgrupadas();
}

function renderDashboard(caja) {
    // Caja Banesco (PM)
    document.getElementById('caja-pm').innerText = `$${caja.banesco_pm.toFixed(2)}`;
    document.getElementById('caja-pm-bs').innerText = `Bs. ${(caja.banesco_pm * state.tasa).toFixed(2)}`;

    // Caja Exterior (Punto)
    document.getElementById('caja-punto').innerText = `$${caja.exterior_punto.toFixed(2)}`;
    document.getElementById('caja-punto-bs').innerText = `Bs. ${(caja.exterior_punto * state.tasa).toFixed(2)}`;

    // Caja Chica (Efectivo)
    document.getElementById('caja-efectivo').innerText = `$${caja.caja_chica.toFixed(2)}`;
    document.getElementById('caja-efectivo-bs').innerText = `Bs. ${(caja.caja_chica * state.tasa).toFixed(2)}`;

    // Utilidad Mensual
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
// 3. CUENTAS POR PAGAR (AGRUPACIÓN INTELIGENTE)
// ==========================================
function renderFacturasAgrupadas() {
    const list = document.getElementById('lista-gastos');
    const pendientes = state.facturas.filter(f => f.status === 'pendiente');

    if (pendientes.length === 0) {
        list.innerHTML = `<div class="p-6 text-center text-emerald-500 text-xs font-black uppercase tracking-widest"><i class="fa-solid fa-check-double text-lg mb-2 block"></i> Empresa libre de deudas</div>`;
        return;
    }

    // Agrupamos la deuda por proveedor para liquidarla de un solo golpe
    const agrupado = pendientes.reduce((acc, f) => {
        const prov = f.proveedor || 'Otros Gastos';
        if (!acc[prov]) acc[prov] = { facturas: [], totalUsd: 0 };
        acc[prov].facturas.push(f);
        acc[prov].totalUsd += parseFloat(f.monto_usd);
        return acc;
    }, {});

    list.innerHTML = Object.keys(agrupado).map(proveedor => {
        const data = agrupado[proveedor];
        return `
        <div class="p-4 flex justify-between items-center bg-slate-900 border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors">
            <div class="flex-1 pr-2">
                <p class="text-[11px] font-black uppercase text-white truncate"><i class="fa-solid fa-file-invoice text-slate-500 mr-2"></i>${proveedor}</p>
                <div class="flex gap-2 mt-1">
                    <span class="text-[9px] px-2 py-0.5 rounded-md font-bold uppercase tracking-widest bg-indigo-900/30 text-indigo-400 border border-indigo-500/30">
                        ${data.facturas.length} Factura(s)
                    </span>
                </div>
            </div>
            <div class="flex items-center gap-3">
                <div class="text-right">
                    <span class="font-black text-sm text-red-400 block leading-tight">$${data.totalUsd.toFixed(2)}</span>
                    <span class="text-[9px] font-bold text-slate-500">Bs. ${(data.totalUsd * state.tasa).toFixed(2)}</span>
                </div>
                <button onclick="abrirModalPagoProveedor('${proveedor}')" class="bg-indigo-600 text-white w-8 h-8 rounded-full flex justify-center items-center hover:bg-indigo-500 transition-transform active:scale-90 shadow-lg shadow-indigo-900/50" title="Liquidar Deuda">
                    <i class="fa-solid fa-money-bill-wave text-[10px]"></i>
                </button>
            </div>
        </div>`;
    }).join('');
}

// ==========================================
// 4. LIQUIDACIÓN DE PROVEEDORES CERO FRICCIÓN
// ==========================================
window.abrirModalPagoProveedor = function(proveedor) {
    // Si ya existe un modal anterior, lo limpiamos para evitar bugs
    document.getElementById('modal-pago-multiple')?.remove();

    const facturas = state.facturas.filter(f => f.status === 'pendiente' && (f.proveedor || 'Otros Gastos') === proveedor);
    
    let facturasHtml = facturas.map(f => `
        <label class="flex items-center p-3 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer hover:border-indigo-500/50 transition-colors">
            <input type="checkbox" value="${f.id}" data-monto="${f.monto_usd}" checked onchange="recalcularTotalModal()" class="chk-factura w-4 h-4 text-indigo-600 bg-slate-900 border-slate-700 rounded focus:ring-indigo-500 focus:ring-2 mr-3">
            <div class="flex-1 overflow-hidden">
                <p class="text-[10px] font-black text-white uppercase truncate">${f.concepto}</p>
            </div>
            <div class="text-right pl-2">
                <p class="text-xs font-black text-red-400">$${parseFloat(f.monto_usd).toFixed(2)}</p>
            </div>
        </label>
    `).join('');

    let modalHtml = `
        <div id="modal-pago-multiple" class="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex flex-col justify-end p-4 pb-10 transition-all">
            <div class="bg-slate-900 w-full max-w-md mx-auto rounded-[2.5rem] border border-slate-800 p-6 shadow-2xl relative flex flex-col max-h-[85vh]">
                <button onclick="document.getElementById('modal-pago-multiple').remove()" class="absolute top-4 right-4 text-slate-400 hover:text-white p-2 active:scale-90"><i class="fa-solid fa-xmark text-xl"></i></button>
                
                <h3 class="text-white font-black uppercase tracking-widest text-sm mb-4">Liquidar a ${proveedor}</h3>
                
                <div class="flex-1 overflow-y-auto space-y-2 mb-4 pr-1 no-scrollbar">
                    ${facturasHtml}
                </div>

                <div class="mb-4">
                    <label class="text-[9px] text-slate-500 font-black uppercase tracking-widest">Descontar saldo de:</label>
                    <select id="cuenta-pago-origen" class="w-full bg-slate-950 border border-slate-700 text-white p-4 rounded-xl text-xs font-bold mt-1 outline-none focus:border-indigo-500 appearance-none">
                        <option value="banesco_pm">🏦 Banesco (Pago Móvil)</option>
                        <option value="exterior_punto">💳 Exterior (Punto)</option>
                        <option value="caja_chica">💵 Caja Chica (Efectivo)</option>
                    </select>
                </div>

                <div class="bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-4 text-center shadow-inner">
                    <p class="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Monto a Liquidar</p>
                    <p id="modal-total-usd" class="text-3xl font-black text-white">$0.00</p>
                </div>

                <button onclick="procesarPagoMultiple('${proveedor}')" id="btn-confirma-pago-prov" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest active:scale-95 transition-transform shadow-lg shadow-emerald-900/30">
                    Registrar Salida de Dinero
                </button>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    recalcularTotalModal();
}

window.recalcularTotalModal = function() {
    const checkboxes = document.querySelectorAll('.chk-factura:checked');
    let total = 0;
    checkboxes.forEach(chk => { total += parseFloat(chk.getAttribute('data-monto')); });
    document.getElementById('modal-total-usd').innerText = `$${total.toFixed(2)}`;
}

window.procesarPagoMultiple = async function(proveedor) {
    const checkboxes = document.querySelectorAll('.chk-factura:checked');
    const idsAPagar = Array.from(checkboxes).map(chk => chk.value);
    const cuenta = document.getElementById('cuenta-pago-origen').value;
    const montoTotal = document.getElementById('modal-total-usd').innerText.replace('$','');

    if(idsAPagar.length === 0) return alert("Selecciona al menos una factura para pagar.");

    const btn = document.getElementById('btn-confirma-pago-prov');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Liquidando...';
    btn.disabled = true;

    try {
        // 1. Cambiamos el estado de las facturas a pagado
        await _sb.from('facturas').update({ status: 'pagado' }).in('id', idsAPagar);
        
        // 2. Registramos la salida de dinero real en el banco
        await _sb.from('pagos_banco').insert([{
            banco: cuenta,
            referencia: 'LIQUIDACION_' + proveedor.replace(/\s/g, '_'),
            monto: parseFloat(montoTotal),
            usado: true 
        }]);

        alert(`✅ Cuentas liquidadas con éxito. Saldo descontado del banco.`);
        document.getElementById('modal-pago-multiple').remove();
        
        // Recargamos el ERP para ver como bajan los saldos bancarios en vivo
        loadERP(); 
    } catch (e) {
        alert("Error de conexión: " + e.message);
        btn.innerHTML = 'Registrar Salida de Dinero';
        btn.disabled = false;
    }
}

// ==========================================
// 5. INGRESO RÁPIDO DE GASTOS EXTRAS
// ==========================================
window.abrirModalGasto = function() {
    document.getElementById('gasto-concepto').value = '';
    document.getElementById('gasto-monto').value = '';
    document.getElementById('modal-gasto').classList.remove('hidden');
}

window.guardarGasto = async function() {
    const concepto = document.getElementById('gasto-concepto').value.trim();
    const proveedor = document.getElementById('gasto-categoria').value;
    const monto = parseFloat(document.getElementById('gasto-monto').value);

    if(!concepto || isNaN(monto) || monto <= 0) return alert("⚠️ Llena el concepto y un monto válido.");

    const btn = document.getElementById('btn-save-gasto');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Registrando...';
    btn.disabled = true;

    try {
        await _sb.from('facturas').insert([{ 
            concepto: concepto, 
            proveedor: proveedor, 
            monto_usd: monto, 
            status: 'pendiente',
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
// 6. COBRANZA B2B INTELIGENTE
// ==========================================
window.cobranzaMasiva = async function() {
    const deudores = state.estudiantes.filter(e => parseFloat(e.debt) > 0);
    if (deudores.length === 0) return alert("¡Excelente! El flujo de caja está sano, no hay morosos. 🎉");

    if (!confirm(`Se enviarán notificaciones de cobro a ${deudores.length} cuentas pendientes.\n\n¿Deseas iniciar el envío automático?`)) return;

    for (let i = 0; i < deudores.length; i++) {
        const d = deudores[i];
        const monto = parseFloat(d.debt).toFixed(2);
        const link = `${URL_SISTEMA}/pago.html?estudiante=${d.id}&monto=${monto}`;
        
        const msg = encodeURIComponent(`*ESTADO DE CUENTA - CHELA SPORT* 🏦\n\nHola ${d.representante}, le escribe el equipo administrativo de Chela Sport.\n\nSu cuenta mantiene un saldo pendiente de *$${monto}* por consumos en la proveeduría.\n\nPara solventar este monto de manera rápida vía Pago Móvil y mantener su límite de crédito activo, ingrese a nuestro portal seguro:\n👉 ${link}\n\n_Si ya realizó el pago, por favor ignore este mensaje. ¡Gracias por confiar en nosotros!_`);
        
        const urlWa = `https://wa.me/${d.phone}?text=${msg}`;
        
        // Abre pestañas cada 2.5 segundos para evitar bloqueos por parte del navegador
        setTimeout(() => { window.open(urlWa, '_blank'); }, i * 2500); 
    }
    
    alert("🚀 Campaña iniciada. Presiona 'Enviar' en las pestañas de WhatsApp que se acaban de abrir.");
}

// ==========================================
// 7. SINCRONIZADOR API BCV
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
    } catch (e) { console.warn("DolarAPI no responde, usando tasa estática de respaldo."); }
}

function analizarTendencia() {
    const card = document.getElementById('tendencia-card');
    const texto = document.getElementById('tendencia-texto');
    const icono = document.getElementById('tendencia-icono');

    if (state.tasa > state.tasaAyer) {
        card.classList.add('border-orange-500/30', 'bg-orange-950/20');
        texto.innerText = "Alza Detectada. Recomendable liquidar en Bs hoy mismo.";
        texto.classList.replace('text-slate-500', 'text-orange-400');
        icono.innerHTML = '<i class="fa-solid fa-arrow-trend-up text-orange-500"></i>';
    } else {
        card.classList.add('border-emerald-500/30');
        texto.innerText = "Tasa Estable. Momento ideal para compras de stock.";
        texto.classList.replace('text-slate-500', 'text-emerald-400');
        icono.innerHTML = '<i class="fa-solid fa-check-double text-emerald-500"></i>';
    }
}