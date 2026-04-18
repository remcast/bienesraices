// src/components/AnonymousAuthInitializer.tsx
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function AnonymousAuthInitializer() {
    useEffect(() => {
    const initializeAnonymousAuth = async () => {
        try {
        // Verificar si ya hay un usuario
        const { data: { user } } = await supabase.auth.getUser();
        
        // Si no hay usuario, crear uno anónimo
        if (!user) {
            console.log('Creando usuario anónimo...');
            const { data, error } = await supabase.auth.signInAnonymously();
            
            if (error) {
            console.error('Error al crear usuario anónimo:', error);
            } else {
            console.log('Usuario anónimo creado:', data.user?.id);
            }
        } else {
            console.log('Usuario existente:', user.id, 'Anónimo:', user.is_anonymous);
        }
        } catch (error) {
        console.error('Error en inicialización anónima:', error);
        }
    };

    initializeAnonymousAuth();
    }, []);

  // Este componente no renderiza nada visible
    return null;
}