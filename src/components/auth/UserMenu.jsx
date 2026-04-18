import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { User, LogOut } from 'lucide-react';

export default function UserMenu() {
    const [user, setUser] = useState(null);
    const [role, setRole] = useState('buyer');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadUserState(session) {
            const currentUser = session?.user ?? null;
            setUser(currentUser);

            if (!currentUser) {
                setRole('buyer');
                setLoading(false);
                return;
            }

            if (currentUser.is_anonymous) {
                setRole('buyer');
                setLoading(false);
                return;
            }

            setRole(currentUser.user_metadata?.role || 'buyer');
            setLoading(false);

            try {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role, status')
                    .eq('id', currentUser.id)
                    .maybeSingle();

                if (profile?.status === 'inactive') {
                    setRole('buyer');
                } else if (profile) {
                    setRole(profile?.role || currentUser.user_metadata?.role || 'buyer');
                }
            } catch (_error) {
                // Si falla profiles, mantenemos el fallback local para no
                // bloquear el render del menú.
            } finally {
            }
        }

        async function getUser() {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                await loadUserState(session);
            } catch (_error) {
                setUser(null);
                setRole('buyer');
                setLoading(false);
            }
        }

        getUser();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            await loadUserState(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = '/';
    };

    if (loading) return null;

    if (!user) {
        return (
            <a
                href="/ingresar"
                className="ml-4 px-6 py-2 bg-blue-300 hover:bg-blue-800 text-white font-bold rounded-full transition transform hover:scale-105 text-sm"
            >
                INGRESAR
            </a>
        );
    }

    const dashboardHref = role === 'admin' ? '/admin-panel' : role === 'seller' ? '/vendedor-panel' : '/perfil';
    const displayName = user.user_metadata?.full_name || user.email || 'Usuario';
    const dashboardLabel = role === 'admin' ? 'Panel' : role === 'seller' ? 'Panel' : 'Perfil';

    return (
        <div className="ml-4 flex items-center gap-4">
            <div className="hidden md:flex flex-col text-right">
                <span className="text-white font-medium text-sm">
                    Hola, {displayName}
                </span>
                <span className="text-slate-400 text-xs uppercase tracking-[0.2em]">
                    {role === 'admin' ? 'ADMIN' : role === 'seller' ? 'VENDEDOR' : 'CLIENTE'}
                </span>
            </div>

            <div className="flex items-center gap-2">
                <a
                    href={dashboardHref}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-slate-700 hover:bg-slate-600 transition text-white text-sm font-medium"
                    title={dashboardLabel}
                >
                    <User size={18} />
                    <span className="hidden md:inline">{dashboardLabel}</span>
                </a>
                <button
                    onClick={handleLogout}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white transition text-sm font-medium"
                    title="Cerrar Sesión"
                >
                    <LogOut size={18} />
                    <span className="hidden md:inline">Cerrar sesión</span>
                </button>
            </div>
        </div>
    );
}
