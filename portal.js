// portal.js - Portal Familiar | Chela Sport 1972
const SB_URL = 'https://ekvzmfsdshyoeggudksm.supabase.co';
const SB_KEY = 'sb_publishable_Go6ZDuD9pg1pC3k-s89jiQ_65TEYGnd';
const _sb = supabase.createClient(SB_URL, SB_KEY);

let currentUser = { nombre: '', phone: '', pin: '' };
let estudiantesCached = []; 
let menuCached = [];

window.onload = () => {
    const savedPhone = localStorage.getItem('userPhone');
    if (savedPhone) {
        abrirDashboard(savedPhone);
    }
    verificarEstadoNotificaciones();
    verificarHappyHour();
    setInterval(verificarHappyHour, 60000); 
};

window.nextStep = function(stepId) {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    const target = document.getElementById('step-' + stepId);
    if(target) target.classList.add('active');
    window.scrollTo(0, 0);
};

window.toggleAudio = function() {
    const audio = document.getElementById('audio-instrucciones');
    const btn = document.getElementById('btn-audio');
    if (audio.paused) {
        audio.play().catch(e => console.log("Audio en espera."));
        btn.innerHTML = '<i class="fa-solid fa-pause text-white text-xl"></i>';
    } else {
        audio.pause();
        btn.innerHTML = '<i class="fa-solid fa-play text-white text-xl ml-1"></i>';
    }
};

window.guardarDatosRepresentante = function() {
    const nombre = document.getElementById('reg-nombre').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const pin = document.getElementById('reg-pin').value.trim();

    if(!nombre || !phone || !pin) return alert("⚠️ Rellena todos los campos.");
    if(pin.length < 4) return alert("⚠️ El PIN debe ser de 4 dígitos.");

    currentUser = { nombre, phone, pin };
    nextStep(3);
};

window.agregarCampoHijo = function() {
    const container = document.getElementById('contenedor-hijos');
    const totalHijos = container.querySelectorAll('input').length + 1;
    const div = document.createElement('div');
    div.className = "flex gap-2";
    div.innerHTML = `
        <input type="text" class="hijo-nombre w-full p-4 rounded-xl text-white bg-slate-950 border border-slate-800" placeholder="Nombre del alumno ${totalHijos}">
        <button type="button" onclick="this.parentElement.remove()" class="bg-red-500/10 border border-red-500/20 text-red-400 px-4 rounded-xl active:scale-95 transition-all">
            <i class="fa-solid fa-trash"></i>
        </button>
    `;
    container.appendChild(div);
};

window.procesarRegistroFinal = async function() {
    const inputs = document.querySelectorAll('.hijo-nombre');
    let listaHijos = [];
    inputs.forEach(i => { if(i.value.trim()) listaHijos.push(i.value.trim()); });
    
    if(listaHijos.length === 0) return alert("⚠️ Agrega al menos un alumno.");

    const btn = document.getElementById('btn-save');
    btn.disabled = true; 
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Creando...';

    try {
        const promesas = listaHijos.map(h => _sb.from('estudiantes').insert([{
            name: h, 
            representante: currentUser.nombre, 
            phone: currentUser.phone, 
            pin_seguridad: currentUser.pin, 
            debt: 0, 
            limite_credito: 100, 
            bloqueado: false
        }]));
        await Promise.all(promesas);
        localStorage.setItem('userPhone', currentUser.phone);
        abrirDashboard(currentUser.phone);
    } catch (err) { 
        alert(err.message); 
        btn.disabled = false; 
    }
}

window.acceder = async function() {
    const phone = document.getElementById('login-phone').value.trim();
    const pin = document.getElementById('login-pin').value.trim();
    const btn = document.getElementById('btn-login');

    if(!phone || !pin) return alert("⚠️ Ingresa tus credenciales.");

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Verificando...';

    const { data } = await _sb.from('estudiantes')
        .select('*')
        .eq('phone', phone)
        .eq('pin_seguridad', pin);
    
    if(data && data.length > 0) {
        localStorage.setItem('userPhone', phone);
        abrirDashboard(phone);
    } else {
        alert("❌ PIN o Teléfono incorrectos.");
        btn.disabled = false;
        btn.innerHTML = 'Acceder';
    }
}

