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
// 3. FACTURA MÚLTIPLE (Ingreso de Mercancía Inteligente)
// ==========================================
window.abrirModalFactura = function() {
    const container = document.getElementById('factura-filas');
    const proveedoresUnicos = [...new Set(state.products.map(p => p.proveedor).filter(Boolean))];

    container.innerHTML = `
        <div class="bg-slate-950 p-3 rounded-xl border border-slate-800 mb-4 grid grid-cols-2 gap-3 shadow-inner">
            <div>
                <label class="text-[9px] text-slate-500 uppercase font-black tracking-widest ml-1 mb-1 block">Proveedor</label>
                <input type="text" id="fac-proveedor" list="proveedores-list" placeholder="Ej. Textilera C.A." class="w-full bg-slate-900 border border-slate-700 text-white p-3 rounded-xl text-xs outline-none focus:border-indigo-500 font-bold uppercase transition-colors">
                <datalist id="proveedores-list">
                    ${proveedoresUnicos.map(prov => `<option value="${prov}"></option>`).join('')}
                </datalist>
            </div>
            <div>
                <label class="text-[9px] text-slate-500 uppercase font-black tracking-widest ml-1 mb-1 block">N° Factura / Ref</label>
                <input type="text" id="fac-ref" placeholder="Opcional" class="w-full bg-slate-900 border border-slate-700 text-white p-3 rounded-xl text-xs outline-none focus:border-indigo-500 font-bold transition-colors">
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

// -----------------------------------------------------
// MATEMÁTICAS EN VIVO: Manejo de Paquetes vs Unidades
// -----------------------------------------------------

window.togglePaquete = function(select) {
    const row = select.closest('.factura-item');
    const inputUndPaq = row.querySelector('.f-und-paq');
    const inputCosto = row.querySelector('.f-costo');
    const baseCost = parseFloat(inputCosto.dataset.baseCost || 0);

    if(select.value === 'paquete') {
        inputUndPaq.disabled = false;
        inputUndPaq.classList.replace('text-slate-500', 'text-amber-400');
        inputUndPaq.classList.replace('bg-slate-900', 'bg-slate-950');
        if(!inputUndPaq.value || inputUndPaq.value === '1') inputUndPaq.value = ''; 
        
        // Multiplica el costo automáticamente al abrir el paquete
        calcularCostoSugerido(inputUndPaq);
    } else {
        inputUndPaq.disabled = true;
        inputUndPaq.value = '1';
        inputUndPaq.classList.replace('text-amber-400', 'text-slate-500');
        inputUndPaq.classList.replace('bg-slate-950', 'bg-slate-900');
        
        // Regresa al costo unitario original
        if(baseCost > 0) inputCosto.value = baseCost.toFixed(2);
    }
}

// Multiplica el costo unitario por la cantidad del paquete
window.calcularCostoSugerido = function(input) {
    const row = input.closest('.factura-item');
    const selectTipo = row.querySelector('.f-tipo');
    const inputCosto = row.querySelector('.f-costo');
    const baseCost = parseFloat(inputCosto.dataset.baseCost || 0);
    
    if(selectTipo.value === 'paquete' && baseCost > 0) {
        const trae = parseInt(input.value) || 0;
        if(trae > 0) {
            inputCosto.value = (baseCost * trae).toFixed(2);
        }
    }
}

window.agregarFilaFactura = function() {
    filaContador++;
    const id = filaContador;
    const container = document.getElementById('filas-dinamicas');
    const row = document.createElement('div');
    row.id = `factura-fila-${id}`;
    row.className = 'factura-item bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col gap-3 relative shadow-sm';
    
    row.innerHTML = `
        <div class="w-full relative">
            <input type="text" list="prods-datalist" onchange="cargarDatosProducto(this)" class="f-nombre w-full bg-slate-950 border border-slate-700 text-white p-3 rounded-xl text-[12px] outline-none focus:border-indigo-500 font-black uppercase transition-colors" placeholder="🔎 BUSCAR O CREAR PRODUCTO...">
            <p class="info-producto text-[9px] font-bold mt-1.5 px-1 hidden tracking-widest"></p>
        </div>
        <div class="flex gap-2 w-full items-end">
            <div class="w-12 shrink-0">
                <p class="text-[8px] text-slate-500 uppercase font-black text-center mb-1 tracking-widest">Tipo</p>
                <select onchange="togglePaquete(this)" class="f-tipo w-full bg-slate-950 border border-slate-700 text-indigo-300 p-3 rounded-xl text-[9px] font-black text-center outline-none uppercase transition-colors px-0">
                    <option value="unidad">Und</option>
                    <option value="paquete">Paq</option>
                </select>
            </div>
            <div class="w-12 shrink-0">
                <p class="text-[8px] text-slate-500 uppercase font-black text-center mb-1 tracking-widest">Trae</p>
                <input type="number" oninput="calcularCostoSugerido(this)" class="f-und-paq w-full bg-slate-900 border border-slate-700 text-slate-500 p-3 rounded-xl text-[11px] font-black text-center outline-none disabled:opacity-50 transition-colors px-1" placeholder="1" disabled value="1">
            </div>
            <div class="flex-[0.8] relative">
                <p class="text-[8px] text-slate-500 uppercase font-black text-center mb-1 tracking-widest">Cant</p>
                <input type="number" class="f-qty w-full bg-slate-950 border border-slate-700 text-white p-3 rounded-xl text-[12px] font-black text-center outline-none focus:border-indigo-500 transition-colors" placeholder="0">
            </div>
            <div class="flex-1 relative">
                <p class="text-[8px] text-slate-500 uppercase font-black text-center mb-1 tracking-widest">Costo $</p>
                <input type="number" step="0.01" class="f-costo w-full bg-slate-950 border border-red-900/30 text-red-400 p-3 rounded-xl text-[12px] font-black text-center outline-none focus:border-red-500 transition-colors" placeholder="0.00" data-base-cost="0">
            </div>
            <div class="flex-1 relative">
                <p class="text-[8px] text-slate-500 uppercase font-black text-center mb-1 tracking-widest">P.Venta $</p>
                <input type="number" step="0.01" class="f-precio w-full bg-slate-950 border border-emerald-900/30 text-emerald-400 p-3 rounded-xl text-[12px] font-black text-center outline-none focus:border-emerald-500 transition-colors" placeholder="0.00">
            </div>
            
            <button onclick="document.getElementById('factura-fila-${id}').remove()" class="absolute -right-2 -top-2 bg-red-500 hover:bg-red-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] active:scale-90 transition-all shadow-lg border-2 border-slate-900"><i class="fa-solid fa-xmark"></i></button>
        </div>
    `;
    container.appendChild(row);
}

// -----------------------------------------------------
// AUTO-RELLENADO AL SELECCIONAR PRODUCTO EXISTENTE
// -----------------------------------------------------
window.cargarDatosProducto = function(input) {
    const nombre = input.value.trim().toUpperCase();
    const prod = state.products.find(p => p.name.toUpperCase() === nombre);
    
    const row = input.closest('.factura-item');
    const infoP = row.querySelector('.info-producto');
    const selectTipo = row.querySelector('.f-tipo');
    const inputCosto = row.querySelector('.f-costo');
    const inputPrecio = row.querySelector('.f-precio');
    const facProveedorEl = document.getElementById('fac-proveedor');

    if (prod) {
        // Confirmación visual
        infoP.innerHTML = `<i class="fa-solid fa-check-circle mr-1"></i> Producto Existente (Se actualizará stock/precio)`;
        infoP.className = 'info-producto text-[9px] text-emerald-400 font-bold mt-1.5 px-1 tracking-widest';
        
        // Guarda en la memoria oculta el costo base unitario para el multiplicador
        inputCosto.dataset.baseCost = prod.cost || 0;
        
        // RELLENO AUTOMÁTICO DE LOS SLOTS EDITABLES
        selectTipo.value = 'unidad';
        inputCosto.value = parseFloat(prod.cost || 0).toFixed(2);
        inputPrecio.value = parseFloat(prod.price || 0).toFixed(2);
        
        togglePaquete(selectTipo);
        
        // Sugiere el proveedor del producto si el general de la factura estaba vacío
        if(prod.proveedor && !facProveedorEl.value) {
            facProveedorEl.value = prod.proveedor;
        }
    } else {
        // Es un producto totalmente nuevo
        infoP.innerHTML = `✨ Nuevo Producto (Se creará en base de datos)`;
        infoP.className = 'info-producto text-[9px] text-indigo-400 font-bold mt-1.5 px-1 tracking-widest';
        
        inputCosto.dataset.baseCost = 0;
        selectTipo.value = 'unidad';
        inputCosto.value = '';
        inputPrecio.value = '';
        togglePaquete(selectTipo);
    }
}

// -----------------------------------------------------
// AUDITORÍA Y REGISTRO EN LA BASE DE DATOS
// -----------------------------------------------------
window.guardarFacturaMasiva = async function() {
    const items = document.querySelectorAll('.factura-item');

    if (items.length === 0) return alert("⚠️ Añade al menos un producto.");

    const btn = document.getElementById('btn-save-factura');
    const aplicarIVA = document.getElementById('check-iva')?.checked || false;
    const facProveedorEl = document.getElementById('fac-proveedor');
    const facRefEl = document.getElementById('fac-ref');

    const proveedor = (facProveedorEl?.value.trim()) || 'Sin Proveedor';
    const refFac = (facRefEl?.value.trim()) || `REC-${Date.now().toString().slice(-5)}`;

    let costoTotalFactura = 0;
    let errorValidacion = false;

    // Validación matemática previa
    items.forEach(item => {
        const qty = parseInt(item.querySelector('.f-qty').value);
        const cost = parseFloat(item.querySelector('.f-costo').value);
        const precio = parseFloat(item.querySelector('.f-precio').value);

        if (isNaN(qty) || isNaN(cost) || isNaN(precio) || qty <= 0 || cost < 0 || precio < 0) {
            errorValidacion = true;
            return;
        }
        costoTotalFactura += (cost * qty);
    });

    if (errorValidacion) return alert("⚠️ Verifica que Cantidad, Costo y P. Venta tengan números válidos en todas las filas.");

    const totalFinal = aplicarIVA ? (costoTotalFactura * 1.16) : costoTotalFactura;

    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Auditando e Ingresando...';
    btn.disabled = true;

    try {
        for (let item of items) {
            const name = item.querySelector('.f-nombre').value.trim().toUpperCase();
            const tipo = item.querySelector('.f-tipo').value;
            const undsPaq = parseInt(item.querySelector('.f-und-paq').value) || 1;
            const qtyComprada = parseInt(item.querySelector('.f-qty').value);
            const costoIngresado = parseFloat(item.querySelector('.f-costo').value); 
            const precioVentaFinal = parseFloat(item.querySelector('.f-precio').value); 

            // Matemáticas de Distribución de Inventario
            const stockAAgregar = tipo === 'paquete' ? (qtyComprada * undsPaq) : qtyComprada;
            let costoBase = tipo === 'paquete' ? (costoIngresado / undsPaq) : costoIngresado; 
            
            const costoUnitarioReal = aplicarIVA ? (costoBase * 1.16) : costoBase;

            const pExistente = state.products.find(p => p.name.toUpperCase() === name);

            if (pExistente) {
                // Actualiza stock, ajusta el costo unitario Y ACTULIZA EL PRECIO DE VENTA
                await _sb.from('productos').update({
                    stock: pExistente.stock + stockAAgregar,
                    cost: costoUnitarioReal,
                    price: precioVentaFinal, 
                    proveedor: proveedor
                }).eq('id', pExistente.id);
            } else {
                // Registra el producto por primera vez usando el precio de venta colocado por el usuario
                await _sb.from('productos').insert([{
                    name: name,
                    stock: stockAAgregar,
                    cost: costoUnitarioReal,
                    price: precioVentaFinal, 
                    categoria: 'Nuevos',
                    proveedor: proveedor
                }]);
            }
        }

        // Guarda el respaldo de la factura global en la BD
        await _sb.from('facturas').insert([{
            proveedor: proveedor,
            concepto: `Factura Ref: ${refFac} ${aplicarIVA ? '(Incluye IVA)' : ''}`,
            monto_usd: totalFinal,
            status: 'pendiente' 
        }]);

        alert(`✅ Stock y Factura registrados exitosamente.\n\nTotal Invertido: $${totalFinal.toFixed(2)}`);
        
        cerrarModalFactura();
        await syncStock();

    } catch (e) {
        console.error(e);
        alert("❌ Error de red: " + e.message);
    } finally {
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Procesar Factura';
        btn.disabled = false;
    }
};
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
    // Lista actualizada de proveedores
    const telefonosProveedores = {
        "URIEL": "584129074882",
        "CHELASPORT": "584122969255",
        "C15": "584129084001"
    };

    const contenedor = document.getElementById('lista-proveedores-ia');
    const urgentes = state.products.filter(p => p.stock <= 5);
    
    if (!urgentes.length) {
        contenedor.innerHTML = "<p class='text-center text-xs opacity-50 py-4'>Todo el inventario está en niveles óptimos.</p>";
    } else {
        let porProv = {};
        urgentes.forEach(p => { 
            const pr = (p.proveedor || 'Sin Asignar').toUpperCase();
            if(!porProv[pr]) porProv[pr] = [];
            porProv[pr].push(`${p.name} (Stock actual: ${p.stock})`);
        });

        contenedor.innerHTML = Object.entries(porProv).map(([prov, items]) => {
            const textoProv = `🛒 PEDIDO - CHELA SPORT\nProveedor: ${prov}\n\n` + 
                              items.map(item => `- ${item}`).join('\n') + 
                              `\n\nQuedo atento a la confirmación, gracias.`;
            
            const numero = telefonosProveedores[prov] || "";
            const linkWa = numero ? `https://wa.me/${numero}?text=${encodeURIComponent(textoProv)}` : "#";

            return `
                <div class="bg-slate-900 p-4 rounded-xl mb-3 border border-slate-700">
                    <p class="text-[11px] font-black uppercase text-indigo-400 mb-2">${prov}</p>
                    <p class="text-[10px] text-slate-400 mb-3">${items.join(', ')}</p>
                    ${numero ? `
                        <a href="${linkWa}" target="_blank" class="block w-full bg-emerald-600 text-white text-[10px] font-black py-2 rounded-lg text-center hover:bg-emerald-500 shadow-lg active:scale-95 transition-transform">
                            <i class="fa-brands fa-whatsapp mr-2"></i> Enviar pedido a ${prov}
                        </a>
                    ` : `
                        <p class="text-[9px] text-red-400 italic">⚠️ Número no configurado para ${prov}</p>
                    `}
                </div>
            `;
        }).join('');
    }
    document.getElementById('modal-compras').classList.remove('hidden');
}