import type { APIRoute } from 'astro';
import { z } from 'zod';
import { supabase } from "../../lib/supabase"; 

export const prerender = false;

const serverSchema = z.object({
    nombre: z.string().min(2),
    email: z.string().email(),
    telefono: z.string().regex(/^\d{10}$/),
    mensaje: z.string().min(10)
});

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const result = serverSchema.safeParse(body);

        if (!result.success) {
            return new Response(JSON.stringify({ error: "Datos inválidos" }), { status: 400 });
        }

    
        const { error: dbError } = await supabase
            .from('contactos') // Debe coincidir con el nombre de tu tabla
            .insert([
                { 
                    nombre: result.data.nombre, 
                    email: result.data.email, 
                    telefono: result.data.telefono, 
                    mensaje: result.data.mensaje 
                }
            ]);

        if (dbError) throw dbError; 


        return new Response(JSON.stringify({
            message: "Mensaje guardado en Supabase"
        }), { status: 200 });

    } catch (e: any) {
        console.error("Error en servidor:", e.message);
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}