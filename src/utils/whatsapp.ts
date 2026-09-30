import type { WhatsAppMessageType } from '../types';

export type { WhatsAppMessageType };

/**
 * Utility functions for sanitizing Italian and international phone numbers
 * and generating compliant WhatsApp Click-to-Chat URLs.
 */

export interface PhoneNormalizationResult {
  raw: string;
  digitsOnly: string;
  waNumber: string;          // Formatted for wa.me URL (digits only, e.g. 393401234567)
  formattedWithPlus: string; // Formatted with international plus (e.g. +393401234567)
  isValid: boolean;
}

/**
 * Cleans phone number by removing spaces, dashes, parentheses, dots and any special characters.
 * Prepends international country code '+39' if not already present.
 */
export function sanitizePhoneNumber(phone: string): PhoneNormalizationResult {
  if (!phone || typeof phone !== 'string') {
    return {
      raw: '',
      digitsOnly: '',
      waNumber: '',
      formattedWithPlus: '',
      isValid: false,
    };
  }

  const trimmed = phone.trim();
  const hasPlus = trimmed.startsWith('+');

  // Remove all non-digit characters (removes spaces, dashes, slashes, brackets, etc.)
  let digits = trimmed.replace(/\D/g, '');

  if (!digits) {
    return {
      raw: phone,
      digitsOnly: '',
      waNumber: '',
      formattedWithPlus: '',
      isValid: false,
    };
  }

  // Handle leading 00 (e.g., 0039 -> 39)
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  let finalDigits = digits;

  if (hasPlus) {
    // Already had international '+' prefix, keep extracted digits as-is
    finalDigits = digits;
  } else {
    // No '+' prefix provided:
    // Check if country code 39 is already present at the start of a full-length number.
    // Italian numbers are typically 9-10 digits without prefix.
    // With country code 39, they are 11-12 digits.
    const alreadyHasCountryCode = digits.startsWith('39') && digits.length >= 11;

    if (!alreadyHasCountryCode) {
      // Prepend Italy country code '39'
      finalDigits = '39' + digits;
    }
  }

  return {
    raw: phone,
    digitsOnly: digits,
    waNumber: finalDigits,
    formattedWithPlus: `+${finalDigits}`,
    isValid: finalDigits.length >= 8,
  };
}

/**
 * Generates a compliant WhatsApp Click-to-Chat URL (https://wa.me/...).
 * Sanitizes phone number, prepends '+39' if absent,
 * and encodes the message using encodeURIComponent to safely handle accents, special characters, and newlines.
 */
export function generateWhatsAppLink(phone: string, message: string): string {
  const { waNumber } = sanitizePhoneNumber(phone);
  const encodedText = encodeURIComponent(message || '');
  return `https://wa.me/${waNumber}?text=${encodedText}`;
}

/**
 * Opens WhatsApp in a new browser tab or native app with proper security attributes.
 */
export function openWhatsAppLink(phone: string, message: string): void {
  const url = generateWhatsAppLink(phone, message);
  window.open(url, '_blank', 'noopener,noreferrer');
}

export interface BuildAppointmentMessageOptions {
  type?: WhatsAppMessageType;
  clientName: string;
  salonName: string;
  serviceName?: string;
  serviceNames?: string[];
  date?: string;
  time?: string;
  price?: number;
  address?: string;
  city?: string;
  staffName?: string;
  googleReviewLink?: string;
}

export interface WhatsAppTemplateConfig {
  id: WhatsAppMessageType;
  title: string;
  description: string;
  recommendedStatus?: 'Confermato' | 'Completato';
  badgeLabel: string;
}

export const WHATSAPP_TEMPLATES_CONFIG: WhatsAppTemplateConfig[] = [
  {
    id: 'conferma',
    title: 'Invia Conferma Appuntamento',
    description: 'Inviato al momento della prenotazione con riepilogo data, ora e servizi.',
    badgeLabel: 'Conferma',
  },
  {
    id: 'promemoria',
    title: 'Invia Promemoria (Giorno Prima)',
    description: 'Promemoria anticipato con richiesta di eventuale disdetta con preavviso.',
    badgeLabel: 'Promemoria',
  },
  {
    id: 'feedback',
    title: 'Invia Ringraziamento & Recensione',
    description: 'Inviato dopo il trattamento con link per recensione Google.',
    recommendedStatus: 'Completato',
    badgeLabel: 'Feedback Google',
  },
];

/**
 * Builds a polite, professionally formatted salon message supporting 3 templates:
 * 1. 'conferma': sent at booking time.
 * 2. 'promemoria': reminder sent day before or hours before.
 * 3. 'feedback': post-treatment review request with Google link.
 */
export function buildAppointmentMessage(options: BuildAppointmentMessageOptions): string {
  const {
    type = 'conferma',
    clientName,
    salonName,
    serviceName,
    serviceNames,
    date,
    time,
    address,
    city,
    staffName,
    googleReviewLink,
  } = options;

  const servicesText =
    serviceNames && serviceNames.length > 0
      ? serviceNames.join(' + ')
      : serviceName || 'il tuo trattamento';

  const locationText = [address, city].filter(Boolean).join(', ');
  const dateText = date ? date : 'il giorno concordato';

  // Template 1: Conferma Prenotazione
  if (type === 'conferma') {
    const lines = [
      `Ciao ${clientName}, ti confermiamo l'appuntamento per ${servicesText} il ${dateText}${time ? ` alle ore ${time}` : ''} presso ${salonName}${locationText ? ` in ${locationText}` : ''}.`,
      staffName ? `Professionista assegnato: ${staffName}.` : '',
      `A presto! ✨`,
    ].filter(Boolean);

    return lines.join('\n');
  }

  // Template 2: Promemoria (Giorno prima o ore prima)
  if (type === 'promemoria') {
    const lines = [
      `Gentile ${clientName}, ti ricordiamo il tuo appuntamento di ${date ? `il ${date}` : 'domani'}${time ? ` alle ore ${time}` : ''} per ${servicesText} presso ${salonName}${locationText ? ` in ${locationText}` : ''}.`,
      staffName ? `Con il nostro staff: ${staffName}.` : '',
      `In caso di disdetta ti chiediamo di avvisarci con anticipo. Grazie! ✂️`,
    ].filter(Boolean);

    return lines.join('\n');
  }

  // Template 3: Feedback & Recensione Google (Post-trattamento)
  if (type === 'feedback') {
    const reviewClause = googleReviewLink && googleReviewLink.trim().length > 0
      ? `Se ti fa piacere, lasciaci una recensione qui: ${googleReviewLink.trim()}`
      : `Se ti fa piacere, lasciaci una recensione su Google per supportare il nostro salone!`;

    const lines = [
      `Grazie per averci scelto oggi, ${clientName}! ✨`,
      `Ci auguriamo che la tua esperienza da ${salonName} sia stata speciale.`,
      `${reviewClause}`,
      `Alla prossima! 💕`,
    ];

    return lines.join('\n');
  }

  return `Ciao ${clientName}! Ti contattiamo da ${salonName}. Come possiamo aiutarti?`;
}

/**
 * Convenience helper to open a specific WhatsApp template directly.
 */
export function openWhatsAppTemplate(
  phone: string,
  type: WhatsAppMessageType,
  options: Omit<BuildAppointmentMessageOptions, 'type'>
): void {
  const message = buildAppointmentMessage({ ...options, type });
  openWhatsAppLink(phone, message);
}
