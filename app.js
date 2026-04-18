// app.js - El Cerebro de Envolvia (Versión Unificada 2026)
const SB_URL = 'https://ekvzmfsdshyoeggudksm.supabase.co';
const SB_KEY = 'sb_publishable_Go6ZDuD9pg1pC3k-s89jiQ_65TEYGnd';
const _sb = supabase.createClient(SB_URL, SB_KEY);

const ADMIN_EMAIL = 'mauriciando1999@gmail.com';
const URL_SISTEMA = 'https://appchela.vercel.app';
const state = { products: [], estudiantes: [], cart: [], tasa: 45.30, userRole: 'vendedor' };
let contadorFilas = 0;
let contadorRepo = 0;

// --- 1. INICIALIZACIÓN Y AUTH ---
async function initApp() { 
    await getBCV(); 
    await sync(); 
}

async function checkUser() {
    const { data: { user } } = await _sb.auth.getUser();
    if(user) {
        state.userRole = user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase() ? 'admin' : 'vendedor';
        document.getElementById('auth-screen')?.classList.add('view-hidden');
        document.getElementById('app-content')?.classList.remove('view-hidden');
        if(state.userRole === 'admin') {
            document.getElementById('btn-gestion')?.classList.remove('view-hidden');
            document.getElementById('btn-dashboard')?.classList.remove('view-hidden');
        }
        initApp();
    }
}

async function sync() {
    const [p, e] = await Promise.all([
        _sb.from('productos').select('*').order('name'),
        _sb.from('estudiantes').select('*').order('name')
    ]);
    state.products = p.data || [];
    state.estudiantes = e.data || [];
    
    renderProducts();
    renderStock();
    updateRepoSelect();
    if (state.userRole === 'admin') renderDashboard();
}

async function getBCV() {
    try {
        const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
        const data = await res.json();
        if (data && data.promedio) state.tasa = parseFloat(data.promedio);
    } catch (e) { console.warn("Fallo DolarAPI, usando tasa local."); }
    const bcvEl = document.getElementById('bcv-val');
    if(bcvEl) bcvEl.innerText = `BCV: ${state.tasa.toFixed(2)}`;
}

// --- 2. VENTA (POS) ---
function renderProducts() {
    const grid = document.getElementById('grid-productos');
    if(!grid) return;
    const search = document.getElementById('search').value.toLowerCase();
    grid.innerHTML = state.products.filter(p => p.name.toLowerCase().includes(search)).map(p => `
        <div onclick="addToCart(${p.id})" class="bg-slate-800 rounded-3xl overflow-hidden border border-slate-700 active:scale-95 transition-all cursor-pointer shadow-lg">
            <div class="h-24 w-full bg-slate-700 relative">
                ${p.image_url ? `<img src="${p.image_url}" class="w-full h-full object-cover">` : `<div class="flex h-full items-center justify-center text-slate-500"><i class="fa-solid fa-box text-2xl"></i></div>`}
            </div>
            <div class="p-3">
                <p class="text-[9px] font-black uppercase text-slate-300 truncate">${p.name}</p>
                <span class="text-emerald-400 font-mono font-bold text-xs">$${parseFloat(p.price).toFixed(2)}</span>
            </div>
        </div>
    `).join('');
}

function addToCart(id) {
    const p = state.products.find(x => x.id === id);
    if(p.stock <= 0) return alert("Producto Agotado");
    const inC = state.cart.find(x => x.id === id);
    if(inC) inC.qty++; else state.cart.push({...p, qty: 1});
    updateUI();
}

function updateUI() {
    const list = document.getElementById('cart-list');
    const total = state.cart.reduce((s, i) => s + (i.price * i.qty), 0);
    document.getElementById('total-usd').innerText = `$${total.toFixed(2)}`;
    document.getElementById('total-vef').innerText = `Bs. ${(total * state.tasa).toLocaleString('es-VE')}`;
    list.innerHTML = state.cart.map(i => `
        <div class="flex justify-between items-center bg-slate-900/50 p-3 rounded-2xl border border-slate-700 mb-2">
            <div class="flex-1 pr-2">
                <p class="text-[10px] font-black uppercase truncate text-slate-200">${i.name}</p>
                <p class="text-[8px] font-bold text-emerald-500">$${parseFloat(i.price).toFixed(2)} c/u</p>
            </div>
            <div class="flex items-center space-x-3">
                <span class="text-xs font-black text-indigo-400">x${i.qty}</span>
                <button onclick="removeFromCart(${i.id})" class="text-red-500"><i class="fa-solid fa-xmark"></i></button>
            </div>
        </div>
    `).join('');
}

