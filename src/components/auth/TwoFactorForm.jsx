// src/components/auth/TwoFactorForm.jsx
import React from 'react';

export default function TwoFactorForm({ email, phone, onVerified, onCancel }) {
    return (
    <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-md mx-auto">
        <h2 className="text-2xl font-bold text-white mb-4 text-center">
        Verificación en dos pasos
        </h2>
        <p className="text-slate-400 mb-6 text-center">
        Componente en desarrollo. Pronto podrás verificar tu identidad.
        </p>
        <p className="text-slate-400 mb-4 text-center text-sm">
        Email: {email}<br />
        {phone && `Teléfono: ${phone}`}
        </p>
        <button
        onClick={onCancel}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg"
        >
        Volver
        </button>
    </div>
    );
}