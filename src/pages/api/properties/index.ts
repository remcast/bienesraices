import type { APIRoute } from 'astro';
import {
    isValidPropertyStatus,
    jsonError,
    jsonResponse,
    requireRole,
    supabaseAdmin
} from '../../../lib/serverAuth';

export const prerender = false;

const SELLER_ALLOWED_STATUSES = new Set(['borrador', 'publicada']);

function toNumber(value: unknown, fallback: number) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export const POST: APIRoute = async ({ request }) => {
    const auth = await requireRole(request, ['admin', 'seller']);
    if ('response' in auth) {
        return auth.response;
    }

    const body = await request.json();
    const titulo = body.titulo?.trim();
    const ubicacion = body.ubicacion?.trim();
    const descripcion = body.descripcion?.trim() || '';
    const imagenUrl = body.imagen_url?.trim() || '';
    const tipo = body.tipo === 'renta' ? 'renta' : 'venta';
    const precio = toNumber(body.precio, 0);
    const habitaciones = toNumber(body.habitaciones, 1);
    const banos = toNumber(body.banos, 1);
    const requestedStatus = body.status?.trim();

    if (!titulo || !ubicacion || precio <= 0) {
        return jsonError('Completa el título, precio y ubicación de la propiedad', 400);
    }

    let status = isValidPropertyStatus(requestedStatus) ? requestedStatus : 'borrador';
    if (auth.role === 'seller' && !SELLER_ALLOWED_STATUSES.has(status)) {
        status = 'borrador';
    }

    let ownerId = auth.user.id;
    if (auth.role === 'admin' && body.owner_id) {
        ownerId = body.owner_id;
    }

    const { data: ownerProfile, error: ownerProfileError } = await supabaseAdmin
        .from('profiles')
        .select('id, role, status')
        .eq('id', ownerId)
        .maybeSingle();

    if (ownerProfileError) {
        return jsonError(ownerProfileError.message, 500);
    }

    if (!ownerProfile) {
        return jsonError('El vendedor asignado no existe', 400);
    }

    if (!['admin', 'seller'].includes(ownerProfile.role || '')) {
        return jsonError('Solo puedes asignar propiedades a administradores o vendedores', 400);
    }

    if (ownerProfile.status && ownerProfile.status !== 'active') {
        return jsonError('No puedes asignar propiedades a usuarios inactivos', 400);
    }

    const { data, error } = await supabaseAdmin
        .from('propiedades')
        .insert([
            {
                titulo,
                precio,
                tipo,
                habitaciones,
                banos,
                ubicacion,
                descripcion,
                imagen_url: imagenUrl,
                owner_id: ownerId,
                status
            }
        ])
        .select('*')
        .maybeSingle();

    if (error) {
        return jsonError(error.message, 500);
    }

    return jsonResponse(data, 201);
};
