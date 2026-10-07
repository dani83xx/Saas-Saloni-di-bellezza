import React, { useState, useMemo } from 'react';
import {
  X,
  User,
  Phone,
  Mail,
  Calendar,
  Clock,
  CreditCard,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  MessageSquare,
  Scissors,
  Plus,
  Ban,
  Save,
  Tag,
  TrendingUp,
  History,
  Lock,
} from 'lucide-react';
import { Client, Appointment, SalonSettings } from '../types';
import { ClientReputationBadge } from './ClientReputationBadge';
import { formatDisplayDate } from '../utils/date';
import { buildAppointmentMessage, openWhatsAppLink } from '../utils/whatsapp';

interface ClientHistoryModalProps {
  isOpen: boolean;
  client: Client | null;
  appointments: Appointment[];
  settings: SalonSettings;
  onClose: () => void;
  onUpdateClient: (updatedClient: Client) => void;
  onBookAppointmentForClient?: (client: Client) => void;
  onShowToast: (message: string) => void;
  onUpgradePlan?: () => void;
}

export const ClientHistoryModal: React.FC<ClientHistoryModalProps> = ({
  isOpen,
  client,
  appointments,
  settings,
  onClose,
  onUpdateClient,
  onBookAppointmentForClient,
  onShowToast,
  onUpgradePlan,
}) => {
  if (!isOpen || !client) return null;

  // Local state for editing technical notes & general notes
  const [technicalNotes, setTechnicalNotes] = useState(client.technicalNotes || '');
  const [generalNotes, setGeneralNotes] = useState(client.notes || '');
  const [noShowCount, setNoShowCount] = useState(client.noShowCount || 0);
  const [isBlocked, setIsBlocked] = useState(!!client.isBlocked);
  const [isSaving, setIsSaving] = useState(false);

  // Campi avanzati Scheda Tecnica (Piano Plus)
  const [allergies, setAllergies] = useState((client as any)?.allergies || '');
  const [photoBefore, setPhotoBefore] = useState<string | null>((client as any)?.photoBefore || null);
  const [photoAfter, setPhotoAfter] = useState<string | null>((client as any)?.photoAfter || null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'before' | 'after') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (type === 'before') setPhotoBefore(reader.result as string);
      else setPhotoAfter(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Sync state if client changes
  React.useEffect(() => {
    if (client) {
      setTechnicalNotes(client.technicalNotes || '');
      setGeneralNotes(client.notes || '');
      setNoShowCount(client.noShowCount || 0);
      setIsBlocked(!!client.isBlocked);
      setAllergies((client as any)?.allergies || '');
      setPhotoBefore((client as any)?.photoBefore || null);
      setPhotoAfter((client as any)?.photoAfter || null);
    }
  }, [client]);

  // Find all appointments related to this client (by phone or full name match)
  const clientAppointments = useMemo(() => {
    const fullName = `${client.firstName} ${client.lastName}`.toLowerCase().trim();
    const phoneClean = (client.phone || '').replace(/[\s+-]/g, '');

    const filtered = appointments.filter((a) => {
      const appName = (a.clientName || '').toLowerCase().trim();
      const appPhoneClean = (a.clientPhone || '').replace(/[\s+-]/g, '');
      const matchName = appName === fullName;
      const matchPhone = phoneClean && appPhoneClean && (phoneClean.includes(appPhoneClean) || appPhoneClean.includes(phoneClean));
      return matchName || matchPhone;
    });

    // Sort descending by date and time (most recent first)
    return filtered.sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return b.time.localeCompare(a.time);
    });
  }, [appointments, client]);

  // Calculated metrics
  const completedAppointments = clientAppointments.filter((a) => a.status === 'Completato');
  const noShowApps = clientAppointments.filter((a) => a.status === 'No-Show');
  const actualSpent = completedAppointments.reduce((sum, a) => sum + (a.price || 0), 0);
  const displayTotalSpent = actualSpent > 0 ? actualSpent : (client.totalSpent || 0);
  const totalVisitsCount = completedAppointments.length > 0 ? completedAppointments.length : (client.totalAppointments || 0);
  const averageTicket = totalVisitsCount > 0 ? (displayTotalSpent / totalVisitsCount).toFixed(1) : '0';

  // Attendance rate
  const totalConsidered = completedAppointments.length + noShowApps.length;
  const attendanceRate = totalConsidered > 0
    ? Math.round((completedAppointments.length / totalConsidered) * 100)
    : 100;

  const handleSaveNotes = () => {
    setIsSaving(true);
    const updated: any = {
      ...client,
      technicalNotes,
      notes: generalNotes,
      noShowCount,
      isBlocked,
      allergies,
      photoBefore,
      photoAfter,
    };
    onUpdateClient(updated);
    setTimeout(() => {
      setIsSaving(false);
      onShowToast(`Scheda di ${client.firstName} ${client.lastName} aggiornata con successo!`);
    }, 200);
  };

  const handleAdjustNoShow = (delta: number) => {
    const newCount = Math.max(0, noShowCount + delta);
    setNoShowCount(newCount);
    const updated: Client = {
      ...client,
      noShowCount: newCount,
    };
    onUpdateClient(updated);
    onShowToast(`Contatore No-Show aggiornato a ${newCount}`);
  };

  const handleToggleBlocked = () => {
    const nextVal = !isBlocked;
    setIsBlocked(nextVal);
    const updated: Client = {
      ...client,
      isBlocked: nextVal,
    };
    onUpdateClient(updated);
    onShowToast(nextVal ? `Cliente bloccato per motivi di affidabilità.` : `Cliente sbloccato.`);
  };

  const handleSendWhatsApp = () => {
    const msg = `Ciao ${client.firstName}! Ti contattiamo dal salone ${settings.name}. Restiamo a tua completa disposizione per qualsiasi consulenza o appuntamento!`;
    openWhatsAppLink(client.phone, msg);
  };

  // Piano Base = blocco Scheda Tecnica (Formule Colore, Allergie, Foto Prima/Dopo)
  const planName = (settings.subscription?.name || 'Piano Pro').toLowerCase();
  const isBasePlan = planName.includes('base');

  const handleUpgradeClick = () => {
    if (onUpgradePlan) {
      onUpgradePlan();
    } else {
      onShowToast('Vai su Abbonamento per passare al Piano Plus e sbloccare la Scheda Tecnica.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex justify-center items-start md:items-center p-2 sm:p-4">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-pink-100 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        {/* Header Drawer */}
        <div className="bg-gradient-to-r from-[#1E1B2E] via-[#2D1B36] to-[#1E1B2E] text-white p-5 sm:p-6 flex items-start justify-between relative shrink-0">
          <div className="flex items-start gap-4">
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-[#E95F8F] to-[#8B5CF6] text-white flex items-center justify-center font-black text-xl shadow-md shrink-0 border-2 border-white/20">
              {client.firstName.charAt(0)}{client.lastName.charAt(0)}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {client.firstName} {client.lastName}
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  client.status === 'Attivo' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}>
                  {client.status}
                </span>
                <ClientReputationBadge noShowCount={noShowCount} isBlocked={isBlocked} size="sm" />
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 mt-1.5 font-medium">
                <span className="flex items-center gap-1 font-mono">
                  <Phone className="w-3.5 h-3.5 text-pink-400" />
                  {client.phone}
                </span>
                {client.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-purple-400" />
                    {client.email}
                  </span>
                )}
                {client.lastAppointmentDate && (
                  <span className="text-slate-400">
                    Ultima visita: <strong className="text-white">{client.lastAppointmentDate}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
              title="Chiudi scheda"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Quick Bar */}
        <div className="bg-slate-50 border-b border-pink-100/80 px-5 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Tags */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-slate-400 mr-0.5" />
            {(client.tags || []).length > 0 ? (
              client.tags.map((t) => (
                <span
                  key={t}
                  className="px-2 py-0.5 rounded-lg text-xs font-bold bg-purple-50 text-[#8B5CF6] border border-purple-200"
                >
                  {t}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-400 italic">Nessun tag</span>
            )}
          </div>

          {/* Quick Buttons */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp Rapido</span>
            </button>
            {onBookAppointmentForClient && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onBookAppointmentForClient(client);
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#E95F8F] hover:bg-[#d84d7d] text-white flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nuovo Appuntamento</span>
              </button>
            )}
          </div>
        </div>

        {/* SCHEDA TECNICA & FORMULE (PIANO PLUS) — bloccata su Piano Base */}
        <div className="p-5 sm:p-6 border-b border-slate-100 bg-slate-50/50 space-y-4 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-xs">
                PLUS
              </span>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Scheda Tecnica & Formule
              </h3>
              {isBasePlan && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600 border border-slate-300">
                  <Lock className="w-3 h-3" />
                  Bloccata
                </span>
              )}
            </div>
            {!isBasePlan && (
              <button
                type="button"
                onClick={handleSaveNotes}
                disabled={isSaving}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-[#E95F8F] hover:bg-[#d84d7d] text-white shadow-sm transition disabled:opacity-50"
              >
                {isSaving ? 'Salvataggio...' : 'Salva Scheda'}
              </button>
            )}
          </div>

          {/* Contenuto Scheda: se Base → sfocato + overlay lucchetto */}
          <div className={`relative ${isBasePlan ? 'select-none' : ''}`}>
            <div className={isBasePlan ? 'pointer-events-none blur-[3px] opacity-50' : ''}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Box Formula Colore */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                    Formula Colore / Miscelazione
                  </label>
                  <textarea
                    rows={3}
                    value={technicalNotes}
                    onChange={(e) => setTechnicalNotes(e.target.value)}
                    placeholder="Es. Ricrescita: 6.34 + 20 vol. (30g + 30g). Lunghezze: Gloss 9.1..."
                    disabled={isBasePlan}
                    className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-pink-500 focus:outline-none transition resize-none font-mono disabled:cursor-not-allowed"
                  />
                </div>

                {/* Box Allergie / Cute Sensibile */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-rose-600 flex items-center gap-1.5">
                    <span>⚠️</span> Allergie & Cute Sensibile
                  </label>
                  <textarea
                    rows={3}
                    value={allergies}
                    onChange={(e) => setAllergies(e.target.value)}
                    placeholder="Es. Reazione a ammoniaca, cute reattiva a lavaggi caldi..."
                    disabled={isBasePlan}
                    className="w-full text-xs p-3 rounded-xl border border-rose-200 bg-rose-50/40 text-rose-900 focus:ring-2 focus:ring-rose-400 focus:outline-none transition resize-none font-medium disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Sezione Foto Prima e Dopo */}
              <div className="pt-2">
                <label className="text-xs font-bold text-slate-600 block mb-2">
                  Storico Visivo: Foto Prima / Dopo
                </label>
                <div className="grid grid-cols-2 gap-4">
                  {/* Foto Prima */}
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl p-3 flex flex-col items-center justify-center bg-white text-center hover:border-pink-300 transition relative min-h-[110px]">
                    {photoBefore ? (
                      <div className="relative w-full h-24">
                        <img src={photoBefore} alt="Prima" className="w-full h-full object-cover rounded-xl" />
                        {!isBasePlan && (
                          <button
                            type="button"
                            onClick={() => setPhotoBefore(null)}
                            className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-1 text-[10px]"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ) : (
                      <label className={`flex flex-col items-center gap-1 w-full h-full justify-center ${isBasePlan ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                        <span className="text-xs font-bold text-slate-600">📷 Foto "Prima"</span>
                        <span className="text-[10px] text-slate-400">Scatta o carica</span>
                        {!isBasePlan && (
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => handlePhotoUpload(e, 'before')}
                          />
                        )}
                      </label>
                    )}
                  </div>

                  {/* Foto Dopo */}
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl p-3 flex flex-col items-center justify-center bg-white text-center hover:border-pink-300 transition relative min-h-[110px]">
                    {photoAfter ? (
                      <div className="relative w-full h-24">
                        <img src={photoAfter} alt="Dopo" className="w-full h-full object-cover rounded-xl" />
                        {!isBasePlan && (
                          <button
                            type="button"
                            onClick={() => setPhotoAfter(null)}
                            className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-1 text-[10px]"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ) : (
                      <label className={`flex flex-col items-center gap-1 w-full h-full justify-center ${isBasePlan ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                        <span className="text-xs font-bold text-slate-600">✨ Foto "Dopo"</span>
                        <span className="text-[10px] text-slate-400">Scatta o carica</span>
                        {!isBasePlan && (
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => handlePhotoUpload(e, 'after')}
                          />
                        )}
                      </label>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Overlay lucchetto — solo Piano Base */}
            {isBasePlan && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-gradient-to-b from-white/70 via-white/80 to-white/90 backdrop-blur-[1px]">
                <div className="mx-3 max-w-md w-full bg-white border border-amber-200 shadow-xl shadow-amber-500/10 rounded-2xl p-5 text-center space-y-3">
                  <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center shadow-md">
                    <Lock className="w-6 h-6" />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-sm font-black text-slate-900 leading-snug">
                      🔒 Funzionalità Piano PLUS
                    </p>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Sblocca la gestione <strong>Formule Colore</strong>, <strong>Allergie</strong> e <strong>Foto Prima/Dopo</strong> per il tuo staff con il Piano Plus.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleUpgradeClick}
                    className="w-full px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-md shadow-amber-500/25 transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    Passa al Piano Plus
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Scrollable Content Body */}
