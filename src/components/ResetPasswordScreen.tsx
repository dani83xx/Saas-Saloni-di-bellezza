import React, { useState } from 'react';
import { Lock, Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ResetPasswordScreenProps {
  onCompleted: () => void;
  onCancel: () => void;
  onShowToast: (message: string) => void;
}

export const ResetPasswordScreen: React.FC<ResetPasswordScreenProps> = ({
  onCompleted,
  onCancel,
  onShowToast,
}) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      onShowToast('La password deve avere almeno 6 caratteri.');
      return;
    }
    if (password !== confirm) {
      onShowToast('Le due password non coincidono.');
      return;
    }

    setIsSaving(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        onShowToast('Il link di recupero non è valido o è scaduto. Richiedine uno nuovo dalla pagina di accesso.');
        return;
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      onShowToast('Password aggiornata. Ora puoi usare Nuvia.');
      onCompleted();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      onShowToast(message || 'Impossibile aggiornare la password. Richiedi un nuovo link.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1E1B2E] via-[#2A1B33] to-[#1E1B2E] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-pink-100/30 space-y-5">
        <div className="text-center space-y-1.5">
          <div className="w-14 h-14 rounded-2xl bg-white border border-purple-100 shadow-lg shadow-purple-500/15 flex items-center justify-center mx-auto p-2">
            <img src="/nuvia-mark.png" alt="" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-black text-[#1E1B2E] tracking-tight">Nuova password</h1>
          <p className="text-xs text-slate-500">
            Scegli una password per il tuo account Nuvia. Il link di recupero vale per questa sessione.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1" htmlFor="new-password">
              Nuova password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="Almeno 6 caratteri"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#8B5CF6] text-xs"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label={showPassword ? 'Nascondi password' : 'Mostra password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1" htmlFor="confirm-password">
              Conferma password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="Ripeti la password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#8B5CF6] text-xs"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-[#E95F8F] to-[#8B5CF6] hover:opacity-95 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>Salva password</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <button
          type="button"
          onClick={onCancel}
          className="w-full text-xs font-semibold text-slate-500 hover:text-slate-800"
        >
          Annulla e torna all’accesso
        </button>
      </div>
    </div>
  );
};
