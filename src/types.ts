
export type AppointmentStatus = 'Confermato' | 'In corso' | 'Completato' | 'Annullato' | 'No-Show';

export interface UserSession {
  id: string;
  email: string;
  salonId: string;
  salonName: string;
  ownerName: string;
  role: 'owner' | 'staff';
}

export type StaffColor = 'pink' | 'purple' | 'emerald' | 'amber' | 'blue' | 'rose' | 'indigo' | 'teal';

export interface StaffMember {
  id: string;
  name: string;
  role: string; // e.g. "Titolare", "Hair Stylist Senior", "Estetista", "Apprendista"
  color: StaffColor; // badge/accent color
  isActive: boolean;
  phone?: string;
  email?: string;
}

export const STAFF_COLORS: {
  id: StaffColor;
  label: string;
  bg: string;
  text: string;
  border: string;
  dot: string;
  ring: string;
}[] = [
  { id: 'purple', label: 'Viola', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-[#8B5CF6]', ring: 'ring-purple-400' },
  { id: 'pink', label: 'Rosa', bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200', dot: 'bg-[#E95F8F]', ring: 'ring-pink-400' },
  { id: 'emerald', label: 'Smeraldo', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500', ring: 'ring-emerald-400' },
  { id: 'amber', label: 'Ambra', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', dot: 'bg-amber-500', ring: 'ring-amber-400' },
  { id: 'blue', label: 'Azzurro', bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', dot: 'bg-sky-500', ring: 'ring-sky-400' },
  { id: 'rose', label: 'Corallo', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500', ring: 'ring-rose-400' },
  { id: 'indigo', label: 'Indaco', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500', ring: 'ring-indigo-400' },
  { id: 'teal', label: 'Petrolio', bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', dot: 'bg-teal-500', ring: 'ring-teal-400' },
];

export function getStaffColorConfig(color?: StaffColor) {
  return STAFF_COLORS.find(c => c.id === color) || STAFF_COLORS[0];
}

export type PaymentMethod = 'Contanti' | 'POS' | 'Satispay' | 'Altro';

export interface Appointment {
  id: string;
  salonId: string; // <-- Fondamentale per isolare i saloni
  clientName: string;
  clientPhone: string;
  serviceId: string;
  serviceName: string;
  serviceIds?: string[];
  serviceNames?: string[];
  price: number;
  durationMinutes: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  status: AppointmentStatus;
  notes?: string;
  staffId?: string;
  staffName?: string;
  paymentMethod?: PaymentMethod;
  isPaid?: boolean;
  paidAt?: string;
}

export interface Client {
  id: string;
  salonId?: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  notes: string;
  technicalNotes?: string; // Note tecniche salone (es. formule colore, cute sensibile, allergie)
  lastAppointmentDate?: string;
  totalAppointments: number;
  totalSpent: number;
  status: 'Attivo' | 'Inattivo';
  tags: string[];
  noShowCount: number; // Contatore appuntamenti saltati / mancati
  isBlocked?: boolean; // Opzione per bloccare clienti seriali ad alto rischio
}

export interface Service {
  id: string;
  salonId?: string;
  name: string;
  category: 'Capelli' | 'Estetica' | 'Unghie' | 'Massaggi' | 'Trattamenti';
  durationMinutes: number;
  price: number;
  isActive: boolean;
  description?: string;
}

export interface StripeInvoice {
  id: string;
  number: string;
  date: string;
  amount: number;
  status: 'Pagata' | 'In sospeso';
  pdfUrl?: string;
}

export interface SubscriptionPlan {
  id?: string;
  name: string; // e.g. 'Piano Pro'
  status: 'Attivo' | 'In prova' | 'In scadenza' | 'Annullato' | 'Scaduto' | 'trial';
  price: number; // e.g. 29
  interval: 'mese' | 'anno';
  nextRenewalDate: string; // e.g. '15 Ottobre'
  renewalFullDate: string; // e.g. '15 Ottobre 2026'
  paymentMethod: {
    brand: 'Visa' | 'Mastercard' | 'Amex' | 'Prova Gratuita';
    last4: string;
    expiry: string;
  };
  features: string[];
  invoices: StripeInvoice[];
}

export type WhatsAppMessageType = 'conferma' | 'promemoria' | 'feedback';

export interface SalonSettings {
  salonId?: string;
  name: string;
  ownerName: string;
  email: string;
  phone: string;
  whatsappNumber: string;
  address: string;
  city: string;
  openHours: string;
  calendlyLink?: string;
  googleReviewLink?: string;
  currency: string;
  autoReminders: boolean;
  logoUrl?: string;
  subscription?: SubscriptionPlan;
  staffMembers?: StaffMember[];
}


