import { useState } from 'react';
import { z } from 'zod'; // 1. Importamos Zod
import { Send, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

// 2. Definimos el "Esquema" de validación
// Esto son las reglas que deben cumplir los datos
const contactSchema = z.object({
    nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
    email: z.string().email("Ingresa un correo electrónico válido"),
    confirmEmail: z.string().email("Confirma tu correo"), // Campo de confirmación
    telefono: z.string().regex(/^\d{10}$/, "El teléfono debe tener 10 dígitos numéricos"), // Regex estricto
    mensaje: z.string().min(10, "El mensaje es muy corto (mínimo 10 caracteres)")
}).refine((data) => data.email === data.confirmEmail, {
    message: "Los correos electrónicos no coinciden",
    path: ["confirmEmail"], // El error aparecerá en este campo
});

export default function ContactForm() {
    const [formData, setFormData] = useState({
        nombre: '',
        email: '',
        confirmEmail: '', // Estado nuevo
        telefono: '',
        mensaje: ''
    });

    const [errors, setErrors] = useState({}); // Aquí guardaremos los errores de validación
    const [status, setStatus] = useState('idle'); // idle | loading | success | error
    const [serverError, setServerError] = useState(''); // Mensaje de error del servidor

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        // Limpiamos el error de ese campo cuando el usuario escribe
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: null }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus('loading');
        setErrors({});
        setServerError('');

        // Validación Frontend (Inmediata)
        const result = contactSchema.safeParse(formData);

        if (!result.success) {
            // Si falla, formateamos los errores para mostrarlos
            const formattedErrors = {};
            result.error.issues.forEach(issue => {
                formattedErrors[issue.path[0]] = issue.message;
            });
            setErrors(formattedErrors);
            setStatus('idle');
            return; // Detenemos el envío
        }

        // Envío al Backend (Validación Servidor + Unicidad)
        //utiliza fetch que permite realizar peticiones asíncronas al servidor sin necesidad de recargar la página.
        try {
            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(result.data) // Enviamos solo datos limpios
            });

            const data = await response.json();

            if (!response.ok) {
                // Manejo de errores que vienen del servidor (Ej: Duplicado)
                if (data.details) {
                    setErrors(data.details); // Errores de validación extra
                } else {
                    setServerError(data.message || "Error al procesar la solicitud");
                }
                setStatus('idle');
                return;
            }

            setStatus('success');
            setFormData({ nombre: '', email: '', confirmEmail: '', telefono: '', mensaje: '' }); // Limpiar formu
        } catch (error) {
            console.error(error);
            setServerError("Error de conexión con el servidor");
            setStatus('error');
        }
    };

    return (
        <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700 max-w-lg w-full mx-auto">
            <h2 className="text-3xl font-bold text-white mb-2">Contáctanos</h2>
            <p className="text-slate-400 mb-8">Déjanos tus datos y un asesor se pondrá en contacto contigo.</p>

            {status === 'success' ? (
                <div className="bg-green-500/10 border border-green-500 text-green-400 p-6 rounded-xl text-center animate-fade-in">
                    <CheckCircle className="w-12 h-12 mx-auto mb-4" />
                    <h3 className="text-xl font-bold mb-2">¡Mensaje Enviado!</h3>
                    <p>Gracias por escribirnos. Te responderemos a la brevedad.</p>
                    <button
                        onClick={() => setStatus('idle')}
                        className="mt-6 text-sm font-bold hover:underline"
                    >
                        Enviar otro mensaje
                    </button>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-5">

                    {/* Mensaje de Error General del Servidor */}
                    {serverError && (
                        <div className="bg-red-500/10 border border-red-500 text-red-400 p-3 rounded-lg text-sm flex items-center gap-2">
                            <AlertCircle size={16} /> {serverError}
                        </div>
                    )}

                    {/* Nombre */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Nombre Completo <span className="text-pink-500">*</span></label>
                        <input
                            type="text"
                            name="nombre"
                            value={formData.nombre}
                            onChange={handleChange}
                            className={`w-full p-3 rounded-lg bg-slate-900 border ${errors.nombre ? 'border-red-500 focus:ring-red-500' : 'border-slate-600 focus:ring-pink-500'} text-white focus:ring-2 outline-none transition`}
                            placeholder="Juan Pérez"
                        />
                        {errors.nombre && <p className="text-red-400 text-xs mt-1 flex items-center gap-1"><AlertCircle size={12} /> {errors.nombre}</p>}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Email */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Correo <span className="text-pink-500">*</span></label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className={`w-full p-3 rounded-lg bg-slate-900 border ${errors.email ? 'border-red-500 focus:ring-red-500' : 'border-slate-600 focus:ring-pink-500'} text-white focus:ring-2 outline-none transition`}
                                placeholder="juan@ejemplo.com"
                            />
                            {errors.email && <p className="text-red-400 text-xs mt-1 flex items-center gap-1"><AlertCircle size={12} /> {errors.email}</p>}
                        </div>

                        {/* Confirmar Email */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Confirmar Correo <span className="text-pink-500">*</span></label>
                            <input
                                type="email"
                                name="confirmEmail"
                                value={formData.confirmEmail}
                                onChange={handleChange}
                                onPaste={(e) => e.preventDefault()} // Evitar pegar para forzar validación manual
                                className={`w-full p-3 rounded-lg bg-slate-900 border ${errors.confirmEmail ? 'border-red-500 focus:ring-red-500' : 'border-slate-600 focus:ring-pink-500'} text-white focus:ring-2 outline-none transition`}
                                placeholder="Repite tu correo"
                            />
                            {errors.confirmEmail && <p className="text-red-400 text-xs mt-1 flex items-center gap-1"><AlertCircle size={12} /> {errors.confirmEmail}</p>}
                        </div>
                    </div>

                    {/* Teléfono */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Teléfono (10 dígitos) <span className="text-pink-500">*</span></label>
                        <input
                            type="tel"
                            name="telefono"
                            maxLength={10}
                            value={formData.telefono}
                            onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, ''); // Solo permitir números al escribir
                                setFormData(prev => ({ ...prev, telefono: val }));
                            }}
                            className={`w-full p-3 rounded-lg bg-slate-900 border ${errors.telefono ? 'border-red-500 focus:ring-red-500' : 'border-slate-600 focus:ring-pink-500'} text-white focus:ring-2 outline-none transition`}
                            placeholder="9931234567"
                        />
                        {errors.telefono && <p className="text-red-400 text-xs mt-1 flex items-center gap-1"><AlertCircle size={12} /> {errors.telefono}</p>}
                    </div>

                    {/* Mensaje */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Mensaje <span className="text-pink-500">*</span></label>
                        <textarea
                            name="mensaje"
                            rows="4"
                            value={formData.mensaje}
                            onChange={handleChange}
                            className={`w-full p-3 rounded-lg bg-slate-900 border ${errors.mensaje ? 'border-red-500 focus:ring-red-500' : 'border-slate-600 focus:ring-pink-500'} text-white focus:ring-2 outline-none transition`}
                            placeholder="Estoy interesado en..."
                        ></textarea>
                        {errors.mensaje && <p className="text-red-400 text-xs mt-1 flex items-center gap-1"><AlertCircle size={12} /> {errors.mensaje}</p>}
                    </div>

                    <button
                        type="submit"
                        disabled={status === 'loading'}
                        className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 rounded-lg transition transform hover:scale-[1.02] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {status === 'loading' ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                Validando...
                            </>
                        ) : (
                            <>
                                Enviar Mensaje
                                <Send size={20} />
                            </>
                        )}
                    </button>
                </form>
            )}
        </div>
    );
}
