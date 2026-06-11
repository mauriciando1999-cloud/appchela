// app.js - El Cerebro de Envolvia (Arquitectura Multi-Page Mobile First)
const SB_URL = 'https://ekvzmfsdshyoeggudksm.supabase.co';
const SB_KEY = 'sb_publishable_Go6ZDuD9pg1pC3k-s89jiQ_65TEYGnd';
const _sb = supabase.createClient(SB_URL, SB_KEY);
const ADMIN_EMAIL = 'mauriciando1999@gmail.com';

window.state = { 
    products: [], 
    estudiantes: [], 
    personal: [], 
    cart: [], 
    tasa: 45.30, 
    userRole: 'vendedor',
    activeBuyer: null 
};
window.categoriaActual = 'Todos';
window.ordenPendienteId = null;

// ==========================================
// INICIALIZACIÓN
// ==========================================
window.onload = async () => {
    try {
        const { data: { user } } = await _sb.auth.getUser();
        const path = window.location.pathname;

        if(user) {
            window.state.userRole = (user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) ? 'admin' : 'vendedor';
            document.getElementById('auth-screen')?.classList.add('hidden');
            document.getElementById('app-content')?.classList.remove('hidden');

            if(window.state.userRole !== 'admin' && path.includes('admin.html')) return window.location.href = 'index.html';

            await window.getBCV();
            await window.sync();
            window.updateCartButtons(); 
        } else {
            document.getElementById('auth-screen')?.classList.remove('hidden');
            document.getElementById('app-content')?.classList.add('hidden');
            if(!path.includes('index.html') && path !== '/' && !path.includes('pago.html')) window.location.href = 'index.html';
        }
    } catch (error) { console.error("Error al cargar la app:", error); }
};

window.handleLogin = async function(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    const { error } = await _sb.auth.signInWithPassword({ email: document.getElementById('login-email').value, password: document.getElementById('login-pass').value });
    if(error) { alert(error.message); btn.innerHTML = originalText; } else window.location.reload();
}

window.handleLogout = function() { 
    _sb.auth.signOut().then(() => window.location.href = 'index.html'); 
}

window.getBCV = async function() {
    try {
        const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
        const data = await res.json();
        if (data?.promedio) window.state.tasa = parseFloat(data.promedio);
    } catch (e) { console.warn("Usando tasa manual/fallback."); }
    document.querySelectorAll('#bcv-val').forEach(el => el.innerText = `BCV: ${window.state.tasa.toFixed(2)}`);
}

window.sync = async function() {
    const [p, e, per] = await Promise.all([
        _sb.from('productos').select('*').order('name'),
        _sb.from('estudiantes').select('*').order('name'),
        _sb.from('personal').select('*').order('name')
    ]);
    window.state.products = p.data || [];
    window.state.estudiantes = e.data || [];
    window.state.personal = per.data || [];
    window.renderCategories();
    window.renderProducts();
}

// ==========================================
// BUSCADOR UNIVERSAL Y ASIGNACIÓN DIRECTA (CERO FRICCIÓN)
// ==========================================
window.buscarGlobal = function() {
    const q = document.getElementById('search')?.value.toLowerCase().trim() || '';
    const container = document.getElementById('resultados-clientes-global'); // Asegúrate de usar este ID en tu HTML principal
    
    // Si la búsqueda es muy corta, solo filtramos productos
    if (q.length < 2) {
        if(container) {
            container.innerHTML = '';
            container.classList.add('hidden');
        }
        window.renderProducts();
        return;
    }

    // Buscamos coincidencias en clientes (Máximo 2 de cada uno para no tapar toda la pantalla)
    const estMatches = window.state.estudiantes.filter(e => e.name?.toLowerCase().includes(q) || e.representante?.toLowerCase().includes(q)).slice(0, 2);
    const persMatches = window.state.personal.filter(p => p.name?.toLowerCase().includes(q)).slice(0, 2);

    if (estMatches.length > 0 || persMatches.length > 0) {
        if(container) container.classList.remove('hidden');
        
        let html = '<p class="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1 px-1"><i class="fa-solid fa-bolt text-amber-400 mr-1"></i> Asignación Rápida</p>';
        
        html += estMatches.map(e => `
            <div onclick="asignarClienteDirecto(${e.id}, '${e.name?.replace(/'/g, "\\'") || ''}', 'estudiante', ${e.bloqueado || false}, ${e.debt || 0}, ${e.limite_credito || 100})" 
                 class="bg-indigo-900/40 p-3 rounded-2xl border border-indigo-500/50 flex justify-between items-center active:scale-95 transition-all cursor-pointer shadow-sm mb-2">
                <div>
                    <p class="text-xs font-black uppercase text-white">${e.name}</p>
                    <p class="text-[9px] text-indigo-300 font-bold">Estudiante</p>
                </div>
                <div class="bg-indigo-600 text-white px-3 py-1.5 rounded-xl text-[9px] font-black tracking-widest shadow-md">ASIGNAR</div>
            </div>
        `).join('');

        html += persMatches.map(p => `
            <div onclick="asignarClienteDirecto(${p.id}, '${p.name?.replace(/'/g, "\\'") || ''}', 'personal', false, ${p.debt || 0}, ${p.limite_consumo || 100})" 
                 class="bg-emerald-900/40 p-3 rounded-2xl border border-emerald-500/50 flex justify-between items-center active:scale-95 transition-all cursor-pointer shadow-sm mb-2">
                <div>
                    <p class="text-xs font-black uppercase text-white">${p.name}</p>
                    <p class="text-[9px] text-emerald-300 font-bold">Personal</p>
                </div>
                <div class="bg-emerald-600 text-white px-3 py-1.5 rounded-xl text-[9px] font-black tracking-widest shadow-md">ASIGNAR</div>
            </div>
        `).join('');

        if(container) container.innerHTML = html;
    } else {
        if(container) {
            container.classList.add('hidden');
            container.innerHTML = '';
        }
    }

    window.renderProducts(); // Filtra los productos simultáneamente
}

