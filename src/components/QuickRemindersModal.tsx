import React, { useState, useMemo, useEffect } from 'react';
import {
  Bell,
  MessageSquare,
  Check,
  CheckCircle2,
  Clock,
  User,
  Sparkles,
  Star,
  X,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Eye,
  Copy,
  Search,
  ExternalLink,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { Appointment, SalonSettings, getStaffColorConfig } from '../types';
import {
  sanitizePhoneNumber,
  buildAppointmentMessage,
  openWhatsAppLink
} from '../utils/whatsapp';

interface QuickRemindersModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointments: Appointment[];
  settings: SalonSettings;
  todayStr: string;
  onShowToast?: (msg: string) => void;
}

/**
 * Calculates the next day's date string (YYYY-MM-DD) from an input date string.
 */
function getTomorrowDateStr(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + 1);
  const nextY = date.getFullYear();
  const nextM = String(date.getMonth() + 1).padStart(2, '0');
  const nextD = String(date.getDate()).padStart(2, '0');
  return `${nextY}-${nextM}-${nextD}`;
}

/**
 * Formats a YYYY-MM-DD string into an Italian readable date.
 */
function formatItalianDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const days = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
  const months = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ];
  return `${days[date.getDay()]} ${d} ${months[date.getMonth()]} ${y}`;
}

