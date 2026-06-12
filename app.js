// app.js - El Cerebro de Envolvia (Arquitectura Multi-Page Mobile First + Micrófono)
const SB_URL = 'https://ekvzmfsdshyoeggudksm.supabase.co';
const SB_KEY = 'sb_publishable_Go6ZDuD9pg1pC3k-s89jiQ_65TEYGnd';
const _sb = supabase.createClient(SB_URL, SB_KEY);
const ADMIN_EMAIL = 'mauriciando1999@gmail.com';

let state = { 
    products: [], 
    estudiantes: [], 
    personal: [], 
    cart: [], 
    tasa: 45.30, 
    userRole: 'vendedor',
    activeBuyer: null
};
let categoriaActual = 'Todos';

// ==========================================
// 1. UTILIDADES Y SEGURIDAD
// ==========================================
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

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
            updateCartButtons();
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
// 2. RECONOCIMIENTO DE VOZ Y BUSCADOR GLOBAL
// ==========================================
window.limpiarBuscador = function(inputId, callback) {
    const input = document.getElementById(inputId);
    if (input) {
        input.value = '';
        input.focus();
        if (typeof callback === 'function') callback();
    }
};

window.iniciarReconocimientoVoz = function(inputId, callback, btnId) {
    const input = document.getElementById(inputId);
    const btn = document.getElementById(btnId);
    
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        return alert("Tu navegador no soporta el reconocimiento de voz. Usa Google Chrome.");
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.lang = 'es-VE';
    recognition.continuous = false;
    recognition.interimResults = false;

    const originalHtml = btn.innerHTML;
    // Efecto visual de grabación
    btn.innerHTML = '<i class="fa-solid fa-microphone-lines fa-fade text-white"></i>';
    btn.classList.add('bg-red-600', 'border-red-500', 'animate-pulse');
    btn.classList.remove('text-indigo-400', 'text-emerald-400'); // Quitar colores por defecto

    recognition.start();

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        input.value = transcript.replace(/[.,]/g, ''); // Limpiar signos
        if (typeof callback === 'function') callback();
    };

    recognition.onend = () => {
        btn.innerHTML = originalHtml;
        btn.classList.remove('bg-red-600', 'border-red-500', 'animate-pulse');
        // Restaurar color base según el tipo de botón
        if(btnId.includes('est') || btnId.includes('main')) btn.classList.add('text-indigo-400');
        if(btnId.includes('pers')) btn.classList.add('text-emerald-400');
    };

    recognition.onerror = (event) => {
        console.error("Error micrófono:", event.error);
        btn.innerHTML = originalHtml;
        btn.classList.remove('bg-red-600', 'border-red-500', 'animate-pulse');
    };
};

