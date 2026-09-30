/**
 * Utility per la gestione delle date dinamiche nel salone
 * Basate sull'orario locale effettivo del browser
 */

/**
 * Restituisce la data odierna in formato YYYY-MM-DD (fuso orario locale del client)
 */
export function getTodayStr(): string {
  const now = new Date();
  return formatDateToISO(now);
}

/**
 * Restituisce la data di domani in formato YYYY-MM-DD
 */
export function getTomorrowStr(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return formatDateToISO(date);
}

/**
 * Restituisce la data spostata di N giorni (positivi o negativi) rispetto a una data base o ad oggi
 */
export function getDateOffsetStr(days: number, baseDateStr?: string): string {
  let base: Date;
  if (baseDateStr) {
    const [y, m, d] = baseDateStr.split('-').map(Number);
    base = new Date(y, m - 1, d);
  } else {
    base = new Date();
  }
  base.setDate(base.getDate() + days);
  return formatDateToISO(base);
}

/**
 * Converte un oggetto Date in stringa YYYY-MM-DD locale
 */
export function formatDateToISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const ITALIAN_WEEKDAYS = [
  'Domenica',
  'Lunedì',
  'Martedì',
  'Mercoledì',
  'Giovedì',
  'Venerdì',
  'Sabato'
];

const ITALIAN_MONTHS = [
  'Gennaio',
  'Febbraio',
  'Marzo',
  'Aprile',
  'Maggio',
  'Giugno',
  'Luglio',
  'Agosto',
  'Settembre',
  'Ottobre',
  'Novembre',
  'Dicembre'
];

/**
 * Formatta una data YYYY-MM-DD in italiano elegante
 * Esempio: formatDisplayDate("2026-09-19") => "Sabato 19 Settembre 2026"
 */
export function formatDisplayDate(
  dateStr: string,
  options: { withWeekday?: boolean; includeYear?: boolean } = { withWeekday: true, includeYear: true }
): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;

  const dateObj = new Date(y, m - 1, d);
  const weekday = ITALIAN_WEEKDAYS[dateObj.getDay()];
  const day = d;
  const monthName = ITALIAN_MONTHS[m - 1] || '';
  const year = y;

  const parts: string[] = [];
  if (options.withWeekday !== false) {
    parts.push(weekday);
  }
  parts.push(`${day} ${monthName}`);
  if (options.includeYear !== false) {
    parts.push(String(year));
  }

  if (options.withWeekday !== false) {
    return `${weekday} ${day} ${monthName}${options.includeYear !== false ? ` ${year}` : ''}`;
  }
  return `${day} ${monthName}${options.includeYear !== false ? ` ${year}` : ''}`;
}

/**
 * Restituisce un'etichetta amichevole per una data (Oggi, Domani, Ieri oppure data formattata)
 */
export function getFriendlyDateLabel(dateStr: string): string {
  const today = getTodayStr();
  const tomorrow = getTomorrowStr();
  const yesterday = getDateOffsetStr(-1);

  if (dateStr === today) return 'Oggi';
  if (dateStr === tomorrow) return 'Domani';
  if (dateStr === yesterday) return 'Ieri';

  return formatDisplayDate(dateStr, { withWeekday: false, includeYear: false });
}