window.asignarClienteDirecto = function(id, nombre, tipo, bloqueado, deuda, limite) {
    window.asignarCliente(id, nombre, tipo, bloqueado, deuda, limite);
    
    // Magia de Cero Fricción: Limpiamos el buscador y ocultamos los resultados al instante
    const searchInput = document.getElementById('search');
    const container = document.getElementById('resultados-clientes-global');
    if (searchInput) searchInput.value = '';
    if (container) {
        container.innerHTML = '';
        container.classList.add('hidden');
    }
    window.renderProducts();
}

window.asignarCliente = function(id, nombre, tipo, bloqueado = false, deuda = 0, limite = 100) {
    if (tipo === 'estudiante' && bloqueado) {
        alert(`⚠️ ATENCIÓN: El representante de ${nombre} está bloqueado.`);
    }
    
    window.state.activeBuyer = { id, nombre, tipo, bloqueado, deuda, limite };
    
    const clienteNombre = document.getElementById('ui-cliente-nombre');
    if (clienteNombre) {
        clienteNombre.innerText = nombre;
        clienteNombre.classList.add('text-indigo-400');
    }
    
    const banner = document.getElementById('active-buyer-banner');
    const uiNombre = document.getElementById('active-buyer-name');
    const uiInfo = document.getElementById('active-buyer-info');
    
    if(banner) banner.classList.remove('hidden');
    if(uiNombre) uiNombre.innerText = nombre;
    if(uiInfo) uiInfo.innerHTML = `Límite: <span class="text-white">$${limite}</span> | Deuda: <span class="${deuda > limite ? 'text-red-500 font-black' : 'text-emerald-400'}">$${parseFloat(deuda).toFixed(2)}</span>`;
    
    document.getElementById('modal-seleccion-credito')?.classList.add('hidden');
    document.getElementById('modal-credito-personal')?.classList.add('hidden');
    
    window.updateCartButtons();
}

window.limpiarCliente = function() {
    window.state.activeBuyer = null;
    const uiNombre = document.getElementById('ui-cliente-nombre');
    if (uiNombre) {
        uiNombre.innerText = "Venta al Público";
        uiNombre.classList.remove('text-indigo-400');
    }
    document.getElementById('active-buyer-banner')?.classList.add('hidden');
    window.updateCartButtons();
}

window.updateCartButtons = function() {
    const container = document.getElementById('cart-credit-buttons');
    if(!container) return;

    if (window.state.activeBuyer) {
        const colorClass = window.state.activeBuyer.tipo === 'estudiante' ? 'bg-indigo-600' : 'bg-emerald-600';
        container.innerHTML = `
            <div class="col-span-2">
                <button onclick="procesarTransaccion('CREDITO')" 
                        class="w-full ${colorClass} py-4 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 shadow-lg flex justify-center items-center gap-2">
                    <i class="fa-solid fa-file-invoice-dollar text-sm"></i> Cargar a cuenta de ${window.state.activeBuyer.nombre}
                </button>
            </div>
        `;
    } else {
        container.innerHTML = `
            <button onclick="abrirModalCreditoVenta()" class="bg-indigo-900/40 border border-indigo-500 text-indigo-400 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-transform flex flex-col items-center justify-center gap-1"><i class="fa-solid fa-graduation-cap"></i> Buscar Estudiante</button>
            <button onclick="abrirModalCreditoPersonal()" class="bg-emerald-900/40 border border-emerald-500 text-emerald-400 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-transform flex flex-col items-center justify-center gap-1"><i class="fa-solid fa-user-tie"></i> Buscar Personal</button>
        `;
    }
}

