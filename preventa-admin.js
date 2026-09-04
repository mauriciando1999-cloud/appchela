// preventa-admin.js - Panel de Pedidos / Inventario / Producción de Preventa Escolar
// _sb y MASTER_PIN vienen de config.js. PRODUCT_TYPE_MAP/PLANTILLAS_CON_TALLA/EXTRAS_DISPONIBLES/normalizarNombreProducto vienen de preventa-config.js.

let pestanaActiva = 'pedidos';
let filtroPedidosActivo = 'todos';
let productosCache = [];
let ventasPreventaCache = [];
let representantesCache = []; // [{ phone, representante, estudiantes: [nombre, ...] }]

document.getElementById('pin-input').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') validarAcceso();
});

async function validarAcceso() {
    const input = document.getElementById('pin-input').value;
    if (input === MASTER_PIN) {
        document.getElementById('modal-seguridad').classList.add('hidden');
        const body = document.getElementById('panel-body');
        body.classList.remove('hidden');
        setTimeout(() => body.classList.replace('opacity-0', 'opacity-100'), 50);
        await iniciarSistema();
    } else {
        const inputEl = document.getElementById('pin-input');
        inputEl.classList.add('border-red-500', 'text-red-500');
        setTimeout(() => inputEl.classList.remove('border-red-500', 'text-red-500'), 1000);
        inputEl.value = '';
    }
}

async function iniciarSistema() {
    await Promise.all([cargarProductosCache(), cargarVentasPreventaCache(), cargarRepresentantesCache()]);
    cambiarPestana('pedidos');
}

async function cargarProductosCache() {
    const { data } = await _sb.from('productos').select('id,name,price,stock,categoria');
    productosCache = data || [];
}

async function cargarRepresentantesCache() {
    const { data } = await _sb.from('estudiantes').select('name,representante,phone,debt');
    const grupos = {};
    (data || []).forEach(e => {
        if (!e.phone) return;
        if (!grupos[e.phone]) grupos[e.phone] = { phone: e.phone, representante: e.representante || 'Representante', estudiantes: [] };
        grupos[e.phone].estudiantes.push(e.name);
    });
    representantesCache = Object.values(grupos);
}

async function cargarVentasPreventaCache() {
    const { data } = await _sb.from('ventas')
        .select('id,status,items,detalle_pedido,producto_preventa,total_usd,created_at,estudiante_nombre,ref_pago')
        .eq('tipo_pedido', 'preventa')
        .order('created_at', { ascending: false });
    ventasPreventaCache = (data || []).map(v => ({
        ...v,
        items: typeof v.items === 'string' ? JSON.parse(v.items) : (v.items || [])
    }));
}

