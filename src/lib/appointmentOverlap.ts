/** Messaggio mostrato quando due appuntamenti dello stesso collaboratore si sovrappongono. */
export const APPOINTMENT_OVERLAP_MESSAGE =
  'Questo collaboratore ha già un appuntamento in quell\'orario';

export const APPOINTMENT_OVERLAP_CODE = 'APPOINTMENT_OVERLAP';

/**
 * Stati che liberano lo slot. Allineati ai valori dell'app
 * (Confermato, In corso, Completato, Annullato, No-Show) più varianti
 * italiane e inglesi che possono già essere in tabella.
 * Qualsiasi altro stato (confermato, in corso, completato, pagato, vuoto) occupa lo slot.
 */
const SLOT_FREE_STATUSES = new Set([
  'annullato',
  'cancellato',
  'cancelled',
  'canceled',
  'no-show',
  'no_show',
  'noshow',
  'no show',
]);

export function appointmentFreesSlot(status: string | null | undefined): boolean {
  return SLOT_FREE_STATUSES.has((status || '').trim().toLowerCase());
}

export class AppointmentOverlapError extends Error {
  readonly code = APPOINTMENT_OVERLAP_CODE;

  constructor() {
    super(APPOINTMENT_OVERLAP_MESSAGE);
    this.name = 'AppointmentOverlapError';
  }
}

export function isAppointmentOverlapError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof AppointmentOverlapError) return true;
  if (typeof error !== 'object') return false;
  const candidate = error as { message?: string; code?: string; details?: string | null; hint?: string | null };
  const blob = `${candidate.message || ''} ${candidate.details || ''} ${candidate.hint || ''}`;
  if (blob.includes(APPOINTMENT_OVERLAP_CODE)) return true;
  if (blob.includes(APPOINTMENT_OVERLAP_MESSAGE)) return true;
  if (blob.includes('appointments_no_double_booking')) return true;
  return false;
}

/** Minuti da mezzanotte. Ignora i secondi, come il controllo in database. */
export function clockToMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * Intervallo [start, end) in minuti.
 * Se end_time manca, oppure non è successivo a start_time (orario che supera la mezzanotte),
 * la fine è start_time + duration_minutes.
 */
export function appointmentMinuteRange(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  durationMinutes: number | null | undefined,
): { start: number; end: number } | null {
  const start = clockToMinutes(startTime);
  if (start === null) return null;
  const endClock = clockToMinutes(endTime);
  const parsedDuration = Number(durationMinutes);
  const duration = Number.isFinite(parsedDuration) ? Math.max(Math.trunc(parsedDuration), 0) : 0;
  const end = endClock !== null && endClock > start ? endClock : start + duration;
  return { start, end };
}

export interface AppointmentSlot {
  id?: string | null;
  staffId?: string | null;
  date?: string | null;
  time?: string | null;
  endTime?: string | null;
  durationMinutes?: number | null;
  status?: string | null;
}

function rangesEqual(
  left: { start: number; end: number } | null,
  right: { start: number; end: number } | null,
): boolean {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return left.start === right.start && left.end === right.end;
}

/** Lo slot (collaboratore, giorno, orario) non è cambiato. */
export function appointmentSlotUnchanged(before: AppointmentSlot, after: AppointmentSlot): boolean {
  return (before.staffId || null) === (after.staffId || null)
    && (before.date || null) === (after.date || null)
    && rangesEqual(
      appointmentMinuteRange(before.time, before.endTime, before.durationMinutes),
      appointmentMinuteRange(after.time, after.endTime, after.durationMinutes),
    );
}

/**
 * true se questo salvataggio occupa uno slot e va confrontato con gli altri appuntamenti.
 * Un aggiornamento che resta sullo stesso slot già occupato (note, incasso, completato)
 * non viene ribloccato: le sovrapposizioni già presenti restano modificabili.
 */
export function shouldEnforceSlot(before: AppointmentSlot | null, after: AppointmentSlot): boolean {
  if (appointmentFreesSlot(after.status)) return false;
  if (!after.staffId || !after.date || !after.time) return false;
  const range = appointmentMinuteRange(after.time, after.endTime, after.durationMinutes);
  if (!range || range.end <= range.start) return false;
  if (before && !appointmentFreesSlot(before.status) && appointmentSlotUnchanged(before, after)) {
    return false;
  }
  return true;
}

/** [start, end) si intersecano per lo stesso collaboratore e lo stesso giorno. Gli stati che liberano lo slot non contano. */
export function blocksSameSlot(candidate: AppointmentSlot, existing: AppointmentSlot): boolean {
  if (candidate.id && existing.id && candidate.id === existing.id) return false;
  if (!candidate.staffId || candidate.staffId !== existing.staffId) return false;
  if (!candidate.date || candidate.date !== existing.date) return false;
  if (appointmentFreesSlot(candidate.status) || appointmentFreesSlot(existing.status)) return false;
  const left = appointmentMinuteRange(candidate.time, candidate.endTime, candidate.durationMinutes);
  const right = appointmentMinuteRange(existing.time, existing.endTime, existing.durationMinutes);
  if (!left || !right || left.end <= left.start || right.end <= right.start) return false;
  return left.start < right.end && right.start < left.end;
}
