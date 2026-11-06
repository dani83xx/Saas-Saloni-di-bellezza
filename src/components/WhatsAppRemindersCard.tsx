import React from 'react';
import { MessageSquare } from 'lucide-react';
import { ProUpsellCard } from './ProUpsellCard';
import type { WhatsAppSetupView } from '../lib/whatsappCloud';
import { WHATSAPP_TEMPLATE_BODY_SUGGESTION } from '../lib/whatsappCloud';

const REASON_LABELS: Record<string, string> = {
  verifica_non_disponibile: 'Il controllo sul server non è disponibile in questa sessione.',
  verifica_template_non_riuscita: 'Meta non ha confermato il template. L’invio resta spento.',
  template_non_approvato: 'Il template non risulta APPROVED.',
  template_non_utility: 'Il template non è di categoria utility.',
  template_assente: 'Non c’è un template con quel nome e quella lingua.',
  piano_non_pro: 'Disponibile nel piano PRO',
  attivazione_rifiutata: 'Il database ha rifiutato l’attivazione.',
};

function reasonLabel(reason: string): string {
  return REASON_LABELS[reason] || 'Configurazione incompleta.';
}

interface WhatsAppRemindersCardProps {
  locked: boolean;
  setup: WhatsAppSetupView | null;
  loading?: boolean;
  saving?: boolean;
  onEnable: () => void;
  onDisable: () => void;
  onUpgrade: () => void;
}

export const WhatsAppRemindersCard: React.FC<WhatsAppRemindersCardProps> = ({
  locked,
  setup,
  loading = false,
  saving = false,
  onEnable,
  onDisable,
  onUpgrade,
}) => {
  if (locked) {
    return (
      <ProUpsellCard
        description="I promemoria WhatsApp automatici, con modello utility approvato, sono nel piano PRO."
        onUpgrade={onUpgrade}
      />
    );
  }

  const state = setup?.state ?? 'da_configurare';
  const configured = state === 'pronto' && setup?.canEnable === true;
  const enabled = configured && setup?.enabled === true;

  return (
    <div className="bg-white p-4 md:p-6 rounded-2xl border border-pink-100 shadow-sm space-y-4">
      <div className="border-b border-pink-50 pb-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold text-base text-[#1E1B2E] flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-emerald-600" />
            Promemoria WhatsApp automatici
          </h3>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
            configured
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-amber-50 text-amber-800 border-amber-200'
          }`}>
            {loading ? 'Verifica…' : configured ? 'Pronto' : 'Da configurare'}
          </span>
        </div>
        <p className="text-sm text-slate-600">
          Messaggio template di Meta, circa 24 ore prima, solo se il cliente ha dato il consenso per quel numero.
          Il mittente è il numero WhatsApp di Nuvia, non il numero del salone. L’email automatica resta un canale a parte.
        </p>
      </div>

      {!configured && (
        <div className="space-y-2 text-sm text-slate-600">
          <p>
            L’interruttore resta spento finché sul server non ci sono i segreti Meta e un template utility con stato APPROVED.
          </p>
          {setup?.missing && setup.missing.length > 0 && (
            <p className="font-mono text-xs text-slate-500 break-all">Mancano: {setup.missing.join(', ')}</p>
          )}
          {setup?.reason && setup.reason !== 'segreti_mancanti' && (
            <p>{reasonLabel(setup.reason)}</p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#1E1B2E]">
            {enabled ? 'Invio WhatsApp attivo' : 'Invio WhatsApp disattivato'}
          </p>
          <p className="text-sm text-slate-600 mt-0.5">Solo titolare e admin. Default spento.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Promemoria WhatsApp automatici"
          disabled={loading || saving || !configured}
          onClick={() => (enabled ? onDisable() : onEnable())}
          className={`relative h-7 w-12 shrink-0 rounded-full transition ${
            enabled ? 'bg-emerald-600' : 'bg-slate-300'
          } ${loading || saving || !configured ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <span className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
            enabled ? 'translate-x-5' : 'translate-x-0'
          }`} />
        </button>
      </div>

      <p className="text-xs text-slate-500 leading-relaxed">
        Modello da far approvare, parametri posizionali: {WHATSAPP_TEMPLATE_BODY_SUGGESTION}
      </p>
    </div>
  );
};
