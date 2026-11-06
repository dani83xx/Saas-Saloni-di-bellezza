import React from 'react';
import { Bell } from 'lucide-react';
import { ProUpsellCard } from './ProUpsellCard';
import { AUTOMATIC_REMINDER_COPY } from '../lib/reminderEmail';

interface AutomaticRemindersCardProps {
  enabled: boolean;
  locked: boolean;
  saving?: boolean;
  onToggle: (enabled: boolean) => void;
  onUpgrade: () => void;
}

export const AutomaticRemindersCard: React.FC<AutomaticRemindersCardProps> = ({
  enabled,
  locked,
  saving = false,
  onToggle,
  onUpgrade,
}) => {
  if (locked) {
    return <ProUpsellCard description={AUTOMATIC_REMINDER_COPY.locked} onUpgrade={onUpgrade} />;
  }

  return (
    <div className="bg-white p-4 md:p-6 rounded-2xl border border-pink-100 shadow-sm space-y-4">
      <div className="border-b border-pink-50 pb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-base text-[#1E1B2E] flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#8B5CF6]" />
            {AUTOMATIC_REMINDER_COPY.title}
          </h3>
          <p className="text-sm text-slate-600 mt-1">{AUTOMATIC_REMINDER_COPY.summary}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#1E1B2E]">
            {enabled ? 'Invio automatico attivo' : 'Invio automatico disattivato'}
          </p>
          <p className="text-sm text-slate-600 mt-0.5">
            Il titolare e l’admin del salone possono accenderlo o spegnerlo.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Promemoria automatici"
          disabled={saving}
          onClick={() => onToggle(!enabled)}
          className={`relative h-7 w-12 shrink-0 rounded-full transition ${
            enabled ? 'bg-[#8B5CF6]' : 'bg-slate-300'
          } ${saving ? 'opacity-60 cursor-wait' : 'cursor-pointer'}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
              enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      <p className="text-sm text-slate-600">{AUTOMATIC_REMINDER_COPY.detail}</p>
    </div>
  );
};