window.abrirDashboard = async function(phone) {
    nextStep('dashboard');
    const container = document.getElementById('lista-hijos');
    container.innerHTML = '<div class="text-center py-6 text-slate-500 font-medium"><i class="fa-solid fa-circle-notch fa-spin mr-2 text-indigo-500"></i>Sincronizando portal...</div>';
    
    const { data, error } = await _sb.from('estudiantes').select('*').eq('phone', phone);
    
    if(error || !data || data.length === 0) {
        container.innerHTML = '<p class="text-center text-red-400 py-4 text-xs font-bold">Error de sincronización.</p>';
        return;
    }
    
    document.getElementById('dashboard-bienvenida').innerText = `Hola, ${data[0].representante}`;
    estudiantesCached = data;
    renderizarListaHijos(data);

    _sb.channel('alertas-compras').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ventas' }, (payload) => {
        const venta = payload.new;
        const hijoAfectado = estudiantesCached.find(h => venta.estudiante_nombre && venta.estudiante_nombre.includes(h.name));
        if (hijoAfectado) {
            let resumenItems = "Productos varios";
            if (venta.items && Array.isArray(venta.items)) resumenItems = venta.items.map(i => `${i.qty}x ${i.name}`).join(', ');
            dispararAlertaNativa(`🛒 ¡Nueva Compra de ${hijoAfectado.name}!`, `Consumo: $${parseFloat(venta.total_usd).toFixed(2)}
Llevó: ${resumenItems}`);
            solicitarDatosActualizados(phone);
        }
    }).subscribe();
}

async function solicitarDatosActualizados(phone) {
    const { data } = await _sb.from('estudiantes').select('*').eq('phone', phone);
    if (data) {
        estudiantesCached = data; 
        renderizarListaHijos(data);
    }
}

