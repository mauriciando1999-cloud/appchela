// personal.js - Portal del Personal (Versión Final)
const SB_URL = 'https://ekvzmfsdshyoeggudksm.supabase.co';
const SB_KEY = 'sb_publishable_Go6ZDuD9pg1pC3k-s89jiQ_65TEYGnd';
const _sb = supabase.createClient(SB_URL, SB_KEY);

let localUser = null; 

// --- INICIALIZACIÓN ---
window.onload = () => {
    const savedPhone = localStorage.getItem('staffPhone');
    if (savedPhone) {
        reautenticarSesion(savedPhone);
    }
};

function nextStep(stepId) {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    const target = document.getElementById('step-' + stepId);
    if(target) target.classList.add('active');
    window.scrollTo(0, 0);
}

// --- AUTENTICACIÓN ---
async function procesarRegistro() {
    const nombre = document.getElementById('reg-nombre').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const rol = document.getElementById('reg-rol').value;
    const pin = document.getElementById('reg-pin').value.trim();

    if(!nombre || !phone || !pin) return alert("⚠️ Por favor completa todos los campos.");
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

    if (!/^\d{4}$/.test(pin)) return alert("PIN inválido.");

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

// --- DASHBOARD & UI ---
function iniciarDashboard() {
    nextStep('dashboard');
    renderizarUI();
    cargarHistorial();
    cargarCartelera();
    activarTiempoReal();
}

function renderizarUI() {
    if(!localUser) return;
    
    document.getElementById('welcome').innerText = `Hola, ${localUser.name.split(' ')[0]}`;
    document.getElementById('dashboard-rol').innerText = localUser.rol || 'Personal';
    
    const deudaActual = parseFloat(localUser.debt || 0); 
    document.getElementById('txt-deuda').innerText = `$${deudaActual.toFixed(2)}`;
    
    const limiteActual = parseFloat(localUser.limite_credito || localUser.limite_consumo || 100);
    const disponible = Math.max(0, limiteActual - deudaActual);
    
    document.getElementById('txt-disponible').innerText = `Disponible: $${disponible.toFixed(2)}`;
    
    const btnPagar = document.getElementById('btn-pagar');
    if(deudaActual > 0) {
        btnPagar.classList.remove('hidden');
        document.getElementById('txt-deuda').classList.add('text-red-400');
    } else {
        btnPagar.classList.add('hidden');
        document.getElementById('txt-deuda').classList.remove('text-red-400');
    }
}

// --- HISTORIAL DE CONSUMOS (FINANZAS) ---
async function cargarHistorial() {
    const container = document.getElementById('contenedor-historial');
    if(!localUser || !localUser.id) return;
    
    container.innerHTML = '<div class="text-center py-4"><i class="fa-solid fa-spinner fa-spin text-indigo-500"></i></div>';
    
    try {
        const { data, error } = await _sb.from('ventas')
            .select('*')
            .eq('personal_id', localUser.id) // Vinculado a la ID del empleado
            .order('created_at', { ascending: false })
            .limit(10); 

        if (error) throw error;
        if (!data || data.length === 0) {
            container.innerHTML = `<div class="p-4 border border-slate-800 rounded-2xl bg-slate-900/40 text-xs text-center text-slate-400">No hay consumos recientes.</div>`;
            return;
        }

        container.innerHTML = data.map(venta => {
            const monto = parseFloat(venta.total_usd || 0).toFixed(2);
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
    } catch(e) {
        container.innerHTML = `<div class="text-red-400 text-xs text-center">Error al cargar historial.</div>`;
    }
}

// --- CARTELERA ---
async function cargarCartelera() {
    const container = document.getElementById('contenedor-anuncios');
    const { data } = await _sb.from('notificaciones').select('*').order('created_at', { ascending: false }).limit(5);
    if (!data || data.length === 0) return;
    container.innerHTML = data.map(a => `
        <div class="p-4 bg-slate-900/80 border border-slate-800/80 rounded-2xl flex flex-col gap-1 shadow-inner">
            <span class="font-bold text-xs text-indigo-400">${a.titulo}</span>
            <p class="text-xs text-slate-300 font-medium">${a.contenido}</p>
        </div>`).join('');
}

// --- REALTIME ---
function activarTiempoReal() {
    _sb.removeAllChannels();
    _sb.channel('realtime-personal')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'personal', filter: `id=eq.${localUser.id}` }, (payload) => {
            localUser = payload.new;
            renderizarUI();
            cargarHistorial(); 
        })
        .subscribe();
}