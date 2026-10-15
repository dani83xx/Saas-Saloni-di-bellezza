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

  // Core State
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
  });

  const [clients, setClients] = useState<Client[]>(() => {
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

  useEffect(() => {
    try {
      localStorage.setItem('salondesk_clients', JSON.stringify(clients));
    } catch {
      // ignore
    }
  }, [clients]);

  // Gestione stato servizi
  const [serviceStatusMenuOpen, setServiceStatusMenuOpen] = useState<string | null>(null);
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);
  const [servicesViewMode, setServicesViewMode] = useState<'table' | 'cards'>('table');
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState<string>('all');
  const [serviceStatusFilter, setServiceStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [serviceSearch, setServiceSearch] = useState('');

  // Modali
  const [isNewAppointmentOpen, setIsNewAppointmentOpen] = useState(false);
  const [isNewClientOpen, setIsNewClientOpen] = useState(false);
  const [isNewServiceOpen, setIsNewServiceOpen] = useState(false);
  const [selectedClientForModal, setSelectedClientForModal] = useState<Client | null>(null);
  const [isClientHistoryOpen, setIsClientHistoryOpen] = useState(false);

  // Form rapido appuntamento
  const [newAppClientName, setNewAppClientName] = useState('');
  const [newAppClientPhone, setNewAppClientPhone] = useState('');
  const [newAppDate, setNewAppDate] = useState(getTodayStr());
  const [newAppTime, setNewAppTime] = useState('11:00');
  const [newAppNotes, setNewAppNotes] = useState('');
  const [newAppStaffId, setNewAppStaffId] = useState<string>(() => {
    return initialSettings.staffMembers?.find(s => s.isActive)?.id || 'staff-1';
  });
  const [appointmentStaffFilter, setAppointmentStaffFilter] = useState<string>('all');

  // Cassa modal
  const [checkoutAppointment, setCheckoutAppointment] = useState<Appointment | null>(null);

  // Multi-servizio
  const [newAppSelectedServiceIds, setNewAppSelectedServiceIds] = useState<string[]>(() => {
    return initialServices[0] ? [initialServices[0].id] : [];
  });
  const [serviceModalSearch, setServiceModalSearch] = useState('');
  const [serviceModalCategory, setServiceModalCategory] = useState<string>('all');

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

  // Autocomplete cliente
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

  // Filtri
  const [clientSearch, setClientSearch] = useState('');
  const [clientFilterStatus, setClientFilterStatus] = useState<'all' | 'Attivo' | 'Inattivo' | 'VIP'>('all');
  const [appointmentDateFilter, setAppointmentDateFilter] = useState<'today' | 'all' | 'noshow'>('today');
  const [appointmentViewMode, setAppointmentViewMode] = useState<'calendar' | 'timeline' | 'table'>('calendar');

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const currentSalonId = currentUser?.salonId || settings.salonId || 'salon-lucestile-01';

  const [isDataLoading, setIsDataLoading] = useState(false);

  const currentUserRef = useRef<UserSession | null>(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const fetchedSessionUserIdRef = useRef<string | null>(null);

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

      if (
        currentUserRef.current?.id === sessionUser.id &&
        currentUserRef.current.salonId &&
        currentUserRef.current.salonId !== 'loading' &&
        fetchedSessionUserIdRef.current === sessionUser.id
      ) {
        return;
      }

      fetchedSessionUserIdRef.current = sessionUser.id;

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
                  closingHours: (salonRecord as any).closing_hours || (prev as any).closingHours,
                  logoUrl: salonRecord.logo_url || prev.logoUrl,
                }));
              }
            })
            .catch(() => {});
        }
      } catch (e) {
        console.warn('Recupero sessione:', e);
      }
    });

    return () => {
      authSubscription.subscription.unsubscribe();
    };
  }, []);

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
    showToast("Benvenuto su SalonDesk! Il tuo salone è pronto all'uso.");
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
    showToast(`Accesso Demo: ${demoSession.salonName}`);
  };

  const handleLogout = async () => {
    dashboardLoadedRef.current = null;
    appointmentsLoadedRef.current = null;
    clientsLoadedRef.current = null;
    servicesLoadedRef.current = null;

    try {
      await supabase.auth.signOut();
    } catch {}
    try {
      localStorage.removeItem('salondesk_session');
      sessionStorage.removeItem('salondesk_session');
    } catch {}
    setIsAuthenticated(false);
    setCurrentUser(null);
    showToast('Disconnessione effettuata con successo.');
  };

  const todayStr = getTodayStr();

  const fetchWithMockFallback = async <T,>(
    fetchFn: () => Promise<T>,
    mockFallback: T,
    timeoutMs = 2000,
    label = 'Dati'
  ): Promise<T> => {
    let timeoutId: any;
    const timeoutPromise = new Promise<T>((resolve) => {
      timeoutId = setTimeout(() => {
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
      return mockFallback;
    }
  };

  const dashboardLoadedRef = useRef<string | null>(null);
  const appointmentsLoadedRef = useRef<string | null>(null);
  const clientsLoadedRef = useRef<string | null>(null);
  const servicesLoadedRef = useRef<string | null>(null);

  // Caricamento Dati
  useEffect(() => {
    if (!currentUser?.salonId) return;
    if (activeTab !== 'dashboard') return;
    if (dashboardLoadedRef.current === currentUser.salonId) return;

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

  useEffect(() => {
    if (!currentUser?.salonId) return;
    if (activeTab !== 'appointments') return;

    const loadKey = `${currentUser.salonId}_${appointmentDateFilter}`;
    if (appointmentsLoadedRef.current === loadKey) return;

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

  useEffect(() => {
    if (!currentUser?.salonId) return;
    if (activeTab !== 'clients') return;
    if (clientsLoadedRef.current === currentUser.salonId) return;

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

  useEffect(() => {
    if (!currentUser?.salonId) return;
    if (activeTab !== 'services') return;
    if (servicesLoadedRef.current === currentUser.salonId) return;

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

  const inactiveClients = clients.filter(c => c.status === 'Inattivo');
  const noShowAppointments = appointments.filter(a => a.status === 'No-Show');

  // BADGE DI STATO PORTATI A 12px (text-xs)
  const getStatusBadge = (status: AppointmentStatus) => {
    switch (status) {
      case 'Confermato':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle2 className="w-3 h-3" /> Confermato</span>;
      case 'In corso':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 animate-pulse"><Sparkles className="w-3 h-3 text-[#8B5CF6]" /> In poltrona</span>;
      case 'Completato':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200"><Check className="w-3 h-3" /> Fatto</span>;
      case 'No-Show':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200"><AlertCircle className="w-3 h-3 text-rose-600" /> No-Show</span>;
      case 'Annullato':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200"><XCircle className="w-3 h-3" /> Annullato</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">{status}</span>;
    }
  };

  const handleOpenCheckout = (app: Appointment) => {
    setCheckoutAppointment(app);
  };

  const findClientForApp = (app: Appointment): Client | undefined => {
    const fullName = (app.clientName || '').toLowerCase().trim();
    const phoneClean = (app.clientPhone || '').replace(/[\s+-]/g, '');
    return clients.find(c => {
      const cFullName = `${c.firstName} ${c.lastName}`.toLowerCase().trim();
      const cPhoneClean = (c.phone || '').replace(/[\s+-]/g, '');
      return cFullName === fullName || (phoneClean && cPhoneClean && phoneClean === cPhoneClean);
    });
  };

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

    showToast(`Incasso di €${finalAmount.toFixed(2)} registrato!`);
    setCheckoutAppointment(null);
  };

  const handleStatusChange = (id: string, newStatus: AppointmentStatus) => {
    const targetApp = appointments.find(a => a.id === id);
    if (!targetApp) return;

    if (newStatus === 'Completato' && !targetApp.isPaid) {
      handleOpenCheckout(targetApp);
      return;
    }

    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));

    if (isValidUUID(id)) {
      updateAppointmentInSupabase(id, { status: newStatus });
    }

    showToast(`Stato aggiornato a: ${newStatus}`);
  };

  const handleSetServiceActive = (id: string, isActive: boolean) => {
    setServices(prev => prev.map(s => s.id === id ? { ...s, isActive } : s));
    if (isValidUUID(id)) {
      updateServiceInSupabase(id, { isActive });
    }
    showToast(`Servizio ${isActive ? 'Attivato' : 'Disattivato'}`);
  };

  const handleLogoChange = (newLogoUrl: string | undefined) => {
    const updatedSettings = { ...settings, logoUrl: newLogoUrl };
    setSettings(updatedSettings);
    try {
      localStorage.setItem('salondesk_settings', JSON.stringify(updatedSettings));
    } catch {}
    if (isValidUUID(currentSalonId)) {
      supabase.from('salons').update({ logo_url: newLogoUrl }).eq('id', currentSalonId).catch(() => {});
    }
  };

  const handleSaveSettings = () => {
    try {
      localStorage.setItem('salondesk_settings', JSON.stringify(settings));
    } catch {}

    if (isValidUUID(currentSalonId)) {
      supabase
        .from('salons')
        .update({
          name: settings.name,
          owner_name: settings.ownerName,
          whatsapp_number: settings.whatsappNumber,
          address: settings.address,
          city: settings.city,
          open_hours: settings.openHours,
          logo_url: settings.logoUrl,
        })
        .eq('id', currentSalonId)
        .then(() => showToast('Impostazioni salvate con successo!'))
        .catch(() => showToast('Impostazioni salvate localmente!'));
    } else {
      showToast('Impostazioni salvate con successo!');
    }
  };

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
    } catch {}
  };

  const handleCloseNewAppointment = () => {
    setIsNewAppointmentOpen(false);
    resetNewAppointmentState();
  };

  const handleOpenNewAppointment = (date?: string) => {
    if (!isSubscriptionValid) {
      showToast('Abbonamento non attivo.');
      setActiveTab('subscription');
      return;
    }
    resetNewAppointmentState();
    if (date) setNewAppDate(date);
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
      setQuickNewClientFirstName(parts[0] || '');
      setQuickNewClientLastName(parts.slice(1).join(' ') || '');
      setQuickNewClientPhone(newAppClientPhone || '');
    }
    setQuickNewClientNotes('');
  };

  const handleAddAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSubscriptionValid) {
      showToast('Abbonamento scaduto.');
      return;
    }

    if (newAppSelectedServiceIds.length === 0) {
      showToast('Seleziona almeno un servizio.');
      return;
    }

    const currentSelectedServices = services.filter(s => newAppSelectedServiceIds.includes(s.id));
    const finalPrice = currentSelectedServices.reduce((sum, s) => sum + s.price, 0);
    const finalDuration = currentSelectedServices.reduce((sum, s) => sum + s.durationMinutes, 0);
    const chosenServiceIds = currentSelectedServices.map(s => s.id);
    const chosenServiceNames = currentSelectedServices.map(s => s.name);
    const formattedServiceName = chosenServiceNames.join(' + ');

    const chosenStaff = (settings.staffMembers || []).find(s => s.id === newAppStaffId) || settings.staffMembers?.[0];
    const finalStaffId = chosenStaff?.id || 'staff-1';
    const finalStaffName = chosenStaff ? chosenStaff.name : settings.ownerName;

    const finalClientName = selectedClientForApp
      ? `${selectedClientForApp.firstName} ${selectedClientForApp.lastName}`.trim()
      : (newAppClientName.trim() || clientSearchQuery.trim());

    if (!finalClientName) {
      showToast('Inserisci il nome del cliente.');
      return;
    }

    const finalClientPhone = newAppClientPhone.trim() || (selectedClientForApp ? selectedClientForApp.phone : '+39 340 0000000');

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
    showToast(`Appuntamento registrato con successo!`);
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
      <div className="hidden md:flex bg-gradient-to-r from-[#1E1B2E] via-[#2D1B36] to-[#1E1B2E] text-white text-xs px-4 py-2 items-center justify-between border-b border-purple-950/40">
        <div className="flex items-center gap-3">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E95F8F] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#E95F8F]"></span>
          </span>
          <span className="font-medium text-slate-200">
            <strong className="text-white">SalonDesk SaaS</strong> — Prototipo Live Interattivo
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
            {mobileSimulator ? 'Vista Desktop' : 'Simula Mobile'}
          </button>
        </div>
      </div>

      <div className={`flex-1 flex justify-center ${mobileSimulator ? 'p-4 md:p-8 bg-slate-900/40' : ''}`}>
        <div
          className={`flex w-full bg-white shadow-2xl transition-all ${
            mobileSimulator
              ? 'max-w-[390px] min-h-[780px] max-h-[880px] rounded-[36px] overflow-hidden border-[10px] border-slate-900 flex-col relative'
              : 'min-h-screen'
          }`}
        >
          {/* SIDEBAR DESKTOP */}
          {!mobileSimulator && (
            <aside className="hidden md:flex w-64 bg-[#1E1B2E] text-slate-200 flex-col justify-between border-r border-slate-800 shrink-0">
              <div>
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
                    <p className="text-[11px] text-pink-300/80 truncate">Titolare: {currentUser?.ownerName || settings.ownerName}</p>
                  </div>
                </div>

                <nav className="p-3 space-y-4">
                  <div className="space-y-1">
                    <div className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400/80">
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
                          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                            isActive
                              ? 'bg-gradient-to-r from-[#E95F8F] to-[#8B5CF6] text-white shadow font-semibold'
                              : 'text-slate-300 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                            <span className="whitespace-nowrap">{tab.label}</span>
                          </div>
                          {tab.badge !== undefined && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${isActive ? 'bg-white/25 text-white' : 'bg-slate-800 text-slate-400'}`}>
                              {tab.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}

                    <div className="pt-1.5">
                      <button
                        type="button"
                        onClick={() => setIsRemindersModalOpen(true)}
                        className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold text-purple-200 bg-purple-950/40 border border-purple-800/50 hover:bg-purple-900/50 transition cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <Bell className="w-4 h-4 text-[#E95F8F]" />
                          <span>Promemoria Domani</span>
                        </div>
                        {/* BADGE CONTATORE A 12px (text-xs) */}
                        <span className="text-xs px-2 py-0.5 rounded-full font-black bg-[#8B5CF6] text-white">
                          {tomorrowAppointments.length}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/10 space-y-1">
                    <div className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400/80">
                      Sistema & Account
                    </div>
                    {[
                      { id: 'settings', label: 'Impostazioni Salone', icon: Settings },
                      { id: 'subscription', label: 'Abbonamento', icon: CreditCard, badgeText: 'Pro' },
                    ].map(tab => {
                      const Icon = tab.icon;
                      const isActive = activeTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id as any)}
                          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                            isActive
                              ? 'bg-gradient-to-r from-[#E95F8F] to-[#8B5CF6] text-white shadow font-semibold'
                              : 'text-slate-300 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                            <span className="whitespace-nowrap">{tab.label}</span>
                          </div>
                          {tab.badgeText && (
                            /* BADGE PIANO A 12px (text-xs) */
                            <span className="text-xs uppercase px-2 py-0.5 rounded-md font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              {tab.badgeText}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </nav>
              </div>

              <div className="p-3.5 m-3 rounded-2xl bg-white/5 border border-white/10 space-y-2.5 text-xs text-slate-300">
                <button
                  onClick={() => setIsNewAppointmentOpen(true)}
                  className="w-full py-2 px-3 rounded-xl bg-[#E95F8F] hover:bg-[#d64b7b] text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Nuovo Appuntamento
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full py-1.5 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-400" />
                  <span>Esci / Disconnetti</span>
                </button>
              </div>
            </aside>
          )}

          {/* AREA PRINCIPALE */}
          <div className="flex-1 flex flex-col min-w-0 bg-[#FAF7F9] overflow-y-auto">
            {isDataLoading && (
              <div className="h-1 w-full bg-pink-100 overflow-hidden sticky top-0 z-30">
                <div className="h-full bg-gradient-to-r from-[#E95F8F] via-[#8B5CF6] to-[#E95F8F] animate-pulse" />
              </div>
            )}

            {/* HEADER */}
            <header className="bg-white border-b border-pink-100 px-3 md:px-8 py-3 flex items-center justify-between sticky top-0 z-20">
              <div className="flex items-center gap-2.5 md:gap-3 min-w-0">
                {settings.logoUrl ? (
                  <img
                    src={settings.logoUrl}
                    alt={currentUser?.salonName || settings.name}
                    className="w-8 h-8 md:w-9 md:h-9 rounded-xl object-contain bg-white p-0.5 border border-pink-200 shadow-2xs shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#E95F8F] to-[#8B5CF6] flex items-center justify-center text-white text-xs font-bold shrink-0">
                    <Scissors className="w-4 h-4" />
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="text-sm md:text-lg font-bold text-[#1E1B2E] truncate">
                    {activeTab === 'dashboard' && 'Dashboard Salone'}
                    {activeTab === 'appointments' && 'Gestione Appuntamenti'}
                    {activeTab === 'clients' && 'Anagrafica Clienti'}
                    {activeTab === 'services' && 'Listino Servizi'}
                    {activeTab === 'stats' && 'Statistiche & KPI'}
                    {activeTab === 'settings' && 'Impostazioni Salone'}
                    {activeTab === 'subscription' && 'Abbonamento & Licenza'}
                  </h2>
                  {/* SOTTOTITOLO A 11px */}
                  <p className="text-[11px] text-slate-500 hidden sm:block">
                    {formatDisplayDate(todayStr, { withWeekday: true, includeYear: true })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 md:gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsRemindersModalOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 md:py-2 rounded-xl text-xs md:text-sm font-bold bg-purple-50 hover:bg-purple-100 text-[#8B5CF6] border border-purple-200 transition cursor-pointer"
                >
                  <Bell className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#8B5CF6]" />
                  <span className="hidden sm:inline">Promemoria Domani</span>
                  {/* BADGE PROMEMORIA A 12px (text-xs) */}
                  <span className="px-1.5 py-0.2 rounded-full text-xs font-extrabold bg-[#8B5CF6] text-white">
                    {tomorrowAppointments.length}
                  </span>
                </button>

                {activeTab === 'dashboard' && (
                  <button
                    onClick={() => handleOpenNewAppointment()}
                    className="bg-[#E95F8F] hover:bg-[#d84d7d] text-white px-2.5 py-1.5 md:px-3.5 md:py-2 rounded-xl text-xs md:text-sm font-semibold flex items-center gap-1 shadow transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" />
                    <span className="hidden sm:inline">Nuovo Appuntamento</span>
                    <span className="sm:hidden text-xs">Nuovo</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleLogout}
                  className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-600" />
                  <span>Esci</span>
                </button>
              </div>
            </header>

            {toastMessage && (
              <div className="mx-3 md:mx-8 mt-3 p-3 bg-emerald-600 text-white text-xs font-semibold rounded-xl shadow-lg flex items-center justify-between animate-fadeIn z-30">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{toastMessage}</span>
                </div>
                <button onClick={() => setToastMessage(null)} className="text-white/80 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <main className="p-3 md:p-8 flex-1 space-y-4 md:space-y-6">
              {/* DASHBOARD TAB */}
              {activeTab === 'dashboard' && (
                <div className="space-y-4 md:space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-4">
                    <div className="bg-white p-3.5 md:p-4 rounded-2xl border border-pink-100 shadow-sm flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        {/* SOTTOTITOLO/ETICHETTA CARD A 11px */}
                        <span className="text-[11px] md:text-xs font-medium text-slate-500">Incasso Oggi</span>
                        <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                          <TrendingUp className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        </div>
                      </div>
                      <div className="mt-1 md:mt-2 text-lg md:text-2xl font-black text-[#1E1B2E]">€{todayRevenue}</div>
                      {/* SOTTOTITOLO CARD A 11px */}
                      <div className="mt-0.5 text-[11px] text-emerald-600 font-medium">{todayAppointments.length} programmati</div>
                    </div>

                    <div className="bg-white p-3.5 md:p-4 rounded-2xl border border-pink-100 shadow-sm flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        {/* SOTTOTITOLO/ETICHETTA CARD A 11px */}
                        <span className="text-[11px] md:text-xs font-medium text-slate-500">In Poltrona</span>
                        <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-purple-50 text-[#8B5CF6] flex items-center justify-center shrink-0">
                          <Scissors className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        </div>
                      </div>
                      <div className="mt-1 md:mt-2 text-lg md:text-2xl font-black text-[#8B5CF6]">
                        {todayAppointments.filter(a => a.status === 'In corso').length}
                      </div>
                      {/* SOTTOTITOLO CARD A 11px */}
                      <div className="mt-0.5 text-[11px] text-slate-500 truncate">
                        {todayAppointments.find(a => a.status === 'In corso')?.clientName || 'Nessuno ora'}
                      </div>
                    </div>

                    <div className="bg-white p-3.5 md:p-4 rounded-2xl border border-pink-100 shadow-sm flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        {/* SOTTOTITOLO/ETICHETTA CARD A 11px */}
                        <span className="text-[11px] md:text-xs font-medium text-slate-500">Da Riattivare</span>
                        <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                          <Clock className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        </div>
                      </div>
                      <div className="mt-1 md:mt-2 text-lg md:text-2xl font-black text-amber-600">{inactiveClients.length}</div>
                      {/* SOTTOTITOLO CARD A 11px */}
                      <div className="mt-0.5 text-[11px] text-amber-700 font-medium">Fermi da &gt;60gg</div>
                    </div>

                    <div className="bg-white p-3.5 md:p-4 rounded-2xl border border-pink-100 shadow-sm flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        {/* SOTTOTITOLO/ETICHETTA CARD A 11px */}
                        <span className="text-[11px] md:text-xs font-medium text-slate-500">No-Show</span>
                        <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                          <AlertCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        </div>
                      </div>
                      <div className="mt-1 md:mt-2 text-lg md:text-2xl font-black text-rose-600">{noShowAppointments.length}</div>
                      {/* SOTTOTITOLO CARD A 11px */}
                      <div className="mt-0.5 text-[11px] text-slate-500 truncate">su {appointments.length} totali</div>
                    </div>
                  </div>

                  {/* ELENCO APPUNTAMENTI */}
                  <div className="bg-white rounded-2xl border border-pink-100 shadow-sm overflow-hidden">
                    <div className="p-3.5 md:p-5 border-b border-pink-50 flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-[#1E1B2E] text-sm md:text-base flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-[#E95F8F]" />
                          Appuntamenti di Oggi ({formatDisplayDate(todayStr, { withWeekday: true, includeYear: false })})
                        </h3>
                        {/* SOTTOTITOLO A 11px */}
                        <p className="text-[11px] text-slate-500">Tutti gli slot in ordine orario</p>
                      </div>
                      <button
                        onClick={() => handleOpenNewAppointment()}
                        className="text-xs font-semibold text-[#E95F8F] bg-pink-50 hover:bg-pink-100 px-2.5 py-1.5 rounded-lg border border-pink-200 transition"
                      >
                        + Slot
                      </button>
                    </div>

                    <div className="divide-y divide-pink-50">
                      {todayAppointments.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-xs">
                          Nessun appuntamento in programma per oggi. Clicca &quot;Nuovo Appuntamento&quot; per iniziare.
                        </div>
                      ) : (
                        todayAppointments.map((app) => (
                          <div key={app.id} className="p-3.5 md:p-5 hover:bg-pink-50/30 transition flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <div className="w-12 md:w-14 text-center shrink-0">
                                <span className="block font-black text-sm md:text-lg text-[#1E1B2E] font-mono leading-none">{app.time}</span>
                                {/* SOTTOTITOLO MINUTI A 11px */}
                                <span className="text-[11px] text-slate-500 font-medium">{app.durationMinutes} min</span>
                              </div>
                              <div className="w-1 self-stretch rounded-full bg-gradient-to-b from-[#E95F8F] to-[#8B5CF6] shrink-0" />
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenClientHistory(app.clientName, app.clientPhone)}
                                    className="font-bold text-[#1E1B2E] text-xs md:text-base hover:text-[#E95F8F] text-left transition cursor-pointer truncate"
                                  >
                                    {app.clientName}
                                  </button>
                                  {getStatusBadge(app.status)}
                                </div>
                                {/* SOTTOTITOLO SERVIZIO A 11px */}
                                <div className="text-[11px] text-slate-600 font-medium mt-0.5">
                                  <span>{app.serviceName}</span> • <span className="font-semibold text-slate-900">€{app.price}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 self-end md:self-center shrink-0">
                              <button
                                type="button"
                                onClick={() => handleOpenCheckout(app)}
                                className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1 transition ${
                                  app.isPaid
                                    ? 'bg-slate-100 text-slate-700 border border-slate-200'
                                    : 'bg-emerald-600 text-white'
                                }`}
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                                <span>{app.isPaid ? 'Cassa' : 'Incassa'}</span>
                              </button>

                              <WhatsAppActionMenu
                                appointment={app}
                                settings={settings}
                                compact={true}
                                onSent={(type, client) => showToast(`WhatsApp aperto per ${client}`)}
                              />

                              <select
                                value={app.status}
                                onChange={(e) => handleStatusChange(app.id, e.target.value as AppointmentStatus)}
                                className="text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2 py-1 outline-none"
                              >
                                <option value="Confermato">Confermato</option>
                                <option value="In corso">In poltrona</option>
                                <option value="Completato">Completato</option>
                                <option value="No-Show">No-Show</option>
                                <option value="Annullato">Annullato</option>
                              </select>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* APPOINTMENTS TAB */}
              {activeTab === 'appointments' && (
                <div className="space-y-4">
                  <div className="bg-white p-3.5 rounded-2xl border border-pink-100 shadow-sm flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        onClick={() => setAppointmentDateFilter('today')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                          appointmentDateFilter === 'today' ? 'bg-[#E95F8F] text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        Oggi ({todayAppointments.length})
                      </button>
                      <button
                        onClick={() => setAppointmentDateFilter('all')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                          appointmentDateFilter === 'all' ? 'bg-[#E95F8F] text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        Tutti ({appointments.length})
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="bg-slate-100 p-0.5 rounded-xl flex items-center text-xs">
                        <button
                          onClick={() => setAppointmentViewMode('calendar')}
                          className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                            appointmentViewMode === 'calendar' ? 'bg-white shadow text-[#8B5CF6]' : 'text-slate-600'
                          }`}
                        >
                          Agenda
                        </button>
                        <button
                          onClick={() => setAppointmentViewMode('timeline')}
                          className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                            appointmentViewMode === 'timeline' ? 'bg-white shadow text-[#8B5CF6]' : 'text-slate-600'
                          }`}
                        >
                          Lista
                        </button>
                      </div>
                    </div>
                  </div>

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
                  ) : (
                    <div className="bg-white rounded-2xl border border-pink-100 shadow-sm divide-y divide-pink-50">
                      {appointments
                        .filter(a => appointmentDateFilter === 'all' || a.date === todayStr)
                        .map(app => (
                          <div key={app.id} className="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <div className="w-14 text-center bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                                {/* SOTTOTITOLO DATA A 11px */}
                                <span className="text-[11px] text-slate-500 font-bold block">{app.date}</span>
                                <span className="text-sm font-black text-[#8B5CF6] font-mono">{app.time}</span>
                              </div>
                              <div>
                                <h4 className="font-bold text-slate-900 text-xs md:text-sm">{app.clientName}</h4>
                                {/* SOTTOTITOLO INFO A 11px */}
                                <p className="text-[11px] text-slate-500">{app.serviceName} • €{app.price}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 self-end md:self-center">
                              <button
                                type="button"
                                onClick={() => handleOpenCheckout(app)}
                                className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold"
                              >
                                {app.isPaid ? 'Cassa' : 'Incassa'}
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {/* CLIENTS TAB */}
              {activeTab === 'clients' && (
                <div className="space-y-4">
                  <div className="bg-white p-3.5 rounded-2xl border border-pink-100 shadow-sm flex flex-col md:flex-row gap-2.5">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Cerca cliente per nome o telefono..."
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#8B5CF6]"
                      />
                    </div>
                    <button
                      onClick={() => setIsNewClientOpen(true)}
                      className="bg-[#E95F8F] text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Nuovo Cliente
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {clients
                      .filter(c => c.firstName.toLowerCase().includes(clientSearch.toLowerCase()) || c.lastName.toLowerCase().includes(clientSearch.toLowerCase()) || c.phone.includes(clientSearch))
                      .map(client => (
                        <div key={client.id} className="bg-white p-4 rounded-2xl border border-pink-100 shadow-sm space-y-2.5">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4
                                  onClick={() => handleOpenClientHistory(client)}
                                  className="font-bold text-[#1E1B2E] text-sm hover:text-[#E95F8F] cursor-pointer"
                                >
                                  {client.firstName} {client.lastName}
                                </h4>
                                {/* BADGE STATO CLIENTE A 12px (text-xs) */}
                                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800">
                                  {client.status}
                                </span>
                              </div>
                              {/* SOTTOTITOLO TELEFONO A 11px */}
                              <p className="text-[11px] text-slate-500 font-mono mt-0.5">{client.phone}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenClientHistory(client)}
                                className="px-2 py-1 bg-purple-50 text-[#8B5CF6] text-xs font-bold rounded-lg border border-purple-200"
                              >
                                Scheda
                              </button>
                              <button
                                onClick={() => openWhatsApp(client.phone, `${client.firstName} ${client.lastName}`)}
                                className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* SERVICES TAB */}
              {activeTab === 'services' && (
                <div className="space-y-4">
                  <div className="bg-white p-3.5 rounded-2xl border border-pink-100 shadow-sm flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm md:text-base text-slate-900">Listino Servizi</h3>
                      {/* SOTTOTITOLO LISTINO A 11px */}
                      <p className="text-[11px] text-slate-500">{services.length} trattamenti disponibili</p>
                    </div>
                    <button
                      onClick={() => setIsNewServiceOpen(true)}
                      className="bg-[#E95F8F] text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Nuovo
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {services.map(srv => (
                      <div key={srv.id} className="bg-white p-4 rounded-2xl border border-pink-100 shadow-sm flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start">
                            {/* BADGE CATEGORIA A 12px (text-xs) */}
                            <span className="text-xs font-bold text-[#8B5CF6] bg-purple-50 px-2 py-0.5 rounded-full">{srv.category}</span>
                            <span className="font-black text-sm text-[#E95F8F]">€{srv.price}</span>
                          </div>
                          <h4 className="font-bold text-slate-900 text-sm mt-1.5">{srv.name}</h4>
                          {/* SOTTOTITOLO DESCRIZIONE A 11px */}
                          <p className="text-[11px] text-slate-500 mt-0.5">{srv.description}</p>
                        </div>
                        <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                          <span>{srv.durationMinutes} min</span>
                          {/* BADGE ATTIVO/DISATTIVATO A 12px (text-xs) */}
                          <button
                            type="button"
                            onClick={() => handleSetServiceActive(srv.id, !srv.isActive)}
                            className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                              srv.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-300'
                            }`}
                          >
                            {srv.isActive ? 'Attivo' : 'Disattivato'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* STATS TAB */}
              {activeTab === 'stats' && (
                <SalonStatsView
                  appointments={appointments}
                  services={services}
                  showToast={showToast}
                />
              )}

              {/* SUBSCRIPTION TAB */}
              {activeTab === 'subscription' && (
                <div className="space-y-4 max-w-3xl">
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
                      } catch {}
                    }}
                    showToast={showToast}
                  />
                </div>
              )}

              {/* SETTINGS TAB */}
              {activeTab === 'settings' && (
                <div className="space-y-4 md:space-y-6 max-w-3xl pb-8 animate-fadeIn">
                  {/* LOGO */}
                  <div className="bg-white p-4 md:p-6 rounded-2xl border border-pink-100 shadow-sm space-y-4">
                    <div className="border-b border-pink-50 pb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-sm md:text-base text-[#1E1B2E] flex items-center gap-2">
                          <ImageIcon className="w-4 h-4 text-[#E95F8F]" />
                          Logo Ufficiale Salone
                        </h3>
                        {/* SOTTOTITOLO A 11px */}
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Carica il marchio del salone. Verrà mostrato nell'header e nei messaggi.
                        </p>
                      </div>
                      {settings.logoUrl && (
                        /* BADGE LOGO ATTIVO A 12px (text-xs) */
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Attivo
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

                  {/* DATI SALONE */}
                  <div className="bg-white p-4 md:p-6 rounded-2xl border border-pink-100 shadow-sm space-y-4">
                    <div className="border-b border-pink-50 pb-2">
                      <h3 className="font-bold text-sm md:text-base text-[#1E1B2E] flex items-center gap-2">
                        <Store className="w-4 h-4 text-[#8B5CF6]" />
                        Dati Attività & Orari
                      </h3>
                      {/* SOTTOTITOLO A 11px */}
                      <p className="text-[11px] text-slate-500">
                        Configura i recapiti usati per WhatsApp, indirizzo fisico e fasce orarie.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">Nome Salone *</label>
                        <input
                          type="text"
                          value={settings.name}
                          onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                          placeholder="Es. Luce & Stile Hair & Beauty"
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#8B5CF6] outline-none text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">Nome Titolare *</label>
                        <input
                          type="text"
                          value={settings.ownerName}
                          onChange={(e) => setSettings({ ...settings, ownerName: e.target.value })}
                          placeholder="Es. Elena Bianchi"
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#8B5CF6] outline-none text-xs"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-slate-700 font-semibold flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-emerald-600" />
                            <span>WhatsApp Ufficiale Salone *</span>
                          </label>
                          {/* BADGE PREFISSO A 12px (text-xs) */}
                          <span className="text-xs text-emerald-700 font-mono font-bold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                            {sanitizePhoneNumber(settings.whatsappNumber).formattedWithPlus}
                          </span>
                        </div>
                        <input
                          type="text"
                          value={settings.whatsappNumber}
                          onChange={(e) => setSettings({ ...settings, whatsappNumber: e.target.value })}
                          placeholder="Es. 340 1234567 o +39 340 1234567"
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-emerald-700 font-bold focus:ring-2 focus:ring-[#8B5CF6] outline-none text-xs"
                        />
                        {/* NOTA A 11px */}
                        <p className="text-[11px] text-slate-400 mt-1">
                          Prefisso internazionale applicato in automatico ai promemoria.
                        </p>
                      </div>

                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">Indirizzo Fisico (Via / Piazza) *</label>
                        <input
                          type="text"
                          value={settings.address}
                          onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                          placeholder="Es. Via Roma, 45"
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#8B5CF6] outline-none text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">Città & CAP *</label>
                        <input
                          type="text"
                          value={settings.city}
                          onChange={(e) => setSettings({ ...settings, city: e.target.value })}
                          placeholder="Es. Lecco (LC)"
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#8B5CF6] outline-none text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 font-semibold mb-1 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-[#8B5CF6]" />
                          <span>Fasce Orarie di Apertura</span>
                        </label>
                        <input
                          type="text"
                          value={settings.openHours}
                          onChange={(e) => setSettings({ ...settings, openHours: e.target.value })}
                          placeholder="Es. Mar - Sab: 09:00 - 19:30"
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#8B5CF6] outline-none text-xs"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-slate-700 font-semibold mb-1 flex items-center gap-1 text-rose-700">
                          <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          <span>Orario di Chiusura & Giorni di Riposo</span>
                        </label>
                        <input
                          type="text"
                          value={(settings as any).closingHours || ''}
                          onChange={(e) => setSettings({ ...settings, closingHours: e.target.value } as any)}
                          placeholder="Es. Chiuso Domenica e Lunedì • Pausa pranzo: 13:00 - 14:00"
                          className="w-full p-2.5 bg-rose-50/50 border border-rose-200 rounded-xl focus:ring-2 focus:ring-rose-400 outline-none text-xs text-rose-950 font-medium"
                        />
                        {/* NOTA A 11px */}
                        <p className="text-[11px] text-slate-400 mt-1">
                          Specifica i giorni o gli orari di chiusura in cui il salone non riceve clienti.
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between flex-wrap gap-2">
                      {/* SOTTOTITOLO INFO A 11px */}
                      <span className="text-[11px] text-slate-400">
                        I dati aggiornati si rifletteranno subito nei messaggi WhatsApp.
                      </span>
                      <button
                        type="button"
                        onClick={handleSaveSettings}
                        className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-[#E95F8F] to-[#8B5CF6] hover:opacity-90 text-white font-bold text-xs rounded-xl shadow transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Check className="w-4 h-4" />
                        Salva Impostazioni Salone
                      </button>
                    </div>
                  </div>

                  <StaffManager
                    staffMembers={settings.staffMembers || []}
                    appointments={appointments}
                    onUpdateStaff={handleUpdateStaff}
                    showToast={showToast}
                  />
                </div>
              )}
            </main>

            {/* BOTTOM BAR MOBILE CON ETICHETTE PORTATE A 12px (text-xs) */}
            <nav className={`${mobileSimulator ? 'flex' : 'flex md:hidden'} bg-white border-t border-pink-100 p-1.5 items-center justify-around sticky bottom-0 z-20 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-lg`}>
              {[
                { id: 'dashboard', label: 'Oggi', icon: Store },
                { id: 'appointments', label: 'Agenda', icon: Calendar },
                { id: 'clients', label: 'Clienti', icon: Users },
                { id: 'services', label: 'Listino', icon: Scissors },
                { id: 'settings', label: 'Salone', icon: Settings },
              ].map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as any)}
                    className={`flex flex-col items-center gap-0.5 p-1 rounded-xl transition ${
                      active ? 'text-[#E95F8F] font-bold' : 'text-slate-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {/* ETICHETTA A 12px (text-xs) */}
                    <span className="text-xs">{item.label}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={handleLogout}
                className="flex flex-col items-center gap-0.5 p-1 rounded-xl text-rose-500 transition"
              >
                <LogOut className="w-4 h-4" />
                {/* ETICHETTA ESCI A 12px (text-xs) */}
                <span className="text-xs font-semibold">Esci</span>
              </button>
            </nav>
          </div>
        </div>
      </div>

      {/* MODALI */}
      {isNewAppointmentOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[92vh] overflow-y-auto p-4 md:p-6 shadow-2xl border border-pink-100 space-y-4">
            <div className="flex items-center justify-between border-b border-pink-50 pb-3">
              <h3 className="font-bold text-[#1E1B2E] text-sm md:text-base flex items-center gap-2">
                <Scissors className="w-4 h-4 text-[#E95F8F]" /> Nuovo Appuntamento
              </h3>
              <button onClick={handleCloseNewAppointment} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddAppointment} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1 text-xs">Nome Cliente *</label>
                <input
                  type="text"
                  required
                  placeholder="Nome e cognome cliente..."
                  value={newAppClientName}
                  onChange={(e) => setNewAppClientName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1 text-xs">Cellulare WhatsApp *</label>
                <input
                  type="text"
                  required
                  placeholder="+39 340 1234567"
                  value={newAppClientPhone}
                  onChange={(e) => setNewAppClientPhone(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1 text-xs">Data</label>
                  <input
                    type="date"
                    value={newAppDate}
                    onChange={(e) => setNewAppDate(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1 text-xs">Orario</label>
                  <input
                    type="time"
                    value={newAppTime}
                    onChange={(e) => setNewAppTime(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseNewAppointment}
                  className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#E95F8F] text-white font-bold rounded-xl shadow-md hover:bg-[#d84d7d]"
                >
                  Salva Appuntamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isNewClientOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-4 md:p-6 shadow-2xl border border-pink-100 space-y-4">
            <div className="flex items-center justify-between border-b border-pink-50 pb-3">
              <h3 className="font-bold text-[#1E1B2E] text-sm md:text-base flex items-center gap-2">
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
                showToast(`Cliente inserito!`);
              }}
              className="space-y-3 text-xs"
            >
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Nome *</label>
                  <input name="fName" required placeholder="Nome" className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl" />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Cognome *</label>
                  <input name="lName" required placeholder="Cognome" className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl" />
                </div>
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Cellulare *</label>
                <input name="phone" required placeholder="+39 340 1234567" className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-mono" />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsNewClientOpen(false)} className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-xl">
                  Annulla
                </button>
                <button type="submit" className="px-4 py-1.5 bg-[#8B5CF6] text-white font-bold rounded-xl shadow">
                  Salva Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isNewServiceOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-4 md:p-6 shadow-2xl border border-pink-100 space-y-4">
            <div className="flex items-center justify-between border-b border-pink-50 pb-3">
              <h3 className="font-bold text-[#1E1B2E] text-sm md:text-base flex items-center gap-2">
                <Scissors className="w-4 h-4 text-[#E95F8F]" /> Nuovo Servizio
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

                let createdSrv: Service | null = null;
                if (isValidUUID(currentSalonId)) {
                  createdSrv = await insertServiceToSupabase({
                    salonId: currentSalonId,
                    name,
                    category,
                    durationMinutes: duration || 45,
                    price: price || 30,
                    isActive: true,
                    description: '',
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
                  description: '',
                };
                setServices([...services, newSrv]);
                setIsNewServiceOpen(false);
                showToast(`Servizio "${name}" aggiunto!`);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Nome Servizio *</label>
                <input name="srvName" required placeholder="Es. Piega Glamour" className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Durata (min)</label>
                  <input name="srvDuration" type="number" defaultValue={45} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl" />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Prezzo (€)</label>
                  <input name="srvPrice" type="number" defaultValue={30} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-[#E95F8F]" />
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsNewServiceOpen(false)} className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-xl">
                  Annulla
                </button>
                <button type="submit" className="px-4 py-1.5 bg-[#E95F8F] text-white font-bold rounded-xl shadow">
                  Aggiungi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <QuickRemindersModal
        isOpen={isRemindersModalOpen}
        onClose={() => setIsRemindersModalOpen(false)}
        appointments={appointments}
        settings={settings}
        todayStr={todayStr}
        onShowToast={showToast}
      />

      <CheckoutModal
        isOpen={!!checkoutAppointment}
        appointment={checkoutAppointment}
        onClose={() => setCheckoutAppointment(null)}
        onConfirmPayment={handleConfirmPayment}
      />

      <ClientHistoryModal
        isOpen={isClientHistoryOpen}
        client={selectedClientForModal}
        appointments={appointments}
        settings={settings}
        onClose={() => setIsClientHistoryOpen(false)}
        onUpdateClient={handleUpdateClientFromModal}
        onBookAppointmentForClient={handleBookAppointmentForClient}
        onShowToast={showToast}
        onUpgradePlan={() => setActiveTab('subscription')}
      />
    </div>
  );
}
