// app.js - El Cerebro de Envolvia (Arquitectura Multi-Page Mobile First)
const SB_URL = 'https://ekvzmfsdshyoeggudksm.supabase.co';
const SB_KEY = 'sb_publishable_Go6ZDuD9pg1pC3k-s89jiQ_65TEYGnd';
const _sb = supabase.createClient(SB_URL, SB_KEY);
const ADMIN_EMAIL = 'mauriciando1999@gmail.com';

const URL_SISTEMA = 'https://appchela.vercel.app';
let state = { products: [], estudiantes: [], cart: [], tasa: 45.30, userRole: 'vendedor' };
let categoriaActual = 'Todos';
let abonoTemporal = { id: null, deudaMax: 0 };

// ==========================================
// 1. INICIALIZACIÓN, RUTEO Y AUTENTICACIÓN
// ==========================================
window.onload = async () => {
    try {
        const { data: { user } } = await _sb.auth.getUser();
        const path = window.location.pathname;

        if(user) {
            state.userRole = (user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) ? 'admin' : 'vendedor';
            
            document.getElementById('auth-screen')?.classList.add('hidden');
            document.getElementById('app-content')?.classList.remove('hidden');

            if(state.userRole !== 'admin' && path.includes('admin.html')) {
                window.location.href = 'index.html';
                return;
            }

            await getBCV();
            await sync();
        } else {
            document.getElementById('auth-screen')?.classList.remove('hidden');
            document.getElementById('app-content')?.classList.add('hidden');
            
            if(!path.includes('index.html') && path !== '/' && !path.includes('pago.html')) {
                window.location.href = 'index.html';
            }
        }
    } catch (error) {
        console.error("Error al cargar la app:", error);
    }
};

async function handleLogin(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    
    const { error } = await _sb.auth.signInWithPassword({ 
        email: document.getElementById('login-email').value, 
        password: document.getElementById('login-pass').value 
    });
    
    if(error) { 
        alert(error.message); 
        btn.innerHTML = originalText; 
    } else {
        window.location.reload();
    }
}

function handleLogout() { 
    _sb.auth.signOut().then(() => window.location.href = 'index.html'); 
}

async function getBCV() {
    try {
        const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
        const data = await res.json();
        if (data?.promedio) state.tasa = parseFloat(data.promedio);
    } catch (e) { console.warn("Usando tasa manual/fallback."); }
    
    document.querySelectorAll('#bcv-val').forEach(el => {
        el.innerText = `BCV: ${state.tasa.toFixed(2)}`;
    });
}

async function sync() {
    const [p, e] = await Promise.all([
        _sb.from('productos').select('*').order('name'),
        _sb.from('estudiantes').select('*').order('name')
    ]);
    state.products = p.data || [];
    state.estudiantes = e.data || [];
    
    renderCategories();
    renderProducts();
    if(document.getElementById('stock-table') || document.getElementById('stock-list')) renderStock();
    if(document.getElementById('lista-deudores')) renderDeudores();
    if(document.getElementById('stat-tw-total') && state.userRole === 'admin') renderDashboard();
}

// ==========================================
// 2. MÓDULO DE VENTAS (POS - index.html)
// ==========================================
function filtrar(categoria) { 
    categoriaActual = categoria; 
    renderProducts(); 
}

function renderCategories() {
    const filterContainer = document.querySelector('.flex.overflow-x-auto');
    if (!filterContainer) return;

    const categories = ['Todos', ...new Set(state.products.map(p => p.categoria || 'General'))];

    filterContainer.innerHTML = categories.map(cat => `
        <button onclick="filtrar('${cat}')" 
                class="px-5 py-2.5 ${categoriaActual === cat ? 'bg-indigo-600 shadow-indigo-900/30' : 'bg-slate-800 border-slate-700 text-slate-300'} 
                rounded-full text-[10px] font-black tracking-widest active:scale-95 transition-all shrink-0 shadow-lg border">
            ${cat.toUpperCase()}
        </button>
    `).join('');
}

