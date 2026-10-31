import React from 'react';
import { Sparkles } from 'lucide-react';

interface ProUpsellCardProps {
  description: string;
  onUpgrade: () => void;
  compact?: boolean;
}

export const ProUpsellCard: React.FC<ProUpsellCardProps> = ({ description, onUpgrade, compact = false }) => (
  <div className={`bg-white rounded-2xl border border-[#8B5CF6]/30 shadow-sm ${compact ? 'p-3 space-y-2' : 'p-5 space-y-3'}`}>
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-xl bg-purple-50 text-[#8B5CF6] flex items-center justify-center shrink-0">
        <Sparkles className="w-4 h-4" />
      </div>
      <h3 className="font-bold text-[#1E1B2E] text-sm">Disponibile nel piano PRO</h3>
    </div>
    <p className="text-sm text-slate-600">{description}</p>
    <button
      type="button"
      onClick={onUpgrade}
      className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#E95F8F] to-[#8B5CF6] text-white text-sm font-bold shadow hover:opacity-95 transition"
    >
      Vai ad Abbonamento
    </button>
  </div>
);
