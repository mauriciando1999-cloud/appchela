// app.js - El Cerebro de Envolvia (Arquitectura Multi-Page Mobile First)
const SB_URL = 'https://ekvzmfsdshyoeggudksm.supabase.co';
const SB_KEY = 'sb_publishable_Go6ZDuD9pg1pC3k-s89jiQ_65TEYGnd';
const _sb = supabase.createClient(SB_URL, SB_KEY);
const ADMIN_EMAIL = 'mauriciando1999@gmail.com';

// NUEVO: Agregamos activeBuyer al estado
let state = { 
    products: [], 
    estudiantes: [], 
    personal: [], 
    cart: [], 
    tasa: 45.30, 
    userRole: 'vendedor',
    activeBuyer: null // Aquí guardaremos a quién se le está vendiendo antes de abrir el carrito
};
let categoriaActual = 'Todos';

window.onload = async () => {
    try {
        const { data: { user } } = await _sb.auth.getUser();
        const path = window.location.pathname;

        if(user) {
            state.userRole = (user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) ? 'admin' : 'vendedor';
            document.getElementById('auth-screen')?.classList.add('hidden');
            document.getElementById('app-content')?.classList.remove('hidden');

            if(state.userRole !== 'admin' && path.includes('admin.html')) return window.location.href = 'index.html';

            await getBCV();
            await sync();
            updateCartButtons(); // Inicializa los botones del carrito
        } else {
            document.getElementById('auth-screen')?.classList.remove('hidden');
            document.getElementById('app-content')?.classList.add('hidden');
            if(!path.includes('index.html') && path !== '/' && !path.includes('pago.html')) window.location.href = 'index.html';
        }
    } catch (error) { console.error("Error al cargar la app:", error); }
};

async function handleLogin(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    const { error } = await _sb.auth.signInWithPassword({ email: document.getElementById('login-email').value, password: document.getElementById('login-pass').value });
    if(error) { alert(error.message); btn.innerHTML = originalText; } else window.location.reload();
}
function handleLogout() { _sb.auth.signOut().then(() => window.location.href = 'index.html'); }

async function getBCV() {
    try {
        const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
        const data = await res.json();
        if (data?.promedio) state.tasa = parseFloat(data.promedio);
    } catch (e) { console.warn("Usando tasa manual/fallback."); }
    document.querySelectorAll('#bcv-val').forEach(el => el.innerText = `BCV: ${state.tasa.toFixed(2)}`);
}

async function sync() {
    const [p, e, per] = await Promise.all([
        _sb.from('productos').select('*').order('name'),
        _sb.from('estudiantes').select('*').order('name'),
        _sb.from('personal').select('*').order('name')
    ]);
    state.products = p.data || [];
    state.estudiantes = e.data || [];
    state.personal = per.data || [];
    renderCategories();
    renderProducts();
}

// ==========================================
// NUEVO: SISTEMA DE CLIENTE ACTIVO
// ==========================================
function asignarCliente(id, nombre, tipo, bloqueado = false) {
    // Si es estudiante y está bloqueado, alertamos pero permitimos la asignación para que compre agua
    if (tipo === 'estudiante' && bloqueado) {
        alert(`⚠️ ATENCIÓN: El representante de ${nombre} está bloqueado. Solo podrá retirar AGUA.`);
    }
    
    state.activeBuyer = { id, nombre, tipo, bloqueado };
    
    // Actualizamos la UI visual
    document.getElementById('ui-cliente-nombre').innerText = nombre;
    document.getElementById('ui-cliente-nombre').classList.add('text-indigo-400');
    
    // Cerramos los modales
    document.getElementById('modal-seleccion-credito')?.classList.add('hidden');
    document.getElementById('modal-credito-personal')?.classList.add('hidden');
    
    updateCartButtons();
}

function limpiarCliente() {
    state.activeBuyer = null;
    document.getElementById('ui-cliente-nombre').innerText = "Venta al Público";
    document.getElementById('ui-cliente-nombre').classList.remove('text-indigo-400');
    updateCartButtons();
}

