// api/generar-imagen.js - Función serverless de Vercel: genera/edita una
// foto de producto con IA (Gemini), cambiando modelo, fondo, pose, etc. a
// partir de una foto PROPIA que sube el admin + un prompt de texto.
//
// La clave de Gemini vive solo acá, en la variable de entorno GEMINI_API_KEY
// de Vercel — nunca llega al navegador. Y aunque alguien descubriera esta
// URL, no podría usarla: cada llamada exige el token de sesión de Supabase
// del admin (el chequeo del lado del navegador en admin.html no cuenta como
// seguridad real, esto sí).

const SB_URL = 'https://ekvzmfsdshyoeggudksm.supabase.co';
const SB_ANON_KEY = 'sb_publishable_Go6ZDuD9pg1pC3k-s89jiQ_65TEYGnd';
const ADMIN_EMAILS = ['mauriciando1999@gmail.com', 'angelicavalentinaaval2006@gmail.com'];

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

    const { imagenBase64, mimeType, prompt } = req.body || {};
    if (!imagenBase64 || !prompt) {
        res.status(400).json({ error: 'Falta la imagen o la descripción de lo que quieres cambiar.' });
        return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        res.status(500).json({ error: 'El servidor no tiene configurada la clave de Gemini (GEMINI_API_KEY).' });
        return;
    }

    try {
        const respuestaGemini = await fetch(
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: prompt },
                            { inline_data: { mime_type: mimeType || 'image/jpeg', data: imagenBase64 } }
                        ]
                    }]
                })
            }
        );

        const datos = await respuestaGemini.json();
        if (!respuestaGemini.ok) {
            res.status(502).json({ error: (datos.error && datos.error.message) || 'Error al generar la imagen.' });
            return;
        }

        const partes = (datos.candidates && datos.candidates[0] && datos.candidates[0].content && datos.candidates[0].content.parts) || [];
        const parteImagen = partes.find(p => p.inlineData || p.inline_data);
        const inline = parteImagen ? (parteImagen.inlineData || parteImagen.inline_data) : null;

        if (!inline || !inline.data) {
            res.status(502).json({ error: 'La IA no devolvió ninguna imagen. Intenta reformular el pedido.' });
            return;
        }

        // El nombre/descripción sugeridos van en la parte de texto de la misma
        // respuesta (se le pidió al modelo un formato fijo "NOMBRE: / DESCRIPCION:").
        // Es opcional: si no vienen o no calzan con el formato, se ignora sin error.
        const parteTexto = partes.find(p => typeof p.text === 'string' && p.text.trim());
        const texto = parteTexto ? parteTexto.text : '';
        const matchNombre = texto.match(/NOMBRE:\s*(.+)/i);
        const matchDescripcion = texto.match(/DESCRIPCI[OÓ]N:\s*(.+)/i);

        res.status(200).json({
            imagenBase64: inline.data,
            mimeType: inline.mimeType || inline.mime_type || 'image/png',
            nombreSugerido: matchNombre ? matchNombre[1].trim() : '',
            descripcionSugerida: matchDescripcion ? matchDescripcion[1].trim() : ''
        });
    } catch (err) {
        res.status(500).json({ error: 'Error al conectar con el servicio de IA: ' + err.message });
    }
};
