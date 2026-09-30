import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  CreditCard,
  Banknote,
  Smartphone,
  Receipt,
  User,
  Scissors,
  Clock,
  Sparkles,
  Wallet
} from 'lucide-react';
import { Appointment, PaymentMethod } from '../types';

interface CheckoutModalProps {
  isOpen: boolean;
  appointment: Appointment | null;
  onClose: () => void;
  onConfirmPayment: (
    appointmentId: string,
    paymentMethod: PaymentMethod,
    amountPaid: number,
    notes?: string
  ) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  appointment,
  onClose,
  onConfirmPayment,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('POS');
  const [amount, setAmount] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (appointment) {
      setAmount(appointment.price);
      setSelectedMethod(appointment.paymentMethod || 'POS');
      setNotes(appointment.notes || '');
    }
  }, [appointment, isOpen]);

  if (!isOpen || !appointment) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirmPayment(appointment.id, selectedMethod, amount, notes);
    onClose();
  };

  const paymentOptions: {
    id: PaymentMethod;
    label: string;
    sublabel: string;
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
    bgColor: string;
    borderColor: string;
    activeRing: string;
  }[] = [
    {
      id: 'POS',
      label: 'POS / Carta',
      sublabel: 'Bancomat, Visa, Mastercard, Apple Pay',
      icon: CreditCard,
      accentColor: 'text-sky-600',
      bgColor: 'bg-sky-50 hover:bg-sky-100/70',
      borderColor: 'border-sky-200',
      activeRing: 'ring-2 ring-sky-500 bg-sky-50 border-sky-400',
    },
    {
      id: 'Contanti',
      label: 'Contanti',
      sublabel: 'Banconote & Monete in cassa',
      icon: Banknote,
      accentColor: 'text-emerald-600',
      bgColor: 'bg-emerald-50 hover:bg-emerald-100/70',
      borderColor: 'border-emerald-200',
      activeRing: 'ring-2 ring-emerald-500 bg-emerald-50 border-emerald-400',
    },
    {
      id: 'Satispay',
      label: 'Satispay',
      sublabel: 'App mobile & QR Code salone',
      icon: Smartphone,
      accentColor: 'text-rose-600',
      bgColor: 'bg-rose-50 hover:bg-rose-100/70',
      borderColor: 'border-rose-200',
      activeRing: 'ring-2 ring-rose-500 bg-rose-50 border-rose-400',
    },
    {
      id: 'Altro',
      label: 'Altro / Bonifico',
      sublabel: 'Buono regalo, Voucher o Bonifico',
      icon: Wallet,
      accentColor: 'text-purple-600',
      bgColor: 'bg-purple-50 hover:bg-purple-100/70',
      borderColor: 'border-purple-200',
      activeRing: 'ring-2 ring-purple-500 bg-purple-50 border-purple-400',
    },
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-pink-100 overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-pink-100 bg-gradient-to-r from-pink-50/70 via-purple-50/40 to-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#E95F8F] to-[#8B5CF6] text-white flex items-center justify-center shadow-md shadow-pink-500/20">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-[#1E1B2E] text-base sm:text-lg flex items-center gap-2">
                Chiusura Conto & Incasso
                <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-purple-100 text-[#8B5CF6]">
                  Cassa
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Seleziona il metodo di pagamento per registrare l'incasso
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Appointment Summary Card */}
        <div className="p-5 space-y-4">
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-[#E95F8F]" />
                <span className="font-bold text-slate-800 text-sm">{appointment.clientName}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <Clock className="w-3.5 h-3.5 text-[#8B5CF6]" />
                <span>{appointment.time}</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-600 pt-1 border-t border-slate-200/60">
              <div className="flex items-center gap-1.5 truncate max-w-[280px]">
                <Scissors className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">
                  {appointment.serviceNames?.length
                    ? appointment.serviceNames.join(' + ')
                    : appointment.serviceName}
                </span>
              </div>
              {appointment.staffName && (
                <span className="text-[11px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200 shrink-0">
                  {appointment.staffName}
                </span>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Amount / Importo */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Importo da Incassare (€)
                </label>
                <span className="text-[11px] text-slate-400">Prezzo listino: €{appointment.price}</span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="text-xl font-bold text-slate-400">€</span>
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-2xl font-black text-[#1E1B2E] focus:bg-white focus:border-[#E95F8F] focus:ring-2 focus:ring-pink-200 outline-none transition"
                  required
                />
              </div>
            </div>

            {/* Payment Method Selector Grid */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Metodo di Pagamento Effettivo *
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {paymentOptions.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = selectedMethod === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedMethod(opt.id)}
                      className={`p-3 rounded-2xl border text-left transition duration-150 flex flex-col justify-between cursor-pointer ${
                        isSelected
                          ? opt.activeRing
                          : `bg-white border-slate-200 hover:border-slate-300 ${opt.bgColor}`
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className={`p-1.5 rounded-xl bg-white shadow-2xs ${opt.accentColor}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-xs">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-xs sm:text-sm text-slate-800">
                          {opt.label}
                        </div>
                        <div className="text-[10px] text-slate-500 leading-tight line-clamp-1">
                          {opt.sublabel}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Optional Note / Rif. Scontrino */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Note cassa o N. Scontrino (facoltativo)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Es. Scontrino n. 42 / Mancia inclusa"
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#8B5CF6] outline-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md shadow-emerald-600/20 transition flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Registra Incasso €{amount.toFixed(2)}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
