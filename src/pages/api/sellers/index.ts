import type { APIRoute } from 'astro';
import {
    jsonError,
    jsonResponse,
    requireRole,
    supabaseAdmin
} from '../../../lib/serverAuth';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
    const auth = await requireRole(request, ['admin']);
    if ('response' in auth) {
        return auth.response;
    }

    const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, email, role, status')
        .eq('role', 'seller')
        .order('full_name', { ascending: true });

    if (error) {
        return jsonError(error.message, 500);
    }

    return jsonResponse(data || []);
};

export const POST: APIRoute = async ({ request }) => {
    try {
        const auth = await requireRole(request, ['admin']);
        if ('response' in auth) {
            return auth.response;
        }

        const body = await request.json();
        const nombre = body.nombre?.trim();
        const email = body.email?.trim().toLowerCase();
        const password = body.password?.trim();

        if (!nombre || !email || !password) {
            return jsonError('Nombre, email y contraseña temporal son requeridos', 400);
        }

        if (password.length < 8) {
            return jsonError('La contraseña temporal debe tener al menos 8 caracteres', 400);
        }

        const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('email', email)
            .maybeSingle();

        if (existingProfileError) {
            return jsonError(existingProfileError.message, 500);
        }

        if (existingProfile) {
            return jsonError('Ya existe un vendedor con ese correo', 409);
        }

        const { data: createdUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                full_name: nombre,
                role: 'seller',
                must_change_password: true
            }
        });

        if (createUserError || !createdUser.user) {
            return jsonError(createUserError?.message || 'No se pudo crear el vendedor', 400);
        }

        const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
            id: createdUser.user.id,
            full_name: nombre,
            email,
            role: 'seller',
            status: 'active'
        });

        if (profileError) {
            await supabaseAdmin.auth.admin.deleteUser(createdUser.user.id);
            return jsonError(profileError.message, 500);
        }

        return jsonResponse({
            message: 'Vendedor creado correctamente',
            user: {
                id: createdUser.user.id,
                email: createdUser.user.email,
                full_name: nombre,
                role: 'seller',
                status: 'active'
            }
        }, 201);
    } catch (error: any) {
        console.error('Error creando vendedor:', error);
        return jsonError(error.message || 'Error interno del servidor', 500);
    }
};
