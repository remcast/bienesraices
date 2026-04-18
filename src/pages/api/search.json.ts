// src/pages/api/search.json.ts
import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';

// ESTA LÍNEA ES LA MAGIA: Obliga a Astro a ejecutar esto en cada petición
export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
    const url = new URL(request.url);
    const params = url.searchParams;

    const tipo = params.get('tipo');
    const precioMax = params.get('max');
    const busqueda = params.get('q');

    // LOG PARA VERIFICAR: Veremos la URL exacta que llega al servidor
    console.log("📢 URL recibida en Backend:", request.url);
    console.log("🔍 Filtros extraídos:", { tipo, precioMax, busqueda });

    let query = supabase.from('propiedades').select('*').eq('status', 'publicada');

    // 1. Filtro Tipo
    if (tipo && tipo !== 'todos') {
        query = query.eq('tipo', tipo);
    }

    // 2. Filtro Precio
    if (precioMax && precioMax !== '') {
        query = query.lte('precio', parseFloat(precioMax));
    }

    // 3. Filtro Búsqueda (Texto)
    if (busqueda && busqueda.trim() !== '') {
        // Usamos ilike con comodines % para buscar coincidencias parciales
        // Buscamos en 'titulo' O en 'ubicacion'
        query = query.or(`titulo.ilike.%${busqueda}%,ubicacion.ilike.%${busqueda}%`);
    }

    // Ordenar
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
        console.error("❌ Error Supabase:", error.message);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
            "Content-Type": "application/json"
        }
    });
}
