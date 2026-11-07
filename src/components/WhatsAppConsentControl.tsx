import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { isValidUUID } from '../lib/salonService';
import { maskPhone, normalizeWhatsAppPhone } from '../lib/whatsappCloud';

interface WhatsAppConsentControlProps {
  clientId: string;
  phone: string;
  canManage: boolean;
  grantLocked: boolean;
  onUpgrade?: () => void;
  onShowToast: (message: string) => void;
}

type ConsentRow = {
  action: 'granted' | 'revoked';
  consented_phone: string;
  source: string;
  created_at: string;
};

export const WhatsAppConsentControl: React.FC<WhatsAppConsentControlProps> = ({
  clientId,
  phone,
  canManage,
  grantLocked,
  onUpgrade,
  onShowToast,
}) => {
  const [latest, setLatest] = useState<ConsentRow | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [source, setSource] = useState('');
  const [saving, setSaving] = useState(false);
  const normalized = normalizeWhatsAppPhone(phone);

  useEffect(() => {
    setConfirmed(false);
    setSource('');
    if (!isValidUUID(clientId)) {
      setLatest(null);
      setLoaded(true);
      return;
    }
    let cancelled = false;
    setLoaded(false);
    void supabase
      .from('whatsapp_consent_events')
      .select('action, consented_phone, source, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setLatest(null);
        } else {
          const row = data?.[0] as ConsentRow | undefined;
          setLatest(row?.action === 'granted' || row?.action === 'revoked' ? row : null);
        }
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const record = async (action: 'granted' | 'revoked') => {
    const note = source.trim();
    if (action === 'granted' && !confirmed) {
      onShowToast('Spunta la conferma del consenso prima di salvarlo.');
      return;
    }
    if (note.length < 3) {
      onShowToast('Scrivi dove è stato raccolto il consenso.');
      return;
    }
    if (!isValidUUID(clientId)) {
      onShowToast('Il consenso si registra solo sui clienti salvati nel database.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc('nuvia_record_whatsapp_consent', {
      p_client_id: clientId,
      p_action: action,
      p_source: note,
    });
    setSaving(false);
    if (error) {
      const message = error.message || '';
      if (/REMINDER_PLAN_LOCKED|Disponibile nel piano PRO/i.test(message)) {
        onShowToast('Disponibile nel piano PRO');
        return;
      }
      if (/WHATSAPP_PHONE_INVALID/i.test(message)) {
        onShowToast('Numero non valido per WhatsApp.');
        return;
      }
      if (/Permesso negato/i.test(message)) {
        onShowToast('Solo titolare e admin possono registrare il consenso.');
        return;
      }
      onShowToast('Consenso non registrato. Controlla la migration WhatsApp.');
      return;
    }
    setLatest({
      action,
      consented_phone: normalized || '',
      source: note,
      created_at: new Date().toISOString(),
    });
    setConfirmed(false);
    setSource('');
    onShowToast(action === 'granted' ? 'Consenso WhatsApp registrato.' : 'Consenso WhatsApp revocato.');
  };

  const active = latest?.action === 'granted' && latest.consented_phone === normalized;

  return (
    <div className="rounded-2xl border border-emerald-100 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold text-[#1E1B2E]">Consenso WhatsApp</h4>
          <p className="text-sm text-slate-600 mt-1">
            Nessun cliente è già autorizzato. Il consenso vale solo per il numero attuale
            {normalized ? ` (${maskPhone(normalized)})` : ''}. Il messaggio manuale con wa.me non cambia.
          </p>
        </div>
      </div>

      {!loaded ? (
        <p className="text-sm text-slate-500">Lettura consenso…</p>
      ) : active ? (
        <p className="text-sm text-emerald-800">Consenso attivo per {maskPhone(latest?.consented_phone)}.</p>
      ) : latest?.action === 'revoked' ? (
        <p className="text-sm text-slate-600">Consenso revocato. Non parte nessun promemoria automatico.</p>
      ) : (
        <p className="text-sm text-slate-600">Nessun consenso registrato.</p>
      )}

      {canManage && (
        <div className="space-y-2">
          {grantLocked ? (
            <button type="button" onClick={onUpgrade} className="text-sm font-semibold text-[#8B5CF6]">
              Disponibile nel piano PRO
            </button>
          ) : (
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                className="mt-1"
              />
              <span>Il cliente accetta di ricevere promemoria di appuntamento su WhatsApp da Nuvia per conto di questo salone.</span>
            </label>
          )}
          <input
            type="text"
            value={source}
            onChange={(event) => setSource(event.target.value)}
            placeholder="Fonte, es. chiesto in salone oggi"
            maxLength={200}
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
          />
          <div className="flex flex-wrap gap-2">
            {!grantLocked && (
              <button
                type="button"
                disabled={saving || !confirmed || source.trim().length < 3}
                onClick={() => void record('granted')}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white disabled:opacity-50"
              >
                Registra consenso
              </button>
            )}
            <button
              type="button"
              disabled={saving || source.trim().length < 3}
              onClick={() => void record('revoked')}
              className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-700 disabled:opacity-50"
            >
              Revoca consenso
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
