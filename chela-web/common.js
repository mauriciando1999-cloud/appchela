// common.js - Lógica compartida por todas las páginas de Chela (header, menú móvil, WhatsApp, footer).

// Valores de respaldo: el sitio funciona con estos incluso antes de que
// cargue la configuración real desde Supabase (chela_web_config), o si no
// hay conexión. Editables desde admin.html → Ajustes del Sitio, sin tocar código.
const WHATSAPP_NUMERO_DEFECTO = '584122969255'; // 0412-2969255 en formato internacional
const MENSAJES_WHATSAPP_DEFECTO = {
    general: 'Hola, quiero hacer un pedido de ropa por encargo.',
    corporativo: 'Hola, quisiera cotizar uniformes para impulsar la imagen de mi empresa.',
    emprendedores: 'Hola, tengo mi propia marca y quiero cotizar producción al mayor con mi etiqueta.',
    novias: 'Hola, quiero consultar sobre un vestido de novia hecho a la medida.'
};
const UTILITY_BAR_DEFECTO = {
    izquierda: '32 años de trayectoria',
    derecha: 'Ropa por encargo · Entrega en toda Caracas'
};

let WHATSAPP_NUMERO = WHATSAPP_NUMERO_DEFECTO;
let MENSAJES_WHATSAPP = { ...MENSAJES_WHATSAPP_DEFECTO };