function removeFromCart(id) { state.cart = state.cart.filter(x => x.id !== id); updateUI(); }
function clearCart() { state.cart = []; updateUI(); }

// --- 3. MOTOR DE PAGOS (CON +10% CRÉDITO) ---
async function pay(method) {
    if(state.cart.length === 0) return;
    if(method === 'CREDITO') return abrirModalCredito();
    procesarTransaccion(method, null);
}

async function procesarTransaccion(method, estudianteId) {
    let total = state.cart.reduce((s, i) => s + (i.price * i.qty), 0);
    let ganancia = state.cart.reduce((s, i) => s + ((i.price - (i.cost || 0)) * i.qty), 0);
    
    if (method === 'CREDITO') {
        const recargo = total * 0.10;
        total += recargo;
        ganancia += recargo;
    }

    const idOrden = 'ORD-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    const status = (method === 'BS') ? 'pendiente' : 'completado';

    try {
        await _sb.from('ventas').insert([{ id_orden: idOrden, total_usd: total, metodo_pago: method, items: state.cart, ganancia_total: ganancia, status: status }]);
        
        for(const i of state.cart) {
            const p = state.products.find(x => x.id === i.id);
            await _sb.from('productos').update({ stock: p.stock - i.qty }).eq('id', i.id);
        }

        if (method === 'CREDITO') {
            const est = state.estudiantes.find(e => e.id === estudianteId);
            await _sb.from('estudiantes').update({ debt: parseFloat(est.debt) + total }).eq('id', estudianteId);
            alert(`Crédito (+10%) asignado a ${est.name} ✅`);
            cerrarModalCredito();
        } else if (method === 'BS') {
            prompt("Link para el cliente:", `${URL_SISTEMA}/pago.html?orden=${idOrden}`);
        } else {
            alert("Venta Exitosa ✅");
        }
        clearCart(); sync();
    } catch (e) { alert("Error: " + e.message); }
}

// --- 4. CARGA MASIVA (MARGEN 30% Y REDONDEO) ---
function agregarFilaProducto() {
    contadorFilas++;
    const id = contadorFilas;
    const container = document.getElementById('contenedor-filas');
    if(!container) return;
    const row = document.createElement('div');
    row.id = `fila-prod-${id}`;
    row.className = 'bg-slate-50 p-4 rounded-2xl border border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-3 items-end mb-2 relative';
    row.innerHTML = `
        <div class="col-span-3"><label class="text-[8px] font-black uppercase text-slate-400">Producto</label><input type="text" id="p-name-${id}" required class="w-full bg-white border p-2 text-xs rounded-lg outline-none"></div>
        <div class="col-span-1"><label class="text-[8px] font-black uppercase text-slate-400">Packs</label><input type="number" id="p-packs-${id}" oninput="calcularLote(${id})" class="w-full border p-2 text-xs rounded-lg outline-none"></div>
        <div class="col-span-1"><label class="text-[8px] font-black uppercase text-slate-400">U/Pack</label><input type="number" id="p-upack-${id}" oninput="calcularLote(${id})" class="w-full border p-2 text-xs rounded-lg outline-none"></div>
        <div class="col-span-1"><label class="text-[8px] font-black uppercase text-slate-400">Total</label><input type="number" id="p-stock-${id}" readonly class="w-full bg-slate-200 p-2 text-xs rounded-lg font-black text-indigo-600"></div>
        <div class="col-span-2"><label class="text-[8px] font-black uppercase text-slate-400">Costo Pack $</label><input type="number" step="0.01" id="p-cost-pack-${id}" oninput="calcularLote(${id})" class="w-full border p-2 text-xs rounded-lg outline-none"></div>
        <div class="col-span-2"><label class="text-[8px] font-black uppercase text-emerald-600">Venta Sugerida</label><input type="number" id="p-price-${id}" required class="w-full bg-emerald-50 border-emerald-200 p-2 text-sm font-black text-emerald-700 rounded-lg outline-none"></div>
        <div class="col-span-1 flex justify-center"><label class="cursor-pointer text-slate-400"><i class="fa-solid fa-camera text-xl"></i><input type="file" id="p-img-${id}" accept="image/*" class="hidden" onchange="marcarImg(${id}, 'fila-prod-')"></label></div>
        <button type="button" onclick="document.getElementById('fila-prod-${id}').remove()" class="absolute -top-2 -right-2 bg-red-500 text-white w-5 h-5 rounded-full text-[10px]">&times;</button>
    `;
    container.appendChild(row);
}

