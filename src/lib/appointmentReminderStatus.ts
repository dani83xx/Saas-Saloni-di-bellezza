import type { Appointment, AppointmentStatus } from '../types';

const ROME = 'Europe/Rome';

/** Stati per cui il cron può ancora inviare. Gli altri non mostrano "non ancora inviato". */
const PENDING_STATUSES = new Set<AppointmentStatus>(['Confermato', 'In corso']);

export interface AppointmentReminderView {
  kind: 'sent' | 'pending';
  /** Frase completa, in italiano. */
  text: string;
  /** Etichetta corta per il badge in agenda. */
  badge: string;
}

type ReminderAppointment = Pick<
  Appointment,
  'reminderSentAt' | 'reminderEmail' | 'date' | 'time' | 'status'
>;

function padHour(value: string): string {
  return value === '24' ? '00' : value;
}

/** Data e ora di adesso nel fuso del salone, confrontabili con data e ora dell'appuntamento. */
export function romeWallClock(now: Date = new Date()): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: ROME,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return {
    date: `${pick('year')}-${pick('month')}-${pick('day')}`,
    time: `${padHour(pick('hour'))}:${pick('minute')}`,
  };
}

/** L'orario in agenda è locale Europe/Rome, non UTC. */
export function isAppointmentInFuture(date: string, time: string, now: Date = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const match = /^(\d{1,2}):(\d{2})/.exec((time || '').trim());
  if (!match) return false;
  const clock = `${date}T${match[1].padStart(2, '0')}:${match[2]}`;
  const rome = romeWallClock(now);
  return clock > `${rome.date}T${rome.time}`;
}

/** Es. "15 novembre 2026 alle 14:30", sempre in Europe/Rome. */
export function formatReminderSentAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const day = new Intl.DateTimeFormat('it-IT', {
    timeZone: ROME,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
  const timeParts = new Intl.DateTimeFormat('it-IT', {
    timeZone: ROME,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    timeParts.find((part) => part.type === type)?.value ?? '';
  const time = `${padHour(pick('hour'))}:${pick('minute')}`;
  if (!day || time === ':') return '';
  return `${day} alle ${time}`;
}

export function describeAppointmentReminder(
  appointment: ReminderAppointment,
  autoReminders: boolean,
  now: Date = new Date(),
): AppointmentReminderView | null {
  const sentAt = appointment.reminderSentAt?.trim() || '';
  if (sentAt) {
    const when = formatReminderSentAt(sentAt);
    const email = appointment.reminderEmail?.trim() || '';
    let text = 'Email promemoria inviata';
    if (when && email) text = `Email promemoria inviata il ${when} a ${email}`;
    else if (when) text = `Email promemoria inviata il ${when}`;
    else if (email) text = `Email promemoria inviata a ${email}`;
    return { kind: 'sent', text, badge: 'Email inviata' };
  }

  if (!autoReminders) return null;
  if (!PENDING_STATUSES.has(appointment.status)) return null;
  if (!isAppointmentInFuture(appointment.date, appointment.time, now)) return null;
  return {
    kind: 'pending',
    text: 'Promemoria email non ancora inviato',
    badge: 'Non ancora inviata',
  };
}
