// stock.js - Módulo de Inventario y Compras Inteligentes (VERSIÓN COMPLETA)
// Nota: Las constantes _sb, ADMIN_EMAIL, SB_URL, etc., ya vienen cargadas desde config.js

let state = { products: [], userRole: 'vendedor' };
let filaContador = 0;

// ==========================================
// 1. INICIALIZACIÓN Y SEGURIDAD
// ==========================================
window.onload = async () => {
    if (typeof _sb === 'undefined') return alert("Error CRÍTICO: config.js no está cargando Supabase.");

    const { data: { user }, error } = await _sb.auth.getUser();
    if(error || !user) return window.location.href = 'index.html';

    state.userRole = (user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) ? 'admin' : 'vendedor';
    
    if(state.userRole === 'admin') {
        document.getElementById('btn-dashboard')?.classList.remove('hidden');
        document.getElementById('btn-admin')?.classList.remove('hidden');
        document.getElementById('btn-compras-ia')?.classList.remove('hidden');
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
    try {
        const { data, error } = await _sb.from('productos').select('*').order('name');
        if (error) throw error;
        state.products = data || [];
        renderStock();
    } catch (e) {
        console.error("Error al cargar inventario:", e);
    }
}

// ==========================================
// 2. RENDERIZAR INVENTARIO
// ==========================================
window.renderStock = function() {
    const list = document.getElementById('stock-list');
    if(!list) return;
    
    const searchEl = document.getElementById('search-stock');
    const search = searchEl ? searchEl.value.toLowerCase() : '';
    
    let prods = state.products.filter(p => 
        (p.name || '').toLowerCase().includes(search) || 
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
window.abrirModalFactura = function() {
    const container = document.getElementById('factura-filas');
    const proveedoresUnicos = [...new Set(state.products.map(p => p.proveedor).filter(Boolean))];

    container.innerHTML = `
        <div class="bg-slate-950 p-3 rounded-xl border border-slate-800 mb-4 grid grid-cols-2 gap-3">
            <div>
                <label class="text-[9px] text-slate-500 uppercase font-black">Proveedor</label>
                <input type="text" id="fac-proveedor" list="proveedores-list" placeholder="Ej. Textilera C.A." class="w-full bg-slate-900 border border-slate-700 text-white p-2 rounded-lg text-xs outline-none focus:border-indigo-500 font-bold uppercase">
                <datalist id="proveedores-list">
                    ${proveedoresUnicos.map(prov => `<option value="${prov}"></option>`).join('')}
                </datalist>
            </div>
            <div>
                <label class="text-[9px] text-slate-500 uppercase font-black">N° Factura / Ref</label>
                <input type="text" id="fac-ref" placeholder="Opcional" class="w-full bg-slate-900 border border-slate-700 text-white p-2 rounded-lg text-xs outline-none focus:border-indigo-500 font-bold">
            </div>
        </div>
        <div id="filas-dinamicas" class="space-y-4"></div>
        <datalist id="prods-datalist">
            ${state.products.map(p => `<option value="${p.name}"></option>`).join('')}
        </datalist>
    `;
    
    filaContador = 0;
    agregarFilaFactura();
    document.getElementById('modal-factura').classList.remove('hidden');
}

window.cerrarModalFactura = function() { 
    document.getElementById('modal-factura').classList.add('hidden'); 
}

// Función auxiliar para cambiar la vista cuando eligen "Paquete"
window.togglePaquete = function(select) {
    const row = select.closest('.factura-item');
    const inputUndPaq = row.querySelector('.f-und-paq');
    const lblCant = row.querySelector('.lbl-cant');

    if(select.value === 'paquete') {
        inputUndPaq.disabled = false;
        inputUndPaq.classList.replace('text-slate-500', 'text-amber-400');
        if(!inputUndPaq.value || inputUndPaq.value === '1') inputUndPaq.value = ''; // Vacía para escribir
        lblCant.innerText = 'Paqs';
    } else {
        inputUndPaq.disabled = true;
        inputUndPaq.value = '1';
        inputUndPaq.classList.replace('text-amber-400', 'text-slate-500');
        lblCant.innerText = 'Unds';
    }
}

window.agregarFilaFactura = function() {
    filaContador++;
    const id = filaContador;
    const container = document.getElementById('filas-dinamicas');
    const row = document.createElement('div');
    row.id = `factura-fila-${id}`;
    row.className = 'factura-item bg-slate-900 border border-slate-800 p-3 rounded-2xl flex flex-col gap-2 relative';
    
    row.innerHTML = `
        <div class="w-full relative">
            <input type="text" list="prods-datalist" onchange="cargarDatosProducto(this)" class="f-nombre w-full bg-slate-950 border border-slate-700 text-white p-2 rounded-xl text-[11px] outline-none focus:border-indigo-500 font-bold uppercase" placeholder="BUSCAR O CREAR PRODUCTO...">
            <p class="info-producto text-[9px] text-indigo-400 font-bold mt-1 px-1 hidden"></p>
        </div>
        <div class="flex gap-2 w-full">
            <div class="flex-1">
                <p class="text-[8px] text-slate-500 uppercase font-black text-center mb-1">Tipo</p>
                <select onchange="togglePaquete(this)" class="f-tipo w-full bg-slate-950 border border-slate-700 text-indigo-300 p-2 rounded-xl text-[10px] font-black text-center outline-none uppercase">
                    <option value="unidad">Unidad</option>
                    <option value="paquete">Paquete</option>
                </select>
            </div>
            <div class="flex-1">
                <p class="text-[8px] text-slate-500 uppercase font-black text-center mb-1">Trae</p>
                <input type="number" class="f-und-paq w-full bg-slate-950 border border-slate-700 text-slate-500 p-2 rounded-xl text-[11px] font-black text-center outline-none disabled:opacity-40 disabled:bg-slate-900" placeholder="1" disabled value="1">
            </div>
            <div class="flex-1">
                <p class="text-[8px] text-slate-500 uppercase font-black text-center mb-1">Cant <span class="lbl-cant text-emerald-500">Unds</span></p>
                <input type="number" class="f-qty w-full bg-slate-950 border border-slate-700 text-emerald-400 p-2 rounded-xl text-[11px] font-black text-center outline-none" placeholder="0">
            </div>
            <div class="flex-1">
                <p class="text-[8px] text-slate-500 uppercase font-black text-center mb-1">Costo $</p>
                <input type="number" step="0.01" class="f-costo w-full bg-slate-950 border border-slate-700 text-red-400 p-2 rounded-xl text-[11px] font-black text-center outline-none" placeholder="0.00">
            </div>
            <button onclick="document.getElementById('factura-fila-${id}').remove()" class="absolute -right-2 -top-2 bg-red-500/20 border border-red-500 text-red-500 w-6 h-6 rounded-full flex items-center justify-center text-[10px] active:scale-90 transition-transform"><i class="fa-solid fa-xmark"></i></button>
        </div>
    `;
    container.appendChild(row);
}

window.cargarDatosProducto = function(input) {
    const nombre = input.value.trim().toUpperCase();
    const prod = state.products.find(p => p.name.toUpperCase() === nombre);
    const row = input.closest('.factura-item');
    const infoP = row.querySelector('.info-producto');
    const selectTipo = row.querySelector('.f-tipo');
    const inputUndPaq = row.querySelector('.f-und-paq');
    const inputCosto = row.querySelector('.f-costo');

    if (prod) {
        infoP.innerHTML = `P. Venta: $${parseFloat(prod.price).toFixed(2)} | Costo Unit Ant: $${parseFloat(prod.cost || 0).toFixed(2)}`;
        infoP.classList.remove('hidden');
        
        // AUTOCOMPLETADO INTELIGENTE
        if (prod.tipo_unidad === 'paquete') {
            selectTipo.value = 'paquete';
            inputUndPaq.value = prod.unidades_por_paquete || 1;
            
            // Si el costo está vacío, sugerimos el costo del paquete completo basado en la compra anterior
            if (!inputCosto.value && prod.cost) {
                inputCosto.value = (parseFloat(prod.cost) * parseInt(inputUndPaq.value)).toFixed(2);
            }
        } else {
            selectTipo.value = 'unidad';
            inputUndPaq.value = 1;
            if (!inputCosto.value) inputCosto.value = prod.cost || '';
        }
        togglePaquete(selectTipo); // Actualiza colores y bloqueos visuales
    } else {
        infoP.innerHTML = `✨ Producto Nuevo (Se registrará)`;
        infoP.classList.remove('hidden');
        selectTipo.value = 'unidad';
        togglePaquete(selectTipo);
    }
}

window.guardarFacturaMasiva = async function() {
    const items = document.querySelectorAll('.factura-item');
    if(items.length === 0) return alert("Añade al menos un producto.");
    
    const facProveedorEl = document.getElementById('fac-proveedor');
    const facRefEl = document.getElementById('fac-ref');
    const proveedor = (facProveedorEl ? facProveedorEl.value.trim() : '') || 'Proveedor Sin Nombre';
    const refFac = (facRefEl ? facRefEl.value.trim() : '') || `REC-${Date.now().toString().slice(-5)}`;
    
    let errorValidacion = false;
    let costoTotalFactura = 0;
    const btn = document.getElementById('btn-save-factura');
    
    // Validación
    items.forEach(item => {
        const nombre = item.querySelector('.f-nombre').value.trim();
        const qty = parseInt(item.querySelector('.f-qty').value);
        const undsPaq = parseInt(item.querySelector('.f-und-paq').value);
        const cost = parseFloat(item.querySelector('.f-costo').value);
        
        if (!nombre || isNaN(qty) || qty <= 0 || isNaN(cost) || isNaN(undsPaq) || undsPaq <= 0) {
            errorValidacion = true;
        }
    });

    if (errorValidacion) return alert("⚠️ Verifica que todos los campos (Nombre, Cantidad, Unidades por paquete y Costo) tengan valores válidos.");

    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Registrando...';
    btn.disabled = true;

    try {
        for (let item of items) {
            const name = item.querySelector('.f-nombre').value.trim().toUpperCase();
            const tipo = item.querySelector('.f-tipo').value;
            const undsPaq = parseInt(item.querySelector('.f-und-paq').value);
            const qtyComprada = parseInt(item.querySelector('.f-qty').value);
            const costoIngresado = parseFloat(item.querySelector('.f-costo').value);
            
            // LA MATEMÁTICA CLAVE:
            const stockAAgregar = tipo === 'paquete' ? (qtyComprada * undsPaq) : qtyComprada;
            const costoUnitarioReal = tipo === 'paquete' ? (costoIngresado / undsPaq) : costoIngresado;
            const costoTotalFila = costoIngresado * qtyComprada; // Costo ingresado es lo que pagó por el item (unidad o paquete)
            
            costoTotalFactura += costoTotalFila;

            const pExistente = state.products.find(p => p.name.toUpperCase() === name);

            if (pExistente) {
                // Actualiza stock, costo unitario, y recuerda el tipo de empaque
                await _sb.from('productos').update({ 
                    stock: pExistente.stock + stockAAgregar, 
                    cost: costoUnitarioReal,
                    tipo_unidad: tipo,
                    unidades_por_paquete: undsPaq,
                    proveedor: proveedor
                }).eq('id', pExistente.id);
            } else {
                // Inserta producto nuevo
                await _sb.from('productos').insert([{ 
                    name, 
                    stock: stockAAgregar, 
                    cost: costoUnitarioReal, 
                    price: costoUnitarioReal * 1.4, // Precio sugerido +40%
                    categoria: 'Nuevos',
                    tipo_unidad: tipo,
                    unidades_por_paquete: undsPaq,
                    proveedor: proveedor
                }]);
            }
        }

        // Crear cuenta por pagar para el Admin (STATUS PENDIENTE)
        if (costoTotalFactura > 0) {
            await _sb.from('facturas').insert([{
                proveedor: proveedor,
                concepto: `Factura Ref: ${refFac}`,
                monto_usd: costoTotalFactura,
                fecha_vencimiento: new Date().toISOString().split('T')[0],
                status: 'pendiente'
            }]);
        }

        alert(`✅ Stock guardado.\nFactura pendiente enviada a Admin por $${costoTotalFactura.toFixed(2)}`);
        cerrarModalFactura();
        syncStock();
    } catch (e) { 
        alert("Error: " + e.message); 
    } finally { 
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Procesar Factura'; 
        btn.disabled = false; 
    }
}

// ==========================================
// 4. EDICIÓN CON IMAGEN (Bucket: fotos-productos)
// ==========================================
window.previewImagen = function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = e => {
            document.getElementById('preview-img').src = e.target.result;
            document.getElementById('preview-img').classList.remove('hidden');
            document.getElementById('upload-ui').classList.add('hidden');
        };
        reader.readAsDataURL(file);
    }
}

window.abrirModalEditar = function(id) {
    const p = state.products.find(x => x.id === id);
    if (!p) return;
    document.getElementById('edit-id').value = p.id;
    document.getElementById('edit-name').value = p.name;
    document.getElementById('edit-proveedor').value = p.proveedor || '';
    document.getElementById('edit-price').value = p.price;
    document.getElementById('edit-stock').value = p.stock;
    document.getElementById('edit-image-url').value = p.image_url || '';
    
    const preview = document.getElementById('preview-img');
    const ui = document.getElementById('upload-ui');
    if (p.image_url) {
        preview.src = p.image_url;
        preview.classList.remove('hidden');
        ui.classList.add('hidden');
    } else {
        preview.classList.add('hidden');
        ui.classList.remove('hidden');
    }
    document.getElementById('modal-editar').classList.remove('hidden');
}

window.guardarEdicionAdmin = async function() {
    const id = document.getElementById('edit-id').value;
    const fileInput = document.getElementById('edit-file');
    const btn = document.getElementById('btn-save-edit');
    btn.disabled = true;

    try {
        let finalUrl = document.getElementById('edit-image-url').value;
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const fileName = `prod_${Date.now()}.${file.name.split('.').pop()}`;
            const { error: upErr } = await _sb.storage.from('fotos-productos').upload(fileName, file);
            if (upErr) throw upErr;
            finalUrl = _sb.storage.from('fotos-productos').getPublicUrl(fileName).data.publicUrl;
        }

        await _sb.from('productos').update({
            name: document.getElementById('edit-name').value,
            proveedor: document.getElementById('edit-proveedor').value,
            price: parseFloat(document.getElementById('edit-price').value),
            stock: parseInt(document.getElementById('edit-stock').value),
            image_url: finalUrl
        }).eq('id', id);

        alert("✅ Cambios guardados.");
        document.getElementById('modal-editar').classList.add('hidden');
        syncStock();
    } catch (e) { alert("Error: " + e.message); }
    finally { btn.disabled = false; }
}

// ==========================================
// 5. ASISTENTE DE COMPRAS IA
// ==========================================
window.abrirModalCompras = function() {
    const contenedor = document.getElementById('lista-proveedores-ia');
    const urgentes = state.products.filter(p => p.stock <= 5);
    if (!urgentes.length) {
        contenedor.innerHTML = "<p class='text-center text-xs opacity-50'>Todo en orden.</p>";
    } else {
        let porProv = {};
        urgentes.forEach(p => { 
            const pr = p.proveedor || 'Sin Asignar';
            if(!porProv[pr]) porProv[pr] = [];
            porProv[pr].push(p.name);
        });
        contenedor.innerHTML = Object.entries(porProv).map(([prov, items]) => `
            <div class="bg-slate-900 p-3 rounded-xl mb-2">
                <p class="text-[10px] font-black uppercase text-indigo-400">${prov}</p>
                <p class="text-[9px] text-slate-400">${items.join(', ')}</p>
            </div>
        `).join('');
    }
    document.getElementById('modal-compras').classList.remove('hidden');
}