import React, { useState } from 'react';
import {
  Scissors,
  Lock,
  Mail,
  Store,
  User,
  Phone,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  X,
  Loader2,
  Database
} from 'lucide-react';
import { UserSession, SalonSettings } from '../types';
import { loginSalon, registerSalon } from '../lib/salonService';
import { supabase } from '../lib/supabase';

interface AuthScreenProps {
  onLogin: (session: UserSession, rememberMe: boolean, salonSettings?: SalonSettings) => void;
  onRegisterSalon: (session: UserSession, salonSettings: SalonSettings) => void;
  onQuickDemoLogin: () => void;
  onShowToast?: (message: string, type?: 'success' | 'error') => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onLogin,
  onRegisterSalon,
  onQuickDemoLogin,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [isLoading, setIsLoading] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Register form state
  const [regSalonName, setRegSalonName] = useState('');
  const [regOwnerName, setRegOwnerName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regTermsAccepted, setRegTermsAccepted] = useState(true);
  const [regError, setRegError] = useState<string | null>(null);

  // Forgot password modal
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const emailTrimmed = loginEmail.trim();
    if (!emailTrimmed) {
      const msg = 'Inserisci un indirizzo email valido';
      setLoginError(msg);
      onShowToast?.(msg, 'error');
      return;
    }
    if (!loginPassword || loginPassword.length < 4) {
      const msg = 'La password deve contenere almeno 4 caratteri';
      setLoginError(msg);
      onShowToast?.(msg, 'error');
      return;
    }