function updateCartButtons() {
    const container = document.getElementById('cart-credit-buttons');
    if(!container) return;

    if (state.activeBuyer) {
        // Si hay un cliente pre-seleccionado, el carrito muestra UN SOLO botón grande de crédito
        const colorClass = state.activeBuyer.tipo === 'estudiante' ? 'bg-indigo-600' : 'bg-emerald-600';
        container.innerHTML = `
            <div class="col-span-2">
                <button onclick="procesarTransaccion('CREDITO', ${state.activeBuyer.id}, '${state.activeBuyer.tipo}')" 
                        class="w-full ${colorClass} py-4 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 shadow-lg flex justify-center items-center gap-2">
                    <i class="fa-solid fa-file-invoice-dollar text-sm"></i> Cargar a cuenta de ${state.activeBuyer.nombre}
                </button>
            </div>
        `;
    } else {
        // Si no hay cliente, el carrito muestra los botones de búsqueda manual tradicionales
        container.innerHTML = `
            <button onclick="abrirModalCreditoVenta()" class="bg-indigo-900/40 border border-indigo-500 text-indigo-400 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-transform flex flex-col items-center justify-center gap-1"><i class="fa-solid fa-graduation-cap"></i> Buscar Estudiante</button>
            <button onclick="abrirModalCreditoPersonal()" class="bg-emerald-900/40 border border-emerald-500 text-emerald-400 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-transform flex flex-col items-center justify-center gap-1"><i class="fa-solid fa-user-tie"></i> Buscar Personal</button>
        `;
    }
}

// ==========================================
// VENTAS Y RENDERIZADO
// ==========================================
function filtrar(categoria) { categoriaActual = categoria; renderProducts(); }
function renderCategories() {
    const filterContainer = document.querySelector('.flex.overflow-x-auto');
    if (!filterContainer) return;
    const categories = ['Todos', ...new Set(state.products.map(p => p.categoria || 'General'))];
    filterContainer.innerHTML = categories.map(cat => `
        <button onclick="filtrar('${cat}')" class="px-5 py-2.5 ${categoriaActual === cat ? 'bg-indigo-600 shadow-indigo-900/30' : 'bg-slate-800 border-slate-700 text-slate-300'} rounded-full text-[10px] font-black tracking-widest active:scale-95 transition-all shrink-0 shadow-lg border">
            ${cat.toUpperCase()}
        </button>
    `).join('');
}

function renderProducts() {
    const grid = document.getElementById('grid-productos');
    if (!grid) return;
    const search = document.getElementById('search')?.value.toLowerCase() || '';
    let prods = state.products.filter(p => p.stock > 0 && (categoriaActual === 'Todos' || p.categoria === categoriaActual) && p.name.toLowerCase().includes(search));

    grid.innerHTML = prods.map(p => {
        const imgPath = p.image_url || `https://placehold.co/600x600/0f172a/6366f1?text=${encodeURIComponent(p.name)}`;
        return `
        <div onclick="addToCart(${p.id})" class="relative bg-slate-900 border border-slate-800 rounded-[2rem] p-3 flex flex-col items-center shadow-lg active:scale-95 transition-transform cursor-pointer">
            <div class="absolute top-3 right-3 z-10 px-2 py-0.5 rounded-full text-[9px] font-black ${p.stock <= 5 ? 'bg-red-500 animate-pulse text-white' : 'bg-slate-800 text-slate-300 border border-slate-700'}">${p.stock}</div>
            <div class="w-full aspect-square rounded-[1.5rem] overflow-hidden mb-2 bg-slate-950 flex items-center justify-center">
                <img src="${imgPath}" style="image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges;" class="w-full h-full object-cover">
            </div>
            <h3 class="text-[10px] font-bold text-slate-200 line-clamp-2 h-7 text-center mb-2 px-1 w-full">${p.name}</h3>
            <div class="w-full bg-indigo-900/30 border border-indigo-500/30 py-2 rounded-[1rem] text-center mt-auto">
                <span class="text-xs font-black text-indigo-400">$${parseFloat(p.price).toFixed(2)}</span>
            </div>
        </div>`;
    }).join('');
}

// ==========================================
// CARRITO
// ==========================================
function addToCart(id) {
    const p = state.products.find(x => x.id === id);
    if(p.stock <= 0) return alert("¡Producto Agotado!");
    const inC = state.cart.find(x => x.id === id);
    if(inC) {
        if(inC.qty >= p.stock) return alert("Stock máximo alcanzado");
        inC.qty++; 
    } else state.cart.push({...p, qty: 1});
    updateUI();
}

