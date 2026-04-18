import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { z } from 'zod';
import { LogIn, Loader2, AlertCircle, CheckCircle, Mail, ArrowLeft } from 'lucide-react';

const loginSchema = z.object({
    email: z.string().email("Email inválido"),
    password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres")
});

const resetSchema = z.object({
    email: z.string().email("Email inválido")
});

export default function LoginForm() {
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [errors, setErrors] = useState({});
    const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'reset' | 'reset-sent'
    const [serverError, setServerError] = useState('');
    
    // Estado para restablecer contraseña
    const [resetEmail, setResetEmail] = useState('');
    const [resetErrors, setResetErrors] = useState({});

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus('loading');
        setErrors({});
        setServerError('');

        const result = loginSchema.safeParse(formData);

        if (!result.success) {
            const formattedErrors = {};
            result.error.issues.forEach(issue => {
                formattedErrors[issue.path[0]] = issue.message;
            });
            setErrors(formattedErrors);
            setStatus('idle');
            return;
        }

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: formData.email,
                password: formData.password
            });

            if (error) throw error;

            setStatus('success');
            setTimeout(() => {
                window.location.href = '/';
            }, 1000);

        } catch (error) {
            console.error('Login error:', error);
            setServerError("Credenciales incorrectas o error de conexión.");
            setStatus('idle');
        }
    };

    // Función para enviar correo de restablecimiento
    const handleResetPassword = async (e) => {
        e.preventDefault();
        setStatus('loading');
        setResetErrors({});
        setServerError('');

        const result = resetSchema.safeParse({ email: resetEmail });

        if (!result.success) {
            const formattedErrors = {};
            result.error.issues.forEach(issue => {
                formattedErrors[issue.path[0]] = issue.message;
            });
            setResetErrors(formattedErrors);
            setStatus('reset');
            return;
        }

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
                redirectTo: window.location.origin + '/reset-password', // Página donde el usuario pondrá la nueva contraseña
            });

            if (error) throw error;

            setStatus('reset-sent');
        } catch (error) {
            console.error('Reset error:', error);
            setServerError("Error al enviar correo. Intenta de nuevo.");
            setStatus('reset');
        }
    };

    // Si se envió el correo de restablecimiento
    if (status === 'reset-sent') {
        return (
            <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-md mx-auto">
                <div className="text-center py-10 animate-fade-in">
                    <Mail className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">¡Correo enviado!</h3>
                    <div className="text-slate-300 mb-6 bg-slate-900/50 p-4 rounded-lg border border-slate-600">
                        <p className="mb-2">Hemos enviado un correo a <span className="font-bold">{resetEmail}</span></p>
                        <p className="text-sm">Revisa tu bandeja de entrada y sigue las instrucciones para restablecer tu contraseña.</p>
                        <p className="text-sm mt-2 text-yellow-400">¿No lo recibiste? Revisa spam o intenta de nuevo.</p>
                    </div>
                    <button
                        onClick={() => {
                            setStatus('idle');
                            setResetEmail('');
                        }}
                        className="text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 mx-auto"
                    >
                        <ArrowLeft size={16} /> Volver al inicio de sesión
                    </button>
                </div>
            </div>
        );
    }

    // Formulario de restablecimiento
    if (status === 'reset') {
        return (
            <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-md mx-auto">
                <h2 className="text-2xl font-bold text-white mb-2 text-center">Restablecer Contraseña</h2>
                <p className="text-slate-400 mb-6 text-center text-sm">
                    Te enviaremos un correo con instrucciones para crear una nueva contraseña.
                </p>

                {serverError && (
                    <div className="bg-red-500/10 border border-red-500 text-red-400 p-3 rounded-lg text-sm flex items-center gap-2 mb-4">
                        <AlertCircle size={16} /> {serverError}
                    </div>
                )}

                <form onSubmit={handleResetPassword} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">
                            Correo Electrónico
                        </label>
                        <input
                            type="email"
                            value={resetEmail}
                            onChange={(e) => {
                                setResetEmail(e.target.value);
                                setResetErrors({});
                            }}
                            className={`w-full p-3 rounded-lg bg-slate-900 border ${
                                resetErrors.email ? 'border-red-500' : 'border-slate-600'
                            } text-white focus:ring-2 focus:ring-blue-500 outline-none transition`}
                            placeholder="tu@email.com"
                        />
                        {resetErrors.email && (
                            <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                                <AlertCircle size={12} /> {resetErrors.email}
                            </p>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={status === 'loading'}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {status === 'loading' ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                Enviando...
                            </>
                        ) : (
                            'Enviar instrucciones'
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => setStatus('idle')}
                        className="text-sm text-slate-400 hover:text-white hover:underline w-full text-center flex items-center justify-center gap-1"
                    >
                        <ArrowLeft size={14} /> Volver al inicio de sesión
                    </button>
                </form>
            </div>
        );
    }

    // Formulario de login normal
    return (
        <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-md mx-auto">
            <h2 className="text-3xl font-bold text-white mb-2 text-center">Bienvenido</h2>
            <p className="text-slate-400 mb-8 text-center">Ingresa tus credenciales para acceder</p>

            {status === 'success' ? (
                <div className="text-center py-10 animate-fade-in">
                    <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">¡Acceso Correcto!</h3>
                    <p className="text-slate-400">Redirigiendo a tu panel...</p>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                    {serverError && (
                        <div className="bg-red-500/10 border border-red-500 text-red-400 p-3 rounded-lg text-sm flex items-center gap-2">
                            <AlertCircle size={16} /> {serverError}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Correo Electrónico</label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            className={`w-full p-3 rounded-lg bg-slate-900 border ${
                                errors.email ? 'border-red-500' : 'border-slate-600'
                            } text-white focus:ring-2 focus:ring-blue-500 outline-none transition`}
                            placeholder="tu@email.com"
                        />
                        {errors.email && (
                            <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                                <AlertCircle size={12} /> {errors.email}
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Contraseña</label>
                        <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            className={`w-full p-3 rounded-lg bg-slate-900 border ${
                                errors.password ? 'border-red-500' : 'border-slate-600'
                            } text-white focus:ring-2 focus:ring-blue-500 outline-none transition`}
                            placeholder="••••••"
                        />
                        {errors.password && (
                            <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                                <AlertCircle size={12} /> {errors.password}
                            </p>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={status === 'loading'}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition transform hover:scale-[1.02] flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {status === 'loading' ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                Ingresando...
                            </>
                        ) : (
                            <>
                                Ingresar
                                <LogIn size={20} />
                            </>
                        )}
                    </button>

                    <div className="text-center mt-4 flex flex-col gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                setStatus('reset');
                                setServerError('');
                            }}
                            className="text-slate-400 hover:text-white text-sm hover:underline transition"
                        >
                            ¿Olvidaste tu contraseña?
                        </button>
                    </div>

                    <div className="text-center mt-2">
                        <p className="text-slate-400 text-sm">
                            ¿No tienes cuenta? <a href="/registro" className="text-blue-400 hover:text-blue-300 hover:underline">Regístrate aquí</a>
                        </p>
                    </div>
                </form>
            )}
        </div>
    );
}