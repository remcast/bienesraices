import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import AdminContacts from './AdminContacts.jsx';
import { Loader2, Plus, Trash2, Edit2, CheckCircle, UserPlus, Power, RotateCcw } from 'lucide-react';

const emptySellerForm = {
    nombre: '',
    email: '',
    password: '',
    status: 'active'
};

const emptyPropertyForm = {
    titulo: '',
    precio: '',
    tipo: 'venta',
    habitaciones: 1,
    banos: 1,
    ubicacion: '',
    descripcion: '',
    imagen_url: '',
    owner_id: '',
    status: 'borrador'
};

export default function AdminPanel() {
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [error, setError] = useState('');
    const [sellers, setSellers] = useState([]);
    const [properties, setProperties] = useState([]);
    const [sellerForm, setSellerForm] = useState(emptySellerForm);
    const [propertyForm, setPropertyForm] = useState(emptyPropertyForm);
    const [selectedSeller, setSelectedSeller] = useState(null);
    const [selectedProperty, setSelectedProperty] = useState(null);
    const [savingSeller, setSavingSeller] = useState(false);
    const [savingProperty, setSavingProperty] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');

    useEffect(() => {
        const init = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    setError('Debes iniciar sesión para ver este panel.');
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

                if (!profile || profile.role !== 'admin' || profile.status !== 'active') {
                    setError('Acceso denegado. Solo administradores activos pueden ver este panel.');
                    return;
                }

                setUser(session.user);
                await Promise.all([fetchSellers(session.access_token), fetchProperties()]);
            } catch (err) {
                setError(err.message || 'Error al cargar el panel de administración.');
            } finally {
                setLoading(false);
            }
        };

        init();
    }, []);

    const getAccessToken = async () => {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session?.access_token) {
            throw new Error('No se pudo obtener el token de acceso.');
        }

        return session.access_token;
    };

    const fetchSellers = async (tokenOverride) => {
        const token = tokenOverride || await getAccessToken();
        const response = await fetch('/api/sellers', {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || 'No se pudieron cargar los vendedores.');
        }

        setSellers(result);
    };

    const fetchProperties = async () => {
        const { data, error: propertiesError } = await supabase
            .from('propiedades')
            .select('*')
            .order('created_at', { ascending: false });

        if (propertiesError) {
            throw propertiesError;
        }

        setProperties(data || []);
    };

    const resetSellerForm = () => {
        setSelectedSeller(null);
        setSellerForm(emptySellerForm);
    };

    const resetPropertyForm = () => {
        setSelectedProperty(null);
        setPropertyForm(emptyPropertyForm);
    };

    const handleSellerChange = (e) => {
        const { name, value } = e.target;
        setSellerForm((prev) => ({ ...prev, [name]: value }));
    };

    const handlePropertyChange = (e) => {
        const { name, value } = e.target;
        setPropertyForm((prev) => ({
            ...prev,
            [name]: ['precio', 'habitaciones', 'banos'].includes(name) ? Number(value) : value
        }));
    };

    const handleSaveSeller = async (e) => {
        e.preventDefault();
        setSavingSeller(true);
        setStatusMessage('');

        try {
            if (!sellerForm.nombre || !sellerForm.email) {
                throw new Error('Completa nombre y email del vendedor.');
            }

            if (!selectedSeller && !sellerForm.password) {
                throw new Error('La contraseña temporal es obligatoria para crear vendedores.');
            }

            const token = await getAccessToken();
            const route = selectedSeller ? `/api/sellers/${selectedSeller.id}` : '/api/sellers';
            const method = selectedSeller ? 'PUT' : 'POST';

            const payload = selectedSeller
                ? {
                    nombre: sellerForm.nombre,
                    email: sellerForm.email,
                    status: sellerForm.status
                }
                : sellerForm;

            const response = await fetch(route, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Error guardando vendedor.');
            }

            setStatusMessage(selectedSeller ? 'Vendedor actualizado correctamente.' : 'Vendedor creado correctamente.');
            resetSellerForm();
            await fetchSellers(token);
        } catch (err) {
            setStatusMessage(err.message || 'Error guardando vendedor.');
        } finally {
            setSavingSeller(false);
        }
    };

    const handleSelectSeller = (seller) => {
        setSelectedSeller(seller);
        setSellerForm({
            nombre: seller.full_name || '',
            email: seller.email || '',
            password: '',
            status: seller.status || 'active'
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleToggleSellerStatus = async (seller) => {
        setStatusMessage('');

        try {
            const token = await getAccessToken();
            const nextStatus = seller.status === 'active' ? 'inactive' : 'active';

            const response = await fetch(`/api/sellers/${seller.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    nombre: seller.full_name,
                    email: seller.email,
                    status: nextStatus
                })
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'No se pudo actualizar el estado del vendedor.');
            }

            setStatusMessage(nextStatus === 'active' ? 'Vendedor activado.' : 'Vendedor desactivado.');
            await fetchSellers(token);
        } catch (err) {
            setStatusMessage(err.message || 'No se pudo actualizar el vendedor.');
        }
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
            owner_id: property.owner_id || '',
            status: property.status || 'borrador'
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSaveProperty = async (e) => {
        e.preventDefault();
        setSavingProperty(true);
        setStatusMessage('');

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
            await fetchProperties();
        } catch (err) {
            setStatusMessage(err.message || 'Error guardando propiedad.');
        } finally {
            setSavingProperty(false);
        }
    };

    const handleDeleteProperty = async (id) => {
        if (!confirm('¿Deseas eliminar esta propiedad? Esta acción solo la puede ejecutar el administrador.')) {
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
                throw new Error(result.error || 'Error eliminando propiedad.');
            }

            setStatusMessage('Propiedad eliminada.');
            await fetchProperties();
        } catch (err) {
            setStatusMessage(err.message || 'Error eliminando propiedad.');
        }
    };

    const sellerNameById = sellers.reduce((acc, seller) => {
        acc[seller.id] = seller.full_name || seller.email || 'Sin asignar';
        return acc;
    }, {});

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
            <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                <section className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-xl">
                    <div className="flex items-center gap-3 mb-6">
                        <UserPlus size={24} className="text-blue-400" />
                        <div>
                            <h2 className="text-2xl font-bold text-white">{selectedSeller ? 'Editar vendedor' : 'Crear vendedor'}</h2>
                            <p className="text-slate-400 text-sm">Administra vendedores activos con contraseña temporal y estado de acceso.</p>
                        </div>
                    </div>

                    <form onSubmit={handleSaveSeller} className="space-y-4">
                        <div>
                            <label className="block text-slate-300 text-sm mb-1">Nombre completo</label>
                            <input
                                name="nombre"
                                value={sellerForm.nombre}
                                onChange={handleSellerChange}
                                className="w-full px-4 py-3 rounded-2xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Ej. Juan Pérez"
                            />
                        </div>
                        <div>
                            <label className="block text-slate-300 text-sm mb-1">Email</label>
                            <input
                                name="email"
                                type="email"
                                value={sellerForm.email}
                                onChange={handleSellerChange}
                                className="w-full px-4 py-3 rounded-2xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="vendedor@firma.com"
                            />
                        </div>

                        {!selectedSeller && (
                            <div>
                                <label className="block text-slate-300 text-sm mb-1">Contraseña temporal</label>
                                <input
                                    name="password"
                                    type="password"
                                    value={sellerForm.password}
                                    onChange={handleSellerChange}
                                    className="w-full px-4 py-3 rounded-2xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Mínimo 8 caracteres"
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-slate-300 text-sm mb-1">Estado</label>
                            <select
                                name="status"
                                value={sellerForm.status}
                                onChange={handleSellerChange}
                                className="w-full px-4 py-3 rounded-2xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="active">Activo</option>
                                <option value="inactive">Inactivo</option>
                            </select>
                        </div>

                        <div className="flex gap-3">
                            <button
                                type="submit"
                                disabled={savingSeller}
                                className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 rounded-2xl text-white font-semibold transition disabled:opacity-50"
                            >
                                {savingSeller ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                                {selectedSeller ? 'Guardar vendedor' : 'Crear vendedor'}
                            </button>

                            {selectedSeller && (
                                <button
                                    type="button"
                                    onClick={resetSellerForm}
                                    className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-slate-700 hover:bg-slate-600 rounded-2xl text-white font-semibold transition"
                                >
                                    <RotateCcw size={18} />
                                    Cancelar edición
                                </button>
                            )}
                        </div>
                    </form>
                </section>

                <section className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-xl">
                    <h2 className="text-2xl font-bold text-white mb-4">Vendedores</h2>
                    {sellers.length === 0 ? (
                        <p className="text-slate-400">No hay vendedores registrados aún.</p>
                    ) : (
                        <div className="space-y-3">
                            {sellers.map((seller) => (
                                <div key={seller.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-700 space-y-3">
                                    <div>
                                        <p className="text-white font-medium">{seller.full_name || 'Sin nombre'}</p>
                                        <p className="text-slate-400 text-sm">{seller.email || 'Sin email'}</p>
                                    </div>

                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`text-xs inline-flex px-2 py-1 rounded-full uppercase ${seller.status === 'active' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'}`}>
                                            {seller.status === 'active' ? 'Activo' : 'Inactivo'}
                                        </span>
                                        <button
                                            onClick={() => handleSelectSeller(seller)}
                                            className="px-3 py-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm inline-flex items-center gap-2"
                                        >
                                            <Edit2 size={15} />
                                            Editar
                                        </button>
                                        <button
                                            onClick={() => handleToggleSellerStatus(seller)}
                                            className="px-3 py-2 rounded-2xl bg-slate-700 hover:bg-slate-600 text-white text-sm inline-flex items-center gap-2"
                                        >
                                            <Power size={15} />
                                            {seller.status === 'active' ? 'Desactivar' : 'Activar'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>

            <section className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-xl">
                <div className="flex items-center gap-3 mb-6">
                    <Edit2 size={24} className="text-pink-400" />
                    <div>
                        <h2 className="text-2xl font-bold text-white">Gestión de propiedades</h2>
                        <p className="text-slate-400 text-sm">Crea, reasigna, publica, archiva o marca propiedades como vendidas.</p>
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
                            <label className="block text-slate-300 text-sm mb-1">Asignar a vendedor</label>
                            <select
                                name="owner_id"
                                value={propertyForm.owner_id}
                                onChange={handlePropertyChange}
                                className="w-full px-4 py-3 rounded-2xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                            >
                                <option value="">Sin asignar, queda a mi nombre</option>
                                {sellers.filter((seller) => seller.status === 'active').map((seller) => (
                                    <option key={seller.id} value={seller.id}>
                                        {seller.full_name || seller.email}
                                    </option>
                                ))}
                            </select>
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
                                <option value="vendida">Vendida</option>
                                <option value="archivada">Archivada</option>
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
                <h3 className="text-xl font-bold text-white mb-4">Propiedades existentes</h3>
                {properties.length === 0 ? (
                    <p className="text-slate-400">No se encontró ninguna propiedad.</p>
                ) : (
                    <div className="space-y-4">
                        {properties.map((property) => (
                            <div key={property.id} className="bg-slate-900 p-4 rounded-3xl border border-slate-700">
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                    <div className="space-y-1">
                                        <p className="font-bold text-white">{property.titulo}</p>
                                        <p className="text-slate-400 text-sm">{property.ubicacion} · {property.tipo}</p>
                                        <p className="text-slate-500 text-sm">Asignada a: {sellerNameById[property.owner_id] || (property.owner_id === user?.id ? 'Administrador' : 'Sin asignar')}</p>
                                        <span className={`text-xs inline-flex px-2 py-1 rounded-full uppercase ${property.status === 'publicada' ? 'bg-emerald-500/10 text-emerald-300' : property.status === 'vendida' ? 'bg-blue-500/10 text-blue-300' : property.status === 'archivada' ? 'bg-slate-500/20 text-slate-300' : 'bg-amber-500/10 text-amber-300'}`}>
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
                                            onClick={() => handleDeleteProperty(property.id)}
                                            className="px-4 py-2 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-sm inline-flex items-center gap-2"
                                        >
                                            <Trash2 size={16} /> Eliminar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-xl">
                <h3 className="text-xl font-bold text-white mb-4">Solicitudes de contacto</h3>
                <AdminContacts client:load />
            </section>
        </div>
    );
}