function cambiarPestana(pestana) {
    pestanaActiva = pestana;
    ['pedidos', 'inventario', 'produccion', 'difusion'].forEach(p => {
        const btn = document.getElementById('tab-' + p);
        btn.className = 'tab-btn flex-1 py-4 rounded-[1.5rem] font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all whitespace-nowrap ' +
            (p === pestana ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800');
    });

    document.getElementById('filtros-pedidos').style.display = pestana === 'pedidos' ? 'flex' : 'none';

    if (pestana === 'pedidos') renderPedidos();
    else if (pestana === 'inventario') renderInventario();
    else if (pestana === 'produccion') renderProduccion();
    else renderDifusion();
}

function filtrarPedidos(filtro) {
    filtroPedidosActivo = filtro;
    document.querySelectorAll('.filtro-btn').forEach(b => b.className = 'filtro-btn px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-800');
    renderPedidos();
}

// ==========================================
// TAB: PEDIDOS (solo lectura)
// ==========================================
function renderPedidos() {
    const cont = document.getElementById('lista-contenedor');
    let pedidos = ventasPreventaCache;
    if (filtroPedidosActivo !== 'todos') {
        pedidos = pedidos.filter(v => filtroPedidosActivo === 'pendiente_verificacion'
            ? (v.status === 'pendiente_verificacion' || v.status === 'esperando_verificacion')
            : v.status === filtroPedidosActivo);
    }

    if (pedidos.length === 0) {
        cont.innerHTML = `<div class="bg-slate-900/50 border border-slate-800 rounded-[3rem] p-12 text-center">
            <i class="fa-solid fa-inbox text-4xl text-slate-700 mb-4 block"></i>
            <p class="text-[11px] text-slate-500 font-bold uppercase tracking-widest">No hay pedidos en esta categoría.</p>
        </div>`;
        return;
    }

    cont.innerHTML = pedidos.map(v => {
        const d = v.detalle_pedido || {};
        const fecha = new Date(v.created_at).toLocaleString('es-VE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
        const statusInfo = {
            'pendiente_verificacion': { label: 'Pendiente', cls: 'text-amber-400 bg-amber-400/10 border-amber-500/20' },
            'esperando_verificacion': { label: 'Pendiente', cls: 'text-amber-400 bg-amber-400/10 border-amber-500/20' },
            'completado': { label: 'Aprobado', cls: 'text-emerald-400 bg-emerald-400/10 border-emerald-500/20' },
            'rechazado': { label: 'Rechazado', cls: 'text-red-400 bg-red-400/10 border-red-500/20' }
        }[v.status] || { label: v.status || '—', cls: 'text-slate-400 bg-slate-400/10 border-slate-500/20' };

        const itemsResumen = v.items.map(i => `<span class="font-bold text-white">${i.qty}x</span> ${i.name}`).join('<br>');
        const esPendiente = v.status === 'pendiente_verificacion' || v.status === 'esperando_verificacion';

        return `
        <div class="bg-slate-900 p-5 md:p-6 rounded-[2rem] card-shadow border border-slate-800 glass">
            <div class="flex justify-between items-start mb-3">
                <div>
                    <p class="text-sm font-black text-white">${d.producto || v.producto_preventa || 'Pedido de Preventa'}</p>
                    <p class="text-[10px] text-slate-500 font-bold uppercase mt-0.5">${d.estudiante || v.estudiante_nombre || ''} ${d.telefono ? '• ' + d.telefono : ''}</p>
                </div>
                <span class="px-2.5 py-1 rounded-lg text-[8px] font-black uppercase border ${statusInfo.cls}">${statusInfo.label}</span>
            </div>
            <div class="text-[11px] text-slate-400 leading-relaxed border-t border-slate-800 pt-3 mb-3">${itemsResumen}</div>
            <div class="flex justify-between items-center border-t border-slate-800 pt-3">
                <p class="text-[9px] text-slate-600 font-bold uppercase"><i class="fa-solid fa-clock mr-1"></i> ${fecha}</p>
                <p class="text-lg font-black text-emerald-400">$${parseFloat(v.total_usd || 0).toFixed(2)}</p>
            </div>
            ${esPendiente ? `<a href="verificacion.html" class="mt-3 block text-center bg-slate-800 hover:bg-slate-700 text-indigo-400 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all">Ir a Verificación <i class="fa-solid fa-arrow-right ml-1"></i></a>` : ''}
        </div>`;
    }).join('');
}

// ==========================================
// TAB: INVENTARIO
// ==========================================
function extraerTalla(nombre) {
    const m = nombre.match(/Talla\s*(.+)$/i);
    return m ? m[1].trim() : null;
}

function plantillaBaseDe(nombre) {
    const norm = normalizarNombreProducto(nombre);
    return PLANTILLAS_CON_TALLA.find(p => norm.startsWith(normalizarNombreProducto(p))) || null;
}

function esExtra(nombre) {
    const norm = normalizarNombreProducto(nombre);
    return EXTRAS_DISPONIBLES.some(e => normalizarNombreProducto(e.nombre) === norm);
}

function productosRelevantesPreventa() {
    return productosCache.filter(p => plantillaBaseDe(p.name) || esExtra(p.name));
}

function renderInventario() {
    const cont = document.getElementById('lista-contenedor');
    const relevantes = productosRelevantesPreventa();

    const grupos = {};
    relevantes.forEach(p => {
        const base = plantillaBaseDe(p.name) || 'Adicionales';
        if (!grupos[base]) grupos[base] = [];
        grupos[base].push(p);
    });

    const ordenGrupos = Object.keys(grupos).sort();

    cont.innerHTML = ordenGrupos.map(base => {
        const filas = grupos[base].slice().sort((a, b) => (extraerTalla(a.name) || '').localeCompare(extraerTalla(b.name) || '', undefined, { numeric: true }));
        return `
        <div class="bg-slate-900 border border-slate-800 rounded-[2rem] p-5 glass">
            <h3 class="text-xs font-black text-indigo-400 uppercase tracking-widest mb-3">${base}</h3>
            <div class="space-y-1.5">
                ${filas.map(p => {
                    const talla = extraerTalla(p.name);
                    const bajo = p.stock <= 5;
                    return `<div class="flex justify-between items-center py-2 px-3 rounded-lg ${bajo ? 'bg-red-500/5' : 'bg-slate-950/40'}">
                        <span class="text-xs font-bold text-slate-300">${talla ? 'Talla ' + talla : p.name}</span>
                        <div class="flex items-center gap-3">
                            <span class="text-[10px] text-slate-500 font-bold">$${parseFloat(p.price).toFixed(2)}</span>
                            <span class="text-sm font-black ${bajo ? 'text-red-400' : 'text-emerald-400'}">${p.stock} und.</span>
                        </div>
                    </div>`;
                }).join('')}
            </div>
        </div>`;
    }).join('');
}

// ==========================================
// TAB: PRODUCCIÓN
// ==========================================
function renderProduccion() {
    const cont = document.getElementById('lista-contenedor');

    // Sumar demanda por producto_id a partir de todos los pedidos de preventa
    const demanda = {}; // producto_id -> { pendiente, completado }
    ventasPreventaCache.forEach(v => {
        const esPendiente = v.status === 'pendiente_verificacion' || v.status === 'esperando_verificacion';
        const esCompletado = v.status === 'completado';
        if (!esPendiente && !esCompletado) return;
        v.items.forEach(item => {
            if (!item.producto_id) return;
            if (!demanda[item.producto_id]) demanda[item.producto_id] = { pendiente: 0, completado: 0 };
            if (esPendiente) demanda[item.producto_id].pendiente += item.qty;
            if (esCompletado) demanda[item.producto_id].completado += item.qty;
        });
    });

    const relevantes = productosRelevantesPreventa();

    const filas = relevantes.map(p => {
        const d = demanda[p.id] || { pendiente: 0, completado: 0 };
        const aProducir = Math.max(0, d.pendiente - p.stock);
        return { producto: p, pendiente: d.pendiente, completado: d.completado, stock: p.stock, aProducir };
    }).filter(f => f.pendiente > 0 || f.completado > 0 || f.stock <= 5)
      .sort((a, b) => b.aProducir - a.aProducir);

    if (filas.length === 0) {
        cont.innerHTML = `<div class="bg-slate-900/50 border border-slate-800 rounded-[3rem] p-12 text-center">
            <i class="fa-solid fa-check-double text-4xl text-emerald-500 mb-4 block"></i>
            <p class="text-[11px] text-slate-500 font-bold uppercase tracking-widest">Sin demanda pendiente registrada todavía.</p>
        </div>`;
        return;
    }

    cont.innerHTML = `
    <div class="bg-slate-900 border border-slate-800 rounded-[2rem] overflow-hidden glass">
        <div class="grid grid-cols-5 gap-2 px-4 py-3 bg-slate-950/60 text-[9px] font-black text-slate-500 uppercase tracking-widest">
            <span class="col-span-2">Prenda / Talla</span>
            <span class="text-center">Stock</span>
            <span class="text-center">Pendiente</span>
            <span class="text-center">A Producir</span>
        </div>
        ${filas.map(f => `
        <div class="grid grid-cols-5 gap-2 px-4 py-3 border-t border-slate-800/60 items-center ${f.aProducir > 0 ? 'bg-red-500/5' : ''}">
            <span class="col-span-2 text-xs font-bold text-slate-200">${f.producto.name}</span>
            <span class="text-center text-xs font-bold ${f.stock <= 5 ? 'text-red-400' : 'text-slate-300'}">${f.stock}</span>
            <span class="text-center text-xs font-bold text-amber-400">${f.pendiente}</span>
            <span class="text-center text-sm font-black ${f.aProducir > 0 ? 'text-red-400' : 'text-emerald-400'}">${f.aProducir}</span>
        </div>`).join('')}
    </div>
    <p class="text-[10px] text-slate-500 font-bold uppercase tracking-widest text-center px-4">
        "A Producir" = pendientes por aprobar menos el stock actual. El stock ya refleja lo aprobado/entregado.
    </p>`;
}

// ==========================================
// TAB: DIFUSIÓN WHATSAPP
// ==========================================
const DIFUSION_MENSAJE_DEFAULT = 'Hola {representante} 👋, te escribimos de *Chela* sobre {estudiante}.\n\nMonto: *${monto}*\n\n¡Gracias por confiar en nosotros!';
const DIFUSION_NUMERO_PRUEBA_KEY = 'difusion_numero_prueba';

function difusionPlaceholders() {
    const primero = representantesCache[0];
    return {
        representante: primero ? primero.representante : 'Representante',
        estudiante: primero ? primero.estudiantes.join(', ') : 'Estudiante',
        monto: parseFloat(document.getElementById('difusion-monto').value || 0).toFixed(2)
    };
}

function resolverPlantilla(texto, valores) {
    return texto
        .replace(/{representante}/g, valores.representante)
        .replace(/{estudiante}/g, valores.estudiante)
        .replace(/{monto}/g, valores.monto);
}

function renderDifusion() {
    const cont = document.getElementById('lista-contenedor');
    cont.innerHTML = `
    <div class="bg-slate-900 border border-slate-800 rounded-[2rem] p-5 glass space-y-4">
        <div>
            <p class="text-xs font-black text-white mb-1"><i class="fa-brands fa-whatsapp text-emerald-500 mr-1"></i> Difusión Masiva</p>
            <p class="text-[10px] text-slate-500 font-bold">Envía cualquier tipo de aviso (cobros, anuncios, recordatorios, promociones) a <span class="text-emerald-400">${representantesCache.length}</span> representantes registrados (uno por número de teléfono único).</p>
        </div>

        <div class="flex gap-2 flex-wrap">
            <button onclick="insertarPlaceholder('{representante}')" class="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-[9px] font-black uppercase text-indigo-400">+ Representante</button>
            <button onclick="insertarPlaceholder('{estudiante}')" class="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-[9px] font-black uppercase text-indigo-400">+ Estudiante(s)</button>
            <button onclick="insertarPlaceholder('{monto}')" class="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-[9px] font-black uppercase text-indigo-400">+ Monto</button>
        </div>

        <div>
            <label class="text-[10px] text-slate-500 font-bold uppercase ml-1">Mensaje (plantilla)</label>
            <textarea id="difusion-mensaje" rows="7" oninput="actualizarPreviewDifusion()" class="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-xs text-white outline-none focus:border-indigo-500 mt-1 resize-none">${DIFUSION_MENSAJE_DEFAULT}</textarea>
        </div>

        <div>
            <label class="text-[10px] text-slate-500 font-bold uppercase ml-1">Monto ($) para {monto}</label>
            <input type="number" id="difusion-monto" step="0.01" value="0.00" oninput="actualizarPreviewDifusion()" class="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-emerald-400 font-black outline-none focus:border-indigo-500 mt-1">
        </div>

        <div>
            <label class="text-[10px] text-slate-500 font-bold uppercase ml-1">Vista previa (primer destinatario)</label>
            <div id="difusion-preview" class="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-xs text-slate-300 mt-1 whitespace-pre-wrap"></div>
        </div>

        <div class="border-t border-dashed border-slate-800 pt-4">
            <label class="text-[10px] text-amber-400 font-bold uppercase ml-1"><i class="fa-solid fa-flask mr-1"></i> Probar antes de enviar a todos</label>
            <div class="flex gap-2 mt-1">
                <input type="tel" id="difusion-numero-prueba" placeholder="Tu número (ej. 04121234567)" class="flex-1 bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs text-white outline-none focus:border-amber-500">
                <button onclick="enviarPruebaDifusion()" class="bg-amber-600 hover:bg-amber-500 text-white font-black px-4 rounded-xl text-[10px] uppercase tracking-widest active:scale-95 transition-all whitespace-nowrap">
                    <i class="fa-solid fa-paper-plane mr-1"></i> Enviar Prueba
                </button>
            </div>
            <p class="text-[9px] text-slate-600 font-bold uppercase mt-1">Te llega solo a ti, con los datos del primer representante como ejemplo.</p>
        </div>

        <button onclick="enviarDifusion()" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-[11px] active:scale-95 shadow-lg shadow-emerald-900/30 flex justify-center items-center gap-2">
            <i class="fa-brands fa-whatsapp text-lg"></i> Iniciar Difusión a Todos
        </button>
        <p class="text-[9px] text-slate-600 font-bold uppercase text-center">Se abrirá una pestaña de WhatsApp por representante, espaciadas cada 2.5s.</p>
    </div>`;

    const inputPrueba = document.getElementById('difusion-numero-prueba');
    inputPrueba.value = localStorage.getItem(DIFUSION_NUMERO_PRUEBA_KEY) || '';

    actualizarPreviewDifusion();
}

function actualizarPreviewDifusion() {
    const mensaje = document.getElementById('difusion-mensaje').value;
    document.getElementById('difusion-preview').innerText = resolverPlantilla(mensaje, difusionPlaceholders());
}

function insertarPlaceholder(token) {
    const textarea = document.getElementById('difusion-mensaje');
    const inicio = textarea.selectionStart;
    const fin = textarea.selectionEnd;
    textarea.value = textarea.value.slice(0, inicio) + token + textarea.value.slice(fin);
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = inicio + token.length;
    actualizarPreviewDifusion();
}

function normalizarTelefono(numero) {
    let limpio = (numero || '').replace(/\D/g, '');
    if (limpio.startsWith('0')) limpio = '58' + limpio.substring(1);
    else if (!limpio.startsWith('58') && limpio.length === 10) limpio = '58' + limpio;
    return limpio;
}

function enviarPruebaDifusion() {
    const numeroPrueba = document.getElementById('difusion-numero-prueba').value.trim();
    if (!numeroPrueba) return alert('⚠️ Escribe tu número para la prueba.');
    const mensaje = document.getElementById('difusion-mensaje').value.trim();
    if (!mensaje) return alert('⚠️ Escribe un mensaje antes de probar.');

    localStorage.setItem(DIFUSION_NUMERO_PRUEBA_KEY, numeroPrueba);

    const textoFinal = '[PRUEBA] ' + resolverPlantilla(mensaje, difusionPlaceholders());
    const urlWa = `https://wa.me/${normalizarTelefono(numeroPrueba)}?text=${encodeURIComponent(textoFinal)}`;
    window.open(urlWa, '_blank');
}

function enviarDifusion() {
    if (representantesCache.length === 0) return alert('No hay representantes registrados.');
    const mensaje = document.getElementById('difusion-mensaje').value.trim();
    if (!mensaje) return alert('⚠️ Escribe un mensaje antes de enviar.');

    if (!confirm(`Se abrirán ${representantesCache.length} pestañas de WhatsApp, una por representante.\n\n¿Deseas iniciar la difusión?`)) return;

    const monto = parseFloat(document.getElementById('difusion-monto').value || 0).toFixed(2);

    representantesCache.forEach((rep, i) => {
        const textoFinal = resolverPlantilla(mensaje, {
            representante: rep.representante,
            estudiante: rep.estudiantes.join(', '),
            monto: monto
        });
        const urlWa = `https://wa.me/${normalizarTelefono(rep.phone)}?text=${encodeURIComponent(textoFinal)}`;
        setTimeout(() => { window.open(urlWa, '_blank'); }, i * 2500);
    });

    alert("🚀 Difusión iniciada. Presiona 'Enviar' en cada pestaña de WhatsApp que se vaya abriendo.");
}
