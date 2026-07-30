// config.js - Configuración Global de Chela Sport
const SB_URL = 'https://ekvzmfsdshyoeggudksm.supabase.co';
const SB_KEY = 'sb_publishable_Go6ZDuD9pg1pC3k-s89jiQ_65TEYGnd';

// Inicializamos el cliente de Supabase de forma global
const _sb = supabase.createClient(SB_URL, SB_KEY);

// Variables globales útiles
const ADMIN_EMAIL = 'mauriciando1999@gmail.com';
const URL_SISTEMA = window.location.origin; // Opcional, pero muy útil

// PIN maestro de acceso a paneles administrativos (verificacion.html, etc.)
const MASTER_PIN = '2026';