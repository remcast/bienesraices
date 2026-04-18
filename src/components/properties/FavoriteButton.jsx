import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Heart, Loader2 } from 'lucide-react';

export default function FavoriteButton({ propertyId }) {
    const [isFavorite, setIsFavorite] = useState(false);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState(null);
    const [isAnonymous, setIsAnonymous] = useState(false);

    // 1. Verificar estado inicial
    useEffect(() => {
        const checkFavorite = async () => {
            try {
                // Obtener sesión actual
                const { data: { session } } = await supabase.auth.getSession();

                if (!session) {
                    console.log('No hay sesión, el botón no debería mostrarse o debería redirigir');
                    setLoading(false);
                    return;
                }

                // Guardar información del usuario
                setUserId(session.user.id);
                setIsAnonymous(session.user.is_anonymous || false);

                // Consultar si ya es favorito
                const { data, error } = await supabase
                    .from('favorites')
                    .select('*')
                    .eq('property_id', propertyId)
                    .eq('user_id', session.user.id)
                    .maybeSingle(); // mejor que limit(1) porque no da error si no hay resultados

                if (error && error.code !== 'PGRST116') { // PGRST116 es "no rows found"
                    console.error('Error al verificar favorito:', error);
                }

                if (data) setIsFavorite(true);
                
            } catch (error) {
                console.error('Error en checkFavorite:', error);
            } finally {
                setLoading(false);
            }
        };

        checkFavorite();
    }, [propertyId]);

    // 2. Manejar Click
    const toggleFavorite = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!userId) {
            // Esto no debería pasar porque siempre hay sesión anónima,
            // pero por si acaso
            console.log('No hay userId, redirigiendo a login...');
            window.location.href = '/ingresar';
            return;
        }

        // Optimistic UI update
        const newState = !isFavorite;
        setIsFavorite(newState);

        try {
            if (newState) {
                // Agregar favorito
                const { error } = await supabase
                    .from('favorites')
                    .insert([{ 
                        user_id: userId, 
                        property_id: propertyId,
                        created_at: new Date().toISOString()
                    }]);
                
                if (error) throw error;
                
                console.log('✅ Favorito agregado para usuario:', userId, 
                          isAnonymous ? '(anónimo)' : '(registrado)');
                
            } else {
                // Eliminar favorito
                const { error } = await supabase
                    .from('favorites')
                    .delete()
                    .eq('user_id', userId)
                    .eq('property_id', propertyId);
                
                if (error) throw error;
                
                console.log('✅ Favorito eliminado para usuario:', userId);
            }
        } catch (error) {
            console.error("❌ Error al actualizar favorito:", error);
            setIsFavorite(!newState); // Revertir si hubo error
        }
    };

    // 3. Renderizar el botón
    return (
        <button
            onClick={toggleFavorite}
            disabled={loading}
            className={`absolute top-4 right-4 p-2 rounded-full shadow-lg transition transform hover:scale-110 z-10 
                ${isFavorite
                    ? 'bg-pink-500 text-white shadow-pink-500/30'
                    : 'bg-white/90 text-slate-400 hover:text-pink-500 hover:bg-white'
                } ${loading ? 'opacity-50 cursor-wait' : ''}`}
            title={isFavorite ? "Quitar de favoritos" : "Guardar en favoritos"}
        >
            {loading ? (
                <Loader2 size={20} className="animate-spin" />
            ) : (
                <Heart size={20} fill={isFavorite ? "currentColor" : "none"} strokeWidth={2} />
            )}
        </button>
    );
}