window.buscarGlobal = function() {
    const query = document.getElementById('search').value.toLowerCase();
    
    // 1. Renderizar productos que coincidan
    renderProducts(); 
    
    // 2. Renderizar clientes inline (Cero Fricción)
    const containerClientes = document.getElementById('resultados-clientes-global');
    if(!containerClientes) return;

    if (query.length < 2) {
        containerClientes.innerHTML = '';
        containerClientes.classList.add('hidden');
        return;
    }

    const estFilt = state.estudiantes.filter(e => e.name?.toLowerCase().includes(query) || e.representante?.toLowerCase().includes(query)).slice(0, 3);
    const persFilt = state.personal.filter(p => p.name?.toLowerCase().includes(query)).slice(0, 2);

    if (estFilt.length === 0 && persFilt.length === 0) {
        containerClientes.innerHTML = '';
        containerClientes.classList.add('hidden');
        return;
    }

    containerClientes.classList.remove('hidden');
    let html = '';
    
    estFilt.forEach(e => {
        const nombreEscapado = escapeHtml(e.name || 'Sin Nombre');
        const repEscapado = escapeHtml(e.representante || 'N/A');
        const deudaEscapada = escapeHtml(parseFloat(e.debt || 0).toFixed(2));
        const estadoBloqueado = e.bloqueado ? '<span class="text-red-500 text-[9px] font-bold">(BLOQUEADO)</span>' : '';
        const limiteDiario = e.limite_diario > 0 ? `<span class="text-amber-400 ml-1">Límite Diario: $${e.limite_diario}</span>` : '';
        
        html += `
        <div class="bg-indigo-950/40 p-3 rounded-xl border border-indigo-500/30 flex justify-between items-center cursor-pointer hover:bg-indigo-900/40 transition-colors" 
             onclick="asignarCliente(${e.id}, '${nombreEscapado}', 'estudiante', ${e.bloqueado || false}); document.getElementById('search').value=''; buscarGlobal();">
            <div>
                <p class="text-xs font-black uppercase text-indigo-100"><i class="fa-solid fa-graduation-cap text-indigo-400 mr-1"></i> ${nombreEscapado} ${estadoBloqueado}</p>
                <p class="text-[9px] text-indigo-300/70 font-bold">Rep: ${repEscapado} | Deuda: $${deudaEscapada} ${limiteDiario}</p>
            </div>
            <div class="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-[9px] font-black tracking-widest shadow-md">ASIGNAR</div>
        </div>`;
    });

    persFilt.forEach(p => {
        const nombreEscapado = escapeHtml(p.name || 'Sin Nombre');
        const deudaEscapada = escapeHtml(parseFloat(p.debt || 0).toFixed(2));
        
        html += `
        <div class="bg-emerald-950/40 p-3 rounded-xl border border-emerald-500/30 flex justify-between items-center cursor-pointer hover:bg-emerald-900/40 transition-colors" 
             onclick="asignarCliente(${p.id}, '${nombreEscapado}', 'personal', false); document.getElementById('search').value=''; buscarGlobal();">
            <div>
                <p class="text-xs font-black uppercase text-emerald-100"><i class="fa-solid fa-user-tie text-emerald-400 mr-1"></i> ${nombreEscapado}</p>
                <p class="text-[9px] text-emerald-300/70 font-bold">Deuda: $${deudaEscapada}</p>
            </div>
            <div class="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-[9px] font-black tracking-widest shadow-md">ASIGNAR</div>
        </div>`;
    });

    containerClientes.innerHTML = html;
};

// ==========================================
// 3. SISTEMA DE CLIENTE ACTIVO
// ==========================================
window.asignarCliente = function(id, nombre, tipo, bloqueado = false) {
    if (tipo === 'estudiante' && bloqueado) {
        alert(`⚠️ ATENCIÓN: El representante de ${nombre} está bloqueado. Solo podrá retirar AGUA.`);
    }
    
    state.activeBuyer = { id, nombre, tipo, bloqueado };
    
    document.getElementById('ui-cliente-nombre').textContent = nombre;
    document.getElementById('ui-cliente-nombre').classList.add('text-indigo-400');
    
    document.getElementById('active-buyer-banner')?.classList.remove('hidden');
    document.getElementById('active-buyer-name').textContent = nombre;
    document.getElementById('active-buyer-info').textContent = tipo === 'estudiante' ? 'Cuenta de Estudiante' : 'Cuenta de Personal';

    document.getElementById('modal-seleccion-credito')?.classList.add('hidden');
    document.getElementById('modal-credito-personal')?.classList.add('hidden');
    
    updateCartButtons();
}

window.limpiarCliente = function() {
    state.activeBuyer = null;
    document.getElementById('ui-cliente-nombre').textContent = "Venta al Público";
    document.getElementById('ui-cliente-nombre').classList.remove('text-indigo-400');
    document.getElementById('active-buyer-banner')?.classList.add('hidden');
    updateCartButtons();
}

function updateCartButtons() {
    const container = document.getElementById('cart-credit-buttons');
    if(!container) return;

    if (state.activeBuyer) {
        const colorClass = state.activeBuyer.tipo === 'estudiante' ? 'bg-indigo-600' : 'bg-emerald-600';
        const clienteNombreEscapado = escapeHtml(state.activeBuyer.nombre);
        container.innerHTML = `
            <div class="col-span-2">
                <button data-client-id="${state.activeBuyer.id}" data-client-type="${state.activeBuyer.tipo}" onclick="procesarTransaccionDesdeBtn(this)" 
                        class="w-full ${colorClass} py-4 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 shadow-lg flex justify-center items-center gap-2">
                    <i class="fa-solid fa-file-invoice-dollar text-sm"></i> Cargar a cuenta de ${clienteNombreEscapado}
                </button>
            </div>
        `;
    } else {
        container.innerHTML = `
            <button onclick="document.getElementById('modal-seleccion-credito').classList.remove('hidden')" class="bg-indigo-900/40 border border-indigo-500 text-indigo-400 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 shadow-md w-full">
                <i class="fa-solid fa-graduation-cap"></i> Venta Crédito
            </button>
            <button onclick="document.getElementById('modal-credito-personal').classList.remove('hidden')" class="bg-emerald-900/40 border border-emerald-500 text-emerald-400 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 shadow-md w-full">
                <i class="fa-solid fa-briefcase"></i> Personal
            </button>
        `;
    }
}