// ==========================================
// BÚSQUEDA POR VOZ ULTRA RÁPIDA Y ANTI-RUIDO
// ==========================================
window.limpiarBuscador = function(inputId, callback) {
    const input = document.getElementById(inputId);
    if(input) {
        input.value = '';
        input.focus();
        if(callback) callback(); 
    }
}

window.iniciarReconocimientoVoz = function(inputId, callback, btnId) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Tu navegador no soporta búsqueda por voz. Intenta usar Chrome.");

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-VE'; 
    recognition.interimResults = true; 
    recognition.maxAlternatives = 1;
    recognition.continuous = false; 

    const input = document.getElementById(inputId);
    const btn = document.getElementById(btnId);
    
    input.placeholder = "Escuchando rápido...";
    if(btn) {
        btn.classList.add('animate-pulse', 'bg-red-500/20', 'text-red-400', 'border-red-500/50');
        btn.classList.remove('bg-indigo-500/10', 'text-indigo-400', 'border-indigo-500/30');
        btn.innerHTML = '<i class="fa-solid fa-microphone-lines"></i>';
    }

    recognition.start();

    recognition.onresult = function(event) {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            transcript += event.results[i][0].transcript;
        }
        
        input.value = transcript.replace(/\.$/, '');
        if(callback) callback();

        // Anti-ruido: Corta automáticamente al confirmar la palabra
        if (event.results[0].isFinal) recognition.stop();
    };

    recognition.onerror = function(event) {
        if(event.error !== 'no-speech') console.error("Error de voz:", event.error);
    };

    recognition.onend = function() {
        input.placeholder = "Buscar cliente o producto...";
        if(btn) {
            btn.classList.remove('animate-pulse', 'bg-red-500/20', 'text-red-400', 'border-red-500/50');
            btn.classList.add('bg-indigo-500/10', 'text-indigo-400', 'border-indigo-500/30');
            btn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
        }
    };
}

// ==========================================
// VENTAS Y RENDERIZADO
// ==========================================
window.filtrar = function(categoria) { 
    window.categoriaActual = categoria; 
    window.renderProducts(); 
}

window.renderCategories = function() {
    const filterContainer = document.querySelector('.flex.overflow-x-auto');
    if (!filterContainer) return;
    const categories = ['Todos', ...new Set(window.state.products.map(p => p.categoria || 'General'))];
    filterContainer.innerHTML = categories.map(cat => `
        <button onclick="filtrar('${cat}')" class="px-5 py-2.5 ${window.categoriaActual === cat ? 'bg-indigo-600 shadow-indigo-900/30' : 'bg-slate-800 border-slate-700 text-slate-300'} rounded-full text-[10px] font-black tracking-widest active:scale-95 transition-all shrink-0 shadow-lg border">
            ${cat.toUpperCase()}
        </button>
    `).join('');
}

