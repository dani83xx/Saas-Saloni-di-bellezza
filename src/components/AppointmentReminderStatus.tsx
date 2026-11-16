import React from 'react';
import { Mail } from 'lucide-react';
import type { Appointment } from '../types';
import { describeAppointmentReminder } from '../lib/appointmentReminderStatus';

interface AppointmentReminderStatusProps {
  appointment: Pick<Appointment, 'reminderSentAt' | 'reminderEmail' | 'date' | 'time' | 'status'>;
  autoReminders: boolean;
  /** detail = frase completa. badge = icona compatta in agenda e in lista. */
  variant?: 'detail' | 'badge';
  className?: string;
}

export const AppointmentReminderStatus: React.FC<AppointmentReminderStatusProps> = ({
  appointment,
  autoReminders,
  variant = 'detail',
  className = '',
}) => {
  const status = describeAppointmentReminder(appointment, autoReminders);
  if (!status) return null;

  const sent = status.kind === 'sent';

  if (variant === 'badge') {
    return (
      <span
        title={status.text}
        aria-label={status.text}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-semibold leading-tight ${
          sent
            ? 'bg-purple-50 text-[#8B5CF6] border-purple-200'
            : 'bg-slate-50 text-slate-500 border-slate-200'
        } ${className}`}
      >
        <Mail className="w-3 h-3 shrink-0" aria-hidden />
        <span>{status.badge}</span>
      </span>
    );
  }

  return (
    <p
      className={`text-xs mt-1 flex items-start gap-1.5 ${
        sent ? 'text-[#8B5CF6]' : 'text-slate-500'
      } ${className}`}
    >
      <Mail className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${sent ? 'text-[#8B5CF6]' : 'text-slate-400'}`} aria-hidden />
      <span className="min-w-0 [overflow-wrap:anywhere]">{status.text}</span>
    </p>
  );
};
