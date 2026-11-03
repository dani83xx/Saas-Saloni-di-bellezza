import React from 'react';
import { Sparkles, LogOut } from 'lucide-react';

interface StaffAccessLockedProps {
  reason: 'plan' | 'disabled';
  onLogout: () => void;
}

export const StaffAccessLocked: React.FC<StaffAccessLockedProps> = ({ reason, onLogout }) => {
  const planLocked = reason === 'plan';
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1E1B2E] via-[#2A1B33] to-[#1E1B2E] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-pink-100 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-[#8B5CF6] flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <h1 className="font-bold text-[#1E1B2E] text-lg">
            {planLocked ? 'Disponibile nel piano PRO' : 'Accesso disattivato'}
          </h1>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">
          {planLocked
            ? 'L’accesso degli operatori è nel piano PRO, anche durante i 7 giorni di prova. Chiedi al titolare di attivare il piano: da qui non si gestisce l’abbonamento.'
            : 'Il titolare ha disattivato questo accesso. Quando viene riattivato potrai entrare di nuovo con la stessa email.'}
        </p>
        <button
          type="button"
          onClick={onLogout}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm font-bold hover:bg-rose-100 transition"
        >
          <LogOut className="w-4 h-4" />
          Esci
        </button>
      </div>
    </div>
  );
};