function calcularLote(id) {
    const packs = parseFloat(document.getElementById(`p-packs-${id}`).value) || 0;
    const uPack = parseFloat(document.getElementById(`p-upack-${id}`).value) || 0;
    const costPack = parseFloat(document.getElementById(`p-cost-pack-${id}`).value) || 0;
    const totalU = packs * uPack;
    document.getElementById(`p-stock-${id}`).value = totalU;
    if (totalU > 0 && costPack > 0) {
        const costUnit = (costPack * packs) / totalU;
        document.getElementById(`p-price-${id}`).value = Math.ceil(costUnit * 1.30);
    }
}

async function guardarProductosMasivo(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save-masivo');
    btn.disabled = true; btn.innerText = "PROCESANDO...";
    const filas = document.querySelectorAll('[id^="fila-prod-"]');
    const lote = [];
    try {
        for (let f of filas) {
            const id = f.id.replace('fila-prod-', '');
            const fileInput = document.getElementById(`p-img-${id}`);
            let url = null;
            if(fileInput.files[0]) {
                const name = `prod_${Date.now()}_${id}.jpg`;
                await _sb.storage.from('fotos-productos').upload(name, fileInput.files[0]);
                url = _sb.storage.from('fotos-productos').getPublicUrl(name).data.publicUrl;
            }
            lote.push({
                name: document.getElementById(`p-name-${id}`).value,
                price: parseFloat(document.getElementById(`p-price-${id}`).value),
                cost: (parseFloat(document.getElementById(`p-cost-pack-${id}`).value) * parseFloat(document.getElementById(`p-packs-${id}`).value)) / parseFloat(document.getElementById(`p-stock-${id}`).value),
                stock: parseInt(document.getElementById(`p-stock-${id}`).value),
                image_url: url
            });
        }
        await _sb.from('productos').insert(lote);
        alert("Lote guardado con éxito ✅");
        location.reload();
    } catch (err) { alert(err.message); btn.disabled = false; }
}

// --- 5. REPOSICIÓN MASIVA ---
function agregarFilaRepo() {
    contadorRepo++;
    const id = contadorRepo;
    const container = document.getElementById('contenedor-repo');
    if(!container) return;
    const row = document.createElement('div');
    row.id = `fila-repo-${id}`;
    row.className = 'bg-slate-50 p-4 rounded-2xl border border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-3 items-end mb-2 relative';
    row.innerHTML = `
        <div class="col-span-5"><label class="text-[8px] font-black uppercase text-slate-400">Producto</label><select id="r-select-${id}" required class="w-full bg-white border p-2 text-xs rounded-lg font-bold">${state.products.map(p => `<option value="${p.id}">${p.name} (${p.stock})</option>`).join('')}</select></div>
        <div class="col-span-2"><label class="text-[8px] font-black uppercase text-slate-400">Packs</label><input type="number" id="r-packs-${id}" oninput="calcRepo(${id})" class="w-full border p-2 text-xs rounded-lg"></div>
        <div class="col-span-2"><label class="text-[8px] font-black uppercase text-slate-400">U/Pack</label><input type="number" id="r-upack-${id}" oninput="calcRepo(${id})" class="w-full border p-2 text-xs rounded-lg"></div>
        <div class="col-span-2"><label class="text-[8px] font-black uppercase text-indigo-600">A Sumar</label><input type="number" id="r-total-${id}" readonly class="w-full bg-indigo-50 p-2 text-xs rounded-lg font-black text-indigo-700"></div>
        <button type="button" onclick="document.getElementById('fila-repo-${id}').remove()" class="col-span-1 text-red-400 pb-2"><i class="fa-solid fa-trash"></i></button>
    `;
    container.appendChild(row);
}

function calcRepo(id) {
    const p = parseFloat(document.getElementById(`r-packs-${id}`).value) || 0;
    const u = parseFloat(document.getElementById(`r-upack-${id}`).value) || 0;
    document.getElementById(`r-total-${id}`).value = p * u;
}

