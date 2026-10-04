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
    }
setAllergies((client as any)?.allergies || '');
      setPhotoBefore((client as any)?.photoBefore || null);
      setPhotoAfter((client as any)?.photoAfter || null);
    
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

        {/* SCHEDA TECNICA & FORMULE (PIANO PLUS) */}
        <div className="p-5 sm:p-6 border-b border-slate-100 bg-slate-50/50 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-xs">
                PLUS
              </span>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Scheda Tecnica & Formule
              </h3>
            </div>
            <button
              type="button"
              onClick={handleSaveNotes}
              disabled={isSaving}
              className="px-4 py-1.5 rounded-xl text-xs font-bold bg-[#E95F8F] hover:bg-[#d84d7d] text-white shadow-sm transition disabled:opacity-50"
            >
              {isSaving ? 'Salvataggio...' : 'Salva Scheda'}
            </button>
          </div>

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
                className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-pink-500 focus:outline-none transition resize-none font-mono"
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
                className="w-full text-xs p-3 rounded-xl border border-rose-200 bg-rose-50/40 text-rose-900 focus:ring-2 focus:ring-rose-400 focus:outline-none transition resize-none font-medium"
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
                    <button
                      type="button"
                      onClick={() => setPhotoBefore(null)}
                      className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-1 text-[10px]"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center gap-1 w-full h-full justify-center">
                    <span className="text-xs font-bold text-slate-600">📷 Foto "Prima"</span>
                    <span className="text-[10px] text-slate-400">Scatta o carica</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => handlePhotoUpload(e, 'before')}
                    />
                  </label>
                )}
              </div>

              {/* Foto Dopo */}
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-3 flex flex-col items-center justify-center bg-white text-center hover:border-pink-300 transition relative min-h-[110px]">
                {photoAfter ? (
                  <div className="relative w-full h-24">
                    <img src={photoAfter} alt="Dopo" className="w-full h-full object-cover rounded-xl" />
                    <button
                      type="button"
                      onClick={() => setPhotoAfter(null)}
                      className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-1 text-[10px]"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center gap-1 w-full h-full justify-center">
                    <span className="text-xs font-bold text-slate-600">✨ Foto "Dopo"</span>
                    <span className="text-[10px] text-slate-400">Scatta o carica</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => handlePhotoUpload(e, 'after')}
                    />
                  </label>
                )}
              </div>
            </div>
          </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-2xl border border-pink-100 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Spesa Cumulativa</span>
              <div className="text-lg sm:text-xl font-black text-[#E95F8F] mt-1">
                €{displayTotalSpent.toFixed(2)}
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">Scontrino medio: €{averageTicket}</span>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-pink-100 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Visite Salone</span>
              <div className="text-lg sm:text-xl font-black text-slate-900 mt-1">
                {totalVisitsCount} <span className="text-xs font-normal text-slate-500">appuntamenti</span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">In archivio salone</span>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-pink-100 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Tasso di Presenza</span>
              <div className={`text-lg sm:text-xl font-black mt-1 ${
                attendanceRate >= 90 ? 'text-emerald-600' : attendanceRate >= 70 ? 'text-amber-600' : 'text-rose-600'
              }`}>
                {attendanceRate}%
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {completedAppointments.length} presenti • {noShowApps.length} assenti
              </span>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-pink-100 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Affidabilità No-Show</span>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`text-lg sm:text-xl font-black ${
                  noShowCount === 0 ? 'text-emerald-600' : noShowCount === 1 ? 'text-amber-600' : 'text-rose-600'
                }`}>
                  {noShowCount}
                </span>
                <span className="text-xs text-slate-500">saltati</span>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <button
                  type="button"
                  onClick={() => handleAdjustNoShow(-1)}
                  disabled={noShowCount <= 0}
                  className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold disabled:opacity-40 cursor-pointer"
                  title="Riduci contatore No-Show"
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustNoShow(1)}
                  className="px-1.5 py-0.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold cursor-pointer"
                  title="Incrementa No-Show"
                >
                  +1
                </button>
              </div>
            </div>
          </div>

          {/* Advice / Protection Banner if High Risk or Warning */}
          {isBlocked && (
            <div className="p-4 rounded-2xl bg-rose-100 border border-rose-300 text-rose-900 flex items-start gap-3 shadow-2xs">
              <Ban className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <strong className="block text-sm font-bold text-rose-950">Cliente Attualmente Bloccato</strong>
                <p className="mt-0.5 text-rose-800">
                  Questo cliente non può prenotare nuovi slot senza autorizzazione diretta della direzione salone a causa di no-show seriali.
                </p>
                <button
                  type="button"
                  onClick={handleToggleBlocked}
                  className="mt-2 px-3 py-1 bg-white text-rose-700 font-bold rounded-lg border border-rose-300 hover:bg-rose-50 transition cursor-pointer"
                >
                  Sblocca Cliente
                </button>
              </div>
            </div>
          )}

          {!isBlocked && noShowCount >= 2 && (
            <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-900 flex items-start gap-3 shadow-2xs">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <strong className="block text-sm font-black text-rose-950">
                  🚨 Protocollo No-Show: Cliente ad Alto Rischio ({noShowCount} Appuntamenti Saltati)
                </strong>
                <p className="mt-1 text-rose-800 leading-relaxed">
                  Per tutelare l'incasso del salone ed evitare poltrone vuote, si consiglia vivamente di:
                  <strong className="block mt-0.5">• Richiedere la riconferma telefonica 24h prima.</strong>
                  <strong className="block">• Applicare una caparra confirmatoria sui trattamenti lunghi.</strong>
                </p>
                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleBlocked}
                    className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition shadow-2xs cursor-pointer"
                  >
                    Blocca Prenotazioni per questo Cliente
                  </button>
                </div>
              </div>
            </div>
          )}

          {!isBlocked && noShowCount === 1 && (
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5 text-xs shadow-2xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold text-amber-950">Attenzione: 1 No-Show registrato in passato.</strong>
                <span className="block text-amber-800 mt-0.5">
                  Assicurati di inviare il promemoria automatico WhatsApp per confermare l'orario.
                </span>
              </div>
            </div>
          )}

          {/* Section: Note Tecniche Salone & Note Generali (Editable) */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-pink-100 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-pink-50 pb-2.5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#8B5CF6]" />
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  Note Tecniche & Preferenze di Trattamento
                </h3>
              </div>
              <button
                type="button"
                onClick={handleSaveNotes}
                disabled={isSaving}
                className="px-3 py-1.5 bg-[#8B5CF6] hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Salvataggio...' : 'Salva Modifiche'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Note Tecniche (formule colore, allergie, cute) */}
              <div>
                <label className="block text-xs font-bold text-purple-900 mb-1 flex items-center justify-between">
                  <span>Note Tecniche (Formule Colore, Allergie, Cute)</span>
                  <span className="text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.2 rounded font-medium">
                    Visibile allo Staff
                  </span>
                </label>
                <textarea
                  rows={3}
                  value={technicalNotes}
                  onChange={(e) => setTechnicalNotes(e.target.value)}
                  placeholder="Es. Formula colore: 6.34 + 20 vol. Cute reattiva, preferisce shampoo lenitivo BIO. Allergica al nichel..."
                  className="w-full p-3 bg-purple-50/30 border border-purple-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-[#8B5CF6] outline-none transition"
                />
              </div>

              {/* Note Generali / Preferenze Personali */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Note Generali & Preferenze Personali</span>
                  <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded font-medium">
                    Servizio Clienti
                  </span>
                </label>
                <textarea
                  rows={3}
                  value={generalNotes}
                  onChange={(e) => setGeneralNotes(e.target.value)}
                  placeholder="Es. Preferisce caffè amaro, ha disponibilità solo il giovedì mattina, orario pausa pranzo..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-[#8B5CF6] outline-none transition"
                />
              </div>
            </div>
          </div>

          {/* Section: Timeline Storico Appuntamenti */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-pink-100 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-pink-50 pb-2.5">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[#E95F8F]" />
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  Storico Trattamenti & Appuntamenti ({clientAppointments.length})
                </h3>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                In ordine cronologico decrescente
              </span>
            </div>

            {clientAppointments.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
                Nessun appuntamento registrato per questo cliente in archivio.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {clientAppointments.map((app) => {
                  const isCompleted = app.status === 'Completato';
                  const isNoShow = app.status === 'No-Show';
                  const isUpcoming = app.status === 'Confermato' || app.status === 'In corso';

                  return (
                    <div key={app.id} className="py-3.5 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-pink-50/20 px-2 rounded-xl transition">
                      {/* Left: Date & Status */}
                      <div className="flex items-start gap-3">
                        <div className="w-16 shrink-0 text-center bg-slate-50 p-2 rounded-xl border border-slate-200">
                          <span className="text-[11px] font-bold text-slate-500 block leading-tight">
                            {formatDisplayDate(app.date, { includeYear: false, withWeekday: false })}
                          </span>
                          <span className="text-xs font-black text-slate-900 font-mono mt-0.5 block">
                            {app.time}
                          </span>
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-sm">
                              {app.serviceNames && app.serviceNames.length > 1
                                ? app.serviceNames.join(' + ')
                                : app.serviceName}
                            </span>
                            <span
                              className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                                isCompleted
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : isNoShow
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : isUpcoming
                                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              {app.status}
                            </span>
                          </div>

                          <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2 mt-1">
                            <span>{app.durationMinutes} min</span>
                            {app.staffName && (
                              <>
                                <span>•</span>
                                <span className="text-purple-700 font-medium">Seguito da: {app.staffName}</span>
                              </>
                            )}
                            {app.notes && (
                              <>
                                <span>•</span>
                                <span className="italic text-slate-600">"{app.notes}"</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Price & Payment */}
                      <div className="text-right sm:self-center shrink-0">
                        <div className="text-sm font-black text-[#E95F8F]">
                          €{app.price}
                        </div>
                        {app.isPaid ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 mt-0.5">
                            <CreditCard className="w-3 h-3 text-emerald-600" />
                            <span>{app.paymentMethod || 'Saldato'}</span>
                          </span>
                        ) : isNoShow ? (
                          <span className="text-[10px] text-rose-600 font-semibold block">
                            Non incassato
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-700 font-semibold block">
                            Da incassare
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleToggleBlocked}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl border transition cursor-pointer ${
              isBlocked
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
            }`}
          >
            {isBlocked ? '✓ Sblocca Cliente' : '⛔ Blocca Cliente per No-Show'}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
            >
              Chiudi
            </button>
            <button
              type="button"
              onClick={handleSaveNotes}
              className="px-4 py-2 text-xs font-bold text-white bg-[#E95F8F] hover:bg-[#d84d7d] rounded-xl shadow-md shadow-pink-600/20 transition cursor-pointer"
            >
              Salva Scheda
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