export const QuickRemindersModal: React.FC<QuickRemindersModalProps> = ({
  isOpen,
  onClose,
  appointments,
  settings,
  todayStr,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'tomorrow' | 'reviews'>('tomorrow');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'sent'>('all');
  const [expandedPreviewId, setExpandedPreviewId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const tomorrowStr = useMemo(() => getTomorrowDateStr(todayStr), [todayStr]);

  // Local storage keys for persisting sent reminders and feedback per date
  const reminderStorageKey = `salondesk_reminders_${tomorrowStr}`;
  const feedbackStorageKey = `salondesk_feedback_${todayStr}`;

  // State of sent reminder appointment IDs
  const [sentReminderIds, setSentReminderIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(reminderStorageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // State of sent review/feedback appointment IDs
  const [sentFeedbackIds, setSentFeedbackIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(feedbackStorageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Persist sent reminders
  useEffect(() => {
    try {
      localStorage.setItem(reminderStorageKey, JSON.stringify(sentReminderIds));
    } catch (e) {
      console.error(e);
    }
  }, [sentReminderIds, reminderStorageKey]);

  // Persist sent feedbacks
  useEffect(() => {
    try {
      localStorage.setItem(feedbackStorageKey, JSON.stringify(sentFeedbackIds));
    } catch (e) {
      console.error(e);
    }
  }, [sentFeedbackIds, feedbackStorageKey]);

  // Appointments scheduled for tomorrow (excluding cancelled)
  const tomorrowAppointments = useMemo(() => {
    return appointments
      .filter((a) => a.date === tomorrowStr && a.status !== 'Annullato')
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [appointments, tomorrowStr]);

  // Today's completed appointments (for review requests)
  const todayCompletedAppointments = useMemo(() => {
    return appointments
      .filter((a) => a.date === todayStr && a.status === 'Completato')
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [appointments, todayStr]);

  // Filtering for tomorrow's list
  const filteredTomorrowList = useMemo(() => {
    return tomorrowAppointments.filter((app) => {
      const isSent = sentReminderIds.includes(app.id);
      if (statusFilter === 'pending' && isSent) return false;
      if (statusFilter === 'sent' && !isSent) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesClient = app.clientName.toLowerCase().includes(q);
        const matchesService = (app.serviceName || '').toLowerCase().includes(q) ||
          (app.serviceNames || []).some(s => s.toLowerCase().includes(q));
        const matchesStaff = (app.staffName || '').toLowerCase().includes(q);
        const matchesPhone = app.clientPhone.toLowerCase().includes(q);
        return matchesClient || matchesService || matchesStaff || matchesPhone;
      }

      return true;
    });
  }, [tomorrowAppointments, sentReminderIds, statusFilter, searchQuery]);

  // Progress metrics for tomorrow
  const totalTomorrowCount = tomorrowAppointments.length;
  const sentTomorrowCount = tomorrowAppointments.filter((a) =>
    sentReminderIds.includes(a.id)
  ).length;
  const progressPercentage =
    totalTomorrowCount > 0 ? Math.round((sentTomorrowCount / totalTomorrowCount) * 100) : 0;

  // Handle WhatsApp Reminder Sending
  const handleSendReminder = (app: Appointment) => {
    const text = buildAppointmentMessage({
      type: 'promemoria',
      clientName: app.clientName,
      salonName: settings.name,
      serviceName: app.serviceName,
      serviceNames: app.serviceNames,
      date: app.date,
      time: app.time,
      price: app.price,
      address: settings.address,
      city: settings.city,
      staffName: app.staffName,
      googleReviewLink: settings.googleReviewLink,
    });

    openWhatsAppLink(app.clientPhone, text);

    // Mark as sent
    if (!sentReminderIds.includes(app.id)) {
      setSentReminderIds((prev) => [...prev, app.id]);
    }

    if (onShowToast) {
      onShowToast(`Promemoria inviato a ${app.clientName} per le ore ${app.time}!`);
    }
  };

  // Toggle manual sent state for reminder
  const toggleReminderSentState = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSentReminderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Reset all sent reminders for tomorrow
  const handleResetReminders = () => {
    if (window.confirm('Vuoi davvero reimpostare lo stato dei promemoria di domani a "Da inviare"?')) {
      setSentReminderIds([]);
      if (onShowToast) {
        onShowToast('Stato promemoria azzerato. Tutti i clienti sono ora "Da inviare".');
      }
    }
  };

  // Handle WhatsApp Review Feedback Sending
  const handleSendFeedback = (app: Appointment) => {
    const text = buildAppointmentMessage({
      type: 'feedback',
      clientName: app.clientName,
      salonName: settings.name,
      serviceName: app.serviceName,
      serviceNames: app.serviceNames,
      date: app.date,
      time: app.time,
      price: app.price,
      address: settings.address,
      city: settings.city,
      staffName: app.staffName,
      googleReviewLink: settings.googleReviewLink,
    });

    openWhatsAppLink(app.clientPhone, text);

    if (!sentFeedbackIds.includes(app.id)) {
      setSentFeedbackIds((prev) => [...prev, app.id]);
    }

    if (onShowToast) {
      onShowToast(`Richiesta recensione inviata a ${app.clientName}!`);
    }
  };

  // Copy text helper
  const handleCopyText = (text: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div
        className="bg-white rounded-3xl shadow-2xl border border-pink-100 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-pink-50 via-purple-50 to-white border-b border-pink-100 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#E95F8F] to-[#8B5CF6] text-white flex items-center justify-center shadow-md shadow-pink-500/20 shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-[#1E1B2E]">
                  Centro Promemoria & Messaggi Rapidi
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  WhatsApp Live
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#8B5CF6]" />
                <span>
                  Domani: <strong className="text-slate-700">{formatItalianDate(tomorrowStr)}</strong>
                </span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-white rounded-xl transition cursor-pointer"
            title="Chiudi pannello"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-4 sm:px-5 pt-3 bg-white border-b border-slate-100 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('tomorrow')}
              className={`px-3.5 py-2 rounded-t-xl text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition cursor-pointer ${
                activeTab === 'tomorrow'
                  ? 'border-[#8B5CF6] text-[#8B5CF6] bg-purple-50/40'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Promemoria di Domani</span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-black ${
                  activeTab === 'tomorrow'
                    ? 'bg-[#8B5CF6] text-white'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {tomorrowAppointments.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('reviews')}
              className={`px-3.5 py-2 rounded-t-xl text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition cursor-pointer ${
                activeTab === 'reviews'
                  ? 'border-amber-500 text-amber-700 bg-amber-50/40'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span>Richiedi Recensione (Oggi)</span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-black ${
                  activeTab === 'reviews'
                    ? 'bg-amber-500 text-white'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {todayCompletedAppointments.length}
              </span>
            </button>
          </div>

          {/* Quick info */}
          <div className="text-[11px] text-slate-500 pb-2 hidden sm:block">
            {activeTab === 'tomorrow' ? (
              <span>Template: <strong>Promemoria Giorno Prima</strong></span>
            ) : (
              <span>Template: <strong>Feedback & Recensione Google</strong></span>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/40">
          {/* TAB 1: TOMORROW'S REMINDERS */}
          {activeTab === 'tomorrow' && (
            <div className="space-y-4">
              {/* Progress and Summary Bar */}
              <div className="p-4 bg-white rounded-2xl border border-purple-100 shadow-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700">Avanzamento Promemoria:</span>
                    <span className="text-xs font-black text-[#8B5CF6]">
                      {sentTomorrowCount} su {totalTomorrowCount} inviati
                    </span>
                    <span className="text-[11px] text-slate-400">({progressPercentage}%)</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {sentTomorrowCount > 0 && (
                      <button
                        onClick={handleResetReminders}
                        className="text-[11px] font-semibold text-slate-500 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 px-2.5 py-1 rounded-lg border border-slate-200 hover:border-rose-200 transition flex items-center gap-1 cursor-pointer"
                        title="Azzera lo stato di invio per ripartire da capo"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reimposta stati</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress track */}
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#E95F8F] via-[#8B5CF6] to-emerald-500 transition-all duration-500 rounded-full"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>

                {progressPercentage === 100 && totalTomorrowCount > 0 && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Ottimo lavoro! Tutti i promemoria per domani sono stati contrassegnati come inviati.</span>
                  </div>
                )}
              </div>

              {/* Search & Filter Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cerca cliente, servizio o collaboratore..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-[#8B5CF6] outline-none"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl text-xs font-semibold">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-2.5 py-1 rounded-lg transition ${
                      statusFilter === 'all'
                        ? 'bg-[#8B5CF6] text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Tutti ({tomorrowAppointments.length})
                  </button>
                  <button
                    onClick={() => setStatusFilter('pending')}
                    className={`px-2.5 py-1 rounded-lg transition ${
                      statusFilter === 'pending'
                        ? 'bg-amber-500 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Da inviare ({tomorrowAppointments.length - sentTomorrowCount})
                  </button>
                  <button
                    onClick={() => setStatusFilter('sent')}
                    className={`px-2.5 py-1 rounded-lg transition ${
                      statusFilter === 'sent'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Inviati ({sentTomorrowCount})
                  </button>
                </div>
              </div>

              {/* Appointments List */}
              {filteredTomorrowList.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                    <Clock className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-700">Nessun appuntamento trovato</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    {tomorrowAppointments.length === 0
                      ? `Non ci sono appuntamenti in agenda per domani (${formatItalianDate(tomorrowStr)}).`
                      : 'Nessun appuntamento corrisponde ai filtri di ricerca selezionati.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredTomorrowList.map((app) => {
                    const isSent = sentReminderIds.includes(app.id);
                    const phoneInfo = sanitizePhoneNumber(app.clientPhone);
                    const isExpanded = expandedPreviewId === app.id;
                    const staffMember = settings.staffMembers?.find(
                      (s) => s.id === app.staffId || s.name.toLowerCase() === app.staffName?.toLowerCase()
                    );
                    const staffColor = getStaffColorConfig(staffMember?.color);

                    const reminderText = buildAppointmentMessage({
                      type: 'promemoria',
                      clientName: app.clientName,
                      salonName: settings.name,
                      serviceName: app.serviceName,
                      serviceNames: app.serviceNames,
                      date: app.date,
                      time: app.time,
                      price: app.price,
                      address: settings.address,
                      city: settings.city,
                      staffName: app.staffName,
                      googleReviewLink: settings.googleReviewLink,
                    });

                    return (
                      <div
                        key={app.id}
                        className={`p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 ${
                          isSent
                            ? 'bg-emerald-50/40 border-emerald-200/80 shadow-2xs'
                            : 'bg-white border-slate-200/80 hover:border-purple-200 shadow-xs'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          {/* Left: Time & Client details */}
                          <div className="flex items-start gap-3 min-w-0">
                            {/* Time Badge */}
                            <div className="w-14 text-center shrink-0">
                              <span className="block font-black text-base font-mono text-[#1E1B2E]">
                                {app.time}
                              </span>
                              <span className="text-[10px] text-slate-500 font-medium">
                                {app.durationMinutes} min
                              </span>
                            </div>

                            <div
                              className={`w-1 self-stretch rounded-full shrink-0 ${
                                isSent ? 'bg-emerald-500' : 'bg-gradient-to-b from-[#E95F8F] to-[#8B5CF6]'
                              }`}
                            />

                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-bold text-sm text-[#1E1B2E] truncate">
                                  {app.clientName}
                                </h4>

                                {/* Sent Badge */}
                                {isSent ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                                    Promemoria Inviato
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                    <Clock className="w-3 h-3 text-amber-600" />
                                    Da inviare
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                                <span className="font-medium text-[#8B5CF6]">
                                  ✂️ {app.serviceNames?.length ? app.serviceNames.join(' + ') : app.serviceName}
                                </span>
                                <span className="font-mono text-slate-500 text-[11px]">
                                  {phoneInfo.formattedWithPlus || app.clientPhone}
                                </span>
                                {app.staffName && (
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${staffColor.bg} ${staffColor.text} ${staffColor.border} border`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${staffColor.dot}`} />
                                    {app.staffName}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right: Actions */}
                          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                            {/* Toggle preview button */}
                            <button
                              type="button"
                              onClick={() => setExpandedPreviewId(isExpanded ? null : app.id)}
                              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 transition flex items-center gap-1 cursor-pointer"
                              title="Visualizza anteprima messaggio"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span className="hidden md:inline">Anteprima</span>
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>

                            {/* Manual sent toggle */}
                            <button
                              type="button"
                              onClick={(e) => toggleReminderSentState(app.id, e)}
                              className={`p-1.5 rounded-xl border transition cursor-pointer ${
                                isSent
                                  ? 'bg-emerald-100 border-emerald-300 text-emerald-800 hover:bg-emerald-200'
                                  : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                              }`}
                              title={isSent ? 'Contrassegna come non inviato' : 'Contrassegna come inviato manualmente'}
                            >
                              <Check className="w-4 h-4" />
                            </button>

                            {/* Primary WhatsApp Action Button */}
                            <button
                              type="button"
                              onClick={() => handleSendReminder(app)}
                              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer ${
                                isSent
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                  : 'bg-[#8B5CF6] hover:bg-[#7c4ee4] text-white shadow-purple-500/20'
                              }`}
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>{isSent ? 'Reinvia WhatsApp' : 'Invia WhatsApp'}</span>
                              <ExternalLink className="w-3 h-3 opacity-70" />
                            </button>
                          </div>
                        </div>

                        {/* Collapsible Preview Box */}
                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t border-slate-200/80 animate-fadeIn">
                            <div className="p-3 bg-white rounded-xl border border-purple-200 text-xs text-slate-700 font-sans whitespace-pre-line relative shadow-2xs">
                              <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100 text-[10px] text-slate-400 font-semibold">
                                <span className="flex items-center gap-1 text-[#8B5CF6]">
                                  <Sparkles className="w-3 h-3" />
                                  Testo Promemoria WhatsApp (Template Ufficiale)
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => handleCopyText(reminderText, app.id, e)}
                                  className="flex items-center gap-1 text-purple-600 hover:text-purple-800 font-bold cursor-pointer"
                                >
                                  {copiedId === app.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                  <span>{copiedId === app.id ? 'Copiato' : 'Copia'}</span>
                                </button>
                              </div>
                              <p className="leading-relaxed">{reminderText}</p>
                              <div className="mt-2 pt-2 border-t border-slate-100 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => handleSendReminder(app)}
                                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                  Apri wa.me con questo testo
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TODAY'S REVIEWS */}
          {activeTab === 'reviews' && (
            <div className="space-y-4">
              {/* Informative Header Banner */}
              <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <Star className="w-5 h-5 fill-white" />
                </div>
                <div className="text-xs space-y-1">
                  <h4 className="font-bold text-amber-900 text-sm">
                    Richiedi Recensione a 5 Stelle ai Clienti di Oggi
                  </h4>
                  <p className="text-amber-800 leading-relaxed">
                    Questo elenco raccoglie tutti i clienti che hanno <strong>completato il trattamento oggi</strong> ({formatItalianDate(todayStr)}).
                    Invia loro un messaggio di ringraziamento con il link diretto alle recensioni Google del salone.
                  </p>
                  {settings.googleReviewLink ? (
                    <p className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1 pt-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Link Google attivo: <span className="font-mono underline">{settings.googleReviewLink}</span>
                    </p>
                  ) : (
                    <p className="text-[11px] text-rose-700 font-semibold flex items-center gap-1 pt-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Nessun link recensioni configurato. Inseriscilo nelle Impostazioni Salone per includerlo nel messaggio.
                    </p>
                  )}
                </div>
              </div>

              {/* Completed Appointments List */}
              {todayCompletedAppointments.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
                  <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-500 mx-auto flex items-center justify-center">
                    <Star className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-700">Nessun appuntamento completato oggi</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Appena contrassegni un appuntamento di oggi come <strong>"Completato / Fatto & Pagato"</strong>, comparirà qui pronto per la richiesta di recensione.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {todayCompletedAppointments.map((app) => {
                    const isSent = sentFeedbackIds.includes(app.id);
                    const phoneInfo = sanitizePhoneNumber(app.clientPhone);
                    const isExpanded = expandedPreviewId === `rev-${app.id}`;
                    const staffMember = settings.staffMembers?.find(
                      (s) => s.id === app.staffId || s.name.toLowerCase() === app.staffName?.toLowerCase()
                    );
                    const staffColor = getStaffColorConfig(staffMember?.color);

                    const feedbackText = buildAppointmentMessage({
                      type: 'feedback',
                      clientName: app.clientName,
                      salonName: settings.name,
                      serviceName: app.serviceName,
                      serviceNames: app.serviceNames,
                      date: app.date,
                      time: app.time,
                      price: app.price,
                      address: settings.address,
                      city: settings.city,
                      staffName: app.staffName,
                      googleReviewLink: settings.googleReviewLink,
                    });

                    return (
                      <div
                        key={app.id}
                        className={`p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 ${
                          isSent
                            ? 'bg-amber-50/40 border-amber-200 shadow-2xs'
                            : 'bg-white border-slate-200/80 hover:border-amber-200 shadow-xs'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="w-14 text-center shrink-0">
                              <span className="block font-black text-base font-mono text-[#1E1B2E]">
                                {app.time}
                              </span>
                              <span className="text-[10px] text-slate-500 font-medium">
                                Completato
                              </span>
                            </div>

                            <div className="w-1 self-stretch rounded-full bg-amber-500 shrink-0" />

                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-bold text-sm text-[#1E1B2E] truncate">
                                  {app.clientName}
                                </h4>

                                {isSent ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                                    Recensione Inviata
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                    <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                                    Da richiedere
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                                <span className="font-medium text-amber-700">
                                  {app.serviceNames?.length ? app.serviceNames.join(' + ') : app.serviceName}
                                </span>
                                <span className="font-mono text-slate-500 text-[11px]">
                                  {phoneInfo.formattedWithPlus || app.clientPhone}
                                </span>
                                {app.staffName && (
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${staffColor.bg} ${staffColor.text} ${staffColor.border} border`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${staffColor.dot}`} />
                                    {app.staffName}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                            <button
                              type="button"
                              onClick={() => setExpandedPreviewId(isExpanded ? null : `rev-${app.id}`)}
                              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 transition flex items-center gap-1 cursor-pointer"
                              title="Visualizza anteprima messaggio recensione"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span className="hidden md:inline">Anteprima</span>
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setSentFeedbackIds((prev) =>
                                  prev.includes(app.id)
                                    ? prev.filter((id) => id !== app.id)
                                    : [...prev, app.id]
                                );
                              }}
                              className={`p-1.5 rounded-xl border transition cursor-pointer ${
                                isSent
                                  ? 'bg-amber-100 border-amber-300 text-amber-800 hover:bg-amber-200'
                                  : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                              }`}
                              title={isSent ? 'Contrassegna come non inviato' : 'Contrassegna come inviato'}
                            >
                              <Check className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleSendFeedback(app)}
                              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>{isSent ? 'Reinvia Feedback' : 'Invia Recensione'}</span>
                              <ExternalLink className="w-3 h-3 opacity-70" />
                            </button>
                          </div>
                        </div>

                        {/* Collapsible Preview */}
                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t border-slate-200/80 animate-fadeIn">
                            <div className="p-3 bg-white rounded-xl border border-amber-200 text-xs text-slate-700 font-sans whitespace-pre-line relative shadow-2xs">
                              <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100 text-[10px] text-slate-400 font-semibold">
                                <span className="flex items-center gap-1 text-amber-700">
                                  <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                                  Testo Ringraziamento & Recensione
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => handleCopyText(feedbackText, `rev-${app.id}`, e)}
                                  className="flex items-center gap-1 text-amber-600 hover:text-amber-800 font-bold cursor-pointer"
                                >
                                  {copiedId === `rev-${app.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                  <span>{copiedId === `rev-${app.id}` ? 'Copiato' : 'Copia'}</span>
                                </button>
                              </div>
                              <p className="leading-relaxed">{feedbackText}</p>
                              <div className="mt-2 pt-2 border-t border-slate-100 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => handleSendFeedback(app)}
                                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                  Invia su WhatsApp
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Click diretto apre WhatsApp Web/Mobile con messaggio precompilato.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition cursor-pointer"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};
