import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, AlertCircle, CheckCircle, Lock } from 'lucide-react';
import { z } from 'zod';

const resetPasswordSchema = z.object({
    password: z.string().min(6, "Mínimo 6 caracteres"),
    confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
});

export default function ResetPasswordForm() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [errors, setErrors] = useState({});
    const [status, setStatus] = useState('idle');
    const [serverError, setServerError] = useState('');

    useEffect(() => {
        // Verificar que el usuario viene de un correo válido
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                // Si no hay sesión, redirigir a login
                window.location.href = '/ingresar';
            }
        };
        checkSession();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus('loading');
        setErrors({});
        setServerError('');

        const result = resetPasswordSchema.safeParse({ password, confirmPassword });

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
            const { error } = await supabase.auth.updateUser({
                password: password
            });

            if (error) throw error;

            setStatus('success');
            setTimeout(() => {
                window.location.href = '/ingresar';
            }, 2000);
        } catch (error) {
            console.error('Error:', error);
            setServerError(error.message || 'Error al actualizar contraseña');
            setStatus('idle');
        }
    };

    if (status === 'success') {
        return (
            <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-md mx-auto">
                <div className="text-center py-10">
                    <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">¡Contraseña actualizada!</h3>
                    <p className="text-slate-400">Redirigiendo al inicio de sesión...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-md mx-auto">
            <h2 className="text-2xl font-bold text-white mb-2 text-center">Nueva Contraseña</h2>
            <p className="text-slate-400 mb-6 text-center text-sm">
                Ingresa tu nueva contraseña
            </p>

            {serverError && (
                <div className="bg-red-500/10 border border-red-500 text-red-400 p-3 rounded-lg text-sm flex items-center gap-2 mb-4">
                    <AlertCircle size={16} /> {serverError}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                        Nueva Contraseña
                    </label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`w-full p-3 rounded-lg bg-slate-900 border ${
                            errors.password ? 'border-red-500' : 'border-slate-600'
                        } text-white focus:ring-2 focus:ring-blue-500 outline-none`}
                        placeholder="••••••"
                    />
                    {errors.password && (
                        <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                            <AlertCircle size={12} /> {errors.password}
                        </p>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                        Confirmar Contraseña
                    </label>
                    <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={`w-full p-3 rounded-lg bg-slate-900 border ${
                            errors.confirmPassword ? 'border-red-500' : 'border-slate-600'
                        } text-white focus:ring-2 focus:ring-blue-500 outline-none`}
                        placeholder="••••••"
                    />
                    {errors.confirmPassword && (
                        <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                            <AlertCircle size={12} /> {errors.confirmPassword}
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
                            Actualizando...
                        </>
                    ) : (
                        <>
                            <Lock size={20} />
                            Actualizar Contraseña
                        </>
                    )}
                </button>
            </form>
        </div>
    );
}