// preventa-config.js - Mapeo compartido Preventa Escolar <-> Inventario real (tabla `productos`)
// Usado por portal_preventa.html (resolver el pedido) y preventa-admin.js (Inventario/Producción).
// Mantener sincronizado en un solo lugar evita que ambos se desalineen.

const MAPA_ACENTOS = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ñ': 'n' };

function normalizarNombreProducto(s) {
    return (s || '')
        .toString()
        .toLowerCase()
        .split('').map(ch => MAPA_ACENTOS[ch] || ch).join('')
        .replace(/\s+/g, '');
}

// Plantillas de nombre base (sin talla) tal como existen en `productos.name`.
const PLANTILLA_CHAQUETA = 'Chaqueta Universitario';
const PLANTILLA_CHAQUETA_DEPORTIVA = 'Chaqueta Deportiva';
const PLANTILLA_FRANELA = 'Franela deportiva';
const PLANTILLA_PANTALON = 'Pantalon Gabardina';
const PLANTILLA_MONO = 'Mono Deportivo';
const PLANTILLA_PULLOVER = 'Pullover Escolar';
const PLANTILLA_CHEMISE_NINO = 'Chemise Niño Pique';
const PLANTILLA_CHEMISE_NINA = 'Chemise Niña Pique';

function plantillaChemise(genero) {
    return genero === 'nina' ? PLANTILLA_CHEMISE_NINA : PLANTILLA_CHEMISE_NINO;
}

// Todas las plantillas con talla que existen en el catálogo de preventa (para filtrar Inventario/Producción).
const PLANTILLAS_CON_TALLA = [
    PLANTILLA_CHAQUETA, PLANTILLA_CHAQUETA_DEPORTIVA, PLANTILLA_FRANELA, PLANTILLA_PANTALON, PLANTILLA_MONO,
    PLANTILLA_PULLOVER, PLANTILLA_CHEMISE_NINO, PLANTILLA_CHEMISE_NINA
];

// Productos adicionales sin talla que se pueden agregar en el paso de configuración.
const EXTRAS_DISPONIBLES = [
    { nombre: 'INSIGNIAS', label: 'Insignia', precio: 5.00 }
];

// Describe, por tipoBase de preventa, qué "roles" (componentes) hay que resolver.
// Cada rol: { rol, plantilla: fn(ctx)->string, talla: fn(ctx)->string }
// ctx = { genero, pantalonOMono, tallaSup, tallaInf }
const PRODUCT_TYPE_MAP = {
    chaqueta: [
        { rol: 'chaqueta', plantilla: () => PLANTILLA_CHAQUETA, talla: (ctx) => ctx.tallaSup }
    ],
    chaqueta_deportiva: [
        { rol: 'chaqueta_deportiva', plantilla: () => PLANTILLA_CHAQUETA_DEPORTIVA, talla: (ctx) => ctx.tallaSup }
    ],
    pullover: [
        { rol: 'pullover', plantilla: () => PLANTILLA_PULLOVER, talla: (ctx) => ctx.tallaSup }
    ],
    chemise: [
        { rol: 'chemise', plantilla: (ctx) => plantillaChemise(ctx.genero), talla: (ctx) => ctx.tallaSup }
    ],
    franela: [
        { rol: 'franela', plantilla: () => PLANTILLA_FRANELA, talla: (ctx) => ctx.tallaSup }
    ],
    pantalon: [
        { rol: 'pantalon', plantilla: () => PLANTILLA_PANTALON, talla: (ctx) => ctx.tallaInf }
    ],
    mono: [
        { rol: 'mono', plantilla: () => PLANTILLA_MONO, talla: (ctx) => ctx.tallaInf }
    ],
    diario: [
        { rol: 'chemise', plantilla: (ctx) => plantillaChemise(ctx.genero), talla: (ctx) => ctx.tallaSup },
        { rol: 'pantalon', plantilla: () => PLANTILLA_PANTALON, talla: (ctx) => ctx.tallaInf }
    ],
    combo: [
        { rol: 'chaqueta', plantilla: () => PLANTILLA_CHAQUETA, talla: (ctx) => ctx.tallaSup },
        { rol: 'chemise', plantilla: (ctx) => plantillaChemise(ctx.genero), talla: (ctx) => ctx.tallaSup },
        { rol: 'franela', plantilla: () => PLANTILLA_FRANELA, talla: (ctx) => ctx.tallaSup },
        { rol: 'pantalonOMono', plantilla: (ctx) => ctx.pantalonOMono === 'mono' ? PLANTILLA_MONO : PLANTILLA_PANTALON, talla: (ctx) => ctx.tallaInf }
    ]
};

// Construye el nombre esperado "Plantilla Talla X" para buscar en el índice normalizado.
function nombreEsperado(plantilla, talla) {
    return `${plantilla} Talla ${talla}`;
}
