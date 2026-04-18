import type { APIRoute } from 'astro';
import {
    isValidPropertyStatus,
    jsonError,
    jsonResponse,
    requirePropertyOwnerOrAdmin,
    supabaseAdmin
} from '../../../lib/serverAuth';

export const prerender = false;

const SELLER_ALLOWED_STATUSES = new Set(['borrador', 'publicada']);

function toNumber(value: unknown, fallback: number) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export const PUT: APIRoute = async ({ request, params }) => {
    const propertyId = params.id;
    if (!propertyId) {
        return jsonError('ID de propiedad faltante', 400);
    }

    const auth = await requirePropertyOwnerOrAdmin(propertyId, request);
    if ('response' in auth) {
        return auth.response;
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {
        titulo: body.titulo?.trim(),
        precio: toNumber(body.precio, auth.property.precio || 0),
        tipo: body.tipo === 'renta' ? 'renta' : 'venta',
        habitaciones: toNumber(body.habitaciones, auth.property.habitaciones || 1),
        banos: toNumber(body.banos, auth.property.banos || 1),
        ubicacion: body.ubicacion?.trim(),
        descripcion: body.descripcion?.trim() || '',
        imagen_url: body.imagen_url?.trim() || ''
    };

    if (!updates.titulo || !updates.ubicacion || Number(updates.precio) <= 0) {
        return jsonError('Completa el título, precio y ubicación de la propiedad', 400);
    }

    if (body.status && isValidPropertyStatus(body.status)) {
        updates.status = auth.role === 'admin' || SELLER_ALLOWED_STATUSES.has(body.status)
            ? body.status
            : auth.property.status || 'borrador';
    }

    if (auth.role === 'admin' && body.owner_id) {
        const { data: ownerProfile, error: ownerProfileError } = await supabaseAdmin
            .from('profiles')
            .select('id, role, status')
            .eq('id', body.owner_id)
            .maybeSingle();

        if (ownerProfileError) {
            return jsonError(ownerProfileError.message, 500);
        }

        if (!ownerProfile) {
            return jsonError('El vendedor asignado no existe', 400);
        }

        if (!['admin', 'seller'].includes(ownerProfile.role || '')) {
            return jsonError('Solo puedes reasignar propiedades a administradores o vendedores', 400);
        }

        if (ownerProfile.status && ownerProfile.status !== 'active') {
            return jsonError('No puedes reasignar propiedades a usuarios inactivos', 400);
        }

        updates.owner_id = body.owner_id;
    }

    const { data, error } = await supabaseAdmin
        .from('propiedades')
        .update(updates)
        .eq('id', propertyId)
        .select('*')
        .maybeSingle();

    if (error) {
        return jsonError(error.message, 500);
    }

    return jsonResponse(data);
};

export const DELETE: APIRoute = async ({ request, params }) => {
    const propertyId = params.id;
    if (!propertyId) {
        return jsonError('ID de propiedad faltante', 400);
    }

    const auth = await requirePropertyOwnerOrAdmin(propertyId, request);
    if ('response' in auth) {
        return auth.response;
    }

    if (auth.role === 'seller') {
        const { data, error } = await supabaseAdmin
            .from('propiedades')
            .update({ status: 'archivada' })
            .eq('id', propertyId)
            .select('*')
            .maybeSingle();

        if (error) {
            return jsonError(error.message, 500);
        }

        return jsonResponse({
            success: true,
            action: 'archived',
            property: data
        });
    }

    const { error } = await supabaseAdmin
        .from('propiedades')
        .delete()
        .eq('id', propertyId);

    if (error) {
        return jsonError(error.message, 500);
    }

    return jsonResponse({
        success: true,
        action: 'deleted'
    });
};