function linkWhatsApp(mensaje) {
    return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensaje)}`;
}

// Todo envío de WhatsApp del sitio (links [data-wa], "Encargar" del catálogo,
// "Cotiza tu diseño") pasa primero por el modal de Términos y Condiciones —
// no se abre WhatsApp hasta que el usuario marca el check de verificación.
// El link real queda en el href (accesible, se puede copiar/clic-derecho),
// pero el clic normal siempre lo intercepta el modal.
function inicializarWhatsAppLinks() {
    document.querySelectorAll('[data-wa]').forEach(el => {
        const tipo = el.getAttribute('data-wa') || 'general';
        el.href = linkWhatsApp(MENSAJES_WHATSAPP[tipo] || MENSAJES_WHATSAPP.general);
        if (!el.dataset.waListo) {
            el.dataset.waListo = '1';
            el.addEventListener('click', e => {
                e.preventDefault();
                abrirWhatsAppConTerminos(el.href);
            });
        }
    });
}

// Trae la configuración editable del admin (número de WhatsApp, textos de la
// barra superior, mensajes iniciales por sección) y la aplica al sitio. Si
// una clave no existe todavía en la tabla, se queda con el valor de respaldo
// de arriba — nunca se rompe nada por configuración incompleta.
async function aplicarConfiguracionSitio() {
    if (typeof _sb === 'undefined') return;

    const { data, error } = await _sb.from('chela_web_config').select('clave, valor');
    if (error || !data) return;

    const config = {};
    data.forEach(row => { if (row.valor) config[row.clave] = row.valor; });

    if (config.whatsapp_numero) WHATSAPP_NUMERO = config.whatsapp_numero;
    ['general', 'corporativo', 'emprendedores', 'novias'].forEach(tipo => {
        if (config[`mensaje_wa_${tipo}`]) MENSAJES_WHATSAPP[tipo] = config[`mensaje_wa_${tipo}`];
    });
    inicializarWhatsAppLinks(); // reaplica: ya se había aplicado una vez con los valores de respaldo

    const barIzq = document.getElementById('utility-bar-izq');
    const barDer = document.getElementById('utility-bar-der');
    if (barIzq) barIzq.textContent = config.utility_bar_texto_izq || UTILITY_BAR_DEFECTO.izquierda;
    if (barDer) barDer.textContent = config.utility_bar_texto_der || UTILITY_BAR_DEFECTO.derecha;
}

// El menú móvil queda en el DOM oculto (Tailwind "hidden") y se despliega con
// una transición de altura: se quita "hidden" y, un frame después, se añade
// "abierto" para que la transición CSS tenga de dónde partir. Al cerrar se
// hace a la inversa, esperando a que termine la transición antes de volver
// a "hidden" (si no, el contenido se recorta antes de tiempo).
function inicializarMenuMovil() {
    const btnMenu = document.getElementById('btn-menu-movil');
    const menuMovil = document.getElementById('menu-movil');
    if (!btnMenu || !menuMovil) return;

    const abrir = () => {
        menuMovil.classList.remove('hidden');
        requestAnimationFrame(() => menuMovil.classList.add('abierto'));
    };
    const cerrar = () => {
        menuMovil.classList.remove('abierto');
        setTimeout(() => menuMovil.classList.add('hidden'), 360);
    };

    btnMenu.addEventListener('click', () => {
        if (menuMovil.classList.contains('abierto')) cerrar();
        else abrir();
    });
    menuMovil.querySelectorAll('a').forEach(a => a.addEventListener('click', cerrar));
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

// Quita la clase "entrada" del hero partido (Inicio) apenas termina su
// secuencia de aparición en cascada. Es necesario: si se dejara puesta, la
// animación (con fill "forwards") seguiría fijando la opacidad de los
// paneles por encima de las transiciones que después usa la rotación de
// fotos, y el cambio de foto dejaría de verse.
function inicializarEntradaHero() {
    const panelesConEntrada = document.querySelectorAll('.split-hero-panel.entrada');
    const centro = document.querySelector('.split-hero-centro.entrada');
    if (panelesConEntrada.length === 0 && !centro) return;

    setTimeout(() => {
        panelesConEntrada.forEach(el => el.classList.remove('entrada'));
        if (centro) centro.classList.remove('entrada');
    }, 1900);
}

// Espacios de Inicio que representan un catálogo concreto: si el admin no subió
// una foto manual para ese espacio (chela_web_imagenes), se completan solas con
// fotos reales de ESE catálogo/categoría — así cada sección siempre muestra lo
// que realmente vende, nunca una foto de otra sección. Emprendedores/Novias no
// tienen catálogo propio, así que esos espacios se quedan solo con lo manual.
//
// Los paneles "Para Él"/"Para Ella" del hero son distintos: SIEMPRE deben
// mostrar fotos reales del Marketplace por género (siempreCatalogo: true),
// aunque exista alguna foto manual vieja cargada para ese espacio — para
// que nunca queden desincronizados de lo que de verdad hay en el catálogo.
const CATALOGO_POR_SLOT = {
    panel_para_ella: { seccion: 'marketplace', genero: 'mujer', siempreCatalogo: true },
    panel_para_el: { seccion: 'marketplace', genero: 'hombre', siempreCatalogo: true },
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
    if (filtro.genero) consulta = consulta.eq('genero', filtro.genero);

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
    // Los marcados con siempreCatalogo ignoran la foto manual y siempre traen del catálogo.
    await Promise.all(Object.entries(CATALOGO_POR_SLOT).map(async ([clave, filtro]) => {
        if (!filtro.siempreCatalogo && porClave[clave] && porClave[clave].length > 0) return;
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

    const esFondo = el.tagName !== 'IMG' && el.tagName !== 'VIDEO';
    // El hero de Inicio (.split-hero-panel) ya garantiza overflow:hidden,
    // así que ahí el cambio de foto se ve con fundido + un acercamiento que
    // se deshace despacio (clases .rotacion-*, definidas en styles.css). En
    // el resto del sitio se mantiene el fundido simple de siempre.
    const conAcercamiento = esFondo && el.classList.contains('split-hero-panel');
    if (conAcercamiento) {
        // Arranca en 1.06 sin transición (para no animar el estado inicial)
        // y recién después activa la transición y suelta hacia 1 en 6s —
        // así la primera foto se comporta igual que cada rotación siguiente.
        el.classList.add('rotacion-acercando');
        void el.offsetWidth;
        el.classList.add('rotacion-fondo');
        requestAnimationFrame(() => el.classList.remove('rotacion-acercando'));
    }

    setInterval(() => {
        i = (i + 1) % urls.length;
        if (!esFondo) {
            aplicarImagenAElemento(el, urls[i]);
            return;
        }
        if (conAcercamiento) {
            el.classList.add('rotacion-oculta');
            setTimeout(() => {
                aplicarImagenAElemento(el, urls[i]);
                el.style.transition = 'none';
                el.classList.add('rotacion-acercando');
                void el.offsetWidth; // fuerza reflow: el salto a 1.06 no debe animarse
                el.style.transition = '';
                el.classList.remove('rotacion-oculta');
                el.classList.remove('rotacion-acercando');
            }, 900);
        } else {
            el.style.transition = 'opacity 0.6s ease';
            el.style.opacity = '0';
            setTimeout(() => {
                aplicarImagenAElemento(el, urls[i]);
                el.style.opacity = '1';
            }, 600);
        }
    }, 6000);
}

// Anima la entrada de cualquier elemento [data-reveal] cuando entra en pantalla
// (fade + subida). Se puede volver a llamar tras inyectar contenido dinámico
// (p.ej. el grid del catálogo) para que también revele lo nuevo. Los elementos
// ya animados se marcan con "reveal-listo" para no observarlos dos veces.
function inicializarRevelado(raiz) {
    const contenedor = raiz || document;
    const elementos = contenedor.querySelectorAll('[data-reveal]:not(.reveal-listo)');
    if (elementos.length === 0) return;

    if (!('IntersectionObserver' in window)) {
        elementos.forEach(el => el.classList.add('is-visible', 'reveal-listo'));
        return;
    }

    const indicePorPadre = new Map();
    elementos.forEach(el => {
        el.classList.add('reveal-listo');
        const indice = indicePorPadre.get(el.parentElement) || 0;
        el.style.transitionDelay = `${Math.min(indice, 5) * 70}ms`;
        indicePorPadre.set(el.parentElement, indice + 1);
    });

    const observador = new IntersectionObserver((entradas) => {
        entradas.forEach(entrada => {
            if (!entrada.isIntersecting) return;
            entrada.target.classList.add('is-visible');
            observador.unobserve(entrada.target);
        });
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

    elementos.forEach(el => observador.observe(el));
}
window.inicializarRevelado = inicializarRevelado;

// ==========================================================
// MODAL DE TÉRMINOS Y CONDICIONES antes de abrir WhatsApp
// Se inyecta una sola vez por página. abrirWhatsAppConTerminos(url) es el
// único punto de entrada — lo usan los links [data-wa], el "Encargar" del
// catálogo (catalogo.js) y "Cotiza tu diseño" (cotizar.js). El botón de
// continuar queda deshabilitado hasta marcar el checkbox.
// ==========================================================
const TEXTO_TERMINOS_MODAL = `
    <h4>Naturaleza del servicio</h4>
    <p>Chela confecciona <strong>por encargo</strong>: la mayoría de las prendas se elaboran una vez confirmado el
    pedido, no como stock listo para despacho inmediato. Los vestidos de novia, de damas de honor, las batas y
    cualquier pedido de "Cotiza tu propio diseño" se confeccionan además completamente <strong>a la medida</strong>
    del cliente. Precios, telas y tiempos de entrega del catálogo son referenciales y se confirman por WhatsApp
    antes de iniciar la confección.</p>

    <h4>Sistema de pago</h4>
    <p><strong>50% de adelanto</strong> al confirmar el pedido (cubre materiales e inicio de producción) y
    <strong>50% restante contra la entrega</strong> del producto terminado. Un pedido no entra en producción hasta
    confirmarse la recepción del adelanto. El método de pago se coordina por WhatsApp.</p>

    <h4>Devoluciones y cambios</h4>
    <p>Por ser prendas hechas por encargo o a la medida —que no pueden reintegrarse al inventario ni revenderse—
    <strong>no se aceptan devoluciones por cambio de opinión</strong>. Sí se corrige o repone sin costo cuando hay
    un defecto de fabricación, o cuando la prenda no corresponde a lo acordado por WhatsApp, si se reporta dentro
    de los 5 días hábiles siguientes a la entrega, con fotos.</p>

    <h4>Garantía</h4>
    <p>15 días desde la entrega, exclusivamente sobre defectos de fabricación (costuras, materiales). No cubre
    desgaste normal, mal uso, lavado inadecuado ni modificaciones hechas por terceros.</p>

    <h4>Fotos de referencia que envías</h4>
    <p>Al enviarnos una foto de referencia (por WhatsApp o por "Cotiza tu diseño"), declaras tener derecho a
    compartirla y nos autorizas a usarla únicamente para confeccionar tu pedido. Podemos rechazar un diseño si
    infringe derechos de terceros o su contenido es inapropiado.</p>

    <h4>Datos personales</h4>
    <p>Tus datos (nombre, teléfono, medidas, dirección) se usan solo para gestionar tu pedido y su entrega — no se
    venden ni comparten con terceros salvo lo estrictamente necesario para despachar el pedido.</p>

    <h4>Ley aplicable</h4>
    <p>Estos términos se rigen por las leyes de la República Bolivariana de Venezuela y la normativa de protección
    al consumidor vigente. Cualquier controversia se intenta resolver primero de forma directa; de no ser posible,
    ante la SUNDDE o los tribunales competentes.</p>

    <p style="margin-top:1rem;">Este resumen no reemplaza el documento completo — puedes leerlo entero en
    <a href="terminos.html" target="_blank" rel="noopener">Términos y Condiciones</a>.</p>
