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
        console.log("Usuario detectado:", user.email);
        
        // Comparamos correos en minúsculas para evitar errores de dedo
        const esAdmin = user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
        state.userRole = esAdmin ? 'admin' : 'vendedor';
        
        console.log("Rol asignado:", state.userRole);

        document.getElementById('auth-screen')?.classList.add('view-hidden');
        document.getElementById('app-content')?.classList.remove('view-hidden');

        if(state.userRole === 'admin') {
            // Usamos Optional Chaining (?.) por si el elemento no existe en el DOM aún
            document.getElementById('btn-gestion')?.classList.remove('view-hidden');
            document.getElementById('btn-dashboard')?.classList.remove('view-hidden');
            document.getElementById('btn-contador')?.classList.remove('view-hidden');
            
            console.log("Botones de Admin activados ✅");
        }
        
        initApp();
    } else {
        document.getElementById('auth-screen')?.classList.remove('view-hidden');
        document.getElementById('app-content')?.classList.add('view-hidden');
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
let categoriaActual = 'Todos';

function filtrar(categoria) {
    categoriaActual = categoria;
    renderProducts();
}

function renderProducts() {
    const grid = document.getElementById('grid-productos');
    if (!grid) return;
    
    const search = document.getElementById('search').value.toLowerCase();
    
    // Filtramos primero por categoría y luego por búsqueda
    let productosFiltrados = state.products;
    
    if (categoriaActual !== 'Todos') {
        // Asumiendo que guardaste la categoría en Supabase como 'Uniformes' o 'Chucherias'
        productosFiltrados = productosFiltrados.filter(p => p.categoria === categoriaActual);
    }
    
    productosFiltrados = productosFiltrados.filter(p => p.name.toLowerCase().includes(search));

    grid.innerHTML = productosFiltrados.map(p => {
        const foto = p.image_url ? p.image_url : 'https://placehold.co/400x400/1e293b/4f46e5?text=Sin+Foto';
        const categoriaLabel = p.categoria || 'General';
        
        return `
        <div onclick="addToCart(${p.id})" class="bg-slate-800 rounded-[2.5rem] p-4 border border-slate-700 shadow-xl flex flex-col items-center text-center cursor-pointer active:scale-95 transition-transform hover:border-indigo-500">
            <div class="w-full aspect-square rounded-[2rem] overflow-hidden mb-3 bg-slate-900 border border-slate-700/50">
                <img src="${foto}" alt="${p.name}" class="w-full h-full object-cover">
            </div>
            
            <span class="text-[9px] uppercase tracking-widest text-indigo-400 font-black mb-1 px-2 py-0.5 bg-indigo-900/30 rounded-full">
                ${categoriaLabel}
            </span>
            
            <h3 class="text-[11px] font-bold text-slate-200 leading-tight h-8 overflow-hidden mb-3 w-full px-1">
                ${p.name}
            </h3>
            
            <div class="bg-slate-900 border border-slate-700 w-full py-2 rounded-[1.5rem] mt-auto">
                <span class="text-emerald-400 font-mono font-black text-sm">$${parseFloat(p.price).toFixed(2)}</span>
            </div>
            
            <div class="absolute top-2 right-2 ${p.stock < 5 ? 'bg-red-500' : 'bg-slate-900/80 backdrop-blur-sm'} text-white text-[8px] font-black px-2 py-1 rounded-full border border-slate-700">
                Stock: ${p.stock}
            </div>
        </div>
        `;
    }).join('');
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
async function pay(metodo) {
    const total = parseFloat(document.getElementById('total-usd').innerText.replace('$', ''));
    if (total <= 0) return;

    // Ahora incluimos CREDITO en la lista de espera
    const requiereVerificacion = ['BS', 'PUNTO', 'CREDITO'].includes(metodo);
    const statusInicial = requiereVerificacion ? 'pendiente_verificacion' : 'completada';

    const nuevaVenta = {
        total_usd: total,
        metodo_pago: metodo,
        items: state.cart,
        status: statusInicial,
        // Si es crédito, aquí deberías tener guardado el ID del estudiante del modal
        estudiante_id: metodo === 'CREDITO' ? state.selectedStudent.id : null, 
        fecha: new Date().toISOString()
    };

    const { error } = await _sb.from('ventas').insert([nuevaVenta]);
    
    if (!error) {
        if (statusInicial === 'pendiente_verificacion') {
            const msj = metodo === 'CREDITO' ? 
                "Crédito enviado a revisión. El administrador debe autorizarlo. 🛡️" : 
                "Pago enviado a verificación. ⏳";
            alert(msj);
        } else {
            alert("Venta completada ✅");
        }
        state.cart = [];
        renderCart();
        initApp();
    }
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
// --- LOGÍSTICA Y FOTOS ---
// --- LOGÍSTICA Y FOTOS (CON DRAG & DROP) ---
// --- LOGÍSTICA Y FOTOS (CON DRAG & DROP Y MODO ADMIN) ---
function renderStock() {
    const table = document.getElementById('stock-table');
    if(!table) return;
    
    table.innerHTML = state.products.map(p => {
        // Validación: El botón de editar solo se inyecta si el usuario es Admin
        const btnEditarAdmin = state.userRole === 'admin' 
            ? `<button onclick="editarProductoAdmin(${p.id})" class="text-blue-500 hover:bg-blue-100 p-2 rounded-lg transition-all mr-1" title="Editar Nombre y Stock">
                  <i class="fa-solid fa-pen-to-square"></i>
               </button>` 
            : '';

        return `
        <tr class="text-[11px] font-bold text-slate-700 border-b border-slate-100 hover:bg-slate-50 transition-colors">
            <td class="p-4">
                <div class="uppercase text-slate-800">${p.name}</div>
                <div class="text-[9px] text-slate-400">${p.categoria || 'General'}</div>
            </td>
            <td class="p-4 text-center font-mono text-sm ${p.stock < 10 ? 'text-red-500' : 'text-slate-800'}">
                ${p.stock}
            </td>
            <td class="p-4 text-right whitespace-nowrap">
                <label 
                    id="drop-zone-${p.id}"
                    ondragover="allowDrop(event, ${p.id})"
                    ondragleave="leaveDrop(event, ${p.id})"
                    ondrop="dropFoto(event, ${p.id})"
                    class="cursor-pointer border-2 border-transparent bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-2 rounded-xl inline-block mr-2 transition-all">
                    <i class="fa-solid fa-camera"></i> ${p.image_url ? 'Cambiar' : 'Foto'}
                    <input type="file" accept="image/*" class="hidden" onchange="seleccionarFotoProducto(${p.id}, event)">
                </label>
                
                ${btnEditarAdmin}
                
                <button onclick="borrarProducto(${p.id})" class="text-red-400 hover:bg-red-50 p-2 rounded-lg transition-all">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
        </tr>
        `;
    }).join('');
}

// Función de Edición Rápida
async function editarProductoAdmin(id) {
    // Buscamos los datos actuales del producto
    const p = state.products.find(x => x.id === id);
    if (!p) return;

    // 1. Pedir nuevo nombre
    const nuevoNombre = prompt("✏️ Editar Nombre del Producto:", p.name);
    if (nuevoNombre === null || nuevoNombre.trim() === "") return; // Si cancela o deja vacío

    // 2. Pedir nueva cantidad (stock real)
    const nuevoStock = prompt(`📦 Editar Cantidad (Stock) actual de ${nuevoNombre}:`, p.stock);
    if (nuevoStock === null || nuevoStock.trim() === "") return; // Si cancela

    const stockFinal = parseInt(nuevoStock);
    if (isNaN(stockFinal)) return alert("❌ Error: La cantidad debe ser un número válido.");

    // 3. Enviar a Supabase
    try {
        const { error } = await _sb.from('productos').update({ 
            name: nuevoNombre.trim(), 
            stock: stockFinal 
        }).eq('id', id);

        if (error) throw error;
        
        alert("✅ Producto actualizado correctamente.");
        await sync(); // Recargamos todo el sistema
    } catch (err) {
        alert("Error al actualizar: " + err.message);
    }
}
// Eventos de arrastrar (Cambio visual al pasar por encima)
function allowDrop(ev, id) {
    ev.preventDefault();
    const el = document.getElementById(`drop-zone-${id}`);
    el.classList.add('border-indigo-500', 'border-dashed', 'bg-indigo-200');
    el.classList.remove('border-transparent');
}

function leaveDrop(ev, id) {
    ev.preventDefault();
    const el = document.getElementById(`drop-zone-${id}`);
    el.classList.remove('border-indigo-500', 'border-dashed', 'bg-indigo-200');
    el.classList.add('border-transparent');
}

// Función cuando sueltas la imagen arrastrada
async function dropFoto(ev, id) {
    ev.preventDefault();
    leaveDrop(ev, id); // Quitamos el estilo punteado
    
    const file = ev.dataTransfer.files[0];
    if(!file) return;
    
    const label = document.getElementById(`drop-zone-${id}`);
    await procesarSubida(id, file, label);
}

// Función cuando haces clic y seleccionas tradicionalmente
async function seleccionarFotoProducto(id, event) {
    const file = event.target.files[0];
    if(!file) return;
    
    const label = event.target.parentElement;
    await procesarSubida(id, file, label);
}

// El motor real que sube a Supabase
async function procesarSubida(id, file, labelElement) {
    const originalHtml = labelElement.innerHTML;
    labelElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Subiendo...';
    labelElement.classList.add('opacity-50', 'pointer-events-none');

    try {
        const name = `prod_${Date.now()}_${id}.jpg`;
        
        // 1. Subir a Storage
        const { error: uploadError } = await _sb.storage.from('fotos-productos').upload(name, file);
        if (uploadError) throw uploadError;

        // 2. Obtener URL
        const url = _sb.storage.from('fotos-productos').getPublicUrl(name).data.publicUrl;

        // 3. Actualizar tabla
        const { error: updateError } = await _sb.from('productos').update({ image_url: url }).eq('id', id);
        if (updateError) throw updateError;

        alert("Foto actualizada ✅");
        await sync(); // Recarga la tabla y la vista de ventas
    } catch (error) {
        alert("Error al subir foto: " + error.message);
        labelElement.innerHTML = originalHtml;
        labelElement.classList.remove('opacity-50', 'pointer-events-none');
    }
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
// --- MOTOR CONTABLE Y PREDICCIÓN ---
async function analizarTendenciaPago() {
    const historicalTasa = 45.30; // Aquí podrías jalar de una tabla 'historico_tasas'
    const actualTasa = state.tasa;
    const alerta = document.getElementById('pago-alerta');
    const texto = document.getElementById('recomendacion-texto');
    const icono = document.getElementById('tendencia-icono');

    // Lógica simple de fluctuación:
    if (actualTasa > historicalTasa) {
        // El Bolívar se devalúa: Conviene pagar facturas en Bs YA antes de que suba más.
        alerta.className = "bg-orange-600 p-6 rounded-[2rem] text-white flex justify-between items-center shadow-xl";
        texto.innerText = "Dólar al alza: Se recomienda liquidar facturas en Bs hoy.";
        icono.innerHTML = '<i class="fa-solid fa-arrow-trend-up"></i>';
    } else {
        alerta.className = "bg-emerald-600 p-6 rounded-[2rem] text-white flex justify-between items-center shadow-xl";
        texto.innerText = "Tasa estable: Momento óptimo para pagos programados.";
        icono.innerHTML = '<i class="fa-solid fa-check-double"></i>';
    }
}

async function calcularContabilidadTotal() {
    // 1. Obtener ventas del mes
    const { data: ventas } = await _sb.from('ventas').select('total_usd, ganancia_total');
    const totalVentas = ventas.reduce((s, v) => s + parseFloat(v.total_usd), 0);
    const utilidadBruta = ventas.reduce((s, v) => s + parseFloat(v.ganancia_total), 0);

    // 2. Obtener gastos fijos (Plan de Negocios Chela Sport: Alquiler, Servicios, Sueldos) 
    const costosFijos = 855; // Monto base según tu plan de negocios 
    
    document.getElementById('cont-ventas-brutas').innerText = `$${totalVentas.toFixed(2)}`;
    document.getElementById('cont-costos-var').innerText = `-$${(totalVentas - utilidadBruta).toFixed(2)}`;
    document.getElementById('cont-utilidad').innerText = `$${(utilidadBruta - costosFijos).toFixed(2)}`;
}
// ==========================================
// 7. ALGORITMO: LISTA DE COMPRAS INTELIGENTE (AGRUPADA)
// ==========================================
async function generarListaComprasWA() {
    const btn = document.getElementById('btn-wa-compras');
    if(btn) { 
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Procesando...'; 
        btn.disabled = true; 
    }

    try {
        // 1. Filtrar URGENTES (Stock <= 5)
        const bajoStock = state.products.filter(p => p.stock <= 5);
        
        // 1.5 AGRUPAR POR CATEGORÍA
        const faltantesPorCategoria = {};
        bajoStock.forEach(p => {
            const cat = p.categoria || 'Otros';
            if (!faltantesPorCategoria[cat]) faltantesPorCategoria[cat] = [];
            faltantesPorCategoria[cat].push(p);
        });

        // 2. Extraer historial completo de ventas
        const { data: ventas } = await _sb.from('ventas').select('items');
        let conteoVentas = {};
        
        if (ventas) {
            ventas.forEach(v => {
                const itemsVendidos = typeof v.items === 'string' ? JSON.parse(v.items) : v.items;
                if (itemsVendidos && itemsVendidos.length > 0) {
                    itemsVendidos.forEach(item => {
                        conteoVentas[item.name] = (conteoVentas[item.name] || 0) + item.qty;
                    });
                }
            });
        }

        // 3. Obtener el Top 5
        const topVentas = Object.entries(conteoVentas)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        // 4. Armar el mensaje para WhatsApp
        let mensaje = `*🛒 REPORTE DE COMPRAS INTELIGENTE - CHELA SPORT* 🚀\n\n`;
        mensaje += `*🔴 URGENTE: Bajo Stock*\n`;
        
        // Iterar sobre cada categoría y sus productos
        if (Object.keys(faltantesPorCategoria).length > 0) {
            for (const [categoria, productos] of Object.entries(faltantesPorCategoria)) {
                mensaje += `\n📁 *${categoria.toUpperCase()}*\n`;
                productos.forEach(p => {
                    mensaje += `  • ${p.name} _(Quedan: ${p.stock})_\n`;
                });
            }
        } else {
            mensaje += `\n• Todo el inventario está por encima del nivel crítico.\n`;
        }

        mensaje += `\n➖➖➖➖➖➖➖➖\n`;
        mensaje += `*🔥 TOP 5 MÁS VENDIDOS*\n\n`;
        
        if (topVentas.length > 0) {
            topVentas.forEach((v, index) => {
                // Buscar de qué categoría es el producto más vendido
                const prodInfo = state.products.find(p => p.name === v[0]);
                const catLabel = prodInfo && prodInfo.categoria ? `[${prodInfo.categoria}]` : '';
                
                mensaje += `${index + 1}. ${v[0]} ${catLabel} _(${v[1]} unid.)_\n`;
            });
        } else {
            mensaje += `• Aún no hay suficientes datos de ventas.\n`;
        }

        mensaje += `\n_Generado por Envolvia_ 🧠`;

        // 5. Disparar WhatsApp
        const urlWA = `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;
        window.open(urlWA, '_blank');

    } catch (error) {
        console.error(error);
        alert("Error al generar el reporte de compras.");
    } finally {
        if(btn) { 
            btn.innerHTML = '<i class="fa-brands fa-whatsapp text-sm mr-2"></i> Generar Lista'; 
            btn.disabled = false; 
        }
    }
}
function handleLogout() { _sb.auth.signOut(); location.reload(); }
function abrirModalCredito() { document.getElementById('modal-credito').classList.remove('view-hidden'); renderModalEstudiantes(); }
function cerrarModalCredito() { document.getElementById('modal-credito').classList.add('view-hidden'); }
function marcarImg(id, prefix) { document.querySelector(`#${prefix}${id} .fa-camera`).classList.replace('text-slate-400', 'text-emerald-500'); }

window.onload = checkUser;