// ==========================================
// 4. GRID Y CATEGORÍAS
// ==========================================
window.filtrar = function(categoria) { categoriaActual = categoria; renderProducts(); }

function renderCategories() {
    const filterContainer = document.querySelector('.flex.overflow-x-auto');
    if (!filterContainer) return;
    const categories = ['Todos', ...new Set(state.products.map(p => p.categoria || 'General'))];
    filterContainer.innerHTML = categories.map(cat => {
        const catEscapada = escapeHtml(cat);
        return `
        <button onclick="filtrar('${catEscapada}')" class="px-5 py-2.5 ${categoriaActual === cat ? 'bg-indigo-600 shadow-indigo-900/30' : 'bg-slate-800 border border-slate-700 text-slate-300'} rounded-full text-[10px] font-bold whitespace-nowrap active:scale-95 transition-all">
            ${catEscapada.toUpperCase()}
        </button>
    `}).join('');
}

function renderProducts() {
    const grid = document.getElementById('grid-productos');
    if (!grid) return;
    const search = document.getElementById('search')?.value.toLowerCase() || '';
    let prods = state.products.filter(p => p.stock > 0 && (categoriaActual === 'Todos' || p.categoria === categoriaActual) && p.name.toLowerCase().includes(search));

    grid.innerHTML = prods.map(p => {
        const imgPath = p.image_url || `https://placehold.co/600x600/0f172a/6366f1?text=${encodeURIComponent(p.name)}`;
        const nombreProductoEscapado = escapeHtml(p.name);
        return `
        <div onclick="addToCart(${p.id})" class="relative bg-slate-900 border border-slate-800 rounded-[2rem] p-3 flex flex-col items-center shadow-lg active:scale-95 transition-transform cursor-pointer group">
            <div class="absolute top-3 right-3 z-10 px-2 py-0.5 rounded-full text-[9px] font-black ${p.stock <= 5 ? 'bg-red-500 animate-pulse text-white' : 'bg-slate-800 text-slate-300 border border-slate-700'}">
                ${p.stock} uds
            </div>
            <div class="w-full aspect-square rounded-[1.5rem] overflow-hidden mb-2 bg-slate-950 flex items-center justify-center">
                <img src="${imgPath}" style="image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges;" class="w-full h-full object-cover">
            </div>
            <h3 class="text-[10px] font-bold text-slate-200 line-clamp-2 h-7 text-center mb-2 px-1 w-full">${nombreProductoEscapado}</h3>
            <div class="w-full bg-indigo-900/30 border border-indigo-500/30 py-2 rounded-[1rem] text-center mt-auto">
                <span class="text-xs font-black text-indigo-400">$${parseFloat(p.price).toFixed(2)}</span>
            </div>
        </div>`;
    }).join('');
}

// ==========================================
// 5. CARRITO
// ==========================================
window.addToCart = function(id) {
    const p = state.products.find(x => x.id === id);
    if(p.stock <= 0) return alert("¡Producto Agotado!");
    const inC = state.cart.find(x => x.id === id);
    if(inC) {
        if(inC.qty >= p.stock) return alert("Stock máximo alcanzado");
        inC.qty++; 
    } else state.cart.push({...p, qty: 1});
    updateUI();
}