function renderizarListaHijos(data) {
    const container = document.getElementById('lista-hijos');
    container.innerHTML = '';
    let acumuladorDeuda = 0;
    const phone = data[0].phone;

    data.forEach(hijo => { acumuladorDeuda += parseFloat(hijo.debt || 0); });
    document.getElementById('total-deuda').innerText = `$${acumuladorDeuda.toFixed(2)}`;

    // NUEVO: BOTÓN DE PAGO FAMILIAR (Solo si hay varios hijos y tienen deuda)
    if (data.length > 1 && acumuladorDeuda > 0) {
        container.innerHTML += `
            <div class="bg-indigo-600/20 border border-indigo-500/50 p-4 rounded-3xl mb-5 text-center shadow-lg">
                <p class="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-2">Pago Conjunto (Todos los alumnos)</p>
                <button onclick="procesarPagoFamiliar(${acumuladorDeuda}, '${phone}', '${data[0].representante}')" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-xl uppercase tracking-widest text-[11px] shadow-lg active:scale-95 transition-all flex justify-center items-center gap-2">
                    <i class="fa-solid fa-users"></i> Pagar Deuda Total ($${acumuladorDeuda.toFixed(2)})
                </button>
            </div>
        `;
    }

    data.forEach(hijo => {
        const deudaActual = parseFloat(hijo.debt || 0);
        const btnBloqueo = hijo.bloqueado 
            ? `<button onclick="cambiarEstadoBloqueo('${hijo.id}', false, '${phone}')" class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold px-2.5 py-2 rounded-xl active:scale-95 transition-all w-full"><i class="fa-solid fa-lock-open"></i> Desbloq</button>`
            : `<button onclick="cambiarEstadoBloqueo('${hijo.id}', true, '${phone}')" class="bg-red-500/10 text-red-400 border border-red-500/20 text-[11px] font-bold px-2.5 py-2 rounded-xl active:scale-95 transition-all w-full"><i class="fa-solid fa-lock"></i> Bloquear</button>`;

        const btnPagar = deudaActual > 0
            ? `<button onclick="procesarPago('${hijo.id}', ${deudaActual}, '${phone}', '${hijo.name}')" class="col-span-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 text-[11px] font-bold px-3 py-3 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1 w-full"><i class="fa-solid fa-receipt text-[9px]"></i> Pagar Solo a ${hijo.name}</button>` : '';

        const statusBadge = hijo.bloqueado 
            ? `<span class="bg-red-500/10 text-red-400 border border-red-500/20 text-[9px] uppercase font-black px-2 py-0.5 rounded-md">Bloqueado</span>`
            : `<span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] uppercase font-black px-2 py-0.5 rounded-md">Activo</span>`;

        container.innerHTML += `
            <div class="p-4 bg-slate-900 border border-slate-800/60 rounded-2xl flex flex-col shadow-inner glass mb-3">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <p class="font-bold text-sm text-slate-100">${hijo.name}</p>
                        <p class="text-xs font-semibold text-slate-400 mt-0.5">Deuda: <span class="${deudaActual > 0 ? 'text-red-400 font-bold' : 'text-emerald-400'}">$${deudaActual.toFixed(2)}</span></p>
                    </div>
                    <div>${statusBadge}</div>
                </div>
                <div class="grid grid-cols-2 gap-2 border-t border-slate-800/50 pt-3">
                    ${btnBloqueo}
                    <button onclick="modificarLimiteDiario('${hijo.id}', ${hijo.limite_diario || 0}, '${phone}')" class="bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[11px] font-bold px-2.5 py-2 rounded-xl active:scale-95 transition-all w-full"><i class="fa-solid fa-wallet"></i> Límite</button>
                    ${btnPagar}
                </div>
                <button onclick="verHistorialAlumno('${hijo.name}')" class="w-full mt-2 bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all flex justify-center items-center gap-2"><i class="fa-solid fa-list"></i> Historial Completo</button>
            </div>
        `;
    });
}

window.procesarPagoFamiliar = function(deudaTotal, phone, representante) {
    window.location.href = `pago.html?bulk=true&name=${encodeURIComponent(representante)}&debt=${deudaTotal.toFixed(2)}&phone=${phone}`;
}
window.modificarLimiteDiario = async function(id, limiteActual, phone) {
    const nuevoLimite = prompt(`Establecer Límite de Crédito:
(Actual: $${limiteActual})`, limiteActual);
    if (nuevoLimite === null) return;
    const num = parseFloat(nuevoLimite);
    if (isNaN(num) || num < 0) return alert("Monto inválido.");
    
    document.body.style.cursor = 'wait'; 
    
    const { error } = await _sb.from('estudiantes').update({ limite_credito: num }).eq('id', id);
    
    document.body.style.cursor = 'default';

    if (!error) { 
        alert(`✅ Límite de crédito actualizado a $${num.toFixed(2)}`); 
        solicitarDatosActualizados(phone); 
    } else {
        alert(`❌ Supabase rechazó el cambio:
${error.message}`);
        console.error(error);
    }
}