async function guardarReposicionMasiva(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save-repo');
    btn.disabled = true; btn.innerText = "ACTUALIZANDO...";
    const filas = document.querySelectorAll('[id^="fila-repo-"]');
    try {
        for (let f of filas) {
            const id = f.id.replace('fila-repo-', '');
            const prodId = document.getElementById(`r-select-${id}`).value;
            const suma = parseInt(document.getElementById(`r-total-${id}`).value);
            if (prodId && suma > 0) {
                const pActual = state.products.find(x => x.id == prodId);
                await _sb.from('productos').update({ stock: pActual.stock + suma }).eq('id', prodId);
            }
        }
        alert("Inventario actualizado ✅");
        location.reload();
    } catch (err) { alert(err.message); btn.disabled = false; }
}

// --- 6. LOGÍSTICA, DASHBOARD Y OTROS ---
function renderStock() {
    const table = document.getElementById('stock-table');
    if(!table) return;
    table.innerHTML = state.products.map(p => `
        <tr class="text-[11px] font-bold text-slate-700 border-b border-slate-100">
            <td class="p-4 uppercase">${p.name}</td>
            <td class="p-4 text-center font-mono ${p.stock < 10 ? 'text-red-500' : 'text-slate-800'}">${p.stock}</td>
            <td class="p-4 text-center"><button onclick="borrarProducto(${p.id})" class="text-red-400"><i class="fa-solid fa-trash-can"></i></button></td>
        </tr>
    `).join('');
}

async function borrarProducto(id) {
    if(!confirm("¿Borrar permanentemente?")) return;
    await _sb.from('productos').delete().eq('id', id);
    sync();
}

function updateRepoSelect() { 
    const repoArea = document.getElementById('contenedor-repo');
    if(repoArea && repoArea.children.length === 0) agregarFilaRepo();
}

async function renderDashboard() {
    const { data: sales } = await _sb.from('ventas').select('*').order('created_at', { ascending: false });
    let stats = { usd: 0, bs: 0, punto: 0, cred: 0, total: 0 };
    if(sales) {
        sales.forEach(v => {
            const amt = parseFloat(v.total_usd);
            if(v.metodo_pago === 'USD') stats.usd += amt;
            if(v.metodo_pago === 'BS') stats.bs += amt;
            if(v.metodo_pago === 'PUNTO') stats.punto += amt;
            if(v.metodo_pago === 'CREDITO') stats.cred += amt;
            if(v.metodo_pago !== 'CREDITO') stats.total += amt;
        });
    }
    document.getElementById('stat-tw-usd').innerText = `$${stats.usd.toFixed(2)}`;
    document.getElementById('stat-tw-punto').innerText = `$${stats.punto.toFixed(2)}`;
    document.getElementById('stat-tw-bs').innerText = `$${stats.bs.toFixed(2)}`;
    document.getElementById('stat-tw-cred').innerText = `$${stats.cred.toFixed(2)}`;
    document.getElementById('stat-tw-total').innerText = `$${stats.total.toFixed(2)}`;
    renderDeudores();
}

function renderDeudores() {
    const list = document.getElementById('lista-deudores');
    if(!list) return;
    const deudores = state.estudiantes.filter(e => parseFloat(e.debt) > 0);
    let totalD = 0;
    list.innerHTML = deudores.map(d => {
        totalD += parseFloat(d.debt);
        const link = `${URL_SISTEMA}/pago.html?estudiante=${d.id}&monto=${d.debt}`;
        const msg = encodeURIComponent(`Hola ${d.representante}, recordamos la deuda de $${parseFloat(d.debt).toFixed(2)} de ${d.name}. Link: ${link}`);
        return `<li class="p-4 flex justify-between items-center border-b border-slate-100">
            <div><p class="text-xs font-black uppercase text-slate-800">${d.name}</p><p class="text-[9px] text-slate-500">Rep: ${d.representante}</p></div>
            <div class="flex items-center space-x-3"><span class="font-black text-red-500">$${parseFloat(d.debt).toFixed(2)}</span>
            <button onclick="window.open('https://wa.me/${d.phone}?text=${msg}')" class="bg-emerald-500 text-white p-2 rounded-full"><i class="fa-brands fa-whatsapp"></i></button></div>
        </li>`;
    }).join('');
    document.getElementById('total-deuda-global').innerText = `$${totalD.toFixed(2)}`;
}

