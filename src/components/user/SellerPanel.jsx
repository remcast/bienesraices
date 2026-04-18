import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, Plus, Edit2, CheckCircle, Archive } from 'lucide-react';

const emptyPropertyForm = {
    titulo: '',
    precio: '',
    tipo: 'venta',
    habitaciones: 1,
    banos: 1,
    ubicacion: '',
    descripcion: '',
    imagen_url: '',
    status: 'borrador'
};

export default function SellerPanel() {
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [error, setError] = useState('');
    const [properties, setProperties] = useState([]);
    const [propertyForm, setPropertyForm] = useState(emptyPropertyForm);
    const [selectedProperty, setSelectedProperty] = useState(null);
    const [savingProperty, setSavingProperty] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');

    useEffect(() => {
        const init = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    setError('Debes iniciar sesión para acceder a tu panel de vendedor.');
                    return;
                }

                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('role, status')
                    .eq('id', session.user.id)
                    .maybeSingle();

                if (profileError) {
                    throw profileError;
                }

                if (!profile || profile.role !== 'seller' || profile.status !== 'active') {
                    setError('Acceso denegado. Este panel es solo para vendedores activos.');
                    return;
                }

                setUser(session.user);
                await fetchProperties(session.user.id);
            } catch (err) {
                setError(err.message || 'Error cargando el panel de vendedor.');
            } finally {
                setLoading(false);
            }
        };

        init();
    }, []);

    const fetchProperties = async (ownerId) => {
        const { data, error: propertiesError } = await supabase
            .from('propiedades')
            .select('*')
            .eq('owner_id', ownerId)
            .order('created_at', { ascending: false });

        if (propertiesError) {
            setError('No se pudieron cargar tus propiedades.');
            return;
        }

        setProperties(data || []);
    };

    const handlePropertyChange = (e) => {
        const { name, value } = e.target;
        setPropertyForm((prev) => ({
            ...prev,
            [name]: ['precio', 'habitaciones', 'banos'].includes(name) ? Number(value) : value
        }));
    };

    const handleSelectProperty = (property) => {
        setSelectedProperty(property);
        setPropertyForm({
            titulo: property.titulo || '',
            precio: property.precio || 0,
            tipo: property.tipo || 'venta',
            habitaciones: property.habitaciones || 1,
            banos: property.banos || 1,
            ubicacion: property.ubicacion || '',
            descripcion: property.descripcion || '',
            imagen_url: property.imagen_url || '',
            status: property.status || 'borrador'
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const resetPropertyForm = () => {
        setSelectedProperty(null);
        setPropertyForm(emptyPropertyForm);
    };

    const getAccessToken = async () => {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session?.access_token) {
            throw new Error('No se pudo obtener el token de acceso.');
        }

        return session.access_token;
    };

    const handleSaveProperty = async (e) => {
        e.preventDefault();
        setSavingProperty(true);
        setStatusMessage('');
        setError('');

        try {
            if (!propertyForm.titulo || !propertyForm.precio || !propertyForm.ubicacion) {
                throw new Error('Completa el título, precio y ubicación.');
            }

            const token = await getAccessToken();
            const route = selectedProperty ? `/api/properties/${selectedProperty.id}` : '/api/properties';
            const method = selectedProperty ? 'PUT' : 'POST';

            const response = await fetch(route, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(propertyForm)
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Error guardando propiedad.');
            }

            setStatusMessage(selectedProperty ? 'Propiedad actualizada correctamente.' : 'Propiedad creada correctamente.');
            resetPropertyForm();
            if (user) {
                await fetchProperties(user.id);
            }
        } catch (err) {
            setError(err.message || 'Error guardando propiedad.');
        } finally {
            setSavingProperty(false);
        }
    };

    const handleArchiveProperty = async (id) => {
        if (!confirm('¿Archivar esta propiedad? Ya no se mostrará en el catálogo público.')) {
            return;
        }

        try {
            const token = await getAccessToken();
            const response = await fetch(`/api/properties/${id}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Error archivando propiedad.');
            }

            setStatusMessage('Propiedad archivada.');
            if (user) {
                await fetchProperties(user.id);
            }
        } catch (err) {
            setError(err.message || 'Error archivando propiedad.');
        }
    };

    if (loading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <Loader2 className="animate-spin text-blue-500" size={48} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-500/10 border border-red-500 text-red-300 p-6 rounded-xl">
                {error}
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <section className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-xl">
                <div className="flex items-center gap-3 mb-6">
                    <Plus size={24} className="text-pink-400" />
                    <div>
                        <h2 className="text-2xl font-bold text-white">Mis propiedades</h2>
                        <p className="text-slate-400 text-sm">Crea, edita y controla el estado de tus propiedades.</p>
                    </div>
                </div>

                <form onSubmit={handleSaveProperty} className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-slate-300 text-sm mb-1">Título</label>
                            <input
                                name="titulo"
                                value={propertyForm.titulo}
                                onChange={handlePropertyChange}
                                className="w-full px-4 py-3 rounded-2xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                            />
                        </div>
                        <div>
                            <label className="block text-slate-300 text-sm mb-1">Precio</label>
                            <input
                                name="precio"
                                type="number"
                                min="0"
                                value={propertyForm.precio}
                                onChange={handlePropertyChange}
                                className="w-full px-4 py-3 rounded-2xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                            />
                        </div>
                        <div>
                            <label className="block text-slate-300 text-sm mb-1">Tipo</label>
                            <select
                                name="tipo"
                                value={propertyForm.tipo}
                                onChange={handlePropertyChange}
                                className="w-full px-4 py-3 rounded-2xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                            >
                                <option value="venta">Venta</option>
                                <option value="renta">Renta</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-slate-300 text-sm mb-1">Habitaciones</label>
                                <input
                                    name="habitaciones"
                                    type="number"
                                    min="1"
                                    value={propertyForm.habitaciones}
                                    onChange={handlePropertyChange}
                                    className="w-full px-4 py-3 rounded-2xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                                />
                            </div>
                            <div>
                                <label className="block text-slate-300 text-sm mb-1">Baños</label>
                                <input
                                    name="banos"
                                    type="number"
                                    min="1"
                                    value={propertyForm.banos}
                                    onChange={handlePropertyChange}
                                    className="w-full px-4 py-3 rounded-2xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-slate-300 text-sm mb-1">Ubicación</label>
                            <input
                                name="ubicacion"
                                value={propertyForm.ubicacion}
                                onChange={handlePropertyChange}
                                className="w-full px-4 py-3 rounded-2xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                            />
                        </div>
                        <div>
                            <label className="block text-slate-300 text-sm mb-1">Imagen URL</label>
                            <input
                                name="imagen_url"
                                value={propertyForm.imagen_url}
                                onChange={handlePropertyChange}
                                className="w-full px-4 py-3 rounded-2xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                            />
                        </div>
                        <div>
                            <label className="block text-slate-300 text-sm mb-1">Estado</label>
                            <select
                                name="status"
                                value={propertyForm.status}
                                onChange={handlePropertyChange}
                                className="w-full px-4 py-3 rounded-2xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                            >
                                <option value="borrador">Borrador</option>
                                <option value="publicada">Publicada</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-slate-300 text-sm mb-1">Descripción</label>
                            <textarea
                                name="descripcion"
                                rows="4"
                                value={propertyForm.descripcion}
                                onChange={handlePropertyChange}
                                className="w-full px-4 py-3 rounded-2xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                type="submit"
                                disabled={savingProperty}
                                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 bg-pink-600 hover:bg-pink-700 rounded-2xl text-white font-semibold transition disabled:opacity-50"
                            >
                                {savingProperty ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                                {selectedProperty ? 'Actualizar propiedad' : 'Agregar propiedad'}
                            </button>
                            {selectedProperty && (
                                <button
                                    type="button"
                                    onClick={resetPropertyForm}
                                    className="px-5 py-3 bg-slate-700 hover:bg-slate-600 rounded-2xl text-white font-semibold transition"
                                >
                                    Cancelar
                                </button>
                            )}
                        </div>
                        {statusMessage && (
                            <p className="text-slate-300 text-sm">{statusMessage}</p>
                        )}
                    </div>
                </form>
            </section>

            <section className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-xl">
                <h3 className="text-xl font-bold text-white mb-4">Tus propiedades</h3>
                {properties.length === 0 ? (
                    <p className="text-slate-400">Aún no tienes propiedades registradas.</p>
                ) : (
                    <div className="space-y-4">
                        {properties.map((property) => (
                            <div key={property.id} className="bg-slate-900 p-4 rounded-3xl border border-slate-700">
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                    <div className="space-y-1">
                                        <p className="font-bold text-white">{property.titulo}</p>
                                        <p className="text-slate-400 text-sm">{property.ubicacion} · {property.tipo}</p>
                                        <span className={`text-xs inline-flex px-2 py-1 rounded-full uppercase ${property.status === 'publicada' ? 'bg-emerald-500/10 text-emerald-300' : property.status === 'archivada' ? 'bg-slate-500/20 text-slate-300' : 'bg-amber-500/10 text-amber-300'}`}>
                                            {property.status || 'borrador'}
                                        </span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleSelectProperty(property)}
                                            className="px-4 py-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm inline-flex items-center gap-2"
                                        >
                                            <Edit2 size={16} /> Editar
                                        </button>
                                        <button
                                            onClick={() => handleArchiveProperty(property.id)}
                                            className="px-4 py-2 rounded-2xl bg-slate-700 hover:bg-slate-600 text-white text-sm inline-flex items-center gap-2"
                                        >
                                            <Archive size={16} /> Archivar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
