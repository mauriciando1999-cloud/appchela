// catalogo.js - Catálogo genérico, reutilizado por Marketplace y Corporativo.
// Cada página define window.SECCION_CATALOGO ('marketplace' | 'corporativo') y
// window.MENSAJE_WA_CATALOGO (clave de MENSAJES_WHATSAPP para el saludo inicial
// del pedido) antes de cargar este script. Los productos y categorías viven en
// Supabase (chela_web_productos / chela_web_categorias), administrados desde
// admin.html, y cada sección se administra por separado.

const seleccionTalla = {};
const seleccionCantidad = {};
let productosCatalogo = [];
let categoriasCatalogo = [];
let filtroCategoriaActivo = 'todos';

function leerCategoriaDesdeUrl() {
    return new URLSearchParams(window.location.search).get('categoria') || 'todos';
}

window.filtrarPorCategoria = function (categoria) {
    filtroCategoriaActivo = categoria;
    document.querySelectorAll('.filtro-genero').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.categoria === categoria);
    });

    const url = new URL(window.location);
    if (categoria === 'todos') url.searchParams.delete('categoria');
    else url.searchParams.set('categoria', categoria);
    window.history.replaceState({}, '', url);

    renderCatalogo();
};

async function cargarCategorias() {
    const cont = document.getElementById('filtros-categoria');
    if (!cont) return;

    const { data, error } = await _sb
        .from('chela_web_categorias')
        .select('*')
        .eq('seccion', window.SECCION_CATALOGO)
        .order('orden', { ascending: true });

    if (error) { console.error('Error al cargar categorías:', error); return; }
    categoriasCatalogo = data || [];
    filtroCategoriaActivo = leerCategoriaDesdeUrl();

    const chips = [{ nombre: 'Todos', valor: 'todos' }, ...categoriasCatalogo.map(c => ({ nombre: c.nombre, valor: c.nombre }))];
    cont.innerHTML = chips.map(c => `
        <button onclick="filtrarPorCategoria('${c.valor.replace(/'/g, "\\'")}')" data-categoria="${c.valor}" class="filtro-genero">${c.nombre}</button>
    `).join('');

    document.querySelectorAll('.filtro-genero').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.categoria === filtroCategoriaActivo);
    });
}

async function cargarCatalogo() {
    const grid = document.getElementById('grid-catalogo');
    if (!grid) return;

    const { data, error } = await _sb
        .from('chela_web_productos')
        .select('*')
        .eq('activo', true)
        .eq('seccion', window.SECCION_CATALOGO)
        .order('orden', { ascending: true });

    if (error) {
        console.error('Error al cargar el catálogo:', error);
        grid.innerHTML = `<p class="text-center text-muted text-xs col-span-full py-10">No se pudo cargar el catálogo. Intenta de nuevo más tarde.</p>`;
        return;
    }

    productosCatalogo = data || [];
    await cargarCategorias();
    renderCatalogo();
}

function renderCatalogo() {
    const grid = document.getElementById('grid-catalogo');
    if (!grid) return;

    const productosFiltrados = productosCatalogo.filter(p =>
        filtroCategoriaActivo === 'todos' || p.categoria === filtroCategoriaActivo
    );

    if (productosFiltrados.length === 0) {
        grid.innerHTML = `<p class="text-center text-muted text-xs col-span-full py-10">Todavía no hay productos en esta categoría.</p>`;
        return;
    }

    grid.innerHTML = productosFiltrados.map(p => {
        if (seleccionTalla[p.slug] === undefined) seleccionTalla[p.slug] = (p.tallas && p.tallas[0]) || 'Única';
        if (seleccionCantidad[p.slug] === undefined) seleccionCantidad[p.slug] = 1;

        const rutaImagen = /^https?:\/\//.test(p.imagen || '') ? p.imagen : `assets/productos/${p.imagen || ''}`;
        const tallas = (p.tallas && p.tallas.length > 0) ? p.tallas : ['Única'];

        return `
        <div class="product">
            <div class="product-media mb-4">
                <img src="${rutaImagen}" alt="${p.nombre}"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div style="display:none;" class="w-full h-full items-center justify-center absolute inset-0">
                    <i class="fa-solid ${p.icono || 'fa-shirt'} text-4xl" style="color: rgba(17,17,16,0.25);"></i>
                </div>
            </div>

            <h3 class="text-xs md:text-sm font-semibold leading-tight mb-1">${p.nombre}</h3>
            <p class="text-xs md:text-sm text-muted mb-3">Desde $${Number(p.precio_desde).toFixed(2)}</p>

            <div class="flex items-center gap-2 mb-3">
                <select onchange="seleccionTalla['${p.slug}'] = this.value" class="field flex-1 py-1.5 text-[11px]">
                    ${tallas.map(t => `<option value="${t}">Talla ${t}</option>`).join('')}
                </select>
                <div class="flex items-center gap-2 field py-1.5 px-1">
                    <button type="button" onclick="cambiarCantidadCatalogo('${p.slug}', -1)" class="w-5 text-xs font-bold active:scale-95">-</button>
                    <span id="qty-${p.slug}" class="text-[11px] font-bold w-3 text-center">1</span>
                    <button type="button" onclick="cambiarCantidadCatalogo('${p.slug}', 1)" class="w-5 text-xs font-bold active:scale-95">+</button>
                </div>
            </div>

            <button onclick="encargarProducto('${p.slug}')" class="btn-text">
                Encargar <i class="fa-brands fa-whatsapp"></i>
            </button>
        </div>`;
    }).join('');
}

window.cambiarCantidadCatalogo = function (slug, delta) {
    seleccionCantidad[slug] = Math.max(1, (seleccionCantidad[slug] || 1) + delta);
    document.getElementById(`qty-${slug}`).innerText = seleccionCantidad[slug];
};

window.encargarProducto = function (slug) {
    const p = productosCatalogo.find(x => x.slug === slug);
    if (!p) return;
    const talla = seleccionTalla[slug];
    const cantidad = seleccionCantidad[slug] || 1;
    const mensaje = `Hola, quiero encargar:\n\n` +
        `Producto: ${p.nombre}\n` +
        `Talla: ${talla}\n` +
        `Cantidad: ${cantidad}\n\n` +
        `¿Me confirman precio final y tiempo de entrega?`;
    window.open(linkWhatsApp(mensaje), '_blank', 'noopener');
};

document.addEventListener('DOMContentLoaded', cargarCatalogo);
