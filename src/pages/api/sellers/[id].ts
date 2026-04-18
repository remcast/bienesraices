import type { APIRoute } from 'astro';
import {
    isValidProfileStatus,
    jsonError,
    jsonResponse,
    requireRole,
    supabaseAdmin
} from '../../../lib/serverAuth';

export const prerender = false;

export const PUT: APIRoute = async ({ request, params }) => {
    try {
        const auth = await requireRole(request, ['admin']);
        if ('response' in auth) {
            return auth.response;
        }

        const sellerId = params.id;
        if (!sellerId) {
            return jsonError('ID de vendedor faltante', 400);
        }

        const body = await request.json();
        const fullName = body.nombre?.trim();
        const email = body.email?.trim().toLowerCase();
        const status = body.status?.trim();

        if (!fullName || !email || !isValidProfileStatus(status)) {
            return jsonError('Nombre, email y estado válidos son requeridos', 400);
        }

        const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
            .from('profiles')
            .select('id, role')
            .eq('id', sellerId)
            .maybeSingle();

        if (existingProfileError) {
            return jsonError(existingProfileError.message, 500);
        }

        if (!existingProfile || existingProfile.role !== 'seller') {
            return jsonError('Vendedor no encontrado', 404);
        }

        const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(sellerId, {
            email,
            user_metadata: {
                full_name: fullName,
                role: 'seller'
            }
        });

        if (authUpdateError) {
            return jsonError(authUpdateError.message, 400);
        }

        const { data, error } = await supabaseAdmin
            .from('profiles')
            .update({
                full_name: fullName,
                email,
                status
            })
            .eq('id', sellerId)
            .eq('role', 'seller')
            .select('id, full_name, email, role, status')
            .maybeSingle();

        if (error) {
            return jsonError(error.message, 500);
        }

        return jsonResponse({
            message: status === 'inactive'
                ? 'Vendedor actualizado y desactivado correctamente'
                : 'Vendedor actualizado correctamente',
            seller: data
        });
    } catch (error: any) {
        console.error('Error actualizando vendedor:', error);
        return jsonError(error.message || 'Error interno del servidor', 500);
    }
};
