import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { z } from 'zod';
import { UserPlus, Loader2, AlertCircle, CheckCircle, Mail, Phone, Smartphone } from 'lucide-react';

// Esquemas de validación
const emailSchema = z.object({
    nombre: z.string().min(2, "El nombre es obligatorio"),
    email: z.string().email("Email inválido"),
    password: z.string().min(6, "Mínimo 6 caracteres"),
    confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
});

const phoneSchema = z.object({
    nombre: z.string().min(2, "El nombre es obligatorio"),
    phone: z.string()
        .min(10, "Número inválido (10 dígitos)")
        .max(13, "Número demasiado largo")
        .regex(/^\+?[0-9]{10,13}$/, "Formato inválido. Usa +521234567890 o 10-13 dígitos"),
    // Phone auth no usa contraseña, solo OTP
});

export default function RegisterForm() {
    const [activeTab, setActiveTab] = useState('email'); // 'email' o 'phone'
    
    // Estados para email
    const [formData, setFormData] = useState({ 
        nombre: '', 
        email: '', 
        password: '', 
        confirmPassword: '' 
    });
    
    // Estados para teléfono
    const [phoneData, setPhoneData] = useState({
        nombre: '',
        phone: ''
    });
    
    const [errors, setErrors] = useState({});
    const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'otp-sent'
    const [serverError, setServerError] = useState('');
    const [captchaVerified, setCaptchaVerified] = useState(false);
    const [captchaLoading, setCaptchaLoading] = useState(false);
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [loading, setLoading] = useState(true);
    
    // Estados para OTP (solo teléfono)
    const [otpCode, setOtpCode] = useState('');
    const [verifyingOtp, setVerifyingOtp] = useState(false);

    // Verificar si el usuario actual es anónimo
    useEffect(() => {
        const checkUser = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                setIsAnonymous(session?.user?.is_anonymous || false);
            } catch (error) {
                console.error("Error verificando usuario:", error);
            } finally {
                setLoading(false);
            }
        };
        checkUser();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (activeTab === 'email') {
            setFormData(prev => ({ ...prev, [name]: value }));
        } else {
            setPhoneData(prev => ({ ...prev, [name]: value }));
        }
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
    };

    const handleCaptchaClick = () => {
        if (captchaVerified || captchaLoading) return;
        setCaptchaLoading(true);
        setTimeout(() => {
            setCaptchaLoading(false);
            setCaptchaVerified(true);
            setErrors(prev => ({ ...prev, captcha: null }));
        }, 1000);
    };

    // Formatear número telefónico (simple)
    const formatPhoneNumber = (value) => {
        // Eliminar todo excepto dígitos y +
        const cleaned = value.replace(/[^\d+]/g, '');
        return cleaned;
    };

    // Enviar OTP al teléfono
    const handleSendOtp = async (e) => {
        e.preventDefault();
        setStatus('loading');
        setErrors({});
        setServerError('');

        if (!captchaVerified) {
            setErrors({ captcha: "Por favor confirma que no eres un robot." });
            setStatus('idle');
            return;
        }

        // Validar datos de teléfono
        const result = phoneSchema.safeParse(phoneData);
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
            // Asegurar formato E.164 (agregar + si no tiene)
            let phoneNumber = phoneData.phone;
            if (!phoneNumber.startsWith('+')) {
                phoneNumber = '+' + phoneNumber;
            }

            console.log("📤 Enviando OTP a:", phoneNumber);

            if (isAnonymous) {
                // Usuario anónimo: actualizar teléfono (esto envía OTP)
                const { error } = await supabase.auth.updateUser({
                    phone: phoneNumber,
                    data: {
                        full_name: phoneData.nombre,
                        role: 'buyer'
                    }
                });
                if (error) throw error;
            } else {
                // Usuario nuevo: signUp con teléfono
                const { error } = await supabase.auth.signInWithOtp({
                    phone: phoneNumber,
                    options: {
                        data: {
                            full_name: phoneData.nombre,
                            role: 'buyer'
                        }
                    }
                });
                if (error) throw error;
            }

            setStatus('otp-sent');
        } catch (error) {
            console.error("🔥 Error enviando OTP:", error);
            setServerError(error.message || "Error al enviar código");
            setStatus('idle');
        }
    };

    // Verificar OTP
    const handleVerifyOtp = async () => {
        setVerifyingOtp(true);
        setErrors({});
        setServerError('');

        try {
            let phoneNumber = phoneData.phone;
            if (!phoneNumber.startsWith('+')) {
                phoneNumber = '+' + phoneNumber;
            }

            const { error } = await supabase.auth.verifyOtp({
                phone: phoneNumber,
                token: otpCode,
                type: 'sms'
            });

            if (error) throw error;

            setStatus('success');
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
        } catch (error) {
            console.error("🔥 Error verificando OTP:", error);
            setServerError("Código incorrecto o expirado");
        } finally {
            setVerifyingOtp(false);
        }
    };

    // Enviar registro por email (tu código existente)
    const handleEmailSubmit = async (e) => {
        e.preventDefault();
        setStatus('loading');
        setErrors({});
        setServerError('');

        if (!captchaVerified) {
            setErrors({ captcha: "Por favor confirma que no eres un robot." });
            setStatus('idle');
            return;
        }

        const result = emailSchema.safeParse(formData);
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
            console.log("📤 Procesando registro email...");

            if (isAnonymous) {
                const { error: updateError } = await supabase.auth.updateUser({
                    email: formData.email,
                    password: formData.password,
                    data: {
                        full_name: formData.nombre,
                        role: 'buyer'
                    }
                });
                if (updateError) throw updateError;
                await supabase.auth.signOut();
                setStatus('success');
            } else {
                const { data, error } = await supabase.auth.signUp({
                    email: formData.email,
                    password: formData.password,
                    options: {
                        data: {
                            full_name: formData.nombre,
                            role: 'buyer'
                        },
                        emailRedirectTo: window.location.origin + '/ingresar'
                    }
                });
                if (error) throw error;
                if (data.session) await supabase.auth.signOut();
                setStatus('success');
            }
        } catch (error) {
            console.error("🔥 Error en registro:", error);
            setServerError(error.message || "Error al registrarse");
            setStatus('error');
        }
    };

    if (loading) {
        return (
            <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-md mx-auto">
                <div className="text-center py-10">
                    <Loader2 className="animate-spin w-12 h-12 text-blue-500 mx-auto mb-4" />
                    <p className="text-slate-300">Cargando...</p>
                </div>
            </div>
        );
    }

    // Pantalla de verificación OTP
    if (status === 'otp-sent') {
        return (
            <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-md mx-auto">
                <div className="text-center">
                    <Smartphone className="w-16 h-16 text-blue-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">Verifica tu teléfono</h3>
                    <p className="text-slate-400 mb-6">
                        Hemos enviado un código SMS a <span className="font-bold">{phoneData.phone}</span>
                    </p>

                    {serverError && (
                        <div className="bg-red-500/10 border border-red-500 text-red-400 p-3 rounded-lg text-sm mb-4">
                            {serverError}
                        </div>
                    )}

                    <div className="mb-4">
                        <input
                            type="text"
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="Código de 6 dígitos"
                            className="w-full text-center text-2xl tracking-widest p-4 rounded-lg bg-slate-900 border border-slate-600 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            maxLength={6}
                        />
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => setStatus('idle')}
                            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleVerifyOtp}
                            disabled={otpCode.length !== 6 || verifyingOtp}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg disabled:opacity-50"
                        >
                            {verifyingOtp ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Verificar'}
                        </button>
                    </div>

                    <p className="text-xs text-slate-500 mt-4">
                        Código de prueba: 123456 (solo desarrollo)
                    </p>
                </div>
            </div>
        );
    }

    // Pantalla de éxito (reutilizada)
    if (status === 'success') {
        return (
            <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-md mx-auto">
                <div className="text-center py-10 animate-fade-in">
                    <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">
                        {activeTab === 'email' ? '¡Casi listo!' : '¡Teléfono verificado!'}
                    </h3>
                    <div className="text-slate-300 mb-6 bg-slate-900/50 p-4 rounded-lg border border-slate-600">
                        {activeTab === 'email' ? (
                            <>
                                <p>Hemos enviado un correo a <span className="font-bold">{formData.email}</span></p>
                                <p className="text-sm mt-2">Haz clic en el enlace para activar tu cuenta.</p>
                            </>
                        ) : (
                            <>
                                <p>¡Tu teléfono ha sido verificado correctamente!</p>
                                <p className="text-sm mt-2">Redirigiendo al inicio...</p>
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Formulario principal con tabs
    return (
        <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-md mx-auto">
            <h2 className="text-3xl font-bold text-white mb-2 text-center">Crear Cuenta</h2>
            <p className="text-slate-400 mb-6 text-center">
                {isAnonymous ? '✨ Convierte tu cuenta de invitado' : 'Únete para guardar tus propiedades'}
            </p>

            {/* Tabs de selección */}
            <div className="flex mb-6 border-b border-slate-700">
                <button
                    onClick={() => setActiveTab('email')}
                    className={`flex-1 py-2 font-medium text-sm transition-colors relative ${
                        activeTab === 'email'
                            ? 'text-blue-400 border-b-2 border-blue-400'
                            : 'text-slate-400 hover:text-slate-300'
                    }`}
                >
                    <Mail size={16} className="inline mr-1" /> Email
                </button>
                <button
                    onClick={() => setActiveTab('phone')}
                    className={`flex-1 py-2 font-medium text-sm transition-colors relative ${
                        activeTab === 'phone'
                            ? 'text-blue-400 border-b-2 border-blue-400'
                            : 'text-slate-400 hover:text-slate-300'
                    }`}
                >
                    <Phone size={16} className="inline mr-1" /> Teléfono
                </button>
            </div>

            {/* Mensaje informativo para anónimos */}
            {isAnonymous && (
                <div className="bg-blue-500/10 border border-blue-500 text-blue-400 p-3 rounded-lg text-sm mb-4">
                    <p className="font-bold mb-1">🔐 Sesión temporal detectada</p>
                    <p>Al registrarte, todos tus favoritos se guardarán permanentemente.</p>
                </div>
            )}

            {/* Formulario de Email */}
            {activeTab === 'email' && (
                <form onSubmit={handleEmailSubmit} className="space-y-5">
                    {/* (Mantén aquí todo el formulario de email que ya tienes, incluyendo CAPTCHA y botón) */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Nombre Completo</label>
                        <input 
                            type="text" 
                            name="nombre" 
                            value={formData.nombre} 
                            onChange={handleChange} 
                            className="w-full p-3 rounded-lg bg-slate-900 border border-slate-600 text-white focus:ring-2 focus:ring-blue-500 outline-none" 
                            placeholder="Tu Nombre" 
                        />
                        {errors.nombre && <p className="text-red-400 text-xs mt-1">{errors.nombre}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Correo Electrónico</label>
                        <input 
                            type="email" 
                            name="email" 
                            value={formData.email} 
                            onChange={handleChange} 
                            className="w-full p-3 rounded-lg bg-slate-900 border border-slate-600 text-white focus:ring-2 focus:ring-blue-500 outline-none" 
                            placeholder="tu@email.com" 
                        />
                        {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Contraseña</label>
                            <input 
                                type="password" 
                                name="password" 
                                value={formData.password} 
                                onChange={handleChange} 
                                className="w-full p-3 rounded-lg bg-slate-900 border border-slate-600 text-white focus:ring-2 focus:ring-blue-500 outline-none" 
                                placeholder="••••••" 
                            />
                            {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Confirmar</label>
                            <input 
                                type="password" 
                                name="confirmPassword" 
                                value={formData.confirmPassword} 
                                onChange={handleChange} 
                                className="w-full p-3 rounded-lg bg-slate-900 border border-slate-600 text-white focus:ring-2 focus:ring-blue-500 outline-none" 
                                placeholder="••••••" 
                            />
                            {errors.confirmPassword && <p className="text-red-400 text-xs mt-1">{errors.confirmPassword}</p>}
                        </div>
                    </div>
                </form>
            )}

            {/* Formulario de Teléfono */}
            {activeTab === 'phone' && (
                <form onSubmit={handleSendOtp} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Nombre Completo</label>
                        <input 
                            type="text" 
                            name="nombre" 
                            value={phoneData.nombre} 
                            onChange={handleChange} 
                            className="w-full p-3 rounded-lg bg-slate-900 border border-slate-600 text-white focus:ring-2 focus:ring-blue-500 outline-none" 
                            placeholder="Tu Nombre" 
                        />
                        {errors.nombre && <p className="text-red-400 text-xs mt-1">{errors.nombre}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Número de Teléfono</label>
                        <div className="relative">
                            <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                                type="tel" 
                                name="phone" 
                                value={phoneData.phone} 
                                onChange={(e) => {
                                    const formatted = formatPhoneNumber(e.target.value);
                                    setPhoneData(prev => ({ ...prev, phone: formatted }));
                                }}
                                className="w-full pl-10 p-3 rounded-lg bg-slate-900 border border-slate-600 text-white focus:ring-2 focus:ring-blue-500 outline-none" 
                                placeholder="+529930000000" 
                            />
                        </div>
                        {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone}</p>}
                        <p className="text-xs text-slate-500 mt-1">
                            Formato: +52 (México) o 10-13 dígitos
                        </p>
                    </div>

                    <div className="bg-yellow-500/10 border border-yellow-500 text-yellow-400 p-3 rounded-lg text-sm">
                        <p className="font-bold mb-1">📱 Modo prueba</p>
                        <p>Usa <span className="font-mono">+529930000000</span> con código <span className="font-mono">123456</span></p>
                    </div>
                </form>
            )}

            {/* CAPTCHA (común a ambos) */}
            <div className="mt-5">
                <div className="bg-slate-100 rounded-md p-3 border border-slate-300 flex items-center justify-between max-w-75">
                    <div className="flex items-center gap-3">
                        <div
                            onClick={handleCaptchaClick}
                            className={`w-7 h-7 border-2 rounded-sm flex items-center justify-center cursor-pointer transition-colors ${
                                captchaVerified ? 'border-transparent' : 'border-slate-400 bg-white hover:border-slate-500'
                            }`}
                        >
                            {captchaLoading ? (
                                <Loader2 className="animate-spin text-blue-500" size={18} />
                            ) : captchaVerified ? (
                                <CheckCircle className="text-green-500" size={28} />
                            ) : null}
                        </div>
                        <span className="text-slate-700 text-sm font-medium select-none" onClick={handleCaptchaClick}>
                            No soy un robot
                        </span>
                    </div>
                    <div className="flex flex-col items-center">
                        <img src="https://www.gstatic.com/recaptcha/api2/logo_48.png" alt="reCAPTCHA" className="w-8 opacity-70" />
                        <span className="text-[10px] text-slate-500">reCAPTCHA</span>
                    </div>
                </div>
                {errors.captcha && <p className="text-red-400 text-xs mt-0">{errors.captcha}</p>}
            </div>

            {/* Botón de envío (cambia según tab) */}
            <button
                type="submit"
                onClick={activeTab === 'email' ? handleEmailSubmit : handleSendOtp}
                disabled={status === 'loading' || (activeTab === 'phone' && status === 'otp-sent')}
                className="w-full mt-5 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition transform hover:scale-[1.02] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {status === 'loading' ? (
                    <> <Loader2 className="animate-spin" size={20} /> Procesando... </>
                ) : (
                    <> 
                        {activeTab === 'email' 
                            ? (isAnonymous ? 'Convertir cuenta' : 'Registrarse con Email')
                            : 'Enviar código SMS'
                        }
                        {activeTab === 'email' ? <Mail size={20} /> : <Phone size={20} />}
                    </>
                )}
            </button>

            <p className="text-center text-slate-400 text-sm mt-4">
                ¿Ya tienes cuenta? <a href="/ingresar" className="text-blue-400 hover:text-blue-300 hover:underline">Ingresa aquí</a>
            </p>
        </div>
    );
}