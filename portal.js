// portal.js - Portal de Representantes | Chela Sport
const SB_URL = 'https://ekvzmfsdshyoeggudksm.supabase.co';
const SB_KEY = 'sb_publishable_Go6ZDuD9pg1pC3k-s89jiQ_65TEYGnd';
const _sb = supabase.createClient(SB_URL, SB_KEY);

// Estado global de la aplicación
window.state = { 
    estudiantes: [],
    userId: null
};

// --- 1. INICIALIZACIÓN Y SEGURIDAD ---
window.onload = async () => {
    try {
        const { data: { user }, error } = await _sb.auth.getUser();
        
        // Si no hay sesión iniciada, lo devolvemos al login principal
        if (error || !user) {
            return window.location.href = 'index.html';
        }
        
        window.state.userId = user.id;
        await window.sync(user.id);
    } catch (e) {
        console.error("Error iniciando portal:", e);
    }
};

window.handleLogout = async function() {
    await _sb.auth.signOut();
    window.location.href = 'index.html';
};

// --- 2. SINCRONIZACIÓN DE DATOS ---
window.sync = async function(userId) {
    try {
        // Consultamos solo los estudiantes que le pertenecen a este representante
        const { data, error } = await _sb
            .from('estudiantes')
            .select('*')
            .eq('representante_id', userId)
            .order('name');
            
        if (error) throw error;
        
        window.state.estudiantes = data || [];
        window.render();
    } catch (e) {
        console.error("Error al sincronizar estudiantes:", e);
        alert("Ocurrió un error al cargar la información. Revisa tu conexión.");
    }
};

// --- 3. RENDERIZADO DEL PANEL PRINCIPAL ---
window.render = function() {
    const grid = document.getElementById('grid-estudiantes');
    if (!grid) return console.warn("Falta el contenedor 'grid-estudiantes' en el HTML del portal.");

    if (window.state.estudiantes.length === 0) {
        grid.innerHTML = `
            <div class="text-center p-6 bg-slate-900 rounded-2xl border border-slate-800 text-slate-400 font-bold text-sm">
                No tienes estudiantes vinculados a esta cuenta. Por favor, contacta a la administración.
            </div>`;
        return;
    }

    // Variable para ir sumando la deuda total familiar
    let deudaTotalFamiliar = 0;

    grid.innerHTML = window.state.estudiantes.map(e => {
        const limite = parseFloat(e.limite_credito || 100);
        const deuda = parseFloat(e.debt || 0);
        const excedido = deuda >= limite;
        
        deudaTotalFamiliar += deuda;
        
        return `
        <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden mb-4">
            <!-- Barra superior indicadora de estado -->
            <div class="absolute top-0 left-0 w-full h-1 ${e.bloqueado ? 'bg-red-500' : 'bg-emerald-500'}"></div>
            
            <div class="flex justify-between items-start mb-4">
                <div>
                    <p class="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Estudiante</p>
                    <h2 class="text-lg font-black text-white uppercase">${e.name}</h2>
                </div>
                <div class="bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-center">
                    <p class="text-[8px] text-slate-500 font-bold uppercase">Deuda</p>
                    <p class="${excedido ? 'text-red-500' : 'text-emerald-400'} font-black text-sm">$${deuda.toFixed(2)}</p>
                </div>
            </div>

            <div class="flex justify-between items-center bg-slate-950 p-3 rounded-xl border border-slate-800 mb-4">
                <div>
                    <p class="text-[9px] text-slate-500 font-bold uppercase">Límite Permitido</p>
                    <p class="text-white font-black text-xs">$${limite.toFixed(2)}</p>
                </div>
                <div class="text-right">
                    <p class="text-[9px] text-slate-500 font-bold uppercase">Estatus</p>
                    <p class="${e.bloqueado ? 'text-red-500' : 'text-emerald-500'} font-black text-xs uppercase tracking-widest">${e.bloqueado ? 'BLOQUEADO' : 'ACTIVO'}</p>
                </div>
            </div>

            <!-- BOTÓN DE HISTORIAL -->
            <button onclick="verHistorialAlumno('${e.name}')" class="w-full bg-indigo-900/40 border border-indigo-500/50 hover:bg-indigo-600 text-indigo-400 hover:text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all flex justify-center items-center gap-2">
                <i class="fa-solid fa-clock-rotate-left"></i> Ver Compras Recientes
            </button>
        </div>
        `;
    }).join('');
    
    // (Opcional) Si en tu diseño pusiste un texto grande con la deuda total de la familia:
    const uiDeudaTotal = document.getElementById('deuda-total-familiar');
    if (uiDeudaTotal) {
        uiDeudaTotal.innerText = `$${deudaTotalFamiliar.toFixed(2)}`;
    }
};

// --- 4. CONSULTA DEL HISTORIAL DE COMPRAS ---
window.verHistorialAlumno = async function(nombreAlumno) {
    const modal = document.getElementById('modal-historial-portal');
    const contenedor = document.getElementById('lista-historial-portal');
    
    if(!modal || !contenedor) return console.error("Faltan los IDs del modal de historial en el HTML");

    // Mostramos la ventana e inyectamos un icono de carga
    modal.classList.remove('hidden');
    document.getElementById('historial-nombre-alumno').innerText = nombreAlumno;
    
    contenedor.innerHTML = `
        <div class="flex flex-col items-center justify-center mt-20">
            <i class="fa-solid fa-circle-notch fa-spin text-3xl text-indigo-500 mb-3"></i>
            <p class="text-xs font-bold text-slate-400 uppercase tracking-widest">Buscando tickets...</p>
        </div>`;

    try {
        // Consultar a Supabase las compras asociadas a ese nombre
        const { data, error } = await _sb
            .from('ventas')
            .select('created_at, total_usd, items, status, metodo_pago')
            .eq('estudiante_nombre', nombreAlumno)
            .order('created_at', { ascending: false })
            .limit(15); // Traemos solo los últimos 15 movimientos

        if (error) throw error;

        // Si no hay compras
        if (!data || data.length === 0) {
            contenedor.innerHTML = `
                <div class="text-center mt-20">
                    <i class="fa-solid fa-box-open text-4xl text-slate-700 mb-3"></i>
                    <p class="text-xs font-bold text-slate-500 uppercase tracking-widest">No hay compras registradas</p>
                </div>`;
            return;
        }

        // Si hay compras, dibujamos las tarjetas
        contenedor.innerHTML = data.map(venta => {
            const fecha = new Date(venta.created_at).toLocaleDateString('es-VE', { 
                weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute:'2-digit' 
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
};