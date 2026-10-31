import React, { useState } from 'react';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Store,
  User,
  Phone,
  CheckCircle2,
  Sparkles,
  Loader2
} from 'lucide-react';
import { supabase, getAuthRedirectUrl } from '../lib/supabase';
import { loginSalon, registerEmailOwner } from '../lib/salonService';
import { SalonSettings, UserSession } from '../types';
import { createTrialSubscription } from '../lib/subscription';
import { LegalLinks } from './LegalPages';

interface AuthScreenProps {
  onLogin: (session: UserSession, rememberMe: boolean, salonSettings?: SalonSettings) => void;
  onRegisterSalon: (session: UserSession, salonSettings: SalonSettings) => void;
  onQuickDemoLogin: () => void;
  onShowToast: (message: string) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onLogin,
  onRegisterSalon,
  onQuickDemoLogin,
  onShowToast,
}) => {
  // 'login' oppure 'register'
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetSending, setIsResetSending] = useState(false);

  // Campi Form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [salonName, setSalonName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');

  // 1. ACCESSO O REGISTRAZIONE CON GOOGLE (OAuth Supabase)
  const handleGoogleAuth = async () => {
    setIsGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getAuthRedirectUrl(),
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      if (error) throw error;
    } catch (err: any) {
      console.error('Errore Google Auth:', err);
      onShowToast(err.message || 'Errore durante l\'autenticazione con Google');
      setIsGoogleLoading(false);
    }
  };

  // 2. ACCESSO O REGISTRAZIONE EMAIL / PASSWORD
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (authMode === 'login') {
        const { session } = await loginSalon(email.trim(), password);
        onLogin(session, rememberMe);
      } else {
        const { session, salon } = await registerEmailOwner({
          salonName,
          ownerName,
          email,
          phone: whatsappNumber,
          password,
        });
        const initialTrialSettings: SalonSettings = {
          ...salon,
          subscription: createTrialSubscription(),
        };
        onRegisterSalon(session, initialTrialSettings);
        onShowToast('Benvenuto! I tuoi 7 giorni di prova gratuita sono attivi.');
      }
    } catch (err: any) {
      console.error('Errore Auth:', err);
      onShowToast(err.message || 'Errore durante l\'autenticazione');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = (resetEmail || email).trim();
    if (!target) {
      onShowToast('Inserisci l’email a cui inviare il recupero password.');
      return;
    }

    setIsResetSending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(target, {
        redirectTo: getAuthRedirectUrl(),
      });
      if (error) throw error;
      onShowToast('Email di recupero inviata. Controlla la posta, anche la cartella spam.');
      setForgotOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      const lower = message.toLowerCase();
      if (lower.includes('rate limit')) {
        onShowToast('Troppe richieste. Riprova tra qualche minuto.');
      } else {
        onShowToast(message || 'Impossibile inviare l’email di recupero. Riprova.');
      }
    } finally {
      setIsResetSending(false);
    }
  };

  const openForgotPassword = () => {
    setResetEmail(email.trim());
    setForgotOpen(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1E1B2E] via-[#2A1B33] to-[#1E1B2E] flex items-center justify-center p-3.5 sm:p-6 text-[#1E1B2E]">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-pink-100/30 space-y-5 animate-fadeIn relative overflow-hidden">
        {/* Glow decorativo */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-[#E95F8F]/15 via-[#8B5CF6]/15 to-transparent rounded-bl-full pointer-events-none" />

        {/* LOGO NUVIA */}
        <div className="text-center space-y-3">
          <img
            src="/nuvia-logo.png"
            alt="Nuvia, CRM for beauty business"
            className="mx-auto block h-[92px] w-auto max-w-full object-contain"
          />
          <p className="text-sm text-slate-600">
            {authMode === 'login'
              ? 'Il gestionale smart per parrucchieri e centri estetici'
              : 'Attiva subito 7 giorni di prova gratuita senza carta di credito'}
          </p>
        </div>

        {/* TAB SWITCHER: ACCEDI / REGISTRATI */}
        <div className="bg-slate-100 p-1 rounded-2xl flex items-center text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setAuthMode('login');
              setForgotOpen(false);
            }}
            className={`flex-1 py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
              authMode === 'login'
                ? 'bg-white text-[#8B5CF6] shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Accedi</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('register');
              setForgotOpen(false);
            }}
            className={`flex-1 py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
              authMode === 'register'
                ? 'bg-gradient-to-r from-[#E95F8F] to-[#8B5CF6] text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Crea Account (7gg Gratis)</span>
          </button>
        </div>

        {/* ACCESSO CON GOOGLE */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={isGoogleLoading}
            className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-2.5 shadow-xs transition active:scale-98 cursor-pointer"
          >
            {isGoogleLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>
              {authMode === 'login' ? 'Continua con Google' : 'Registrati con Google (7gg Gratis)'}
            </span>
          </button>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-white px-2.5 text-xs font-bold uppercase tracking-wider text-slate-600 absolute">
              OPPURE CON EMAIL
            </span>
          </div>
        </div>

        {forgotOpen ? (
          <form onSubmit={handleForgotPassword} className="space-y-3.5 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1" htmlFor="reset-email">
                Email per il recupero
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="reset-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="es. elena@lucestile.it"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#8B5CF6] text-xs"
                />
              </div>
              <p className="text-xs text-slate-600 mt-1.5">
                Ti invieremo un link per scegliere una nuova password. Non viene cambiata finché non la salvi dal link.
              </p>
            </div>
            <button
              type="submit"
              disabled={isResetSending}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-[#E95F8F] to-[#8B5CF6] hover:opacity-95 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {isResetSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Invia email di recupero</span>}
            </button>
            <button
              type="button"
              onClick={() => setForgotOpen(false)}
              className="w-full text-[11px] font-semibold text-slate-500 hover:text-slate-800"
            >
              Torna all’accesso
            </button>
          </form>
        ) : (
        /* FORM EMAIL E PASSWORD */
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {/* Campi specifici Registrazione */}
          {authMode === 'register' && (
            <>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Nome del Salone *</label>
                <div className="relative">
                  <Store className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="Es. Luce & Stile Hair & Beauty"
                    value={salonName}
                    onChange={(e) => setSalonName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#8B5CF6] text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Nome Titolare</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Elena Bianchi"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#8B5CF6] text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Cellulare Salone</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="+39 340..."
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono outline-none focus:ring-2 focus:ring-[#8B5CF6] text-xs"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Email di lavoro *</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                placeholder="es. elena@lucestile.it"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#8B5CF6] text-xs"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-700 font-semibold">Password *</label>
              {authMode === 'login' && (
                <button
                  type="button"
                  onClick={openForgotPassword}
                  className="text-[11px] text-[#8B5CF6] hover:underline"
                >
                  Password dimenticata?
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#8B5CF6] text-xs font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {authMode === 'login' && (
            <label className="flex items-center gap-2 cursor-pointer select-none pt-0.5">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-[#8B5CF6] rounded border-slate-300 focus:ring-[#8B5CF6]"
              />
              <span className="text-sm text-slate-700 font-medium">Ricordami su questo dispositivo</span>
            </label>
          )}

          {/* PULSANTE SUBMIT */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-[#E95F8F] to-[#8B5CF6] hover:opacity-95 active:scale-98 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>{authMode === 'login' ? 'Accedi al Salone' : 'Attiva 7 Giorni di Prova Gratis'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
        )}

        {/* ACCESSO RAPIDO DEMO SALONE */}
        <div className="pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onQuickDemoLogin}
            className="w-full py-2 px-3 bg-purple-50/70 hover:bg-purple-100 text-[#8B5CF6] border border-purple-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Accesso Rapido Demo Salone</span>
            <span className="text-[10px] bg-[#8B5CF6] text-white px-1.5 py-0.2 rounded font-extrabold">1-Click</span>
          </button>
        </div>

        {/* BENEFIT TRUST */}
        <div className="flex items-center justify-around gap-1 pt-1 text-xs text-slate-600 font-medium">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> 7gg di Prova
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Senza Carta
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Attivazione Subito
          </span>
        </div>

        <LegalLinks
          className="flex items-center justify-center gap-2 text-xs text-slate-600"
          linkClassName="font-semibold text-slate-500 hover:text-[#8B5CF6] hover:underline"
        />
      </div>
    </div>
  );
};