    setIsLoading(true);
    try {
      console.log("1. Tentativo login...");
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailTrimmed,
        password: loginPassword,
      });

      if (error) {
        try {
          if (typeof window !== 'undefined' && 'alert' in window) {
            window.alert("Errore credenziali: " + error.message);
          }
        } catch {
          // Iframe sandbox handling
        }
        console.error("Errore credenziali:", error.message);
        setLoginError("Errore credenziali: " + error.message);
        onShowToast?.("Errore credenziali: " + error.message, 'error');
        setIsLoading(false);
        return;
      }

      console.log("2. Auth riuscita! User:", data.user?.id);

      const user = data.user;
      const meta = user?.user_metadata || {};

      let cachedSalonId = meta.salon_id || 'loading';
      let cachedSalonName = meta.salon_name || 'Il Mio Salone';
      let cachedOwnerName = meta.owner_name || user.email?.split('@')[0] || 'Titolare';
      try {
        const saved = localStorage.getItem('salondesk_session') || sessionStorage.getItem('salondesk_session');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.id === user.id) {
            if (parsed.salonId) cachedSalonId = parsed.salonId;
            if (parsed.salonName) cachedSalonName = parsed.salonName;
            if (parsed.ownerName) cachedOwnerName = parsed.ownerName;
          }
        }
      } catch {}

      const fastSession: UserSession = {
        id: user.id,
        email: user.email || emailTrimmed,
        salonId: cachedSalonId,
        salonName: cachedSalonName,
        ownerName: cachedOwnerName,
        role: 'owner',
      };

      // Imposta SUBITO l'utente loggato nello stato e sblocca la schermata
      setIsLoading(false);
      onLogin(fastSession, rememberMe);
      onShowToast?.(`Accesso riuscito: ${fastSession.salonName}`, 'success');
    } catch (err: any) {
      console.error('Supabase Login error:', err);
      const msg = err?.message || 'Errore durante il login. Verifica le credenziali.';
      setLoginError(msg);
      onShowToast?.(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const [regSuccessMessage, setRegSuccessMessage] = useState<string | null>(null);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    setRegSuccessMessage(null);

    const sName = regSalonName.trim();
    const oName = regOwnerName.trim();
    const emailVal = regEmail.trim();
    const phoneVal = regPhone.trim();
    const passVal = regPassword;

    if (!sName) {
      const msg = 'Inserisci il nome del tuo salone';
      setRegError(msg);
      onShowToast?.(msg, 'error');
      return;
    }
    if (!oName) {
      const msg = 'Inserisci il nome e cognome del titolare';
      setRegError(msg);
      onShowToast?.(msg, 'error');
      return;
    }
    if (!emailVal || !emailVal.includes('@')) {
      const msg = 'Inserisci un indirizzo email valido';
      setRegError(msg);
      onShowToast?.(msg, 'error');
      return;
    }
    if (!phoneVal) {
      const msg = 'Inserisci il recapito WhatsApp del salone';
      setRegError(msg);
      onShowToast?.(msg, 'error');
      return;
    }
    if (!passVal || passVal.length < 6) {
      const msg = 'La password deve contenere almeno 6 caratteri';
      setRegError(msg);
      onShowToast?.(msg, 'error');
      return;
    }
    if (!regTermsAccepted) {
      const msg = 'È necessario accettare i termini di servizio per proseguire';
      setRegError(msg);
      onShowToast?.(msg, 'error');
      return;
    }

    setIsLoading(true);
    try {
      // 1. Esegui semplicemente la chiamata signUp passando i dati del salone dentro 'options.data':
      const { data, error } = await supabase.auth.signUp({
        email: emailVal,
        password: passVal,
        options: {
          data: {
            salon_name: sName,
            owner_name: oName,
            whatsapp_number: phoneVal,
          },
        },
      });

      if (error) {
        if (error.message.includes('already registered') || (error as any).status === 422) {
          throw new Error('Questo indirizzo email è già registrato. Accedi con le tue credenziali.');
        }
        if (error.message.includes('rate limit') || (error as any).status === 429) {
          throw new Error('Limite richieste invio email superato. Riprova tra pochi minuti o accedi.');
        }
        throw new Error(error.message || 'Errore durante la registrazione.');
      }

      // 2. Se la registrazione ha successo:
      // Se data.session non è già presente, chiama subito:
      if (!data?.session) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: emailVal,
          password: passVal,
        });
        if (signInError) {
          throw signInError;
        }
      }

      // Mostra un toast: "Salone registrato con successo! Accesso in corso..."
      const successMsg = 'Salone registrato con successo! Accesso in corso...';
      setRegSuccessMessage(successMsg);
      onShowToast?.(successMsg, 'success');
      // L'evento 'onAuthStateChange' rileverà la sessione e caricherà automaticamente la Dashboard del salone con i servizi già creati dal database.
    } catch (err: any) {
      console.error('Errore registrazione salone Supabase:', err);
      const errorMsg = err?.message || 'Errore durante la registrazione del salone.';
      setRegError(errorMsg);
      onShowToast?.(errorMsg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;

    setForgotLoading(true);
    try {
      await supabase.auth.resetPasswordForEmail(forgotEmail.trim());
    } catch {
      // ignore
    } finally {
      setForgotLoading(false);
      setForgotSubmitted(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDF8FA] text-[#1E1B2E] flex flex-col justify-between relative overflow-hidden selection:bg-[#E95F8F]/20 selection:text-[#E95F8F]">
      {/* Decorative ambient gradient glowing orbs */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-gradient-to-br from-pink-300/30 to-purple-400/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 -right-40 w-96 h-96 bg-gradient-to-br from-purple-300/20 to-pink-400/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-gradient-to-tr from-pink-200/30 to-purple-300/20 rounded-full blur-3xl pointer-events-none" />

      {/* Top micro bar */}
      <header className="relative z-10 px-6 py-4 flex items-center justify-between border-b border-pink-100/60 bg-white/60 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#E95F8F] to-[#8B5CF6] flex items-center justify-center text-white shadow-sm shadow-purple-500/20">
            <Scissors className="w-4 h-4" />
          </div>
          <span className="font-black text-lg tracking-tight bg-gradient-to-r from-[#1E1B2E] via-[#8B5CF6] to-[#E95F8F] bg-clip-text text-transparent">
            SalonDesk
          </span>
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-purple-50 text-[#8B5CF6] border border-purple-200 flex items-center gap-1">
            <Database className="w-3 h-3 text-[#8B5CF6]" />
            Supabase PostgreSQL
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="hidden sm:inline-flex items-center gap-1.5 font-medium text-slate-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Auth & RLS Protetta
          </span>
          <button
            type="button"
            onClick={onQuickDemoLogin}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-xl text-xs font-bold text-[#8B5CF6] bg-purple-50 hover:bg-purple-100 border border-purple-200 transition flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Demo Salone</span>
          </button>
        </div>
      </header>

      {/* Centered Main Auth Card */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8 md:py-12">
        <div className="w-full max-w-md bg-white/95 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-2xl shadow-pink-900/5 border border-pink-100 space-y-6">
          {/* Card Header & Brand Claim */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-[#E95F8F] via-[#B857BF] to-[#8B5CF6] flex items-center justify-center text-white shadow-lg shadow-pink-500/25 ring-4 ring-pink-50">
              <Scissors className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-[#1E1B2E]">
                SalonDesk
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                Il gestionale smart per parrucchieri e centri estetici
              </p>
            </div>
          </div>

          {/* Tab Selector */}
          <div className="grid grid-cols-2 p-1 bg-slate-100/90 rounded-2xl text-xs font-bold">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => {
                setActiveTab('login');
                setLoginError(null);
              }}
              className={`py-2.5 px-3 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'login'
                  ? 'bg-white text-[#8B5CF6] shadow-sm font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Accedi al Salone</span>
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={() => {
                setActiveTab('register');
                setRegError(null);
              }}
              className={`py-2.5 px-3 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'register'
                  ? 'bg-white text-[#E95F8F] shadow-sm font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>Registra Salone (14gg)</span>
            </button>
          </div>

          {/* TAB 1: LOGIN */}
          {activeTab === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {loginError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{loginError}</span>
                </div>
              )}

              {/* Email Input */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Email di lavoro
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    required
                    disabled={isLoading}
                    placeholder="es. elena@lucestile.it"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#8B5CF6] focus:bg-white outline-none transition disabled:opacity-60"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">
                    Password
                  </label>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => {
                      setForgotEmail(loginEmail);
                      setIsForgotModalOpen(true);
                    }}
                    className="text-[11px] font-semibold text-[#8B5CF6] hover:text-[#7846ea] transition cursor-pointer"
                  >
                    Password dimenticata?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    disabled={isLoading}
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#8B5CF6] focus:bg-white outline-none transition disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  >
                    {showLoginPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember me checkbox */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 text-xs text-slate-600 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded text-[#8B5CF6] focus:ring-[#8B5CF6] accent-[#8B5CF6] cursor-pointer"
                  />
                  <span>Ricordami su questo dispositivo</span>
                </label>
              </div>

              {/* Primary Login Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#E95F8F] via-[#B857BF] to-[#8B5CF6] hover:opacity-95 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-pink-500/20 transition active:scale-[0.99] cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Autenticazione in corso...</span>
                  </>
                ) : (
                  <>
                    <span>Accedi al Salone</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Divider */}
              <div className="relative flex items-center justify-center my-3">
                <div className="border-t border-slate-200 w-full" />
                <span className="bg-white px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider relative">
                  oppure
                </span>
              </div>

              {/* Quick Demo Access Button */}
              <button
                type="button"
                disabled={isLoading}
                onClick={onQuickDemoLogin}
                className="w-full py-2.5 px-4 rounded-xl border border-purple-200 bg-purple-50/70 hover:bg-purple-100 text-[#8B5CF6] font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer group shadow-2xs disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 text-[#8B5CF6] group-hover:rotate-12 transition transform" />
                <span>Accesso Rapido Demo Salone</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-purple-200/80 text-purple-900 rounded font-mono font-extrabold ml-1">
                  1-Click
                </span>
              </button>
            </form>
          )}

          {/* TAB 2: REGISTER SALON */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              {/* Highlighted Trial Badge */}
              <div className="p-3 rounded-2xl bg-gradient-to-r from-pink-50 via-purple-50 to-pink-50 border border-pink-200/80 text-xs text-purple-950 flex items-start gap-2 shadow-2xs animate-fadeIn">
                <Sparkles className="w-4 h-4 text-[#E95F8F] shrink-0 mt-0.5" />
                <div className="space-y-0.5 leading-snug">
                  <strong className="block font-bold text-[#E95F8F]">
                    ✨ 14 Giorni di Prova Gratuita inclusi
                  </strong>
                  <span className="text-[11px] text-slate-600">
                    Nessuna carta di credito richiesta • Database cloud PostgreSQL Supabase dedicato.
                  </span>
                </div>
              </div>

              {regError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{regError}</span>
                </div>
              )}

              {regSuccessMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="font-semibold">{regSuccessMessage}</span>
                </div>
              )}

              {/* Nome Salone */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Nome del Salone *
                </label>
                <div className="relative">
                  <Store className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    disabled={isLoading}
                    placeholder="es. Glamour Hair & Beauty"
                    value={regSalonName}
                    onChange={(e) => setRegSalonName(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#E95F8F] focus:bg-white outline-none transition disabled:opacity-60"
                  />
                </div>
              </div>

              {/* Nome Titolare */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Nome e Cognome Titolare *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    disabled={isLoading}
                    placeholder="es. Marco Rossi"
                    value={regOwnerName}
                    onChange={(e) => setRegOwnerName(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#E95F8F] focus:bg-white outline-none transition disabled:opacity-60"
                  />
                </div>
              </div>

              {/* Email lavorativa */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Email Salone *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    required
                    disabled={isLoading}
                    placeholder="es. info@glamourhair.it"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#E95F8F] focus:bg-white outline-none transition disabled:opacity-60"
                  />
                </div>
              </div>

              {/* Cellulare WhatsApp Salone */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Cellulare WhatsApp Salone *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    disabled={isLoading}
                    placeholder="+39 347 1234567"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-[#E95F8F] focus:bg-white outline-none transition disabled:opacity-60"
                  />
                </div>
                <p className="text-[10px] text-slate-400">
                  Utilizzato per l&apos;invio dei promemoria WhatsApp e conferme ai clienti.
                </p>
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Password di Accesso *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    disabled={isLoading}
                    placeholder="Almeno 6 caratteri"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#E95F8F] focus:bg-white outline-none transition disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  >
                    {showRegPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Terms Checkbox */}
              <div className="pt-1">
                <label className="flex items-start gap-2 text-[11px] text-slate-600 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={regTermsAccepted}
                    onChange={(e) => setRegTermsAccepted(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded text-[#E95F8F] focus:ring-[#E95F8F] accent-[#E95F8F] cursor-pointer"
                  />
                  <span>
                    Accetto i Termini di Servizio e l&apos;Informativa sulla Privacy. Posso disdire in qualsiasi momento.
                  </span>
                </label>
              </div>

              {/* Primary Register Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#E95F8F] to-[#8B5CF6] hover:opacity-95 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-pink-500/20 transition active:scale-[0.99] cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creazione salone su Supabase...</span>
                  </>
                ) : (
                  <>
                    <span>Attiva Salone & Inizia Prova 14gg</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Guarantee Badges Footer inside card */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-around text-[10px] text-slate-400 font-medium">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              Zero Vincoli
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              Supabase Postgres
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              Attivazione Istantanea
            </span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-4 text-center text-xs text-slate-400 border-t border-pink-100/60 bg-white/40 backdrop-blur-xs">
        <p>
          SalonDesk SaaS • Powered by Supabase PostgreSQL • Protetto da crittografia end-to-end
        </p>
      </footer>

      {/* Forgot Password Modal */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-pink-100 space-y-4">
            <div className="flex items-center justify-between border-b border-pink-50 pb-3">
              <h3 className="font-bold text-[#1E1B2E] text-sm flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-[#8B5CF6]" />
                Recupero Password
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsForgotModalOpen(false);
                  setForgotSubmitted(false);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {forgotSubmitted ? (
              <div className="space-y-3 py-2 text-center">
                <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900 text-sm">Richiesta Inviata!</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Se l&apos;indirizzo <strong>{forgotEmail}</strong> è registrato, riceverai a breve una mail con le istruzioni di ripristino password.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotModalOpen(false);
                    setForgotSubmitted(false);
                  }}
                  className="w-full mt-2 py-2 px-4 rounded-xl bg-[#8B5CF6] text-white font-bold text-xs"
                >
                  Torna al Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-3">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Inserisci l&apos;indirizzo email registrato con il tuo salone. Ti invieremo un link per reimpostare la password.
                </p>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email del Salone
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="titolare@salone.it"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#8B5CF6] outline-none"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(false)}
                    className="px-3 py-2 rounded-xl text-xs text-slate-600 hover:bg-slate-100 font-semibold"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="px-4 py-2 rounded-xl text-xs bg-[#8B5CF6] hover:bg-[#7846ea] text-white font-bold shadow-md shadow-purple-500/20 flex items-center gap-1.5"
                  >
                    {forgotLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Invia Link</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