window.cambiarEstadoBloqueo = async function(id, nuevoEstado, phone) {
    document.body.style.cursor = 'wait';
    
    const { error } = await _sb.from('estudiantes').update({ bloqueado: nuevoEstado }).eq('id', id);
    
    document.body.style.cursor = 'default';

    if (!error) {
        solicitarDatosActualizados(phone);
    } else {
        alert(`❌ Supabase rechazó el bloqueo:
${error.message}`);
        console.error(error);
    }
}
window.verHistorialAlumno = async function(nombreAlumno) {
    const modal = document.getElementById('modal-historial-portal');
    const contenedor = document.getElementById('lista-historial-portal');
    modal.classList.remove('hidden');
    document.getElementById('historial-nombre-alumno').innerText = nombreAlumno;
    contenedor.innerHTML = '<div class="flex flex-col items-center justify-center mt-20"><i class="fa-solid fa-circle-notch fa-spin text-3xl text-indigo-500 mb-3"></i></div>';

    const { data, error } = await _sb.from('ventas').select('created_at, total_usd, items, status, metodo_pago').eq('estudiante_nombre', nombreAlumno).order('created_at', { ascending: false }).limit(15);
    if (error || !data || data.length === 0) return contenedor.innerHTML = '<div class="text-center mt-20"><p class="text-xs font-bold text-slate-500 uppercase tracking-widest">No hay compras registradas</p></div>';

    contenedor.innerHTML = data.map(venta => {
        const fecha = new Date(venta.created_at).toLocaleDateString('es-VE', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute:'2-digit' });
        let detallesItems = venta.items && Array.isArray(venta.items) ? venta.items.map(i => `<span class="font-bold text-white">${i.qty}x</span> ${i.name}`).join('<br>') : "Sin detalles";
        const colorStatus = venta.status === 'completado' ? 'text-emerald-400 bg-emerald-400/10 border border-emerald-500/20' : 'text-amber-400 bg-amber-400/10 border border-amber-500/20';

        return `
        <div class="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-sm">
            <div class="flex justify-between items-start mb-3 border-b border-slate-800 pb-3">
                <div><p class="text-[10px] text-slate-400 font-bold uppercase mb-1">${fecha}</p><p class="text-lg font-black text-white leading-none">$${parseFloat(venta.total_usd).toFixed(2)}</p></div>
                <span class="px-2 py-1 rounded-lg text-[8px] font-black uppercase ${colorStatus}">${venta.status}</span>
            </div>
            <div class="text-[11px] text-slate-400 leading-relaxed">${detallesItems}</div>
        </div>`;
    }).join('');
}

window.procesarPago = function(id, deudaActual, phone, nombreEstudiante) {
    window.location.href = `pago.html?id=${id}&name=${encodeURIComponent(nombreEstudiante)}&debt=${deudaActual.toFixed(2)}&phone=${phone}&tipo=alumno`;
}
window.cerrarSesion = function() { localStorage.removeItem('userPhone'); location.reload(); }

window.verificarHappyHour = function() {
    const hora = new Date().getHours();
    const banner = document.getElementById('happy-hour-banner');
    if (banner) hora >= 12 && hora < 14 ? banner.classList.remove('hidden') : banner.classList.add('hidden');
}

window.abrirSugerencias = function() {
    document.getElementById('texto-sugerencia').value = '';
    document.getElementById('modal-sugerencias').classList.remove('hidden');
}
window.enviarSugerencia = async function() {
    const texto = document.getElementById('texto-sugerencia').value.trim();
    if(!texto) return alert("Escribe un mensaje.");
    const btn = document.getElementById('btn-enviar-sugerencia');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true;
    await _sb.from('sugerencias').insert([{ representante_phone: localStorage.getItem('userPhone'), mensaje: texto, estado: 'nueva' }]);
    alert("¡Mensaje enviado!");
    document.getElementById('modal-sugerencias').classList.add('hidden');
    btn.innerHTML = 'Enviar Mensaje'; btn.disabled = false;
}

window.verificarEstadoNotificaciones = function() {
    if (Notification.permission === "granted") {
        document.getElementById('txt-notificaciones').innerText = "Alertas Activadas";
        document.getElementById('btn-notificaciones').disabled = true;
    }
}
window.solicitarNotificaciones = async function() {
    if (!("Notification" in window)) return alert("Tu dispositivo no soporta notificaciones.");
    if (await Notification.requestPermission() === "granted") verificarEstadoNotificaciones();
}
async function dispararAlertaNativa(titulo, cuerpo) {
    if (Notification.permission !== "granted") return;
    if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) return reg.showNotification(titulo, { body: cuerpo });
    }
    try { new Notification(titulo, { body: cuerpo }); } catch(e) {}
}

