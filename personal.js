// ==========================================
// CONFIGURACIÓN DE SUPABASE
// ==========================================
const SB_URL = 'https://ekvzmfsdshyoeggudksm.supabase.co';
const SB_KEY = 'sb_publishable_Go6ZDuD9pg1pC3k-s89jiQ_65TEYGnd';
const _sb = supabase.createClient(SB_URL, SB_KEY);

let localUser = null; 

// ==========================================
// INICIALIZACIÓN
// ==========================================
window.onload = () => {
    const savedPhone = localStorage.getItem('staffPhone');
    if (savedPhone) {
        // Al cargar, siempre busca los datos más frescos de la BD
        reautenticarSesion(savedPhone);
    }
};

function nextStep(stepId) {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    const target = document.getElementById('step-' + stepId);
    if(target) target.classList.add('active');
    window.scrollTo(0, 0);
}

// ==========================================
// AUTENTICACIÓN Y REGISTRO
// ==========================================
async function procesarRegistro() {
    const nombre = document.getElementById('reg-nombre').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const rol = document.getElementById('reg-rol').value;
    const pin = document.getElementById('reg-pin').value.trim();

    if(!nombre || !phone || !pin) return alert("⚠️ Por favor completa todos los campos.");
  if (!/^\d{4}$/.test(pin)) {
    return alert(
        "⚠️ El PIN debe contener exactamente 4 dígitos."
    );
}

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

  if (!/^\d{4}$/.test(pin)) {
    return alert("PIN inválido.");
}

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Validando...';

    const { data, error } = await _sb.rpc('verificar_personal_login', { p_phone: phone, p_pin: pin });
    
    btn.disabled = false;
    btn.innerHTML = 'Entrar al Dashboard <i class="fa-solid fa-arrow-right ml-2"></i>';

    if(error) return alert("Error de conexión al servidor.");

    if(data && data.length > 0) {
        localStorage.setItem('staffPhone', phone);
        reautenticarSesion(phone);
    } else {
        alert("❌ El teléfono o PIN ingresados son incorrectos.");
    }
}