window.renderProducts = function() {
    const grid = document.getElementById('grid-productos');
    if (!grid) return;
    const search = document.getElementById('search')?.value.toLowerCase() || '';
    let prods = window.state.products.filter(p => p.stock > 0 && (window.categoriaActual === 'Todos' || p.categoria === window.categoriaActual) && p.name.toLowerCase().includes(search));

    grid.innerHTML = prods.map(p => {
        const imgPath = p.image_url || `https://placehold.co/600x600/0f172a/6366f1?text=${encodeURIComponent(p.name)}`;
        return `
        <div onclick="addToCart(${p.id})" class="relative bg-slate-900 border border-slate-800 rounded-[2rem] p-3 flex flex-col items-center shadow-lg active:scale-95 transition-transform cursor-pointer">
            <div class="absolute top-3 right-3 z-10 px-2 py-0.5 rounded-full text-[9px] font-black ${p.stock <= 5 ? 'bg-red-500 animate-pulse text-white' : 'bg-slate-800 text-slate-300 border border-slate-700'}">${p.stock}</div>
            <div class="w-full aspect-square rounded-[1.5rem] overflow-hidden mb-2 bg-slate-950 flex items-center justify-center">
                <img src="${imgPath}" onerror="this.src='https://placehold.co/600x600/0f172a/6366f1?text=Sin+Imagen'" style="image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges;" class="w-full h-full object-cover">
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
window.addToCart = function(id) {
    const p = window.state.products.find(x => x.id === id);
    if(p.stock <= 0) return alert("¡Producto Agotado!");
    const inC = window.state.cart.find(x => x.id === id);
    if(inC) {
        if(inC.qty >= p.stock) return alert("Stock máximo alcanzado");
        inC.qty++; 
    } else window.state.cart.push({...p, qty: 1});
    window.updateUI();
}

window.adjustQty = function(id, delta) {
    const item = window.state.cart.find(x => x.id === id);
    if(!item) return;
    const product = window.state.products.find(x => x.id === id);
    item.qty += delta;
    if(item.qty > product.stock) item.qty = product.stock;
    if(item.qty <= 0) window.state.cart = window.state.cart.filter(x => x.id !== id);
    window.updateUI();
}

window.updateUI = function() {
    const total = window.state.cart.reduce((s, i) => s + (i.price * i.qty), 0);
    const btnFloat = document.getElementById('floating-cart-btn');
    if(!btnFloat) return;

    if(total > 0) { 
        btnFloat.classList.remove('hidden'); 
        document.getElementById('total-resumen').innerText = `$${total.toFixed(2)}`; 
    } else { 
        btnFloat.classList.add('hidden'); 
        window.cerrarCarrito(); 
    }

    if(document.getElementById('total-usd')) document.getElementById('total-usd').innerText = `$${total.toFixed(2)}`;
    if(document.getElementById('total-vef')) document.getElementById('total-vef').innerText = `Bs. ${(total * window.state.tasa).toLocaleString('es-VE')}`;
    
    const list = document.getElementById('cart-list');
    if(list) list.innerHTML = window.state.cart.map(i => `
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

window.abrirCarrito = function() { document.getElementById('modal-carrito').classList.remove('hidden'); }
window.cerrarCarrito = function() { document.getElementById('modal-carrito').classList.add('hidden'); }

window.abrirModalPagoMovil = function() {
    window.procesarTransaccion('PAGO_MOVIL');
}

// ==========================================
// TRANSACCIÓN UNIFICADA Y SEGURA
// ==========================================
window.procesarTransaccion = async function(method, paramDeudorId = null, paramTipoDeudor = null) {
    if (!window.state.cart || window.state.cart.length === 0) return alert("El carrito está vacío.");

    let total = window.state.cart.reduce((s, i) => s + (i.price * i.qty), 0);
    let ganancia = window.state.cart.reduce((s, i) => s + ((i.price - (i.cost || 0)) * i.qty), 0);
    const idOrden = 'ORD-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    
    let deudorId = paramDeudorId;
    let tipoDeudor = paramTipoDeudor;
    let nombreDeudor = null;
    let statusVenta = method.includes('PAGO_MOVIL') ? 'pendiente' : 'completado';

    if (method === 'CREDITO') {
        const deudorActual = deudorId || (window.state.activeBuyer ? window.state.activeBuyer.id : null);
        const tipoActual = tipoDeudor || (window.state.activeBuyer ? window.state.activeBuyer.tipo : 'estudiante');
        
        if (!deudorActual) return alert("Error: No se ha seleccionado al deudor.");

        const lista = (tipoActual === 'estudiante') ? window.state.estudiantes : window.state.personal;
        const deudor = lista.find(e => e.id == deudorActual);
        
        if (!deudor) return alert("Error: No se encontró al deudor.");
        nombreDeudor = deudor.name || deudor.nombre;

        if (tipoActual === 'estudiante') {
            if (deudor.bloqueado) {
                const soloLlevaAgua = window.state.cart.every(item => item.name.toLowerCase().includes('agua') || item.categoria?.toLowerCase() === 'agua');
                if (!soloLlevaAgua) return alert(`❌ VENTA BLOQUEADA\n\nEl representante de ${nombreDeudor} está bloqueado. Solo puede retirar AGUA.`);
            }
            const recargo = total * 0.10;
            const deudaActual = parseFloat(deudor.debt || 0);
            const limite = parseFloat(deudor.limite_credito || 100);

            if ((deudaActual + total + recargo) > limite) return alert(`❌ LÍMITE EXCEDIDO. Máximo: $${limite}.`);
            total += recargo;
            ganancia += recargo;
        }
        deudorId = deudorActual;
        tipoDeudor = tipoActual;
    }

    try {
        const { error: errVenta } = await _sb.from('ventas').insert([{ 
            id_orden: idOrden, 
            total_usd: total, 
            metodo_pago: method, 
            items: window.state.cart, 
            ganancia_total: ganancia, 
            status: statusVenta,
            estudiante_nombre: (tipoDeudor === 'estudiante') ? nombreDeudor : null,
            personal_id: (tipoDeudor === 'personal') ? deudorId : null
        }]);
        if (errVenta) throw errVenta;

        for(const item of window.state.cart) {
            const p = window.state.products.find(x => x.id === item.id);
            if (p) await _sb.from('productos').update({ stock: p.stock - item.qty }).eq('id', item.id);
        }

        if (method === 'CREDITO' && deudorId) {
            const tabla = (tipoDeudor === 'estudiante') ? 'estudiantes' : 'personal';
            const deudor = (tipoDeudor === 'estudiante') ? window.state.estudiantes.find(e => e.id == deudorId) : window.state.personal.find(e => e.id == deudorId);
            await _sb.from(tabla).update({ debt: parseFloat(deudor.debt || 0) + total }).eq('id', deudorId);
            alert(`✅ Crédito procesado.`);
        } 
        else if (method === 'PAGO_MOVIL') {
            window.ordenPendienteId = idOrden; 
            const totalBs = (total * window.state.tasa).toLocaleString('es-VE', { minimumFractionDigits: 2 });
            document.getElementById('monto-bs-qr').innerText = `Bs. ${totalBs}`;
            document.getElementById('modal-qr').classList.remove('hidden');
        } else { 
            alert("Venta procesada con éxito ✅"); 
        }

        window.state.cart = [];
        window.limpiarCliente(); 
        window.cerrarCarrito();
        window.updateUI();
        await window.sync(); 
    } catch (e) { alert("Error: " + e.message); }
}

window.confirmarReferencia = async function() {
    const ref = document.getElementById('ref-pago').value;
    if (ref.length !== 4) return alert("Ingresa los 4 dígitos de la referencia.");

    try {
        await _sb.from('ventas').update({ referencia: ref, status: 'esperando_verificacion' }).eq('id_orden', window.ordenPendienteId);
        alert("✅ Referencia enviada. Esperando verificación.");
        document.getElementById('modal-qr').classList.add('hidden');
        document.getElementById('ref-pago').value = '';
        window.ordenPendienteId = null;
    } catch (e) { alert("Error: " + e.message); }
}

// ==========================================
// MODALES ANTIGUOS (MANTENIDOS POR COMPATIBILIDAD)
// ==========================================
window.abrirModalCreditoVenta = function() {
    document.getElementById('modal-seleccion-credito').classList.remove('hidden');
    window.filtrarModalEst();
}

window.abrirModalCreditoPersonal = function() {
    document.getElementById('modal-credito-personal').classList.remove('hidden');
    window.filtrarModalPers();
}

window.filtrarModalEst = function() {
    const q = document.getElementById('search-est')?.value.toLowerCase() || '';
    const list = document.getElementById('lista-est-modal');
    if(!list) return;
    
    list.innerHTML = window.state.estudiantes
        .filter(e => e.name?.toLowerCase().includes(q) || e.representante?.toLowerCase().includes(q))
        .map(e => `
        <div onclick="asignarCliente(${e.id}, '${e.name?.replace(/'/g, "\\'") || 'Sin Nombre'}', 'estudiante', ${e.bloqueado || false}, ${e.debt || 0}, ${e.limite_credito || 100})" 
             class="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex justify-between items-center active:bg-slate-800 cursor-pointer">
            <div>
                <p class="text-xs font-black uppercase text-white">${e.name || 'Sin Nombre'}</p>
                <p class="text-[9px] text-slate-400 font-bold">Deuda: $${parseFloat(e.debt || 0).toFixed(2)} | Límite: $${e.limite_credito || 100}</p>
            </div>
            <div class="bg-indigo-600/20 text-indigo-400 px-3 py-1 rounded-lg text-[9px] font-black tracking-widest border border-indigo-500/30">SELECCIONAR</div>
        </div>
    `).join('');
}

window.filtrarModalPers = function() {
    const q = document.getElementById('search-pers')?.value.toLowerCase() || '';
    const list = document.getElementById('lista-pers-modal');
    if(!list) return;

    list.innerHTML = window.state.personal
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