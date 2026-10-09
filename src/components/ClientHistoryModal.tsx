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

  const [technicalNotes, setTechnicalNotes] = useState(client.technicalNotes || '');
  const [generalNotes, setGeneralNotes] = useState(client.notes || '');
  const [noShowCount, setNoShowCount] = useState(client.noShowCount || 0);
  const [isBlocked, setIsBlocked] = useState(!!client.isBlocked);
  const [isSaving, setIsSaving] = useState(false);
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
    return filtered.sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return b.time.localeCompare(a.time);
    });
  }, [appointments, client]);

  const completedAppointments = clientAppointments.filter((a) => a.status === 'Completato');
  const noShowApps = clientAppointments.filter((a) => a.status === 'No-Show');
  const actualSpent = completedAppointments.reduce((sum, a) => sum + (a.price || 0), 0);
  const displayTotalSpent = actualSpent > 0 ? actualSpent : (client.totalSpent || 0);
  const totalVisitsCount = completedAppointments.length > 0 ? completedAppointments.length : (client.totalAppointments || 0);
  const averageTicket = totalVisitsCount > 0 ? (displayTotalSpent / totalVisitsCount).toFixed(1) : '0';
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
    onUpdateClient({ ...client, noShowCount: newCount });
    onShowToast(`Contatore No-Show aggiornato a ${newCount}`);
  };

  const handleToggleBlocked = () => {
    const nextVal = !isBlocked;
    setIsBlocked(nextVal);
    onUpdateClient({ ...client, isBlocked: nextVal });
    onShowToast(nextVal ? `Cliente bloccato per motivi di affidabilità.` : `Cliente sbloccato.`);
  };

  const handleSendWhatsApp = () => {
    const msg = `Ciao ${client.firstName}! Ti contattiamo dal salone ${settings.name}. Restiamo a tua completa disposizione per qualsiasi consulenza o appuntamento!`;
    openWhatsAppLink(client.phone, msg);
  };

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
<div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-pink-100 overflow-hidden max-h-[90vh] flex flex-col my-auto animate-in fade-in zoom-in-95 duration-200">        <div className="bg-gradient-to-r from-[#1E1B2E] via-[#2D1B36] to-[#1E1B2E] text-white p-5 sm:p-6 flex items-start justify-between relative shrink-0">
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
            <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer" title="Chiudi scheda">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="bg-slate-50 border-b border-pink-100/80 px-5 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-slate-400 mr-0.5" />
            {(client.tags || []).length > 0 ? (
              client.tags.map((t) => (
                <span key={t} className="px-2 py-0.5 rounded-lg text-xs font-bold bg-purple-50 text-[#8B5CF6] border border-purple-200">{t}</span>
              ))
            ) : (
              <span className="text-xs text-slate-400 italic">Nessun tag</span>
            )}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button type="button" onClick={handleSendWhatsApp} className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 transition shadow-2xs cursor-pointer">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp Rapido</span>
            </button>
            {onBookAppointmentForClient && (
              <button type="button" onClick={() => { onClose(); onBookAppointmentForClient(client); }} className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#E95F8F] hover:bg-[#d84d7d] text-white flex items-center gap-1.5 transition shadow-2xs cursor-pointer">
                <Plus className="w-3.5 h-3.5" />
                <span>Nuovo Appuntamento</span>
              </button>
            )}
          </div>
        </div>

        {/* SCHEDA TECNICA & FORMULE — bloccata su Piano Base */}
        <div className="p-5 sm:p-6 border-b border-slate-100 bg-slate-50/50 space-y-4 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-xs">PLUS</span>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Scheda Tecnica & Formule</h3>
              {isBasePlan && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600 border border-slate-300">
                  <Lock className="w-3 h-3" /> Bloccata
                </span>
              )}
            </div>
            {!isBasePlan && (
              <button type="button" onClick={handleSaveNotes} disabled={isSaving} className="px-4 py-1.5 rounded-xl text-xs font-bold bg-[#E95F8F] hover:bg-[#d84d7d] text-white shadow-sm transition disabled:opacity-50">
                {isSaving ? 'Salvataggio...' : 'Salva Scheda'}
              </button>
            )}
          </div>

          <div className={`relative ${isBasePlan ? 'select-none' : ''}`}>
            <div className={isBasePlan ? 'pointer-events-none blur-[3px] opacity-50' : ''}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600">Formula Colore / Miscelazione</label>
                  <textarea rows={3} value={technicalNotes} onChange={(e) => setTechnicalNotes(e.target.value)} placeholder="Es. Ricrescita: 6.34 + 20 vol. (30g + 30g). Lunghezze: Gloss 9.1..." disabled={isBasePlan} className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-pink-500 focus:outline-none transition resize-none font-mono disabled:cursor-not-allowed" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-rose-600 flex items-center gap-1.5"><span>⚠️</span> Allergie & Cute Sensibile</label>
                  <textarea rows={3} value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="Es. Reazione a ammoniaca, cute reattiva a lavaggi caldi..." disabled={isBasePlan} className="w-full text-xs p-3 rounded-xl border border-rose-200 bg-rose-50/40 text-rose-900 focus:ring-2 focus:ring-rose-400 focus:outline-none transition resize-none font-medium disabled:cursor-not-allowed" />
                </div>
              </div>
              <div className="pt-2">
                <label className="text-xs font-bold text-slate-600 block mb-2">Storico Visivo: Foto Prima / Dopo</label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl p-3 flex flex-col items-center justify-center bg-white text-center min-h-[110px]">
                    {photoBefore ? (
                      <div className="relative w-full h-24">
                        <img src={photoBefore} alt="Prima" className="w-full h-full object-cover rounded-xl" />
                        {!isBasePlan && (<button type="button" onClick={() => setPhotoBefore(null)} className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-1 text-[10px]">✕</button>)}
                      </div>
                    ) : (
                      <label className={`flex flex-col items-center gap-1 w-full h-full justify-center ${isBasePlan ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                        <span className="text-xs font-bold text-slate-600">📷 Foto "Prima"</span>
                        <span className="text-[10px] text-slate-400">Scatta o carica</span>
                        {!isBasePlan && (<input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handlePhotoUpload(e, 'before')} />)}
                      </label>
                    )}
                  </div>
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl p-3 flex flex-col items-center justify-center bg-white text-center min-h-[110px]">
                    {photoAfter ? (
                      <div className="relative w-full h-24">
                        <img src={photoAfter} alt="Dopo" className="w-full h-full object-cover rounded-xl" />
                        {!isBasePlan && (<button type="button" onClick={() => setPhotoAfter(null)} className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-1 text-[10px]">✕</button>)}
                      </div>
                    ) : (
                      <label className={`flex flex-col items-center gap-1 w-full h-full justify-center ${isBasePlan ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                        <span className="text-xs font-bold text-slate-600">✨ Foto "Dopo"</span>
                        <span className="text-[10px] text-slate-400">Scatta o carica</span>
                        {!isBasePlan && (<input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handlePhotoUpload(e, 'after')} />)}
                      </label>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {isBasePlan && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-gradient-to-b from-white/70 via-white/80 to-white/90 backdrop-blur-[1px]">
                <div className="mx-3 max-w-md w-full bg-white border border-amber-200 shadow-xl shadow-amber-500/10 rounded-2xl p-5 text-center space-y-3">
                  <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center shadow-md">
                    <Lock className="w-6 h-6" />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-sm font-black text-slate-900 leading-snug">🔒 Funzionalità Piano PLUS</p>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Sblocca la gestione <strong>Formule Colore</strong>, <strong>Allergie</strong> e <strong>Foto Prima/Dopo</strong> per il tuo staff con il Piano Plus.
                    </p>
                  </div>
<button
  type="button"
  onClick={() => {
    onClose();
    if (onUpgradePlan) {
      onUpgradePlan();
    }
  }}
  className="w-full px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-amber-500 to-amber-600 shadow-lg hover:from-amber-600 hover:to-amber-700 transition cursor-pointer flex items-center justify-center gap-2"
>
  <Sparkles className="w-4 h-4" />
  <span>Passa al Piano Plus</span>
</button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 overscroll-contain">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-2xl border border-pink-100 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Spesa Cumulativa</span>
              <div className="text-lg sm:text-xl font-black text-[#E95F8F] mt-1">€{displayTotalSpent.toFixed(2)}</div>
              <span className="text-[10px] text-slate-400 block mt-0.5">Scontrino medio: €{averageTicket}</span>
            </div>
            <div className="bg-white p-3.5 rounded-2xl border border-pink-100 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Visite Salone</span>
              <div className="text-lg sm:text-xl font-black text-slate-900 mt-1">{totalVisitsCount} <span className="text-xs font-normal text-slate-500">appuntamenti</span></div>
              <span className="text-[10px] text-slate-400 block mt-0.5">In archivio salone</span>
            </div>
            <div className="bg-white p-3.5 rounded-2xl border border-pink-100 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Tasso di Presenza</span>
              <div className={`text-lg sm:text-xl font-black mt-1 ${attendanceRate >= 90 ? 'text-emerald-600' : attendanceRate >= 70 ? 'text-amber-600' : 'text-rose-600'}`}>{attendanceRate}%</div>
              <span className="text-[10px] text-slate-400 block mt-0.5">{completedAppointments.length} presenti • {noShowApps.length} assenti</span>
            </div>
            <div className="bg-white p-3.5 rounded-2xl border border-pink-100 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Affidabilità No-Show</span>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`text-lg sm:text-xl font-black ${noShowCount === 0 ? 'text-emerald-600' : noShowCount === 1 ? 'text-amber-600' : 'text-rose-600'}`}>{noShowCount}</span>
                <div className="flex items-center gap-0.5">
                  <button type="button" onClick={() => handleAdjustNoShow(-1)} className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold">−</button>
                  <button type="button" onClick={() => handleAdjustNoShow(1)} className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold">+</button>
                </div>
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">Assenze registrate</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5"><History className="w-3.5 h-3.5" /> Note generali cliente</label>
            <textarea rows={2} value={generalNotes} onChange={(e) => setGeneralNotes(e.target.value)} placeholder="Preferenze, orari preferiti, note libere..." className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-pink-500 focus:outline-none transition resize-none" />
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-pink-500" /> Storico appuntamenti ({clientAppointments.length})</h4>
            {clientAppointments.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4 text-center">Nessun appuntamento collegato a questo cliente.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {clientAppointments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-100 bg-white hover:border-pink-100 transition">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800 truncate">{a.serviceName || a.serviceNames?.join(', ')}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>{formatDisplayDate(a.date)} · {a.time}</span>
                        {a.staffName && <span className="text-slate-400">· {a.staffName}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-black text-slate-800">€{(a.price || 0).toFixed(0)}</div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                        a.status === 'Completato' ? 'bg-emerald-50 text-emerald-700' :
                        a.status === 'No-Show' ? 'bg-rose-50 text-rose-700' :
                        a.status === 'Annullato' ? 'bg-slate-100 text-slate-500' :
                        'bg-amber-50 text-amber-700'
                      }`}>{a.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={handleToggleBlocked} className={`px-3.5 py-2 text-xs font-bold rounded-xl border transition cursor-pointer ${
              isBlocked ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
            }`}>
              {isBlocked ? '✓ Sblocca Cliente' : '⛔ Blocca Cliente per No-Show'}
            </button>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer">Chiudi</button>
              <button type="button" onClick={handleSaveNotes} className="px-4 py-2 text-xs font-bold text-white bg-[#E95F8F] hover:bg-[#d84d7d] rounded-xl shadow-md shadow-pink-600/20 transition cursor-pointer">Salva Scheda</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
