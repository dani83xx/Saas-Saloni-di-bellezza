import React, { useState } from 'react';
import {
  CreditCard,
  CheckCircle2,
  Calendar,
  ShieldCheck,
  ExternalLink,
  FileText,
  Download,
  ArrowRight,
  Sparkles,
  Lock,
  X,
  RefreshCw,
  Zap,
  Building2,
  Check
} from 'lucide-react';
import { SubscriptionPlan, StripeInvoice } from '../types';
import { createTrialSubscription } from '../lib/subscription';

interface SalonSubscriptionManagerProps {
  subscription?: SubscriptionPlan;
  salonName: string;
  ownerName: string;
  salonEmail: string;
  onUpdateSubscription?: (updated: SubscriptionPlan) => void;
  showToast: (message: string) => void;
}

export const SalonSubscriptionManager: React.FC<SalonSubscriptionManagerProps> = ({
  subscription: initialSub,
  salonName,
  ownerName,
  salonEmail,
  onUpdateSubscription,
  showToast,
}) => {
  // Configurazione predefinita aggiornata con Piano PRO a 69€
  const defaultSub: SubscriptionPlan = {
    name: 'PRO (Mensile)',
    status: 'Attivo',
    price: 69,
    interval: 'mese',
    nextRenewalDate: '15 Ottobre',
    renewalFullDate: '15 Ottobre 2026',
    paymentMethod: {
      brand: 'Visa',
      last4: '4242',
      expiry: '08/28',
    },
    features: [
      'Appuntamenti illimitati & agenda calendario interattiva',
      'Promemoria e notifiche WhatsApp istantanee dirette',
      'Anagrafica clienti completa con note tecniche e storico spesa',
      'Listino servizi dinamico e monitoraggio fatturato',
      'Logo salone personalizzato e branding sulle ricevute',
      'Assistenza prioritaria dedicata WhatsApp & email 7/7',
    ],
    invoices: [
      {
        id: 'inv-0926',
        number: 'INV-2026-0915',
        date: '15 Settembre 2026',
        amount: 69.00,
        status: 'Pagata',
      },
      {
        id: 'inv-0826',
        number: 'INV-2026-0815',
        date: '15 Agosto 2026',
        amount: 69.00,
        status: 'Pagata',
      },
      {
        id: 'inv-0726',
        number: 'INV-2026-0715',
        date: '15 Luglio 2026',
        amount: 69.00,
        status: 'Pagata',
      },
    ],
  };

  const currentSub = initialSub || defaultSub;

  // Stripe Portal Simulator State
  const [isStripePortalOpen, setIsStripePortalOpen] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [selectedChangePlan, setSelectedChangePlan] = useState<string | null>(null);
  const [isEditingCard, setIsEditingCard] = useState(false);
  const [newCardLast4, setNewCardLast4] = useState('8888');

  // Launch Stripe Customer Portal simulation
  const handleOpenStripePortal = () => {
    setIsRedirecting(true);
    setTimeout(() => {
      setIsRedirecting(false);
      setIsStripePortalOpen(true);
    }, 650);
  };

  const handleSimulateChangePlan = (planName: string, price: number, interval: 'mese' | 'anno') => {
    const updated: SubscriptionPlan = {
      ...currentSub,
      name: planName,
      price,
      interval,
      nextRenewalDate: '15 Ottobre',
      renewalFullDate: interval === 'anno' ? '15 Ottobre 2027' : '15 Ottobre 2026',
    };
    if (onUpdateSubscription) {
      onUpdateSubscription(updated);
    }
    showToast(`Abbonamento aggiornato a ${planName} (€${price}/${interval}) con successo!`);
    setSelectedChangePlan(null);
  };

  const handleSimulateUpdateCard = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: SubscriptionPlan = {
      ...currentSub,
      paymentMethod: {
        brand: 'Mastercard',
        last4: newCardLast4 || '8888',
        expiry: '12/29',
      },
    };
    if (onUpdateSubscription) {
      onUpdateSubscription(updated);
    }
    setIsEditingCard(false);
    showToast(`Metodo di pagamento aggiornato: Mastercard che termina con •••• ${newCardLast4 || '8888'}`);
  };

  const handleDownloadInvoice = (inv: StripeInvoice) => {
    showToast(`Fattura ${inv.number} scaricata con successo in PDF`);
  };

  return (
    <div className="space-y-6">
      {/* ============================================================== */}
      {/* 1. SUBSCRIPTION OVERVIEW CARD */}
      {/* ============================================================== */}
      <div className="bg-gradient-to-br from-white via-pink-50/20 to-purple-50/20 rounded-2xl border border-pink-100 shadow-sm p-5 md:p-6 space-y-5 relative overflow-hidden">
        {/* Decorative corner glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-pink-400/10 via-[#8B5CF6]/10 to-transparent rounded-bl-full pointer-events-none" />

        {/* Top Header & Status Badge */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-pink-100/80 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#E95F8F] to-[#8B5CF6] text-white flex items-center justify-center shadow-sm">
                <CreditCard className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-[#1E1B2E] text-base md:text-lg">
                Abbonamento Salone & Licenza SaaS
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              Gestione della licenza software, pagamenti ricorrenti e fatturazione sicura con Stripe.
            </p>
          </div>

          {currentSub.status === 'Attivo' || currentSub.status === 'In prova' || currentSub.status === 'trial' ? (
            <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-200 px-3.5 py-1.5 rounded-full text-xs font-bold self-start sm:self-auto shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>
                {currentSub.name} {currentSub.status.toLowerCase()} - Prossimo rinnovo {currentSub.nextRenewalDate}
              </span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 bg-rose-50 text-rose-800 border border-rose-200 px-3.5 py-1.5 rounded-full text-xs font-bold self-start sm:self-auto shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>
                {currentSub.name} {currentSub.status.toLowerCase()} - Rinnovo richiesto
              </span>
            </div>
          )}
        </div>

        {/* Plan Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card: Plan Details */}
          <div className="bg-white/90 p-4 rounded-xl border border-pink-100/70 space-y-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Piano Corrente
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-[#1E1B2E]">{currentSub.name}</span>
              <span className="text-sm font-semibold text-[#E95F8F]">
                €{currentSub.price}/{currentSub.interval}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              Rinnovo: <strong className="text-slate-700">{currentSub.renewalFullDate}</strong>
            </p>
          </div>

          {/* Card: Payment Method */}
          <div className="bg-white/90 p-4 rounded-xl border border-pink-100/70 space-y-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Metodo di Pagamento
            </span>
            <div className="flex items-center gap-2">
              <div className="px-2 py-1 bg-slate-900 text-white rounded text-[10px] font-mono font-bold">
                {currentSub.paymentMethod.brand.toUpperCase()}
              </div>
              <span className="text-sm font-bold text-slate-800 font-mono">
                •••• {currentSub.paymentMethod.last4}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Scadenza: <strong className="text-slate-700">{currentSub.paymentMethod.expiry}</strong> • Addebito automatico
            </p>
          </div>

          {/* Card: Stripe Integration Security */}
          <div className="bg-white/90 p-4 rounded-xl border border-pink-100/70 space-y-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Sicurezza & Portale
            </span>
            <div className="flex items-center gap-1.5 text-xs text-[#635BFF] font-bold">
              <ShieldCheck className="w-4 h-4 text-[#635BFF]" />
              <span>Stripe Customer Portal</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Conforme PCI-DSS Livello 1 con crittografia bancaria a 256 bit.
            </p>
          </div>
        </div>

        {/* Features Checklist */}
        <div className="bg-white/80 rounded-xl p-4 border border-pink-50">
          <h4 className="text-xs font-bold text-slate-700 mb-2.5 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#E95F8F]" />
            Cosa include il tuo piano attivo:
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
            {currentSub.features.map((feat, i) => (
              <div key={i} className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{feat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Primary CTA & Portal Actions */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenStripePortal}
              disabled={isRedirecting}
              className="px-4 py-2.5 bg-[#635BFF] hover:bg-[#5248e3] active:scale-95 text-white font-bold text-xs rounded-xl shadow-md shadow-[#635BFF]/25 transition flex items-center gap-2 cursor-pointer"
            >
              {isRedirecting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Reindirizzamento a Stripe...</span>
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  <span>Gestisci Abbonamento</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleDownloadInvoice(currentSub.invoices[0])}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>Ultima Fattura (€{currentSub.price},00)</span>
            </button>
          </div>

          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <Lock className="w-3 h-3 text-slate-400" />
            Fatturato a {salonName} • P.IVA attiva
          </span>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. STRIPE CUSTOMER PORTAL SIMULATOR MODAL */}
      {/* ============================================================== */}
      {isStripePortalOpen && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 z-50 animate-fadeIn overflow-y-auto">
          <div className="bg-[#F8F9FA] rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto">
            {/* Stripe Portal Simulated Top Banner */}
            <div className="bg-[#635BFF] text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center font-bold text-white text-base">
                  S
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm tracking-tight">Stripe Customer Portal</span>
                    <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded font-mono">Simulatore Sandbox</span>
                  </div>
                  <p className="text-[11px] text-purple-200">{salonName} • {salonEmail}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsStripePortalOpen(false)}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-semibold text-white transition flex items-center gap-1.5"
              >
                <span>Torna a SalonDesk</span>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Portal Content Body */}
            <div className="p-5 md:p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* SECTION: PIANO ATTUALE */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Piano Sottoscritto
                    </span>
                    <h4 className="text-lg font-black text-slate-900 flex items-center gap-2">
                      {currentSub.name}
                      <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                        {currentSub.status}
                      </span>
                    </h4>
                    <p className="text-xs text-slate-600 mt-1">
                      €{currentSub.price},00 al {currentSub.interval} • Prossimo addebito automatico il{' '}
                      <strong className="text-slate-900">{currentSub.renewalFullDate}</strong>.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedChangePlan(selectedChangePlan ? null : 'choose')}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition"
                  >
                    {selectedChangePlan ? 'Chiudi Opzioni' : 'Cambia Piano'}
                  </button>
                </div>

                {/* MODIFICA: OPZIONI CON I NUOVI PREZZI EXACT */}
                {selectedChangePlan && (
                  <div className="pt-3 border-t border-slate-100 space-y-3">
                    <p className="text-xs font-semibold text-slate-700">Seleziona un piano diverso per il tuo salone:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                      {/* Piano 1: BASE (Mensile) - 39 € / mese */}
                      <div
                        onClick={() => handleSimulateChangePlan('BASE (Mensile)', 39, 'mese')}
                        className={`p-3.5 rounded-xl border transition cursor-pointer hover:border-purple-400 ${
                          currentSub.name === 'BASE (Mensile)'
                            ? 'border-emerald-500 bg-emerald-50/40 ring-2 ring-emerald-500/20'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="font-bold text-slate-900">BASE (Mensile)</div>
                        <div className="text-emerald-700 font-black text-base mt-1">39 € / mese</div>
                        <div className="text-[10px] text-slate-500 mt-1">Appuntamenti & Clienti base</div>
                      </div>

                      {/* Piano 2: PRO (Mensile) - 69 € / mese */}
                      <div
                        onClick={() => handleSimulateChangePlan('PRO (Mensile)', 69, 'mese')}
                        className={`p-3.5 rounded-xl border transition cursor-pointer hover:border-purple-400 relative ${
                          currentSub.name === 'PRO (Mensile)' || currentSub.name === 'Piano Pro'
                            ? 'border-[#635BFF] bg-purple-50/40 ring-2 ring-[#635BFF]/30'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <span className="absolute top-2 right-2 text-[9px] bg-purple-100 text-purple-700 font-bold px-1.5 py-0.5 rounded">
                          Attuale
                        </span>
                        <div className="font-bold text-slate-900">PRO (Mensile)</div>
                        <div className="text-[#635BFF] font-black text-base mt-1">69 € / mese</div>
                        <div className="text-[10px] text-slate-500 mt-1">Illimitato + WhatsApp + Staff</div>
                      </div>

                      {/* Piano 3: PRO ANNUALE (Unica rata) - 590 € / anno */}
                      <div
                        onClick={() => handleSimulateChangePlan('PRO ANNUALE (Unica rata)', 590, 'anno')}
                        className={`p-3.5 rounded-xl border transition cursor-pointer hover:border-purple-400 relative ${
                          currentSub.name === 'PRO ANNUALE (Unica rata)'
                            ? 'border-emerald-500 bg-emerald-50/40 ring-2 ring-emerald-500/20'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <span className="absolute top-2 right-2 text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                          Miglior Prezzo
                        </span>
                        <div className="font-bold text-slate-900">PRO ANNUALE</div>
                        <div className="text-emerald-700 font-black text-base mt-1">590 € / anno</div>
                        <div className="text-[10px] text-slate-500 mt-1">Unica rata (risparmi &gt;230€)</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION: METODO DI PAGAMENTO */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Metodo di Pagamento Predefinito
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="px-2 py-0.5 bg-slate-900 text-white rounded text-[10px] font-mono font-bold">
                        {currentSub.paymentMethod.brand}
                      </div>
                      <span className="text-sm font-bold text-slate-900 font-mono">
                        •••• •••• •••• {currentSub.paymentMethod.last4}
                      </span>
                      <span className="text-xs text-slate-500">
                        (Scade il {currentSub.paymentMethod.expiry})
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsEditingCard(!isEditingCard)}
                    className="text-xs font-bold text-[#635BFF] hover:underline"
                  >
                    {isEditingCard ? 'Annulla' : 'Aggiorna Carta'}
                  </button>
                </div>

                {isEditingCard && (
                  <form onSubmit={handleSimulateUpdateCard} className="pt-3 border-t border-slate-100 space-y-2">
                    <p className="text-xs font-semibold text-slate-700">Simulazione aggiornamento carta Stripe:</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        maxLength={4}
                        placeholder="Ultime 4 cifre (es. 5555)"
                        value={newCardLast4}
                        onChange={(e) => setNewCardLast4(e.target.value.replace(/\D/g, ''))}
                        className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono w-48"
                      />
                      <button
                        type="submit"
                        className="px-3.5 py-2 bg-[#635BFF] text-white text-xs font-bold rounded-xl hover:bg-[#5248e3]"
                      >
                        Salva Carta
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* SECTION: DATI DI FATTURAZIONE */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Intestazione Ricevute & Fatture Elettroniche
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400">Ragione Sociale:</span>{' '}
                    <strong className="text-slate-800">{salonName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Titolare:</span>{' '}
                    <strong className="text-slate-800">{ownerName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Email Fatturazione:</span>{' '}
                    <strong className="text-slate-800">{salonEmail}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Codice Fiscale / P.IVA:</span>{' '}
                    <strong className="text-slate-800 font-mono">IT09876543211</strong>
                  </div>
                </div>
              </div>

              {/* SECTION: CRONOLOGIA FATTURE */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Storico Pagamenti & Ricevute Quietanzate
                </span>

                <div className="divide-y divide-slate-100 text-xs">
                  {currentSub.invoices.map((inv) => (
                    <div key={inv.id} className="py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <div>
                          <div className="font-bold text-slate-900 font-mono">{inv.number}</div>
                          <div className="text-[11px] text-slate-500">{inv.date}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-800 font-mono">€{inv.amount.toFixed(2)}</span>
                        <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold">
                          {inv.status}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDownloadInvoice(inv)}
                          className="p-1.5 text-slate-500 hover:text-[#635BFF] hover:bg-slate-100 rounded-lg transition"
                          title="Scarica Ricevuta PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom retention / cancellation simulation */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 border-t border-slate-200">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-600">Simula Test:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const newStatus = currentSub.status === 'Scaduto' ? 'Attivo' : 'Scaduto';
                      if (onUpdateSubscription) {
                        onUpdateSubscription({
                          ...currentSub,
                          status: newStatus,
                        });
                      }
                      showToast(`Stato abbonamento impostato su: ${newStatus}`);
                    }}
                    className={`font-bold underline cursor-pointer ${
                      currentSub.status === 'Scaduto' ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {currentSub.status === 'Scaduto' ? '✓ Riattiva piano (Attivo)' : '✗ Simula abbonamento Scaduto'}
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (onUpdateSubscription) {
                        onUpdateSubscription(createTrialSubscription());
                      }
                      showToast('Stato abbonamento impostato su: trial (7 giorni)');
                    }}
                    className="text-[#635BFF] font-bold underline cursor-pointer"
                  >
                    Simula periodo prova (trial)
                  </button>
                </div>

                <span className="text-[11px] text-slate-400">
                  Operazione gestita tramite Stripe Billing API
                </span>
              </div>
            </div>

            {/* Portal Footer */}
            <div className="bg-slate-100 px-6 py-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#635BFF]" />
                Connessione cifrata con crittografia Stripe a 256-bit
              </span>

              <button
                type="button"
                onClick={() => setIsStripePortalOpen(false)}
                className="px-4 py-2 bg-[#635BFF] hover:bg-[#5248e3] text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Torna al Salone
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