function adjustQty(id, delta) {
    const item = state.cart.find(x => x.id === id);
    if(!item) return;
    const product = state.products.find(x => x.id === id);
    item.qty += delta;
    if(item.qty > product.stock) item.qty = product.stock;
    if(item.qty <= 0) state.cart = state.cart.filter(x => x.id !== id);
    updateUI();
}

function updateUI() {
    const total = state.cart.reduce((s, i) => s + (i.price * i.qty), 0);
    const btnFloat = document.getElementById('floating-cart-btn');
    if(!btnFloat) return;

    if(total > 0) { btnFloat.classList.remove('hidden'); document.getElementById('total-resumen').innerText = `$${total.toFixed(2)}`; } 
    else { btnFloat.classList.add('hidden'); cerrarCarrito(); }

    if(document.getElementById('total-usd')) document.getElementById('total-usd').innerText = `$${total.toFixed(2)}`;
    if(document.getElementById('total-vef')) document.getElementById('total-vef').innerText = `Bs. ${(total * state.tasa).toLocaleString('es-VE')}`;
    
    const list = document.getElementById('cart-list');
    if(list) list.innerHTML = state.cart.map(i => `
        <div class="flex items-center justify-between p-4 bg-slate-900 rounded-2xl border border-slate-800">
            <div class="flex-1 pr-2">
                <p class="text-[10px] font-black uppercase text-white leading-tight mb-1">${i.name}</p>
                <p class="text-[10px] text-emerald-400 font-bold">$${(i.price * i.qty).toFixed(2)}</p>
            </div>
            <div class="flex items-center gap-3 bg-slate-950 p-1 rounded-full border border-slate-800">
                <button onclick="adjustQty(${i.id}, -1)" class="w-8 h-8 rounded-full bg-slate-800 text-white font-bold active:bg-slate-700">-</button>
                <span class="font-black text-sm w-4 text-center">${i.qty}</span>
                <button onclick="adjustQty(${i.id}, 1)" class="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold active:bg-indigo-500">+</button>
            </div>
        </div>
    `).join('');
}

function abrirCarrito() { document.getElementById('modal-carrito').classList.remove('hidden'); }
function cerrarCarrito() { document.getElementById('modal-carrito').classList.add('hidden'); }

// ==========================================
// TRANSACCIÓN UNIFICADA Y SEGURA
// ==========================================
async function procesarTransaccion(method, deudorId = null, tipoDeudor = 'estudiante') {
    if (!state.cart || state.cart.length === 0) return alert("El carrito está vacío.");

    let total = state.cart.reduce((s, i) => s + (i.price * i.qty), 0);
    let ganancia = state.cart.reduce((s, i) => s + ((i.price - (i.cost || 0)) * i.qty), 0);
    const idOrden = 'ORD-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    
    let nombreDeudor = null;
    let statusVenta = method.includes('PAGO_MOVIL') ? 'pendiente' : 'completado';

    // VALIDACIÓN PREVIA DE CRÉDITO
    if (method === 'CREDITO' && deudorId) {
        const lista = (tipoDeudor === 'estudiante') ? state.estudiantes : state.personal;
        const deudor = lista.find(e => e.id == deudorId);
        
        if (!deudor) return alert("Error: No se encontró al deudor.");
        nombreDeudor = deudor.name || deudor.nombre;

        if (tipoDeudor === 'estudiante') {
            if (deudor.bloqueado) {
                const soloLlevaAgua = state.cart.every(item => item.name.toLowerCase().includes('agua') || item.categoria?.toLowerCase() === 'agua');
                if (!soloLlevaAgua) return alert(`❌ VENTA BLOQUEADA\n\nEl representante de ${nombreDeudor} está bloqueado. Solo puede retirar AGUA.`);
            }
            const recargo = total * 0.10;
            const deudaActual = parseFloat(deudor.debt || 0);
            const limite = parseFloat(deudor.limite_credito || 100);

            if ((deudaActual + total + recargo) > limite) {
                return alert(`❌ LÍMITE EXCEDIDO\n\nDeuda actual: $${deudaActual}\nEsta compra: $${(total+recargo).toFixed(2)}\nTotal proyectado: $${(deudaActual+total+recargo).toFixed(2)}\n\nEl límite máximo de este alumno es $${limite}.`);
            }
        }

        const recargo = total * 0.10;
        total += recargo;
        ganancia += recargo;
    }

    try {
        const { error: errVenta } = await _sb.from('ventas').insert([{ 
            id_orden: idOrden, 
            total_usd: total, 
            metodo_pago: method, 
            items: state.cart, 
            ganancia_total: ganancia, 
            status: statusVenta,
            estudiante_nombre: (tipoDeudor === 'estudiante') ? nombreDeudor : null,
            personal_id: (tipoDeudor === 'personal') ? deudorId : null
        }]);
        if (errVenta) throw errVenta;

        for(const item of state.cart) {
            const p = state.products.find(x => x.id === item.id);
            if (p) await _sb.from('productos').update({ stock: p.stock - item.qty }).eq('id', item.id);
        }

        if (method === 'CREDITO' && deudorId) {
            const tabla = (tipoDeudor === 'estudiante') ? 'estudiantes' : 'personal';
            const deudor = (tipoDeudor === 'estudiante') ? state.estudiantes.find(e => e.id == deudorId) : state.personal.find(e => e.id == deudorId);
            await _sb.from(tabla).update({ debt: parseFloat(deudor.debt || 0) + total }).eq('id', deudorId);
            alert(`✅ Crédito procesado. Deuda asignada a ${nombreDeudor}`);
        } else { 
            alert("Venta procesada con éxito ✅"); 
        }

        // LIMPIEZA TOTAL POST-VENTA
        state.cart = [];
        limpiarCliente(); // Volvemos la app a "Venta al Público"
        cerrarCarrito();
        updateUI();
        await sync(); 

    } catch (e) { alert("Error al procesar: " + e.message); }
}

