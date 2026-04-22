// stock.js - Módulo de Inventario y Compras Inteligentes
const SB_URL = 'https://ekvzmfsdshyoeggudksm.supabase.co';
const SB_KEY = 'sb_publishable_Go6ZDuD9pg1pC3k-s89jiQ_65TEYGnd';
const _sb = supabase.createClient(SB_URL, SB_KEY);
const ADMIN_EMAIL = 'mauriciando1999@gmail.com';

let state = { products: [], userRole: 'vendedor' };
let filaContador = 0;

// ==========================================
// 1. INICIALIZACIÓN Y SEGURIDAD
// ==========================================
window.onload = async () => {
    const { data: { user } } = await _sb.auth.getUser();
    if(!user) return window.location.href = 'index.html';

    state.userRole = (user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) ? 'admin' : 'vendedor';
    if(state.userRole === 'admin') {
        document.getElementById('btn-dashboard').classList.remove('hidden');
        document.getElementById('btn-compras-ia').classList.remove('hidden'); // Muestra el botón robot
    }

    await getBCV();
    await syncStock();
};

async function getBCV() {
    try {
        const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
        const data = await res.json();
        const bcvEl = document.getElementById('bcv-val');
        if (data?.promedio && bcvEl) bcvEl.innerText = `BCV: ${parseFloat(data.promedio).toFixed(2)}`;
    } catch (e) { console.warn("Tasa BCV Falló"); }
}

async function syncStock() {
    const { data } = await _sb.from('productos').select('*').order('name');
    state.products = data || [];
    renderStock();
}

