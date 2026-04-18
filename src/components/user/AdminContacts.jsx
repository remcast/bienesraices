import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase'; 

export default function AdminContacts() {
    const [contactos, setContactos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null); // Estado para manejar errores 401/403

    useEffect(() => {
        const fetchContactos = async () => {
            try {
        // Obtenemos la sesión actual de Supabase en el cliente
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) throw new Error("No has iniciado sesión");
        if (!session.access_token) throw new Error("No se encontró token de acceso.");

        const response = await fetch('/api/GetContacts', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Error en el servidor");
        }

        const data = await response.json();
        setContactos(Array.isArray(data) ? data : []);
    } catch (err) {
        setError(err.message);
    } finally {
        setLoading(false);
    }
};
        fetchContactos();
    }, []);

    if (loading) return <p className="text-white text-center py-4">Cargando solicitudes...</p>;

    // Mostramos el error en pantalla si el AJAX falla
    if (error) return (
        <div className="bg-red-500/10 border border-red-500 text-red-400 p-4 rounded-xl text-center">
            {error}
        </div>
    );

    return (
        <div className="overflow-x-auto bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-2xl">
            <table className="w-full text-left text-slate-300">
                <thead className="text-white border-b border-slate-600">
                    <tr>
                        <th className="p-3">Nombre</th>
                        <th className="p-3">Email</th>
                        <th className="p-3">Mensaje</th>
                    </tr>
                </thead>
                <tbody>
                    {contactos.length === 0 ? (
                        <tr>
                            <td colSpan="3" className="p-10 text-center text-slate-500 italic">
                                No hay solicitudes registradas actualmente.
                            </td>
                        </tr>
                    ) : (
                        contactos.map((c) => (
                            <tr key={c.id} className="border-b border-slate-700 hover:bg-slate-700/50 transition-colors">
                                <td className="p-3 font-medium text-white">{c.nombre}</td>
                                <td className="p-3">{c.email}</td>
                                <td className="p-3 text-sm">{c.mensaje}</td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}