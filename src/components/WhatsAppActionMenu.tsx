import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  CheckCircle2,
  Bell,
  Star,
  ChevronDown,
  X,
  ExternalLink,
  Sparkles,
  Eye,
  Copy,
  Check
} from 'lucide-react';
import { Appointment, SalonSettings, WhatsAppMessageType } from '../types';
import {
  sanitizePhoneNumber,
  buildAppointmentMessage,
  openWhatsAppLink,
  WHATSAPP_TEMPLATES_CONFIG
} from '../utils/whatsapp';

interface WhatsAppActionMenuProps {
  appointment: Appointment;
  settings: SalonSettings;
  compact?: boolean;
  buttonClassName?: string;
  onSent?: (templateType: WhatsAppMessageType, clientName: string) => void;
}

export const WhatsAppActionMenu: React.FC<WhatsAppActionMenuProps> = ({
  appointment,
  settings,
  compact = false,
  buttonClassName,
  onSent,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<WhatsAppMessageType | null>(null);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setPreviewTemplate(null);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const phoneInfo = sanitizePhoneNumber(appointment.clientPhone);

  const handleSend = (type: WhatsAppMessageType) => {
    const text = buildAppointmentMessage({
      type,
      clientName: appointment.clientName,
      salonName: settings.name,
      serviceName: appointment.serviceName,
      serviceNames: appointment.serviceNames,
      date: appointment.date,
      time: appointment.time,
      price: appointment.price,
      address: settings.address,
      city: settings.city,
      staffName: appointment.staffName,
      googleReviewLink: settings.googleReviewLink,
    });

    openWhatsAppLink(appointment.clientPhone, text);
    setIsOpen(false);
    setPreviewTemplate(null);

    if (onSent) {
      onSent(type, appointment.clientName);
    }
  };

  const getPreviewText = (type: WhatsAppMessageType) => {
    return buildAppointmentMessage({
      type,
      clientName: appointment.clientName,
      salonName: settings.name,
      serviceName: appointment.serviceName,
      serviceNames: appointment.serviceNames,
      date: appointment.date,
      time: appointment.time,
      price: appointment.price,
      address: settings.address,
      city: settings.city,
      staffName: appointment.staffName,
      googleReviewLink: settings.googleReviewLink,
    });
  };

  const handleCopyPreview = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isCompleted = appointment.status === 'Completato';

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      {/* Trigger Button */}
      {compact ? (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          title="Opzioni WhatsApp con Template"
          className={
            buttonClassName ||
            'p-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition cursor-pointer flex items-center justify-center'
          }
        >
          <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={
            buttonClassName ||
            'px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs'
          }
        >
          <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
          <span>WhatsApp</span>
          <ChevronDown className={`w-3 h-3 text-emerald-600 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      )}

      {/* Dropdown Menu Popover */}
      {isOpen && (
        <div
          className="absolute right-0 mt-1.5 w-80 sm:w-88 bg-white rounded-2xl shadow-xl border border-emerald-100/80 divide-y divide-slate-100 z-50 animate-fadeIn overflow-hidden"
          style={{ minWidth: '290px' }}
        >
          {/* Header */}
          <div className="p-3 bg-gradient-to-r from-emerald-50/80 via-teal-50/40 to-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-slate-800 truncate">
                  Messaggio a {appointment.clientName}
                </h4>
                <p className="text-[10px] text-slate-500 font-mono">
                  {phoneInfo.formattedWithPlus || appointment.clientPhone}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setPreviewTemplate(null);
              }}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-white/60 transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Templates list */}
          <div className="p-2 space-y-1.5 max-h-[380px] overflow-y-auto">
            {/* Template 1: Conferma */}
            <div
              className={`p-2.5 rounded-xl border transition-all cursor-pointer group ${
                previewTemplate === 'conferma'
                  ? 'bg-emerald-50/70 border-emerald-300'
                  : 'bg-white hover:bg-slate-50/80 border-slate-100'
              }`}
              onClick={() => handleSend('conferma')}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-700 transition">
                        Invia Conferma Appuntamento
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Riepilogo data ({appointment.date}), orario ({appointment.time}) e servizi.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewTemplate(previewTemplate === 'conferma' ? null : 'conferma');
                    }}
                    title="Visualizza anteprima testo"
                    className="p-1 text-slate-400 hover:text-emerald-600 rounded hover:bg-emerald-50 transition"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition" />
                </div>
              </div>

              {/* Expandable Preview */}
              {previewTemplate === 'conferma' && (
                <div
                  className="mt-2.5 p-2 bg-white rounded-lg border border-emerald-200 text-[11px] text-slate-700 font-sans whitespace-pre-line relative"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold mb-1 pb-1 border-b border-slate-100">
                    <span>Anteprima Messaggio</span>
                    <button
                      type="button"
                      onClick={() => handleCopyPreview(getPreviewText('conferma'))}
                      className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-medium"
                    >
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copied ? 'Copiato' : 'Copia'}</span>
                    </button>
                  </div>
                  {getPreviewText('conferma')}
                  <div className="mt-2 pt-1 border-t border-slate-100 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleSend('conferma')}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold flex items-center gap-1"
                    >
                      <MessageSquare className="w-3 h-3" />
                      Invia su WhatsApp
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Template 2: Promemoria (Giorno prima) */}
            <div
              className={`p-2.5 rounded-xl border transition-all cursor-pointer group ${
                previewTemplate === 'promemoria'
                  ? 'bg-blue-50/70 border-blue-300'
                  : 'bg-white hover:bg-slate-50/80 border-slate-100'
              }`}
              onClick={() => handleSend('promemoria')}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-slate-800 group-hover:text-blue-700 transition">
                        Invia Promemoria (Giorno Prima)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Ricorda l'orario e include la richiesta di disdetta con anticipo.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewTemplate(previewTemplate === 'promemoria' ? null : 'promemoria');
                    }}
                    title="Visualizza anteprima testo"
                    className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-blue-50 transition"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition" />
                </div>
              </div>

              {/* Expandable Preview */}
              {previewTemplate === 'promemoria' && (
                <div
                  className="mt-2.5 p-2 bg-white rounded-lg border border-blue-200 text-[11px] text-slate-700 font-sans whitespace-pre-line relative"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold mb-1 pb-1 border-b border-slate-100">
                    <span>Anteprima Messaggio</span>
                    <button
                      type="button"
                      onClick={() => handleCopyPreview(getPreviewText('promemoria'))}
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
                    >
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copied ? 'Copiato' : 'Copia'}</span>
                    </button>
                  </div>
                  {getPreviewText('promemoria')}
                  <div className="mt-2 pt-1 border-t border-slate-100 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleSend('promemoria')}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold flex items-center gap-1"
                    >
                      <MessageSquare className="w-3 h-3" />
                      Invia su WhatsApp
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Template 3: Feedback & Recensione Google */}
            <div
              className={`p-2.5 rounded-xl border transition-all cursor-pointer group ${
                isCompleted
                  ? 'bg-amber-50/50 border-amber-300 ring-1 ring-amber-200'
                  : previewTemplate === 'feedback'
                  ? 'bg-amber-50/70 border-amber-300'
                  : 'bg-white hover:bg-slate-50/80 border-slate-100'
              }`}
              onClick={() => handleSend('feedback')}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-slate-800 group-hover:text-amber-700 transition">
                        Invia Ringraziamento & Recensione
                      </span>
                      {isCompleted && (
                        <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-0.5">
                          <Sparkles className="w-2.5 h-2.5" /> Consigliato
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {settings.googleReviewLink
                        ? 'Include ringraziamento e link recensioni Google.'
                        : 'Messaggio post-trattamento (senza link recensioni impostato).'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewTemplate(previewTemplate === 'feedback' ? null : 'feedback');
                    }}
                    title="Visualizza anteprima testo"
                    className="p-1 text-slate-400 hover:text-amber-600 rounded hover:bg-amber-50 transition"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-600 transition" />
                </div>
              </div>

              {/* Expandable Preview */}
              {previewTemplate === 'feedback' && (
                <div
                  className="mt-2.5 p-2 bg-white rounded-lg border border-amber-200 text-[11px] text-slate-700 font-sans whitespace-pre-line relative"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold mb-1 pb-1 border-b border-slate-100">
                    <span>Anteprima Messaggio</span>
                    <button
                      type="button"
                      onClick={() => handleCopyPreview(getPreviewText('feedback'))}
                      className="flex items-center gap-1 text-amber-600 hover:text-amber-700 font-medium"
                    >
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copied ? 'Copiato' : 'Copia'}</span>
                    </button>
                  </div>
                  {getPreviewText('feedback')}
                  <div className="mt-2 pt-1 border-t border-slate-100 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleSend('feedback')}
                      className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-bold flex items-center gap-1"
                    >
                      <MessageSquare className="w-3 h-3" />
                      Invia su WhatsApp
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer note */}
          <div className="p-2.5 bg-slate-50/80 text-[10px] text-slate-500 flex items-center justify-between">
            <span>Click diretto apre WhatsApp con il testo formattato</span>
            {settings.googleReviewLink && (
              <span className="text-amber-700 font-semibold flex items-center gap-0.5">
                <Star className="w-3 h-3 fill-amber-500 text-amber-500" /> Link Google attivo
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