function renderProducts() {
    const grid = document.getElementById('grid-productos');
    if (!grid) return;
    const search = document.getElementById('search').value.toLowerCase();
    
    let prods = state.products.filter(p => 
        (categoriaActual === 'Todos' || p.categoria === categoriaActual) &&
        p.name.toLowerCase().includes(search)
    );

    grid.innerHTML = prods.map(p => {
        const imgPath = p.image_url || `https://placehold.co/600x600/0f172a/6366f1?text=${encodeURIComponent(p.name)}`;
        return `
        <div onclick="addToCart(${p.id})" class="relative bg-slate-900 border border-slate-800 rounded-[2rem] p-3 flex flex-col items-center shadow-lg active:scale-95 transition-transform cursor-pointer">
            <div class="absolute top-3 right-3 z-10 px-2 py-0.5 rounded-full text-[9px] font-black ${p.stock <= 5 ? 'bg-red-500 animate-pulse text-white' : 'bg-slate-800 text-slate-300 border border-slate-700'}">
                ${p.stock}
            </div>
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
// 3. CARRITO DE COMPRAS Y PAGOS
// ==========================================
function addToCart(id) {
    const p = state.products.find(x => x.id === id);
    if(p.stock <= 0) return alert("¡Producto Agotado!");
    
    const inC = state.cart.find(x => x.id === id);
    if(inC) {
        if(inC.qty >= p.stock) return alert("Stock máximo alcanzado");
        inC.qty++; 
    } else {
        state.cart.push({...p, qty: 1});
    }
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

    if(total > 0) {
        btnFloat.classList.remove('hidden');
        document.getElementById('total-resumen').innerText = `$${total.toFixed(2)}`;
    } else {
        btnFloat.classList.add('hidden');
        cerrarCarrito();
    }

    const totalUsdEl = document.getElementById('total-usd');
    const totalVefEl = document.getElementById('total-vef');
    if(totalUsdEl) totalUsdEl.innerText = `$${total.toFixed(2)}`;
    if(totalVefEl) totalVefEl.innerText = `Bs. ${(total * state.tasa).toLocaleString('es-VE')}`;
    
    const list = document.getElementById('cart-list');
    if(list) {
        list.innerHTML = state.cart.map(i => `
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
}

function abrirCarrito() { document.getElementById('modal-carrito').classList.remove('hidden'); }
function cerrarCarrito() { document.getElementById('modal-carrito').classList.add('hidden'); }
function clearCart() { state.cart = []; updateUI(); }

async function procesarTransaccion(method, estudianteId = null) {
    let total = state.cart.reduce((s, i) => s + (i.price * i.qty), 0);
    let ganancia = state.cart.reduce((s, i) => s + ((i.price - (i.cost || 0)) * i.qty), 0);
    
    if (method === 'CREDITO') {
        const recargo = total * 0.10;
        total += recargo;
        ganancia += recargo;
    }

    const idOrden = 'ORD-' + Math.random().toString(36).substr(2, 9).toUpperCase();

    try {
        await _sb.from('ventas').insert([{ 
            id_orden: idOrden, 
            total_usd: total, 
            metodo_pago: method, 
            items: state.cart, 
            ganancia_total: ganancia, 
            status: 'completado' 
        }]);
        
        for(const i of state.cart) {
            const p = state.products.find(x => x.id === i.id);
            await _sb.from('productos').update({ stock: p.stock - i.qty }).eq('id', i.id);
        }

        if (method === 'CREDITO' && estudianteId) {
            const est = state.estudiantes.find(e => e.id === estudianteId);
            await _sb.from('estudiantes').update({ debt: parseFloat(est.debt) + total }).eq('id', estudianteId);
            alert(`Crédito procesado (+10%). Deuda asignada a ${est.name} ✅`);
            document.getElementById('modal-seleccion-credito')?.remove();
        } else {
            alert("Venta procesada con éxito ✅");
        }
        
        cerrarCarrito();
        clearCart(); 
        sync();
    } catch (e) { alert("Error al procesar: " + e.message); }
}

// === PAGO MÓVIL Y QR ===
function abrirModalPagoMovil() {
    let totalUsd = state.cart.reduce((s, i) => s + (i.price * i.qty), 0);
    if(totalUsd <= 0) return alert("El carrito está vacío");

    let totalBs = (totalUsd * state.tasa).toFixed(2);

    const modalHtml = `
        <div id="modal-qr-pago-movil" class="fixed inset-0 z-[60] bg-slate-950/90 backdrop-blur-sm flex flex-col p-4 justify-center items-center transition-all">
            <div class="bg-slate-900 w-full max-w-sm rounded-[2.5rem] border border-slate-800 p-6 shadow-2xl relative text-center">
                <button onclick="this.closest('#modal-qr-pago-movil').remove()" class="absolute top-4 right-4 text-slate-400 hover:text-white p-2 active:scale-90 transition-transform"><i class="fa-solid fa-xmark text-xl"></i></button>
                
                <h3 class="text-white font-black uppercase tracking-widest text-sm mb-6 mt-2 flex justify-center items-center gap-2">
                    <i class="fa-solid fa-mobile-screen-button text-cyan-500"></i> Banesco Pago Móvil
                </h3>
                
                <div class="bg-slate-950 p-6 rounded-[2rem] border border-slate-800 flex flex-col items-center mb-6">
                    <img src="qr.jpeg" alt="QR Banesco" class="w-48 h-48 rounded-xl mb-4 shadow-[0_0_20px_rgba(16,185,129,0.15)] bg-white p-2 object-contain">
                    
                    <p class="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Monto a Transferir</p>
                    <p class="text-3xl font-black text-emerald-400 mb-4">Bs. ${totalBs}</p>
                    
                    <div class="w-full grid grid-cols-2 gap-y-3 text-xs font-mono text-left bg-slate-900 p-4 rounded-xl border border-slate-800 mb-4">
                        <div class="text-slate-500">Banco:</div><div class="text-white font-bold text-right">0134 Banesco</div>
                        <div class="text-slate-500">Teléfono:</div><div class="text-white font-bold text-right">0412-2969255</div>
                        <div class="text-slate-500">Cédula:</div><div class="text-white font-bold text-right">V-10383082</div>
                    </div>

                    <div class="w-full border-t border-slate-800 pt-4 mt-2">
                        <label class="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2 block">Referencia (Últimos 4 dígitos)</label>
                        <input type="text" id="input-ref-pm" maxlength="4" pattern="[0-9]*" inputmode="numeric" placeholder="0000" class="w-full bg-slate-900 border border-slate-700 text-cyan-400 p-4 rounded-xl font-black text-2xl outline-none focus:border-cyan-500 text-center tracking-[0.5em] transition-colors placeholder:text-slate-700">
                    </div>
                </div>

                <button onclick="confirmarPagoMovil()" id="btn-confirma-pm" class="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs active:scale-95 transition-transform shadow-lg shadow-cyan-900/50">
                    <i class="fa-solid fa-check mr-2"></i> Confirmar Transacción
                </button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function confirmarPagoMovil() {
    const refInput = document.getElementById('input-ref-pm');
    const refValue = refInput ? refInput.value.trim() : '';

    if (refValue.length !== 4 || isNaN(refValue)) {
        alert("⚠️ Por favor, ingresa los 4 dígitos de la referencia.");
        refInput.focus();
        return;
    }

    const btn = document.getElementById('btn-confirma-pm');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
    btn.disabled = true;

    const modal = document.getElementById('modal-qr-pago-movil');
    if (modal) modal.remove();
    
    procesarTransaccion(`PAGO_MOVIL (Ref: ${refValue})`);
}

function abrirModalCreditoVenta() {
    const modalHtml = `
        <div id="modal-seleccion-credito" class="fixed inset-0 z-[60] bg-slate-950 flex flex-col p-4">
            <header class="flex justify-between items-center mb-6 mt-4">
                <h3 class="text-white font-black uppercase tracking-widest text-sm">Crédito Estudiante (+10%)</h3>
                <button onclick="this.closest('#modal-seleccion-credito').remove()" class="text-slate-400 p-2"><i class="fa-solid fa-xmark text-2xl"></i></button>
            </header>
            <input type="text" id="search-est" placeholder="Buscar nombre o representante..." oninput="filtrarModalEst()" class="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl mb-4 text-sm outline-none focus:border-indigo-500">
            <div id="lista-est-modal" class="flex-1 overflow-y-auto space-y-2 pb-10"></div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    filtrarModalEst();
}

function filtrarModalEst() {
    const q = document.getElementById('search-est')?.value.toLowerCase() || '';
    const list = document.getElementById('lista-est-modal');
    list.innerHTML = state.estudiantes
        .filter(e => e.name.toLowerCase().includes(q) || e.representante.toLowerCase().includes(q))
        .map(e => `
        <div onclick="procesarTransaccion('CREDITO', ${e.id})" class="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex justify-between items-center active:bg-slate-800 cursor-pointer">
            <div>
                <p class="text-xs font-black uppercase text-white">${e.name}</p>
                <p class="text-[9px] text-slate-400 font-bold">Rep: ${e.representante} | Deuda: $${parseFloat(e.debt).toFixed(2)}</p>
            </div>
            <div class="bg-indigo-600/20 text-indigo-400 px-3 py-1 rounded-lg text-[9px] font-black tracking-widest border border-indigo-500/30">
                COBRAR
            </div>
        </div>
    `).join('');
}

// ==========================================
// 4. MÓDULO DE INVENTARIO (stock.html)
// ==========================================
function renderStock() {
    const list = document.getElementById('stock-list');
    if(!list) return;
    
    const searchEl = document.getElementById('search-stock');
    const search = searchEl ? searchEl.value.toLowerCase() : '';
    
    let prods = state.products.filter(p => p.name.toLowerCase().includes(search));
    
    list.innerHTML = prods.map(p => {
        const imgPath = p.image_url || `https://placehold.co/200x200/0f172a/6366f1?text=${encodeURIComponent(p.name)}`;
        
        const btnEditar = state.userRole === 'admin' ? `
            <button onclick="abrirModalEditar(${p.id})" class="bg-slate-800 text-indigo-400 w-8 h-8 rounded-full flex justify-center items-center active:scale-90 border border-slate-700 shadow-sm ml-3">
                <i class="fa-solid fa-pen text-xs"></i>
            </button>
        ` : '';

        return `
        <div class="bg-slate-900 border border-slate-800 p-3 rounded-[1.5rem] flex items-center shadow-sm hover:border-slate-700 transition-colors mb-3">
            <div class="w-14 h-14 rounded-xl overflow-hidden bg-slate-950 shrink-0">
                <img src="${imgPath}" class="w-full h-full object-cover" style="image-rendering: crisp-edges;">
            </div>
            
            <div class="ml-3 flex-1 overflow-hidden">
                <p class="text-[11px] font-black uppercase text-slate-200 truncate">${p.name}</p>
                <div class="flex items-center gap-2 mt-1">
                    <span class="text-[9px] text-slate-400 tracking-widest bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">${p.categoria || 'GRAL'}</span>
                    <span class="text-[10px] font-bold text-emerald-400">$${parseFloat(p.price).toFixed(2)}</span>
                </div>
            </div>
            
            <div class="flex items-center">
                <div class="text-right">
                    <p class="text-xs text-slate-500 uppercase font-black tracking-widest mb-0.5">Stock</p>
                    <p class="text-lg font-black leading-none ${p.stock <= 5 ? 'text-red-400' : 'text-white'}">${p.stock}</p>
                </div>
                ${btnEditar}
            </div>
        </div>
        `;
    }).join('');
}

function abrirModalFactura() {
    const select = document.getElementById('factura-producto');
    if(select) {
        select.innerHTML = state.products.map(p => `<option value="${p.id}">${p.name} (Stock: ${p.stock})</option>`).join('');
    }
    document.getElementById('factura-qty').value = '';
    document.getElementById('modal-factura').classList.remove('hidden');
}

async function guardarFacturaStock() {
    const id = parseInt(document.getElementById('factura-producto').value);
    const qtyInput = document.getElementById('factura-qty').value;
    const qtyToAdd = parseInt(qtyInput);

    if (isNaN(qtyToAdd) || qtyToAdd <= 0) return alert("⚠️ Ingresa una cantidad válida a sumar.");

    const btn = document.getElementById('btn-save-factura');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Registrando...';
    btn.disabled = true;

    try {
        const prod = state.products.find(p => p.id === id);
        const nuevoStock = prod.stock + qtyToAdd;

        await _sb.from('productos').update({ stock: nuevoStock }).eq('id', id);
        
        alert(`✅ Ingreso registrado. Nuevo stock de ${prod.name}: ${nuevoStock}`);
        document.getElementById('modal-factura').classList.add('hidden');
        sync(); 
    } catch (e) {
        alert("Error al guardar: " + e.message);
    } finally {
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Registrar Ingreso';
        btn.disabled = false;
    }
}

function abrirModalEditar(id) {
    const p = state.products.find(x => x.id === id);
    if (!p) return;

    document.getElementById('edit-id').value = p.id;
    document.getElementById('edit-name').value = p.name;
    document.getElementById('edit-price').value = parseFloat(p.price).toFixed(2);
    document.getElementById('edit-stock').value = p.stock;

    document.getElementById('modal-editar').classList.remove('hidden');
}

async function guardarEdicionAdmin() {
    const id = document.getElementById('edit-id').value;
    const nombre = document.getElementById('edit-name').value.trim();
    const precio = parseFloat(document.getElementById('edit-price').value);
    const stock = parseInt(document.getElementById('edit-stock').value);

    if (!nombre || isNaN(precio) || isNaN(stock)) return alert("⚠️ Verifica que todos los campos estén correctos.");

    const btn = document.getElementById('btn-save-edit');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
    btn.disabled = true;

    try {
        await _sb.from('productos').update({ 
            name: nombre, 
            price: precio, 
            stock: stock 
        }).eq('id', id);

        alert("✅ Producto actualizado correctamente.");
        document.getElementById('modal-editar').classList.add('hidden');
        sync();
    } catch (e) {
        alert("Error al actualizar: " + e.message);
    } finally {
        btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar Cambios';
        btn.disabled = false;
    }
}

// ==========================================
// 5. MÓDULO DE COBRANZAS Y ABONOS (cobranza.html)
// ==========================================
function renderDeudores() {
    const list = document.getElementById('lista-deudores');
    const globalEl = document.getElementById('total-deuda-global');
    if(!list) return;
    
    const deudores = state.estudiantes.filter(e => parseFloat(e.debt) > 0);
    let totalD = 0;
    
    list.innerHTML = deudores.map(d => {
        const dNum = parseFloat(d.debt);
        totalD += dNum;
        const link = `${URL_SISTEMA}/pago.html?estudiante=${d.id}&monto=${dNum}`;
        const msg = encodeURIComponent(`Hola ${d.representante}, desde Chela Sport te recordamos el saldo de $${dNum.toFixed(2)} por los uniformes de ${d.name}. Link de Pago Móvil: ${link}`);
        
        return `
        <li class="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900 hover:bg-slate-800/80 transition-colors">
            <div class="flex-1 pr-2">
                <p class="text-[10px] font-black uppercase text-white truncate">${d.name}</p>
                <p class="text-[9px] text-slate-400 truncate">Rep: ${d.representante}</p>
            </div>
            <div class="flex items-center gap-2">
                <span class="font-black text-red-400 text-sm mr-2">$${dNum.toFixed(2)}</span>
                
                <button onclick="abrirModalAbono(${d.id}, '${d.name}', ${dNum})" class="bg-indigo-600 text-white w-8 h-8 rounded-full flex justify-center items-center active:scale-90 shadow-lg shadow-indigo-900/50">
                    <i class="fa-solid fa-hand-holding-dollar text-[10px]"></i>
                </button>

                <button onclick="window.open('https://wa.me/${d.phone}?text=${msg}')" class="bg-emerald-600 text-white w-8 h-8 rounded-full flex justify-center items-center active:scale-90 shadow-lg shadow-emerald-900/50">
                    <i class="fa-brands fa-whatsapp text-[12px]"></i>
                </button>
            </div>
        </li>`;
    }).join('');
    
    if(globalEl) globalEl.innerText = `$${totalD.toFixed(2)}`;
}

function abrirModalAbono(id, nombre, deuda) {
    abonoTemporal = { id, deudaMax: deuda };
    const modalHtml = `
        <div id="temp-modal-abono" class="fixed inset-0 z-[60] bg-slate-950/90 backdrop-blur-sm p-4 flex flex-col justify-end pb-10 transition-all">
            <div class="bg-slate-900 w-full rounded-[2rem] border border-slate-800 p-6 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] relative">
                <button onclick="this.closest('#temp-modal-abono').remove()" class="absolute top-4 right-4 text-slate-400 p-2 active:scale-90 transition-transform"><i class="fa-solid fa-xmark text-xl"></i></button>
                
                <h3 class="text-white font-black uppercase text-center mb-6 text-sm tracking-widest mt-2">Abono: ${nombre}</h3>
                
                <div class="bg-slate-950 p-4 rounded-2xl mb-6 border border-slate-800 text-center">
                    <p class="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Deuda Pendiente</p>
                    <p class="text-3xl font-black text-red-500">$${deuda.toFixed(2)}</p>
                </div>

                <div class="space-y-4">
                    <div>
                        <label class="text-[10px] text-slate-400 uppercase font-black tracking-widest ml-2">Monto a Abonar ($)</label>
                        <input type="number" id="input-monto-pago" step="0.01" inputmode="decimal" max="${deuda}" value="${deuda}" class="w-full bg-slate-950 border border-slate-800 text-emerald-400 p-4 rounded-2xl font-black text-xl outline-none focus:border-emerald-500 text-center mt-1 transition-colors">
                    </div>

                    <div>
                        <label class="text-[10px] text-slate-400 uppercase font-black tracking-widest ml-2">Método Recibido</label>
                        <select id="select-metodo-pago" class="w-full bg-slate-950 border border-slate-800 text-white p-4 rounded-2xl outline-none font-bold text-sm mt-1 transition-colors">
                            <option value="EFECTIVO">Efectivo ($ o Bs)</option>
                            <option value="PUNTO">Punto de Venta</option>
                            <option value="PAGO_MOVIL">Pago Móvil (Ya Verificado)</option>
                        </select>
                    </div>

                    <button onclick="confirmarAbono()" id="btn-confirma-abono" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-[11px] mt-4 active:scale-95 transition-transform shadow-lg shadow-emerald-900/50">
                        Confirmar Abono
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function confirmarAbono() {
    const btn = document.getElementById('btn-confirma-abono');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando...';
    btn.disabled = true;
    
    const monto = parseFloat(document.getElementById('input-monto-pago').value);
    const metodo = document.getElementById('select-metodo-pago').value;
    
    if (isNaN(monto) || monto <= 0 || monto > abonoTemporal.deudaMax + 0.01) {
        alert("El monto ingresado es inválido o supera la deuda.");
        btn.innerHTML = 'Confirmar Abono';
        btn.disabled = false;
        return;
    }

    try {
        const nuevaDeuda = abonoTemporal.deudaMax - monto;
        
        await _sb.from('estudiantes').update({ debt: nuevaDeuda }).eq('id', abonoTemporal.id);
        
        await _sb.from('ventas').insert([{
            id_orden: `ABO-${Date.now().toString().slice(-6)}`,
            total_usd: monto, 
            metodo_pago: metodo, 
            status: 'completado', 
            ganancia_total: monto,
            items: [{ name: "ABONO DE DEUDA", qty: 1, price: monto }]
        }]);

        alert(`¡Abono registrado! Saldo Restante: $${nuevaDeuda.toFixed(2)}`);
        document.getElementById('temp-modal-abono').remove();
        sync(); 
    } catch (e) { 
        alert("Error: " + e.message); 
        btn.innerHTML = 'Confirmar Abono';
        btn.disabled = false;
    }
}

// ==========================================
// 6. MÓDULO ADMINISTRATIVO (admin.html)
// ==========================================
async function renderDashboard() {
    const hoy = new Date().toISOString().split('T')[0];
    const { data: sales } = await _sb.from('ventas').select('total_usd, created_at').gte('created_at', hoy);
    
    let total = sales ? sales.reduce((s, v) => s + parseFloat(v.total_usd), 0) : 0;
    
    const statEl = document.getElementById('stat-tw-total');
    if(statEl) statEl.innerText = `$${total.toFixed(2)}`;
}
async function procesarTransaccion(method, estudianteId = null) {
    let total = state.cart.reduce((s, i) => s + (i.price * i.qty), 0);
    let ganancia = state.cart.reduce((s, i) => s + ((i.price - (i.cost || 0)) * i.qty), 0);
    const idOrden = 'ORD-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    
    let nombreEstudiante = null;
    let statusVenta = 'completado'; // Por defecto completado

    // --- LÓGICA DE CRÉDITO Y BLOQUEOS ---
    if (estudianteId) {
        const est = state.estudiantes.find(e => e.id === estudianteId);
        if (est) nombreEstudiante = est.name;

        if (method === 'CREDITO') {
            if (est && est.bloqueado) {
                // EXCEPCIÓN HUMANITARIA: Solo agua
                const soloLlevaAgua = state.cart.every(item => 
                    item.name.toLowerCase().includes('agua') || 
                    item.categoria?.toLowerCase() === 'agua'
                );

                if (!soloLlevaAgua) {
                    return alert(`❌ VENTA BLOQUEADA\n\nEl representante de ${est.name} está bloqueado. Solo puede retirar AGUA.`);
                }
            }

            // Validación de Límite
            const recargo = total * 0.10;
            const deudaNueva = parseFloat(est.debt || 0) + total + recargo;
            if (deudaNueva > parseFloat(est.limite_credito || 100)) {
                return alert(`❌ LÍMITE EXCEDIDO\n\nDisponible: $${est.limite_credito}. Esta compra suma $${(total+recargo).toFixed(2)}`);
            }

            total += recargo;
            ganancia += recargo;
        }
    }

    // Si es Pago Móvil, pasa a verificación
    if (method.includes('PAGO_MOVIL')) {
        statusVenta = 'pendiente_verificacion';
    }

    try {
        // 1. REGISTRAR VENTA
        const { error: errVenta } = await _sb.from('ventas').insert([{ 
            id_orden: idOrden, 
            total_usd: total, 
            metodo_pago: method, 
            items: state.cart, 
            ganancia_total: ganancia, 
            status: statusVenta,
            estudiante_nombre: nombreEstudiante // CRÍTICO: Para el Verificador
        }]);

        if (errVenta) throw errVenta;

        // 2. ACTUALIZAR STOCK
        for(const i of state.cart) {
            const p = state.products.find(x => x.id === i.id);
            await _sb.from('productos').update({ stock: p.stock - i.qty }).eq('id', i.id);
        }

        // 3. ACTUALIZAR DEUDA (SOLO SI ES CRÉDITO)
        if (method === 'CREDITO' && estudianteId) {
            const est = state.estudiantes.find(e => e.id === estudianteId);
            await _sb.from('estudiantes').update({ debt: parseFloat(est.debt) + total }).eq('id', estudianteId);
            alert(`✅ Crédito cargado a ${est.name}`);
            document.getElementById('modal-seleccion-credito')?.remove();
        } else if (statusVenta === 'pendiente_verificacion') {
            alert("⏳ Pago enviado a Verificación. Avisa al administrador.");
        } else {
            alert("Venta procesada con éxito ✅");
        }
        
        cerrarCarrito();
        clearCart(); 
        sync();
    } catch (e) { 
        console.error("Error en transacción:", e);
        alert("Error al procesar: " + e.message); 
    }
}
async function cobranzaMasiva() {
    const deudores = state.estudiantes.filter(e => parseFloat(e.debt) > 0);
    
    if (deudores.length === 0) {
        return alert("¡Excelente! No hay cuentas por cobrar pendientes. 🎉");
    }

    if (!confirm(`Se enviarán avisos de cobro a ${deudores.length} representantes. ¿Estás seguro?`)) return;

    for (let i = 0; i < deudores.length; i++) {
        const d = deudores[i];
        const monto = parseFloat(d.debt).toFixed(2);
        const link = `${URL_SISTEMA}/pago.html?estudiante=${d.id}&monto=${monto}`;
        const msg = encodeURIComponent(`*AVISO - CHELA SPORT* 🏦\n\nHola ${d.representante}, te recordamos que ${d.name} tiene un saldo pendiente de *$${monto}*.\n\nPuedes reportar tu pago aquí: ${link}`);
        
        const urlWa = `https://wa.me/${d.phone}?text=${msg}`;
        
        setTimeout(() => { window.open(urlWa, '_blank'); }, i * 1500); 
    }
    
    alert("Procesando ventanas de WhatsApp. Asegúrate de dar 'Enviar' en cada una.");
}