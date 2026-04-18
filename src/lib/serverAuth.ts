import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Faltan las variables de entorno públicas de Supabase en el archivo .env');
}

if (!supabaseServiceRoleKey) {
    throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY para usar la autenticación segura del backend');
}

export const supabaseServer = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
    }
});

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
    }
});

export const ROLE_VALUES = ['admin', 'seller', 'buyer'] as const;
export const PROFILE_STATUS_VALUES = ['active', 'inactive'] as const;
export const PROPERTY_STATUS_VALUES = ['borrador', 'publicada', 'vendida', 'archivada'] as const;

export type AppRole = typeof ROLE_VALUES[number];
export type ProfileStatus = typeof PROFILE_STATUS_VALUES[number];
export type PropertyStatus = typeof PROPERTY_STATUS_VALUES[number];

const jsonHeaders = { 'Content-Type': 'application/json' };

export function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: jsonHeaders
    });
}

export function jsonError(message: string, status = 400) {
    return jsonResponse({ error: message }, status);
}

export function isValidRole(role: string | null | undefined): role is AppRole {
    return ROLE_VALUES.includes((role || '') as AppRole);
}

export function isValidProfileStatus(status: string | null | undefined): status is ProfileStatus {
    return PROFILE_STATUS_VALUES.includes((status || '') as ProfileStatus);
}

export function isValidPropertyStatus(status: string | null | undefined): status is PropertyStatus {
    return PROPERTY_STATUS_VALUES.includes((status || '') as PropertyStatus);
}

export function normalizeRole(role: string | null | undefined): AppRole {
    return isValidRole(role) ? role : 'buyer';
}

export function normalizeProfileStatus(status: string | null | undefined): ProfileStatus {
    return isValidProfileStatus(status) ? status : 'active';
}

export function normalizePropertyStatus(status: string | null | undefined): PropertyStatus {
    return isValidPropertyStatus(status) ? status : 'borrador';
}

export async function getUserFromRequest(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.toLowerCase().startsWith('bearer ')) {
        return null;
    }

    const token = authHeader.split(' ')[1];
    if (!token) return null;

    const {
        data: { user },
        error
    } = await supabaseServer.auth.getUser(token);

    if (error || !user) return null;

    return user;
}

export async function getUserProfile(userId: string) {
    const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, email, role, status')
        .eq('id', userId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data;
}

export async function getUserRole(user: any) {
    const profile = await getUserProfile(user.id);
    return normalizeRole(profile?.role || user.user_metadata?.role);
}

export async function requireUser(request: Request) {
    const user = await getUserFromRequest(request);

    if (!user) {
        return { response: jsonError('No autorizado', 401) };
    }

    const profile = await getUserProfile(user.id);
    if (!profile) {
        return { response: jsonError('Perfil no encontrado', 403) };
    }

    const role = normalizeRole(profile.role || user.user_metadata?.role);
    const profileStatus = normalizeProfileStatus(profile.status);

    if (profileStatus !== 'active') {
        return { response: jsonError('Tu cuenta está inactiva. Contacta al administrador.', 403) };
    }

    return { user, profile, role };
}

export async function requireRole(request: Request, allowedRoles: AppRole[]) {
    const auth = await requireUser(request);
    if ('response' in auth) {
        return auth;
    }

    if (!allowedRoles.includes(auth.role)) {
        return { response: jsonError('Acceso denegado', 403) };
    }

    return auth;
}

export async function getPropertyById(propertyId: string) {
    const { data, error } = await supabaseAdmin
        .from('propiedades')
        .select('*')
        .eq('id', propertyId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data;
}

export async function requirePropertyOwnerOrAdmin(propertyId: string, request: Request) {
    const auth = await requireRole(request, ['admin', 'seller']);
    if ('response' in auth) {
        return auth;
    }

    const property = await getPropertyById(propertyId);
    if (!property) {
        return { response: jsonError('Propiedad no encontrada', 404) };
    }

    if (auth.role === 'seller' && property.owner_id !== auth.user.id) {
        return { response: jsonError('No tienes permiso para administrar esta propiedad', 403) };
    }

    return { ...auth, property };
}
