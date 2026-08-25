// catalogo.js - Catálogo genérico e instanciable. Cada llamada a
// iniciarCatalogo({...}) crea un catálogo independiente, con su propio
// filtro de categoría y su propia selección de talla/cantidad — así una
// misma página puede tener varios catálogos separados sin que se pisen
// entre sí (ej. Novias: Vestidos de Novia / Damas de Honor / Batas, cada
// uno con sus propios productos y categorías en Supabase).
//
// Uso: <script src="catalogo.js"></script>
//      <script>iniciarCatalogo({ seccion: 'marketplace', idFiltros: 'filtros-categoria', idGrid: 'grid-catalogo' });</script>
//
// Si una página tiene más de un catálogo, cada uno necesita su propio
// idFiltros/idGrid (ids de contenedor distintos) y, si además quieres que
// el filtro de categoría de cada uno viva en su propio parámetro de URL,
// pásale un "parametroCategoria" distinto (por defecto usa "categoria").

function iniciarCatalogo({ seccion, idFiltros, idGrid, parametroCategoria }) {
    const seleccionTalla = {};
    const seleccionCantidad = {};
    let productosCatalogo = [];
    let categoriasCatalogo = [];
    let filtroCategoriaActivo = 'todos';
    let filtroGeneroActivo = 'todos';
    const claveCategoriaUrl = parametroCategoria || 'categoria';

    function leerCategoriaDesdeUrl() {
        return new URLSearchParams(window.location.search).get(claveCategoriaUrl) || 'todos';
    }

    // El género (hombre/mujer/unisex) llega por URL desde los accesos de Inicio
    // ("Para Él" / "Para Ella") — es un campo propio del producto, distinto de
    // la categoría administrable, y no tiene chips propios en esta página.
    function leerGeneroDesdeUrl() {
        return new URLSearchParams(window.location.search).get('genero') || 'todos';
    }

    function filtrarPorCategoria(categoria) {
        filtroCategoriaActivo = categoria;
        const cont = document.getElementById(idFiltros);
        if (cont) {
            cont.querySelectorAll('.filtro-genero').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.categoria === categoria);
            });
        }

        const url = new URL(window.location);
        if (categoria === 'todos') url.searchParams.delete(claveCategoriaUrl);
        else url.searchParams.set(claveCategoriaUrl, categoria);
        window.history.replaceState({}, '', url);

        renderCatalogo();
    }

    async function cargarCategorias() {
        const cont = document.getElementById(idFiltros);
        if (!cont) return;

        const { data, error } = await _sb
            .from('chela_web_categorias')
            .select('*')
            .eq('seccion', seccion)
            .order('orden', { ascending: true });

        if (error) { console.error('Error al cargar categorías:', error); return; }
        categoriasCatalogo = data || [];
        filtroCategoriaActivo = leerCategoriaDesdeUrl();

        const chips = [{ nombre: 'Todos', valor: 'todos' }, ...categoriasCatalogo.map(c => ({ nombre: c.nombre, valor: c.nombre }))];
        cont.innerHTML = chips.map(c => `<button type="button" data-categoria="${c.valor}" class="filtro-genero">${c.nombre}</button>`).join('');

        cont.querySelectorAll('.filtro-genero').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.categoria === filtroCategoriaActivo);
            btn.addEventListener('click', () => filtrarPorCategoria(btn.dataset.categoria));
        });
    }

    async function cargarCatalogo() {
        const grid = document.getElementById(idGrid);
        if (!grid) return;

        const { data, error } = await _sb
            .from('chela_web_productos')
            .select('*')
            .eq('activo', true)
            .eq('seccion', seccion)
            .order('orden', { ascending: true });

        if (error) {
            console.error('Error al cargar el catálogo:', error);
            grid.innerHTML = `<p class="text-center text-muted text-xs col-span-full py-10">No se pudo cargar el catálogo. Intenta de nuevo más tarde.</p>`;
            return;
        }

        productosCatalogo = data || [];
        filtroGeneroActivo = leerGeneroDesdeUrl();
        await cargarCategorias();
        renderCatalogo();
    }

    function revelarCatalogo() {
        if (typeof window.inicializarRevelado === 'function') window.inicializarRevelado(document.getElementById(idGrid));
    }

    function cambiarCantidad(slug, delta, tarjeta) {
        seleccionCantidad[slug] = Math.max(1, (seleccionCantidad[slug] || 1) + delta);
        tarjeta.querySelector('[data-cantidad]').innerText = seleccionCantidad[slug];
    }

    function encargar(slug) {
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
    }

    function renderCatalogo() {
        const grid = document.getElementById(idGrid);
        if (!grid) return;

        const productosFiltrados = productosCatalogo.filter(p =>
            (filtroCategoriaActivo === 'todos' || p.categoria === filtroCategoriaActivo) &&
            (filtroGeneroActivo === 'todos' || p.genero === filtroGeneroActivo || p.genero === 'unisex')
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
            <div class="product" data-reveal data-slug="${p.slug}">
                <div class="product-media mb-4">
                    <img src="${rutaImagen}" alt="${p.nombre}"
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div style="display:none;" class="w-full h-full items-center justify-center absolute inset-0">
                        <i class="fa-solid ${p.icono || 'fa-shirt'} text-4xl" style="color: rgba(17,17,16,0.25);"></i>
                    </div>
                </div>

                <div class="producto-info">
                    <h3 class="producto-nombre">${p.nombre}</h3>
                    <p class="producto-precio">Desde $${Number(p.precio_desde).toFixed(2)}</p>

                    <div class="producto-opciones">
                        <select data-accion="talla" class="producto-talla">
                            ${tallas.map(t => `<option value="${t}" ${t === seleccionTalla[p.slug] ? 'selected' : ''}>Talla ${t}</option>`).join('')}
                        </select>
                        <div class="producto-cantidad">
                            <button type="button" data-accion="restar" aria-label="Restar cantidad">−</button>
                            <span data-cantidad>${seleccionCantidad[p.slug]}</span>
                            <button type="button" data-accion="sumar" aria-label="Sumar cantidad">+</button>
                        </div>
                    </div>

                    <button type="button" data-accion="encargar" class="producto-cta">
                        Encargar <i class="fa-brands fa-whatsapp"></i>
                    </button>
                </div>
            </div>`;
        }).join('');

        grid.querySelectorAll('.product').forEach(tarjeta => {
            const slug = tarjeta.dataset.slug;
            tarjeta.querySelector('[data-accion="talla"]').addEventListener('change', e => { seleccionTalla[slug] = e.target.value; });
            tarjeta.querySelector('[data-accion="restar"]').addEventListener('click', () => cambiarCantidad(slug, -1, tarjeta));
            tarjeta.querySelector('[data-accion="sumar"]').addEventListener('click', () => cambiarCantidad(slug, 1, tarjeta));
            tarjeta.querySelector('[data-accion="encargar"]').addEventListener('click', () => encargar(slug));
        });

        revelarCatalogo();
    }

    document.addEventListener('DOMContentLoaded', cargarCatalogo);
}

window.iniciarCatalogo = iniciarCatalogo;
