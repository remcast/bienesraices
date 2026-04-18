import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { User, Mail, Heart, LogOut, Loader2, Edit2, Trash2, X, Check, AlertTriangle, UserPlus } from 'lucide-react';

export default function ProfileView() {
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [favorites, setFavorites] = useState([]);
    const [isAnonymous, setIsAnonymous] = useState(false);
    
    // Estados para edición
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ full_name: '', email: '' });
    const [saving, setSaving] = useState(false);
    const [emailUpdateSent, setEmailUpdateSent] = useState(false);
    
    // Estados para eliminar cuenta
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState('');

    useEffect(() => {
        async function loadProfile() {
            let { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                const { data: anonymousData } = await supabase.auth.signInAnonymously();
                session = anonymousData.session;
            }

            if (!session) {
                window.location.href = '/ingresar';
                return;
            }

            setUser(session.user);
            setIsAnonymous(session.user.is_anonymous || false);

            const [profileResult, favoritesResult] = await Promise.all([
                supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', session.user.id)
                    .maybeSingle(),
                supabase
                    .from('favorites')
                    .select('property_id')
                    .eq('user_id', session.user.id)
            ]);

            const { data: profileData, error: profileError } = profileResult;
            const { data: favsData, error: favError } = favoritesResult;

            if (profileError && profileError.code !== 'PGRST116') {
                console.error("Error cargando perfil:", profileError);
            }

            if (favError) {
                console.error("Error cargando favoritos:", favError);
            }

            setProfile(profileData);
            setEditForm({
                full_name: profileData?.full_name || session.user.user_metadata?.full_name || '',
                email: session.user.email || ''
            });

            if (favsData && favsData.length > 0) {
                const propertyIds = [...new Set(favsData.map(f => f.property_id).filter(Boolean))];

                const { data: propsData, error: propsError } = await supabase
                    .from('propiedades')
                    .select('*')
                    .in('id', propertyIds);

                if (propsError) {
                    console.error("Error cargando detalles de propiedades:", propsError);
                } else {
                    setFavorites(propsData || []);
                }
            } else {
                setFavorites([]);
            }

            setLoading(false);
        }

        loadProfile();
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = '/';
    };

    // Función para guardar cambios del nombre (solo nombre)
    const handleSaveName = async () => {
        setSaving(true);
        try {
            // Actualizar metadata del usuario
            const { error: updateError } = await supabase.auth.updateUser({
                data: { full_name: editForm.full_name }
            });

            if (updateError) throw updateError;

            // Actualizar tabla profiles (upsert) - SIN updated_at
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({ 
                    id: user.id, 
                    full_name: editForm.full_name
                });

            if (profileError) {
                console.error('Error detallado en upsert:', profileError);
                throw profileError;
            }

            // Actualizar estado local
            setProfile(prev => ({ ...prev, full_name: editForm.full_name }));
            setUser(prev => ({ ...prev, user_metadata: { ...prev.user_metadata, full_name: editForm.full_name } }));
            setIsEditing(false);
            setEmailUpdateSent(false);
            
        } catch (error) {
            console.error('Error al guardar perfil:', error);
            alert('Error al guardar los cambios: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    // Función para cambiar email (envía correo de confirmación)
    const handleChangeEmail = async () => {
        if (editForm.email === user.email) {
            alert('El nuevo email es igual al actual.');
            return;
        }

        setSaving(true);
        try {
            const { error } = await supabase.auth.updateUser({ email: editForm.email });

            if (error) throw error;

            setEmailUpdateSent(true);
            alert('Se ha enviado un correo de confirmación a la nueva dirección. Por favor, verifica tu bandeja de entrada.');
            // No cerramos edición, solo mostramos mensaje
        } catch (error) {
            console.error('Error al cambiar email:', error);
            alert('Error al cambiar email: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    // Función para eliminar cuenta
    const handleDeleteAccount = async () => {
        setDeleting(true);
        setDeleteError('');

        try {
            if (isAnonymous) {
                await supabase.auth.signOut();
                window.location.href = '/';
                return;
            }

            // Reautenticar
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: deletePassword
            });

            if (signInError) {
                setDeleteError('Contraseña incorrecta');
                setDeleting(false);
                return;
            }

            // Eliminar favoritos
            await supabase.from('favorites').delete().eq('user_id', user.id);

            // Eliminar perfil
            await supabase.from('profiles').delete().eq('id', user.id);

            // Eliminar usuario (requiere función admin, por ahora solo cerramos sesión)
            await supabase.auth.signOut();
            
            alert('Tu cuenta ha sido eliminada. Para eliminación completa, contacta a soporte.');
            window.location.href = '/';

        } catch (error) {
            console.error('Error al eliminar cuenta:', error);
            setDeleteError('Error al eliminar la cuenta');
        } finally {
            setDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-[50vh] flex flex-col items-center justify-center text-white">
                <Loader2 className="animate-spin mb-4" size={48} />
                <p>Cargando perfil...</p>
            </div>
        );
    }

    if (!user) return null;

    const userRole = profile?.role || user.user_metadata?.role || 'buyer';
    const roleLabel = userRole === 'admin' ? 'Administrador' : userRole === 'seller' ? 'Vendedor' : 'Cliente';
    const roleClass = userRole === 'admin' ? 'bg-blue-500/10 text-blue-200' : userRole === 'seller' ? 'bg-pink-500/10 text-pink-200' : 'bg-slate-500/10 text-slate-300';
    const userName = profile?.full_name || user.user_metadata?.full_name || "Usuario";

    return (
        <div className="max-w-6xl mx-auto px-4 py-8">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-8 border-l-4 border-blue-500 pl-4">
                Mi Perfil
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                {/* Columna Izquierda: Datos del Usuario */}
                <div className="md:col-span-1">
                    <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-lg md:sticky md:top-32">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-24 h-24 bg-slate-700 rounded-full flex items-center justify-center mb-4 text-slate-400 border-4 border-slate-600 relative">
                                <User size={48} />
                                {isAnonymous && (
                                    <span className="absolute -bottom-2 bg-yellow-500 text-xs text-black px-2 py-0.5 rounded-full font-bold">
                                        Invitado
                                    </span>
                                )}
                            </div>
                            
                            {isEditing ? (
                                <div className="w-full mb-4 space-y-3">
                                    {/* Campo nombre */}
                                    <div>
                                        <label className="block text-xs text-slate-400 text-left mb-1">Nombre</label>
                                        <input
                                            type="text"
                                            value={editForm.full_name}
                                            onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                                            className="w-full p-2 rounded-lg bg-slate-900 border border-slate-600 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="Tu nombre"
                                        />
                                    </div>

                                    {/* Campo email (solo para no anónimos) */}
                                    {!isAnonymous && (
                                        <div>
                                            <label className="block text-xs text-slate-400 text-left mb-1">
                                                Correo electrónico
                                                {emailUpdateSent && (
                                                    <span className="ml-2 text-green-400 text-xs">(Correo de confirmación enviado)</span>
                                                )}
                                            </label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="email"
                                                    value={editForm.email}
                                                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                                    className="flex-1 p-2 rounded-lg bg-slate-900 border border-slate-600 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                    placeholder="nuevo@email.com"
                                                />
                                                <button
                                                    onClick={handleChangeEmail}
                                                    disabled={saving || editForm.email === user.email}
                                                    className="px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm disabled:opacity-50"
                                                >
                                                    Cambiar
                                                </button>
                                            </div>
                                            <p className="text-xs text-slate-500 text-left mt-1">
                                                Se enviará un correo de confirmación.
                                            </p>
                                        </div>
                                    )}

                                    {/* Botones de acción para nombre */}
                                    <div className="flex gap-2 pt-2">
                                        <button
                                            onClick={handleSaveName}
                                            disabled={saving}
                                            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm flex items-center justify-center gap-1"
                                        >
                                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                            Guardar nombre
                                        </button>
                                        <button
                                            onClick={() => {
                                                setIsEditing(false);
                                                setEmailUpdateSent(false);
                                                setEditForm({ 
                                                    full_name: profile?.full_name || user.user_metadata?.full_name || '',
                                                    email: user.email || ''
                                                });
                                            }}
                                            className="flex-1 bg-slate-600 hover:bg-slate-700 text-white py-2 rounded-lg text-sm flex items-center justify-center gap-1"
                                        >
                                            <X size={14} /> Cancelar
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-3">
                                        <h2 className="text-xl font-bold text-white">{userName}</h2>
                                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${roleClass}`}>
                                            {roleLabel}
                                        </span>
                                        <button
                                            onClick={() => setIsEditing(true)}
                                            className="text-sm text-blue-400 hover:text-blue-300 mb-4 flex items-center gap-1"
                                        >
                                            <Edit2 size={14} /> Editar perfil
                                        </button>
                                        {(userRole === 'admin' || userRole === 'seller') && (
                                            <a
                                                href={userRole === 'admin' ? '/admin-panel' : '/vendedor-panel'}
                                                className="inline-flex items-center gap-2 text-sm text-white bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-full"
                                            >
                                                {userRole === 'admin' ? 'Ir al panel de administrador' : 'Ir al panel de vendedor'}
                                            </a>
                                        )}
                                    </div>
                                </>
                            )}

                            <p className="text-slate-400 text-sm mb-6 flex items-center gap-2 overflow-hidden text-ellipsis w-full justify-center">
                                <Mail size={14} className="shrink-0" /> {user.email}
                            </p>

                            <div className="w-full space-y-3">
                                {/* Botón Registrarse para usuarios anónimos */}
                                {isAnonymous && (
                                    <a
                                        href="/registro"
                                        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded-lg transition flex items-center justify-center gap-2"
                                    >
                                        <UserPlus size={18} /> Registrarse
                                    </a>
                                )}

                                <button
                                    onClick={handleLogout}
                                    className="w-full bg-red-500/10 hover:bg-red-500 hover:text-white text-red-400 border border-red-500/20 py-2 rounded-lg transition flex items-center justify-center gap-2 active:scale-95"
                                >
                                    <LogOut size={18} /> Cerrar Sesión
                                </button>

                                {/* Botón Eliminar Cuenta */}
                                {!showDeleteConfirm ? (
                                    <button
                                        onClick={() => setShowDeleteConfirm(true)}
                                        className="w-full bg-slate-700/50 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-slate-600 hover:border-red-500/30 py-2 rounded-lg transition flex items-center justify-center gap-2 text-sm"
                                    >
                                        <Trash2 size={16} /> Eliminar cuenta
                                    </button>
                                ) : (
                                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                                        <p className="text-xs text-red-400 mb-2 flex items-center gap-1">
                                            <AlertTriangle size={12} /> 
                                            {isAnonymous 
                                                ? '¿Eliminar datos de invitado?' 
                                                : 'Confirma con tu contraseña'}
                                        </p>
                                        
                                        {!isAnonymous && (
                                            <input
                                                type="password"
                                                value={deletePassword}
                                                onChange={(e) => setDeletePassword(e.target.value)}
                                                placeholder="Contraseña"
                                                className="w-full p-2 text-sm rounded-lg bg-slate-900 border border-red-500/30 text-white mb-2"
                                            />
                                        )}
                                        
                                        {deleteError && (
                                            <p className="text-red-400 text-xs mb-2">{deleteError}</p>
                                        )}
                                        
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleDeleteAccount}
                                                disabled={deleting || (!isAnonymous && !deletePassword)}
                                                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-1 rounded-lg text-xs flex items-center justify-center gap-1 disabled:opacity-50"
                                            >
                                                {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                                Eliminar
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setShowDeleteConfirm(false);
                                                    setDeletePassword('');
                                                    setDeleteError('');
                                                }}
                                                className="flex-1 bg-slate-600 hover:bg-slate-700 text-white py-1 rounded-lg text-xs"
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Columna Derecha: Favoritos (sin cambios) */}
                <div className="md:col-span-3 space-y-8">
                    <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-pink-500/20 rounded-lg text-pink-400">
                                <Heart size={24} />
                            </div>
                            <h3 className="text-2xl font-bold text-white">Mis Favoritos ({favorites.length})</h3>
                        </div>

                        {favorites.length === 0 ? (
                            <div className="text-center py-12 border border-dashed border-slate-600 rounded-xl">
                                <p className="text-slate-400 mb-4">Aún no tienes propiedades favoritas.</p>
                                <a href="/propiedades" className="text-blue-400 hover:text-blue-300 hover:underline">
                                    Explorar el catálogo
                                </a>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {favorites.map(prop => (
                                    <div key={prop.id} className="bg-slate-900 rounded-xl overflow-hidden shadow-md border border-slate-700 group hover:border-blue-500/50 transition-colors">
                                        <div className="relative h-40">
                                            <img src={prop.imagen_url} alt={prop.titulo} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                            <span className={`absolute top-2 right-2 px-2 py-1 rounded text-[10px] font-bold uppercase text-white ${prop.tipo === 'venta' ? 'bg-blue-600' : 'bg-green-600'}`}>
                                                {prop.tipo}
                                            </span>
                                        </div>
                                        <div className="p-4">
                                            <h4 className="font-bold text-white text-sm mb-1 truncate">{prop.titulo}</h4>
                                            <p className="text-blue-400 font-bold mb-2">
                                                {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(prop.precio)}
                                            </p>
                                            <a href={`/propiedades/${prop.id}`} className="text-xs text-slate-400 hover:text-white underline">
                                                Ver Detalles
                                            </a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