// REDIRIGE AL MARKETPLACE DEL COLEGIO (antes se llamaba "Preventa Escolar",
// mismo destino de siempre — portal_preventa.html — solo cambió el nombre).
window.irAMarketplace = function() {
    if (estudiantesCached.length === 0) return alert("Cargando datos, espera un momento...");

    const rep = encodeURIComponent(estudiantesCached[0].representante);
    const tel = encodeURIComponent(estudiantesCached[0].phone);
    // Tomamos el primer alumno por defecto, en portal_preventa.html se podría hacer un select si hay varios
    const est = encodeURIComponent(estudiantesCached[0].name);

    window.location.href = `portal_preventa.html?rep=${rep}&est=${est}&tel=${tel}`;
}

// ACCESO A LA WEB DE CHELA (sitio de marca, catálogo general, etc.)
window.irAWebChela = function() {
    window.location.href = 'chela-web/index.html';
}

window.abrirMenuPortal = async function() {
    document.getElementById('modal-menu-portal').classList.remove('hidden');
    if (menuCached.length === 0) {
        const { data } = await _sb.from('productos').select('*').order('name');
        if (data) menuCached = data.filter(p => p.stock > 0);
    }
    renderMenuPortal(menuCached);
}
window.filtrarMenuPortal = function() {
    const q = document.getElementById('search-menu-portal').value.toLowerCase().trim();
    renderMenuPortal(menuCached.filter(p => p.name.toLowerCase().includes(q) || (p.categoria && p.categoria.toLowerCase().includes(q))));
}
function renderMenuPortal(productos) {
    const grid = document.getElementById('grid-menu-portal');
    if (!productos || productos.length === 0) return grid.innerHTML = '<div class="col-span-2 text-center text-slate-500 py-10">No hay productos.</div>';

    grid.innerHTML = productos.map(p => {
        const imgPath = p.image_url || `https://placehold.co/400x400/0f172a/6366f1?text=${encodeURIComponent(p.name)}`;
        const precioEfectivo = parseFloat(p.price) * 0.90; 
        return `
        <div class="bg-slate-900 border border-slate-800 rounded-[1.5rem] p-3 flex flex-col items-center shadow-lg relative">
            <div class="absolute top-2 right-2 bg-emerald-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md z-10"><i class="fa-solid fa-bolt"></i> -10%</div>
            <div class="w-full h-32 rounded-xl overflow-hidden mb-3 bg-slate-950 flex-shrink-0 border border-slate-800/50">
                <img src="${imgPath}" onerror="this.onerror=null; this.src='https://placehold.co/400x400/0f172a/6366f1?text=Sin+Foto'" class="w-full h-full object-cover">
            </div>
            <h3 class="text-[10px] font-bold text-slate-200 line-clamp-2 h-7 text-center mb-3 w-full px-1">${p.name}</h3>
            <div class="w-full mt-auto space-y-2">
                <div class="bg-slate-950 rounded-lg p-1.5 text-center border border-slate-800">
                    <p class="text-[8px] text-slate-500 font-bold uppercase mb-0.5">Regular</p>
                    <span class="text-[11px] font-black text-indigo-400 line-through">$${parseFloat(p.price).toFixed(2)}</span>
                </div>
                <div class="bg-emerald-500/10 rounded-lg p-2 text-center border border-emerald-500/30">
                    <p class="text-[8px] text-emerald-500 font-black uppercase mb-0.5">Efectivo</p>
                    <span class="text-sm font-black text-emerald-400">$${precioEfectivo.toFixed(2)}</span>
                </div>
            </div>
        </div>`;
    }).join('');
}