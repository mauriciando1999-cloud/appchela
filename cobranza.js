// --- LÓGICA DE COBRANZAS Y RECORDATORIOS (SOPORTE ALUMNO / PERSONAL / PAGO UNIFICADO) ---

let state = { 
    estudiantes: [], 
    personal: [],
    currentTab: 'alumnos', 
    userRole: 'vendedor',
    tasaBCV: 0 
};

let abonoTemporal = { id: null, deudaMax: 0 };
window.ordenPendienteId = null;

// 1. INICIALIZACIÓN Y SEGURIDAD
window.onload = async () => {
    if (typeof _sb === 'undefined') return alert("Error: config.js no está cargando Supabase.");

    const { data: { user }, error } = await _sb.auth.getUser();
    if (error || !user) return window.location.href = 'index.html';

    state.userRole = (user.email.toLowerCase() === 'mauriciando1999@gmail.com') ? 'admin' : 'vendedor';
    
    const btnAdmin = document.getElementById('btn-admin');
    if (btnAdmin) {
        if (state.userRole === 'admin') btnAdmin.classList.remove('hidden');
        else btnAdmin.classList.add('hidden');
    }

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

// 3. SINCRONIZACIÓN MULTI-TABLA DE DATOS
async function syncCobranzas() {
    try {
        const { data, error } = await _sb
            .from('estudiantes')
            .select('*')
            .order('name', { ascending: true });
        if (error) throw error;
        state.estudiantes = data || []; 
    } catch (e) { console.error("Error cargando estudiantes:", e); }

    try {
        const { data, error } = await _sb
            .from('personal')
            .select('*')
            .order('name', { ascending: true });
        if (!error) state.personal = data || [];
    } catch (e) { console.error("Error cargando personal:", e); }

    renderDeudores(); 
}

// 4. CONTROLADOR DE PESTAÑAS
window.switchTab = function(tab) {
    state.currentTab = tab;
    const tabAlumnos = document.getElementById('tab-alumnos');
    const tabPersonal = document.getElementById('tab-personal');
    const countLabel = document.getElementById('count-label');

    if (tab === 'alumnos') {
        tabAlumnos.className = "flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl bg-indigo-600 text-white transition-all";
        tabPersonal.className = "flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl text-slate-400 hover:text-slate-200 transition-all";
        if (countLabel) countLabel.innerText = 'Alumnos';
    } else {
        tabPersonal.className = "flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl bg-indigo-600 text-white transition-all";
        tabAlumnos.className = "flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl text-slate-400 hover:text-slate-200 transition-all";
        if (countLabel) countLabel.innerText = 'Personal';
    }
    renderDeudores();
};

// 5. RENDERIZADO DE LA LISTA
function renderDeudores() {
    const list = document.getElementById('lista-deudores');
    if (!list) return;
    
    const searchEl = document.getElementById('search-deudor');
    const search = searchEl ? searchEl.value.toLowerCase() : '';
    
    let totalDGlobal = 0;
    state.estudiantes.forEach(e => totalDGlobal += parseFloat(e.debt || 0));
    state.personal.forEach(p => totalDGlobal += parseFloat(p.debt || 0));

    const targetDataset = state.currentTab === 'alumnos' ? state.estudiantes : state.personal;

    let filtered = targetDataset.filter(e => {
        const nombre = (e.name || '').toLowerCase();
        const rep = state.currentTab === 'alumnos' ? (e.representante || '').toLowerCase() : '';
        return nombre.includes(search) || rep.includes(search);
    });

    let countActiveDebtors = 0;

    list.innerHTML = filtered.map(h => {
        const debtNum = parseFloat(h.debt || 0);
        if (debtNum > 0) { countActiveDebtors++; }

        const nombreFilt = h.name || 'Usuario';
        const phoneFilt = h.phone || '';
        
        let phoneClean = phoneFilt.replace(/\D/g, ''); 
        if (phoneClean.startsWith('0')) phoneClean = '58' + phoneClean.substring(1);
        else if (phoneClean.length === 10) phoneClean = '58' + phoneClean;

        const subTexto = state.currentTab === 'alumnos' ? `Rep: ${h.representante || 'No indicado'}` : `Colaborador / Personal Interno`;
        const origin = window.location.origin;
        const linkPago = `${origin}/pago.html?tipo=${state.currentTab}&id=${h.id}&monto=${debtNum.toFixed(2)}`;

        const msgTexto = state.currentTab === 'alumnos'
            ? `¡Hola, *${h.representante || nombreFilt}*! Esperamos que te encuentres muy bien. 👋\n\nTe escribimos desde la administración de Chela Sport 1972 para ayudarte a mantener al día la cuenta de *${nombreFilt}*. Actualmente, el saldo pendiente es de *$${debtNum.toFixed(2)}*.\n\nAgradecemos mucho tu apoyo para solventar este monto a la brevedad. Puedes realizar y reportar tu pago móvil de forma segura en este enlace:\n${linkPago}\n\n📌 *Nota importante:* Este enlace es de un solo uso. Para evitar confusiones en el sistema, una vez que reportes los 4 últimos dígitos de tu referencia, por favor no vuelvas a utilizar este link para futuros abonos.\n\n¡Muchas gracias por tu colaboración y confianza!`
            
            : `¡Hola, *${nombreFilt}*! Esperamos que estés muy bien. 👋\n\nTe contactamos desde la administración para ayudarte a mantener al día tu cuenta de la cantina. Al día de hoy, tienes un saldo pendiente de *$${debtNum.toFixed(2)}*.\n\nTe agradecemos tu apoyo para liquidar este monto. Puedes verificar tu estado y reportar tu abono rápidamente aquí:\n${linkPago}\n\n📌 *Nota importante:* Este enlace es de un solo uso. Una vez que registres el pago con tu número de referencia, el link perderá validez para futuros abonos.\n\n¡Gracias por tu gestión y que tengas un excelente día!`;
        const mensajeWa = encodeURIComponent(msgTexto);
        const urlWhatsApp = phoneClean ? `https://wa.me/${phoneClean}?text=${mensajeWa}` : '#';

        return `
        <div class="bg-slate-900 border ${h.bloqueado ? 'border-red-900/40' : 'border-slate-800'} p-4 rounded-2xl flex justify-between items-center shadow-sm mb-3">
            <div class="flex-1 overflow-hidden pr-2">
                <div class="flex items-center gap-2 mb-1">
                    <p class="text-[11px] font-black uppercase text-white truncate leading-none">${nombreFilt}</p>
                    ${h.bloqueado ? '<span class="bg-red-600/20 text-red-500 border border-red-500/30 text-[7px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest">Bloqueado</span>' : ''}
                </div>
                <p class="text-[9px] text-slate-500 font-bold truncate">${subTexto}</p>
            </div>
            
            <div class="flex items-center gap-2 shrink-0">
                <div class="text-right mr-2">
                    <p class="text-[8px] text-slate-500 uppercase font-black">Debe</p>
                    <p class="font-black text-sm text-red-400">$${debtNum.toFixed(2)}</p>
                </div>

                <button onclick="${phoneClean.length >= 10 ? `window.open('${urlWhatsApp}', '_blank')` : `alert('Este registro no posee teléfono válido.')`}" class="bg-emerald-600 text-white w-9 h-9 rounded-full flex justify-center items-center active:scale-90 shadow-lg transition-transform">
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
    
    if (elTotal) elTotal.innerText = `$${totalDGlobal.toFixed(2)}`;
    if (elCount) elCount.innerText = countActiveDebtors;
}

// 6. GESTIÓN DE ABONOS Y PAGOS UNIFICADOS
window.abrirModalAbono = function(id, nombre, deuda) {
    if(deuda <= 0) return;
    abonoTemporal = { id, deudaMax: deuda };
    
    const elNombre = document.getElementById('abono-nombre');
    const elDeuda = document.getElementById('abono-deuda-actual');
    const modal = document.getElementById('modal-abono');
    
    if (elNombre) elNombre.innerText = `Abono: ${nombre}`;
    if (elDeuda) elDeuda.innerText = `$${deuda.toFixed(2)}`;
    if (modal) modal.classList.remove('hidden');
};

window.cerrarModalAbono = function() { 
    const modal = document.getElementById('modal-abono');
    const input = document.getElementById('input-monto-abono');
    
    if (modal) modal.classList.add('hidden'); 
    if (input) input.value = '';
};

// Esta función procesa el pago igual que app.js
window.procesarAbono = async function(method) {
    const inputMonto = document.getElementById('input-monto-abono');
    if (!inputMonto) return;
    
    let montoUSD = parseFloat(inputMonto.value);
    
    if (isNaN(montoUSD) || montoUSD <= 0) return alert("⚠️ Ingresa un monto válido.");
    if (montoUSD > abonoTemporal.deudaMax + 0.1) {
        return alert(`❌ El abono ($${montoUSD.toFixed(2)}) supera la deuda actual.`);
    }

    const targetTable = state.currentTab === 'alumnos' ? 'estudiantes' : 'personal';
    const nombreDeudor = document.getElementById('abono-nombre').innerText.replace('Abono: ', '');
    const prefijoEtiqueta = state.currentTab === 'alumnos' ? '[Abono Alumno]' : '[Abono Personal]';
    
    const idOrden = 'ABO-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    let statusVenta = method.includes('PAGO_MOVIL') ? 'pendiente' : 'completado';

    try {
        // 1. Reducir la Deuda Directamente
        const nuevaDeuda = Math.max(0, abonoTemporal.deudaMax - montoUSD);
        await _sb.from(targetTable).update({ debt: nuevaDeuda }).eq('id', abonoTemporal.id);
        
        // 2. Registrar el Abono en Ventas para Arqueo de Caja (Sin generar ganancia extra)
        await _sb.from('ventas').insert([{
            id_orden: idOrden,
            total_usd: montoUSD,
            metodo_pago: method,
            status: statusVenta,
            estudiante_nombre: (targetTable === 'estudiantes') ? `${prefijoEtiqueta} ${nombreDeudor}` : null,
            personal_id: (targetTable === 'personal') ? abonoTemporal.id : null,
            items: [{ name: `Abono a la Deuda - ${nombreDeudor}`, price: montoUSD, qty: 1 }],
            ganancia_total: 0 
        }]);

        cerrarModalAbono();

        if (method === 'PAGO_MOVIL') {
            window.ordenPendienteId = idOrden; 
            const totalBs = (montoUSD * state.tasaBCV).toLocaleString('es-VE', { minimumFractionDigits: 2 });
            document.getElementById('monto-bs-qr').innerText = `Bs. ${totalBs}`;
            document.getElementById('modal-qr').classList.remove('hidden');
        } else {
            alert(`✅ Abono registrado y verificado correctamente.`);
            await syncCobranzas();
        }
        
    } catch (e) {
        alert("Error al procesar el abono: " + e.message);
    }
};

window.confirmarReferencia = async function() {
    const ref = document.getElementById('ref-pago').value;

    if (ref.length !== 4) {
        return alert("Ingresa los 4 dígitos exactos de la referencia.");
    }

    try {
        await _sb.from('ventas')
            .update({ referencia: ref, status: 'esperando_verificacion' })
            .eq('id_orden', window.ordenPendienteId);

        alert("✅ Referencia enviada. Esperando verificación administrativa.");
        document.getElementById('modal-qr').classList.add('hidden');
        document.getElementById('ref-pago').value = '';
        window.ordenPendienteId = null;
        
        await syncCobranzas();
    } catch (e) {
        alert("Error al enviar referencia: " + e.message);
    }
};

// 7. CONTROL DE SEGURIDAD/BLOQUEOS
window.toggleBloqueo = async function(id, estadoActual) {
    if(!confirm(`¿Deseas cambiar el estado de restricción para este usuario del sistema?`)) return;

    const targetTable = state.currentTab === 'alumnos' ? 'estudiantes' : 'personal';

    try {
        await _sb.from(targetTable).update({ bloqueado: !estadoActual }).eq('id', id);
        await syncCobranzas();
    } catch (e) {
        alert("Error de red: " + e.message);
    }
};