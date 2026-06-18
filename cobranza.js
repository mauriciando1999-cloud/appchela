<<<<<<< HEAD
// cobranza.js - Módulo de Cobranzas | Chela Sport 1972
=======
 (modal) modal.classList.add('hidden'); 
    if (input) input.value = '';
};

window.confirmarAbono = async function() {
// 5. RENDERIZADO DE LA LISTA (CON FORMATEO AUTOMÁTICO DE +58 PARA WHATSAPP)
function renderDeudores() {
    const list = document.getElementById('lista-deudores');
    if (!list) return;
    
    const searchEl = document.getElementById('search-deudor');
    const search = searchEl ? searchEl.value.toLowerCase() : '';
    
    // Calcular Deuda Absoluta (Global de verdad sumando Alumnos + Personal)
    let totalDGlobal = 0;
    state.estudiantes.forEach(e => totalDGlobal += parseFloat(e.debt || 0));
    state.personal.forEach(p => totalDGlobal += parseFloat(p.debt || 0));

    // Seleccionar origen de datos según pestaña actual
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
        
        // 1. Extraer solo los números puros
        let phoneClean = phoneFilt.replace(/\D/g, '');

        // 2. CORRECCIÓN DE +58: Forzar código de país internacional para la API de WhatsApp
        if (phoneClean.length > 0) {
            if (phoneClean.startsWith('0')) {
                // Si el usuario guardó el número como "04141234567", cambiamos el 0 por 58
                phoneClean = '58' + phoneClean.substring(1);
            } else if (!phoneClean.startsWith('58') && phoneClean.length === 10) {
                // Si lo guardó directo como "4141234567" (10 dígitos), le anteponemos el 58
                phoneClean = '58' + phoneClean;
            }
        }

        // Formatear descripciones y payloads basados en si es Alumno o Personal
        const subTexto = state.currentTab === 'alumnos' 
            ? `Rep: ${h.representante || 'No indicado'}` 
            : `Colaborador / Personal Interno`;

        const origin = window.location.origin;
        const linkPago = `${origin}/pago.html?tipo=${state.currentTab}&id=${h.id}&monto=${debtNum.toFixed(2)}`;

        // Mensaje WhatsApp personalizado por contexto
        const msgTexto = state.currentTab === 'alumnos'
            ? `*RECORDATORIO DE PAGO - CHELA SPORT 1972* 🏦\n\nHola, *${h.representante || nombreFilt}*.\nEl saldo pendiente por concepto de proveeduría de *${nombreFilt}* es de *$${debtNum.toFixed(2)}*.\n\nReporta tu pago móvil aquí: \n${linkPago}\n\n¡Muchas gracias!`
            : `*NOTIFICACIÓN DE CUENTA - CHELA SPORT 1972* 📑\n\nEstimado(a) *${nombreFilt}*.\nTe notificamos que mantienes un saldo pendiente en cuenta de *$${debtNum.toFixed(2)}*.\n\nPuedes verificar o reportar abonos aquí: \n${linkPago}`;

        const mensajeWa = encodeURIComponent(msgTexto);
        const urlWhatsApp = phoneClean ? `https// --- LÓGICA DE COBRANZAS Y RECORDATORIOS (SOPORTE ALUMNO / PERSONAL) ---
>>>>>>> f833ffe0c00f3fc30b82d14f401a685dcf175d35

// Nota: Ya no declaramos SB_URL ni _sb aquí porque los hereda automáticamente de config.js

window.state = {
    deudoresAlumnos: [],
    deudoresPersonal: [],
    currentTab: 'alumnos',
    currentAbono: null,
    tasa: 45.30
};

// ==========================================
// 1. INICIALIZACIÓN Y CARGA DE DATOS
// ==========================================
window.onload = async () => {
    await getBCV();
    await cargarDeudores();
};

async function getBCV() {
    try {
        const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
        const data = await res.json();
        if (data?.promedio) window.state.tasa = parseFloat(data.promedio);
    } catch (e) {
        console.warn("Error API BCV. Usando tasa de respaldo.");
    }
    const bcvVal = document.getElementById('bcv-val');
    if (bcvVal) bcvVal.innerText = `BCV: ${window.state.tasa.toFixed(2)}`;
}

async function cargarDeudores() {
    const contenedor = document.getElementById('lista-deudores');
    if(contenedor) contenedor.innerHTML = '<div class="text-center py-20"><i class="fa-solid fa-circle-notch fa-spin text-indigo-500 text-4xl"></i></div>';
    
    try {
        const [estRes, perRes] = await Promise.all([
            _sb.from('estudiantes').select('*').gt('debt', 0).order('name'),
            _sb.from('personal').select('*').gt('debt', 0).order('name')
        ]);
        
        window.state.deudoresAlumnos = estRes.data || [];
        window.state.deudoresPersonal = perRes.data || [];
        
        calcularMetricas();
        renderDeudores();
    } catch (e) {
        console.error("Error cargando deudores:", e);
    }
}

function calcularMetricas() {
    const totalEst = window.state.deudoresAlumnos.reduce((sum, e) => sum + parseFloat(e.debt), 0);
    const totalPer = window.state.deudoresPersonal.reduce((sum, p) => sum + parseFloat(p.debt), 0);
    const global = totalEst + totalPer;
    
    document.getElementById('total-deuda-global').innerText = `$${global.toFixed(2)}`;
    
    const count = window.state.currentTab === 'alumnos' ? window.state.deudoresAlumnos.length : window.state.deudoresPersonal.length;
    document.getElementById('count-deudores').innerText = count;
    document.getElementById('count-label').innerText = window.state.currentTab;
}

// ==========================================
// 2. RENDERIZADO Y TABS
// ==========================================
window.switchTab = function(tab) {
    window.state.currentTab = tab;
    
    const tabA = document.getElementById('tab-alumnos');
    const tabP = document.getElementById('tab-personal');
    
    if (tab === 'alumnos') {
        tabA.className = "flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl bg-indigo-600 text-white transition-all shadow-md";
        tabP.className = "flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl text-slate-400 hover:text-slate-200 transition-all hover:bg-slate-800";
    } else {
        tabP.className = "flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl bg-indigo-600 text-white transition-all shadow-md";
        tabA.className = "flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl text-slate-400 hover:text-slate-200 transition-all hover:bg-slate-800";
    }
    
    document.getElementById('search-deudor').value = '';
    calcularMetricas();
    renderDeudores();
}

<<<<<<< HEAD
window.renderDeudores = function() {
    const q = (document.getElementById('search-deudor').value || '').toLowerCase().trim();
    const container = document.getElementById('lista-deudores');
=======
// 5. RENDERIZADO DE LA LISTA (CON FORMATEO AUTOMÁTICO DE +58 PARA WHATSAPP)
function renderDeudores() {
    const list = document.getElementById('lista-deudores');
    if (!list) return;
>>>>>>> f833ffe0c00f3fc30b82d14f401a685dcf175d35
    
    const lista = window.state.currentTab === 'alumnos' ? window.state.deudoresAlumnos : window.state.deudoresPersonal;
    
    const filtrados = lista.filter(item => {
        const nombre = (item.name || item.nombre || '').toLowerCase();
        const rep = (item.representante || '').toLowerCase();
        return nombre.includes(q) || rep.includes(q);
    });
    
    if (filtrados.length === 0) {
        container.innerHTML = `<div class="text-center py-20 opacity-40 uppercase font-black text-[10px] tracking-widest"><i class="fa-solid fa-check-double text-4xl mb-3 block"></i>No hay deudas pendientes aquí</div>`;
        return;
    }

<<<<<<< HEAD
    container.innerHTML = filtrados.map(d => {
        const nombreStr = (d.name || d.nombre).replace(/'/g, "\\'");
        const isEstudiante = window.state.currentTab === 'alumnos';
        
=======
    let countActiveDebtors = 0;

    list.innerHTML = filtered.map(h => {
        const debtNum = parseFloat(h.debt || 0);
        if (debtNum > 0) { countActiveDebtors++; }

        const nombreFilt = h.name || 'Usuario';
        const phoneFilt = h.phone || '';
        
        // 1. Extraer solo los números puros
        let phoneClean = phoneFilt.replace(/\D/g, '');

        // 2. CORRECCIÓN DE +58: Forzar código de país internacional para la API de WhatsApp
        if (phoneClean.length > 0) {
            if (phoneClean.startsWith('0')) {
                // Si el usuario guardó el número como "04141234567", cambiamos el 0 por 58
                phoneClean = '58' + phoneClean.substring(1);
            } else if (!phoneClean.startsWith('58') && phoneClean.length === 10) {
                // Si lo guardó directo como "4141234567" (10 dígitos), le anteponemos el 58
                phoneClean = '58' + phoneClean;
            }
        }

        // Formatear descripciones y payloads basados en si es Alumno o Personal
        const subTexto = state.currentTab === 'alumnos' 
            ? `Rep: ${h.representante || 'No indicado'}` 
            : `Colaborador / Personal Interno`;

        const origin = window.location.origin;
        const linkPago = `${origin}/pago.html?tipo=${state.currentTab}&id=${h.id}&monto=${debtNum.toFixed(2)}`;

        // Mensaje WhatsApp personalizado por contexto
        const msgTexto = state.currentTab === 'alumnos'
            ? `*RECORDATORIO DE PAGO - CHELA SPORT 1972* 🏦\n\nHola, *${h.representante || nombreFilt}*.\nEl saldo pendiente por concepto de proveeduría de *${nombreFilt}* es de *$${debtNum.toFixed(2)}*.\n\nReporta tu pago móvil aquí: \n${linkPago}\n\n¡Muchas gracias!`
            : `*NOTIFICACIÓN DE CUENTA - CHELA SPORT 1972* 📑\n\nEstimado(a) *${nombreFilt}*.\nTe notificamos que mantienes un saldo pendiente en cuenta de *$${debtNum.toFixed(2)}*.\n\nPuedes verificar o reportar abonos aquí: \n${linkPago}`;

        const mensajeWa = encodeURIComponent(msgTexto);
        const urlWhatsApp = phoneClean ? `https://wa.me/${phoneClean}?text=${mensajeWa}` : '#';

>>>>>>> f833ffe0c00f3fc30b82d14f401a685dcf175d35
        return `
        <div class="bg-slate-900 border border-slate-800 p-6 rounded-[2.5rem] shadow-lg flex flex-col gap-4">
            <div class="flex justify-between items-start">
                <div>
                    <h3 class="font-black text-white text-sm uppercase leading-tight">${d.name || d.nombre}</h3>
                    ${isEstudiante ? `<p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1.5"><i class="fa-solid fa-user-tag text-indigo-500 mr-1"></i> ${d.representante || 'Sin Rep.'}</p>` : ''}
                </div>
                <div class="text-right">
                    <p class="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-0.5">Saldo Deudor</p>
                    <p class="text-2xl font-black text-red-400 tracking-tighter">$${parseFloat(d.debt).toFixed(2)}</p>
                </div>
            </div>
            
            <div class="grid grid-cols-2 gap-3 border-t border-slate-800/50 pt-5">
                <button onclick="enviarRecordatorio('${d.id}')" class="bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-300 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all flex justify-center items-center gap-2">
                    <i class="fa-brands fa-whatsapp text-emerald-500 text-sm"></i> Cobrar
                </button>
                <button onclick="abrirModalAbono('${d.id}', '${nombreStr}', ${d.debt})" class="bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-900/40 active:scale-95 transition-all flex justify-center items-center gap-2">
                    <i class="fa-solid fa-cash-register text-sm"></i> Abonar
                </button>
            </div>
        </div>`;
    }).join('');
}

// ==========================================
// 3. WHATSAPP (CON MENSAJE CÁLIDO)
// ==========================================
window.enviarRecordatorio = function(id) {
    const lista = window.state.currentTab === 'alumnos' ? window.state.deudoresAlumnos : window.state.deudoresPersonal;
    const deudor = lista.find(d => d.id == id);
    if (!deudor) return;

    const phoneNum = deudor.phone || deudor.telefono;
    if (!phoneNum) return alert("⚠️ Este deudor no tiene un teléfono registrado en el sistema.");
    
    let phoneClean = phoneNum.replace(/\D/g, '');
    if (phoneClean.startsWith('0')) phoneClean = '58' + phoneClean.substring(1);
    else if (!phoneClean.startsWith('58') && phoneClean.length === 10) phoneClean = '58' + phoneClean;

    const debtNum = parseFloat(deudor.debt);
    const nombreFilt = deudor.name || deudor.nombre;
    
    const tipoQuery = window.state.currentTab === 'personal' ? '&tipo=personal' : '';
    const linkPago = `https://mauriciando1999.github.io/Chela-Sport/pago.html?id=${id}&name=${encodeURIComponent(nombreFilt)}&debt=${debtNum.toFixed(2)}${tipoQuery}`;

    const msgTexto = window.state.currentTab === 'alumnos'
        ? `¡Hola, *${deudor.representante || nombreFilt}*! Esperamos que te encuentres muy bien. 👋\n\nTe escribimos desde la administración de Chela Sport 1972 para ayudarte a mantener al día la cuenta de *${nombreFilt}*. Actualmente, el saldo pendiente es de *$${debtNum.toFixed(2)}*.\n\nAgradecemos mucho tu apoyo para solventar este monto a la brevedad. Puedes realizar y reportar tu pago móvil de forma segura en este enlace:\n${linkPago}\n\n📌 *Nota importante:* Este enlace es de un solo uso. Para evitar confusiones en el sistema, una vez que reportes los últimos dígitos de tu referencia, por favor no vuelvas a utilizar este link para futuros abonos.\n\n¡Muchas gracias por tu colaboración y confianza!`
        
        : `¡Hola, *${nombreFilt}*! Esperamos que estés muy bien. 👋\n\nTe contactamos desde la administración para ayudarte a mantener al día tu cuenta de la cantina. Al día de hoy, tienes un saldo pendiente de *$${debtNum.toFixed(2)}*.\n\nTe agradecemos tu apoyo para liquidar este monto. Puedes reportar tu abono rápidamente aquí:\n${linkPago}\n\n📌 *Nota importante:* Este enlace es de un solo uso. Una vez que registres el pago con tu número de referencia, el link perderá validez para futuros abonos.\n\n¡Gracias por tu gestión y que tengas un excelente día!`;

    window.open(`https://wa.me/${phoneClean}?text=${encodeURIComponent(msgTexto)}`, '_blank');
}

// ==========================================
// 4. LÓGICA DE ABONOS Y CÓDIGO QR
// ==========================================
window.abrirModalAbono = function(id, nombre, deuda) {
    window.state.currentAbono = { id, nombre, deuda };
    document.getElementById('abono-nombre').innerText = `Abono: ${nombre}`;
    document.getElementById('abono-deuda-actual').innerText = `$${parseFloat(deuda).toFixed(2)}`;
    
    const inputMonto = document.getElementById('input-monto-abono');
    inputMonto.value = parseFloat(deuda).toFixed(2);
    
    if(typeof calcularAbonoBs === 'function') calcularAbonoBs();

    document.getElementById('modal-abono').classList.remove('hidden');
}

window.cerrarModalAbono = function() {
    window.state.currentAbono = null;
    document.getElementById('input-monto-abono').value = '';
    document.getElementById('preview-monto-bs').innerText = 'Bs. 0.00';
    document.getElementById('modal-abono').classList.add('hidden');
}

window.procesarAbono = async function(metodo) {
    const montoInput = parseFloat(document.getElementById('input-monto-abono').value);
    if (isNaN(montoInput) || montoInput <= 0) return alert("Ingresa un monto válido.");
    
    const deudor = window.state.currentAbono;
    if (!deudor) return;

    if (montoInput > deudor.deuda) {
        return alert(`⚠️ El monto no puede ser mayor a la deuda actual ($${deudor.deuda.toFixed(2)})`);
    }

    if (metodo === 'PAGO_MOVIL') {
        const montoBs = montoInput * window.state.tasa;
        document.getElementById('monto-bs-qr').innerText = `Bs. ${montoBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        window.state.currentAbono.metodoPendiente = metodo;
        window.state.currentAbono.montoAbonar = montoInput;
        document.getElementById('modal-abono').classList.add('hidden');
        document.getElementById('modal-qr').classList.remove('hidden');
        return;
    }

    const btn = event.currentTarget;
    const oldHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    await ejecutarAbonoDB(deudor.id, deudor.nombre, montoInput, metodo, null);
    btn.innerHTML = oldHtml;
}

window.confirmarReferencia = async function() {
    const ref = document.getElementById('ref-pago').value.trim();
    if (ref.length < 4) return alert("⚠️ Ingresa al menos los últimos 4 dígitos de la referencia.");

    const deudor = window.state.currentAbono;
    const btn = event.currentTarget;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verificando...';
    btn.disabled = true;

    await ejecutarAbonoDB(deudor.id, deudor.nombre, deudor.montoAbonar, deudor.metodoPendiente, ref);
    
    btn.innerHTML = originalText;
    btn.disabled = false;
    document.getElementById('ref-pago').value = '';
    document.getElementById('modal-qr').classList.add('hidden');
}

async function ejecutarAbonoDB(id_deudor, nombre_deudor, monto, metodo, referencia) {
    try {
        const idOrden = `ABO-${referencia || Date.now().toString().slice(-4)}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
        const montoBs = monto * window.state.tasa;
        
        const tabla = window.state.currentTab === 'alumnos' ? 'estudiantes' : 'personal';
        const statusVenta = metodo === 'PAGO_MOVIL' ? 'esperando_verificacion' : 'completado';
        
        const payloadVenta = {
            id_orden: idOrden,
            total_usd: monto, 
            monto_original: montoBs, 
            moneda: 'VES',
            metodo_pago: metodo,
            ref_pago: referencia || null, // CORRECCIÓN: Nombre exacto de la columna en Supabase
            status: statusVenta,
            tasa_referencia: window.state.tasa,
            items: [{ name: `Abono de deuda (${metodo.replace('_', ' ')})`, price: monto, qty: 1 }]
        };

        if (window.state.currentTab === 'alumnos') {
            payloadVenta.estudiante_id = id_deudor;
            payloadVenta.estudiante_nombre = nombre_deudor;
        } else {
            payloadVenta.personal_id = id_deudor;
            payloadVenta.estudiante_nombre = `[Personal] ${nombre_deudor}`;
        }

        const { error: errVenta } = await _sb.from('ventas').insert([payloadVenta]);
        if (errVenta) throw errVenta;

        if (metodo !== 'PAGO_MOVIL') {
            const deudorInfo = window.state.currentTab === 'alumnos' 
                ? window.state.deudoresAlumnos.find(d => d.id == id_deudor)
                : window.state.deudoresPersonal.find(d => d.id == id_deudor);
                
            const nuevaDeuda = Math.max(0, parseFloat(deudorInfo.debt) - monto);
            await _sb.from(tabla).update({ debt: nuevaDeuda }).eq('id', id_deudor);
        }

        alert(metodo === 'PAGO_MOVIL' ? "✅ Pago Móvil reportado. Pasó a la bandeja de verificación del administrador." : "✅ Abono en taquilla procesado con éxito.");
        
        if (metodo !== 'PAGO_MOVIL') cerrarModalAbono();
        
        await cargarDeudores();

    } catch (e) {
        alert("Error al procesar el abono: " + e.message);
    }
<<<<<<< HEAD
}
=======
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
window.renderDeudores = function() {
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
        
        // Formateo automático de código de país Venezuela (+58)
        if (phoneClean.length > 0) {
            if (phoneClean.startsWith('0')) {
                phoneClean = '58' + phoneClean.substring(1);
            } else if (!phoneClean.startsWith('58') && phoneClean.length === 10) {
                phoneClean = '58' + phoneClean;
            }
        }

        const subTexto = state.currentTab === 'alumnos' ? `Rep: ${h.representante || 'No indicado'}` : `Colaborador / Personal Interno`;
        const origin = window.location.origin;
        const linkPago = `${origin}/pago.html?tipo=${state.currentTab}&id=${h.id}&monto=${debtNum.toFixed(2)}`;

        const msgTexto = state.currentTab === 'alumnos'
            ? `*RECORDATORIO DE PAGO - CHELA SPORT 1972* 🏦\n\nHola, *${h.representante || nombreFilt}*.\nEl saldo pendiente por concepto de proveeduría de *${nombreFilt}* es de *$${debtNum.toFixed(2)}*.\n\nReporta tu pago móvil aquí: \n${linkPago}\n\n¡Muchas gracias!`
            : `*NOTIFICACIÓN DE CUENTA - CHELA SPORT 1972* 📑\n\nEstimado(a) *${nombreFilt}*.\nTe notificamos que mantienes un saldo pendiente en cuenta de *$${debtNum.toFixed(2)}*.\n\nPuedes verificar o reportar abonos aquí: \n${linkPago}`;

        // Codificación segura para no romper el HTML al inyectar el link
        const mensajeWa = encodeURIComponent(msgTexto).replace(/'/g, "%27");
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

                <button onclick="${phoneClean ? `window.open('${urlWhatsApp}', '_blank')` : `alert('Este registro no posee teléfono válido.')`}" class="bg-emerald-600 text-white w-9 h-9 rounded-full flex justify-center items-center active:scale-90 shadow-lg transition-transform">
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

// Esta función procesa el pago tal como lo requiere el HTML
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
        
        // 2. Registrar el Abono en Ventas para Arqueo de Caja
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
>>>>>>> f833ffe0c00f3fc30b82d14f401a685dcf175d35
