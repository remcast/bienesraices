import type { APIRoute } from 'astro';
import { jsonError, jsonResponse, requireRole, supabaseAdmin } from '../../lib/serverAuth';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
    const auth = await requireRole(request, ['admin']);
    if ('response' in auth) {
        return auth.response;
    }

    const { data, error } = await supabaseAdmin
        .from('contactos')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        return jsonError(error.message, 500);
    }

    return jsonResponse(data || []);
};