`;

function inicializarModalTerminos() {
    if (document.getElementById('modal-terminos')) return;

    const modal = document.createElement('div');
    modal.id = 'modal-terminos';
    modal.className = 'fixed inset-0 z-[60] hidden flex items-center justify-center p-4';
    modal.innerHTML = `
        <div id="modal-terminos-fondo" class="modal-terminos-fondo"></div>
        <div class="modal-terminos-caja surface">
            <div class="flex items-start justify-between gap-4 mb-4">
                <div>
                    <span class="eyebrow">Antes de continuar</span>
                    <h3 class="font-display text-xl mt-1">Términos y Condiciones</h3>
                </div>
                <button type="button" id="modal-terminos-cerrar" class="w-8 h-8 flex items-center justify-center shrink-0" style="border: 1px solid var(--line);" aria-label="Cerrar">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>

            <div class="legal-doc-mini">${TEXTO_TERMINOS_MODAL}</div>

            <label class="modal-terminos-check">
                <input type="checkbox" id="modal-terminos-checkbox">
                <span>He leído y acepto los <a href="terminos.html" target="_blank" rel="noopener">Términos y Condiciones</a>, incluyendo la política de pago (50% adelanto / 50% contra entrega) y de devoluciones.</span>
            </label>

            <button type="button" id="modal-terminos-continuar" class="btn-solid w-full" disabled>
                <i class="fa-brands fa-whatsapp"></i> Continuar a WhatsApp
            </button>
        </div>
    `;
    document.body.appendChild(modal);

    const checkbox = modal.querySelector('#modal-terminos-checkbox');
    const continuar = modal.querySelector('#modal-terminos-continuar');

    checkbox.addEventListener('change', () => { continuar.disabled = !checkbox.checked; });

    continuar.addEventListener('click', () => {
        if (!checkbox.checked || !modal.dataset.urlPendiente) return;
        window.open(modal.dataset.urlPendiente, '_blank', 'noopener');
        cerrarModalTerminos();
    });

    modal.querySelector('#modal-terminos-cerrar').addEventListener('click', cerrarModalTerminos);
    modal.querySelector('#modal-terminos-fondo').addEventListener('click', cerrarModalTerminos);
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) cerrarModalTerminos();
    });
}

function cerrarModalTerminos() {
    const modal = document.getElementById('modal-terminos');
    if (!modal) return;
    modal.classList.remove('visible');
    setTimeout(() => modal.classList.add('hidden'), 220);
}

function abrirWhatsAppConTerminos(url) {
    inicializarModalTerminos();
    const modal = document.getElementById('modal-terminos');
    const checkbox = document.getElementById('modal-terminos-checkbox');
    modal.dataset.urlPendiente = url;
    checkbox.checked = false;
    document.getElementById('modal-terminos-continuar').disabled = true;
    modal.querySelector('.modal-terminos-caja').scrollTop = 0;
    modal.classList.remove('hidden');
    requestAnimationFrame(() => modal.classList.add('visible'));
}
window.abrirWhatsAppConTerminos = abrirWhatsAppConTerminos;

document.addEventListener('DOMContentLoaded', () => {
    inicializarWhatsAppLinks();
    inicializarMenuMovil();
    inicializarAnioFooter();
    inicializarHeaderScroll();
    inicializarEntradaHero();
    aplicarImagenesSitio();
    aplicarConfiguracionSitio();
    inicializarModalTerminos();
    inicializarRevelado();
});