window.adjustQty = function(id, delta) {
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
    if(list) list.innerHTML = state.cart.map(i => {
        const nombreItemEscapado = escapeHtml(i.name);
        return `
        <div class="flex items-center justify-between p-4 bg-slate-900 rounded-2xl border border-slate-800">
            <div class="flex-1 pr-2">
                <p class="text-[10px] font-black uppercase text-white leading-tight mb-1">${nombreItemEscapado}</p>
                <p class="text-[10px] text-emerald-400 font-bold">$${(i.price * i.qty).toFixed(2)}</p>
            </div>
            <div class="flex items-center gap-3 bg-slate-950 p-1 rounded-full border border-slate-800">
                <button onclick="adjustQty(${i.id}, -1)" class="w-8 h-8 rounded-full bg-slate-800 text-white font-bold active:bg-slate-700">-</button>
                <span class="font-black text-sm w-4 text-center">${i.qty}</span>
                <button onclick="adjustQty(${i.id}, 1)" class="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold active:bg-indigo-500">+</button>
            </div>
        </div>
    `}).join('');
}

window.abrirCarrito = function() { document.getElementById('modal-carrito').classList.remove('hidden'); }
window.cerrarCarrito = function() { document.getElementById('modal-carrito').classList.add('hidden'); }

// ==========================================
// 6. TRANSACCIÓN UNIFICADA (LÍMITE DIARIO ACTIVO)
// ==========================================
window.procesarTransaccionDesdeBtn = function(btn) {
    const clientId = parseInt(btn.dataset.clientId);
    const clientType = btn.dataset.clientType;
    
    const botonOriginal = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-sm"></i> Procesando...';
    btn.disabled = true;

    procesarTransaccion('CREDITO', clientId, clientType).finally(() => {
        btn.innerHTML = botonOriginal;
        btn.disabled = false;
    });
}

window.procesarTransaccion = async function(method, deudorId = null, tipoDeudor = 'estudiante') {
    if (!state.cart || state.cart.length === 0) return alert("El carrito está vacío.");

    let total = state.cart.reduce((s, i) => s + (i.price * i.qty), 0);
    let ganancia = state.cart.reduce((s, i) => s + ((i.price - (i.cost || 0)) * i.qty), 0);
    const idOrden = 'ORD-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    
    let nombreDeudor = null;
    let statusVenta = method.includes('PAGO_MOVIL') ? 'pendiente' : 'completado';
    let recargo = 0; 

    // VALIDACIÓN PREVIA DE CRÉDITO Y LÍMITE DIARIO
    if (method === 'CREDITO' && deudorId) {
        const lista = (tipoDeudor === 'estudiante') ? state.estudiantes : state.personal;
        const deudor = lista.find(e => e.id == deudorId);
        
        if (!deudor) return alert("Error: No se encontró al deudor.");
        nombreDeudor = deudor.name || deudor.nombre;

        if (deudor.bloqueado) {
            const soloLlevaAgua = state.cart.every(item => item.name.toLowerCase().includes('agua') || item.categoria?.toLowerCase() === 'agua');
            if (!soloLlevaAgua) return alert(`❌ VENTA BLOQUEADA\n\nEl representante de ${nombreDeudor} está bloqueado. Solo puede retirar AGUA.`);
        }

        if (tipoDeudor === 'estudiante') {
            recargo = total * 0.10;
            const deudaActual = parseFloat(deudor.debt || 0);
            const limiteGlobal = parseFloat(deudor.limite_credito || 100);
            const limiteDiario = parseFloat(deudor.limite_diario || 0);

            // 1. Validar límite global acumulado
            if ((deudaActual + total + recargo) > limiteGlobal) {
                return alert(`❌ LÍMITE DE CRÉDITO EXCEDIDO\n\nDeuda actual: $${deudaActual.toFixed(2)}\nEsta compra: $${(total + recargo).toFixed(2)}\nTotal proyectado: $${(deudaActual + total + recargo).toFixed(2)}\n\nLímite máximo: $${limiteGlobal.toFixed(2)}`);
            }

            // 2. Validar Límite Diario (Solo si el padre lo configuró > 0)
            if (limiteDiario > 0) {
                const hoy = new Date();
                hoy.setHours(0, 0, 0, 0); 
                
                const { data: ventasHoy, error: errVentas } = await _sb.from('ventas')
                    .select('total_usd')
                    .eq('estudiante_nombre', nombreDeudor)
                    .gte('created_at', hoy.toISOString());

                let gastadoHoy = 0;
                if (ventasHoy) {
                    gastadoHoy = ventasHoy.reduce((s, v) => s + parseFloat(v.total_usd || 0), 0);
                }

                if ((gastadoHoy + total + recargo) > limiteDiario) {
                    return alert(`❌ LÍMITE DIARIO EXCEDIDO\n\nSu representante fijó un límite de gasto diario de $${limiteDiario.toFixed(2)}.\n\nYa consumió hoy: $${gastadoHoy.toFixed(2)}\nIntento de compra: $${(total + recargo).toFixed(2)}\n\nDebe retirar productos del carrito.`);
                }
            }

        } else if (tipoDeudor === 'personal') {
            recargo = total * 0.10;
        }

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
            alert(`✅ Crédito procesado. Deuda asignada a ${nombreDeudor}\nMonto: $${total.toFixed(2)}`);
        } else if (method !== 'PAGO_MOVIL') { 
            alert("Venta procesada con éxito ✅"); 
        }

        if(method === 'PAGO_MOVIL') {
            window.ordenPendienteId = idOrden;
            document.getElementById('monto-bs-qr').innerText = `Bs. ${(total * state.tasa).toFixed(2)}`;
            document.getElementById('modal-qr').classList.remove('hidden');
        }

        // LIMPIEZA
        state.cart = [];
        limpiarCliente();
        cerrarCarrito();
        updateUI();
        await sync(); 

    } catch (e) { alert("Error al procesar: " + e.message); }
}

