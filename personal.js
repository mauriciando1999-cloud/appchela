// personal.js - Portal del Personal | Chela Sport
const SB_URL = 'https://ekvzmfsdshyoeggudksm.supabase.co';
const SB_KEY = 'sb_publishable_Go6ZDuD9pg1pC3k-s89jiQ_65TEYGnd';
const _sb = supabase.createClient(SB_URL, SB_KEY);

let localUser = null;

// --- 1. INICIALIZACIÓN ---
window.onload = () => {
    const savedPhone = localStorage.getItem('staffPhone');
    if (savedPhone) {
        reautenticarSesion(savedPhone);
    }
};

function nextStep(stepId) {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    const target = document.getElementById('step-' + stepId);
    if (target) target.classList.add('active');
    window.scrollTo(0, 0);
}

function toggleAudio() {
    const audio = document.getElementById('audio-instrucciones');
    const btn = document.getElementById('btn-audio');
    if (!audio || !btn) return;

    if (audio.paused) {
        audio.play().catch(e => console.log("Audio en espera de interacción."));
        btn.innerHTML = '<i class="fa-solid fa-pause text-white text-xl"></i>';
    } else {
        audio.pause();
        btn.innerHTML = '<i class="fa-solid fa-play text-white text-xl ml-1"></i>';
    }
}

