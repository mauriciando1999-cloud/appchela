// --- LÓGICA DE COBRANZAS Y RECORDATORIOS (SOPORTE ALUMNO / PERSONAL) ---

let state = { 
    estudiantes: [], 
    personal: [],
    currentTab: 'alumnos', // Control de vista activa
    userRole: 'vendedor',
    tasaBCV: 0 
};

let abonoTemporal = { id: null, deudaMax: 0 };

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
    // Consulta Alumnos
    try {
        const { data, error } = await _sb
            .from('estudiantes')
            .select('*')
            .order('name', { ascending: true });
        if (error) throw error;
        state.estudiantes = data || []; 
    } catch (e) {
        console.error("Error cargando estudiantes:", e);
    }

    // Consulta Personal Interno
    try {
        const { data, error } = await _sb
            .from('personal')
            .select('*')
            .order('name', { ascending: true });
        if (!error) {
            state.personal = data || [];
        }
    } catch (e) {
        console.error("Error cargando personal:", e);
    }

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
        const phoneClean = phoneFilt.replace(/\D/g,'');

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

// 6. GESTIÓN DE ABONOS (CON MUTACIÓN SEGÚN CONTEXTO)
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

let state = { 
    estudiantes: [], 
    personal: [],
    currentTab: 'alumnos', // Control de vista activa
    userRole: 'vendedor',
    tasaBCV: 0 
};

let abonoTemporal = { id: null, deudaMax: 0 };

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
    // Consulta Alumnos
    try {
        const { data, error } = await _sb
            .from('estudiantes')
            .select('*')
            .order('name', { ascending: true });
        if (error) throw error;
        state.estudiantes = data || []; 
    } catch (e) {
        console.error("Error cargando estudiantes:", e);
    }

    // Consulta Personal Interno
    try {
        const { data, error } = await _sb
            .from('personal')
            .select('*')
            .order('name', { ascending: true });
        if (!error) {
            state.personal = data || [];
        }
    } catch (e) {
        console.error("Error cargando personal:", e);
    }

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

// 6. GESTIÓN DE ABONOS (CON MUTACIÓN SEGÚN CONTEXTO)
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
        return alert(`❌ El abono ($${montoUSD.toFixed(2)}) supera la deuda actual.`);
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Procesando...';

    const targetTable = state.currentTab === 'alumnos' ? 'estudiantes' : 'personal';
    const prefijoTag = state.currentTab === 'alumnos' ? '[Alumno]' : '[Personal]';

    try {
        const nuevaDeuda = Math.max(0, abonoTemporal.deudaMax - montoUSD);
        
        // Ejecuta actualización en la tabla correspondiente
        await _sb.from(targetTable).update({ debt: nuevaDeuda }).eq('id', abonoTemporal.id);
        
        // Registra el log contable histórico en ventas
        await _sb.from('ventas').insert([{
            id_orden: `ABO-${Date.now().toString().slice(-6)}`,
            total_usd: montoUSD,
            metodo_pago: moneda === 'VES' ? 'PAGO_MOVIL' : 'EFECTIVO',
            status: 'completado',
            estudiante_nombre: `${prefijoTag} ${document.getElementById('abono-nombre').innerText.replace('Abono: ', '')}`
        }]);

        cerrarModalAbono();
        await syncCobranzas();
        alert(`✅ Abono registrado exitosamente.`);
        
    } catch (e) {
        alert("Error al procesar abono: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = "Procesar Abono ✅";
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
