/**
 * Testo dell'email di promemoria. Nessun segreto e nessun import Deno,
 * così lo stesso file è usato dalla Edge Function e dal typecheck dell'app.
 *
 * Regola di invio (la applica il database, non il client):
 * una sola email circa 24 ore prima, fuso Europe/Rome.
 * La finestra è 22–26 ore prima dell'orario locale del salone.
 * Non si invia se la prenotazione è stata creata o spostata a meno di 26 ore
 * dall'appuntamento, né se manca l'email, né se lo stato è annullato o no-show.
 */

export const AUTOMATIC_REMINDER_COPY = {
  title: 'Promemoria automatici',
  summary:
    'Un’email al cliente circa 24 ore prima, con il nome del salone, la data, l’ora e il servizio. Se il cliente non ha un’email, il promemoria viene saltato e la prenotazione resta valida.',
  detail:
    'Disponibile nel piano PRO mensile, nel piano PRO annuale e durante la prova gratuita. L’email parte una sola volta. Non viene inviata per appuntamenti annullati o no-show, e nemmeno se la prenotazione è stata creata o spostata a meno di 26 ore dalla visita. WhatsApp resta l’invio manuale.',
  locked:
    'I promemoria automatici via email, circa 24 ore prima dell’appuntamento, sono nel piano PRO.',
  manualNote:
    'Email automatica attiva: i clienti con un indirizzo email ricevono il promemoria circa 24 ore prima. Qui resta l’invio manuale su WhatsApp.',
} as const;

export interface ReminderEmailInput {
  clientName: string;
  salonName: string;
  appointmentDate: string;
  appointmentTime: string;
  serviceNames?: string | null;
  staffName?: string | null;
  address?: string | null;
  city?: string | null;
}

export interface ReminderEmailContent {
  subject: string;
  text: string;
  html: string;
}

const WEEKDAYS = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const MONTHS = [
  'gennaio',
  'febbraio',
  'marzo',
  'aprile',
  'maggio',
  'giugno',
  'luglio',
  'agosto',
  'settembre',
  'ottobre',
  'novembre',
  'dicembre',
];

function clean(value: string | null | undefined): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatReminderDate(dateStr: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr.trim());
  if (!match) return clean(dateStr) || 'il giorno concordato';
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return `${day} ${MONTHS[month - 1] || ''} ${year}`.trim();
  }
  const weekday = WEEKDAYS[date.getDay()] || '';
  const monthName = MONTHS[month - 1] || '';
  return `${weekday} ${day} ${monthName} ${year}`.trim();
}

export function formatReminderTime(timeStr: string): string {
  const match = /^(\d{1,2}):(\d{2})/.exec(timeStr.trim());
  if (!match) return clean(timeStr);
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function displayStaff(name: string | null | undefined): string {
  const value = clean(name);
  if (!value || value.toLowerCase() === 'staff') return '';
  return value;
}

export function buildReminderEmail(input: ReminderEmailInput): ReminderEmailContent {
  const clientName = clean(input.clientName) || 'cliente';
  const salonName = clean(input.salonName) || 'il salone';
  const dateLabel = formatReminderDate(input.appointmentDate || '');
  const timeLabel = formatReminderTime(input.appointmentTime || '');
  const service = clean(input.serviceNames);
  const staff = displayStaff(input.staffName);
  const location = [clean(input.address), clean(input.city)].filter(Boolean).join(', ');

  const subject = `Promemoria appuntamento — ${salonName}`.replace(/[\r\n]+/g, ' ').slice(0, 180);

  const textLines = [
    `Gentile ${clientName},`,
    '',
    `ti ricordiamo il tuo appuntamento presso ${salonName}.`,
    '',
    `Data: ${dateLabel}`,
    timeLabel ? `Ora: ${timeLabel}` : '',
    service ? `Servizio: ${service}` : '',
    staff ? `Con: ${staff}` : '',
    location ? `Dove: ${location}` : '',
    '',
    'Se non puoi venire, avvisa il salone con un po’ di anticipo.',
    '',
    'A presto,',
    salonName,
  ].filter((line) => line !== '');

  const detailRows = [
    ['Data', dateLabel],
    timeLabel ? ['Ora', timeLabel] : null,
    service ? ['Servizio', service] : null,
    staff ? ['Con', staff] : null,
    location ? ['Dove', location] : null,
  ].filter((row): row is [string, string] => row !== null);

  const rowsHtml = detailRows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 12px 4px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#64748b;white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1E1B2E;font-weight:600;">${escapeHtml(value)}</td></tr>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="it">
<body style="margin:0;padding:0;background:#FDF8FA;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FDF8FA;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #f3d5e3;border-radius:16px;overflow:hidden;">
          <tr><td style="height:6px;background:#E95F8F;font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr>
            <td style="padding:28px 28px 0;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.3;color:#1E1B2E;">${escapeHtml(salonName)}</td>
          </tr>
          <tr>
            <td style="padding:14px 28px 8px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#334155;">
              Gentile ${escapeHtml(clientName)},<br><br>
              ti ricordiamo il tuo appuntamento.
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FDF8FA;border-radius:12px;">
                <tr><td style="padding:14px 16px;">
                  <table role="presentation" cellpadding="0" cellspacing="0">${rowsHtml}</table>
                </td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#475569;">
              Se non puoi venire, avvisa il salone con un po’ di anticipo.<br><br>
              A presto,<br>${escapeHtml(salonName)}
            </td>
          </tr>
        </table>
        <p style="max-width:560px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.4;color:#94a3b8;margin:14px 0 0;">
          Messaggio automatico inviato per conto di ${escapeHtml(salonName)}.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text: textLines.join('\n'), html };
}