// ==========================================
// MODALES Y BÚSQUEDAS (AHORA ASIGNAN EN VEZ DE PAGAR)
// ==========================================
function abrirModalCreditoVenta() {
    document.getElementById('modal-seleccion-credito').classList.remove('hidden');
    filtrarModalEst();
}

function abrirModalCreditoPersonal() {
    document.getElementById('modal-credito-personal').classList.remove('hidden');
    filtrarModalPers();
}

function filtrarModalEst() {
    const q = document.getElementById('search-est')?.value.toLowerCase() || '';
    const list = document.getElementById('lista-est-modal');
    if(!list) return;
    
    // AHORA ESTOS BOTONES LLAMAN A "asignarCliente()" EN VEZ DE "procesarTransaccion()"
    list.innerHTML = state.estudiantes
        .filter(e => e.name?.toLowerCase().includes(q) || e.representante?.toLowerCase().includes(q))
        .map(e => `
        <div onclick="asignarCliente(${e.id}, '${e.name?.replace(/'/g, "\\'") || 'Sin Nombre'}', 'estudiante', ${e.bloqueado || false})" class="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex justify-between items-center active:bg-slate-800 cursor-pointer">
            <div>
                <p class="text-xs font-black uppercase text-white">${e.name || 'Sin Nombre'} ${e.bloqueado ? '<span class="text-red-500">(BLOQUEADO)</span>' : ''}</p>
                <p class="text-[9px] text-slate-400 font-bold">Rep: ${e.representante || 'N/A'} | Deuda: $${parseFloat(e.debt || 0).toFixed(2)}</p>
            </div>
            <div class="bg-indigo-600/20 text-indigo-400 px-3 py-1 rounded-lg text-[9px] font-black tracking-widest border border-indigo-500/30">SELECCIONAR</div>
        </div>
    `).join('');
}

function filtrarModalPers() {
    const q = document.getElementById('search-pers')?.value.toLowerCase() || '';
    const list = document.getElementById('lista-pers-modal');
    if(!list) return;

    list.innerHTML = state.personal
        .filter(p => p.name?.toLowerCase().includes(q))
        .map(p => `
        <div onclick="asignarCliente(${p.id}, '${p.name?.replace(/'/g, "\\'") || 'Sin Nombre'}', 'personal')" class="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex justify-between items-center active:bg-slate-800 cursor-pointer">
            <div>
                <p class="text-xs font-black uppercase text-white">${p.name || 'Sin Nombre'}</p>
                <p class="text-[9px] text-slate-400 font-bold">Deuda: $${parseFloat(p.debt || 0).toFixed(2)}</p>
            </div>
            <div class="bg-emerald-600/20 text-emerald-400 px-3 py-1 rounded-lg text-[9px] font-black tracking-widest border border-emerald-500/30">SELECCIONAR</div>
        </div>
    `).join('');
}