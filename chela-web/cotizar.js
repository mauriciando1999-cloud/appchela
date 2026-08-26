// cotizar.js - Sección "Cotiza tu propio diseño" (Inicio). El cliente puede
// subir una foto de referencia: se comprime en el navegador (igual que en
// admin.js) y se sube a Supabase Storage (bucket "chela-cotizaciones", de
// escritura pública — requiere haberse creado en Supabase, ver README del
// proyecto). Si la subida falla por cualquier motivo, igual se abre
// WhatsApp con la descripción y se le pide al cliente adjuntar la foto
// directamente en el chat — el formulario nunca lo deja sin poder escribir.

const BUCKET_COTIZACIONES = 'chela-cotizaciones';
let cotizarArchivoSeleccionado = null;

async function comprimirImagenCotizacion(file, maxDim = 1400, calidad = 0.82) {
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
    return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', calidad));
}

function inicializarCotizarDiseno() {
    const inputFoto = document.getElementById('cotizar-foto');
    const btnElegirFoto = document.getElementById('cotizar-elegir-foto');
    const previewImg = document.getElementById('cotizar-preview-img');
    const previewVacio = document.getElementById('cotizar-preview-vacio');
    const btnEnviar = document.getElementById('cotizar-enviar');
    const campoDescripcion = document.getElementById('cotizar-descripcion');
    const status = document.getElementById('cotizar-status');
    if (!inputFoto || !btnEnviar) return;

    btnElegirFoto.addEventListener('click', () => inputFoto.click());

    inputFoto.addEventListener('change', () => {
        const file = inputFoto.files[0];
        if (!file) return;
        cotizarArchivoSeleccionado = file;
        previewImg.src = URL.createObjectURL(file);
        previewImg.classList.remove('hidden');
        previewVacio.classList.add('hidden');
    });

    btnEnviar.addEventListener('click', async () => {
        const descripcion = campoDescripcion.value.trim();
        let urlFoto = '';

        if (cotizarArchivoSeleccionado) {
            btnEnviar.disabled = true;
            status.innerText = 'Subiendo foto...';
            try {
                const blob = await comprimirImagenCotizacion(cotizarArchivoSeleccionado);
                const nombreArchivo = `${Date.now()}-${Math.random().toString(16).slice(2)}.jpg`;
                const { error } = await _sb.storage.from(BUCKET_COTIZACIONES).upload(nombreArchivo, blob, {
                    contentType: 'image/jpeg',
                    cacheControl: '31536000'
                });
                if (error) throw error;
                const { data } = _sb.storage.from(BUCKET_COTIZACIONES).getPublicUrl(nombreArchivo);
                urlFoto = data.publicUrl;
            } catch (err) {
                console.error('No se pudo subir la foto de referencia:', err);
                status.innerText = 'No se pudo subir la foto — se abrió WhatsApp igual, adjúntala ahí directamente.';
            }
        }

        const partes = ['Hola, quiero cotizar un diseño personalizado.'];
        if (descripcion) partes.push(`\nLo que quiero: ${descripcion}`);
        if (urlFoto) partes.push(`\nFoto de referencia: ${urlFoto}`);
        else if (cotizarArchivoSeleccionado) partes.push('\n(Voy a adjuntar la foto de referencia en este chat)');

        window.abrirWhatsAppConTerminos(linkWhatsApp(partes.join('')));
        btnEnviar.disabled = false;
        if (!status.innerText) status.innerText = '';
    });
}

document.addEventListener('DOMContentLoaded', inicializarCotizarDiseno);
