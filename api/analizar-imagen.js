// api/analizar-imagen.js - Función serverless de Vercel: la IA (Gemini,
// visión + texto) mira una foto de producto y sugiere nombre, descripción y
// género para el formulario de "Nuevo Producto" del admin. No genera ni
// edita ninguna imagen — eso requiere un modelo de imágenes con facturación
// activada en Google, que este negocio no tiene. Analizar una foto con un
// modelo de texto/visión sí está cubierto por el nivel gratuito de Gemini.
//
// La clave de Gemini vive solo acá (variable de entorno GEMINI_API_KEY de
// Vercel) y cada llamada exige el token de sesión de un correo admin — el
// chequeo del lado del navegador en admin.html no cuenta como seguridad real.

const SB_URL = 'https://ekvzmfsdshyoeggudksm.supabase.co';
const SB_ANON_KEY = 'sb_publishable_Go6ZDuD9pg1pC3k-s89jiQ_65TEYGnd';
const ADMIN_EMAILS = ['mauriciando1999@gmail.com', 'angelicavalentinaaval2006@gmail.com'];

const PROMPT_ANALISIS = `Estás viendo la foto de una prenda de ropa que se va a vender en el catálogo de una tienda online.
Responde ÚNICAMENTE con estas tres líneas, sin nada más de texto antes ni después:
NOMBRE: (nombre corto y atractivo para este producto, en español)
DESCRIPCION: (una sola oración describiéndolo, en español)
GENERO: (una sola palabra, exactamente una de: hombre, mujer, unisex)`;

async function obtenerCorreoDesdeToken(token) {
    if (!token) return null;
    try {
        const resp = await fetch(`${SB_URL}/auth/v1/user`, {
            headers: { apikey: SB_ANON_KEY, Authorization: `Bearer ${token}` }
        });
        if (!resp.ok) return null;
        const data = await resp.json();
        return data && data.email ? String(data.email).toLowerCase() : null;
    } catch {
        return null;
    }
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Método no permitido.' });
        return;
    }

    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const correo = await obtenerCorreoDesdeToken(token);
    if (!correo || !ADMIN_EMAILS.map(e => e.toLowerCase()).includes(correo)) {
        res.status(403).json({ error: 'No autorizado.' });
        return;
    }

    const { imagenBase64, mimeType } = req.body || {};
    if (!imagenBase64) {
        res.status(400).json({ error: 'Falta la imagen.' });
        return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        res.status(500).json({ error: 'El servidor no tiene configurada la clave de Gemini (GEMINI_API_KEY).' });
        return;
    }

    try {
        const respuestaGemini = await fetch(
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: PROMPT_ANALISIS },
                            { inline_data: { mime_type: mimeType || 'image/jpeg', data: imagenBase64 } }
                        ]
                    }]
                })
            }
        );

        const datos = await respuestaGemini.json();
        if (!respuestaGemini.ok) {
            res.status(502).json({ error: (datos.error && datos.error.message) || 'Error al analizar la imagen.' });
            return;
        }

        const partes = (datos.candidates && datos.candidates[0] && datos.candidates[0].content && datos.candidates[0].content.parts) || [];
        const texto = partes.map(p => p.text || '').join('\n');

        if (!texto.trim()) {
            res.status(502).json({ error: 'La IA no devolvió ninguna sugerencia. Intenta de nuevo.' });
            return;
        }

        const matchNombre = texto.match(/NOMBRE:\s*(.+)/i);
        const matchDescripcion = texto.match(/DESCRIPCI[OÓ]N:\s*(.+)/i);
        const matchGenero = texto.match(/GENERO:\s*(hombre|mujer|unisex)/i);

        res.status(200).json({
            nombreSugerido: matchNombre ? matchNombre[1].trim() : '',
            descripcionSugerida: matchDescripcion ? matchDescripcion[1].trim() : '',
            generoSugerido: matchGenero ? matchGenero[1].toLowerCase() : ''
        });
    } catch (err) {
        res.status(500).json({ error: 'Error al conectar con el servicio de IA: ' + err.message });
    }
};