// ==========================================
// 2. RENDERIZAR INVENTARIO
// ==========================================
function renderStock() {
    const list = document.getElementById('stock-list');
    if(!list) return;
    
    const searchEl = document.getElementById('search-stock');
    const search = searchEl ? searchEl.value.toLowerCase() : '';
    
    // Filtra por nombre de producto o nombre del proveedor
    let prods = state.products.filter(p => 
        p.name.toLowerCase().includes(search) || 
        (p.proveedor && p.proveedor.toLowerCase().includes(search))
    );
    
    list.innerHTML = prods.map(p => {
        const imgPath = p.image_url || `https://placehold.co/200x200/0f172a/6366f1?text=${encodeURIComponent(p.name)}`;
        const nombreProveedor = p.proveedor || 'Sin Asignar';
        
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
                <p class="text-[11px] font-black uppercase text-slate-200 truncate leading-tight">${p.name}</p>
                <p class="text-[8px] text-indigo-400 font-bold truncate mt-0.5"><i class="fa-solid fa-truck text-[7px] mr-1"></i>${nombreProveedor}</p>
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

// ==========================================
// 3. FACTURA MÚLTIPLE (Ingreso de Mercancía)
// ==========================================
function abrirModalFactura() {
    document.getElementById('factura-filas').innerHTML = '';
    agregarFilaFactura(); 
    document.getElementById('modal-factura').classList.remove('hidden');
}

function cerrarModalFactura() { document.getElementById('modal-factura').classList.add('hidden'); }

function agregarFilaFactura() {
    filaContador++;
    const id = filaContador;
    const container = document.getElementById('factura-filas');
    
    // Muestra también el proveedor en el select para guiar a la vendedora
    const opcionesHTML = state.products.map(p => `<option value="${p.id}">${p.name} [${p.proveedor || 'S/A'}]</option>`).join('');

    const row = document.createElement('div');
    row.id = `factura-fila-${id}`;
    row.className = 'factura-item bg-slate-900 border border-slate-800 p-3 rounded-2xl flex items-center gap-2';
    
    row.innerHTML = `
        <div class="flex-1">
            <p class="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1 ml-1">Producto</p>
            <select class="f-prod w-full bg-slate-950 border border-slate-700 text-white p-2 rounded-xl outline-none font-bold text-[10px]">
                <option value="">Seleccione...</option>
                ${opcionesHTML}
            </select>
        </div>
        <div class="w-20">
            <p class="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1 text-center">Cant.</p>
            <input type="number" inputmode="numeric" class="f-qty w-full bg-slate-950 border border-slate-700 text-emerald-400 p-2 rounded-xl font-black text-sm outline-none focus:border-emerald-500 text-center" placeholder="0">
        </div>
        <button onclick="document.getElementById('factura-fila-${id}').remove()" class="mt-4 w-8 h-8 rounded-full bg-slate-950 text-red-500 border border-slate-800 flex justify-center items-center hover:bg-red-900/20 active:scale-90">
            <i class="fa-solid fa-trash text-xs"></i>
        </button>
    `;
    container.appendChild(row);
}

async function guardarFacturaMasiva() {
    const items = document.querySelectorAll('.factura-item');
    if(items.length === 0) return alert("Añade al menos un producto.");

    let actualizaciones = {}; 
    let errorValidacion = false;

    items.forEach(item => {
        const prodId = parseInt(item.querySelector('.f-prod').value);
        const qty = parseInt(item.querySelector('.f-qty').value);

        if (isNaN(prodId) || isNaN(qty) || qty <= 0) errorValidacion = true;
        else actualizaciones[prodId] = (actualizaciones[prodId] || 0) + qty;
    });

    if (errorValidacion) return alert("⚠️ Revisa los productos y cantidades.");

    const btn = document.getElementById('btn-save-factura');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Registrando...';
    btn.disabled = true;

    try {
        for (const [id, qtyToAdd] of Object.entries(actualizaciones)) {
            const prod = state.products.find(p => p.id == id);
            await _sb.from('productos').update({ stock: prod.stock + qtyToAdd }).eq('id', id);
        }
        alert("✅ Factura registrada con éxito.");
        cerrarModalFactura();
        syncStock(); 
    } catch (e) { alert("Error: " + e.message); }
    finally { btn.innerHTML = '<i class="fa-solid fa-check"></i> Procesar Factura'; btn.disabled = false; }
}

// ==========================================
// 4. EDICIÓN DEL ADMIN (Incluye Proveedor)
// ==========================================
function abrirModalEditar(id) {
    const p = state.products.find(x => x.id === id);
    if (!p) return;

    document.getElementById('edit-id').value = p.id;
    document.getElementById('edit-name').value = p.name;
    document.getElementById('edit-proveedor').value = p.proveedor && p.proveedor !== 'Sin Asignar' ? p.proveedor : '';
    document.getElementById('edit-price').value = parseFloat(p.price).toFixed(2);
    document.getElementById('edit-stock').value = p.stock;

    document.getElementById('modal-editar').classList.remove('hidden');
}

async function guardarEdicionAdmin() {
    const id = document.getElementById('edit-id').value;
    const nombre = document.getElementById('edit-name').value.trim();
    let proveedor = document.getElementById('edit-proveedor').value.trim();
    const precio = parseFloat(document.getElementById('edit-price').value);
    const stock = parseInt(document.getElementById('edit-stock').value);

    if (!nombre || isNaN(precio) || isNaN(stock)) return alert("⚠️ Verifica los datos.");
    if (!proveedor) proveedor = 'Sin Asignar'; // Default

    const btn = document.getElementById('btn-save-edit');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
    btn.disabled = true;

    try {
        await _sb.from('productos').update({ 
            name: nombre, 
            proveedor: proveedor,
            price: precio, 
            stock: stock 
        }).eq('id', id);

        alert("✅ Producto actualizado.");
        document.getElementById('modal-editar').classList.add('hidden');
        syncStock();
    } catch (e) { alert("Error: " + e.message); }
    finally { btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar Cambios'; btn.disabled = false; }
}

// ==========================================
// 5. ASISTENTE DE COMPRAS IA (Exportar Pedidos)
// ==========================================
function abrirModalCompras() {
    const contenedor = document.getElementById('lista-proveedores-ia');
    
    // 1. Filtrar productos en rojo (Stock <= 5)
    const urgentes = state.products.filter(p => p.stock <= 5);
    
    if (urgentes.length === 0) {
        contenedor.innerHTML = `<div class="bg-emerald-900/20 text-emerald-400 p-6 rounded-2xl text-center border border-emerald-500/30 font-bold text-xs uppercase tracking-widest"><i class="fa-solid fa-check-circle text-2xl mb-2 block"></i>Inventario Sano. No hay urgencias.</div>`;
        document.getElementById('modal-compras').classList.remove('hidden');
        return;
    }

    // 2. Agrupar los urgentes por Proveedor
    let pedidos = {};
    urgentes.forEach(p => {
        const prov = p.proveedor || 'Sin Asignar';
        if (!pedidos[prov]) pedidos[prov] = [];
        pedidos[prov].push(p);
    });

    // 3. Renderizar las tarjetas por proveedor
    contenedor.innerHTML = Object.keys(pedidos).map(proveedor => {
        const items = pedidos[proveedor];
        
        // Creamos la lista de texto para WhatsApp
        let mensaje = `*NUEVO PEDIDO - CHELA SPORT* 📦\n\nHola, necesito cotización para reponer los siguientes artículos:\n\n`;
        items.forEach(item => {
            mensaje += `▪️ ${item.name} (Actual: ${item.stock})\n`;
        });
        mensaje += `\nQuedo atento. ¡Gracias!`;
        
        const urlWa = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;

        return `
        <div class="bg-slate-900 p-4 rounded-2xl border border-slate-800">
            <div class="flex justify-between items-center mb-3">
                <h4 class="font-black uppercase text-xs text-white flex items-center gap-2"><i class="fa-solid fa-truck-fast text-indigo-500"></i> ${proveedor}</h4>
                <span class="bg-red-500 text-white px-2 py-0.5 rounded-md text-[9px] font-black">${items.length} urgentes</span>
            </div>
            <ul class="text-[10px] text-slate-400 space-y-1 mb-4 font-mono pl-1 border-l-2 border-slate-700 ml-2">
                ${items.map(i => `<li>- ${i.name}</li>`).join('')}
            </ul>
            <button onclick="window.open('${urlWa}', '_blank')" class="w-full bg-emerald-600 text-white py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 flex items-center justify-center gap-2">
                <i class="fa-brands fa-whatsapp text-sm"></i> Enviar Pedido
            </button>
        </div>
        `;
    }).join('');

    document.getElementById('modal-compras').classList.remove('hidden');
}