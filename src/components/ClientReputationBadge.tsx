import React from 'react';
import { ShieldCheck, AlertCircle, AlertTriangle, Ban } from 'lucide-react';

interface ClientReputationBadgeProps {
  noShowCount?: number;
  isBlocked?: boolean;
  size?: 'xs' | 'sm' | 'md';
  showAdvice?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
}

export const ClientReputationBadge: React.FC<ClientReputationBadgeProps> = ({
  noShowCount = 0,
  isBlocked = false,
  size = 'xs',
  showAdvice = false,
  onClick,
  className = '',
}) => {
  // If client is blocked
  if (isBlocked) {
    return (
      <div className={`inline-flex flex-col gap-1 ${className}`}>
        <span
          onClick={onClick}
          className={`inline-flex items-center gap-1 rounded-full font-bold bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs ${
            onClick ? 'cursor-pointer hover:bg-rose-200 transition' : ''
          } ${
            size === 'xs'
              ? 'px-2 py-0.5 text-[10px]'
              : size === 'sm'
              ? 'px-2.5 py-1 text-xs'
              : 'px-3 py-1.5 text-sm'
          }`}
          title="Cliente bloccato per mancata presenza ripetuta"
        >
          <Ban className={size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
          <span>Cliente Bloccato</span>
        </span>
        {showAdvice && (
          <p className="text-[11px] text-rose-700 font-medium bg-rose-50 border border-rose-200 rounded-lg p-2 flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-600" />
            <span>Questo cliente è stato bloccato dal salone a causa di no-show ripetuti.</span>
          </p>
        )}
      </div>
    );
  }

  // High Risk (2 or more No-Shows)
  if (noShowCount >= 2) {
    return (
      <div className={`inline-flex flex-col gap-1 ${className}`}>
        <span
          onClick={onClick}
          className={`inline-flex items-center gap-1 rounded-full font-bold bg-rose-50 text-rose-700 border border-rose-300 shadow-2xs ${
            onClick ? 'cursor-pointer hover:bg-rose-100 transition' : ''
          } ${
            size === 'xs'
              ? 'px-2 py-0.5 text-[10px]'
              : size === 'sm'
              ? 'px-2.5 py-1 text-xs'
              : 'px-3 py-1.5 text-sm'
          }`}
          title="Cliente ad Alto Rischio (2 o più No-Show registrati)"
        >
          <AlertTriangle className={`${size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-rose-600 shrink-0`} />
          <span>🚨 Alto Rischio ({noShowCount} No-Show)</span>
        </span>
        {showAdvice && (
          <div className="text-[11px] text-rose-800 bg-rose-50/90 border border-rose-200 rounded-xl p-2.5 flex items-start gap-2 shadow-2xs">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-rose-900 font-bold">Attenzione per la Direzione:</strong>
              <span>Si consiglia di richiedere conferma telefonica anticipata o versamento di caparra prima di confermare lo slot.</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Medium Warning (1 No-Show)
  if (noShowCount === 1) {
    return (
      <div className={`inline-flex flex-col gap-1 ${className}`}>
        <span
          onClick={onClick}
          className={`inline-flex items-center gap-1 rounded-full font-bold bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs ${
            onClick ? 'cursor-pointer hover:bg-amber-100 transition' : ''
          } ${
            size === 'xs'
              ? 'px-2 py-0.5 text-[10px]'
              : size === 'sm'
              ? 'px-2.5 py-1 text-xs'
              : 'px-3 py-1.5 text-sm'
          }`}
          title="1 No-Show registrato in passato"
        >
          <AlertCircle className={`${size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-amber-600 shrink-0`} />
          <span>⚠️ 1 No-Show registrato</span>
        </span>
        {showAdvice && (
          <p className="text-[11px] text-amber-800 bg-amber-50/80 border border-amber-200 rounded-lg p-2 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Ha 1 appuntamento mancato. Si suggerisce di inviare il promemoria WhatsApp il giorno prima.</span>
          </p>
        )}
      </div>
    );
  }

  // Reliable (0 No-Shows)
  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 ${
        onClick ? 'cursor-pointer hover:bg-emerald-100 transition' : ''
      } ${
        size === 'xs'
          ? 'px-2 py-0.5 text-[10px]'
          : size === 'sm'
          ? 'px-2.5 py-1 text-xs'
          : 'px-3 py-1.5 text-sm'
      } ${className}`}
      title="Cliente puntuale e affidabile (0 No-Show)"
    >
      <ShieldCheck className={`${size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-emerald-600 shrink-0`} />
      <span>Affidabile</span>
    </span>
  );
};