// Lógica del QR (Pago Móvil sin Deudor)
window.abrirModalPagoMovil = function() {
    document.getElementById('modal-carrito').classList.add('hidden');
    procesarTransaccion('PAGO_MOVIL');
}

window.confirmarReferencia = async function() {
    const ref = document.getElementById('ref-pago').value;
    if (ref.length !== 4) return alert("Ingresa los 4 dígitos de la referencia.");

    try {
        await _sb.from('ventas').update({ referencia: ref, status: 'esperando_verificacion' }).eq('id_orden', window.ordenPendienteId);
        alert("Referencia enviada. Esperando verificación.");
        document.getElementById('modal-qr').classList.add('hidden');
        document.getElementById('ref-pago').value = '';
        window.ordenPendienteId = null;
    } catch (e) { alert("Error: " + e.message); }
}

// ==========================================
// 7. MODALES SECUNDARIOS Y FILTROS 
// ==========================================
window.filtrarModalEst = function() {
    const q = document.getElementById('search-est')?.value.toLowerCase() || '';
    const list = document.getElementById('lista-est-modal');
    if(!list) return;
    
    list.innerHTML = state.estudiantes
        .filter(e => e.name?.toLowerCase().includes(q) || e.representante?.toLowerCase().includes(q))
        .map(e => {
            const nombreEscapado = escapeHtml(e.name || 'Sin Nombre');
            const repEscapado = escapeHtml(e.representante || 'N/A');
            const deudaEscapada = escapeHtml(parseFloat(e.debt || 0).toFixed(2));
            const estadoBloqueado = e.bloqueado ? '<span class="text-red-500 text-[9px] font-bold">(BLOQUEADO)</span>' : '';
            const alertaDiario = e.limite_diario > 0 ? `<span class="text-amber-400 text-[9px] font-bold ml-1">Lím: $${e.limite_diario}</span>` : '';
            
            return `
            <div class="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex justify-between items-center cursor-pointer hover:border-indigo-500 transition-colors" 
                 data-est-id="${e.id}" data-est-name="${nombreEscapado}" data-est-blocked="${e.bloqueado || false}"
                 onclick="asignarClienteDesdeModal(this, 'estudiante')">
                <div>
                    <p class="text-xs font-black uppercase text-white">${nombreEscapado} ${estadoBloqueado}</p>
                    <p class="text-[9px] text-slate-400 font-bold">Rep: ${repEscapado} | Deuda: $${deudaEscapada} ${alertaDiario}</p>
                </div>
                <div class="bg-indigo-600/20 text-indigo-400 px-3 py-1 rounded-lg text-[9px] font-black tracking-widest border border-indigo-500/30">SELECCIONAR</div>
            </div>`;
        }).join('');
}