async function reautenticarSesion(phone) {
    // Forzamos la obtención de los datos más recientes directo de la tabla
    const { data, error } = await _sb.from('personal').select('*').eq('phone', phone).single();
    
    if(data) {
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

// ==========================================
// DASHBOARD & UI
// ==========================================
function iniciarDashboard() {
    nextStep('dashboard');
    renderizarUI();
    cargarHistorial();
    cargarCartelera();
    activarTiempoReal();
}

// En renderizarUI:
function renderizarUI() {
    if(!localUser) return;
    
    document.getElementById('welcome').innerText = `Hola, ${localUser.name.split(' ')[0]}`;
    document.getElementById('dashboard-rol').innerText = localUser.rol;
    
    // FORZAMOS LA LECTURA DE 'debt' PORQUE ES DONDE TIENES EL 0.55
    const deudaActual = parseFloat(localUser.debt || 0); 
    
    document.getElementById('txt-deuda').innerText = `$${deudaActual.toFixed(2)}`;
    const limiteActual = parseFloat(localUser.limite_credito || 100);

document.getElementById('input-limite').placeholder =
    `Límite actual: $${limiteActual}`;

const disponible = Math.max(
    0,
    limiteActual - deudaActual
);

const txtDisponible =
    document.getElementById('txt-disponible');

if (txtDisponible) {
    txtDisponible.innerText =
        `Disponible: $${disponible.toFixed(2)}`;
}
    
    const btnPagar = document.getElementById('btn-pagar');
    if(deudaActual > 0) {
        btnPagar.classList.remove('hidden');
        document.getElementById('txt-deuda').classList.add('text-red-400');
    } else {
        btnPagar.classList.add('hidden');
        document.getElementById('txt-deuda').classList.remove('text-red-400');
    }
    
    if(localUser.rol === 'Administrativo') {
        document.getElementById('panel-admin').classList.remove('hidden');
    }
}

// ==========================================
// FINANZAS: LÍMITE Y PAGOS
// ==========================================
function procesarPago() {
    const deudaActual = parseFloat(localUser.debt !== undefined ? localUser.debt : (localUser.saldo || 0));
    if(deudaActual <= 0) return alert("No tienes deuda pendiente por pagar.");
    
    // Al volver de pago.html, window.onload forzará reautenticarSesion y actualizará la UI.
    window.location.href = `pago.html?tipo=personal&id=${localUser.id}&name=${encodeURIComponent(localUser.name)}&monto=${deudaActual.toFixed(2)}&phone=${localUser.phone}`;
}

async function ajustarLimite() {
    const nuevoLimite = parseFloat(document.getElementById('input-limite').value);
    if(isNaN(nuevoLimite) || nuevoLimite < 0) return alert("⚠️ Coloca un monto numérico válido.");

    const btn = document.getElementById('btn-limite');
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    const { error } = await _sb.rpc('actualizar_mi_limite', {
        p_phone: localUser.phone,
        p_nuevo_limite: nuevoLimite
    });

    btn.disabled = false; btn.innerText = 'Fijar';

    if(error) {
        alert("Error actualizando límite: " + error.message);
    } else {
        alert("🎯 Límite de consumo actualizado con éxito.");
        document.getElementById('input-limite').value = '';
        reautenticarSesion(localUser.phone); // Refresca todo
    }
}

// ==========================================
// HISTORIAL DE CONSUMOS
// ==========================================
async function cargarHistorial() {
    const container = document.getElementById('contenedor-historial');
    const deudaActual = parseFloat(localUser.debt !== undefined ? localUser.debt : (localUser.saldo || 0));
    
    if (deudaActual <= 0) {
        container.innerHTML = `
            <div class="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center shadow-sm">
                <p class="text-emerald-400 text-[11px] font-black uppercase tracking-widest"><i class="fa-solid fa-check-circle mr-1"></i> Sin deuda</p>
                <p class="text-emerald-500/70 text-[9px] mt-1 font-bold">No tienes consumos pendientes de pago.</p>
            </div>`;
        return;
    }

    container.innerHTML = '<div class="text-center py-4"><i class="fa-solid fa-spinner fa-spin text-indigo-500"></i></div>';
    
    const { data, error } = await _sb.from('ventas')
        .select('*')
        .eq('personal_id', localUser.id)
        .order('created_at', { ascending: false })
        .limit(10); 

    if (error || !data || data.length === 0) {
        container.innerHTML = `<div class="p-4 border border-slate-800 rounded-2xl bg-slate-900/40 text-xs text-center text-slate-400">No hay consumos recientes.</div>`;
        return;
    }

    container.innerHTML = data.map(venta => {
        const monto = parseFloat(venta.total_usd || venta.total || 0).toFixed(2);
        const fecha = new Date(venta.created_at).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', hour: '2-digit', minute:'2-digit' });
        return `
            <div class="p-4 bg-slate-900 border border-slate-800/80 rounded-2xl flex justify-between items-center shadow-sm mb-2">
                <div>
                    <p class="font-bold text-xs text-slate-200">Consumo de Empleado</p>
                    <p class="text-[10px] text-slate-500 mt-0.5">${fecha}</p>
                </div>
                <div class="text-right">
                    <p class="font-black text-white">-$${monto}</p>
                </div>
            </div>
        `;
    }).join('');
}

// ==========================================
// CARTELERA Y NOTIFICACIONES
// ==========================================
async function enviarAnuncio() {
    const titulo = document.getElementById('notif-titulo').value.trim();
    const contenido = document.getElementById('notif-contenido').value.trim();
    if(!titulo || !contenido) return alert("⚠️ Completa el título y el mensaje del aviso.");

    const btn = document.getElementById('btn-aviso');
    btn.disabled = true; btn.innerText = 'Publicando...';

    const { error } = await _sb.from('notificaciones').insert([{ titulo, contenido, tipo: 'Normal' }]);
    
    btn.disabled = false; btn.innerText = 'Publicar Aviso';

    if(error) alert("Error: " + error.message);
    else {
        alert("📢 Aviso publicado exitosamente.");
        document.getElementById('notif-titulo').value = '';
        document.getElementById('notif-contenido').value = '';
        cargarCartelera(); 
    }
}

async function cargarCartelera() {
    const container = document.getElementById('contenedor-anuncios');
    const { data, error } = await _sb.from('notificaciones').select('*').order('created_at', { ascending: false });

    if(error || !data || data.length === 0) {
        container.innerHTML = `<div class="text-center py-4 text-slate-500 text-xs font-medium">No hay avisos recientes.</div>`;
        return;
    }

    container.innerHTML = data.map(anuncio => {
        const fecha = new Date(anuncio.created_at).toLocaleDateString('es-VE');
        return `
            <div class="p-4 bg-slate-900/80 border border-slate-800/80 rounded-2xl flex flex-col gap-1 shadow-inner">
                <div class="flex justify-between items-center mb-1">
                    <span class="font-bold text-xs text-indigo-400 flex items-center gap-2"><i class="fa-solid fa-bell"></i> ${anuncio.titulo}</span>
                    <span class="text-[9px] font-bold text-slate-500">${fecha}</span>
                </div>
                <p class="text-xs text-slate-300 font-medium leading-relaxed">${anuncio.contenido}</p>
            </div>
        `;
    }).join('');
}

// ==========================================
// REALTIME SUPABASE
// ==========================================
function activarTiempoReal() {
    _sb.removeAllChannels();
    _sb.channel('cambios-personal')
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'personal',
            filter: `phone=eq.${localUser.phone}` 
        }, (payload) => {
            localUser = payload.new;
            renderizarUI();
            cargarHistorial(); 
        })
        .subscribe();
}