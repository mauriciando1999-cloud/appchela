// supabase-client.js - Conexión a Supabase para el catálogo de Chela.
// Reutiliza el mismo proyecto/clave publicable que el resto de appchela.
// Requiere que el SDK de supabase-js ya esté cargado (script CDN) antes de este archivo.

const SB_URL = 'https://ekvzmfsdshyoeggudksm.supabase.co';
const SB_KEY = 'sb_publishable_Go6ZDuD9pg1pC3k-s89jiQ_65TEYGnd';
const _sb = supabase.createClient(SB_URL, SB_KEY);
const ADMIN_EMAIL = 'mauriciando1999@gmail.com';