window.filtrarModalPers = function() {
    const q = document.getElementById('search-pers')?.value.toLowerCase() || '';
    const list = document.getElementById('lista-pers-modal');
    if(!list) return;

    list.innerHTML = state.personal
        .filter(p => p.name?.toLowerCase().includes(q))
        .map(p => {
            const nombreEscapado = escapeHtml(p.name || 'Sin Nombre');
            const deudaEscapada = escapeHtml(parseFloat(p.debt || 0).toFixed(2));
            
            return `
            <div class="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex justify-between items-center cursor-pointer hover:border-emerald-500 transition-colors"
                 data-pers-id="${p.id}" data-pers-name="${nombreEscapado}"
                 onclick="asignarClienteDesdeModal(this, 'personal')">
                <div>
                    <p class="text-xs font-black uppercase text-white">${nombreEscapado}</p>
                    <p class="text-[9px] text-slate-400 font-bold">Deuda: $${deudaEscapada}</p>
                </div>
                <div class="bg-emerald-600/20 text-emerald-400 px-3 py-1 rounded-lg text-[9px] font-black tracking-widest border border-emerald-500/30">SELECCIONAR</div>
            </div>`;
        }).join('');
}

window.asignarClienteDesdeModal = function(elemento, tipo) {
    if (tipo === 'estudiante') {
        const id = parseInt(elemento.dataset.estId);
        const nombre = elemento.dataset.estName;
        const bloqueado = elemento.dataset.estBlocked === 'true';
        asignarCliente(id, nombre, tipo, bloqueado);
    } else if (tipo === 'personal') {
        const id = parseInt(elemento.dataset.persId);
        const nombre = elemento.dataset.persName;
        asignarCliente(id, nombre, tipo, false);
    }
}
}

