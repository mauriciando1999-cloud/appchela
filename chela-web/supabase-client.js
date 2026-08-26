// supabase-client.js - Conexión a Supabase para el catálogo de Chela.
// Reutiliza el mismo proyecto/clave publicable que el resto de appchela.
// Requiere que el SDK de supabase-js ya esté cargado (script CDN) antes de este archivo.

const SB_URL = 'https://ekvzmfsdshyoeggudksm.supabase.co';
const SB_KEY = 'sb_publishable_Go6ZDuD9pg1pC3k-s89jiQ_65TEYGnd';
const _sb = supabase.createClient(SB_URL, SB_KEY);
const ADMIN_EMAILS = ['mauriciando1999@gmail.com', 'angelicavalentinaaval2006@gmail.com'];

// Escapa texto antes de insertarlo en innerHTML (nombres de producto/categoría,
// mensajes de error, etc.) — evita inyección de HTML/JS si algún día ese texto
// contiene algo como <script> o un atributo malicioso. Se usa en cualquier
// página que arme HTML dinámico a partir de datos de Supabase.
function escaparHtml(texto) {
    const div = document.createElement('div');
    div.textContent = texto === null || texto === undefined ? '' : String(texto);
    return div.innerHTML;
}