async function guardarEstudiante(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save-est');
    btn.innerText = "PROCESANDO..."; btn.disabled = true;
    const file = document.getElementById('e-image').files[0];
    let url = null;
    if(file) {
        const name = `est_${Date.now()}.jpg`;
        await _sb.storage.from('fotos-productos').upload(name, file);
        url = _sb.storage.from('fotos-productos').getPublicUrl(name).data.publicUrl;
    }
    await _sb.from('estudiantes').insert([{ name: document.getElementById('e-name').value, representante: document.getElementById('e-rep').value, phone: document.getElementById('e-phone').value, photo_url: url, debt: 0 }]);
    alert("Estudiante autorizado ✅"); sync(); btn.innerText = "AUTORIZAR CRÉDITO"; btn.disabled = false; e.target.reset();
}

function renderModalEstudiantes() {
    const grid = document.getElementById('grid-estudiantes-modal');
    if(!grid) return;
    const search = document.getElementById('search-student').value.toLowerCase();
    grid.innerHTML = state.estudiantes.filter(e => e.name.toLowerCase().includes(search)).map(e => `
        <div onclick="procesarTransaccion('CREDITO', ${e.id})" class="bg-slate-800 p-3 rounded-2xl text-center border border-slate-700 cursor-pointer hover:border-indigo-500">
            <img src="${e.photo_url || ''}" class="w-16 h-16 rounded-full mx-auto mb-2 object-cover bg-slate-700">
            <p class="text-[10px] font-black text-white uppercase">${e.name}</p>
        </div>
    `).join('');
}

function switchView(view) {
    document.querySelectorAll('main').forEach(m => m.classList.add('view-hidden'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active-tab'));
    document.getElementById(`view-${view}`).classList.remove('view-hidden');
    document.getElementById(`btn-${view}`)?.classList.add('active-tab');
    if(view === 'dashboard') renderDashboard();
}

async function handleLogin(e) {
    e.preventDefault();
    const { error } = await _sb.auth.signInWithPassword({ email: document.getElementById('login-email').value, password: document.getElementById('login-pass').value });
    if(error) alert(error.message); else checkUser();
}
// --- SISTEMA DE COBRANZA MASIVA ---
async function cobranzaMasiva() {
    const deudores = state.estudiantes.filter(e => parseFloat(e.debt) > 0);
    
    if (deudores.length === 0) {
        return alert("¡Felicidades! No tienes deudores actualmente. 🎉");
    }

    if (!confirm(`Estás por enviar mensajes de cobro a ${deudores.length} representantes. ¿Proceder?`)) return;

    // Recorremos los deudores
    for (let i = 0; i < deudores.length; i++) {
        const d = deudores[i];
        const monto = parseFloat(d.debt).toFixed(2);
        const link = `${URL_SISTEMA}/pago.html?estudiante=${d.id}&monto=${monto}`;
        const msg = encodeURIComponent(`*AVISO DE COBRANZA - ENVOLVIA* 🏦\n\nHola ${d.representante}, esperamos que estés bien. Te recordamos que ${d.name} mantiene un saldo pendiente de *$${monto}*.\n\nPuedes reportar tu pago móvil aquí: ${link}\n\n_Gracias por tu responsabilidad._`);
        
        // Abrimos el chat (El navegador bloqueará popups si son muchos, 
        // así que los abrimos con un pequeño delay o pedimos permiso)
        const urlWa = `https://wa.me/${d.phone}?text=${msg}`;
        
        // Opción segura: Abrir uno por uno con un pequeño retraso
        setTimeout(() => {
            window.open(urlWa, '_blank');
        }, i * 1500); // 1.5 segundos entre cada uno para que WhatsApp no se bloquee
    }
    
    alert("Se están abriendo las ventanas de chat. Por favor, dales a 'Enviar' en cada una.");
}
function handleLogout() { _sb.auth.signOut(); location.reload(); }
function abrirModalCredito() { document.getElementById('modal-credito').classList.remove('view-hidden'); renderModalEstudiantes(); }
function cerrarModalCredito() { document.getElementById('modal-credito').classList.add('view-hidden'); }
function marcarImg(id, prefix) { document.querySelector(`#${prefix}${id} .fa-camera`).classList.replace('text-slate-400', 'text-emerald-500'); }

window.onload = checkUser;