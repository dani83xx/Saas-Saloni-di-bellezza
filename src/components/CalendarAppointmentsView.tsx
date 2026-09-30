import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  XCircle,
  User,
  Users,
  Scissors,
  Calendar as CalendarIcon,
  Search,
  Filter,
  Check,
  CreditCard
} from 'lucide-react';
import { Appointment, AppointmentStatus, Service, StaffMember, SalonSettings, getStaffColorConfig, Client } from '../types';
import { WhatsAppActionMenu } from './WhatsAppActionMenu';
import { ClientReputationBadge } from './ClientReputationBadge';

interface CalendarAppointmentsViewProps {
  appointments: Appointment[];
  services: Service[];
  todayStr: string;
  clients?: Client[];
  settings?: SalonSettings;
  staffMembers?: StaffMember[];
  staffFilter?: string;
  onStaffFilterChange?: (staffId: string) => void;
  onStatusChange: (id: string, newStatus: AppointmentStatus) => void;
  onOpenWhatsApp: (phone: string, clientName: string, serviceName?: string, time?: string) => void;
  onNewAppointmentWithDate?: (date: string) => void;
  onOpenCheckout?: (appointment: Appointment) => void;
  onOpenClientHistory?: (clientName: string, clientPhone?: string) => void;
}

export const CalendarAppointmentsView: React.FC<CalendarAppointmentsViewProps> = ({
  appointments,
  services,
  todayStr,
  clients = [],
  settings,
  staffMembers = [],
  staffFilter,
  onStaffFilterChange,
  onStatusChange,
  onOpenWhatsApp,
  onNewAppointmentWithDate,
  onOpenCheckout,
  onOpenClientHistory,
}) => {
  // Helper to find client record for reputation badge
  const findClientForApp = (app: Appointment): Client | undefined => {
    if (!clients || clients.length === 0) return undefined;
    const fullName = (app.clientName || '').toLowerCase().trim();
    const phoneClean = (app.clientPhone || '').replace(/[\s+-]/g, '');
    return clients.find(c => {
      const cFullName = `${c.firstName} ${c.lastName}`.toLowerCase().trim();
      const cPhoneClean = (c.phone || '').replace(/[\s+-]/g, '');
      return cFullName === fullName || (phoneClean && cPhoneClean && phoneClean === cPhoneClean);
    });
  };
  // Calendar navigation state: defaults to current dynamic date
  const initialDate = useMemo(() => {
    const parts = todayStr.split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2] || 1);
  }, [todayStr]);

  const [currentYear, setCurrentYear] = useState<number>(initialDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(initialDate.getMonth()); // 0-indexed (7 = August, 8 = September)
  const [viewSubMode, setViewSubMode] = useState<'month' | 'week'>('month');
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [statusFilter, setStatusFilter] = useState<'all' | AppointmentStatus>('all');
  const [calendarSearch, setCalendarSearch] = useState('');
  const [internalStaffFilter, setInternalStaffFilter] = useState<string>('all');

  const activeStaffFilter = staffFilter !== undefined ? staffFilter : internalStaffFilter;
  const handleStaffFilterChange = (val: string) => {
    if (onStaffFilterChange) {
      onStaffFilterChange(val);
    } else {
      setInternalStaffFilter(val);
    }
  };

  const getStaffBadgeConfig = (app: Appointment) => {
    const staff = staffMembers.find(s => (app.staffId && s.id === app.staffId) || (app.staffName && s.name.toLowerCase() === app.staffName.toLowerCase()));
    return getStaffColorConfig(staff?.color);
  };

  // Italian localized names
  const monthNames = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ];
  const weekDaysShort = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
  const weekDaysFull = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

  // Navigate months
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const handleGoToday = () => {
    const parts = todayStr.split('-').map(Number);
    setCurrentYear(parts[0]);
    setCurrentMonth(parts[1] - 1);
    setSelectedDate(todayStr);
  };

  // Helper formatting: YYYY-MM-DD
  const formatDateString = (year: number, month: number, day: number) => {
    const m = String(month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
  };

  // Status color mappings
  const getStatusColorConfig = (status: AppointmentStatus) => {
    switch (status) {
      case 'Confermato':
        return {
          bg: 'bg-emerald-50',
          text: 'text-emerald-700',
          border: 'border-emerald-200',
          dot: 'bg-emerald-500',
          hover: 'hover:bg-emerald-100',
        };
      case 'In corso':
        return {
          bg: 'bg-purple-50',
          text: 'text-purple-700',
          border: 'border-purple-200',
          dot: 'bg-[#8B5CF6]',
          hover: 'hover:bg-purple-100',
        };
      case 'Completato':
        return {
          bg: 'bg-blue-50',
          text: 'text-blue-700',
          border: 'border-blue-200',
          dot: 'bg-blue-500',
          hover: 'hover:bg-blue-100',
        };
      case 'No-Show':
        return {
          bg: 'bg-rose-50',
          text: 'text-rose-700',
          border: 'border-rose-200',
          dot: 'bg-rose-500',
          hover: 'hover:bg-rose-100',
        };
      case 'Annullato':
        return {
          bg: 'bg-slate-100',
          text: 'text-slate-600',
          border: 'border-slate-200',
          dot: 'bg-slate-400',
          hover: 'hover:bg-slate-200',
        };
    }
  };

  // Filter appointments
  const filteredAppointments = useMemo(() => {
    return appointments.filter(app => {
      const matchStatus = statusFilter === 'all' ? true : app.status === statusFilter;
      const matchStaff =
        activeStaffFilter === 'all'
          ? true
          : app.staffId === activeStaffFilter ||
            (app.staffName && staffMembers.find(s => s.id === activeStaffFilter)?.name.toLowerCase() === app.staffName.toLowerCase());
      const matchSearch =
        calendarSearch.trim() === '' ||
        app.clientName.toLowerCase().includes(calendarSearch.toLowerCase()) ||
        app.serviceName.toLowerCase().includes(calendarSearch.toLowerCase()) ||
        app.clientPhone.includes(calendarSearch) ||
        (app.staffName && app.staffName.toLowerCase().includes(calendarSearch.toLowerCase()));
      return matchStatus && matchStaff && matchSearch;
    });
  }, [appointments, statusFilter, activeStaffFilter, staffMembers, calendarSearch]);

  // Group appointments by date string
  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const app of filteredAppointments) {
      const list = map.get(app.date) || [];
      list.push(app);
      map.set(app.date, list);
    }
    // Sort each day's appointments chronologically by time
    map.forEach(list => {
      list.sort((a, b) => a.time.localeCompare(b.time));
    });
    return map;
  }, [filteredAppointments]);

  // Generate Month Grid Days
  const calendarDays = useMemo(() => {
    const days = [];
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);

    // Day of week: 0 = Sun, 1 = Mon, ..., 6 = Sat
    // We want Monday as first day (0 = Mon, 6 = Sun)
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    // Previous month filler days
    const prevMonthLastDate = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDate - i;
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const dateStr = formatDateString(prevYear, prevMonth, dayNum);
      days.push({
        dateStr,
        dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    // Current month days
    for (let d = 1; d <= lastDayOfMonth.getDate(); d++) {
      const dateStr = formatDateString(currentYear, currentMonth, d);
      days.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
      });
    }

    // Next month filler days to complete grid (multiples of 7)
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let d = 1; d <= remaining; d++) {
        const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
        const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
        const dateStr = formatDateString(nextYear, nextMonth, d);
        days.push({
          dateStr,
          dayNum: d,
          isCurrentMonth: false,
          isToday: dateStr === todayStr,
        });
      }
    }

    return days;
  }, [currentYear, currentMonth, todayStr]);

  // Weekly view calculation (based on selectedDate)
  const weekDays = useMemo(() => {
    const sel = new Date(selectedDate);
    if (isNaN(sel.getTime())) return [];
    let dayOfWeek = sel.getDay() - 1; // 0 = Mon, 6 = Sun
    if (dayOfWeek === -1) dayOfWeek = 6;

    const monday = new Date(sel);
    monday.setDate(sel.getDate() - dayOfWeek);

    const week = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = formatDateString(d.getFullYear(), d.getMonth(), d.getDate());
      week.push({
        dateStr,
        dayNum: d.getDate(),
        monthName: monthNames[d.getMonth()],
        dayName: weekDaysFull[i],
        dayShort: weekDaysShort[i],
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDate,
      });
    }
    return week;
  }, [selectedDate, todayStr]);

  // Selected date appointments
  const selectedDateAppointments = appointmentsByDate.get(selectedDate) || [];
  const selectedDateTotalRevenue = selectedDateAppointments
    .filter(a => a.status !== 'Annullato' && a.status !== 'No-Show')
    .reduce((sum, a) => sum + a.price, 0);

  return (
    <div className="space-y-4">
      {/* 1. Header Toolbar */}
      <div className="bg-white p-4 md:p-5 rounded-2xl border border-pink-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Navigation Month/Year */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-0.5">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-white text-slate-700 rounded-lg transition"
              title="Mese precedente"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-3 py-1 font-bold text-slate-900 text-sm sm:text-base min-w-[150px] text-center">
              {monthNames[currentMonth]} {currentYear}
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-white text-slate-700 rounded-lg transition"
              title="Mese successivo"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleGoToday}
            className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition border border-slate-200"
          >
            Oggi
          </button>

          {/* Sub-mode: Month Grid vs Weekly Columns */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setViewSubMode('month')}
              className={`px-3 py-1 rounded-lg font-semibold transition ${
                viewSubMode === 'month'
                  ? 'bg-white text-[#8B5CF6] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Vista Mese
            </button>
            <button
              type="button"
              onClick={() => setViewSubMode('week')}
              className={`px-3 py-1 rounded-lg font-semibold transition ${
                viewSubMode === 'week'
                  ? 'bg-white text-[#8B5CF6] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Vista Settimana
            </button>
          </div>
        </div>

        {/* Search & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cerca cliente / servizio..."
              value={calendarSearch}
              onChange={(e) => setCalendarSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#8B5CF6] w-44 sm:w-56"
            />
          </div>

          {/* Quick filter by staff */}
          {staffMembers.length > 0 && (
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1">
              <Users className="w-3.5 h-3.5 text-[#8B5CF6]" />
              <select
                value={activeStaffFilter}
                onChange={(e) => handleStaffFilterChange(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer"
              >
                <option value="all">Tutti i Collaboratori ({staffMembers.length})</option>
                {staffMembers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.role})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Quick filter by status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-[#8B5CF6]"
          >
            <option value="all">Tutti gli stati</option>
            <option value="Confermato">Confermato</option>
            <option value="In corso">In poltrona</option>
            <option value="Completato">Completato</option>
            <option value="No-Show">No-Show</option>
            <option value="Annullato">Annullato</option>
          </select>
        </div>
      </div>

      {/* 2. Calendar Views */}
      {viewSubMode === 'month' ? (
        /* ================= VISTA MESE (GRIGLIA) ================= */
        <div className="bg-white rounded-2xl border border-pink-100 shadow-sm overflow-hidden">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 bg-purple-50/70 border-b border-pink-100 text-center text-xs font-bold text-slate-700 py-2.5">
            {weekDaysShort.map((day, idx) => (
              <div key={day} className="tracking-wider uppercase text-[11px]">
                <span className="hidden sm:inline">{weekDaysFull[idx]}</span>
                <span className="sm:hidden">{day}</span>
              </div>
            ))}
          </div>

          {/* Month Day Grid */}
          <div className="grid grid-cols-7 divide-x divide-y divide-pink-50 border-b border-pink-100">
            {calendarDays.map((dayObj) => {
              const dayApps = appointmentsByDate.get(dayObj.dateStr) || [];
              const isSelected = dayObj.dateStr === selectedDate;
              const hasApps = dayApps.length > 0;

              return (
                <div
                  key={dayObj.dateStr}
                  onClick={() => setSelectedDate(dayObj.dateStr)}
                  className={`min-h-[110px] md:min-h-[135px] p-1.5 md:p-2 flex flex-col justify-between transition group cursor-pointer relative ${
                    !dayObj.isCurrentMonth
                      ? 'bg-slate-50/50 text-slate-400'
                      : isSelected
                      ? 'bg-pink-50/40 ring-2 ring-inset ring-[#E95F8F]/50'
                      : 'hover:bg-slate-50/80 bg-white'
                  }`}
                >
                  {/* Top Bar of Day: Number & Badges */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1">
                        <span
                          className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center transition ${
                            dayObj.isToday
                              ? 'bg-[#E95F8F] text-white shadow-xs'
                              : isSelected
                              ? 'bg-purple-100 text-[#8B5CF6]'
                              : dayObj.isCurrentMonth
                              ? 'text-slate-800 group-hover:text-[#8B5CF6]'
                              : 'text-slate-400'
                          }`}
                        >
                          {dayObj.dayNum}
                        </span>
                        {dayObj.isToday && (
                          <span className="hidden md:inline-block text-[9px] font-bold text-[#E95F8F] bg-pink-100/70 px-1.5 py-0.2 rounded-md">
                            Oggi
                          </span>
                        )}
                      </div>
                    </div>

                    {/* APPOINTMENTS LIST DIRECTLY UNDER THE DATE */}
                    <div className="space-y-1">
                      {dayApps.slice(0, 3).map((app) => {
                        const styleCfg = getStatusColorConfig(app.status);
                        return (
                          <div
                            key={app.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDate(dayObj.dateStr);
                            }}
                            className={`p-1 md:p-1.5 rounded-lg border text-[10px] md:text-[11px] leading-tight transition flex items-center justify-between gap-1 shadow-2xs ${styleCfg.bg} ${styleCfg.border} ${styleCfg.hover}`}
                            title={`${app.time} - ${app.clientName} (${app.serviceName}) • €${app.price}`}
                          >
                            <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${styleCfg.dot}`} />
                              <span className="font-mono font-bold text-slate-700 shrink-0">
                                {app.time}
                              </span>
                              <span className="font-semibold text-slate-900 truncate">
                                {app.clientName.split(' ')[0]}
                              </span>
                            </div>
                            <span className="hidden md:inline-block text-[10px] font-bold text-[#E95F8F] shrink-0">
                              €{app.price}
                            </span>
                          </div>
                        );
                      })}

                      {/* If more than 3 appointments */}
                      {dayApps.length > 3 && (
                        <div className="text-[10px] text-center font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 py-0.5 rounded transition">
                          +{dayApps.length - 3} altri
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom Counter summary if has appointments */}
                  {hasApps && (
                    <div className="mt-1 pt-1 border-t border-slate-100 flex items-center justify-between text-[9px] text-slate-400">
                      <span>{dayApps.length} app.</span>
                      <span className="font-bold text-emerald-600">
                        €{dayApps.filter(a => a.status !== 'Annullato' && a.status !== 'No-Show').reduce((sum, a) => sum + a.price, 0)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ================= VISTA SETTIMANA (COLONNE SOTTO LE DATE) ================= */
        <div className="bg-white rounded-2xl border border-pink-100 shadow-sm overflow-hidden p-3 md:p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-7 gap-3">
            {weekDays.map((col) => {
              const colApps = appointmentsByDate.get(col.dateStr) || [];
              const isColSelected = col.dateStr === selectedDate;
              const colRevenue = colApps
                .filter(a => a.status !== 'Annullato' && a.status !== 'No-Show')
                .reduce((s, a) => s + a.price, 0);

              return (
                <div
                  key={col.dateStr}
                  onClick={() => setSelectedDate(col.dateStr)}
                  className={`rounded-xl border p-2.5 flex flex-col transition cursor-pointer ${
                    isColSelected
                      ? 'border-[#E95F8F] bg-pink-50/20 shadow-xs'
                      : col.isToday
                      ? 'border-purple-200 bg-purple-50/10'
                      : 'border-slate-200 bg-slate-50/40 hover:bg-slate-50'
                  }`}
                >
                  {/* Column Header: Day, Date & Summary */}
                  <div className="border-b border-slate-200 pb-2 mb-2 flex items-start justify-between">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        {col.dayName}
                      </div>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span
                          className={`text-lg font-black ${
                            col.isToday ? 'text-[#E95F8F]' : 'text-slate-900'
                          }`}
                        >
                          {col.dayNum}
                        </span>
                        <span className="text-xs text-slate-500">{col.monthName}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 font-medium">
                        {colApps.length} appuntamenti • <strong className="text-emerald-600">€{colRevenue}</strong>
                      </div>
                    </div>
                  </div>

                  {/* APPOINTMENTS CARDS UNDER THIS DATE */}
                  <div className="space-y-2 flex-1">
                    {colApps.length === 0 ? (
                      <div className="py-6 text-center text-slate-400 text-xs italic">
                        Nessun appuntamento
                      </div>
                    ) : (
                      colApps.map((app) => {
                        const styleCfg = getStatusColorConfig(app.status);
                        return (
                          <div
                            key={app.id}
                            className={`p-2.5 rounded-xl border transition shadow-2xs ${styleCfg.bg} ${styleCfg.border}`}
                          >
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="font-mono font-black text-xs text-slate-800 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                {app.time}
                              </span>
                              <span className="font-bold text-xs text-[#E95F8F]">
                                €{app.price}
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenClientHistory?.(app.clientName, app.clientPhone);
                                }}
                                className="font-bold text-slate-900 text-xs truncate hover:text-[#E95F8F] text-left transition cursor-pointer"
                                title="Visualizza scheda e storico cliente"
                              >
                                {app.clientName}
                              </button>
                              {(() => {
                                const clientObj = findClientForApp(app);
                                if (!clientObj) return null;
                                return (
                                  <ClientReputationBadge
                                    noShowCount={clientObj.noShowCount || 0}
                                    isBlocked={clientObj.isBlocked}
                                    size="xs"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onOpenClientHistory?.(app.clientName, app.clientPhone);
                                    }}
                                  />
                                );
                              })()}
                            </div>
                            <div className="text-[11px] text-slate-600 truncate mt-0.5">
                              {app.serviceName}
                            </div>

                            {app.staffName && (() => {
                              const staffCfg = getStaffBadgeConfig(app);
                              return (
                                <div className="mt-1">
                                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${staffCfg.bg} ${staffCfg.text} border ${staffCfg.border}`}>
                                    <span className={`w-1 h-1 rounded-full ${staffCfg.dot}`} />
                                    {app.staffName}
                                  </span>
                                </div>
                              );
                            })()}

                            {/* Status and Action bar */}
                            <div className="mt-2 pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                              <div className="flex items-center gap-1">
                                <span className="font-semibold text-slate-500 flex items-center gap-1">
                                  <span className={`w-1.5 h-1.5 rounded-full ${styleCfg.dot}`} />
                                  {app.status}
                                </span>
                                {app.isPaid && (
                                  <span className="px-1 py-0.2 rounded text-[8px] font-black bg-emerald-100 text-emerald-800">
                                    {app.paymentMethod || 'OK'}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                {onOpenCheckout && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onOpenCheckout(app);
                                    }}
                                    className={`p-0.5 rounded transition ${
                                      app.isPaid
                                        ? 'text-emerald-700 hover:text-emerald-800'
                                        : 'text-[#E95F8F] hover:text-pink-700'
                                    }`}
                                    title={app.isPaid ? `Pagato: ${app.paymentMethod}` : 'Incassa al POS / Cassa'}
                                  >
                                    <CreditCard className="w-3 h-3" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenWhatsApp(app.clientPhone, app.clientName, app.serviceName, app.time);
                                  }}
                                  className="text-emerald-700 hover:text-emerald-800 p-0.5"
                                  title="Invia WhatsApp"
                                >
                                  <MessageSquare className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Detailed Inspector for the Selected Date */}
      <div className="bg-white rounded-2xl border border-pink-100 shadow-sm p-4 md:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-pink-50 pb-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-purple-50 text-[#8B5CF6] rounded-xl">
                <CalendarIcon className="w-4 h-4" />
              </span>
              <h3 className="font-bold text-slate-900 text-base md:text-lg">
                Appuntamenti di {selectedDate === todayStr ? 'Oggi' : 'questa data'} ({selectedDate})
              </h3>
              <span className="text-xs bg-pink-50 text-[#E95F8F] font-bold px-2 py-0.5 rounded-full border border-pink-100">
                {selectedDateAppointments.length} Prenotati
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Incasso stimato per questa giornata: <strong className="text-emerald-700 font-bold">€{selectedDateTotalRevenue}</strong>. Puoi modificare lo stato o inviare messaggi WhatsApp ai clienti.
            </p>
          </div>
        </div>

        {selectedDateAppointments.length === 0 ? (
          <div className="text-center py-8 bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
            <CalendarIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">Nessun appuntamento per il {selectedDate}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Nessuna prenotazione programmata per questa giornata.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {selectedDateAppointments.map((app) => {
              const styleCfg = getStatusColorConfig(app.status);
              return (
                <div
                  key={app.id}
                  className="p-3.5 md:p-4 rounded-xl border border-pink-100 bg-white hover:border-[#8B5CF6]/40 transition flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs"
                >
                  {/* Left: Time badge & Client info */}
                  <div className="flex items-start gap-3.5">
                    <div className="w-16 shrink-0 text-center bg-purple-50/80 p-2 rounded-xl border border-purple-100">
                      <span className="text-xs text-slate-500 font-bold block">{app.durationMinutes}m</span>
                      <span className="text-base font-black text-[#8B5CF6] font-mono">{app.time}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => onOpenClientHistory?.(app.clientName, app.clientPhone)}
                          className="font-bold text-slate-900 text-sm md:text-base hover:text-[#E95F8F] transition text-left cursor-pointer"
                          title="Visualizza scheda e storico cliente"
                        >
                          {app.clientName}
                        </button>
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${styleCfg.bg} ${styleCfg.text} ${styleCfg.border}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${styleCfg.dot}`} />
                          {app.status}
                        </span>
                        {(() => {
                          const clientObj = findClientForApp(app);
                          if (!clientObj) return null;
                          return (
                            <ClientReputationBadge
                              noShowCount={clientObj.noShowCount || 0}
                              isBlocked={clientObj.isBlocked}
                              size="xs"
                              onClick={() => onOpenClientHistory?.(app.clientName, app.clientPhone)}
                            />
                          );
                        })()}
                      </div>
                      <div className="text-xs text-slate-600 mt-1 flex flex-wrap items-center gap-1.5">
                        <Scissors className="w-3 h-3 inline-block text-slate-400 mr-0.5 shrink-0" />
                        {app.serviceNames && app.serviceNames.length > 1 ? (
                          <div className="inline-flex flex-wrap items-center gap-1">
                            {app.serviceNames.map((sn, sIdx) => (
                              <span
                                key={sIdx}
                                className="px-1.5 py-0.5 rounded-md bg-purple-50 text-[#8B5CF6] border border-purple-200 text-[10px] font-bold"
                              >
                                {sn}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <strong className="text-slate-800">{app.serviceName}</strong>
                        )}
                        <span className="text-slate-400">•</span>
                        <span className="text-slate-600 font-medium">{app.durationMinutes} min</span>
                        <span className="text-slate-400">•</span>
                        <span className="text-[#E95F8F] font-bold">€{app.price}</span>
                        {app.staffName && (() => {
                          const staffCfg = getStaffBadgeConfig(app);
                          return (
                            <>
                              <span className="text-slate-400">•</span>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${staffCfg.bg} ${staffCfg.text} border ${staffCfg.border}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${staffCfg.dot}`} />
                                {app.staffName}
                              </span>
                            </>
                          );
                        })()}
                      </div>
                      {app.notes && (
                        <p className="text-xs text-slate-500 mt-0.5 italic">
                          "{app.notes}"
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-wrap items-center gap-2 self-end md:self-center">
                    {app.isPaid && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                        <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{app.paymentMethod || 'Pagato'}</span>
                      </span>
                    )}

                    {onOpenCheckout && (
                      <button
                        type="button"
                        onClick={() => onOpenCheckout(app)}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                          app.isPaid
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                        }`}
                        title={app.isPaid ? 'Modifica incasso registrato' : 'Registra incasso alla cassa'}
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>{app.isPaid ? 'Cassa' : 'Incassa'}</span>
                      </button>
                    )}

                    {settings ? (
                      <WhatsAppActionMenu
                        appointment={app}
                        settings={settings}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => onOpenWhatsApp(app.clientPhone, app.clientName, app.serviceName, app.time)}
                        className="px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold flex items-center gap-1.5 hover:bg-emerald-100 transition"
                        title="Apri WhatsApp"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                        <span>WhatsApp</span>
                      </button>
                    )}

                    <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1">
                      <span className="text-[11px] text-slate-500 font-semibold">Stato:</span>
                      <select
                        value={app.status}
                        onChange={(e) => onStatusChange(app.id, e.target.value as AppointmentStatus)}
                        className="text-xs bg-transparent text-slate-800 font-bold outline-none cursor-pointer"
                      >
                        <option value="Confermato">Confermato</option>
                        <option value="In corso">In poltrona</option>
                        <option value="Completato">Completato</option>
                        <option value="No-Show">No-Show</option>
                        <option value="Annullato">Annullato</option>
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
