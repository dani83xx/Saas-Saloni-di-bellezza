import React, { useState, useMemo } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Scissors,
  CheckCircle2,
  XCircle,
  X,
  Clock,
  Euro,
  Users,
  BarChart3
} from 'lucide-react';
import { Appointment, Service } from '../types';
import { CashRegisterSummary } from './CashRegisterSummary';
import { getTodayStr } from '../utils/date';

interface SalonStatsViewProps {
  appointments: Appointment[];
  services: Service[];
  showToast?: (msg: string) => void;
}

const MONTH_NAMES = [
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
  'Dicembre',
];

const DAYS_OF_WEEK = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

export const SalonStatsView: React.FC<SalonStatsViewProps> = ({
  appointments,
  services,
  showToast,
}) => {
  // Current active date context: default to current real date from browser
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number>(() => new Date().getMonth());
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState<boolean>(false);
  const [chartViewMode, setChartViewMode] = useState<'settimanale' | 'giornaliero'>('giornaliero');

  const selectedMonthName = MONTH_NAMES[selectedMonthIndex];
  const selectedMonthStr = `${selectedYear}-${String(selectedMonthIndex + 1).padStart(2, '0')}`;

  // Previous month calculation for comparison
  const prevMonthIndex = selectedMonthIndex === 0 ? 11 : selectedMonthIndex - 1;
  const prevYear = selectedMonthIndex === 0 ? selectedYear - 1 : selectedYear;
  const prevMonthStr = `${prevYear}-${String(prevMonthIndex + 1).padStart(2, '0')}`;
  const prevMonthName = MONTH_NAMES[prevMonthIndex];

  // Next and Previous navigation handlers
  const handlePrevMonth = () => {
    if (selectedMonthIndex === 0) {
      setSelectedMonthIndex(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonthIndex(selectedMonthIndex - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonthIndex === 11) {
      setSelectedMonthIndex(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonthIndex(selectedMonthIndex + 1);
    }
  };

  const handleSelectMonth = (monthIdx: number, year?: number) => {
    setSelectedMonthIndex(monthIdx);
    if (year !== undefined) {
      setSelectedYear(year);
    }
    setIsMonthPickerOpen(false);
    if (showToast) {
      showToast(`Statistiche aggiornate: ${MONTH_NAMES[monthIdx]} ${year || selectedYear}`);
    }
  };

  // 1. Data for Current Selected Month
  const currentMonthAppointments = useMemo(() => {
    return appointments.filter((app) => app.date.startsWith(selectedMonthStr));
  }, [appointments, selectedMonthStr]);

  const activeAppointments = useMemo(() => {
    return currentMonthAppointments.filter(
      (app) => app.status !== 'Annullato' && app.status !== 'No-Show'
    );
  }, [currentMonthAppointments]);

  // Total Revenue for current month
  const totalRevenue = useMemo(() => {
    return activeAppointments.reduce((sum, app) => sum + app.price, 0);
  }, [activeAppointments]);

  // 2. Data for Previous Month (for % growth KPI)
  const prevMonthAppointments = useMemo(() => {
    return appointments.filter(
      (app) =>
        app.date.startsWith(prevMonthStr) &&
        app.status !== 'Annullato' &&
        app.status !== 'No-Show'
    );
  }, [appointments, prevMonthStr]);

  const prevMonthRevenue = useMemo(() => {
    return prevMonthAppointments.reduce((sum, app) => sum + app.price, 0);
  }, [prevMonthAppointments]);

  const growthPercentage = useMemo(() => {
    if (prevMonthRevenue === 0) {
      return totalRevenue > 0 ? 100 : 0;
    }
    return Math.round(((totalRevenue - prevMonthRevenue) / prevMonthRevenue) * 100);
  }, [totalRevenue, prevMonthRevenue]);

  // 3. Average Ticket (Scontrino Medio)
  const averageTicket = useMemo(() => {
    if (activeAppointments.length === 0) return 0;
    return totalRevenue / activeAppointments.length;
  }, [totalRevenue, activeAppointments]);

  // 4. Most profitable service of the selected month
  const serviceStats = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; count: number }>();
    activeAppointments.forEach((app) => {
      const existing = map.get(app.serviceName) || {
        name: app.serviceName,
        revenue: 0,
        count: 0,
      };
      existing.revenue += app.price;
      existing.count += 1;
      map.set(app.serviceName, existing);
    });

    const sorted = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
    return sorted;
  }, [activeAppointments]);

  const topService = serviceStats[0] || {
    name: 'Nessun servizio registrato',
    revenue: 0,
    count: 0,
  };

  // 5. Completion & attendance rate
  const completedCount = currentMonthAppointments.filter((a) => a.status === 'Completato').length;
  const noShowCount = currentMonthAppointments.filter(
    (a) => a.status === 'No-Show' || a.status === 'Annullato'
  ).length;
  const attendanceRate =
    currentMonthAppointments.length > 0
      ? Math.round(
          ((currentMonthAppointments.length - noShowCount) / currentMonthAppointments.length) * 100
        )
      : 100;

  // 6. Day of Week Revenue breakdown (Lun-Dom) for chart
  const dayBreakdown = useMemo(() => {
    const days = [
      { day: 'Lun', dayIdx: 1, amount: 0, count: 0 },
      { day: 'Mar', dayIdx: 2, amount: 0, count: 0 },
      { day: 'Mer', dayIdx: 3, amount: 0, count: 0 },
      { day: 'Gio', dayIdx: 4, amount: 0, count: 0 },
      { day: 'Ven', dayIdx: 5, amount: 0, count: 0 },
      { day: 'Sab', dayIdx: 6, amount: 0, count: 0 },
      { day: 'Dom', dayIdx: 0, amount: 0, count: 0 },
    ];

    activeAppointments.forEach((app) => {
      const d = new Date(app.date);
      const dayIdx = d.getDay(); // 0 is Sunday, 1 is Monday
      const match = days.find((item) => item.dayIdx === dayIdx);
      if (match) {
        match.amount += app.price;
        match.count += 1;
      }
    });

    const maxAmount = Math.max(...days.map((d) => d.amount), 1);
    return days.map((d) => ({
      ...d,
      h: d.amount === 0 ? '6%' : `${Math.max(15, Math.round((d.amount / maxAmount) * 100))}%`,
    }));
  }, [activeAppointments]);

  // 7. Weekly Breakdown (Weeks 1 to 5)
  const weekBreakdown = useMemo(() => {
    const weeks = [
      { label: 'Sett 1 (1-7)', amount: 0, count: 0 },
      { label: 'Sett 2 (8-14)', amount: 0, count: 0 },
      { label: 'Sett 3 (15-21)', amount: 0, count: 0 },
      { label: 'Sett 4 (22-28)', amount: 0, count: 0 },
      { label: 'Sett 5 (29-31)', amount: 0, count: 0 },
    ];

    activeAppointments.forEach((app) => {
      const dayNum = parseInt(app.date.split('-')[2], 10);
      if (dayNum <= 7) {
        weeks[0].amount += app.price;
        weeks[0].count += 1;
      } else if (dayNum <= 14) {
        weeks[1].amount += app.price;
        weeks[1].count += 1;
      } else if (dayNum <= 21) {
        weeks[2].amount += app.price;
        weeks[2].count += 1;
      } else if (dayNum <= 28) {
        weeks[3].amount += app.price;
        weeks[3].count += 1;
      } else {
        weeks[4].amount += app.price;
        weeks[4].count += 1;
      }
    });

    const maxAmount = Math.max(...weeks.map((w) => w.amount), 1);
    return weeks.map((w) => ({
      ...w,
      h: w.amount === 0 ? '6%' : `${Math.max(15, Math.round((w.amount / maxAmount) * 100))}%`,
    }));
  }, [activeAppointments]);

  // Precomputed month stats for the Month Picker Grid
  const getMonthSummary = (monthIdx: number, year: number) => {
    const str = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
    const monthApps = appointments.filter(
      (a) => a.date.startsWith(str) && a.status !== 'Annullato' && a.status !== 'No-Show'
    );
    const sum = monthApps.reduce((acc, a) => acc + a.price, 0);
    return { count: monthApps.length, revenue: sum };
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* ============================================================== */}
      {/* 1. TOP HEADER WITH CLICKABLE DATE PICKER BAR */}
      {/* ============================================================== */}
      <div className="bg-white rounded-2xl border border-pink-100 shadow-sm p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#E95F8F]" />
            <h3 className="font-bold text-slate-900 text-base md:text-lg">
              Statistiche & Redditività Salone
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Analizza l'andamento del fatturato, lo scontrino medio e i servizi più richiesti.
          </p>
        </div>

        {/* CLICKABLE DATE PILL WITH MONTH CHANGER */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto bg-pink-50/50 p-1 rounded-2xl border border-pink-100">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-2 hover:bg-white rounded-xl text-slate-600 hover:text-slate-900 transition shadow-2xs cursor-pointer"
            title="Mese precedente"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* MAIN CLICKABLE DATE BADGE */}
          <button
            type="button"
            onClick={() => setIsMonthPickerOpen(true)}
            className="group flex items-center gap-2 px-3.5 py-1.5 bg-white hover:bg-gradient-to-r hover:from-pink-50 hover:to-purple-50 rounded-xl border border-pink-200/80 shadow-xs transition duration-150 cursor-pointer text-left"
            title="Clicca per scegliere un altro mese o anno"
          >
            <Calendar className="w-4 h-4 text-[#E95F8F] group-hover:scale-110 transition-transform" />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 leading-tight">
                Mese in analisi
              </span>
              <span className="text-xs md:text-sm font-black text-slate-900 flex items-center gap-1">
                {selectedMonthName} {selectedYear}
                <ChevronDown className="w-3.5 h-3.5 text-[#8B5CF6] group-hover:translate-y-0.5 transition-transform" />
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={handleNextMonth}
            className="p-2 hover:bg-white rounded-xl text-slate-600 hover:text-slate-900 transition shadow-2xs cursor-pointer"
            title="Mese successivo"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. QUADRATURA DI CASSA & CHIUSURA GIORNALIERA */}
      {/* ============================================================== */}
      <CashRegisterSummary
        appointments={appointments}
        onShowToast={showToast}
      />

      {/* ============================================================== */}
      {/* 3. MONTHLY SUMMARY KPI CARDS */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Incasso Totale */}
        <div className="bg-white p-5 rounded-2xl border border-pink-100 shadow-sm flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-start justify-between">
            <span className="text-xs text-slate-500 font-medium">Incasso Totale</span>
            {/* Clickable Month Link on Card */}
            <button
              type="button"
              onClick={() => setIsMonthPickerOpen(true)}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#8B5CF6] hover:text-[#7C3AED] hover:underline bg-purple-50 px-2 py-0.5 rounded-md cursor-pointer"
              title="Cambia mese"
            >
              <span>{selectedMonthName}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>

          <div className="my-2">
            <div className="text-2xl md:text-3xl font-black text-[#1E1B2E]">
              €{totalRevenue.toLocaleString('it-IT')}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 text-xs font-semibold">
              {growthPercentage >= 0 ? (
                <span className="inline-flex items-center gap-0.5 text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                  <TrendingUp className="w-3.5 h-3.5" />
                  +{growthPercentage}%
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-md">
                  <TrendingDown className="w-3.5 h-3.5" />
                  {growthPercentage}%
                </span>
              )}
              <span className="text-slate-400 text-[11px]">vs {prevMonthName} (€{prevMonthRevenue})</span>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-100">
            {activeAppointments.length} appuntamenti registrati
          </div>
        </div>

        {/* KPI 2: Scontrino Medio */}
        <div className="bg-white p-5 rounded-2xl border border-pink-100 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Scontrino Medio per Cliente</span>
            <div className="text-2xl md:text-3xl font-black text-[#8B5CF6] mt-2">
              €{averageTicket.toFixed(2).replace('.', ',')}
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Target salone: €50,00</span>
            <span className={`font-bold ${averageTicket >= 50 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {averageTicket >= 50 ? '✓ Sopra target' : 'In crescita'}
            </span>
          </div>
        </div>

        {/* KPI 3: Servizio Più Redditizio */}
        <div className="bg-white p-5 rounded-2xl border border-pink-100 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Servizio Top di {selectedMonthName}</span>
            <div className="text-base font-black text-[#E95F8F] mt-2 line-clamp-1" title={topService.name}>
              {topService.name}
            </div>
            <div className="text-xs font-bold text-slate-700 mt-1">
              €{topService.revenue} generati ({topService.count} esecuzioni)
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
            Trattamento con maggiore marginalità
          </div>
        </div>

        {/* KPI 4: Tasso Presenza / Affidabilità */}
        <div className="bg-white p-5 rounded-2xl border border-pink-100 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Tasso di Presenza</span>
            <div className="text-2xl md:text-3xl font-black text-emerald-600 mt-2">
              {attendanceRate}%
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>{completedCount} completati</span>
            <span>{noShowCount} no-show/annullati</span>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. INTERACTIVE CHART WITH CLICKABLE DATE BADGE */}
      {/* ============================================================== */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-pink-100 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <span>Andamento Incassi del Mese</span>
              <span className="text-xs font-bold text-[#E95F8F] bg-pink-50 px-2 py-0.5 rounded-full border border-pink-100">
                €{totalRevenue.toLocaleString('it-IT')}
              </span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Distribuzione del fatturato per {chartViewMode === 'giornaliero' ? 'giorni della settimana' : 'settimane del mese'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Switcher */}
            <div className="bg-slate-100 p-0.5 rounded-xl flex text-xs">
              <button
                type="button"
                onClick={() => setChartViewMode('giornaliero')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                  chartViewMode === 'giornaliero'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Giorni (Lun-Dom)
              </button>
              <button
                type="button"
                onClick={() => setChartViewMode('settimanale')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                  chartViewMode === 'settimanale'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Settimane
              </button>
            </div>

            {/* CLICKABLE DATE BADGE IN THE CHART HEADER */}
            <button
              type="button"
              onClick={() => setIsMonthPickerOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-[#8B5CF6] bg-slate-100 hover:bg-purple-50 px-3 py-1.5 rounded-xl border border-slate-200/80 hover:border-purple-200 transition cursor-pointer shadow-2xs"
              title="Clicca per scegliere un altro mese"
            >
              <Calendar className="w-3.5 h-3.5 text-[#E95F8F]" />
              <span>{selectedMonthName} {selectedYear}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Chart Bars */}
        <div className="h-52 flex items-end justify-between gap-2 md:gap-4 pt-8 px-2 border-b border-slate-200">
          {(chartViewMode === 'giornaliero' ? dayBreakdown : weekBreakdown).map((bar, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
              <span className="text-[10px] font-bold text-slate-600 font-mono transition group-hover:scale-110">
                {bar.amount > 0 ? `€${bar.amount}` : '-'}
              </span>
              <div
                style={{ height: bar.h }}
                className={`w-full max-w-[48px] rounded-t-xl transition-all duration-300 relative ${
                  bar.amount > 600
                    ? 'bg-gradient-to-t from-[#E95F8F] to-[#8B5CF6] shadow-sm shadow-pink-500/20'
                    : bar.amount > 0
                    ? 'bg-purple-300 group-hover:bg-[#8B5CF6]'
                    : 'bg-slate-100 group-hover:bg-slate-200'
                }`}
              >
                {/* Tooltip on hover */}
                <div className="opacity-0 group-hover:opacity-100 pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold py-0.5 px-2 rounded whitespace-nowrap transition-opacity z-10">
                  {bar.amount > 0 ? `€${bar.amount} (${bar.count} app.)` : 'Nessun incasso'}
                </div>
              </div>
              <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
                {'day' in bar ? bar.day : bar.label.split(' ')[0]}
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-1">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-gradient-to-t from-[#E95F8F] to-[#8B5CF6]" />
              Fascia alta (&gt;€600)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-purple-300" />
              Regolare
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsMonthPickerOpen(true)}
            className="text-[#8B5CF6] hover:underline font-bold flex items-center gap-1"
          >
            <span>Seleziona un altro periodo</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 4. BREAKDOWN OF TOP SERVICES IN SELECTED MONTH */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Services Table */}
        <div className="bg-white p-5 rounded-2xl border border-pink-100 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-900 text-sm md:text-base flex items-center gap-2">
              <Scissors className="w-4 h-4 text-[#8B5CF6]" />
              Classifica Servizi ({selectedMonthName})
            </h4>
            <span className="text-[11px] text-slate-400">{serviceStats.length} servizi eseguiti</span>
          </div>

          {serviceStats.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              Nessun servizio registrato in questo mese.
            </div>
          ) : (
            <div className="space-y-3">
              {serviceStats.slice(0, 5).map((srv, idx) => {
                const pct = totalRevenue > 0 ? Math.round((srv.revenue / totalRevenue) * 100) : 0;
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800 flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[10px] font-mono">
                          {idx + 1}
                        </span>
                        {srv.name}
                      </span>
                      <span className="font-bold text-slate-900 font-mono">
                        €{srv.revenue}{' '}
                        <span className="text-slate-400 font-normal">({srv.count} volte • {pct}%)</span>
                      </span>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${pct}%` }}
                        className={`h-full rounded-full transition-all duration-500 ${
                          idx === 0
                            ? 'bg-gradient-to-r from-[#E95F8F] to-[#8B5CF6]'
                            : idx === 1
                            ? 'bg-[#8B5CF6]'
                            : 'bg-purple-300'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Staff & Performance Breakdown */}
        <div className="bg-white p-5 rounded-2xl border border-pink-100 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-900 text-sm md:text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-[#E95F8F]" />
              Performance Staff ({selectedMonthName})
            </h4>
            <span className="text-[11px] text-slate-400">Team Salone</span>
          </div>

          <div className="space-y-3 pt-1">
            {['Elena (Titolare)', 'Sara'].map((staffMember, i) => {
              const staffApps = activeAppointments.filter((a) => a.staffName === staffMember);
              const staffRev = staffApps.reduce((s, a) => s + a.price, 0);
              const staffPct = totalRevenue > 0 ? Math.round((staffRev / totalRevenue) * 100) : 0;

              return (
                <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#E95F8F] to-[#8B5CF6] text-white flex items-center justify-center font-bold text-xs">
                        {staffMember[0]}
                      </div>
                      <div>
                        <span className="font-bold text-slate-800">{staffMember}</span>
                        <div className="text-[10px] text-slate-400">{staffApps.length} appuntamenti</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-slate-900 font-mono">€{staffRev}</span>
                      <div className="text-[10px] text-[#8B5CF6] font-bold">{staffPct}% incasso</div>
                    </div>
                  </div>
                  <div className="w-full bg-slate-200/70 h-1.5 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${staffPct}%` }}
                      className="h-full bg-gradient-to-r from-[#E95F8F] to-[#8B5CF6] rounded-full"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 5. INTERACTIVE MONTH & YEAR SELECTOR MODAL / POPOVER */}
      {/* ============================================================== */}
      {isMonthPickerOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-pink-100 overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 via-[#1E1B2E] to-purple-950 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-pink-300">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm md:text-base text-white">
                    Scegli il Mese delle Statistiche
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Seleziona qualsiasi mese per ricalcolare all'istante tutti i grafici e i KPI.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsMonthPickerOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 md:p-6 space-y-5">
              {/* Year Selector Bar */}
              <div className="flex items-center justify-between bg-slate-50 p-2 rounded-2xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setSelectedYear(selectedYear - 1)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700 transition flex items-center gap-1 shadow-2xs cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>{selectedYear - 1}</span>
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-base font-black text-slate-900 font-mono tracking-wide">
                    {selectedYear}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                    Anno Fiscale
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedYear(selectedYear + 1)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700 transition flex items-center gap-1 shadow-2xs cursor-pointer"
                >
                  <span>{selectedYear + 1}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Quick Select Buttons */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                  Scorciatoie:
                </span>
                <button
                  type="button"
                  onClick={() => handleSelectMonth(8, 2026)} // Settembre 2026
                  className="px-3 py-1 bg-pink-50 hover:bg-pink-100 text-[#E95F8F] font-bold rounded-lg border border-pink-200 transition cursor-pointer"
                >
                  Questo Mese (Settembre)
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectMonth(7, 2026)} // Agosto 2026
                  className="px-3 py-1 bg-purple-50 hover:bg-purple-100 text-[#8B5CF6] font-bold rounded-lg border border-purple-200 transition cursor-pointer"
                >
                  Mese Scorso (Agosto)
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectMonth(6, 2026)} // Luglio 2026
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition cursor-pointer"
                >
                  Luglio 2026
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectMonth(9, 2026)} // Ottobre 2026
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition cursor-pointer"
                >
                  Ottobre 2026
                </button>
              </div>

              {/* 12 Months Grid */}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                {MONTH_NAMES.map((mName, idx) => {
                  const isSelected = idx === selectedMonthIndex;
                  const summary = getMonthSummary(idx, selectedYear);
                  const isCurrentRealMonth = idx === 8 && selectedYear === 2026;

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectMonth(idx)}
                      className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition cursor-pointer relative group ${
                        isSelected
                          ? 'bg-gradient-to-br from-[#E95F8F] to-[#8B5CF6] text-white border-transparent shadow-md shadow-pink-500/25 ring-2 ring-[#E95F8F]'
                          : 'bg-slate-50/70 hover:bg-pink-50/40 border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <span className="font-bold text-xs md:text-sm">{mName}</span>
                        {isCurrentRealMonth && !isSelected && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#E95F8F]" title="Mese corrente" />
                        )}
                        {isSelected && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-white shrink-0" />
                        )}
                      </div>

                      {/* Revenue & count badge */}
                      <div className="mt-2 pt-1.5 border-t border-black/5 dark:border-white/10">
                        {summary.revenue > 0 ? (
                          <div className="space-y-0.5">
                            <span
                              className={`text-[11px] font-black font-mono block ${
                                isSelected ? 'text-white' : 'text-slate-900'
                              }`}
                            >
                              €{summary.revenue}
                            </span>
                            <span
                              className={`text-[9px] block ${
                                isSelected ? 'text-pink-100' : 'text-slate-400'
                              }`}
                            >
                              {summary.count} app.
                            </span>
                          </div>
                        ) : (
                          <span
                            className={`text-[10px] italic block ${
                              isSelected ? 'text-pink-100' : 'text-slate-400'
                            }`}
                          >
                            0 app.
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Selezionato:{' '}
                <strong className="text-slate-900">
                  {selectedMonthName} {selectedYear}
                </strong>
              </span>

              <button
                type="button"
                onClick={() => setIsMonthPickerOpen(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Conferma & Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
