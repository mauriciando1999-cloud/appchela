// catalogo.js - Catálogo genérico e instanciable. Cada llamada a
// iniciarCatalogo({...}) crea un catálogo independiente, con su propio
// filtro de categoría y su propia selección de talla/cantidad — así una
// misma página puede tener varios catálogos separados sin que se pisen
// entre sí (ej. Novias: Vestidos de Novia / Damas de Honor / Batas, cada
// uno con sus propios productos y categorías en Supabase).
//
// Uso: <script src="catalogo.js"></script>
//      <script>iniciarCatalogo({ seccion: 'marketplace', idFiltros: 'filtros-categoria', idGrid: 'grid-catalogo', idFiltroTalla: 'filtros-talla' });</script>
//
// Si una página tiene más de un catálogo, cada uno necesita sus propios ids
// de contenedor (idFiltros/idGrid/idFiltroTalla, este último opcional) y,
// si además quieres que el filtro de categoría de cada uno viva en su
// propio parámetro de URL, pásale un "parametroCategoria" distinto (por
// defecto usa "categoria").

function iniciarCatalogo({ seccion, idFiltros, idGrid, idFiltroTalla, parametroCategoria }) {
    const seleccionTalla = {};
    const seleccionCantidad = {};
    let productosCatalogo = [];
    let categoriasCatalogo = [];
    let filtroCategoriaActivo = 'todos';
    let filtroGeneroActivo = 'todos';
    let filtroTallaActivo = 'todas';
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
        cont.innerHTML = chips.map(c => `<button type="button" data-categoria="${escaparHtml(c.valor)}" class="filtro-genero">${escaparHtml(c.nombre)}</button>`).join('');

        cont.querySelectorAll('.filtro-genero').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.categoria === filtroCategoriaActivo);
            btn.addEventListener('click', () => filtrarPorCategoria(btn.dataset.categoria));
        });
    }

    // "Tu talla": filtro opcional arriba del catálogo. Junta todas las tallas
    // distintas que existan entre los productos cargados y las muestra como
    // chips — al elegir una, la grilla solo muestra productos que la tengan.
    function filtrarPorTalla(talla) {
        filtroTallaActivo = talla;
        const cont = document.getElementById(idFiltroTalla);
        if (cont) {
            cont.querySelectorAll('.filtro-genero').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.talla === talla);
            });
        }
        renderCatalogo();
    }

    function renderFiltroTalla() {
        if (!idFiltroTalla) return;
        const cont = document.getElementById(idFiltroTalla);
        if (!cont) return;

        const tallasUnicas = [...new Set(productosCatalogo.flatMap(p => (p.tallas && p.tallas.length > 0) ? p.tallas : ['Única']))];
        if (tallasUnicas.length <= 1) { cont.innerHTML = ''; return; }

        const chips = [{ nombre: 'Todas', valor: 'todas' }, ...tallasUnicas.map(t => ({ nombre: t, valor: t }))];
        cont.innerHTML = `<span class="eyebrow filtro-talla-label">Tu talla</span>` +
            chips.map(c => `<button type="button" data-talla="${escaparHtml(c.valor)}" class="filtro-genero">${escaparHtml(c.nombre)}</button>`).join('');

        cont.querySelectorAll('.filtro-genero').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.talla === filtroTallaActivo);
            btn.addEventListener('click', () => filtrarPorTalla(btn.dataset.talla));
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
        renderFiltroTalla();
        renderCatalogo();
    }

    function revelarCatalogo() {
        if (typeof window.inicializarRevelado === 'function') window.inicializarRevelado(document.getElementById(idGrid));
    }

    function cambiarCantidad(slug, delta, tarjeta) {
        seleccionCantidad[slug] = Math.max(1, (seleccionCantidad[slug] || 1) + delta);
        tarjeta.querySelector('[data-cantidad]').innerText = seleccionCantidad[slug];
    }

    // Dial de talla: se arrastra el slider y el número grande va cambiando en
    // vivo, como un contador. El "tick" (rebote chico del número) solo se
    // dispara cuando el valor snapeado realmente cambia, no en cada pixel de
    // arrastre — y se retira/repone con un reflow forzado para poder
    // repetirse aunque el valor caiga dos veces seguidas en el mismo tick.
    function actualizarTalla(slug, tallas, indice, tarjeta) {
        const valorAnterior = seleccionTalla[slug];
        const nuevoValor = tallas[indice];
        seleccionTalla[slug] = nuevoValor;

        const display = tarjeta.querySelector('[data-talla-valor]');
        if (display && valorAnterior !== nuevoValor) {
            display.textContent = nuevoValor;
            display.classList.remove('tick');
            void display.offsetWidth;
            display.classList.add('tick');
        }

        tarjeta.querySelectorAll('[data-tick]').forEach((t, i) => {
            t.classList.toggle('activo', i === indice);
        });
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
        window.abrirWhatsAppConTerminos(linkWhatsApp(mensaje));
    }

    function renderCatalogo() {
        const grid = document.getElementById(idGrid);
        if (!grid) return;

        const productosFiltrados = productosCatalogo.filter(p => {
            const tallasProducto = (p.tallas && p.tallas.length > 0) ? p.tallas : ['Única'];
            return (filtroCategoriaActivo === 'todos' || p.categoria === filtroCategoriaActivo) &&
                (filtroGeneroActivo === 'todos' || p.genero === filtroGeneroActivo || p.genero === 'unisex') &&
                (filtroTallaActivo === 'todas' || tallasProducto.includes(filtroTallaActivo));
        });

        if (productosFiltrados.length === 0) {
            grid.innerHTML = `<p class="text-center text-muted text-xs col-span-full py-10">Ningún producto coincide con tu talla en esta categoría todavía.</p>`;
            return;
        }

        grid.innerHTML = productosFiltrados.map(p => {
            const tallas = (p.tallas && p.tallas.length > 0) ? p.tallas : ['Única'];
            if (seleccionTalla[p.slug] === undefined) {
                seleccionTalla[p.slug] = (filtroTallaActivo !== 'todas' && tallas.includes(filtroTallaActivo)) ? filtroTallaActivo : tallas[0];
            }
            if (seleccionCantidad[p.slug] === undefined) seleccionCantidad[p.slug] = 1;

            const rutaImagen = /^https?:\/\//.test(p.imagen || '') ? p.imagen : `assets/productos/${p.imagen || ''}`;
            const indiceActual = Math.max(0, tallas.indexOf(seleccionTalla[p.slug]));

            const dialTalla = tallas.length <= 1
                ? `<p class="producto-talla-unica">Talla ${escaparHtml(tallas[0])}</p>`
                : `
                    <div class="producto-talla-dial">
                        <div class="producto-talla-valor tick" data-talla-valor>${escaparHtml(tallas[indiceActual])}</div>
                        <input type="range" class="producto-talla-slider" data-accion="talla-slider"
                               min="0" max="${tallas.length - 1}" step="1" value="${indiceActual}"
                               aria-label="Deslizar para elegir talla">
                        <div class="producto-talla-ticks">
                            ${tallas.map((t, i) => `<span data-tick class="${i === indiceActual ? 'activo' : ''}">${escaparHtml(t)}</span>`).join('')}
                        </div>
                    </div>`;

            return `
            <div class="product" data-reveal data-slug="${escaparHtml(p.slug)}">
                <div class="product-media mb-4">
                    <img src="${escaparHtml(rutaImagen)}" alt="${escaparHtml(p.nombre)}"
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div style="display:none;" class="w-full h-full items-center justify-center absolute inset-0">
                        <i class="fa-solid ${escaparHtml(p.icono || 'fa-shirt')} text-4xl" style="color: rgba(17,17,16,0.25);"></i>
                    </div>
                </div>

                <div class="producto-info">
                    <h3 class="producto-nombre">${escaparHtml(p.nombre)}</h3>
                    <p class="producto-precio">Desde $${Number(p.precio_desde).toFixed(2)}</p>

                    ${dialTalla}

                    <div class="producto-cantidad-fila">
                        <span class="producto-cantidad-label">Cantidad</span>
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
            const producto = productosCatalogo.find(x => x.slug === slug);
            const tallas = (producto.tallas && producto.tallas.length > 0) ? producto.tallas : ['Única'];

            const slider = tarjeta.querySelector('[data-accion="talla-slider"]');
            if (slider) {
                slider.addEventListener('input', () => actualizarTalla(slug, tallas, Number(slider.value), tarjeta));
            }
            tarjeta.querySelectorAll('[data-tick]').forEach((tick, i) => {
                tick.addEventListener('click', () => {
                    if (slider) slider.value = i;
                    actualizarTalla(slug, tallas, i, tarjeta);
                });
            });

            tarjeta.querySelector('[data-accion="restar"]').addEventListener('click', () => cambiarCantidad(slug, -1, tarjeta));
            tarjeta.querySelector('[data-accion="sumar"]').addEventListener('click', () => cambiarCantidad(slug, 1, tarjeta));
            tarjeta.querySelector('[data-accion="encargar"]').addEventListener('click', () => encargar(slug));
        });

        revelarCatalogo();
    }

    document.addEventListener('DOMContentLoaded', cargarCatalogo);
}

window.iniciarCatalogo = iniciarCatalogo;
