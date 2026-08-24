// admin.js - Panel de administración del catálogo de Chela (chela_web_productos).

const BUCKET_PRODUCTOS = 'chela-productos';
let productosAdmin = [];

function rutaStorageDesdeUrl(url) {
    const marcador = `/storage/v1/object/public/${BUCKET_PRODUCTOS}/`;
    const idx = typeof url === 'string' ? url.indexOf(marcador) : -1;
    return idx === -1 ? null : url.slice(idx + marcador.length);
}

// Redimensiona y recomprime la foto en el propio navegador antes de subirla,
// así el peso final en Supabase Storage es pequeño sin importar el tamaño original.
// formato 'image/png' conserva transparencia (para el logo); el resto usa JPEG.
async function comprimirImagen(file, maxDim = 1400, calidad = 0.82, formato = 'image/jpeg') {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;
    if (width > maxDim || height > maxDim) {
        const escala = maxDim / Math.max(width, height);
        width = Math.round(width * escala);
        height = Math.round(height * escala);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
    return new Promise(resolve => canvas.toBlob(resolve, formato, formato === 'image/png' ? undefined : calidad));
}

window.subirImagenProducto = async function (event) {
    const file = event.target.files[0];
    if (!file) return;
    const status = document.getElementById('f-imagen-status');

    try {
        status.innerText = 'Comprimiendo...';
        const blob = await comprimirImagen(file);

        status.innerText = 'Subiendo...';
        const nombreArchivo = `${Date.now()}-${Math.random().toString(16).slice(2)}.jpg`;
        const { error } = await _sb.storage.from(BUCKET_PRODUCTOS).upload(nombreArchivo, blob, {
            contentType: 'image/jpeg',
            cacheControl: '31536000'
        });
        if (error) throw error;

        const { data } = _sb.storage.from(BUCKET_PRODUCTOS).getPublicUrl(nombreArchivo);
        document.getElementById('f-imagen').value = data.publicUrl;
        actualizarPreviewImagen();
        status.innerText = `Foto subida (${Math.round(blob.size / 1024)} KB).`;
    } catch (err) {
        status.innerText = 'Error al subir: ' + err.message;
    } finally {
        event.target.value = '';
    }
};

window.actualizarPreviewImagen = function () {
    const url = document.getElementById('f-imagen').value.trim();
    const img = document.getElementById('f-imagen-preview');
    const icono = document.getElementById('f-imagen-preview-icono');
    if (url) {
        img.src = url;
        img.classList.remove('hidden');
        icono.classList.add('hidden');
    } else {
        img.classList.add('hidden');
        icono.classList.remove('hidden');
    }
};

window.onload = async () => {
    const { data: { user } } = await _sb.auth.getUser();

    if (!user) {
        mostrarPantalla('auth-screen');
        return;
    }

    if (user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        mostrarPantalla('denegado-screen');
        return;
    }

    mostrarPantalla('app-content');
    await cargarCategoriasAdmin();
    await Promise.all([cargarProductosAdmin(), cargarImagenesSitio()]);
};

// ==========================================================
// CATEGORÍAS (por sección: marketplace / corporativo)
// Se usan como filtros en el catálogo público y como opciones al crear/editar
// un producto. Cada sección tiene su propia lista, totalmente independiente.
// ==========================================================
let categoriasAdmin = { marketplace: [], corporativo: [] };

async function cargarCategoriasAdmin() {
    const { data, error } = await _sb.from('chela_web_categorias').select('*').order('orden', { ascending: true });
    if (error) { console.error('Error al cargar categorías:', error); return; }
    categoriasAdmin = { marketplace: [], corporativo: [] };
    (data || []).forEach(c => { if (categoriasAdmin[c.seccion]) categoriasAdmin[c.seccion].push(c); });
    renderCategoriasAdmin();
    renderSelectCategoriaForm();
}

function renderCategoriasAdmin() {
    ['marketplace', 'corporativo'].forEach(seccion => {
        const cont = document.getElementById(`categorias-${seccion}`);
        if (!cont) return;
        const items = categoriasAdmin[seccion];
        cont.innerHTML = items.length === 0
            ? `<p class="text-muted text-xs">Sin categorías todavía.</p>`
            : items.map(c => `
                <span class="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase px-2.5 py-1.5 mr-1.5 mb-1.5" style="border: 1px solid var(--line-strong);">
                    ${c.nombre}
                    <button onclick="eliminarCategoria('${c.id}')" class="text-red-600"><i class="fa-solid fa-xmark"></i></button>
                </span>`).join('');
    });
}

window.agregarCategoria = async function (seccion) {
    const input = document.getElementById(`nueva-categoria-${seccion}`);
    const nombre = input.value.trim();
    if (!nombre) return;
    const orden = categoriasAdmin[seccion].length + 1;
    const { error } = await _sb.from('chela_web_categorias').insert({ seccion, nombre, orden });
    if (error) return alert('Error al agregar categoría: ' + error.message);
    input.value = '';
    await cargarCategoriasAdmin();
};

window.eliminarCategoria = async function (id) {
    if (!confirm('¿Eliminar esta categoría? Los productos que la usaban quedarán sin categoría asignada.')) return;
    const { error } = await _sb.from('chela_web_categorias').delete().eq('id', id);
    if (error) return alert('Error al eliminar: ' + error.message);
    await cargarCategoriasAdmin();
};

// Refresca las opciones del <select> de categoría en el formulario de producto
// según la sección elegida, conservando el valor actual si sigue existiendo.
window.renderSelectCategoriaForm = function () {
    const seccionSelect = document.getElementById('f-seccion');
    const categoriaSelect = document.getElementById('f-categoria');
    if (!seccionSelect || !categoriaSelect) return;

    const seccion = seccionSelect.value;
    const valorActual = categoriaSelect.value;
    const opciones = categoriasAdmin[seccion] || [];
    categoriaSelect.innerHTML = `<option value="">Sin categoría</option>` +
        opciones.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('');
    if (opciones.some(c => c.nombre === valorActual)) categoriaSelect.value = valorActual;
};

// ==========================================================
// IMÁGENES DEL SITIO (logo, paneles, módulos, bloques editoriales)
// Cada "clave" es un espacio de foto en el HTML (data-img-slot) y puede tener
// varias fotos — el sitio las rota automáticamente.
// ==========================================================
const SLOTS_IMAGENES_SITIO = [
    { clave: 'logo', descripcion: 'Logo (encabezado, todas las páginas)' },
    { clave: 'hero_poster', descripcion: 'Portada del video de Inicio' },
    { clave: 'panel_para_ella', descripcion: 'Panel "Para Ella" (Inicio)' },
    { clave: 'panel_para_el', descripcion: 'Panel "Para Él" (Inicio)' },
    { clave: 'modulo_marketplace', descripcion: 'Módulo Marketplace (Inicio)' },
    { clave: 'modulo_corporativo', descripcion: 'Módulo Corporativo (Inicio)' },
    { clave: 'modulo_emprendedores', descripcion: 'Módulo Emprendedores (Inicio)' },
    { clave: 'modulo_novias', descripcion: 'Módulo Novias (Inicio)' },
    { clave: 'editorial_novias_home', descripcion: 'Bloque editorial Novias (Inicio)' },
    { clave: 'editorial_corporativo', descripcion: 'Bloque editorial (página Corporativo)' },
    { clave: 'editorial_emprendedores', descripcion: 'Bloque editorial (página Emprendedores)' },
    { clave: 'editorial_novias_page', descripcion: 'Bloque editorial (página Novias)' }
];

let imagenesSitio = {}; // clave -> [{id, url}, ...]

async function cargarImagenesSitio() {
    const { data, error } = await _sb.from('chela_web_imagenes').select('*').order('orden', { ascending: true });
    if (error) { console.error('Error al cargar imágenes del sitio:', error); return; }
    imagenesSitio = {};
    (data || []).forEach(row => {
        if (!imagenesSitio[row.clave]) imagenesSitio[row.clave] = [];
        imagenesSitio[row.clave].push(row);
    });
    renderImagenesSitio();
}

function renderImagenesSitio() {
    const cont = document.getElementById('lista-imagenes-sitio');
    if (!cont) return;

    cont.innerHTML = SLOTS_IMAGENES_SITIO.map(s => {
        const fotos = imagenesSitio[s.clave] || [];
        const estado = fotos.length === 0 ? 'Usando marcador de posición'
            : fotos.length === 1 ? '1 foto'
            : `${fotos.length} fotos — rotan automáticamente`;

        return `
        <div class="surface p-4">
            <div class="flex items-center justify-between gap-3 mb-3">
                <div>
                    <p class="text-sm font-semibold">${s.descripcion}</p>
                    <p class="text-[10px] text-muted mt-0.5">${estado}</p>
                </div>
                <div class="shrink-0">
                    <input type="file" id="file-${s.clave}" accept="image/*" class="hidden" onchange="subirImagenSitio('${s.clave}', event)">
                    <button type="button" onclick="document.getElementById('file-${s.clave}').click()" class="text-[10px] font-bold uppercase px-3 py-1.5" style="border: 1px solid var(--line-strong);">
                        <i class="fa-solid fa-plus"></i> Agregar
                    </button>
                </div>
            </div>
            <div class="flex flex-wrap gap-2">
                ${fotos.map(f => `
                    <div class="relative w-16 h-16 flex-shrink-0" style="border: 1px solid var(--line);">
                        <img src="${f.url}" class="w-full h-full object-cover">
                        <button onclick="eliminarImagenSitio('${f.id}', '${s.clave}')" class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center leading-none">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>`).join('')}
            </div>
            <p id="status-${s.clave}" class="text-[10px] text-muted mt-2"></p>
        </div>`;
    }).join('');
}

window.subirImagenSitio = async function (clave, event) {
    const file = event.target.files[0];
    if (!file) return;
    const status = document.getElementById(`status-${clave}`);

    try {
        status.innerText = 'Comprimiendo...';
        const esLogo = clave === 'logo';
        const formato = esLogo ? 'image/png' : 'image/jpeg';
        const blob = await comprimirImagen(file, 1400, 0.82, formato);

        status.innerText = 'Subiendo...';
        const ext = esLogo ? 'png' : 'jpg';
        const nombreArchivo = `sitio-${clave}-${Date.now()}.${ext}`;
        const { error } = await _sb.storage.from(BUCKET_PRODUCTOS).upload(nombreArchivo, blob, {
            contentType: formato,
            cacheControl: '31536000'
        });
        if (error) throw error;

        const { data } = _sb.storage.from(BUCKET_PRODUCTOS).getPublicUrl(nombreArchivo);
        const ordenSiguiente = (imagenesSitio[clave] || []).length;
        const { error: errorInsert } = await _sb.from('chela_web_imagenes').insert({ clave, url: data.publicUrl, orden: ordenSiguiente });
        if (errorInsert) throw errorInsert;

        status.innerText = '';
        await cargarImagenesSitio();
    } catch (err) {
        status.innerText = 'Error al subir: ' + err.message;
    } finally {
        event.target.value = '';
    }
};

window.eliminarImagenSitio = async function (id, clave) {
    if (!confirm('¿Quitar esta foto? Si era la única del espacio, vuelve a mostrarse el marcador de posición.')) return;

    const foto = (imagenesSitio[clave] || []).find(f => f.id === id);
    const { error } = await _sb.from('chela_web_imagenes').delete().eq('id', id);
    if (error) return alert('Error al eliminar: ' + error.message);

    const ruta = foto ? rutaStorageDesdeUrl(foto.url) : null;
    if (ruta) await _sb.storage.from(BUCKET_PRODUCTOS).remove([ruta]);

    await cargarImagenesSitio();
};

function mostrarPantalla(id) {
    ['auth-screen', 'denegado-screen', 'app-content'].forEach(s => {
        document.getElementById(s).classList.toggle('hidden', s !== id);
    });
}

window.handleLogin = async function (e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerText;
    btn.innerText = 'Ingresando...';
    const errorBox = document.getElementById('login-error');
    errorBox.classList.add('hidden');

    const { error } = await _sb.auth.signInWithPassword({
        email: document.getElementById('login-email').value,
        password: document.getElementById('login-pass').value
    });

    if (error) {
        errorBox.innerText = error.message;
        errorBox.classList.remove('hidden');
        btn.innerText = originalText;
    } else {
        window.location.reload();
    }
};

window.handleLogout = function () {
    _sb.auth.signOut().then(() => window.location.reload());
};

async function cargarProductosAdmin() {
    const { data, error } = await _sb.from('chela_web_productos').select('*').order('orden', { ascending: true });
    if (error) {
        ['lista-admin-marketplace', 'lista-admin-corporativo'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = `<p class="text-red-600 text-xs col-span-full">Error al cargar: ${error.message}</p>`;
        });
        return;
    }
    productosAdmin = data || [];
    renderListaAdmin();
}

function renderListaAdmin() {
    ['marketplace', 'corporativo'].forEach(seccion => {
        const cont = document.getElementById(`lista-admin-${seccion}`);
        if (!cont) return;

        const items = productosAdmin.filter(p => (p.seccion || 'marketplace') === seccion);
        if (items.length === 0) {
            cont.innerHTML = `<p class="text-muted text-xs col-span-full text-center py-8">Todavía no hay productos en esta sección.</p>`;
            return;
        }

        cont.innerHTML = items.map(p => `
            <div class="surface p-4 flex gap-3 ${p.activo ? '' : 'opacity-50'}">
                <div class="w-16 h-16 overflow-hidden flex-shrink-0 flex items-center justify-center" style="background: var(--bg); border: 1px solid var(--line);">
                    <i class="fa-solid ${p.icono || 'fa-shirt'} text-2xl" style="color: var(--ink-muted);"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold truncate">${p.nombre}</p>
                    <p class="text-[10px] text-muted uppercase font-bold mt-0.5">Desde $${Number(p.precio_desde).toFixed(2)} · orden ${p.orden}</p>
                    <p class="text-[10px] text-muted mt-0.5">${p.categoria || 'Sin categoría'} · ${p.activo ? 'Visible' : 'Oculto'}</p>
                    <div class="flex gap-2 mt-2">
                        <button onclick="abrirFormProducto('${p.id}')" class="text-[10px] font-bold uppercase px-3 py-1.5" style="border: 1px solid var(--line-strong);">Editar</button>
                        <button onclick="toggleActivo('${p.id}', ${!p.activo})" class="text-[10px] font-bold uppercase px-3 py-1.5" style="border: 1px solid var(--line);">${p.activo ? 'Ocultar' : 'Mostrar'}</button>
                        <button onclick="eliminarProducto('${p.id}')" class="text-[10px] font-bold uppercase px-3 py-1.5 bg-red-100 text-red-700">Eliminar</button>
                    </div>
                </div>
            </div>`).join('');
    });
}

window.abrirFormProducto = function (id, seccionPreseleccionada) {
    const p = id ? productosAdmin.find(x => x.id === id) : null;
    document.getElementById('modal-titulo').innerText = p ? 'Editar Producto' : 'Nuevo Producto';
    document.getElementById('f-id').value = p ? p.id : '';
    document.getElementById('f-nombre').value = p ? p.nombre : '';
    document.getElementById('f-descripcion').value = p ? (p.descripcion || '') : '';
    document.getElementById('f-precio').value = p ? p.precio_desde : '';
    document.getElementById('f-orden').value = p ? p.orden : (productosAdmin.length + 1);
    document.getElementById('f-tallas').value = p && p.tallas ? p.tallas.join(',') : '';
    document.getElementById('f-genero').value = p ? (p.genero || 'unisex') : 'unisex';
    document.getElementById('f-seccion').value = p ? (p.seccion || 'marketplace') : (seccionPreseleccionada || 'marketplace');
    renderSelectCategoriaForm();
    document.getElementById('f-categoria').value = p ? (p.categoria || '') : '';
    document.getElementById('f-imagen').value = p ? (p.imagen || '') : '';
    document.getElementById('f-icono').value = p ? (p.icono || 'fa-shirt') : 'fa-shirt';
    document.getElementById('f-activo').checked = p ? p.activo : true;
    document.getElementById('f-imagen-status').innerText = '';
    actualizarPreviewImagen();
    document.getElementById('modal-producto').classList.remove('hidden');
};

window.cerrarFormProducto = function () {
    document.getElementById('modal-producto').classList.add('hidden');
};

function generarSlug(nombre) {
    return nombre.toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita acentos
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

window.guardarProducto = async function () {
    const id = document.getElementById('f-id').value;
    const nombre = document.getElementById('f-nombre').value.trim();
    if (!nombre) return alert('El nombre es obligatorio.');

    const tallas = document.getElementById('f-tallas').value
        .split(',').map(t => t.trim()).filter(Boolean);

    const payload = {
        nombre,
        descripcion: document.getElementById('f-descripcion').value.trim(),
        precio_desde: parseFloat(document.getElementById('f-precio').value) || 0,
        orden: parseInt(document.getElementById('f-orden').value) || 0,
        tallas: tallas.length > 0 ? tallas : ['Única'],
        genero: document.getElementById('f-genero').value,
        seccion: document.getElementById('f-seccion').value,
        categoria: document.getElementById('f-categoria').value || null,
        imagen: document.getElementById('f-imagen').value.trim(),
        icono: document.getElementById('f-icono').value.trim() || 'fa-shirt',
        activo: document.getElementById('f-activo').checked
    };

    let error;
    if (id) {
        ({ error } = await _sb.from('chela_web_productos').update(payload).eq('id', id));
    } else {
        payload.slug = generarSlug(nombre) || `producto-${Date.now()}`;
        ({ error } = await _sb.from('chela_web_productos').insert(payload));
    }

    if (error) return alert('Error al guardar: ' + error.message);

    cerrarFormProducto();
    await cargarProductosAdmin();
};

window.toggleActivo = async function (id, nuevoValor) {
    await _sb.from('chela_web_productos').update({ activo: nuevoValor }).eq('id', id);
    await cargarProductosAdmin();
};

window.eliminarProducto = async function (id) {
    if (!confirm('¿Eliminar este producto del catálogo? Esta acción no se puede deshacer.')) return;

    const p = productosAdmin.find(x => x.id === id);
    const { error } = await _sb.from('chela_web_productos').delete().eq('id', id);
    if (error) return alert('Error al eliminar: ' + error.message);

    // Limpieza best-effort del archivo en Storage (si la foto se subió desde aquí).
    const ruta = p ? rutaStorageDesdeUrl(p.imagen) : null;
    if (ruta) await _sb.storage.from(BUCKET_PRODUCTOS).remove([ruta]);

    await cargarProductosAdmin();
};
