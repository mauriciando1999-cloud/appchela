import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. Manejo de CORS para que el navegador no bloquee la petición
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { imageBase64, mimeType } = await req.json()
    
    // Obtenemos la llave de Gemini desde los secretos (no está expuesta)
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) throw new Error("API Key de Gemini no configurada en Supabase")

    // Instrucción estricta
    const prompt = `Actúa como un software ERP. Extrae los datos de esta factura o recibo y devuelve ÚNICAMENTE un JSON válido con esta estructura exacta, sin código markdown ni texto adicional:
    {
        "proveedor": "Nombre de la tienda o proveedor",
        "referencia": "Numero de factura (si no hay, pon '')",
        "productos": [
            {"nombre": "Nombre del articulo", "cantidad": 2, "costo_unitario": 15.50}
        ]
    }
    Asegúrate de que los costos sean números reales. Si hay un monto total pero no el costo unitario, calcúlalo.`

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`

    // Petición a Google Gemini
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: imageBase64 } }
          ]
        }]
      })
    })

    const result = await response.json()
    
    // Limpieza de Markdown por si la IA responde con ```json
    let jsonString = result.candidates[0].content.parts[0].text
    jsonString = jsonString.replace(/```json/g, '').replace(/```/g, '').trim()
    
    // Parseamos para validar que sea JSON real
    const data = JSON.parse(jsonString)

    // Respondemos al Frontend
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})