// --- 2. AUTENTICACIÓN ---
async function procesarRegistro() {
    const nombre = document.getElementById('reg-nombre').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const rol = document.getElementById('reg-rol').value;
    const pin = document.getElementById('reg-pin').value.trim();

    if (!nombre || !phone || !pin) return alert("⚠️ Por favor completa todos los campos.");
    if (!/^\d{4}$/.test(pin)) return alert("⚠️ El PIN debe contener exactamente 4 dígitos.");

    const btn = document.getElementById('btn-save');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Procesando...';

    try {
        const { error } = await _sb.rpc('registrar_personal_seguro', {
            p_name: nombre,
            p_phone: phone,
            p_rol: rol,
            p_pin: pin
        });
        if (error) throw error;
        alert("✨ Registro exitoso. Ahora puedes iniciar sesión.");
        nextStep('login');
    } catch (err) {
        alert("Error de registro: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Finalizar Registro <i class="fa-solid fa-check ml-2"></i>';
    }
}

async function acceder() {
    const phone = document.getElementById('login-phone').value.trim();
    const pin = document.getElementById('login-pin').value.trim();
    const btn = document.getElementById('btn-login');

    if (!phone || !pin) return alert("⚠️ Ingresa tus credenciales.");
    if (!/^\d{4}$/.test(pin)) return alert("PIN inválido.");

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Validando...';

    const { data, error } = await _sb.rpc('verificar_personal_login', { p_phone: phone, p_pin: pin });

    btn.disabled = false;
    btn.innerHTML = 'Entrar al Dashboard <i class="fa-solid fa-arrow-right ml-2"></i>';

    if (error) return alert("Error de conexión al servidor.");

    if (data && data.length > 0) {
        localStorage.setItem('staffPhone', phone);
        reautenticarSesion(phone);
    } else {
        alert("❌ El teléfono o PIN ingresados son incorrectos.");
    }
}

async function reautenticarSesion(phone) {
    const { data } = await _sb.from('personal').select('*').eq('phone', phone).single();
    if (data) {
        localUser = data;
        iniciarDashboard();
    } else {
        cerrarSesion();
    }
}

function cerrarSesion() {
    localStorage.removeItem('staffPhone');
    location.reload();
}

// --- 3. DASHBOARD Y UI ---
function iniciarDashboard() {
    nextStep('dashboard');
    renderizarUI();
    cargarHistorial();
    cargarCartelera();
    activarTiempoReal();
}

function renderizarUI() {
    if (!localUser) return;

    document.getElementById('dashboard-bienvenida').innerText = `Hola, ${localUser.name.split(' ')[0]}`;
    document.getElementById('dashboard-rol').innerText = localUser.rol || 'Personal';

    const panelAdmin = document.getElementById('panel-admin');
    if (panelAdmin) {
        const esAdmin = ['Administrativo', 'Admin', 'Director'].includes(localUser.rol);
        panelAdmin.classList.toggle('hidden', !esAdmin);
    }

    const deudaActual = parseFloat(localUser.debt || 0);
    document.getElementById('txt-deuda').innerText = `$${deudaActual.toFixed(2)}`;

    const limiteActual = parseFloat(localUser.limite_credito || localUser.limite_consumo || 100);
    const disponible = Math.max(0, limiteActual - deudaActual);

    document.getElementById('txt-disponible').innerText = `Disponible: $${disponible.toFixed(2)}`;

    const inputLimite = document.getElementById('input-limite');
    if (inputLimite && !inputLimite.value) {
        inputLimite.placeholder = `Actual: $${limiteActual.toFixed(2)}`;
    }

    const btnPagar = document.getElementById('btn-pagar');
    const txtDeuda = document.getElementById('txt-deuda');
    if (deudaActual > 0) {
        btnPagar.classList.remove('hidden');
        txtDeuda.classList.add('text-red-400');
    } else {
        btnPagar.classList.add('hidden');
        txtDeuda.classList.remove('text-red-400');
    }
}

function procesarPago() {
    if (!localUser) return;
    const deuda = parseFloat(localUser.debt || 0);
    if (deuda <= 0) return;

    // Se añade "&tipo=personal" al final de la URL
    window.location.href = `pago.html?id=${localUser.id}&name=${encodeURIComponent(localUser.name)}&debt=${deuda.toFixed(2)}&phone=${localUser.phone}&tipo=personal`;
}

async function ajustarLimite() {
    if (!localUser) return;

    const input = document.getElementById('input-limite');
    const limiteActual = parseFloat(localUser.limite_credito || localUser.limite_consumo || 100);
    const nuevoLimite = input.value.trim() !== '' ? parseFloat(input.value) : limiteActual;

    if (isNaN(nuevoLimite) || nuevoLimite < 0) return alert("Monto inválido.");

    const btn = document.getElementById('btn-limite');
    btn.disabled = true;

    const { error } = await _sb
        .from('personal')
        .update({ limite_credito: nuevoLimite })
        .eq('id', localUser.id);

    btn.disabled = false;

    if (error) return alert("Error al guardar límite.");
    localUser.limite_credito = nuevoLimite;
    input.value = '';
    renderizarUI();
}

async function enviarAnuncio() {
    const titulo = document.getElementById('notif-titulo').value.trim();
    const contenido = document.getElementById('notif-contenido').value.trim();

    if (!titulo || !contenido) return alert("⚠️ Completa título y mensaje.");

    const btn = document.getElementById('btn-aviso');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Publicando...';

    const { error } = await _sb.from('notificaciones').insert([{ titulo, contenido }]);

    btn.disabled = false;
    btn.innerHTML = 'Publicar Aviso';

    if (error) return alert("Error al publicar: " + error.message);

    document.getElementById('notif-titulo').value = '';
    document.getElementById('notif-contenido').value = '';
    cargarCartelera();
    alert("✅ Aviso publicado correctamente.");
}

// --- 4. HISTORIAL DE CONSUMOS ---
async function cargarHistorial() {
    const container = document.getElementById('contenedor-historial');
    if (!localUser || !localUser.id || !container) return;

    container.innerHTML = `
        <div class="flex flex-col items-center justify-center py-6">
            <i class="fa-solid fa-circle-notch fa-spin text-2xl text-indigo-500 mb-2"></i>
            <p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sincronizando...</p>
        </div>`;

    try {
        const { data, error } = await _sb
            .from('ventas')
            .select('created_at, total_usd, items, status, metodo_pago')
            .eq('personal_id', localUser.id)
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="p-4 border border-slate-800 rounded-2xl bg-slate-900/40 text-xs text-center text-slate-400">
                    No hay consumos recientes.
                </div>`;
            return;
        }

        container.innerHTML = data.map(venta => {
            const monto = parseFloat(venta.total_usd || 0).toFixed(2);
            const fecha = new Date(venta.created_at).toLocaleDateString('es-VE', {
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
            });

            return `
                <div class="p-4 bg-slate-900 border border-slate-800/80 rounded-2xl flex justify-between items-center shadow-sm">
                    <div>
                        <p class="font-bold text-xs text-slate-200">Consumo de Empleado</p>
                        <p class="text-[10px] text-slate-500 mt-0.5">${fecha}</p>
                    </div>
                    <div class="text-right">
                        <p class="font-black text-white">-$${monto}</p>
                    </div>
                </div>`;
        }).join('') + `
            <button onclick="verHistorialPersonal()" class="w-full mt-2 bg-indigo-900/40 border border-indigo-500/50 hover:bg-indigo-600 text-indigo-400 hover:text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all flex justify-center items-center gap-2">
                <i class="fa-solid fa-clock-rotate-left"></i> Ver Compras Recientes
            </button>`;

    } catch (e) {
        console.error(e);
        container.innerHTML = `<div class="text-red-400 text-xs text-center">Error al cargar historial.</div>`;
    }
}

async function verHistorialPersonal() {
    const modal = document.getElementById('modal-historial-personal');
    const contenedor = document.getElementById('lista-historial-personal');

    if (!modal || !contenedor || !localUser) return console.error("Faltan los IDs del modal de historial en el HTML");

    modal.classList.remove('hidden');
    document.getElementById('historial-nombre-personal').innerText = localUser.name;

    contenedor.innerHTML = `
        <div class="flex flex-col items-center justify-center mt-20">
            <i class="fa-solid fa-circle-notch fa-spin text-3xl text-indigo-500 mb-3"></i>
            <p class="text-xs font-bold text-slate-400 uppercase tracking-widest">Buscando tickets...</p>
        </div>`;

    try {
        const { data, error } = await _sb
            .from('ventas')
            .select('created_at, total_usd, items, status, metodo_pago')
            .eq('personal_id', localUser.id)
            .order('created_at', { ascending: false })
            .limit(15);

        if (error) throw error;

        if (!data || data.length === 0) {
            contenedor.innerHTML = `
                <div class="text-center mt-20">
                    <i class="fa-solid fa-box-open text-4xl text-slate-700 mb-3"></i>
                    <p class="text-xs font-bold text-slate-500 uppercase tracking-widest">No hay compras registradas</p>
                </div>`;
            return;
        }

        contenedor.innerHTML = data.map(venta => {
            const fecha = new Date(venta.created_at).toLocaleDateString('es-VE', {
                weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
            });

            let detallesItems = "Sin detalles";
            if (venta.items && Array.isArray(venta.items)) {
                detallesItems = venta.items.map(i => `<span class="font-bold text-white">${i.qty}x</span> ${i.name}`).join('<br>');
            }

            const colorStatus = venta.status === 'completado'
                ? 'text-emerald-400 bg-emerald-400/10 border border-emerald-500/20'
                : 'text-amber-400 bg-amber-400/10 border border-amber-500/20';

            const metodo = venta.metodo_pago ? venta.metodo_pago.replace('_', ' ') : 'N/A';

            return `
            <div class="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-sm">
                <div class="flex justify-between items-start mb-3 border-b border-slate-800 pb-3">
                    <div>
                        <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">${fecha}</p>
                        <p class="text-lg font-black text-white leading-none">$${parseFloat(venta.total_usd).toFixed(2)}</p>
                    </div>
                    <span class="px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${colorStatus}">${venta.status}</span>
                </div>
                <div class="text-[11px] text-slate-400 leading-relaxed">
                    ${detallesItems}
                </div>
                <div class="mt-3 pt-2 text-[9px] text-slate-500 font-bold uppercase tracking-widest text-right">
                    Pagado vía: ${metodo}
                </div>
            </div>`;
        }).join('');

    } catch (e) {
        console.error(e);
        contenedor.innerHTML = `
            <div class="bg-red-500/10 border border-red-500/30 p-4 rounded-xl text-center mt-4">
                <p class="text-xs text-red-400 font-bold">Error al cargar historial: ${e.message}</p>
            </div>`;
    }
}

// --- 5. CARTELERA ---
async function cargarCartelera() {
    const container = document.getElementById('contenedor-anuncios');
    if (!container) return;

    const { data } = await _sb.from('notificaciones').select('*').order('created_at', { ascending: false }).limit(5);

    if (!data || data.length === 0) {
        container.innerHTML = `
            <div class="p-4 border border-slate-800 rounded-2xl bg-slate-900/40 text-xs text-center text-slate-500">
                No hay avisos publicados.
            </div>`;
        return;
    }

    container.innerHTML = data.map(a => `
        <div class="p-4 bg-slate-900/80 border border-slate-800/80 rounded-2xl flex flex-col gap-1 shadow-inner">
            <span class="font-bold text-xs text-indigo-400">${a.titulo}</span>
            <p class="text-xs text-slate-300 font-medium">${a.contenido}</p>
        </div>`).join('');
}

// --- 6. TIEMPO REAL ---
function activarTiempoReal() {
    _sb.removeAllChannels();
    _sb.channel('realtime-personal')
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'personal',
            filter: `id=eq.${localUser.id}`
        }, (payload) => {
            localUser = payload.new;
            renderizarUI();
            cargarHistorial();
        })
        .subscribe();
}
