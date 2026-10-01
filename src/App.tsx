import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Calendar,
  Users,
  UserPlus,
  Scissors,
  BarChart3,
  Settings,
  Plus,
  Phone,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  XCircle,
  Search,
  ChevronRight,
  TrendingUp,
  Store,
  FileText,
  Smartphone,
  Eye,
  Filter,
  Trash2,
  Edit2,
  Check,
  X,
  ExternalLink,
  Sparkles,
  ChevronDown,
  Image as ImageIcon,
  CreditCard,
  Star,
  Bell,
  History,
  LogOut,
  Database,
  Loader2
} from 'lucide-react';
import { Appointment, Client, Service, SalonSettings, AppointmentStatus, StaffMember, getStaffColorConfig, PaymentMethod, UserSession } from './types';
import { initialSettings, initialServices, initialClients, initialAppointments } from './data';
import { supabase } from './lib/supabase';
import {
  isValidUUID,
  fetchAppointmentsFromSupabase,
  fetchClientsFromSupabase,
  fetchServicesFromSupabase,
  insertAppointmentToSupabase,
  insertClientToSupabase,
  insertServiceToSupabase,
  updateAppointmentInSupabase,
  updateClientInSupabase,
  updateServiceInSupabase,
  deleteServiceInSupabase,
} from './lib/salonService';
import { CalendarAppointmentsView } from './components/CalendarAppointmentsView';
import { SalonLogoUploader } from './components/SalonLogoUploader';
import { SalonSubscriptionManager } from './components/SalonSubscriptionManager';
import { SalonStatsView } from './components/SalonStatsView';
import { StaffManager } from './components/StaffManager';
import { WhatsAppActionMenu } from './components/WhatsAppActionMenu';
import { QuickRemindersModal } from './components/QuickRemindersModal';
import { CheckoutModal } from './components/CheckoutModal';
import { CashRegisterSummary } from './components/CashRegisterSummary';
import { ClientReputationBadge } from './components/ClientReputationBadge';
import { ClientHistoryModal } from './components/ClientHistoryModal';
import { AuthScreen } from './components/AuthScreen';
import { getTodayStr, getTomorrowStr, getDateOffsetStr, formatDisplayDate } from './utils/date';
import {
  sanitizePhoneNumber,
  generateWhatsAppLink,
  openWhatsAppLink,
  buildAppointmentMessage
} from './utils/whatsapp';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'appointments' | 'clients' | 'services' | 'stats' | 'settings' | 'subscription'>('dashboard');
  const [mobileSimulator, setMobileSimulator] = useState(false);
  const [showSpecModal, setShowSpecModal] = useState(false);

  // Global Authentication & Session State
  const [currentUser, setCurrentUser] = useState<UserSession | null>(() => {
    try {
      const saved = localStorage.getItem('salondesk_session') || sessionStorage.getItem('salondesk_session');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return null;
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => currentUser !== null);
  
const isDemoSession = !currentUser || currentUser?.email === 'provatest@salone.it' || (currentUser as any)?.isDemo;  
  useEffect(() => {
    setIsAuthenticated(currentUser !== null);
  }, [currentUser]);

  // Quick Reminders Modal State
  const [isRemindersModalOpen, setIsRemindersModalOpen] = useState(false);

  // Core State (simulating Airtable / Softr data store with localStorage persistence)
  const [settings, setSettings] = useState<SalonSettings>(() => {
    try {
      const saved = localStorage.getItem('salondesk_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...initialSettings,
          ...parsed,
          staffMembers: (parsed.staffMembers && parsed.staffMembers.length > 0) ? parsed.staffMembers : initialSettings.staffMembers,
          subscription: parsed.subscription || initialSettings.subscription,
        };
      }
    } catch {
      // ignore
    }
    return initialSettings;
  });
const [services, setServices] = useState<Service[]>(() => {
  return isDemoSession ? initialServices : [];
});  const [clients, setClients] = useState<Client[]>(() => {
    try {
      const saved = localStorage.getItem('salondesk_clients');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((c: any) => ({
            ...c,
            noShowCount: typeof c.noShowCount === 'number' ? c.noShowCount : 0,
            isBlocked: !!c.isBlocked,
          }));
        }
      }
    } catch {
      // ignore
    }
return isDemoSession ? initialClients : []; 
});
const [appointments, setAppointments] = useState<Appointment[]>(() => {
  return isDemoSession ? initialAppointments : [];
});
  // Synchronize clients to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('salondesk_clients', JSON.stringify(clients));
    } catch {
      // ignore
    }
  }, [clients]);

  // Services management & interactive status state
  const [serviceStatusMenuOpen, setServiceStatusMenuOpen] = useState<string | null>(null);
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);
  const [servicesViewMode, setServicesViewMode] = useState<'table' | 'cards'>('table');
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState<string>('all');
  const [serviceStatusFilter, setServiceStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [serviceSearch, setServiceSearch] = useState('');

  // Modals & form state
  const [isNewAppointmentOpen, setIsNewAppointmentOpen] = useState(false);
  const [isNewClientOpen, setIsNewClientOpen] = useState(false);
  const [isNewServiceOpen, setIsNewServiceOpen] = useState(false);
  const [selectedClientForModal, setSelectedClientForModal] = useState<Client | null>(null);
  const [isClientHistoryOpen, setIsClientHistoryOpen] = useState(false);

  // Quick form inputs
  const [newAppClientName, setNewAppClientName] = useState('');
  const [newAppClientPhone, setNewAppClientPhone] = useState('');
  const [newAppDate, setNewAppDate] = useState(getTodayStr());
  const [newAppTime, setNewAppTime] = useState('11:00');
  const [newAppNotes, setNewAppNotes] = useState('');
  const [newAppStaffId, setNewAppStaffId] = useState<string>(() => {
    return initialSettings.staffMembers?.find(s => s.isActive)?.id || 'staff-1';
  });
  const [appointmentStaffFilter, setAppointmentStaffFilter] = useState<string>('all');

  // Checkout modal state
  const [checkoutAppointment, setCheckoutAppointment] = useState<Appointment | null>(null);

  // Multi-service selection state for appointment modal
  const [newAppSelectedServiceIds, setNewAppSelectedServiceIds] = useState<string[]>(() => {
    return initialServices[0] ? [initialServices[0].id] : [];
  });
  const [serviceModalSearch, setServiceModalSearch] = useState('');
  const [serviceModalCategory, setServiceModalCategory] = useState<string>('all');

  // Computed multi-service calculations (Durata Totale, Orario Stimato, Totale €)
  const selectedServicesList = useMemo(() => {
    return services.filter(s => newAppSelectedServiceIds.includes(s.id));
  }, [services, newAppSelectedServiceIds]);

  const totalSelectedMinutes = useMemo(() => {
    return selectedServicesList.reduce((sum, s) => sum + s.durationMinutes, 0);
  }, [selectedServicesList]);

  const totalSelectedPrice = useMemo(() => {
    return selectedServicesList.reduce((sum, s) => sum + s.price, 0);
  }, [selectedServicesList]);

  const estimatedEndTime = useMemo(() => {
    if (!newAppTime) return '--:--';
    const [hStr, mStr] = newAppTime.split(':');
    const h = parseInt(hStr, 10) || 0;
    const m = parseInt(mStr, 10) || 0;
    const totalMins = h * 60 + m + totalSelectedMinutes;
    const endH = Math.floor(totalMins / 60) % 24;
    const endM = totalMins % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  }, [newAppTime, totalSelectedMinutes]);

  const modalAvailableCategories = useMemo(() => {
    const cats = new Set<string>();
    services.forEach(s => {
      if (s.isActive) cats.add(s.category);
    });
    return ['all', ...Array.from(cats)];
  }, [services]);

  const filteredServicesForModal = useMemo(() => {
    return services.filter(s => {
      if (!s.isActive) return false;
      const matchCategory = serviceModalCategory === 'all' || s.category === serviceModalCategory;
      const query = serviceModalSearch.trim().toLowerCase();
      const matchQuery = !query ||
        s.name.toLowerCase().includes(query) ||
        s.category.toLowerCase().includes(query) ||
        (s.description && s.description.toLowerCase().includes(query));
      return matchCategory && matchQuery;
    });
  }, [services, serviceModalCategory, serviceModalSearch]);

  const handleToggleService = (serviceId: string) => {
    setNewAppSelectedServiceIds(prev => {
      if (prev.includes(serviceId)) {
        return prev.filter(id => id !== serviceId);
      } else {
        return [...prev, serviceId];
      }
    });
  };

  // Autocomplete & Quick New Client state for new appointment
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [selectedClientForApp, setSelectedClientForApp] = useState<Client | null>(null);
  const [isQuickNewClientMode, setIsQuickNewClientMode] = useState(false);
  const [quickNewClientFirstName, setQuickNewClientFirstName] = useState('');
  const [quickNewClientLastName, setQuickNewClientLastName] = useState('');
  const [quickNewClientPhone, setQuickNewClientPhone] = useState('');
  const [quickNewClientNotes, setQuickNewClientNotes] = useState('');
  const clientSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clientSearchRef.current && !clientSearchRef.current.contains(event.target as Node)) {
        setIsClientDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filters
  const [clientSearch, setClientSearch] = useState('');
  const [clientFilterStatus, setClientFilterStatus] = useState<'all' | 'Attivo' | 'Inattivo' | 'VIP'>('all');
  const [appointmentDateFilter, setAppointmentDateFilter] = useState<'today' | 'all' | 'noshow'>('today');
  const [appointmentViewMode, setAppointmentViewMode] = useState<'calendar' | 'timeline' | 'table'>('calendar');

  // Success toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const currentSalonId = currentUser?.salonId || settings.salonId || 'salon-lucestile-01';

  // Supabase Data Loading & Sync State
  const [isDataLoading, setIsDataLoading] = useState(false);

  // Ref to track current user state without re-triggering the subscription effect
  const currentUserRef = useRef<UserSession | null>(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Track user ID that has already been fetched to prevent duplicate parallel fetches and infinite loops
  const fetchedSessionUserIdRef = useRef<string | null>(null);

  // 2. PREVENZIONE LOOP SU onAuthStateChange:
  // Assicurati che il listener 'supabase.auth.onAuthStateChange' sia all'interno di un 'useEffect'
  // con dipendenze vuote '[]' e con corretta funzione di cleanup (subscription.unsubscribe()).
  // Non rieseguire chiamate di fetching se l'utente è già presente nello stato e la sessione non è cambiata.
  useEffect(() => {
    const { data: authSubscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        if (currentUserRef.current && currentUserRef.current.id !== 'usr-demo-01') {
          fetchedSessionUserIdRef.current = null;
          setCurrentUser(null);
          localStorage.removeItem('salondesk_session');
          sessionStorage.removeItem('salondesk_session');
        }
        return;
      }

      const sessionUser = session.user;
      if (!sessionUser) return;

      // Se l'utente è già presente nello stato e la sessione non è cambiata, evita re-fetching
      if (
        currentUserRef.current?.id === sessionUser.id &&
        currentUserRef.current.salonId &&
        currentUserRef.current.salonId !== 'loading' &&
        fetchedSessionUserIdRef.current === sessionUser.id
      ) {
        return;
      }

      fetchedSessionUserIdRef.current = sessionUser.id;

      // Sblocco immediato: recupera solo la sessione minima indispensabile senza bloccare l'interfaccia
      try {
        const meta = sessionUser.user_metadata || {};

        let knownSalonId = (currentUserRef.current?.salonId && isValidUUID(currentUserRef.current.salonId))
          ? currentUserRef.current.salonId
          : (meta.salon_id && isValidUUID(meta.salon_id)) ? meta.salon_id : '';

        if (!knownSalonId) {
          try {
            const saved = localStorage.getItem('salondesk_session') || sessionStorage.getItem('salondesk_session');
            if (saved) {
              const parsed = JSON.parse(saved);
              if (parsed.id === sessionUser.id && parsed.salonId && isValidUUID(parsed.salonId)) {
                knownSalonId = parsed.salonId;
              }
            }
          } catch {}
        }

        // Se non abbiamo ancora il salonId, recuperiamo solo il profilo utente (1 riga veloce)
        if (!knownSalonId) {
          const { data: profile } = await supabase
            .from('salon_users')
            .select('salon_id, role, full_name')
            .eq('id', sessionUser.id)
            .maybeSingle();

          if (profile?.salon_id) {
            knownSalonId = profile.salon_id;
          }
        }

        const salonName = meta.salon_name || 'Il Mio Salone';
        const ownerName = meta.owner_name || sessionUser.email?.split('@')[0] || 'Titolare';

        const finalSession: UserSession = {
          id: sessionUser.id,
          email: sessionUser.email || '',
          salonId: knownSalonId || 'salon-default',
          salonName: currentUserRef.current?.salonName || salonName,
          ownerName: currentUserRef.current?.ownerName || ownerName,
          role: 'owner',
        };

        setCurrentUser(finalSession);
        localStorage.setItem('salondesk_session', JSON.stringify(finalSession));

        // Carica le impostazioni del salone in background senza ritardare la UI
        if (knownSalonId && isValidUUID(knownSalonId)) {
          Promise.resolve(
            supabase
              .from('salons')
              .select('*')
              .eq('id', knownSalonId)
              .maybeSingle()
          )
            .then(({ data: salonRecord }) => {
              if (salonRecord) {
                setSettings(prev => ({
                  ...prev,
                  salonId: salonRecord.id,
                  name: salonRecord.name,
                  ownerName: salonRecord.owner_name,
                  email: salonRecord.email,
                  phone: salonRecord.whatsapp_number || prev.phone,
                  whatsappNumber: salonRecord.whatsapp_number || prev.whatsappNumber,
                  address: salonRecord.address || prev.address,
                  city: salonRecord.city || prev.city,
                  openHours: salonRecord.open_hours || prev.openHours,
                }));
              }
            })
            .catch(() => {});
        }
      } catch (e) {
        console.warn('Recupero sessione leggera:', e);
      }
    });

    return () => {
      authSubscription.subscription.unsubscribe();
    };
  }, []);

  // Auth Action Handlers
  const handleLogin = (session: UserSession, rememberMe: boolean, salonSettings?: SalonSettings) => {
    dashboardLoadedRef.current = null;
    appointmentsLoadedRef.current = null;
    clientsLoadedRef.current = null;
    servicesLoadedRef.current = null;

    if (rememberMe) {
      localStorage.setItem('salondesk_session', JSON.stringify(session));
    } else {
      sessionStorage.setItem('salondesk_session', JSON.stringify(session));
    }
    if (salonSettings) {
      setSettings(prev => ({
        ...prev,
        ...salonSettings,
        staffMembers: prev.staffMembers || [
          {
            id: 'staff-1',
            name: session.ownerName,
            role: 'Titolare',
            color: 'purple',
            isActive: true,
            email: session.email,
          }
        ]
      }));
    }
    setIsAuthenticated(true);
    setCurrentUser(session);
    showToast(`Bentornato/a in ${session.salonName}!`);
  };

  const handleRegisterSalon = (session: UserSession, salonSettings: SalonSettings) => {
    dashboardLoadedRef.current = null;
    appointmentsLoadedRef.current = null;
    clientsLoadedRef.current = null;
    servicesLoadedRef.current = null;

    setSettings(salonSettings);
    try {
      localStorage.setItem('salondesk_settings', JSON.stringify(salonSettings));
      localStorage.setItem('salondesk_session', JSON.stringify(session));
    } catch {
      // ignore
    }
    setIsAuthenticated(true);
    setCurrentUser(session);
    showToast("Benvenuto su SalonDesk! Il tuo salone è pronto all'uso su Supabase PostgreSQL.");
  };

  const handleQuickDemoLogin = () => {
    dashboardLoadedRef.current = null;
    appointmentsLoadedRef.current = null;
    clientsLoadedRef.current = null;
    servicesLoadedRef.current = null;

    const demoSession: UserSession = {
      id: 'usr-demo-01',
      email: 'elena@lucestile.it',
      salonId: 'salon-lucestile-01',
      salonName: 'Luce & Stile Hair & Beauty',
      ownerName: 'Elena Bianchi',
      role: 'owner',
    };
    localStorage.setItem('salondesk_session', JSON.stringify(demoSession));
    setIsAuthenticated(true);
    setCurrentUser(demoSession);
    showToast(`Accesso Demo effettuato: ${demoSession.salonName} (${demoSession.ownerName})`);
  };

  const handleLogout = async () => {
    dashboardLoadedRef.current = null;
    appointmentsLoadedRef.current = null;
    clientsLoadedRef.current = null;
    servicesLoadedRef.current = null;

    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    try {
      localStorage.removeItem('salondesk_session');
      sessionStorage.removeItem('salondesk_session');
    } catch {
      // ignore
    }
    setIsAuthenticated(false);
    setCurrentUser(null);
    showToast('Disconnessione effettuata con successo.');
  };

  // Calculations for Today & Tomorrow (Dynamic based on browser date)
  const todayStr = getTodayStr();

  // Helper per caricamento delegato con fallback automatico su mock se la rete tarda più di 2 secondi
  const fetchWithMockFallback = async <T,>(
    fetchFn: () => Promise<T>,
    mockFallback: T,
    timeoutMs = 2000,
    label = 'Dati'
  ): Promise<T> => {
    let timeoutId: any;
    const timeoutPromise = new Promise<T>((resolve) => {
      timeoutId = setTimeout(() => {
        console.warn(`[Timeout ${timeoutMs}ms] ${label}: fallback immediato sui dati mock.`);
        resolve(mockFallback);
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([
        fetchFn().then((res) => {
          clearTimeout(timeoutId);
          return res;
        }),
        timeoutPromise,
      ]);
      return result;
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn(`[Errore fetch] ${label}: fallback sui dati mock.`, err);
      return mockFallback;
    }
  };

  // Tracciamento schede caricate per evitare re-fetching non necessari
  const dashboardLoadedRef = useRef<string | null>(null);
  const appointmentsLoadedRef = useRef<string | null>(null);
  const clientsLoadedRef = useRef<string | null>(null);
  const servicesLoadedRef = useRef<string | null>(null);

  // 1. Caricamento Dati per la scheda DASHBOARD (oggi e clienti minimi)
  useEffect(() => {
    if (!currentUser?.salonId) return;
    if (activeTab !== 'dashboard') return;
    if (dashboardLoadedRef.current === currentUser.salonId) return;

    console.log("3. Caricamento dati... (Dashboard)");
    setIsDataLoading(true);

    const salonId = currentUser.salonId;
    const isRealUUID = isValidUUID(salonId);
    
const fallbackApps = isDemoSession ? initialAppointments : [];
const fallbackCls = isDemoSession ? initialClients : [];

    Promise.all([
      fetchWithMockFallback(
        isRealUUID ? () => fetchAppointmentsFromSupabase(salonId, todayStr) : async () => fallbackApps,
        fallbackApps,
        2000,
        'Appuntamenti Dashboard'
      ),
      fetchWithMockFallback(
        isRealUUID ? () => fetchClientsFromSupabase(salonId) : async () => fallbackCls,
        fallbackCls,
        2000,
        'Clienti Dashboard'
      ),
    ]).then(([apps, cls]) => {
      dashboardLoadedRef.current = salonId;
      setAppointments(Array.isArray(apps) ? apps : []);
      setClients(Array.isArray(cls) ? cls : []);
      setIsDataLoading(false);
    });
  
  }, [activeTab, currentUser?.salonId, todayStr]);

  // 2. Caricamento Dati per la scheda APPOINTMENTS (Appuntamenti)
  useEffect(() => {
    if (!currentUser?.salonId) return;
    if (activeTab !== 'appointments') return;

    const loadKey = `${currentUser.salonId}_${appointmentDateFilter}`;
    if (appointmentsLoadedRef.current === loadKey) return;

    console.log("3. Caricamento dati... (Appuntamenti)");
    setIsDataLoading(true);

    const salonId = currentUser.salonId;
    const isRealUUID = isValidUUID(salonId);
    const dateParam = appointmentDateFilter === 'today' ? todayStr : undefined;

   const fallbackApps = isDemoSession ? initialAppointments : [];

    fetchWithMockFallback(
      isRealUUID ? () => fetchAppointmentsFromSupabase(salonId, dateParam) : async () => fallbackApps,
      fallbackApps,
      2000,
      'Appuntamenti'
    ).then((apps) => {
      appointmentsLoadedRef.current = loadKey;
      setAppointments(Array.isArray(apps) ? apps : []);
      setIsDataLoading(false);
    });
  }, [activeTab, currentUser?.salonId, appointmentDateFilter, todayStr]);

  // 3. Caricamento Dati per la scheda CLIENTS (Clienti)
  useEffect(() => {
    if (!currentUser?.salonId) return;
    if (activeTab !== 'clients') return;
    if (clientsLoadedRef.current === currentUser.salonId) return;

    console.log("3. Caricamento dati... (Clienti)");
    setIsDataLoading(true);

    const salonId = currentUser.salonId;
    const isRealUUID = isValidUUID(salonId);
const fallbackCls = isDemoSession ? initialClients : [];
   fetchWithMockFallback(
      isRealUUID ? () => fetchClientsFromSupabase(salonId) : async () => fallbackCls,
      fallbackCls,
      2000,
      'Clienti'
    ).then((cls) => {
      clientsLoadedRef.current = salonId;
      setClients(Array.isArray(cls) ? cls : []);
      setIsDataLoading(false);
    });
  }, [activeTab, currentUser?.salonId]);

  // 4. Caricamento Dati per la scheda SERVICES (Servizi)
  useEffect(() => {
    if (!currentUser?.salonId) return;
    if (activeTab !== 'services') return;
    if (servicesLoadedRef.current === currentUser.salonId) return;

    console.log("3. Caricamento dati... (Servizi)");
    setIsDataLoading(true);

    const salonId = currentUser.salonId;
    const isRealUUID = isValidUUID(salonId);
    
const fallbackServ = isDemoSession ? initialServices : [];

    fetchWithMockFallback(
      isRealUUID ? () => fetchServicesFromSupabase(salonId) : async () => fallbackServ,
      fallbackServ,
      2000,
      'Servizi'
    ).then((srvs) => {
      servicesLoadedRef.current = salonId;
      setServices(Array.isArray(srvs) ? srvs : []);
      setIsDataLoading(false);
    });
  
  }, [activeTab, currentUser?.salonId]);

  // 5. Statistiche: logging dedicato quando aperta
  useEffect(() => {
    if (activeTab === 'stats') {
      console.log("3. Caricamento dati... (Statistiche)");
    }
  }, [activeTab]);
  const todayAppointments = appointments.filter(a => a.date === todayStr);
  const todayRevenue = todayAppointments
    .filter(a => a.status !== 'Annullato' && a.status !== 'No-Show')
    .reduce((acc, curr) => acc + curr.price, 0);

  const tomorrowStr = getTomorrowStr();

  const tomorrowAppointments = useMemo(() => {
    return appointments
      .filter(a => a.date === tomorrowStr && a.status !== 'Annullato')
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [appointments, tomorrowStr]);

  const todayCompletedAppointments = useMemo(() => {
    return appointments
      .filter(a => a.date === todayStr && a.status === 'Completato')
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [appointments, todayStr]);

  const totalClientsCount = clients.length;
  const inactiveClients = clients.filter(c => c.status === 'Inattivo');
  const noShowAppointments = appointments.filter(a => a.status === 'No-Show');

  // Status badge styling helper
  const getStatusBadge = (status: AppointmentStatus) => {
    switch (status) {
      case 'Confermato':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle2 className="w-3 h-3" /> Confermato</span>;
      case 'In corso':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 animate-pulse"><Sparkles className="w-3 h-3 text-[#8B5CF6]" /> In poltrona</span>;
      case 'Completato':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200"><Check className="w-3 h-3" /> Fatto & Pagato</span>;
      case 'No-Show':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200"><AlertCircle className="w-3 h-3 text-rose-600" /> Non presentato</span>;
      case 'Annullato':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200"><XCircle className="w-3 h-3" /> Annullato</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">{status}</span>;
    }
  };

  const handleOpenCheckout = (app: Appointment) => {
    setCheckoutAppointment(app);
  };

  // Helper to find client object for an appointment
  const findClientForApp = (app: Appointment): Client | undefined => {
    const fullName = (app.clientName || '').toLowerCase().trim();
    const phoneClean = (app.clientPhone || '').replace(/[\s+-]/g, '');
    return clients.find(c => {
      const cFullName = `${c.firstName} ${c.lastName}`.toLowerCase().trim();
      const cPhoneClean = (c.phone || '').replace(/[\s+-]/g, '');
      return cFullName === fullName || (phoneClean && cPhoneClean && phoneClean === cPhoneClean);
    });
  };

  // Client History & Technical Sheet handlers
  const handleOpenClientHistory = (clientOrName: Client | string, phone?: string) => {
    if (typeof clientOrName !== 'string') {
      setSelectedClientForModal(clientOrName);
      setIsClientHistoryOpen(true);
      return;
    }
    const nameStr: string = clientOrName;
    const nameToFind = (nameStr || '').toLowerCase().trim();
    const phoneClean = (phone || '').replace(/[\s+-]/g, '');
    const found = clients.find(c => {
      const cFullName = `${c.firstName} ${c.lastName}`.toLowerCase().trim();
      const cPhoneClean = (c.phone || '').replace(/[\s+-]/g, '');
      return cFullName === nameToFind || (phoneClean && cPhoneClean && phoneClean === cPhoneClean);
    });
    if (found) {
      setSelectedClientForModal(found);
    } else {
      const parts = (nameStr || '').trim().split(' ');
      const fallbackClient: Client = {
        id: `cli-${Date.now()}`,
        salonId: currentSalonId,
        firstName: parts[0] || 'Cliente',
        lastName: parts.slice(1).join(' ') || '',
        phone: phone || '',
        email: '',
        notes: '',
        technicalNotes: '',
        totalAppointments: appointments.filter(a => a.clientName.toLowerCase().trim() === nameToFind).length,
        totalSpent: appointments.filter(a => a.clientName.toLowerCase().trim() === nameToFind && a.status === 'Completato').reduce((s, a) => s + a.price, 0),
        status: 'Attivo',
        tags: [],
        noShowCount: 0,
        isBlocked: false,
      };
      setSelectedClientForModal(fallbackClient);
    }
    setIsClientHistoryOpen(true);
  };

  const handleUpdateClientFromModal = (updatedClient: Client) => {
    setClients(prev => {
      const exists = prev.some(c => c.id === updatedClient.id);
      if (exists) {
        return prev.map(c => c.id === updatedClient.id ? updatedClient : c);
      }
      return [updatedClient, ...prev];
    });
    if (isValidUUID(updatedClient.id)) {
      updateClientInSupabase(updatedClient.id, {
        technicalNotes: updatedClient.technicalNotes,
        firstName: updatedClient.firstName,
        lastName: updatedClient.lastName,
        phone: updatedClient.phone,
        email: updatedClient.email,
        status: updatedClient.status,
        noShowCount: updatedClient.noShowCount,
      });
    }
    setSelectedClientForModal(updatedClient);
  };

  const handleBookAppointmentForClient = (client: Client) => {
    setIsClientHistoryOpen(false);
    handleOpenNewAppointment();
    handleSelectClientForApp(client);
  };

  const handleConfirmPayment = (
    appointmentId: string,
    paymentMethod: PaymentMethod,
    finalAmount: number,
    notes?: string
  ) => {
    const nowIso = new Date().toISOString();
    const targetApp = appointments.find(a => a.id === appointmentId);
    
    // If appointment was previously marked as No-Show and is now completed & paid, decrement No-Show counter
    if (targetApp && targetApp.status === 'No-Show') {
      setClients(prevClients => {
        const found = prevClients.find(c =>
          c.phone === targetApp.clientPhone ||
          `${c.firstName} ${c.lastName}`.toLowerCase().trim() === targetApp.clientName.toLowerCase().trim()
        );
        if (!found) return prevClients;
        return prevClients.map(c => c.id === found.id ? { ...c, noShowCount: Math.max(0, (c.noShowCount || 0) - 1) } : c);
      });
    }

    setAppointments(prev =>
      prev.map(a => {
        if (a.id === appointmentId) {
          return {
            ...a,
            status: 'Completato' as AppointmentStatus,
            isPaid: true,
            paymentMethod,
            price: finalAmount,
            paidAt: nowIso,
            notes: notes ? (a.notes ? `${a.notes} | ${notes}` : notes) : a.notes,
          };
        }
        return a;
      })
    );

    if (isValidUUID(appointmentId)) {
      updateAppointmentInSupabase(appointmentId, {
        status: 'Completato',
        isPaid: true,
        paymentMethod,
        price: finalAmount,
        notes: notes ? (targetApp?.notes ? `${targetApp.notes} | ${notes}` : notes) : targetApp?.notes,
      });
    }

    showToast(`Incasso di €${finalAmount.toFixed(2)} registrato con ${paymentMethod}!`);
    setCheckoutAppointment(null);
  };

  const handleStatusChange = (id: string, newStatus: AppointmentStatus) => {
    const targetApp = appointments.find(a => a.id === id);
    if (!targetApp) return;

    if (newStatus === 'Completato' && !targetApp.isPaid) {
      handleOpenCheckout(targetApp);
      return;
    }

    const prevStatus = targetApp.status;
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));

    if (isValidUUID(id)) {
      updateAppointmentInSupabase(id, { status: newStatus });
    }

    // 1. Automatic No-Show tracking: Increment noShowCount and alert via toast
    if (prevStatus !== 'No-Show' && newStatus === 'No-Show') {
      let clientUpdatedName = targetApp.clientName;
      setClients(prevClients => {
        const found = prevClients.find(c =>
          c.phone === targetApp.clientPhone ||
          `${c.firstName} ${c.lastName}`.toLowerCase().trim() === targetApp.clientName.toLowerCase().trim()
        );
        if (!found) return prevClients;
        clientUpdatedName = `${found.firstName} ${found.lastName}`;
        const newCount = (found.noShowCount || 0) + 1;
        if (isValidUUID(found.id)) {
          updateClientInSupabase(found.id, { noShowCount: newCount });
        }
        return prevClients.map(c => c.id === found.id ? { ...c, noShowCount: newCount } : c);
      });
      showToast(`Registrato No-Show per ${clientUpdatedName}. Storico affidabilità aggiornato.`);
      return;
    }

    // 2. Rectification: If changing away from No-Show, decrement noShowCount
    if (prevStatus === 'No-Show' && newStatus !== 'No-Show') {
      setClients(prevClients => {
        const found = prevClients.find(c =>
          c.phone === targetApp.clientPhone ||
          `${c.firstName} ${c.lastName}`.toLowerCase().trim() === targetApp.clientName.toLowerCase().trim()
        );
        if (!found) return prevClients;
        const newCount = Math.max(0, (found.noShowCount || 0) - 1);
        if (isValidUUID(found.id)) {
          updateClientInSupabase(found.id, { noShowCount: newCount });
        }
        return prevClients.map(c => c.id === found.id ? { ...c, noShowCount: newCount } : c);
      });
      showToast(`Stato appuntamento aggiornato a: ${newStatus}. Contatore No-Show rettificato.`);
      return;
    }

    showToast(`Stato appuntamento aggiornato a: ${newStatus}`);
  };

  const handleSetServiceActive = (id: string, isActive: boolean) => {
    setServices(prev => prev.map(s => s.id === id ? { ...s, isActive } : s));
    if (isValidUUID(id)) {
      updateServiceInSupabase(id, { isActive });
    }
    showToast(`Servizio impostato su: ${isActive ? 'Attivo' : 'Disattivato'}`);
  };

  const handleConfirmDeleteService = () => {
    if (!serviceToDelete) return;
    const deletedName = serviceToDelete.name;
    const deletedId = serviceToDelete.id;
    setServices(prev => prev.filter(s => s.id !== deletedId));
    if (isValidUUID(deletedId)) {
      deleteServiceInSupabase(deletedId);
    }
    setServiceToDelete(null);
    showToast(`Servizio "${deletedName}" eliminato dal listino`);
  };

  const handleLogoChange = (newLogoUrl: string | undefined) => {
    const updatedSettings = { ...settings, logoUrl: newLogoUrl };
    setSettings(updatedSettings);
    try {
      localStorage.setItem('salondesk_settings', JSON.stringify(updatedSettings));
    } catch {
      // ignore
    }
  };

  const handleSaveSettings = () => {
    try {
      localStorage.setItem('salondesk_settings', JSON.stringify(settings));
    } catch {
      // ignore
    }
    showToast('Impostazioni e logo del salone salvati con successo!');
  };

  // Controllo preventivo validità abbonamento
  const isSubscriptionValid =
    settings.subscription?.status === 'Attivo' ||
    settings.subscription?.status === 'trial' ||
    settings.subscription?.status === 'In prova' ||
    settings.subscription?.status === 'In scadenza';

  const resetNewAppointmentState = () => {
    setNewAppClientName('');
    setNewAppClientPhone('');
    setNewAppNotes('');
    setClientSearchQuery('');
    setIsClientDropdownOpen(false);
    setSelectedClientForApp(null);
    setIsQuickNewClientMode(false);
    setQuickNewClientFirstName('');
    setQuickNewClientLastName('');
    setQuickNewClientPhone('');
    setQuickNewClientNotes('');
    setNewAppStaffId(settings.staffMembers?.find(s => s.isActive)?.id || 'staff-1');
    setNewAppSelectedServiceIds(services[0] ? [services[0].id] : []);
    setServiceModalSearch('');
    setServiceModalCategory('all');
  };

  const handleUpdateStaff = (updatedStaff: StaffMember[]) => {
    const updated = { ...settings, staffMembers: updatedStaff };
    setSettings(updated);
    try {
      localStorage.setItem('salondesk_settings', JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const handleCloseNewAppointment = () => {
    setIsNewAppointmentOpen(false);
    resetNewAppointmentState();
  };

  const handleOpenNewAppointment = (date?: string) => {
    if (!isSubscriptionValid) {
      showToast('Abbonamento scaduto. Rinnova per inserire nuovi appuntamenti.');
      setActiveTab('subscription');
      return;
    }
    resetNewAppointmentState();
    if (date) {
      setNewAppDate(date);
    }
    setIsNewAppointmentOpen(true);
  };

  const handleOpenNewAppointmentWithDate = (date: string) => {
    handleOpenNewAppointment(date);
  };

  const handleSelectClientForApp = (client: Client) => {
    setSelectedClientForApp(client);
    setNewAppClientName(`${client.firstName} ${client.lastName}`.trim());
    setNewAppClientPhone(client.phone);
    setClientSearchQuery(`${client.firstName} ${client.lastName}`.trim());
    setIsClientDropdownOpen(false);
    setIsQuickNewClientMode(false);
  };

  const handleStartQuickNewClient = (query: string) => {
    setIsQuickNewClientMode(true);
    setSelectedClientForApp(null);
    setIsClientDropdownOpen(false);
    const trimmed = query.trim();
    if (/^\+?\d[\d\s-]{4,}$/.test(trimmed)) {
      setQuickNewClientPhone(trimmed);
      setQuickNewClientFirstName('');
      setQuickNewClientLastName('');
    } else {
      const parts = trimmed.split(/\s+/);
      const fName = parts[0] || '';
      const lName = parts.slice(1).join(' ') || '';
      setQuickNewClientFirstName(fName);
      setQuickNewClientLastName(lName);
      setQuickNewClientPhone(newAppClientPhone || '');
    }
    setQuickNewClientNotes('');
  };

  const handleAddAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSubscriptionValid) {
      showToast('Abbonamento scaduto. Rinnova per inserire nuovi appuntamenti.');
      handleCloseNewAppointment();
      setActiveTab('subscription');
      return;
    }

    if (newAppSelectedServiceIds.length === 0) {
      showToast('Seleziona almeno un servizio per l\'appuntamento');
      return;
    }

    const currentSelectedServices = services.filter(s => newAppSelectedServiceIds.includes(s.id));
    const finalPrice = currentSelectedServices.reduce((sum, s) => sum + s.price, 0);
    const finalDuration = currentSelectedServices.reduce((sum, s) => sum + s.durationMinutes, 0);
    const chosenServiceIds = currentSelectedServices.map(s => s.id);
    const chosenServiceNames = currentSelectedServices.map(s => s.name);
    const formattedServiceName = chosenServiceNames.join(' + ');

    const chosenStaff = (settings.staffMembers || []).find(s => s.id === newAppStaffId) || (settings.staffMembers || []).find(s => s.isActive) || settings.staffMembers?.[0];
    const finalStaffId = chosenStaff?.id || 'staff-1';
    const finalStaffName = chosenStaff ? chosenStaff.name : settings.ownerName;

    // Branch 1: Modalità "Nuovo Cliente Rapido"
    if (isQuickNewClientMode) {
      if (!quickNewClientFirstName.trim()) {
        showToast('Inserisci il nome del nuovo cliente');
        return;
      }
      const fullClientName = `${quickNewClientFirstName.trim()} ${quickNewClientLastName.trim()}`.trim();
      const finalPhone = quickNewClientPhone.trim() || '+39 340 0000000';

      let createdClient: Client | null = null;
      if (isValidUUID(currentSalonId)) {
        createdClient = await insertClientToSupabase({
          salonId: currentSalonId,
          firstName: quickNewClientFirstName.trim(),
          lastName: quickNewClientLastName.trim(),
          phone: finalPhone,
          email: '',
          technicalNotes: quickNewClientNotes.trim(),
          status: 'Attivo',
          noShowCount: 0,
        });
      }

      const newCreatedClient: Client = createdClient || {
        id: `cli-${Date.now()}`,
        salonId: currentSalonId,
        firstName: quickNewClientFirstName.trim(),
        lastName: quickNewClientLastName.trim(),
        phone: finalPhone,
        email: '',
        notes: quickNewClientNotes.trim(),
        technicalNotes: quickNewClientNotes.trim(),
        totalAppointments: 1,
        totalSpent: finalPrice,
        lastAppointmentDate: newAppDate,
        noShowCount: 0,
        isBlocked: false,
        status: 'Attivo',
        tags: ['Nuovo Cliente'],
      };
      setClients(prev => [newCreatedClient, ...prev]);

      let createdApp: Appointment | null = null;
      if (isValidUUID(currentSalonId)) {
        createdApp = await insertAppointmentToSupabase({
          salonId: currentSalonId,
          clientName: fullClientName,
          clientPhone: finalPhone,
          clientId: newCreatedClient.id,
          serviceNames: chosenServiceNames,
          date: newAppDate,
          time: newAppTime,
          endTime: estimatedEndTime,
          price: finalPrice,
          durationMinutes: finalDuration,
          status: 'Confermato',
          notes: newAppNotes || (quickNewClientNotes ? `Nota cliente: ${quickNewClientNotes}` : ''),
          staffId: finalStaffId,
          staffName: finalStaffName,
        });
      }

      const newApp: Appointment = createdApp || {
        id: `app-${Date.now()}`,
        salonId: currentSalonId,
        clientName: fullClientName,
        clientPhone: finalPhone,
        serviceId: chosenServiceIds[0] || '',
        serviceName: formattedServiceName,
        serviceIds: chosenServiceIds,
        serviceNames: chosenServiceNames,
        price: finalPrice,
        durationMinutes: finalDuration,
        date: newAppDate,
        time: newAppTime,
        status: 'Confermato',
        notes: newAppNotes || (quickNewClientNotes ? `Nota cliente: ${quickNewClientNotes}` : ''),
        staffId: finalStaffId,
        staffName: finalStaffName,
      };
      setAppointments(prev => [newApp, ...prev]);
      handleCloseNewAppointment();
      showToast(`Cliente ${fullClientName} creato e appuntamento salvato con ${finalStaffName}!`);
      return;
    }

    // Branch 2: Cliente esistente selezionato o cercato
    const finalClientName = selectedClientForApp
      ? `${selectedClientForApp.firstName} ${selectedClientForApp.lastName}`.trim()
      : (newAppClientName.trim() || clientSearchQuery.trim());

    if (!finalClientName) {
      showToast('Seleziona un cliente esistente o aggiungine uno nuovo');
      return;
    }

    const finalClientPhone = newAppClientPhone.trim() || (selectedClientForApp ? selectedClientForApp.phone : '+39 340 0000000');

    // Aggiorna metriche cliente se selezionato dall'elenco
    if (selectedClientForApp) {
      setClients(prev => prev.map(c => c.id === selectedClientForApp.id ? {
        ...c,
        totalAppointments: (c.totalAppointments || 0) + 1,
        totalSpent: (c.totalSpent || 0) + finalPrice,
        lastAppointmentDate: newAppDate,
      } : c));
    }

    let createdApp: Appointment | null = null;
    if (isValidUUID(currentSalonId)) {
      createdApp = await insertAppointmentToSupabase({
        salonId: currentSalonId,
        clientName: finalClientName,
        clientPhone: finalClientPhone,
        clientId: selectedClientForApp?.id,
        serviceNames: chosenServiceNames,
        date: newAppDate,
        time: newAppTime,
        endTime: estimatedEndTime,
        price: finalPrice,
        durationMinutes: finalDuration,
        status: 'Confermato',
        notes: newAppNotes,
        staffId: finalStaffId,
        staffName: finalStaffName,
      });
    }

    const newApp: Appointment = createdApp || {
      id: `app-${Date.now()}`,
      salonId: currentSalonId,
      clientName: finalClientName,
      clientPhone: finalClientPhone,
      serviceId: chosenServiceIds[0] || '',
      serviceName: formattedServiceName,
      serviceIds: chosenServiceIds,
      serviceNames: chosenServiceNames,
      price: finalPrice,
      durationMinutes: finalDuration,
      date: newAppDate,
      time: newAppTime,
      status: 'Confermato',
      notes: newAppNotes,
      staffId: finalStaffId,
      staffName: finalStaffName,
    };
    setAppointments(prev => [newApp, ...prev]);
    handleCloseNewAppointment();
    showToast(`Nuovo appuntamento salvato con ${finalStaffName}!`);
  };

  const openWhatsApp = (phone: string, clientName: string, serviceName?: string, time?: string) => {
    const msg = buildAppointmentMessage({
      clientName,
      salonName: settings.name,
      serviceName,
      time,
      address: settings.address,
      city: settings.city,
    });
    openWhatsAppLink(phone, msg);
  };

  // Client search filtering for appointment modal
  const trimmedClientQuery = clientSearchQuery.trim().toLowerCase();
  const cleanPhoneQuery = trimmedClientQuery.replace(/[\s+-]/g, '');
  const matchingClients = clients.filter(c => {
    if (!trimmedClientQuery) return true;
    const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
    const revName = `${c.lastName} ${c.firstName}`.toLowerCase();
    const phoneClean = (c.phone || '').replace(/[\s+-]/g, '');
    return (
      fullName.includes(trimmedClientQuery) ||
      revName.includes(trimmedClientQuery) ||
      (cleanPhoneQuery && phoneClean.includes(cleanPhoneQuery))
    );
  });

  // Full Access Guardrail: Show Dedicated Auth Screen if not Authenticated
  if (!isAuthenticated) {
    return (
      <>
        <AuthScreen
          onLogin={handleLogin}
          onRegisterSalon={handleRegisterSalon}
          onQuickDemoLogin={handleQuickDemoLogin}
          onShowToast={showToast}
        />
        {toastMessage && (
          <div className="fixed bottom-6 right-6 p-3.5 bg-emerald-600 text-white text-xs font-semibold rounded-xl shadow-xl flex items-center justify-between gap-3 animate-fadeIn z-50">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{toastMessage}</span>
            </div>
            <button onClick={() => setToastMessage(null)} className="text-white/80 hover:text-white cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDF8FA] text-[#1E1B2E] font-sans antialiased flex flex-col selection:bg-[#E95F8F]/20">
      {/* Global Top Banner for Simulation context */}
      <div className="bg-gradient-to-r from-[#1E1B2E] via-[#2D1B36] to-[#1E1B2E] text-white text-xs px-4 py-2 flex flex-wrap items-center justify-between border-b border-purple-950/40">
        <div className="flex items-center gap-3">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E95F8F] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#E95F8F]"></span>
          </span>
          <span className="font-medium text-slate-200">
            <strong className="text-white">SalonDesk SaaS</strong> — Prototipo Live Interattivo (Architettura Softr + Airtable)
          </span>
          <span className="hidden md:inline-block bg-white/10 px-2 py-0.5 rounded text-[11px] text-pink-200 border border-white/10">
            Design tokens: Rosa #E95F8F | Viola #8B5CF6
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileSimulator(!mobileSimulator)}
            className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
              mobileSimulator ? 'bg-[#E95F8F] text-white' : 'bg-white/10 text-slate-200 hover:bg-white/20'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            {mobileSimulator ? 'Vista Desktop' : 'Simula Mobile (375px)'}
          </button>
        </div>
      </div>

      {/* Main App Container (with mobile simulator frame support) */}
      <div className={`flex-1 flex justify-center ${mobileSimulator ? 'p-4 md:p-8 bg-slate-900/40' : ''}`}>
        <div
          className={`flex w-full bg-white shadow-2xl transition-all ${
            mobileSimulator
              ? 'max-w-[390px] min-h-[780px] max-h-[880px] rounded-[36px] overflow-hidden border-[10px] border-slate-900 flex-col relative'
              : 'min-h-screen'
          }`}
        >
          {/* LEFT SIDEBAR (Desktop) */}
          {!mobileSimulator && (
            <aside className="w-64 bg-[#1E1B2E] text-slate-200 flex flex-col justify-between border-r border-slate-800 shrink-0">
              <div>
                {/* Brand Header */}
                <div className="p-5 border-b border-white/10 flex items-center gap-3">
                  {settings.logoUrl ? (
                    <img
                      src={settings.logoUrl}
                      alt={currentUser?.salonName || settings.name}
                      className="w-10 h-10 rounded-xl object-contain bg-white p-0.5 border border-white/20 shadow-lg shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#E95F8F] to-[#8B5CF6] flex items-center justify-center text-white shadow-lg shadow-purple-500/20 shrink-0">
                      <Scissors className="w-5 h-5" />
                    </div>
                  )}
                  <div className="overflow-hidden">
                    <h1 className="font-bold text-white text-base tracking-tight truncate leading-tight">
                      {currentUser?.salonName || settings.name}
                    </h1>
                    <p className="text-xs text-pink-300/80 truncate">Titolare: {currentUser?.ownerName || settings.ownerName}</p>
                  </div>
                </div>

                {/* Primary Navigation - Ordered and Aligned */}
                <nav className="p-3 space-y-4">
                  {/* Sezione 1: Gestione Operativa Salone */}
                  <div className="space-y-1">
                    <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400/80">
                      Gestione Salone
                    </div>
                    {[
                      { id: 'dashboard', label: 'Dashboard Oggi', icon: Store, badge: todayAppointments.length },
                      { id: 'appointments', label: 'Appuntamenti', icon: Calendar, badge: appointments.length },
                      { id: 'clients', label: 'Clienti', icon: Users, badge: clients.length },
                      { id: 'services', label: 'Listino Servizi', icon: Scissors, badge: services.length },
                      { id: 'stats', label: 'Statistiche & KPI', icon: BarChart3 },
                    ].map(tab => {
                      const Icon = tab.icon;
                      const isActive = activeTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id as any)}
                          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition duration-150 cursor-pointer ${
                            isActive
                              ? 'bg-gradient-to-r from-[#E95F8F] to-[#8B5CF6] text-white shadow-md shadow-pink-500/20 font-semibold'
                              : 'text-slate-300 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                            <span className="whitespace-nowrap">{tab.label}</span>
                          </div>
                          {tab.badge !== undefined && (
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                                isActive ? 'bg-white/25 text-white' : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {tab.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}

                    {/* Quick WhatsApp Reminders Action in Sidebar */}
                    <div className="pt-1.5">
                      <button
                        type="button"
                        onClick={() => setIsRemindersModalOpen(true)}
                        className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold text-purple-200 bg-purple-950/40 border border-purple-800/50 hover:bg-purple-900/50 hover:text-white transition cursor-pointer shadow-xs"
                        title="Apri Centro Promemoria & Messaggi Rapidi"
                      >
                        <div className="flex items-center gap-2.5">
                          <Bell className="w-4 h-4 text-[#E95F8F]" />
                          <span>Promemoria Domani</span>
                        </div>
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-black bg-[#8B5CF6] text-white">
                          {tomorrowAppointments.length}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Sezione 2: Sistema & Configurazione Salone */}
                  <div className="pt-2 border-t border-white/10 space-y-1">
                    <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400/80">
                      Sistema & Account
                    </div>
                    {[
                      { id: 'settings', label: 'Impostazioni', icon: Settings },
                      {
                        id: 'subscription',
                        label: 'Abbonamento',
                        icon: CreditCard,
                        badgeText: 'Pro',
                      },
                    ].map(tab => {
                      const Icon = tab.icon;
                      const isActive = activeTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id as any)}
                          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition duration-150 cursor-pointer ${
                            isActive
                              ? 'bg-gradient-to-r from-[#E95F8F] to-[#8B5CF6] text-white shadow-md shadow-pink-500/20 font-semibold'
                              : 'text-slate-300 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                            <span className="whitespace-nowrap">{tab.label}</span>
                          </div>
                          {tab.badgeText && (
                            <span
                              className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md font-bold font-mono ${
                                isActive
                                  ? 'bg-white/25 text-white'
                                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              }`}
                            >
                              {tab.badgeText}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </nav>
              </div>

              {/* Bottom Salon Status, Quick WhatsApp & User Session Logout */}
              <div className="p-3.5 m-3 rounded-2xl bg-white/5 border border-white/10 space-y-2.5 text-xs text-slate-300">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Database className="w-3.5 h-3.5 text-emerald-400" /> PostgreSQL Supabase
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Live
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  WhatsApp Salone: <strong className="text-white font-mono">{settings.whatsappNumber}</strong>
                </p>
                <button
                  onClick={() => setIsNewAppointmentOpen(true)}
                  className="w-full py-2 px-3 rounded-xl bg-[#E95F8F] hover:bg-[#d64b7b] text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-pink-600/30 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Nuovo Appuntamento
                </button>

                {/* User Session & Logout Action */}
                <div className="pt-2 border-t border-white/10 space-y-2">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#E95F8F] to-[#8B5CF6] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                        {(currentUser?.ownerName || settings.ownerName || 'S').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">
                          {currentUser?.ownerName || settings.ownerName}
                        </p>
                        <p className="text-[10px] text-pink-300/80 truncate">
                          {currentUser?.email || settings.email}
                        </p>
                      </div>
                    </div>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">
                      {currentUser?.role === 'owner' ? 'Titolare' : 'Staff'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full py-1.5 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 border border-rose-500/20 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                    title="Disconnetti account e torna alla schermata di accesso"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-400" />
                    <span>Esci / Disconnetti</span>
                  </button>
                </div>
              </div>
            </aside>
          )}

          {/* RIGHT / MAIN CONTENT AREA */}
          <div className="flex-1 flex flex-col min-w-0 bg-[#FAF7F9] overflow-y-auto">
            {/* Top Loading Sync Bar */}
            {isDataLoading && (
              <div className="h-1 w-full bg-pink-100 overflow-hidden sticky top-0 z-30">
                <div className="h-full bg-gradient-to-r from-[#E95F8F] via-[#8B5CF6] to-[#E95F8F] animate-pulse" />
              </div>
            )}

            {/* Top Navigation Bar */}
            <header className="bg-white border-b border-pink-100 px-4 md:px-8 py-3.5 flex items-center justify-between sticky top-0 z-20">
              <div className="flex items-center gap-3">
                {settings.logoUrl ? (
                  <img
                    src={settings.logoUrl}
                    alt={currentUser?.salonName || settings.name}
                    className="w-9 h-9 rounded-xl object-contain bg-white p-0.5 border border-pink-200 shadow-2xs shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : mobileSimulator ? (
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#E95F8F] to-[#8B5CF6] flex items-center justify-center text-white text-sm font-bold shrink-0">
                    <Scissors className="w-4 h-4" />
                  </div>
                ) : null}
                <div>
                  <h2 className="text-base md:text-lg font-bold text-[#1E1B2E] flex items-center gap-2">
                    {activeTab === 'dashboard' && 'Dashboard Salone'}
                    {activeTab === 'appointments' && 'Gestione Appuntamenti'}
                    {activeTab === 'clients' && 'Anagrafica Clienti'}
                    {activeTab === 'services' && 'Listino Servizi & Prezzi'}
                    {activeTab === 'stats' && 'Statistiche & Fatturato'}
                    {activeTab === 'settings' && 'Impostazioni Salone'}
                    {activeTab === 'subscription' && 'Abbonamento & Licenza'}
                  </h2>
                  <p className="text-xs text-slate-500 hidden sm:block">
                    Oggi: {formatDisplayDate(todayStr, { withWeekday: true, includeYear: true })} • Salone Aperto
                  </p>
                </div>
              </div>

              {/* Action Buttons in Header */}
              <div className="flex items-center gap-2 md:gap-3">
                {/* Supabase status badge */}
                {isDataLoading ? (
                  <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 text-[#8B5CF6] rounded-xl text-xs font-semibold border border-purple-200 animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Sync Supabase...</span>
                  </div>
                ) : (
                  <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-semibold border border-emerald-200">
                    <Database className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Postgres Supabase</span>
                  </div>
                )}

                {/* Active Salon & Operator Info Badge */}
                <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-pink-50/80 to-purple-50/80 border border-purple-200/60 rounded-xl text-xs">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <div className="text-left leading-tight">
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-[#1E1B2E] text-xs truncate max-w-[130px]">
                        {currentUser?.salonName || settings.name}
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-200/80 text-purple-900 font-mono">
                        {currentUser?.salonId ? `#${currentUser.salonId.slice(-6)}` : 'PRO'}
                      </span>
                    </div>
                    <span className="block text-[10px] text-slate-500 font-medium truncate max-w-[130px]">
                      {currentUser?.email || settings.email}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsRemindersModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 md:py-2 rounded-xl text-xs md:text-sm font-bold bg-purple-50 hover:bg-purple-100 text-[#8B5CF6] border border-purple-200 transition cursor-pointer shadow-2xs"
                  title="Centro Promemoria & Messaggi WhatsApp"
                >
                  <Bell className="w-4 h-4 text-[#8B5CF6]" />
                  <span className="hidden sm:inline">Promemoria Domani</span>
                  <span className="sm:hidden">Promemoria</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-[#8B5CF6] text-white">
                    {tomorrowAppointments.length}
                  </span>
                </button>

                {activeTab === 'dashboard' && (
                  <button
                    onClick={() => handleOpenNewAppointment()}
                    className="bg-[#E95F8F] hover:bg-[#d84d7d] text-white px-3.5 py-2 rounded-xl text-xs md:text-sm font-semibold flex items-center gap-1.5 shadow-sm shadow-pink-500/20 transition active:scale-95 cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4 shrink-0" />
                    <span className="hidden sm:inline">Nuovo Appuntamento</span>
                    <span className="sm:hidden">Nuovo</span>
                  </button>
                )}

                {/* Visible Logout Button in Header */}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 md:py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition cursor-pointer shadow-2xs"
                  title="Esci / Disconnetti account"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-600" />
                  <span className="hidden sm:inline">Esci</span>
                </button>
              </div>
            </header>

            {/* Notification Toast */}
            {toastMessage && (
              <div className="mx-4 md:mx-8 mt-3 p-3 bg-emerald-600 text-white text-xs font-semibold rounded-xl shadow-lg flex items-center justify-between animate-fadeIn z-30">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{toastMessage}</span>
                </div>
                <button onClick={() => setToastMessage(null)} className="text-white/80 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* TAB CONTENT VIEWS */}
            <main className="p-4 md:p-8 flex-1 space-y-6">
              {/* ============================================================== */}
              {/* 1. DASHBOARD VIEW */}
              {/* ============================================================== */}
              {activeTab === 'dashboard' && (
                <div className="space-y-6">
                  {/* KPI Cards Row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                    {/* KPI 1 */}
                    <div className="bg-white p-4 rounded-2xl border border-pink-100 shadow-sm relative overflow-hidden">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500">Incasso Previsto Oggi</span>
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                          <TrendingUp className="w-4 h-4" />
                        </div>
                      </div>
                      {isDataLoading && appointments.length === 0 ? (
                        <div className="mt-2 space-y-1.5 animate-pulse">
                          <div className="h-7 w-24 bg-emerald-100/70 rounded-lg" />
                          <div className="h-3 w-32 bg-slate-100 rounded" />
                        </div>
                      ) : (
                        <>
                          <div className="mt-2 text-xl md:text-2xl font-black text-[#1E1B2E]">
                            €{todayRevenue}
                          </div>
                          <div className="mt-1 text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                            <span>{todayAppointments.length} appuntamenti programmati</span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* KPI 2 */}
                    <div className="bg-white p-4 rounded-2xl border border-pink-100 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500">In Poltrona Ora</span>
                        <div className="w-8 h-8 rounded-lg bg-purple-50 text-[#8B5CF6] flex items-center justify-center">
                          <Scissors className="w-4 h-4" />
                        </div>
                      </div>
                      {isDataLoading && appointments.length === 0 ? (
                        <div className="mt-2 space-y-1.5 animate-pulse">
                          <div className="h-7 w-12 bg-purple-100/70 rounded-lg" />
                          <div className="h-3 w-28 bg-slate-100 rounded" />
                        </div>
                      ) : (
                        <>
                          <div className="mt-2 text-xl md:text-2xl font-black text-[#8B5CF6]">
                            {todayAppointments.filter(a => a.status === 'In corso').length}
                          </div>
                          <div className="mt-1 text-[11px] text-slate-500 truncate">
                            {todayAppointments.find(a => a.status === 'In corso')?.clientName ? `${todayAppointments.find(a => a.status === 'In corso')?.clientName} (${todayAppointments.find(a => a.status === 'In corso')?.serviceName})` : 'Nessuno al momento'}
                          </div>
                        </>
                      )}
                    </div>

                    {/* KPI 3 */}
                    <div className="bg-white p-4 rounded-2xl border border-pink-100 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500">Da Riattivare (&gt;60gg)</span>
                        <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                          <Clock className="w-4 h-4" />
                        </div>
                      </div>
                      {isDataLoading && clients.length === 0 ? (
                        <div className="mt-2 space-y-1.5 animate-pulse">
                          <div className="h-7 w-12 bg-amber-100/70 rounded-lg" />
                          <div className="h-3 w-24 bg-slate-100 rounded" />
                        </div>
                      ) : (
                        <>
                          <div className="mt-2 text-xl md:text-2xl font-black text-amber-600">
                            {inactiveClients.length}
                          </div>
                          <div className="mt-1 text-[11px] text-amber-700 font-medium">
                            Clienti fermi da 2 mesi
                          </div>
                        </>
                      )}
                    </div>

                    {/* KPI 4 */}
                    <div className="bg-white p-4 rounded-2xl border border-pink-100 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500">Tasso No-Show</span>
                        <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                          <AlertCircle className="w-4 h-4" />
                        </div>
                      </div>
                      {isDataLoading && appointments.length === 0 ? (
                        <div className="mt-2 space-y-1.5 animate-pulse">
                          <div className="h-7 w-12 bg-rose-100/70 rounded-lg" />
                          <div className="h-3 w-28 bg-slate-100 rounded" />
                        </div>
                      ) : (
                        <>
                          <div className="mt-2 text-xl md:text-2xl font-black text-rose-600">
                            {noShowAppointments.length}
                          </div>
                          <div className="mt-1 text-[11px] text-slate-500">
                            {noShowAppointments.length} su {appointments.length} appuntamenti totali
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Chiusura e Quadratura Cassa Giornaliera */}
                  <CashRegisterSummary
                    appointments={appointments}
                    targetDateStr={todayStr}
                    onShowToast={showToast}
                  />

                  {/* Main section: Today's Timeline / Agenda */}
                  <div className="bg-white rounded-2xl border border-pink-100 shadow-sm overflow-hidden">
                    <div className="p-4 md:p-5 border-b border-pink-50 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-[#1E1B2E] text-base flex items-center gap-2">
                          <Clock className="w-4 h-4 text-[#E95F8F]" />
                          Programma Appuntamenti di Oggi ({formatDisplayDate(todayStr, { withWeekday: true, includeYear: false })})
                        </h3>
                        <p className="text-xs text-slate-500">Tutti gli slot orari del giorno in ordine cronologico</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setIsRemindersModalOpen(true)}
                          className="text-xs font-bold text-[#8B5CF6] bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg border border-purple-200 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                          title="Invia o controlla i promemoria per i clienti di domani"
                        >
                          <Bell className="w-3.5 h-3.5 text-[#8B5CF6]" />
                          <span>Promemoria Domani</span>
                          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-[#8B5CF6] text-white">
                            {tomorrowAppointments.length}
                          </span>
                        </button>
                        <button
                          onClick={() => handleOpenNewAppointment()}
                          className="text-xs font-semibold text-[#E95F8F] bg-pink-50 hover:bg-pink-100 px-3 py-1.5 rounded-lg border border-pink-200 transition flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Aggiungi slot
                        </button>
                      </div>
                    </div>

                    {/* Appointment Cards List */}
                    <div className="divide-y divide-pink-50">
                      {isDataLoading && todayAppointments.length === 0 ? (
                        <div className="p-4 space-y-3">
                          {[1, 2, 3].map((skeletonIdx) => (
                            <div
                              key={skeletonIdx}
                              className="p-4 rounded-xl bg-slate-50/70 border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-pulse"
                            >
                              <div className="flex items-center gap-3.5">
                                <div className="w-14 text-center space-y-1">
                                  <div className="h-5 w-12 mx-auto bg-slate-200 rounded" />
                                  <div className="h-2.5 w-8 mx-auto bg-slate-100 rounded" />
                                </div>
                                <div className="w-1 h-10 rounded-full bg-slate-200" />
                                <div className="space-y-1.5">
                                  <div className="h-4 w-36 bg-slate-200 rounded" />
                                  <div className="h-3 w-48 bg-slate-100 rounded" />
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="h-8 w-20 bg-slate-200 rounded-lg" />
                                <div className="h-8 w-24 bg-slate-200 rounded-lg" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : todayAppointments.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-xs">
                          Nessun appuntamento in programma per oggi. Clicca &quot;Nuovo Appuntamento&quot; per iniziare.
                        </div>
                      ) : (
                        todayAppointments.map((app) => (
                          <div
                            key={app.id}
                            className="p-4 md:p-5 hover:bg-pink-50/30 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                          >
                            {/* Time & Client info */}
                            <div className="flex items-start gap-3.5">
                              <div className="w-14 text-center shrink-0">
                                <span className="block font-black text-base md:text-lg text-[#1E1B2E] font-mono leading-none">
                                  {app.time}
                                </span>
                                <span className="text-[10px] text-slate-500 font-medium">
                                  {app.durationMinutes} min
                                </span>
                              </div>
                              <div className="w-1 self-stretch rounded-full bg-gradient-to-b from-[#E95F8F] to-[#8B5CF6] shrink-0" />
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenClientHistory(app.clientName, app.clientPhone)}
                                    className="font-bold text-[#1E1B2E] text-sm md:text-base hover:text-[#E95F8F] text-left transition cursor-pointer"
                                    title="Visualizza scheda e storico cliente"
                                  >
                                    {app.clientName}
                                  </button>
                                  {getStatusBadge(app.status)}
                                  {(() => {
                                    const clientObj = findClientForApp(app);
                                    return (
                                      <ClientReputationBadge
                                        noShowCount={clientObj?.noShowCount || 0}
                                        isBlocked={clientObj?.isBlocked}
                                        size="xs"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenClientHistory(app.clientName, app.clientPhone);
                                        }}
                                      />
                                    );
                                  })()}
                                  {app.isPaid && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      <CreditCard className="w-3 h-3 text-emerald-600" />
                                      <span>{app.paymentMethod || 'Pagato'}</span>
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-600 font-medium mt-0.5 flex flex-wrap items-center gap-1.5">
                                  {app.serviceNames && app.serviceNames.length > 1 ? (
                                    <div className="inline-flex flex-wrap items-center gap-1">
                                      {app.serviceNames.map((sn, idx) => (
                                        <span
                                          key={idx}
                                          className="px-1.5 py-0.5 rounded-md bg-purple-50 text-[#8B5CF6] border border-purple-200 text-[10px] font-bold"
                                        >
                                          {sn}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span>{app.serviceName}</span>
                                  )}
                                  <span>•</span>
                                  <span className="font-semibold text-slate-900">€{app.price}</span>
                                  {app.staffName && (
                                    <>
                                      <span>•</span>
                                      <span className="text-purple-600 text-[11px]">Staff: {app.staffName}</span>
                                    </>
                                  )}
                                </div>
                                {app.notes && (
                                  <p className="text-[11px] text-slate-500 italic mt-1 bg-slate-50 px-2 py-0.5 rounded inline-block">
                                    "{app.notes}"
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Quick Actions for this appointment */}
                            <div className="flex flex-wrap items-center gap-2 self-end md:self-center shrink-0">
                              {/* Incasso / Cassa Button */}
                              <button
                                type="button"
                                onClick={() => handleOpenCheckout(app)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                                  app.isPaid
                                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                                }`}
                                title={app.isPaid ? `Incasso registrato con ${app.paymentMethod}. Clicca per modificare.` : 'Registra incasso alla cassa'}
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                                <span>{app.isPaid ? 'Cassa' : 'Incassa'}</span>
                              </button>

                              {/* WhatsApp Menu con 3 Template */}
                              <WhatsAppActionMenu
                                appointment={app}
                                settings={settings}
                                onSent={(type, client) =>
                                  showToast(`WhatsApp aperto: inviato template ${type.toUpperCase()} a ${client}`)
                                }
                              />

                              {/* Status Quick Changer Dropdown */}
                              <select
                                value={app.status}
                                onChange={(e) => handleStatusChange(app.id, e.target.value as AppointmentStatus)}
                                className="text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2.5 py-1.5 font-medium focus:ring-2 focus:ring-[#8B5CF6] outline-none"
                              >
                                <option value="Confermato">Stato: Confermato</option>
                                <option value="In corso">Stato: In poltrona</option>
                                <option value="Completato">Stato: Completato</option>
                                <option value="No-Show">Stato: No-Show</option>
                                <option value="Annullato">Stato: Annullato</option>
                              </select>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Smart Actions: Inactive Clients Re-engagement Card */}
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-200/80 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-amber-950 text-sm md:text-base">
                          {inactiveClients.length} Clienti non prenotano da oltre 60 giorni!
                        </h4>
                        <p className="text-xs text-amber-800 mt-0.5">
                          Valentina De Luca e Federico Galli non vengono da settimane. Invia un messaggio WhatsApp con codice sconto "TORNAINFORMA".
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setActiveTab('clients');
                        setClientFilterStatus('Inattivo');
                      }}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-sm transition whitespace-nowrap self-start md:self-center"
                    >
                      Vedi Clienti Inattivi →
                    </button>
                  </div>
                </div>
              )}

              {/* ============================================================== */}
              {/* 2. APPOINTMENTS VIEW */}
              {/* ============================================================== */}
              {activeTab === 'appointments' && (
                <div className="space-y-5">
                  {/* Control Bar: Filters & View Switcher */}
                  <div className="bg-white p-4 rounded-2xl border border-pink-100 shadow-sm flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setAppointmentDateFilter('today')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                          appointmentDateFilter === 'today'
                            ? 'bg-[#E95F8F] text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Oggi ({todayAppointments.length})
                      </button>
                      <button
                        onClick={() => setAppointmentDateFilter('all')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                          appointmentDateFilter === 'all'
                            ? 'bg-[#E95F8F] text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Tutti ({appointments.length})
                      </button>
                      <button
                        onClick={() => setAppointmentDateFilter('noshow')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                          appointmentDateFilter === 'noshow'
                            ? 'bg-rose-600 text-white shadow-sm'
                            : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                        }`}
                      >
                        No-Show ({noShowAppointments.length})
                      </button>

                      {/* Filtro Collaboratore */}
                      <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
                        <Users className="w-3.5 h-3.5 text-[#8B5CF6]" />
                        <span className="text-[11px] font-semibold text-slate-500 hidden sm:inline">Staff:</span>
                        <select
                          value={appointmentStaffFilter}
                          onChange={(e) => setAppointmentStaffFilter(e.target.value)}
                          className="text-xs bg-transparent font-bold text-slate-800 outline-none cursor-pointer"
                        >
                          <option value="all">Tutti i Collaboratori ({appointments.length})</option>
                          {(settings.staffMembers || []).map(s => {
                            const count = appointments.filter(a => a.staffId === s.id || (a.staffName && a.staffName.toLowerCase() === s.name.toLowerCase())).length;
                            return (
                              <option key={s.id} value={s.id}>
                                {s.name} ({count}) {!s.isActive ? '- Non attivo' : ''}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setIsRemindersModalOpen(true)}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-50 text-[#8B5CF6] hover:bg-purple-100 border border-purple-200 transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                        title="Centro Promemoria WhatsApp"
                      >
                        <Bell className="w-3.5 h-3.5 text-[#8B5CF6]" />
                        <span>Promemoria Domani</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-[#8B5CF6] text-white">
                          {tomorrowAppointments.length}
                        </span>
                      </button>

                      <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs">
                        <button
                          onClick={() => setAppointmentViewMode('calendar')}
                          className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1.5 ${
                            appointmentViewMode === 'calendar' ? 'bg-white shadow-xs text-[#8B5CF6]' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Calendario</span>
                        </button>
                        <button
                          onClick={() => setAppointmentViewMode('timeline')}
                          className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1.5 ${
                            appointmentViewMode === 'timeline' ? 'bg-white shadow-xs text-[#8B5CF6]' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>Timeline</span>
                        </button>
                        <button
                          onClick={() => setAppointmentViewMode('table')}
                          className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1.5 ${
                            appointmentViewMode === 'table' ? 'bg-white shadow-xs text-[#8B5CF6]' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Tabella</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Appointments Content */}
                  {appointmentViewMode === 'calendar' ? (
                    <CalendarAppointmentsView
                      appointments={appointments}
                      services={services}
                      todayStr={todayStr}
                      clients={clients}
                      settings={settings}
                      staffMembers={settings.staffMembers || []}
                      staffFilter={appointmentStaffFilter}
                      onStaffFilterChange={setAppointmentStaffFilter}
                      onStatusChange={handleStatusChange}
                      onOpenWhatsApp={openWhatsApp}
                      onNewAppointmentWithDate={handleOpenNewAppointmentWithDate}
                      onOpenCheckout={handleOpenCheckout}
                      onOpenClientHistory={handleOpenClientHistory}
                    />
                  ) : appointmentViewMode === 'timeline' ? (
                    <div className="bg-white rounded-2xl border border-pink-100 shadow-sm divide-y divide-pink-50">
                      {appointments
                        .filter(a => {
                          if (appointmentDateFilter === 'today' && a.date !== todayStr) return false;
                          if (appointmentDateFilter === 'noshow' && a.status !== 'No-Show') return false;
                          if (appointmentStaffFilter !== 'all') {
                            const staffObj = (settings.staffMembers || []).find(s => s.id === appointmentStaffFilter);
                            const matchId = a.staffId === appointmentStaffFilter;
                            const matchName = staffObj && a.staffName && a.staffName.toLowerCase() === staffObj.name.toLowerCase();
                            if (!matchId && !matchName) return false;
                          }
                          return true;
                        })
                        .map(app => {
                          const staff = (settings.staffMembers || []).find(s => (app.staffId && s.id === app.staffId) || (app.staffName && s.name.toLowerCase() === app.staffName.toLowerCase()));
                          const staffColorCfg = getStaffColorConfig(staff?.color);

                          return (
                            <div key={app.id} className="p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                              <div className="flex items-start gap-4">
                                <div className="w-20 shrink-0 text-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                                  <span className="text-xs text-slate-500 font-bold block">{app.date}</span>
                                  <span className="text-base font-black text-[#8B5CF6] font-mono">{app.time}</span>
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenClientHistory(app.clientName, app.clientPhone)}
                                      className="font-bold text-slate-900 text-sm md:text-base hover:text-[#E95F8F] text-left transition cursor-pointer"
                                      title="Visualizza scheda e storico cliente"
                                    >
                                      {app.clientName}
                                    </button>
                                    {getStatusBadge(app.status)}
                                    {(() => {
                                      const clientObj = findClientForApp(app);
                                      return (
                                        <ClientReputationBadge
                                          noShowCount={clientObj?.noShowCount || 0}
                                          isBlocked={clientObj?.isBlocked}
                                          size="xs"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenClientHistory(app.clientName, app.clientPhone);
                                          }}
                                        />
                                      );
                                    })()}
                                    {app.isPaid && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        <CreditCard className="w-3 h-3 text-emerald-600" />
                                        <span>{app.paymentMethod || 'Pagato'}</span>
                                      </span>
                                    )}
                                    {app.staffName && (
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${staffColorCfg.bg} ${staffColorCfg.text} border ${staffColorCfg.border}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${staffColorCfg.dot}`} />
                                        {app.staffName}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-slate-600 mt-1 flex flex-wrap items-center gap-1.5">
                                    {app.serviceNames && app.serviceNames.length > 1 ? (
                                      <div className="inline-flex flex-wrap items-center gap-1">
                                        {app.serviceNames.map((sn, idx) => (
                                          <span
                                            key={idx}
                                            className="px-1.5 py-0.5 rounded-md bg-purple-50 text-[#8B5CF6] border border-purple-200 text-[10px] font-bold"
                                          >
                                            {sn}
                                          </span>
                                        ))}
                                      </div>
                                    ) : (
                                      <strong>{app.serviceName}</strong>
                                    )}
                                    <span>•</span>
                                    <span>{app.durationMinutes} min</span>
                                    <span>•</span>
                                    <span className="text-pink-600 font-bold">€{app.price}</span>
                                  </div>
                                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                                    <Phone className="w-3 h-3 text-slate-400" /> {app.clientPhone}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 self-end md:self-center">
                                <button
                                  type="button"
                                  onClick={() => handleOpenCheckout(app)}
                                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                                    app.isPaid
                                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                                  }`}
                                  title={app.isPaid ? 'Modifica cassa' : 'Incassa appuntamento'}
                                >
                                  <CreditCard className="w-3.5 h-3.5" />
                                  <span>{app.isPaid ? 'Cassa' : 'Incassa'}</span>
                                </button>
                                <WhatsAppActionMenu
                                  appointment={app}
                                  settings={settings}
                                  onSent={(type, client) =>
                                    showToast(`WhatsApp aperto: inviato template ${type.toUpperCase()} a ${client}`)
                                  }
                                />
                                <select
                                  value={app.status}
                                  onChange={(e) => handleStatusChange(app.id, e.target.value as AppointmentStatus)}
                                  className="text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2.5 py-1.5"
                                >
                                  <option value="Confermato">Confermato</option>
                                  <option value="In corso">In poltrona</option>
                                  <option value="Completato">Completato</option>
                                  <option value="No-Show">No-Show</option>
                                  <option value="Annullato">Annullato</option>
                                </select>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border border-pink-100 shadow-sm overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-pink-50/50 text-slate-600 font-semibold border-b border-pink-100 uppercase tracking-wider">
                          <tr>
                            <th className="p-3.5">Data & Ora</th>
                            <th className="p-3.5">Cliente</th>
                            <th className="p-3.5">Collaboratore</th>
                            <th className="p-3.5">Servizio</th>
                            <th className="p-3.5">Prezzo</th>
                            <th className="p-3.5">Stato</th>
                            <th className="p-3.5 text-right">Azioni</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-pink-50">
                          {appointments
                            .filter(a => {
                              if (appointmentDateFilter === 'today' && a.date !== todayStr) return false;
                              if (appointmentDateFilter === 'noshow' && a.status !== 'No-Show') return false;
                              if (appointmentStaffFilter !== 'all') {
                                const staffObj = (settings.staffMembers || []).find(s => s.id === appointmentStaffFilter);
                                const matchId = a.staffId === appointmentStaffFilter;
                                const matchName = staffObj && a.staffName && a.staffName.toLowerCase() === staffObj.name.toLowerCase();
                                if (!matchId && !matchName) return false;
                              }
                              return true;
                            })
                            .map(app => {
                              const staff = (settings.staffMembers || []).find(s => (app.staffId && s.id === app.staffId) || (app.staffName && s.name.toLowerCase() === app.staffName.toLowerCase()));
                              const staffColorCfg = getStaffColorConfig(staff?.color);

                              return (
                                <tr key={app.id} className="hover:bg-pink-50/20">
                                  <td className="p-3.5 font-mono font-medium">{app.date} {app.time}</td>
                                  <td className="p-3.5 font-bold text-slate-900">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <button
                                        type="button"
                                        onClick={() => handleOpenClientHistory(app.clientName, app.clientPhone)}
                                        className="hover:text-[#E95F8F] text-left transition cursor-pointer"
                                        title="Visualizza scheda e storico cliente"
                                      >
                                        {app.clientName}
                                      </button>
                                      {(() => {
                                        const clientObj = findClientForApp(app);
                                        return (
                                          <ClientReputationBadge
                                            noShowCount={clientObj?.noShowCount || 0}
                                            isBlocked={clientObj?.isBlocked}
                                            size="xs"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleOpenClientHistory(app.clientName, app.clientPhone);
                                            }}
                                          />
                                        );
                                      })()}
                                    </div>
                                  </td>
                                  <td className="p-3.5">
                                    {app.staffName ? (
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${staffColorCfg.bg} ${staffColorCfg.text} border ${staffColorCfg.border}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${staffColorCfg.dot}`} />
                                        {app.staffName}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 italic">Non assegnato</span>
                                    )}
                                  </td>
                                  <td className="p-3.5 text-slate-700">
                                    {app.serviceNames && app.serviceNames.length > 1 ? (
                                      <div className="flex flex-wrap gap-1 max-w-xs">
                                        {app.serviceNames.map((sn, idx) => (
                                          <span
                                            key={idx}
                                            className="px-1.5 py-0.5 rounded-md bg-purple-50 text-[#8B5CF6] border border-purple-200 text-[10px] font-semibold"
                                          >
                                            {sn}
                                          </span>
                                        ))}
                                      </div>
                                    ) : (
                                      <span>{app.serviceName}</span>
                                    )}
                                  </td>
                                  <td className="p-3.5 font-bold text-[#E95F8F]">€{app.price}</td>
                                  <td className="p-3.5">
                                    <div className="flex flex-col gap-1 items-start">
                                      {getStatusBadge(app.status)}
                                      {app.isPaid && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                          <CreditCard className="w-3 h-3 text-emerald-600" />
                                          <span>{app.paymentMethod || 'Pagato'}</span>
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-3.5 text-right whitespace-nowrap">
                                    <div className="inline-flex items-center gap-1.5 justify-end">
                                      <button
                                        type="button"
                                        onClick={() => handleOpenCheckout(app)}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer ${
                                          app.isPaid
                                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                        }`}
                                        title={app.isPaid ? 'Modifica Cassa' : 'Incassa'}
                                      >
                                        <CreditCard className="w-3 h-3" />
                                        <span>{app.isPaid ? 'Cassa' : 'Incassa'}</span>
                                      </button>
                                      <WhatsAppActionMenu
                                        appointment={app}
                                        settings={settings}
                                        compact={true}
                                        onSent={(type, client) =>
                                          showToast(`WhatsApp aperto: inviato template ${type.toUpperCase()} a ${client}`)
                                        }
                                      />
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ============================================================== */}
              {/* 3. CLIENTS VIEW */}
              {/* ============================================================== */}
              {activeTab === 'clients' && (
                <div className="space-y-5">
                  {/* Top search & filter bar */}
                  <div className="bg-white p-4 rounded-2xl border border-pink-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="relative flex-1 max-w-md">
                      <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Cerca cliente per nome, telefono o note..."
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#8B5CF6] outline-none"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setClientFilterStatus('all')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                          clientFilterStatus === 'all' ? 'bg-[#8B5CF6] text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        Tutti ({clients.length})
                      </button>
                      <button
                        onClick={() => setClientFilterStatus('Attivo')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                          clientFilterStatus === 'Attivo' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        Attivi
                      </button>
                      <button
                        onClick={() => setClientFilterStatus('Inattivo')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                          clientFilterStatus === 'Inattivo' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        Inattivi (&gt;60gg)
                      </button>
                      <button
                        onClick={() => setIsNewClientOpen(true)}
                        className="bg-[#E95F8F] text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm ml-auto"
                      >
                        <Plus className="w-3.5 h-3.5" /> Nuovo Cliente
                      </button>
                    </div>
                  </div>

                  {/* Client Cards / Table Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {clients
                      .filter(c => {
                        const matchSearch =
                          c.firstName.toLowerCase().includes(clientSearch.toLowerCase()) ||
                          c.lastName.toLowerCase().includes(clientSearch.toLowerCase()) ||
                          c.phone.includes(clientSearch) ||
                          c.notes.toLowerCase().includes(clientSearch.toLowerCase());
                        const matchStatus = clientFilterStatus === 'all' ? true : c.status === clientFilterStatus;
                        return matchSearch && matchStatus;
                      })
                      .map(client => (
                        <div
                          key={client.id}
                          className="bg-white p-5 rounded-2xl border border-pink-100 shadow-sm hover:border-[#E95F8F]/40 transition space-y-3 relative group"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4
                                  onClick={() => handleOpenClientHistory(client)}
                                  className="font-bold text-[#1E1B2E] text-base hover:text-[#E95F8F] cursor-pointer transition"
                                  title="Clicca per aprire la Scheda Storico & Affidabilità"
                                >
                                  {client.firstName} {client.lastName}
                                </h4>
                                <span
                                  className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                                    client.status === 'Attivo' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {client.status}
                                </span>
                                <ClientReputationBadge
                                  noShowCount={client.noShowCount || 0}
                                  isBlocked={client.isBlocked}
                                  size="xs"
                                  onClick={() => handleOpenClientHistory(client)}
                                />
                              </div>
                              <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                                <span>{client.phone}</span>
                                {client.email && (
                                  <>
                                    <span>•</span>
                                    <span>{client.email}</span>
                                  </>
                                )}
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenClientHistory(client)}
                                className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-[#8B5CF6] text-xs font-bold rounded-xl border border-purple-200 transition flex items-center gap-1 cursor-pointer"
                                title="Apri Scheda Storico & Note Tecniche"
                              >
                                <History className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Scheda</span>
                              </button>
                              <button
                                onClick={() => openWhatsApp(client.phone, `${client.firstName} ${client.lastName}`)}
                                className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl border border-emerald-200 transition"
                                title="Chatta su WhatsApp"
                              >
                                <MessageSquare className="w-4 h-4 text-emerald-600" />
                              </button>
                            </div>
                          </div>

                          {/* Technical Notes Salone if present */}
                          {client.technicalNotes && (
                            <div className="bg-purple-50/50 p-2.5 rounded-xl text-xs text-purple-900 border border-purple-100">
                              <span className="font-bold text-[#8B5CF6] block text-[10px] uppercase tracking-wider mb-0.5">
                                Note Tecniche & Formule Salone:
                              </span>
                              {client.technicalNotes}
                            </div>
                          )}

                          {/* Preferences & General Notes */}
                          {client.notes && (
                            <div className="bg-pink-50/40 p-2.5 rounded-xl text-xs text-slate-700 border border-pink-100">
                              <span className="font-bold text-[#E95F8F] block text-[10px] uppercase tracking-wider mb-0.5">
                                Note Generali & Preferenze:
                              </span>
                              {client.notes}
                            </div>
                          )}

                          {/* Stats footer */}
                          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500 flex-wrap gap-2">
                            <div>
                              Visite: <strong className="text-slate-900">{client.totalAppointments}</strong>
                            </div>
                            <div>
                              Spesa: <strong className="text-[#8B5CF6]">€{client.totalSpent}</strong>
                            </div>
                            <div>
                              No-Show: <strong className={client.noShowCount > 0 ? 'text-rose-600 font-bold' : 'text-emerald-700 font-medium'}>{client.noShowCount || 0}</strong>
                            </div>
                            <div>
                              Ultimo: <strong className="text-slate-900">{client.lastAppointmentDate || 'N/D'}</strong>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* ============================================================== */}
              {/* 4. SERVICES VIEW */}
              {/* ============================================================== */}
              {activeTab === 'services' && (
                <div className="space-y-5">
                  {/* Top Bar with Title & Actions */}
                  <div className="bg-white p-4 md:p-5 rounded-2xl border border-pink-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-[#1E1B2E] text-base md:text-lg">Listino Servizi del Salone</h3>
                        <span className="text-xs bg-purple-50 text-[#8B5CF6] font-bold px-2 py-0.5 rounded-full border border-purple-100">
                          {services.length} Servizi
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Clicca sullo <strong>Stato</strong> di qualsiasi servizio per impostarlo come <em>Attivo</em>, <em>Disattivato</em> o per <em>Eliminarlo</em> dal listino.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      {/* View Switcher */}
                      <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                        <button
                          type="button"
                          onClick={() => setServicesViewMode('table')}
                          className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                            servicesViewMode === 'table'
                              ? 'bg-white text-[#8B5CF6] shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Tabella
                        </button>
                        <button
                          type="button"
                          onClick={() => setServicesViewMode('cards')}
                          className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                            servicesViewMode === 'cards'
                              ? 'bg-white text-[#8B5CF6] shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Card
                        </button>
                      </div>

                      <button
                        onClick={() => setIsNewServiceOpen(true)}
                        className="bg-[#E95F8F] hover:bg-[#d84d7d] text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
                      >
                        <Plus className="w-4 h-4" /> Nuovo Servizio
                      </button>
                    </div>
                  </div>

                  {/* Filters & Search Row */}
                  <div className="bg-white p-3.5 rounded-2xl border border-pink-100 shadow-sm flex flex-col md:flex-row items-center gap-3">
                    <div className="relative flex-1 w-full">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Cerca servizio per nome, trattamento o descrizione..."
                        value={serviceSearch}
                        onChange={(e) => setServiceSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#8B5CF6] outline-none"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                      {/* Category Filter */}
                      <select
                        value={serviceCategoryFilter}
                        onChange={(e) => setServiceCategoryFilter(e.target.value)}
                        className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-[#8B5CF6]"
                      >
                        <option value="all">Tutte le categorie</option>
                        <option value="Capelli">Capelli</option>
                        <option value="Estetica">Estetica</option>
                        <option value="Unghie">Unghie</option>
                        <option value="Massaggi">Massaggi</option>
                      </select>

                      {/* Status Filter */}
                      <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl text-xs">
                        <button
                          type="button"
                          onClick={() => setServiceStatusFilter('all')}
                          className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                            serviceStatusFilter === 'all'
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          Tutti ({services.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setServiceStatusFilter('active')}
                          className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                            serviceStatusFilter === 'active'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-slate-500 hover:text-emerald-700'
                          }`}
                        >
                          Attivi ({services.filter(s => s.isActive).length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setServiceStatusFilter('inactive')}
                          className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                            serviceStatusFilter === 'inactive'
                              ? 'bg-slate-700 text-white shadow-xs'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          Disattivati ({services.filter(s => !s.isActive).length})
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Filtered Services List */}
                  {(() => {
                    const filteredServices = services.filter((srv) => {
                      const matchSearch =
                        srv.name.toLowerCase().includes(serviceSearch.toLowerCase()) ||
                        (srv.description && srv.description.toLowerCase().includes(serviceSearch.toLowerCase())) ||
                        srv.category.toLowerCase().includes(serviceSearch.toLowerCase());
                      const matchCategory = serviceCategoryFilter === 'all' ? true : srv.category === serviceCategoryFilter;
                      const matchStatus =
                        serviceStatusFilter === 'all'
                          ? true
                          : serviceStatusFilter === 'active'
                          ? srv.isActive
                          : !srv.isActive;
                      return matchSearch && matchCategory && matchStatus;
                    });

                    if (filteredServices.length === 0) {
                      return (
                        <div className="bg-white p-8 rounded-2xl border border-pink-100 shadow-sm text-center">
                          <Scissors className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                          <p className="text-sm font-bold text-slate-700">Nessun servizio trovato</p>
                          <p className="text-xs text-slate-500 mt-1">Prova a cambiare i filtri di ricerca o la categoria.</p>
                        </div>
                      );
                    }

                    return servicesViewMode === 'table' ? (
                      /* TABELLA LISTINO SERVIZI */
                      <div className="bg-white rounded-2xl border border-pink-100 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-purple-50/50 border-b border-pink-100 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                                <th className="p-3.5 pl-5">Servizio / Trattamento</th>
                                <th className="p-3.5">Categoria</th>
                                <th className="p-3.5">Durata</th>
                                <th className="p-3.5">Prezzo</th>
                                <th className="p-3.5 text-center">Stato (Clicca per modificare)</th>
                                <th className="p-3.5 pr-5 text-right">Azioni</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {filteredServices.map((srv) => (
                                <tr
                                  key={srv.id}
                                  className={`transition hover:bg-pink-50/30 ${
                                    !srv.isActive ? 'bg-slate-50/60 opacity-80' : ''
                                  }`}
                                >
                                  {/* Nome & Descrizione */}
                                  <td className="p-3.5 pl-5">
                                    <div className="font-bold text-slate-900 text-sm">{srv.name}</div>
                                    {srv.description && (
                                      <div className="text-slate-500 text-[11px] mt-0.5 max-w-md line-clamp-1">
                                        {srv.description}
                                      </div>
                                    )}
                                  </td>

                                  {/* Categoria */}
                                  <td className="p-3.5 whitespace-nowrap">
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-[#8B5CF6] border border-purple-100">
                                      {srv.category}
                                    </span>
                                  </td>

                                  {/* Durata */}
                                  <td className="p-3.5 whitespace-nowrap">
                                    <span className="inline-flex items-center gap-1 text-slate-600 font-medium">
                                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                                      {srv.durationMinutes} min
                                    </span>
                                  </td>

                                  {/* Prezzo */}
                                  <td className="p-3.5 whitespace-nowrap">
                                    <span className="font-black text-sm text-[#E95F8F]">
                                      €{srv.price}
                                    </span>
                                  </td>

                                  {/* STATO: BADGE CLICCABILE CON MENU DROPDOWN (Attivo, Disattivato, Elimina) */}
                                  <td className="p-3.5 text-center whitespace-nowrap">
                                    <div className="relative inline-block text-left">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setServiceStatusMenuOpen(serviceStatusMenuOpen === srv.id ? null : srv.id);
                                        }}
                                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition shadow-xs cursor-pointer select-none ${
                                          srv.isActive
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300'
                                            : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                                        }`}
                                        title="Clicca per scegliere: Attivo, Disattivato o Elimina"
                                      >
                                        {srv.isActive ? (
                                          <>
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                            <span>Attivo</span>
                                          </>
                                        ) : (
                                          <>
                                            <XCircle className="w-3.5 h-3.5 text-slate-500" />
                                            <span>Disattivato</span>
                                          </>
                                        )}
                                        <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5" />
                                      </button>

                                      {/* Dropdown Menu Posizionato */}
                                      {serviceStatusMenuOpen === srv.id && (
                                        <>
                                          <div
                                            className="fixed inset-0 z-30"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setServiceStatusMenuOpen(null);
                                            }}
                                          />
                                          <div className="absolute right-0 top-full mt-1.5 z-40 w-48 bg-white rounded-xl shadow-xl border border-pink-100 py-1.5 text-xs animate-fadeIn">
                                            <div className="px-3 py-1 text-[10px] uppercase font-bold tracking-wider text-slate-400 border-b border-slate-100">
                                              Modifica Stato
                                            </div>

                                            {/* Scegli Attivo */}
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleSetServiceActive(srv.id, true);
                                                setServiceStatusMenuOpen(null);
                                              }}
                                              className={`w-full text-left px-3 py-2 flex items-center justify-between transition cursor-pointer ${
                                                srv.isActive
                                                  ? 'bg-emerald-50/80 text-emerald-800 font-bold'
                                                  : 'hover:bg-slate-50 text-slate-700'
                                              }`}
                                            >
                                              <div className="flex items-center gap-2">
                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                                <span>Attivo</span>
                                              </div>
                                              {srv.isActive && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                                            </button>

                                            {/* Scegli Disattivato */}
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleSetServiceActive(srv.id, false);
                                                setServiceStatusMenuOpen(null);
                                              }}
                                              className={`w-full text-left px-3 py-2 flex items-center justify-between transition cursor-pointer ${
                                                !srv.isActive
                                                  ? 'bg-slate-100 text-slate-900 font-bold'
                                                  : 'hover:bg-slate-50 text-slate-700'
                                              }`}
                                            >
                                              <div className="flex items-center gap-2">
                                                <XCircle className="w-3.5 h-3.5 text-slate-500" />
                                                <span>Disattivato</span>
                                              </div>
                                              {!srv.isActive && <Check className="w-3.5 h-3.5 text-slate-700" />}
                                            </button>

                                            <div className="my-1 border-t border-slate-100" />

                                            {/* Scegli Elimina */}
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setServiceToDelete(srv);
                                                setServiceStatusMenuOpen(null);
                                              }}
                                              className="w-full text-left px-3 py-2 flex items-center gap-2 text-rose-600 hover:bg-rose-50 font-medium transition cursor-pointer"
                                            >
                                              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                              <span>Elimina servizio</span>
                                            </button>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </td>

                                  {/* Azioni Rapide */}
                                  <td className="p-3.5 pr-5 text-right whitespace-nowrap">
                                    <button
                                      type="button"
                                      onClick={() => setServiceToDelete(srv)}
                                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                      title="Elimina servizio"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      /* GRIGLIA CARD */
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredServices.map((srv) => (
                          <div
                            key={srv.id}
                            className={`bg-white p-5 rounded-2xl border shadow-sm hover:shadow-md transition flex flex-col justify-between ${
                              !srv.isActive
                                ? 'border-slate-200 bg-slate-50/60 opacity-85'
                                : 'border-pink-100'
                            }`}
                          >
                            <div>
                              <div className="flex items-start justify-between">
                                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-50 text-[#8B5CF6]">
                                  {srv.category}
                                </span>
                                <span className="font-black text-lg text-[#E95F8F]">€{srv.price}</span>
                              </div>
                              <h4 className="font-bold text-slate-900 text-sm md:text-base mt-2">{srv.name}</h4>
                              <p className="text-xs text-slate-500 mt-1 line-clamp-2">{srv.description}</p>
                            </div>

                            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-slate-400" /> {srv.durationMinutes} min
                              </span>

                              {/* Clickable Status Badge on Card */}
                              <div className="relative inline-block text-left">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setServiceStatusMenuOpen(serviceStatusMenuOpen === srv.id ? null : srv.id);
                                  }}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition shadow-xs cursor-pointer select-none ${
                                    srv.isActive
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                      : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                                  }`}
                                  title="Clicca per scegliere: Attivo, Disattivato o Elimina"
                                >
                                  {srv.isActive ? (
                                    <>
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                      <span>Attivo</span>
                                    </>
                                  ) : (
                                    <>
                                      <XCircle className="w-3.5 h-3.5 text-slate-500" />
                                      <span>Disattivato</span>
                                    </>
                                  )}
                                  <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5" />
                                </button>

                                {serviceStatusMenuOpen === srv.id && (
                                  <>
                                    <div
                                      className="fixed inset-0 z-30"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setServiceStatusMenuOpen(null);
                                      }}
                                    />
                                    <div className="absolute right-0 bottom-full mb-1.5 z-40 w-48 bg-white rounded-xl shadow-xl border border-pink-100 py-1.5 text-xs animate-fadeIn">
                                      <div className="px-3 py-1 text-[10px] uppercase font-bold tracking-wider text-slate-400 border-b border-slate-100">
                                        Modifica Stato
                                      </div>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleSetServiceActive(srv.id, true);
                                          setServiceStatusMenuOpen(null);
                                        }}
                                        className={`w-full text-left px-3 py-2 flex items-center justify-between transition ${
                                          srv.isActive ? 'bg-emerald-50 text-emerald-800 font-bold' : 'hover:bg-slate-50 text-slate-700'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2">
                                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                          <span>Attivo</span>
                                        </div>
                                        {srv.isActive && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleSetServiceActive(srv.id, false);
                                          setServiceStatusMenuOpen(null);
                                        }}
                                        className={`w-full text-left px-3 py-2 flex items-center justify-between transition ${
                                          !srv.isActive ? 'bg-slate-100 text-slate-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2">
                                          <XCircle className="w-3.5 h-3.5 text-slate-500" />
                                          <span>Disattivato</span>
                                        </div>
                                        {!srv.isActive && <Check className="w-3.5 h-3.5 text-slate-700" />}
                                      </button>
                                      <div className="my-1 border-t border-slate-100" />
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setServiceToDelete(srv);
                                          setServiceStatusMenuOpen(null);
                                        }}
                                        className="w-full text-left px-3 py-2 flex items-center gap-2 text-rose-600 hover:bg-rose-50 font-medium transition"
                                      >
                                        <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                        <span>Elimina servizio</span>
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* ============================================================== */}
              {/* 5. STATS VIEW */}
              {/* ============================================================== */}
              {activeTab === 'stats' && (
                <SalonStatsView
                  appointments={appointments}
                  services={services}
                  showToast={showToast}
                />
              )}

              {/* ============================================================== */}
              {/* 6. DEDICATED SUBSCRIPTION VIEW */}
              {/* ============================================================== */}
              {activeTab === 'subscription' && (
                <div className="space-y-6 max-w-3xl animate-fadeIn">
                  <SalonSubscriptionManager
                    subscription={settings.subscription}
                    salonName={settings.name}
                    ownerName={settings.ownerName}
                    salonEmail={settings.email}
                    onUpdateSubscription={(updatedSub) => {
                      const updated = { ...settings, subscription: updatedSub };
                      setSettings(updated);
                      try {
                        localStorage.setItem('salondesk_settings', JSON.stringify(updated));
                      } catch {
                        // ignore
                      }
                    }}
                    showToast={showToast}
                  />
                </div>
              )}

              {/* ============================================================== */}
              {/* 7. SETTINGS VIEW */}
              {/* ============================================================== */}
              {activeTab === 'settings' && (
                <div className="space-y-6 max-w-3xl animate-fadeIn">
                  {/* Quick Subscription Banner in Settings */}
                  <div className="bg-gradient-to-r from-purple-950 via-[#1E1B2E] to-slate-900 text-white p-4 md:p-5 rounded-2xl border border-purple-800/40 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white shrink-0">
                        <CreditCard className="w-5 h-5 text-pink-300" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white">
                            Licenza: {settings.subscription?.name || 'Piano Pro'}
                          </span>
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                            {settings.subscription?.status || 'Attivo'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-0.5">
                          Prossimo rinnovo {settings.subscription?.nextRenewalDate || '15 Ottobre'} • Fatturazione Stripe
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveTab('subscription')}
                      className="px-3.5 py-2 bg-gradient-to-r from-[#E95F8F] to-[#8B5CF6] hover:opacity-90 text-white text-xs font-bold rounded-xl shadow transition self-start sm:self-auto cursor-pointer"
                    >
                      Dettagli Abbonamento & Stripe →
                    </button>
                  </div>

                  {/* COLLABORATORI / TEAM DEL SALONE */}
                  <StaffManager
                    staffMembers={settings.staffMembers || []}
                    appointments={appointments}
                    onUpdateStaff={handleUpdateStaff}
                    showToast={showToast}
                  />

                  {/* LOGO AZIENDALE UPLOADER */}
                  <div className="bg-white p-6 rounded-2xl border border-pink-100 shadow-sm space-y-4">
                    <div className="border-b border-pink-50 pb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-[#1E1B2E] text-base flex items-center gap-2">
                          <ImageIcon className="w-5 h-5 text-[#E95F8F]" />
                          Logo Aziendale del Salone
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Carica il logo o stemma ufficiale del tuo salone per personalizzare l'interfaccia, i promemoria e le ricevute.
                        </p>
                      </div>
                      {settings.logoUrl && (
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Logo Personalizzato Attivo
                        </span>
                      )}
                    </div>

                    <SalonLogoUploader
                      currentLogoUrl={settings.logoUrl}
                      salonName={settings.name}
                      ownerName={settings.ownerName}
                      onLogoChange={handleLogoChange}
                      showToast={showToast}
                    />
                  </div>

                  {/* DATI AZIENDALI & CANALI SALONE */}
                  <div className="bg-white p-6 rounded-2xl border border-pink-100 shadow-sm space-y-4">
                    <h3 className="font-bold text-[#1E1B2E] text-base border-b border-pink-50 pb-3">
                      Dati Aziendali & Canali Salone
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">Nome Salone</label>
                        <input
                          type="text"
                          value={settings.name}
                          onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#8B5CF6] outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">Nome Titolare</label>
                        <input
                          type="text"
                          value={settings.ownerName}
                          onChange={(e) => setSettings({ ...settings, ownerName: e.target.value })}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#8B5CF6] outline-none"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-slate-600 font-semibold">WhatsApp Ufficiale Salone</label>
                          <span className="text-[10px] text-emerald-700 font-mono font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            {sanitizePhoneNumber(settings.whatsappNumber).formattedWithPlus}
                          </span>
                        </div>
                        <input
                          type="text"
                          value={settings.whatsappNumber}
                          onChange={(e) => setSettings({ ...settings, whatsappNumber: e.target.value })}
                          placeholder="Es. 340 1234567 oppure +39 340 1234567"
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-emerald-700 font-bold focus:ring-2 focus:ring-[#8B5CF6] outline-none"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">
                          Prefisso internazionale +39 applicato automaticamente se omesso.
                        </p>
                      </div>

                      <div>
                        <label className="block text-slate-600 font-semibold mb-1">Indirizzo & Città</label>
                        <input
                          type="text"
                          value={`${settings.address}, ${settings.city}`}
                          onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#8B5CF6] outline-none"
                        />
                      </div>
                    </div>

                    <div className="text-xs">
                      <label className="block text-slate-600 font-semibold mb-1">Orari di Apertura</label>
                      <input
                        type="text"
                        value={settings.openHours}
                        onChange={(e) => setSettings({ ...settings, openHours: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#8B5CF6] outline-none"
                      />
                    </div>

                    <div className="text-xs">
                      <label className="block text-slate-600 font-semibold mb-1">Link Prenotazione Online (Calendly/No-code)</label>
                      <input
                        type="text"
                        value={settings.calendlyLink || ''}
                        onChange={(e) => setSettings({ ...settings, calendlyLink: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[#8B5CF6] font-mono focus:ring-2 focus:ring-[#8B5CF6] outline-none"
                      />
                    </div>

                    <div className="text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-slate-600 font-semibold flex items-center gap-1.5">
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                          <span>Link Recensioni Google (Google Business Profile)</span>
                        </label>
                        {settings.googleReviewLink && (
                          <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            ✓ Inserito nel template WhatsApp Feedback
                          </span>
                        )}
                      </div>
                      <input
                        type="url"
                        placeholder="es. https://g.page/r/tuo-salone/review oppure https://maps.app.goo.gl/..."
                        value={settings.googleReviewLink || ''}
                        onChange={(e) => setSettings({ ...settings, googleReviewLink: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono text-xs focus:ring-2 focus:ring-[#8B5CF6] outline-none"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">
                        Utilizzato dal template WhatsApp "Ringraziamento & Recensione" per invitare i clienti a lasciare una recensione a 5 stelle al termine del trattamento.
                      </p>
                    </div>

                    <div className="pt-3">
                      <button
                        onClick={handleSaveSettings}
                        className="px-5 py-2.5 bg-[#E95F8F] text-white font-bold text-xs rounded-xl shadow-md shadow-pink-500/20 hover:bg-[#d84d7d] transition cursor-pointer"
                      >
                        Salva Modifiche
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </main>

            {/* Mobile Bottom Navigation Bar (when in mobile simulator or mobile screen) */}
            {mobileSimulator && (
              <nav className="bg-white border-t border-pink-100 p-2 flex items-center justify-around sticky bottom-0 z-20">
                {[
                  { id: 'dashboard', label: 'Oggi', icon: Store },
                  { id: 'appointments', label: 'Agenda', icon: Calendar },
                  { id: 'clients', label: 'Clienti', icon: Users },
                  { id: 'services', label: 'Listino', icon: Scissors },
                  { id: 'settings', label: 'Salone', icon: Settings },
                  { id: 'subscription', label: 'Piano', icon: CreditCard },
                ].map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id as any)}
                      className={`flex flex-col items-center gap-1 p-1.5 rounded-xl transition ${
                        active ? 'text-[#E95F8F] font-bold' : 'text-slate-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-[10px]">{item.label}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex flex-col items-center gap-1 p-1.5 rounded-xl text-rose-500 hover:text-rose-600 transition"
                  title="Disconnetti account"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="text-[10px] font-semibold">Esci</span>
                </button>
              </nav>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* MODAL: NUOVO APPUNTAMENTO */}
      {/* ============================================================== */}
      {isNewAppointmentOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[92vh] overflow-y-auto p-6 shadow-2xl border border-pink-100 space-y-4">
            <div className="flex items-center justify-between border-b border-pink-50 pb-3">
              <h3 className="font-bold text-[#1E1B2E] text-base flex items-center gap-2">
                <Scissors className="w-4 h-4 text-[#E95F8F]" /> Nuovo Appuntamento
              </h3>
              <button onClick={handleCloseNewAppointment} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {!isSubscriptionValid && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold block">Abbonamento non attivo o scaduto</span>
                  <p className="text-[11px] text-amber-800">
                    Il piano attuale ({settings.subscription?.status || 'Non attivo'}) non consente di creare nuovi appuntamenti. Rinnova il piano su Stripe per continuare.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      handleCloseNewAppointment();
                      setActiveTab('subscription');
                    }}
                    className="inline-flex items-center gap-1 font-bold text-[#8B5CF6] hover:underline pt-0.5 cursor-pointer"
                  >
                    Gestisci Abbonamento →
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleAddAppointment} className="space-y-3.5 text-xs">
              {/* ================= SELEZIONE / CREAZIONE CLIENTE ================= */}
              {isQuickNewClientMode ? (
                /* MODALITA: NUOVO CLIENTE RAPIDO */
                <div className="p-3.5 bg-gradient-to-br from-pink-50/90 via-purple-50/60 to-pink-50/90 border border-pink-200/90 rounded-2xl space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-pink-100 pb-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#E95F8F]">
                      <UserPlus className="w-4 h-4 text-[#8B5CF6]" />
                      <span>Nuovo Cliente Rapido</span>
                      <span className="text-[10px] bg-pink-100 text-[#E95F8F] px-1.5 py-0.5 rounded-full font-medium">
                        Salvataggio automatico
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsQuickNewClientMode(false);
                        setClientSearchQuery('');
                      }}
                      className="text-[11px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
                    >
                      Cerca cliente esistente
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1 text-[11px]">Nome *</label>
                      <input
                        type="text"
                        required
                        placeholder="Nome"
                        value={quickNewClientFirstName}
                        onChange={(e) => setQuickNewClientFirstName(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#8B5CF6] outline-none text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1 text-[11px]">Cognome</label>
                      <input
                        type="text"
                        placeholder="Cognome"
                        value={quickNewClientLastName}
                        onChange={(e) => setQuickNewClientLastName(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#8B5CF6] outline-none text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1 text-[11px]">Cellulare (per promemoria WhatsApp) *</label>
                    <input
                      type="text"
                      required
                      placeholder="+39 340 1234567"
                      value={quickNewClientPhone}
                      onChange={(e) => setQuickNewClientPhone(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-[#8B5CF6] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1 text-[11px]">Note Tecniche Cliente (Allergie, Cute, Preferenze)</label>
                    <textarea
                      rows={2}
                      placeholder="Es. Allergica all'ammoniaca, cute sensibile, preferisce colore caldo..."
                      value={quickNewClientNotes}
                      onChange={(e) => setQuickNewClientNotes(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#8B5CF6] outline-none"
                    />
                  </div>
                </div>
              ) : selectedClientForApp ? (
                /* CLIENTE SELEZIONATO DALL'ELENCO */
                <div className="space-y-3">
                  <div className="p-3 bg-pink-50/70 border border-pink-200/80 rounded-2xl flex items-center justify-between shadow-2xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#E95F8F] to-[#8B5CF6] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                        {selectedClientForApp.firstName.charAt(0)}{selectedClientForApp.lastName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-[#1E1B2E] text-xs truncate">
                            {selectedClientForApp.firstName} {selectedClientForApp.lastName}
                          </span>
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Cliente Registrato
                          </span>
                          {selectedClientForApp.tags?.map((t) => (
                            <span key={t} className="px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
                              {t}
                            </span>
                          ))}
                          <ClientReputationBadge
                            noShowCount={selectedClientForApp.noShowCount || 0}
                            isBlocked={selectedClientForApp.isBlocked}
                            size="xs"
                            showAdvice={true}
                          />
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {selectedClientForApp.phone}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedClientForApp(null);
                        setClientSearchQuery('');
                        setNewAppClientName('');
                        setNewAppClientPhone('');
                      }}
                      className="text-xs text-slate-400 hover:text-slate-700 hover:bg-white p-1.5 rounded-lg border border-transparent hover:border-slate-200 transition cursor-pointer"
                      title="Cambia cliente"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Warning / Risk Banners for No-Show Protection */}
                  {selectedClientForApp.isBlocked ? (
                    <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-900 flex items-start gap-2.5 animate-fadeIn">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block text-rose-800 font-bold">ATTENZIONE: Cliente Bloccato</strong>
                        Questo cliente risulta bloccato per No-Show seriali. Valutare attentamente prima di confermare la prenotazione.
                      </div>
                    </div>
                  ) : (selectedClientForApp.noShowCount || 0) >= 2 ? (
                    <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-2.5 animate-fadeIn">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block text-amber-800 font-bold">Cliente ad Alto Rischio ({selectedClientForApp.noShowCount} No-Show registrati)</strong>
                        Si consiglia vivamente di richiedere conferma telefonica o un acconto prima di fissare lo slot in agenda.
                      </div>
                    </div>
                  ) : (selectedClientForApp.noShowCount || 0) === 1 ? (
                    <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2 animate-fadeIn">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <span>1 appuntamento saltato in precedenza. Si suggerisce di inviare un promemoria WhatsApp preventivo.</span>
                    </div>
                  ) : null}

                  {/* Technical Notes Salone if present */}
                  {selectedClientForApp.technicalNotes && (
                    <div className="p-2.5 bg-purple-50/80 border border-purple-200 rounded-xl space-y-1 animate-fadeIn">
                      <span className="flex items-center gap-1 text-[#8B5CF6] font-bold text-[10px] uppercase tracking-wider">
                        <Sparkles className="w-3 h-3" /> Note Tecniche Salone:
                      </span>
                      <p className="text-slate-800 text-xs font-medium">
                        {selectedClientForApp.technicalNotes}
                      </p>
                    </div>
                  )}

                  {/* Visual badge per le note tecniche/preferenze del cliente */}
                  {selectedClientForApp.notes ? (
                    <div className="p-3 bg-gradient-to-r from-pink-50/90 via-purple-50/70 to-pink-50/90 border border-pink-200/90 rounded-2xl space-y-1.5 shadow-2xs animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-[#E95F8F] font-bold text-[11px] uppercase tracking-wider">
                          <Sparkles className="w-3.5 h-3.5 text-[#8B5CF6]" />
                          Note Generali & Preferenze Cliente
                        </span>
                        <span className="text-[10px] bg-white/90 text-purple-700 font-semibold px-2 py-0.5 rounded-full border border-purple-200">
                          Dalla Scheda Cliente
                        </span>
                      </div>
                      <p className="text-slate-800 text-xs font-medium bg-white/80 p-2.5 rounded-xl border border-pink-100/70 shadow-2xs leading-relaxed">
                        {selectedClientForApp.notes}
                      </p>
                    </div>
                  ) : (
                    <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-slate-400" />
                      <span>Nessuna nota generale o allergia registrata nella scheda cliente.</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Cellulare (per promemoria WhatsApp)</label>
                    <input
                      type="text"
                      placeholder="+39 340 1234567"
                      value={newAppClientPhone}
                      onChange={(e) => setNewAppClientPhone(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-[#8B5CF6] outline-none"
                    />
                  </div>
                </div>
              ) : (
                /* RICERCA DINAMICA CON AUTOCOMPLETAMENTO */
                <div className="space-y-3">
                  <div className="relative" ref={clientSearchRef}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-slate-700 font-semibold text-xs">
                        Cliente *
                      </label>
                      <button
                        type="button"
                        onClick={() => handleStartQuickNewClient(clientSearchQuery)}
                        className="text-[11px] font-bold text-[#E95F8F] hover:text-[#d84d7d] flex items-center gap-1 transition cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>+ Nuovo Cliente</span>
                      </button>
                    </div>

                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Cerca cliente per nome, cognome o cellulare..."
                        value={clientSearchQuery}
                        onChange={(e) => {
                          setClientSearchQuery(e.target.value);
                          setNewAppClientName(e.target.value);
                          setIsClientDropdownOpen(true);
                        }}
                        onFocus={() => setIsClientDropdownOpen(true)}
                        className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#8B5CF6] focus:bg-white outline-none text-xs transition"
                      />
                      {clientSearchQuery && (
                        <button
                          type="button"
                          onClick={() => {
                            setClientSearchQuery('');
                            setNewAppClientName('');
                            setIsClientDropdownOpen(false);
                          }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Tendina dei risultati */}
                    {isClientDropdownOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-pink-100 rounded-2xl shadow-xl z-50 overflow-hidden max-h-64 overflow-y-auto divide-y divide-slate-100 animate-fadeIn">
                        <div className="p-2 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                          <span>
                            {matchingClients.length > 0
                              ? `${matchingClients.length} clienti trovati`
                              : 'Nessun cliente corrispondente'}
                          </span>
                          <span className="text-[10px] text-slate-400">Clicca per selezionare</span>
                        </div>

                        {matchingClients.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => handleSelectClientForApp(c)}
                            className="w-full p-2.5 text-left hover:bg-pink-50/60 transition flex items-center justify-between gap-2 cursor-pointer group"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-full bg-pink-100 group-hover:bg-[#E95F8F] group-hover:text-white text-[#E95F8F] flex items-center justify-center font-bold text-[11px] shrink-0 transition">
                                {c.firstName.charAt(0)}{c.lastName.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-[#1E1B2E] text-xs truncate">
                                    {c.firstName} {c.lastName}
                                  </span>
                                  {c.tags?.slice(0, 1).map((t) => (
                                    <span key={t} className="px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                                      {t}
                                    </span>
                                  ))}
                                  <ClientReputationBadge
                                    noShowCount={c.noShowCount || 0}
                                    isBlocked={c.isBlocked}
                                    size="xs"
                                  />
                                </div>
                                <span className="text-[11px] text-slate-500 font-mono block">
                                  {c.phone}
                                </span>
                                {c.notes && (
                                  <span className="text-[10px] text-purple-600/90 truncate block italic">
                                    Note: {c.notes}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="text-[11px] font-semibold text-[#8B5CF6] group-hover:translate-x-0.5 transition shrink-0">
                              Seleziona →
                            </span>
                          </button>
                        ))}

                        {/* Opzione: Aggiungi come nuovo cliente rapido */}
                        <button
                          type="button"
                          onClick={() => handleStartQuickNewClient(clientSearchQuery)}
                          className="w-full p-2.5 text-left bg-gradient-to-r from-pink-50/90 to-purple-50/80 hover:from-pink-100 hover:to-purple-100 text-[#E95F8F] font-semibold text-xs flex items-center gap-2.5 transition cursor-pointer"
                        >
                          <div className="w-7 h-7 rounded-full bg-pink-100 text-[#E95F8F] flex items-center justify-center shrink-0 shadow-2xs">
                            <Plus className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="block font-bold text-xs truncate">
                              {clientSearchQuery.trim()
                                ? `+ Aggiungi "${clientSearchQuery.trim()}" come nuovo cliente`
                                : '+ Aggiungi nuovo cliente rapido'}
                            </span>
                            <span className="text-[10px] text-slate-500 font-normal block">
                              Crea la scheda e associala all\'appuntamento
                            </span>
                          </div>
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Cellulare (per promemoria WhatsApp)</label>
                    <input
                      type="text"
                      placeholder="+39 340 1234567"
                      value={newAppClientPhone}
                      onChange={(e) => setNewAppClientPhone(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-[#8B5CF6] outline-none"
                    />
                  </div>
                </div>
              )}

              {/* ================= SELETTORE MULTI-SERVIZIO AVANZATO ================= */}
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="block text-slate-700 font-semibold text-xs">
                    Trattamenti / Servizi * ({newAppSelectedServiceIds.length} selezionati)
                  </label>
                  {newAppSelectedServiceIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setNewAppSelectedServiceIds([])}
                      className="text-[11px] font-medium text-slate-400 hover:text-rose-600 transition cursor-pointer"
                    >
                      Deseleziona tutti
                    </button>
                  )}
                </div>

                {/* Filtro Ricerca & Categorie */}
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Cerca trattamento (es. Taglio, Colore, Piega, Unghie)..."
                      value={serviceModalSearch}
                      onChange={(e) => setServiceModalSearch(e.target.value)}
                      className="w-full pl-8.5 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#8B5CF6] outline-none"
                    />
                    {serviceModalSearch && (
                      <button
                        type="button"
                        onClick={() => setServiceModalSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Categorie chips */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                    {modalAvailableCategories.map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setServiceModalCategory(cat)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition cursor-pointer ${
                          serviceModalCategory === cat
                            ? 'bg-[#8B5CF6] text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {cat === 'all' ? 'Tutti i Trattamenti' : cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Lista scorrevole dei servizi a checkbox */}
                <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-2xl divide-y divide-slate-100 bg-slate-50/50 p-1">
                  {filteredServicesForModal.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 text-xs">
                      Nessun servizio trovato con questi filtri.
                    </div>
                  ) : (
                    filteredServicesForModal.map(srv => {
                      const isSelected = newAppSelectedServiceIds.includes(srv.id);
                      return (
                        <div
                          key={srv.id}
                          onClick={() => handleToggleService(srv.id)}
                          className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition select-none ${
                            isSelected
                              ? 'bg-pink-50/90 border border-pink-200 text-slate-900 shadow-2xs'
                              : 'hover:bg-white text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-4 h-4 rounded-md border flex items-center justify-center transition shrink-0 ${
                                isSelected
                                  ? 'bg-[#E95F8F] border-[#E95F8F] text-white'
                                  : 'border-slate-300 bg-white'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-xs truncate">{srv.name}</span>
                                <span className="px-1.5 py-0.2 rounded text-[10px] bg-purple-50 text-[#8B5CF6] border border-purple-100 font-medium">
                                  {srv.category}
                                </span>
                              </div>
                              {srv.description && (
                                <p className="text-[10px] text-slate-500 truncate max-w-xs">{srv.description}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0 ml-2">
                            <span className="font-bold text-xs text-[#E95F8F]">€{srv.price}</span>
                            <span className="block text-[10px] text-slate-500">{srv.durationMinutes} min</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Badge/Tags dei servizi scelti */}
                {selectedServicesList.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-slate-500 font-medium mr-0.5">Selezionati:</span>
                    {selectedServicesList.map(s => (
                      <span
                        key={s.id}
                        className="inline-flex items-center gap-1 pl-2 pr-1.5 py-0.5 rounded-lg bg-pink-100 text-[#E95F8F] border border-pink-200 text-[11px] font-semibold"
                      >
                        {s.name}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleService(s.id);
                          }}
                          className="hover:bg-pink-200 p-0.5 rounded text-[#E95F8F] cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Box di Riepilogo e Calcolo Automatico (Durata Totale, Fine Stimata, Totale €) */}
                <div className="p-3 bg-gradient-to-r from-pink-50 via-purple-50 to-pink-50 border border-pink-200 rounded-2xl shadow-2xs space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <span className="flex items-center gap-1 text-[#8B5CF6]">
                      <Sparkles className="w-3.5 h-3.5" /> Calcolo Automatico Trattamenti
                    </span>
                    <span className="text-slate-600">{selectedServicesList.length} {selectedServicesList.length === 1 ? 'servizio' : 'servizi'}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-pink-100">
                    <div className="bg-white/90 p-2 rounded-xl border border-pink-100/70 text-center">
                      <span className="block text-[10px] text-slate-500 font-medium">Durata Totale</span>
                      <span className="font-bold text-xs text-slate-900 flex items-center justify-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-[#8B5CF6]" />
                        {totalSelectedMinutes} min
                      </span>
                    </div>
                    <div className="bg-white/90 p-2 rounded-xl border border-pink-100/70 text-center">
                      <span className="block text-[10px] text-slate-500 font-medium">Fine Stimata</span>
                      <span className="font-mono font-bold text-xs text-[#8B5CF6] mt-0.5 block">
                        {newAppTime} ➔ {estimatedEndTime}
                      </span>
                    </div>
                    <div className="bg-white/90 p-2 rounded-xl border border-pink-100/70 text-center">
                      <span className="block text-[10px] text-slate-500 font-medium">Totale Cumulativo</span>
                      <span className="font-black text-xs text-[#E95F8F] mt-0.5 block">
                        €{totalSelectedPrice.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Selettore Collaboratore / Staff Assegnato */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1 text-xs flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#8B5CF6]" />
                    <span>Collaboratore Assegnato *</span>
                  </span>
                  {(() => {
                    const currentStaff = (settings.staffMembers || []).find(s => s.id === newAppStaffId);
                    if (!currentStaff) return null;
                    const cCfg = getStaffColorConfig(currentStaff.color);
                    return (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${cCfg.bg} ${cCfg.text} border ${cCfg.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cCfg.dot}`} />
                        {currentStaff.role}
                      </span>
                    );
                  })()}
                </label>
                <select
                  value={newAppStaffId}
                  onChange={(e) => setNewAppStaffId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#8B5CF6]"
                >
                  {(settings.staffMembers || []).filter(s => s.isActive).map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name} — {staff.role}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Data</label>
                  <input
                    type="date"
                    value={newAppDate}
                    onChange={(e) => setNewAppDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Ora Inizio</label>
                  <input
                    type="time"
                    value={newAppTime}
                    onChange={(e) => setNewAppTime(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Note Aggiuntive Appuntamento</label>
                <textarea
                  rows={2}
                  placeholder="Es. Richiede asciugatura speciale, piega morbida..."
                  value={newAppNotes}
                  onChange={(e) => setNewAppNotes(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseNewAppointment}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={newAppSelectedServiceIds.length === 0}
                  className={`px-5 py-2 font-bold rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5 ${
                    newAppSelectedServiceIds.length === 0
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-[#E95F8F] text-white hover:bg-[#d84d7d]'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  Salva Appuntamento {totalSelectedPrice > 0 && `(€${totalSelectedPrice.toFixed(2)})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: NUOVO CLIENTE */}
      {/* ============================================================== */}
      {isNewClientOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-pink-100 space-y-4">
            <div className="flex items-center justify-between border-b border-pink-50 pb-3">
              <h3 className="font-bold text-[#1E1B2E] text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-[#8B5CF6]" /> Aggiungi Nuovo Cliente
              </h3>
              <button onClick={() => setIsNewClientOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const fName = (form.elements.namedItem('fName') as HTMLInputElement).value;
                const lName = (form.elements.namedItem('lName') as HTMLInputElement).value;
                const phone = (form.elements.namedItem('phone') as HTMLInputElement).value;
                const email = (form.elements.namedItem('email') as HTMLInputElement).value;
                const notes = (form.elements.namedItem('notes') as HTMLTextAreaElement).value;

                let createdCli: Client | null = null;
                if (isValidUUID(currentSalonId)) {
                  createdCli = await insertClientToSupabase({
                    salonId: currentSalonId,
                    firstName: fName,
                    lastName: lName,
                    phone,
                    email,
                    technicalNotes: notes,
                    status: 'Attivo',
                    noShowCount: 0,
                  });
                }

                const newCli: Client = createdCli || {
                  id: `cli-${Date.now()}`,
                  salonId: currentSalonId,
                  firstName: fName,
                  lastName: lName,
                  phone,
                  email,
                  notes,
                  technicalNotes: notes,
                  totalAppointments: 0,
                  totalSpent: 0,
                  noShowCount: 0,
                  isBlocked: false,
                  status: 'Attivo',
                  tags: ['Nuovo Cliente'],
                };
                setClients([newCli, ...clients]);
                setIsNewClientOpen(false);
                showToast(`Cliente ${fName} ${lName} inserito con successo!`);
              }}
              className="space-y-3.5 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Nome *</label>
                  <input name="fName" required placeholder="Nome" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl" />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Cognome *</label>
                  <input name="lName" required placeholder="Cognome" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl" />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Cellulare (WhatsApp) *</label>
                <input name="phone" required placeholder="+39 340 1234567" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono" />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Email</label>
                <input name="email" type="email" placeholder="cliente@email.it" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl" />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Note Tecniche (Cute, Allergie, Preferenze)</label>
                <textarea name="notes" rows={2} placeholder="Es. No ammoniaca, caffè d'orzo..." className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl" />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button type="button" onClick={() => setIsNewClientOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl">
                  Annulla
                </button>
                <button type="submit" className="px-5 py-2 bg-[#8B5CF6] text-white font-bold rounded-xl shadow-md hover:bg-[#7846ea]">
                  Salva Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: NUOVO SERVIZIO */}
      {/* ============================================================== */}
      {isNewServiceOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-pink-100 space-y-4">
            <div className="flex items-center justify-between border-b border-pink-50 pb-3">
              <h3 className="font-bold text-[#1E1B2E] text-base flex items-center gap-2">
                <Scissors className="w-4 h-4 text-[#E95F8F]" /> Aggiungi Servizio al Listino
              </h3>
              <button onClick={() => setIsNewServiceOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const name = (form.elements.namedItem('srvName') as HTMLInputElement).value;
                const category = (form.elements.namedItem('srvCategory') as HTMLSelectElement).value as any;
                const duration = parseInt((form.elements.namedItem('srvDuration') as HTMLInputElement).value, 10);
                const price = parseFloat((form.elements.namedItem('srvPrice') as HTMLInputElement).value);
                const desc = (form.elements.namedItem('srvDesc') as HTMLTextAreaElement).value;

                let createdSrv: Service | null = null;
                if (isValidUUID(currentSalonId)) {
                  createdSrv = await insertServiceToSupabase({
                    salonId: currentSalonId,
                    name,
                    category,
                    durationMinutes: duration || 45,
                    price: price || 30,
                    isActive: true,
                    description: desc,
                  });
                }

                const newSrv: Service = createdSrv || {
                  id: `srv-${Date.now()}`,
                  salonId: currentSalonId,
                  name,
                  category,
                  durationMinutes: duration || 45,
                  price: price || 30,
                  isActive: true,
                  description: desc,
                };
                setServices([...services, newSrv]);
                setIsNewServiceOpen(false);
                showToast(`Servizio "${name}" aggiunto al listino!`);
              }}
              className="space-y-3.5 text-xs"
            >
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Nome Trattamento / Servizio *</label>
                <input name="srvName" required placeholder="Es. Trattamento Cheratina Lisciante" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl" />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Categoria</label>
                  <select name="srvCategory" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <option value="Capelli">Capelli</option>
                    <option value="Estetica">Estetica</option>
                    <option value="Unghie">Unghie</option>
                    <option value="Massaggi">Massaggi</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Durata (min)</label>
                  <input name="srvDuration" type="number" defaultValue={45} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono" />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Prezzo (€)</label>
                  <input name="srvPrice" type="number" defaultValue={40} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-[#E95F8F]" />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Descrizione breve</label>
                <textarea name="srvDesc" rows={2} placeholder="Dettagli sul trattamento..." className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl" />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button type="button" onClick={() => setIsNewServiceOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl">
                  Annulla
                </button>
                <button type="submit" className="px-5 py-2 bg-[#E95F8F] text-white font-bold rounded-xl shadow-md hover:bg-[#d84d7d]">
                  Crea Servizio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: CONFERMA ELIMINAZIONE SERVIZIO */}
      {/* ============================================================== */}
      {serviceToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-pink-100 space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-[#1E1B2E] text-base">
                  Eliminare questo servizio?
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Stai per eliminare il servizio <strong className="text-slate-900 font-semibold">{serviceToDelete.name}</strong> ({serviceToDelete.category} - €{serviceToDelete.price}) dal listino salone.
                </p>
                <div className="mt-2.5 p-2.5 bg-rose-50/70 border border-rose-100 rounded-xl text-[11px] text-rose-800">
                  💡 Suggerimento: Se desideri solo non renderlo prenotabile per un periodo, puoi selezionare <strong>"Solo Disattiva"</strong>.
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setServiceToDelete(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => {
                  handleSetServiceActive(serviceToDelete.id, false);
                  setServiceToDelete(null);
                }}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Solo Disattiva
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteService}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-600/20 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Elimina definitivamente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: CENTRO PROMEMORIA & MESSAGGI RAPIDI (DOMANI & RECENSIONI) */}
      {/* ============================================================== */}
      <QuickRemindersModal
        isOpen={isRemindersModalOpen}
        onClose={() => setIsRemindersModalOpen(false)}
        appointments={appointments}
        settings={settings}
        todayStr={todayStr}
        onShowToast={showToast}
      />

      {/* ============================================================== */}
      {/* MODAL: CASSA E QUADRATURA INCASSO (CHECKOUT) */}
      {/* ============================================================== */}
      <CheckoutModal
        isOpen={!!checkoutAppointment}
        appointment={checkoutAppointment}
        onClose={() => setCheckoutAppointment(null)}
        onConfirmPayment={handleConfirmPayment}
      />

      {/* ============================================================== */}
      {/* MODAL: SCHEDA CLIENTE, STORICO TRATTAMENTI & NO-SHOW CONTROL */}
      {/* ============================================================== */}
      <ClientHistoryModal
        isOpen={isClientHistoryOpen}
        client={selectedClientForModal}
        appointments={appointments}
        settings={settings}
        onClose={() => setIsClientHistoryOpen(false)}
        onUpdateClient={handleUpdateClientFromModal}
        onBookAppointmentForClient={handleBookAppointmentForClient}
        onShowToast={showToast}
      />
    </div>
  );
}
