// common.js - Lógica compartida por todas las páginas de Chela (header, menú móvil, WhatsApp, footer).

const WHATSAPP_NUMERO = '584122969255'; // 0412-2969255 en formato internacional

function linkWhatsApp(mensaje) {
    return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensaje)}`;
}

const MENSAJES_WHATSAPP = {
    general: 'Hola, quiero hacer un pedido de ropa por encargo.',
    corporativo: 'Hola, quisiera cotizar uniformes para impulsar la imagen de mi empresa.',
    emprendedores: 'Hola, tengo mi propia marca y quiero cotizar producción al mayor con mi etiqueta.',
    novias: 'Hola, quiero consultar sobre un vestido de novia hecho a la medida.'
};

function inicializarWhatsAppLinks() {
    document.querySelectorAll('[data-wa]').forEach(el => {
        const tipo = el.getAttribute('data-wa') || 'general';
        el.href = linkWhatsApp(MENSAJES_WHATSAPP[tipo] || MENSAJES_WHATSAPP.general);
    });
}

function inicializarMenuMovil() {
    const btnMenu = document.getElementById('btn-menu-movil');
    const menuMovil = document.getElementById('menu-movil');
    if (!btnMenu || !menuMovil) return;
    btnMenu.addEventListener('click', () => menuMovil.classList.toggle('hidden'));
    menuMovil.querySelectorAll('a').forEach(a => a.addEventListener('click', () => menuMovil.classList.add('hidden')));
}

function inicializarAnioFooter() {
    const anio = document.getElementById('anio-actual');
    if (anio) anio.innerText = new Date().getFullYear();
}

// El header empieza transparente sobre el hero y se vuelve sólido al hacer scroll
// (solo aplica en páginas que marcan el header como "transparent", ej. index.html).
function inicializarHeaderScroll() {
    const header = document.getElementById('site-header');
    if (!header || !header.classList.contains('transparent')) return;

    const alScroll = () => {
        if (window.scrollY > 60) header.classList.remove('transparent');
        else header.classList.add('transparent');
    };
    window.addEventListener('scroll', alScroll, { passive: true });
    alScroll();
}

// Espacios de Inicio que representan un catálogo concreto: si el admin no subió
// una foto manual para ese espacio (chela_web_imagenes), se completan solas con
// fotos reales de ESE catálogo/categoría — así cada sección siempre muestra lo
// que realmente vende, nunca una foto de otra sección. Emprendedores/Novias no
// tienen catálogo propio, así que esos espacios se quedan solo con lo manual.
const CATALOGO_POR_SLOT = {
    panel_para_ella: { seccion: 'marketplace', categoria: 'Para Ella' },
    panel_para_el: { seccion: 'marketplace', categoria: 'Para Él' },
    modulo_marketplace: { seccion: 'marketplace' },
    modulo_corporativo: { seccion: 'corporativo' }
};

async function obtenerFotosDeCatalogo(filtro) {
    let consulta = _sb.from('chela_web_productos')
        .select('imagen')
        .eq('activo', true)
        .eq('seccion', filtro.seccion)
        .order('orden', { ascending: true })
        .limit(6);
    if (filtro.categoria) consulta = consulta.eq('categoria', filtro.categoria);

    const { data, error } = await consulta;
    if (error || !data) return [];
    return data.map(p => p.imagen).filter(url => typeof url === 'string' && /^https?:\/\//.test(url));
}

// Aplica las fotos administradas desde admin.html (tabla chela_web_imagenes) a
// cada elemento marcado con data-img-slot="clave". Si un espacio tiene varias
// fotos, rotan solas cada pocos segundos. Si no hay ninguna, se deja el
// marcador de posición que ya trae el HTML — nunca se ve un espacio vacío.
async function aplicarImagenesSitio() {
    if (typeof _sb === 'undefined') return;

    const { data, error } = await _sb.from('chela_web_imagenes').select('clave, url').order('orden', { ascending: true });
    const porClave = {};
    if (!error && data) {
        data.forEach(row => {
            if (!porClave[row.clave]) porClave[row.clave] = [];
            porClave[row.clave].push(row.url);
        });
    }

    // Completa con fotos reales del catálogo los espacios que no tienen foto manual
    // (solo si ese espacio existe de verdad en esta página, para no consultar de más).
    await Promise.all(Object.entries(CATALOGO_POR_SLOT).map(async ([clave, filtro]) => {
        if (porClave[clave] && porClave[clave].length > 0) return;
        if (!document.querySelector(`[data-img-slot="${clave}"]`)) return;
        const fotos = await obtenerFotosDeCatalogo(filtro);
        if (fotos.length > 0) porClave[clave] = fotos;
    }));

    Object.entries(porClave).forEach(([clave, urls]) => {
        document.querySelectorAll(`[data-img-slot="${clave}"]`).forEach(el => iniciarRotacionImagen(el, urls));
    });
}

function aplicarImagenAElemento(el, url) {
    if (el.tagName === 'IMG') el.src = url;
    else if (el.tagName === 'VIDEO') el.poster = url;
    else el.style.backgroundImage = `url('${url}')`;
}

function iniciarRotacionImagen(el, urls) {
    if (!urls || urls.length === 0) return;
    let i = 0;
    aplicarImagenAElemento(el, urls[0]);
    if (urls.length <= 1) return;

    setInterval(() => {
        i = (i + 1) % urls.length;
        const esFondo = el.tagName !== 'IMG' && el.tagName !== 'VIDEO';
        if (esFondo) {
            el.style.transition = 'opacity 0.6s ease';
            el.style.opacity = '0';
            setTimeout(() => {
                aplicarImagenAElemento(el, urls[i]);
                el.style.opacity = '1';
            }, 600);
        } else {
            aplicarImagenAElemento(el, urls[i]);
        }
    }, 6000);
}

document.addEventListener('DOMContentLoaded', () => {
    inicializarWhatsAppLinks();
    inicializarMenuMovil();
    inicializarAnioFooter();
    inicializarHeaderScroll();
    aplicarImagenesSitio();
});
