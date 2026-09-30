import React, { useState } from 'react';
import {
  Banknote,
  CreditCard,
  Smartphone,
  Wallet,
  Receipt,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Copy,
  Check,
  Printer
} from 'lucide-react';
import { Appointment, PaymentMethod } from '../types';
import { formatDisplayDate, getTodayStr } from '../utils/date';

interface CashRegisterSummaryProps {
  appointments: Appointment[];
  targetDateStr?: string;
  onShowToast?: (message: string) => void;
  compact?: boolean;
}

export const CashRegisterSummary: React.FC<CashRegisterSummaryProps> = ({
  appointments,
  targetDateStr,
  onShowToast,
  compact = false,
}) => {
  const [copied, setCopied] = useState(false);
  const activeDate = targetDateStr || getTodayStr();

  // Appointments for the selected day
  const dayAppointments = appointments.filter(
    (a) => a.date === activeDate && a.status !== 'Annullato' && a.status !== 'No-Show'
  );

  // Completed or Paid appointments for the day
  const paidAppointments = dayAppointments.filter(
    (a) => a.status === 'Completato' || a.isPaid === true
  );

  // Calculations
  const totalCollected = paidAppointments.reduce((sum, a) => sum + (a.price || 0), 0);
  const totalExpected = dayAppointments.reduce((sum, a) => sum + (a.price || 0), 0);
  const pendingCollection = Math.max(0, totalExpected - totalCollected);

  const getMethodStats = (method: PaymentMethod) => {
    const list = paidAppointments.filter((a) => {
      if (a.paymentMethod) return a.paymentMethod === method;
      // Default to POS if completed without explicit method
      return method === 'POS';
    });
    const amount = list.reduce((sum, a) => sum + (a.price || 0), 0);
    return { count: list.length, amount };
  };

  const posStats = getMethodStats('POS');
  const cashStats = getMethodStats('Contanti');
  const satispayStats = getMethodStats('Satispay');
  const otherStats = getMethodStats('Altro');

  const completionRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 100;

  const handleCopySummary = () => {
    const formattedDate = formatDisplayDate(activeDate);
    const text = `📊 *QUADRATURA DI CASSA - ${formattedDate}*
────────────────────────────
💰 *TOTALE INCASSATO:* €${totalCollected.toFixed(2)} (${paidAppointments.length} transazioni)

💳 *POS / Carte:* €${posStats.amount.toFixed(2)} (${posStats.count} transaz.)
💵 *Contanti in Cassa:* €${cashStats.amount.toFixed(2)} (${cashStats.count} transaz.)
⚡ *Satispay:* €${satispayStats.amount.toFixed(2)} (${satispayStats.count} transaz.)
${otherStats.amount > 0 ? `🏷️ *Altro/Voucher:* €${otherStats.amount.toFixed(2)} (${otherStats.count})\n` : ''}────────────────────────────
⏳ *Da Incassare (in agenda):* €${pendingCollection.toFixed(2)}
🎯 *Totale Stimato Giornata:* €${totalExpected.toFixed(2)}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    if (onShowToast) {
      onShowToast('Quadratura di cassa copiata negli appunti!');
    }
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="bg-white rounded-3xl border border-pink-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-pink-50 bg-gradient-to-r from-purple-50/50 via-pink-50/30 to-white flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#8B5CF6] to-[#E95F8F] text-white flex items-center justify-center shadow-md shadow-purple-500/20">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-[#1E1B2E] text-base">
                Quadratura di Cassa & Incassi
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Live Oggi
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Riepilogo fiscale e suddivisione per metodo di pagamento ({formatDisplayDate(activeDate, { withWeekday: true, includeYear: false })})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopySummary}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 transition cursor-pointer shadow-2xs"
            title="Copia riepilogo testuale per WhatsApp o commercialista"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700 font-bold">Copiato!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Copia Quadratura</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="p-4 sm:p-5 space-y-4">
        {/* Top Highlight: Total Incassato */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20 sm:col-span-2 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-100">
                Totale Incassato Effettivo
              </span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white/20 text-white backdrop-blur-xs">
                {paidAppointments.length} scontrini registrati
              </span>
            </div>
            <div className="my-2">
              <div className="text-3xl sm:text-4xl font-black tracking-tight font-mono">
                €{totalCollected.toFixed(2)}
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-emerald-100 pt-1 border-t border-white/15">
              <span>{completionRate}% dell'agenda completata</span>
              <span>Previsto totale: €{totalExpected.toFixed(2)}</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Ancora da Incassare
              </span>
              <div className="text-2xl font-black text-[#1E1B2E] font-mono mt-2">
                €{pendingCollection.toFixed(2)}
              </div>
            </div>
            <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-200/60 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>{dayAppointments.length - paidAppointments.length} appuntamenti in programma</span>
            </div>
          </div>
        </div>

        {/* 4 Payment Methods Breakdown */}
        <div>
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center justify-between">
            <span>Suddivisione Metodi di Pagamento</span>
            <span className="text-[11px] font-normal text-slate-400">Quadratura Cassa Fiscale</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* POS / Carta */}
            <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-200/80 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-sky-800 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-sky-600" />
                  POS / Carte
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-sky-200/70 text-sky-800">
                  {posStats.count} transaz.
                </span>
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-black text-sky-950 font-mono">
                  €{posStats.amount.toFixed(2)}
                </div>
                <div className="text-[10px] text-sky-700 font-medium mt-0.5">
                  {totalCollected > 0 ? Math.round((posStats.amount / totalCollected) * 100) : 0}% del totale incasso
                </div>
              </div>
            </div>

            {/* Contanti */}
            <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                  <Banknote className="w-4 h-4 text-emerald-600" />
                  Contanti
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-200/70 text-emerald-800">
                  {cashStats.count} transaz.
                </span>
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-black text-emerald-950 font-mono">
                  €{cashStats.amount.toFixed(2)}
                </div>
                <div className="text-[10px] text-emerald-700 font-medium mt-0.5">
                  Fondo cassa fisico
                </div>
              </div>
            </div>

            {/* Satispay */}
            <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200/80 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-rose-600" />
                  Satispay
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-200/70 text-rose-800">
                  {satispayStats.count} transaz.
                </span>
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-black text-rose-950 font-mono">
                  €{satispayStats.amount.toFixed(2)}
                </div>
                <div className="text-[10px] text-rose-700 font-medium mt-0.5">
                  App & QR Code
                </div>
              </div>
            </div>

            {/* Altro */}
            <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-200/80 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-purple-800 flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-purple-600" />
                  Altro / Bonifico
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-purple-200/70 text-purple-800">
                  {otherStats.count} transaz.
                </span>
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-black text-purple-950 font-mono">
                  €{otherStats.amount.toFixed(2)}
                </div>
                <div className="text-[10px] text-purple-700 font-medium mt-0.5">
                  Voucher & Buoni
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
