// src/hooks/useAnonymousAuth.ts
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

export function useAnonymousAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAnonymous, setIsAnonymous] = useState(false);

    useEffect(() => {
    // Verificar si hay un usuario anónimo al cargar
    const checkUser = async () => {
        try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
            setUser(user);
            setIsAnonymous(user.is_anonymous || false);
        } else {
          // No hay usuario, crear uno anónimo
            await createAnonymousUser();
        }
        } catch (error) {
        console.error('Error checking user:', error);
        // Si hay error, intentar crear anónimo
        await createAnonymousUser();
        } finally {
        setLoading(false);
        }
    };

    checkUser();

    // Suscribirse a cambios en la autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (session?.user) {
        setUser(session.user);
        setIsAnonymous(session.user.is_anonymous || false);
        } else {
        setUser(null);
        setIsAnonymous(false);
        }
    });

    return () => subscription.unsubscribe();
    }, []);

    const createAnonymousUser = async () => {
    try {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        setUser(data.user);
        setIsAnonymous(true);
    } catch (error) {
        console.error('Error creating anonymous user:', error);
    }
    };

    const linkAnonymousToEmail = async (email: string, password: string) => {
    try {
      // Actualizar el usuario anónimo con email y password
        const { data, error } = await supabase.auth.updateUser({
        email,
        password
        });

        if (error) throw error;
        
      // Ahora el usuario ya no es anónimo
        setIsAnonymous(false);
        return { success: true, user: data.user };
    } catch (error) {
        console.error('Error linking account:', error);
        return { success: false, error };
    }
    };

    return {
    user,
    loading,
    isAnonymous,
    linkAnonymousToEmail
    };
}