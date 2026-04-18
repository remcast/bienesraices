import { useState, useEffect } from 'react';
import { Search, Loader2, MapPin, Home } from 'lucide-react';
import FavoriteButton from './FavoriteButton.jsx';

export default function SearchFilter() {
    const [propiedades, setPropiedades] = useState([]);
    const [loading, setLoading] = useState(true);

    // Estados para los filtros
    const [tipo, setTipo] = useState('todos');
    const [precioMax, setPrecioMax] = useState('');
    const [busqueda, setBusqueda] = useState(''); // Nuevo estado para texto

    const buscarPropiedades = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();

            // Solo agregamos el parámetro si tiene un valor real
            if (tipo !== 'todos') params.append('tipo', tipo);
            if (precioMax) params.append('max', precioMax);
            if (busqueda) params.append('q', busqueda);

            console.log("Enviando petición a:", `/api/search.json?${params.toString()}`); // Para depurar en navegador
            
            // uso del AJAX para realizar una solicitud al servidor sin recargar la página, lo que permite obtener los resultados de búsqueda de manera dinámica y eficiente.
            const res = await fetch(`/api/search.json?${params.toString()}`);
            const data = await res.json();
            setPropiedades(data);
        } catch (error) {
            console.error("Error buscando:", error);
        } finally {
            setLoading(false);
        }
    };

    // Efecto: Busca cada vez que cambie algo (con un pequeño retraso para no saturar)
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            buscarPropiedades();
        }, 400); // Espera 400ms a que termines de escribir/mover
        return () => clearTimeout(timeoutId);
    }, [tipo, precioMax, busqueda]);

    return (
        <div className="space-y-8">
            {/* --- PANEL DE CONTROL --- */}
            {/* --- PANEL DE CONTROL --- */}
            <div className="bg-slate-800 p-6 rounded-xl shadow-md border border-pink-500 flex flex-col gap-6">

                {/* Barra de Búsqueda Principal (Criterio: Búsqueda) */}
                <div className="relative w-full">
                    <Search className="absolute left-3 top-3 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar por ubicación (ej: Centro) o nombre..."
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-700 text-white rounded-lg focus:ring-2 focus:ring-pink-500 outline-none transition placeholder-slate-500"
                    />
                </div>

                {/* Filtros Secundarios */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-6 border-slate-700">
                    <div>
                        <label className="block text-xs font-bold text-slate-300 uppercase mb-2">Operación</label>
                        <select
                            value={tipo}
                            onChange={(e) => setTipo(e.target.value)}
                            className="w-full p-2 border border-slate-700 rounded-lg bg-slate-900 text-white"
                        >
                            <option value="todos">Cualquiera</option>
                            <option value="venta">En Venta</option>
                            <option value="renta">En Renta</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-300 uppercase mb-2">
                            Presupuesto Máx: {precioMax ? `$${parseInt(precioMax).toLocaleString()}` : 'Sin límite'}
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="6000000"
                            step="50000"
                            value={precioMax}
                            onChange={(e) => setPrecioMax(e.target.value)}
                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
                        />
                    </div>

                    <div className="flex items-end">
                        <button
                            onClick={() => { setTipo('todos'); setPrecioMax(''); setBusqueda(''); }}
                            className="w-full py-2 px-4 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition font-medium text-sm border border-slate-600"
                        >
                            Limpiar todo
                        </button>
                    </div>
                </div>
            </div>

            {/* --- RESULTADOS --- */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="animate-spin text-blue-600" size={48} />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {propiedades.length > 0 ? (
                        propiedades.map((prop) => (
                            <div key={prop.id} className="group bg-slate-800 rounded-xl shadow-lg hover:shadow-2xl transition duration-300 border border-pink-500 overflow-hidden relative">
                                <div className="h-48 overflow-hidden relative">
                                    <img src={prop.imagen_url} alt={prop.titulo} className="w-full h-full object-cover" />
                                    <span className={`absolute top-2 left-2 px-3 py-1 rounded-full text-xs font-bold uppercase text-white ${prop.tipo === 'venta' ? 'bg-blue-600' : 'bg-green-600'}`}>
                                        {prop.tipo}
                                    </span>
                                    {/* Botón Favoritos (React) */}
                                    <FavoriteButton propertyId={prop.id} />
                                </div>
                                <div className="p-5">
                                    <h3 className="text-xl font-bold text-white mb-2 truncate" title={prop.titulo}>{prop.titulo}</h3>

                                    <p className="text-2xl font-bold text-blue-400 mb-4">
                                        {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(prop.precio)}
                                    </p>

                                    <div className="flex justify-between text-slate-300 text-sm border-t border-slate-700 pt-4">
                                        <div className="flex items-center gap-2">
                                            <Home size={18} className="text-pink-500" />
                                            <span>{prop.habitaciones} Hab.</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <MapPin size={18} className="text-pink-500" />
                                            <span className="truncate max-w-[100px]">{prop.ubicacion}</span>
                                        </div>
                                    </div>

                                    <a href={`/propiedades/${prop.id}`} className="block w-full text-center mt-6 bg-slate-900 border border-slate-700 text-white py-3 rounded-lg hover:bg-pink-600 hover:border-pink-600 transition font-medium">
                                        Ver Detalles
                                    </a>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full text-center py-12 bg-slate-800 rounded-lg border-2 border-dashed border-slate-700">
                            <Home className="mx-auto h-12 w-12 text-slate-500 mb-2" />
                            <p className="text-slate-400 font-medium">No encontramos propiedades con esos criterios.</p>
                            <button onClick={() => { setBusqueda(''); setTipo('todos'); setPrecioMax('') }} className="text-pink-500 text-sm mt-2 hover:underline">Limpiar filtros</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}