function updateCartButtons() {
    const container = document.getElementById('cart-credit-buttons');
    if(!container) return;

    if (state.activeBuyer) {
        // Si hay un cliente pre-seleccionado, el carrito muestra UN SOLO botón grande de crédito
        const colorClass = state.activeBuyer.tipo === 'estudiante' ? 'bg-indigo-600' : 'bg-emerald-600';
        const clienteNombreEscapado = escapeHtml(state.activeBuyer.nombre);
        container.innerHTML = `
            <div class="col-span-2">
                <button data-client-id="${state.activeBuyer.id}" data-client-type="${state.activeBuyer.tipo}" onclick="procesarTransaccionDesdeBtn(this)" 
                        class="w-full ${colorClass} py-4 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 shadow-lg flex justify-center items-center gap-2">
                    <i class="fa-solid fa-file-invoice-dollar text-sm"></i> Cargar a cuenta de ${clienteNombreEscapado}
                </button>
            </div>
        `;
    } else {
        // Si no hay cliente, el carrito muestra los botones de búsqueda manual tradicionales
        container.innerHTML = `
            <button onclick="abrirModalCreditoVenta()" class="bg-indigo-900/40 border border-indigo-500 text-indigo-400 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 shadow-md w-full">
                <i class="fa-solid fa-graduation-cap"></i> Venta Crédito
            </button>
            <button onclick="abrirModalCreditoPersonal()" class="bg-emerald-900/40 border border-emerald-500 text-emerald-400 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 shadow-md w-full">
                <i class="fa-solid fa-briefcase"></i> Personal
            </button>
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
    filterContainer.innerHTML = categories.map(cat => {
        const catEscapada = escapeHtml(cat);
        return `
        <button onclick="filtrar('${catEscapada}')" class="px-5 py-2.5 ${categoriaActual === cat ? 'bg-indigo-600 shadow-indigo-900/30' : 'bg-slate-800 border-slate-700 text-slate-300'} rounded-full text-[10px] font-bold whitespace-nowrap active:scale-95 transition-all">
            ${catEscapada.toUpperCase()}
        </button>
    `}).join('');
}

function renderProducts() {
    const grid = document.getElementById('grid-productos');
    if (!grid) return;
    const search = document.getElementById('search')?.value.toLowerCase() || '';
    let prods = state.products.filter(p => p.stock > 0 && (categoriaActual === 'Todos' || p.categoria === categoriaActual) && p.name.toLowerCase().includes(search));

    grid.innerHTML = prods.map(p => {
        const imgPath = p.image_url || `https://placehold.co/600x600/0f172a/6366f1?text=${encodeURIComponent(p.name)}`;
        const nombreProductoEscapado = escapeHtml(p.name);
        return `
        <div onclick="addToCart(${p.id})" class="relative bg-slate-900 border border-slate-800 rounded-[2rem] p-3 flex flex-col items-center shadow-lg active:scale-95 transition-transform cursor-pointer group">
            <div class="absolute top-3 right-3 z-10 px-2 py-0.5 rounded-full text-[9px] font-black ${p.stock <= 5 ? 'bg-red-500 animate-pulse text-white' : 'bg-slate-800 text-slate-300 border border-slate-700'}">
                ${p.stock} uds
            </div>
            <div class="w-full aspect-square rounded-[1.5rem] overflow-hidden mb-2 bg-slate-950 flex items-center justify-center">
                <img src="${imgPath}" style="image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges;" class="w-full h-full object-cover">
            </div>
            <h3 class="text-[10px] font-bold text-slate-200 line-clamp-2 h-7 text-center mb-2 px-1 w-full">${nombreProductoEscapado}</h3>
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
    if(list) list.innerHTML = state.cart.map(i => {
        const nombreItemEscapado = escapeHtml(i.name);
        return `
        <div class="flex items-center justify-between p-4 bg-slate-900 rounded-2xl border border-slate-800">
            <div class="flex-1 pr-2">
                <p class="text-[10px] font-black uppercase text-white leading-tight mb-1">${nombreItemEscapado}</p>
                <p class="text-[10px] text-emerald-400 font-bold">$${(i.price * i.qty).toFixed(2)}</p>
            </div>
            <div class="flex items-center gap-3 bg-slate-950 p-1 rounded-full border border-slate-800">
                <button onclick="adjustQty(${i.id}, -1)" class="w-8 h-8 rounded-full bg-slate-800 text-white font-bold active:bg-slate-700">-</button>
                <span class="font-black text-sm w-4 text-center">${i.qty}</span>
                <button onclick="adjustQty(${i.id}, 1)" class="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold active:bg-indigo-500">+</button>
            </div>
        </div>
    `}).join('');
}

function abrirCarrito() { document.getElementById('modal-carrito').classList.remove('hidden'); }
function cerrarCarrito() { document.getElementById('modal-carrito').classList.add('hidden'); }

// ==========================================
// TRANSACCIÓN UNIFICADA Y SEGURA
// ==========================================
function procesarTransaccionDesdeBtn(btn) {
    const clientId = parseInt(btn.dataset.clientId);
    const clientType = btn.dataset.clientType;
    procesarTransaccion('CREDITO', clientId, clientType);
}

async function procesarTransaccion(method, deudorId = null, tipoDeudor = 'estudiante') {
    if (!state.cart || state.cart.length === 0) return alert("El carrito está vacío.");

    let total = state.cart.reduce((s, i) => s + (i.price * i.qty), 0);
    let ganancia = state.cart.reduce((s, i) => s + ((i.price - (i.cost || 0)) * i.qty), 0);
    const idOrden = 'ORD-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    
    let nombreDeudor = null;
    let statusVenta = method.includes('PAGO_MOVIL') ? 'pendiente' : 'completado';
    let recargo = 0; // FIX: Declarar recargo fuera de condicionales

    // VALIDACIÓN PREVIA DE CRÉDITO
    if (method === 'CREDITO' && deudorId) {
        const lista = (tipoDeudor === 'estudiante') ? state.estudiantes : state.personal;
        const deudor = lista.find(e => e.id == deudorId);
        
        if (!deudor) return alert("Error: No se encontró al deudor.");
        nombreDeudor = deudor.name || deudor.nombre;

        // FIX: Validar bloqueo para AMBOS tipos
        if (deudor.bloqueado) {
            const soloLlevaAgua = state.cart.every(item => item.name.toLowerCase().includes('agua') || item.categoria?.toLowerCase() === 'agua');
            if (!soloLlevaAgua) return alert(`❌ VENTA BLOQUEADA\n\nEl representante de ${nombreDeudor} está bloqueado. Solo puede retirar AGUA.`);
        }

        // FIX: Aplicar validaciones específicas por tipo
        if (tipoDeudor === 'estudiante') {
            recargo = total * 0.10;
            const deudaActual = parseFloat(deudor.debt || 0);
            const limite = parseFloat(deudor.limite_credito || 100);

            if ((deudaActual + total + recargo) > limite) {
                return alert(`❌ LÍMITE EXCEDIDO\n\nDeuda actual: $${deudaActual.toFixed(2)}\nEsta compra: $${(total + recargo).toFixed(2)}\nTotal proyectado: $${(deudaActual + total + recargo).toFixed(2)}\n\nLímite disponible: $${limite.toFixed(2)}`);
            }
        } else if (tipoDeudor === 'personal') {
            // Para personal, aplicar recargo también pero sin límite estricto (logging solo)
            recargo = total * 0.10;
            const deudaActual = parseFloat(deudor.debt || 0);
            console.log(`📊 Personal ${nombreDeudor}: Deuda actual $${deudaActual.toFixed(2)} + Nueva compra $${(total + recargo).toFixed(2)}`);
        }

        // FIX: Aplicar recargo una sola vez
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
            alert(`✅ Crédito procesado. Deuda asignada a ${nombreDeudor}\nMonto: $${total.toFixed(2)}`);
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
    
    list.innerHTML = state.estudiantes
        .filter(e => e.name?.toLowerCase().includes(q) || e.representante?.toLowerCase().includes(q))
        .map(e => {
            const nombreEscapado = escapeHtml(e.name || 'Sin Nombre');
            const repEscapado = escapeHtml(e.representante || 'N/A');
            const deudaEscapada = escapeHtml(parseFloat(e.debt || 0).toFixed(2));
            const estadoBloqueado = e.bloqueado ? '<span class="text-red-500 text-[9px] font-bold">(BLOQUEADO)</span>' : '';
            
            return `
            <div class="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex justify-between items-center cursor-pointer hover:border-indigo-500 transition-colors" 
                 data-est-id="${e.id}" data-est-name="${nombreEscapado}" data-est-blocked="${e.bloqueado || false}"
                 onclick="asignarClienteDesdeModal(this, 'estudiante')">
                <div>
                    <p class="text-xs font-black uppercase text-white">${nombreEscapado} ${estadoBloqueado}</p>
                    <p class="text-[9px] text-slate-400 font-bold">Rep: ${repEscapado} | Deuda: $${deudaEscapada}</p>
                </div>
                <div class="bg-indigo-600/20 text-indigo-400 px-3 py-1 rounded-lg text-[9px] font-black tracking-widest border border-indigo-500/30">SELECCIONAR</div>
            </div>
        `;
        }).join('');
}

function filtrarModalPers() {
    const q = document.getElementById('search-pers')?.value.toLowerCase() || '';
    const list = document.getElementById('lista-pers-modal');
    if(!list) return;

    list.innerHTML = state.personal
        .filter(p => p.name?.toLowerCase().includes(q))
        .map(p => {
            const nombreEscapado = escapeHtml(p.name || 'Sin Nombre');
            const deudaEscapada = escapeHtml(parseFloat(p.debt || 0).toFixed(2));
            
            return `
            <div class="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex justify-between items-center cursor-pointer hover:border-emerald-500 transition-colors"
                 data-pers-id="${p.id}" data-pers-name="${nombreEscapado}"
                 onclick="asignarClienteDesdeModal(this, 'personal')">
                <div>
                    <p class="text-xs font-black uppercase text-white">${nombreEscapado}</p>
                    <p class="text-[9px] text-slate-400 font-bold">Deuda: $${deudaEscapada}</p>
                </div>
                <div class="bg-emerald-600/20 text-emerald-400 px-3 py-1 rounded-lg text-[9px] font-black tracking-widest border border-emerald-500/30">SELECCIONAR</div>
            </div>
        `;
        }).join('');
}

function asignarClienteDesdeModal(elemento, tipo) {
    if (tipo === 'estudiante') {
        const id = parseInt(elemento.dataset.estId);
        const nombre = elemento.dataset.estName;
        const bloqueado = elemento.dataset.estBlocked === 'true';
        asignarCliente(id, nombre, tipo, bloqueado);
    } else if (tipo === 'personal') {
        const id = parseInt(elemento.dataset.persId);
        const nombre = elemento.dataset.persName;
        asignarCliente(id, nombre, tipo, false);
    }
}
