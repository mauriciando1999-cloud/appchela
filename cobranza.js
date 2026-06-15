// cobranza.js - Módulo de Cobranzas | Chela Sport 1972

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

window.renderDeudores = function() {
    const q = (document.getElementById('search-deudor').value || '').toLowerCase().trim();
    const container = document.getElementById('lista-deudores');
    
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

    container.innerHTML = filtrados.map(d => {
        const nombreStr = (d.name || d.nombre).replace(/'/g, "\\'");
        const isEstudiante = window.state.currentTab === 'alumnos';
        
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
        
        // Forzamos los valores a negativo usando -Math.abs() para evitar errores si el usuario ya ingresa un número negativo
const payloadVenta = {
    id_orden: idOrden,
    total_usd: -Math.abs(monto),
    monto_original: -Math.abs(montoBs),
    moneda: 'VES',
    metodo_pago: metodo,
    referencia: referencia || null,
    status: statusVenta,
    tasa_referencia: window.state.tasa,
    items: [{ name: `Abono de deuda (${metodo.replace('_', ' ')})`, price: -Math.abs(monto), qty: 1 }]
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
}