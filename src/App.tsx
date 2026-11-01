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
import { Appointment, Client, Service, SalonSettings, AppointmentStatus, StaffMember, getStaffColorConfig, PaymentMethod, UserSession, SubscriptionPlan } from './types';
import { initialSettings, initialServices, initialClients, initialAppointments } from './data';
import { supabase } from './lib/supabase';
import {
  createTrialSubscription,
  isDefaultSeedSubscription,
  isSubscriptionCurrentlyValid,
  normalizeSubscriptionOnLoad,
} from './lib/subscription';
import { usePlan, type PlanAccess, type SalonBilling } from './lib/plan';
import {
  isValidUUID,
  ensureSalonForAuthUser,
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
  saveStaffRoster,
  uploadSalonLogoFile,
  uploadSalonLogoDataUrl,
  clearSalonLogo,
  syncStaffAndLogo,
  fetchSalonBilling,
} from './lib/salonService';
import { openStripePortal, startStripeCheckout } from './lib/stripeBilling';
import { CalendarAppointmentsView } from './components/CalendarAppointmentsView';
import { SalonLogoUploader } from './components/SalonLogoUploader';
import { SalonSubscriptionManager } from './components/SalonSubscriptionManager';
import { ProUpsellCard } from './components/ProUpsellCard';
import { SalonStatsView } from './components/SalonStatsView';
import { StaffManager } from './components/StaffManager';
import { WhatsAppActionMenu } from './components/WhatsAppActionMenu';
import { QuickRemindersModal } from './components/QuickRemindersModal';
import { CheckoutModal } from './components/CheckoutModal';
import { CashRegisterSummary } from './components/CashRegisterSummary';
import { ClientReputationBadge } from './components/ClientReputationBadge';
import { ClientHistoryModal } from './components/ClientHistoryModal';
import { AuthScreen } from './components/AuthScreen';
import { LegalDocument, LegalLinks } from './components/LegalPages';
import { ResetPasswordScreen } from './components/ResetPasswordScreen';
import { readPublicLegalPath, type PublicLegalPath } from './lib/publicRoutes';
import { getTodayStr, getTomorrowStr, getDateOffsetStr, formatDisplayDate } from './utils/date';
import {
  sanitizePhoneNumber,
  generateWhatsAppLink,
  openWhatsAppLink,
  buildAppointmentMessage
} from './utils/whatsapp';

function billingRowCopy(sub?: SubscriptionPlan): { plan: string; detail: string } {
  if (!sub || isDefaultSeedSubscription(sub)) {
    return { plan: 'Nessun piano a pagamento', detail: 'Gestisci piano e fatture' };
  }
  const trial = sub.status === 'trial' || sub.status === 'In prova';
  if (trial && sub.trialEndsAt) {
    const end = Date.parse(sub.trialEndsAt);
    if (!Number.isNaN(end)) {
      const days = Math.max(0, Math.ceil((end - Date.now()) / 86_400_000));
      const detail = days === 0
        ? 'La prova termina oggi'
        : days === 1
          ? '1 giorno di prova rimasto'
          : `${days} giorni di prova rimasti`;
      return { plan: sub.name, detail };
    }
  }
  if (trial) return { plan: sub.name, detail: 'Prova gratuita attiva' };
  if (sub.status === 'Scaduto' || sub.status === 'Annullato') return { plan: sub.name, detail: 'Prova terminata' };
  return { plan: sub.name, detail: 'Gestisci piano e fatture' };
}

function billingRowFromAccess(access: PlanAccess): { plan: string; detail: string } {
  if (access.source === 'paid') {
    return {
      plan: access.tier === 'pro' ? 'PRO' : 'BASE',
      detail: access.tier === 'pro' ? 'Piano PRO attivo' : 'Piano BASE attivo',
    };
  }
  if (access.source === 'trial') {
    const days = access.trialDaysLeft;
    const detail = days == null
      ? 'Prova gratuita attiva'
      : days === 0
        ? 'La prova termina oggi'
        : days === 1
          ? '1 giorno di prova rimasto'
          : `${days} giorni di prova rimasti`;
    return { plan: 'PRO', detail };
  }
  return { plan: 'PRO', detail: 'Gestisci piano e fatture' };
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'appointments' | 'clients' | 'services' | 'stats' | 'settings' | 'subscription'>('dashboard');
  const [billingOpen, setBillingOpen] = useState(false);
  const [salonBilling, setSalonBilling] = useState<SalonBilling | undefined>(undefined);
  const [billingRefresh, setBillingRefresh] = useState(0);

  useEffect(() => {
    if (activeTab !== 'settings') setBillingOpen(false);
  }, [activeTab]);
  const [legalPath, setLegalPath] = useState<PublicLegalPath | null>(() => readPublicLegalPath());
  const [recoveryMode, setRecoveryMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (window.location.hash || '').includes('type=recovery');
  });
  const [mobileSimulator, setMobileSimulator] = useState(false);
  const [showSpecModal, setShowSpecModal] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

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

  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const hash = window.location.hash || '';
    const params = new URLSearchParams(window.location.search);
    // Durante lo scambio OAuth evita il flash di AuthScreen
    if (hash.includes('access_token') || hash.includes('refresh_token') || params.has('code')) {
      return true;
    }
    // Anche senza sessione locale, attendi getSession prima di mostrare AuthScreen
    return currentUser === null;
  });
  
  const isDemoSession = !currentUser || currentUser?.email === 'provatest@salone.it' || (currentUser as any)?.isDemo;  
  
  useEffect(() => {
    setIsAuthenticated(currentUser !== null);
  }, [currentUser]);

  useEffect(() => {
    const syncLegalPath = () => setLegalPath(readPublicLegalPath());
    window.addEventListener('popstate', syncLegalPath);
    return () => window.removeEventListener('popstate', syncLegalPath);
  }, []);

  // Quick Reminders Modal State
  const [isRemindersModalOpen, setIsRemindersModalOpen] = useState(false);

  // Core State
  const [settings, setSettings] = useState<SalonSettings>(() => {
    try {
      const saved = localStorage.getItem('salondesk_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        const rawSub = parsed.subscription || initialSettings.subscription;
        const { subscription: normalizedSub } = normalizeSubscriptionOnLoad(rawSub);
        return {
          ...initialSettings,
          ...parsed,
          staffMembers: (parsed.staffMembers && parsed.staffMembers.length > 0)
            ? parsed.staffMembers
            : (parsed.salonId && isValidUUID(parsed.salonId) ? [] : initialSettings.staffMembers),
          subscription: normalizedSub,
        };
      }
    } catch {
      // ignore
    }
    return initialSettings;
  });

  // Normalizza il piano attivo per aggiornare i vecchi prezzi salvati in cache
  // Non toccare trial / In prova (price 0) né abbonamenti scaduti
  useEffect(() => {
    const sub = settings.subscription;
    if (!sub) return;
    if (sub.status === 'trial' || sub.status === 'In prova' || sub.status === 'Scaduto' || sub.status === 'Annullato') return;
    if (isDefaultSeedSubscription(sub)) return;
    if (sub.name === 'Piano Pro' || (typeof sub.price === 'number' && sub.price > 0 && sub.price < 39)) {
      setSettings(prev => ({
        ...prev,
        subscription: {
          ...prev.subscription!,
          name: 'PRO (Mensile)',
          price: 69,
          interval: 'mese',
        }
      }));
    }
  }, []);

  // Migra trialEndsAt mancante ed espira automaticamente la prova scaduta
  useEffect(() => {
    if (!settings.subscription) return;
    const { subscription: next, changed } = normalizeSubscriptionOnLoad(settings.subscription);
    if (!changed || !next) return;
    const updated = { ...settings, subscription: next };
    setSettings(updated);
    cacheSalonSettings(updated);
  }, [settings.subscription?.status, settings.subscription?.trialEndsAt]);

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const billing = params.get('billing');
    if (billing !== 'success' && billing !== 'cancel' && billing !== 'portal') return;
    params.delete('billing');
    const next = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${next ? `?${next}` : ''}${window.location.hash}`);
    setActiveTab('settings');
    setBillingOpen(true);
    if (billing === 'success') {
      setToastMessage('Pagamento ricevuto. L’abbonamento si aggiorna tra pochi secondi.');
      setBillingRefresh((value) => value + 1);
      window.setTimeout(() => setBillingRefresh((value) => value + 1), 3000);
    } else if (billing === 'cancel') {
      setToastMessage('Pagamento annullato. Nessun addebito.');
    }
    window.setTimeout(() => setToastMessage(null), 4500);
  }, []);

  const currentSalonId = currentUser?.salonId || settings.salonId || 'salon-lucestile-01';
  const plan = usePlan(settings.subscription, salonBilling);
  const billingRow = salonBilling ? billingRowFromAccess(plan) : billingRowCopy(settings.subscription);
  const openBilling = () => {
    setActiveTab('settings');
    setBillingOpen(true);
  };

  const cacheSalonSettings = (value: SalonSettings) => {
    try {
      const cloudSalon = !!value.salonId && isValidUUID(value.salonId);
      const logoUrl =
        value.logoUrl && (cloudSalon ? !value.logoUrl.startsWith('data:') : true) ? value.logoUrl : undefined;
      const { staffMembers, ...rest } = value;
      localStorage.setItem(
        'salondesk_settings',
        JSON.stringify({
          ...rest,
          logoUrl,
          ...(cloudSalon ? {} : { staffMembers }),
        })
      );
    } catch {
      // ignore quota errors
    }
  };

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const [isDataLoading, setIsDataLoading] = useState(false);

  const currentUserRef = useRef<UserSession | null>(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    const salonId = currentUser?.salonId;
    if (!salonId || !isValidUUID(salonId) || currentUser?.id === 'usr-demo-01') return;
    let cancelled = false;
    const live = settingsRef.current;
    void syncStaffAndLogo({
      salonId,
      memoryStaff: live.staffMembers,
      memoryLogo: live.logoUrl,
      memorySalonId: live.salonId,
    })
      .then((result) => {
        if (cancelled) return;
        setSettings((prev) => {
          const next = {
            ...prev,
            salonId,
            staffMembers: result.staff,
            logoUrl: result.logoUrl,
          };
          cacheSalonSettings(next);
          return next;
        });
        const idMap = result.staffIdMap;
        if (Object.keys(idMap).length > 0) {
          setAppointments((prev) =>
            prev.map((appointment) => {
              const mapped = appointment.staffId ? idMap[appointment.staffId] : undefined;
              return mapped ? { ...appointment, staffId: mapped } : appointment;
            })
          );
        }
      })
      .catch((error) => {
        console.warn('Staff/logo sync:', error);
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser?.salonId, currentUser?.id]);

  useEffect(() => {
    const salonId = currentUser?.salonId;
    if (!salonId || !isValidUUID(salonId) || currentUser?.id === 'usr-demo-01') {
      setSalonBilling(undefined);
      return;
    }
    let cancelled = false;
    void fetchSalonBilling(salonId).then((row) => {
      if (!cancelled) setSalonBilling(row);
    });
    return () => {
      cancelled = true;
    };
  }, [currentUser?.salonId, currentUser?.id, billingRefresh]);

  const fetchedSessionUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const isOAuthCallbackPending = () => {
      if (typeof window === 'undefined') return false;
      const hash = window.location.hash || '';
      const params = new URLSearchParams(window.location.search);
      return hash.includes('access_token') || hash.includes('refresh_token') || params.has('code');
    };

    const applySession = async (session: any | null, event?: string) => {
      if (!session) {
        // Non cancellare la UI mentre lo scambio OAuth è ancora in corso
        if (event === 'INITIAL_SESSION' && isOAuthCallbackPending()) {
          return;
        }
        if (event === 'SIGNED_OUT' || event === 'INITIAL_SESSION' || !event) {
          if (currentUserRef.current && currentUserRef.current.id !== 'usr-demo-01') {
            fetchedSessionUserIdRef.current = null;
            setCurrentUser(null);
            localStorage.removeItem('salondesk_session');
            sessionStorage.removeItem('salondesk_session');
          }
        }
        return;
      }

      const sessionUser = session.user;
      if (!sessionUser) return;

      if (
        currentUserRef.current?.id === sessionUser.id &&
        currentUserRef.current.salonId &&
        isValidUUID(currentUserRef.current.salonId) &&
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

          if (profile?.salon_id && isValidUUID(profile.salon_id)) {
            knownSalonId = profile.salon_id;
          }
        }

        const ensured = await ensureSalonForAuthUser({
          userId: sessionUser.id,
          email: sessionUser.email || '',
          meta,
          existingSalonId: knownSalonId || undefined,
        });

        if (cancelled) return;

        const finalSession: UserSession = {
          id: sessionUser.id,
          email: sessionUser.email || '',
          salonId: ensured.salonId,
          salonName: currentUserRef.current?.salonName || ensured.salonName,
          ownerName: currentUserRef.current?.ownerName || ensured.ownerName,
          role: ensured.role || 'owner',
        };

        setCurrentUser(finalSession);
        localStorage.setItem('salondesk_session', JSON.stringify(finalSession));

        // Assegna trial 7gg per OAuth/primo accesso se non c'è un abbonamento reale salvato
        const resolveSubscription = (prevSub: typeof settings.subscription) => {
          let persistedSub: typeof settings.subscription | undefined;
          try {
            const saved = localStorage.getItem('salondesk_settings');
            if (saved) {
              const parsed = JSON.parse(saved);
              if (parsed.subscription) persistedSub = parsed.subscription;
            }
          } catch {}
          const candidate = persistedSub || prevSub || ensured.salon?.subscription;
          if (!candidate || isDefaultSeedSubscription(candidate)) {
            return createTrialSubscription();
          }
          const { subscription: normalized } = normalizeSubscriptionOnLoad(candidate);
          return normalized || createTrialSubscription();
        };

        if (ensured.salon) {
          setSettings(prev => {
            const subscription = resolveSubscription(prev.subscription);
            const sameSalon = prev.salonId === ensured.salonId;
            const next = {
              ...prev,
              ...ensured.salon!,
              staffMembers: sameSalon ? prev.staffMembers : [],
              logoUrl: ensured.salon!.logoUrl || (sameSalon && !prev.logoUrl?.startsWith('data:') ? prev.logoUrl : undefined),
              subscription,
            };
            cacheSalonSettings(next);
            return next;
          });
        } else if (isValidUUID(ensured.salonId)) {
          const { data: salonRecord } = await supabase
            .from('salons')
            .select('*')
            .eq('id', ensured.salonId)
            .maybeSingle();

          if (!cancelled && salonRecord) {
            setSettings(prev => {
              const subscription = resolveSubscription(prev.subscription);
              const sameSalon = prev.salonId === salonRecord.id;
              const next = {
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
                logoUrl: salonRecord.logo_url || (sameSalon && !prev.logoUrl?.startsWith('data:') ? prev.logoUrl : undefined),
                staffMembers: sameSalon ? prev.staffMembers : [],
                subscription,
              };
              cacheSalonSettings(next);
              return next;
            });
          } else if (!cancelled) {
            // Salone appena creato / senza record completo: comunque assegna trial
            setSettings(prev => {
              const subscription = resolveSubscription(prev.subscription);
              const sameSalon = prev.salonId === ensured.salonId;
              const next = {
                ...prev,
                salonId: ensured.salonId,
                name: ensured.salonName || prev.name,
                ownerName: ensured.ownerName || prev.ownerName,
                email: sessionUser.email || prev.email,
                staffMembers: sameSalon ? prev.staffMembers : [],
                logoUrl: sameSalon && !prev.logoUrl?.startsWith('data:') ? prev.logoUrl : undefined,
                subscription,
              };
              cacheSalonSettings(next);
              return next;
            });
          }
        } else if (!cancelled) {
          setSettings(prev => {
            const subscription = resolveSubscription(prev.subscription);
            if (subscription === prev.subscription) return prev;
            const next = { ...prev, subscription };
            cacheSalonSettings(next);
            return next;
          });
        }
      } catch (e) {
        console.warn('Recupero sessione:', e);
        const msg = e instanceof Error ? e.message : 'Errore durante il recupero del salone';
        // Evita di lasciare l'utente su Accedi senza spiegazione dopo OAuth
        showToast(msg || 'Accesso riuscito, ma il salone non è stato creato. Riprova.');
      }
    };

    // 1) Sessione già presente / scambio OAuth al mount
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!cancelled) {
          await applySession(data.session, 'INITIAL_SESSION');
        }
        // Se OAuth è ancora in corso e non c'è sessione, aspetta onAuthStateChange
        if (!cancelled && !(isOAuthCallbackPending() && !data.session)) {
          setIsAuthChecking(false);
        }
      } catch (e) {
        console.warn('getSession:', e);
        if (!cancelled) setIsAuthChecking(false);
      }
    })();

    // 2) Listener continuo (SIGNED_IN dopo OAuth, refresh, logout, ...)
    const { data: authSubscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        await applySession(null, 'SIGNED_OUT');
        if (!cancelled) setIsAuthChecking(false);
        return;
      }
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true);
      }
      if (
        event === 'SIGNED_IN' ||
        event === 'INITIAL_SESSION' ||
        event === 'TOKEN_REFRESHED' ||
        event === 'USER_UPDATED' ||
        event === 'PASSWORD_RECOVERY'
      ) {
        // Defer DB work so auth lock / PKCE exchange can finish cleanly
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        await applySession(session, event);
        if (!cancelled) setIsAuthChecking(false);
      }
    });

    return () => {
      cancelled = true;
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
      const rawSub = salonSettings.subscription;
      let subscription = rawSub;
      if (!rawSub || isDefaultSeedSubscription(rawSub)) {
        subscription = createTrialSubscription();
      } else {
        const { subscription: normalized } = normalizeSubscriptionOnLoad(rawSub);
        subscription = normalized;
      }
      const next = {
        ...salonSettings,
        staffMembers: salonSettings.staffMembers || [
          {
            id: 'staff-1',
            name: session.ownerName,
            role: 'Titolare',
            color: 'purple',
            isActive: true,
            email: session.email,
          }
        ],
        subscription,
      };
      setSettings(next);
      cacheSalonSettings(next);
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

    const rawSub = salonSettings.subscription;
    const subscription =
      !rawSub || isDefaultSeedSubscription(rawSub)
        ? createTrialSubscription()
        : (normalizeSubscriptionOnLoad(rawSub).subscription || createTrialSubscription());
    const toSave = { ...salonSettings, subscription };

    setSettings(toSave);
    try {
      cacheSalonSettings(toSave);
      localStorage.setItem('salondesk_session', JSON.stringify(session));
    } catch {
      // ignore
    }
    setIsAuthenticated(true);
    setCurrentUser(session);
    showToast("Benvenuto su Nuvia! Il tuo salone è pronto all'uso.");
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

  // BADGE DI STATO A 12px
  const getStatusBadge = (status: AppointmentStatus) => {
    switch (status) {
      case 'Confermato':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle2 className="w-3.5 h-3.5" /> Confermato</span>;
      case 'In corso':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 animate-pulse"><Sparkles className="w-3.5 h-3.5 text-[#8B5CF6]" /> In poltrona</span>;
      case 'Completato':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200"><Check className="w-3.5 h-3.5" /> Fatto</span>;
      case 'No-Show':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200"><AlertCircle className="w-3.5 h-3.5 text-rose-600" /> No-Show</span>;
      case 'Annullato':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200"><XCircle className="w-3.5 h-3.5" /> Annullato</span>;
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

  const applyLogoUrl = (logoUrl: string | undefined) => {
    const updatedSettings = { ...settingsRef.current, logoUrl };
    setSettings(updatedSettings);
    cacheSalonSettings(updatedSettings);
  };

  const handleLogoFile = async (file: File) => {
    if (!isValidUUID(currentSalonId) || currentUser?.id === 'usr-demo-01') {
      const dataUrl = await file.arrayBuffer().then((buffer) => {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return `data:${file.type || 'image/png'};base64,${btoa(binary)}`;
      });
      applyLogoUrl(dataUrl);
      return;
    }
    const publicUrl = await uploadSalonLogoFile(currentSalonId, file);
    applyLogoUrl(publicUrl);
  };

  const handleLogoChange = async (newLogoUrl: string | undefined) => {
    if (!newLogoUrl) {
      if (isValidUUID(currentSalonId) && currentUser?.id !== 'usr-demo-01') {
        await clearSalonLogo(currentSalonId);
      }
      applyLogoUrl(undefined);
      return;
    }
    if (newLogoUrl.startsWith('data:') && isValidUUID(currentSalonId) && currentUser?.id !== 'usr-demo-01') {
      const publicUrl = await uploadSalonLogoDataUrl(currentSalonId, newLogoUrl);
      applyLogoUrl(publicUrl);
      return;
    }
    applyLogoUrl(newLogoUrl);
    if (isValidUUID(currentSalonId) && currentUser?.id !== 'usr-demo-01' && !newLogoUrl.startsWith('data:')) {
      await supabase.from('salons').update({ logo_url: newLogoUrl }).eq('id', currentSalonId);
    }
  };

  const handleSaveSettings = () => {
    cacheSalonSettings(settings);

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
          logo_url: settings.logoUrl && !settings.logoUrl.startsWith('data:') ? settings.logoUrl : null,
        })
        .eq('id', currentSalonId)
        .then(
          ({ error }) => showToast(error ? 'Impostazioni salvate localmente!' : 'Impostazioni salvate con successo!'),
          () => showToast('Impostazioni salvate localmente!'),
        );
    } else {
      showToast('Impostazioni salvate con successo!');
    }
  };

  const isSubscriptionValid = isSubscriptionCurrentlyValid(settings.subscription);

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
    const previous = settings.staffMembers || [];
    const updated = { ...settings, staffMembers: updatedStaff };
    setSettings(updated);
    cacheSalonSettings(updated);
    if (!isValidUUID(currentSalonId) || currentUser?.id === 'usr-demo-01') return;
    void saveStaffRoster(currentSalonId, previous, updatedStaff)
      .then((saved) => {
        setSettings((prev) => ({ ...prev, staffMembers: saved }));
      })
      .catch(() => {
        showToast('Impossibile salvare il team sul cloud. Controlla la connessione.');
      });
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

  if (legalPath) {
    return <LegalDocument kind={legalPath} />;
  }

  if (recoveryMode) {
    return (
      <>
        <ResetPasswordScreen
          onCompleted={() => setRecoveryMode(false)}
          onCancel={() => {
            setRecoveryMode(false);
            void handleLogout();
          }}
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

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1E1B2E] via-[#2A1B33] to-[#1E1B2E] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-white/90">
          <Loader2 className="w-8 h-8 animate-spin text-[#E95F8F]" />
          <p className="text-sm font-medium">Accesso in corso...</p>
        </div>
      </div>
    );
  }

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
      {/* Top Banner Desktop */}
      <div className="hidden md:flex bg-gradient-to-r from-[#1E1B2E] via-[#2D1B36] to-[#1E1B2E] text-white text-xs px-4 py-2 items-center justify-between border-b border-purple-950/40">
        <div className="flex items-center gap-3">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E95F8F] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#E95F8F]"></span>
          </span>
          <span className="font-medium text-slate-200">
            <strong className="text-white">Nuvia</strong> — Prototipo Live Interattivo
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
                      className="w-12 h-12 rounded-xl object-contain object-center bg-white p-0.5 border border-white/20 shadow-lg shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-white border border-white/40 shadow-lg shadow-purple-500/20 flex items-center justify-center p-1.5 shrink-0">
                      <img src="/nuvia-mark.png" alt="Nuvia" className="w-full h-full object-contain" />
                    </div>
                  )}
                  <div className="overflow-hidden">
                    <h1 className="font-bold text-white text-base tracking-tight truncate leading-tight">
                      {currentUser?.salonName || settings.name}
                    </h1>
                    <p className="text-xs text-pink-300/80 truncate">Titolare: {currentUser?.ownerName || settings.ownerName}</p>
                  </div>
                </div>

                <nav className="p-3 space-y-4">
                  <div className="space-y-1">
                    <div className="px-3 pb-1 text-xs font-bold uppercase tracking-wider text-slate-400/80">
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
                        <span className="text-xs px-2 py-0.5 rounded-full font-black bg-[#8B5CF6] text-white">
                          {tomorrowAppointments.length}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/10 space-y-1">
                    <div className="px-3 pb-1 text-xs font-bold uppercase tracking-wider text-slate-400/80">
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
                <LegalLinks
                  className="flex items-center justify-center gap-2 text-[10px] text-slate-500"
                  linkClassName="hover:text-slate-300"
                />
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

            {/* HEADER CON TITOLO A 16px/18px (text-base md:text-lg) */}
            <header className="bg-white border-b border-pink-100 px-3 md:px-8 py-3.5 flex items-center justify-between sticky top-0 z-20">
              <div className="flex items-center gap-2.5 md:gap-3 min-w-0">
                {settings.logoUrl ? (
                  <img
                    src={settings.logoUrl}
                    alt={currentUser?.salonName || settings.name}
                    className="w-11 h-11 md:w-12 md:h-12 rounded-xl object-contain object-center bg-white p-0.5 border border-pink-200 shadow-2xs shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-11 h-11 md:w-12 md:h-12 rounded-xl bg-white border border-pink-200 shadow-2xs flex items-center justify-center p-1 shrink-0">
                    <img src="/nuvia-mark.png" alt="Nuvia" className="w-full h-full object-contain" />
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="text-base md:text-lg font-bold text-[#1E1B2E] truncate">
                    {activeTab === 'dashboard' && 'Dashboard Salone'}
                    {activeTab === 'appointments' && 'Gestione Appuntamenti'}
                    {activeTab === 'clients' && 'Anagrafica Clienti'}
                    {activeTab === 'services' && 'Listino Servizi'}
                    {activeTab === 'stats' && 'Statistiche & KPI'}
                    {activeTab === 'settings' && (billingOpen ? 'Abbonamento' : 'Impostazioni Salone')}
                    {activeTab === 'subscription' && 'Abbonamento'}
                  </h2>
                  <p className="text-sm text-slate-600 hidden sm:block">
                    {formatDisplayDate(todayStr, { withWeekday: true, includeYear: true })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 md:gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsRemindersModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 md:py-2 rounded-xl text-xs md:text-sm font-bold bg-purple-50 hover:bg-purple-100 text-[#8B5CF6] border border-purple-200 transition cursor-pointer"
                >
                  <Bell className="w-4 h-4 text-[#8B5CF6]" />
                  <span className="hidden sm:inline">Promemoria Domani</span>
                  <span className="px-1.5 py-0.5 rounded-full text-xs font-extrabold bg-[#8B5CF6] text-white">
                    {tomorrowAppointments.length}
                  </span>
                </button>

                {activeTab === 'dashboard' && (
                  <button
                    onClick={() => handleOpenNewAppointment()}
                    className="bg-[#E95F8F] hover:bg-[#d84d7d] text-white px-3 py-1.5 md:px-3.5 md:py-2 rounded-xl text-xs md:text-sm font-semibold flex items-center gap-1.5 shadow transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4 shrink-0" />
                    <span className="hidden sm:inline">Nuovo Appuntamento</span>
                    <span className="sm:hidden text-xs">Nuovo</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleLogout}
                  className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition"
                >
                  <LogOut className="w-4 h-4 text-rose-600" />
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

            <main className="p-3.5 md:p-8 flex-1 space-y-4 md:space-y-6">
              {/* DASHBOARD TAB */}
              {activeTab === 'dashboard' && (
                <div className="space-y-4 md:space-y-6">
                  {/* KPI CARDS: proporzioni chiare e testi leggibili */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                    <div className="bg-white p-4 rounded-2xl border border-pink-100 shadow-sm flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] md:text-sm font-medium text-slate-600">Incasso Oggi</span>
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                          <TrendingUp className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="mt-1.5 md:mt-2 text-xl md:text-2xl font-black text-[#1E1B2E]">€{todayRevenue}</div>
                      <div className="mt-1 text-sm text-emerald-700 font-semibold">{todayAppointments.length} programmati</div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-pink-100 shadow-sm flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] md:text-sm font-medium text-slate-600">In Poltrona</span>
                        <div className="w-8 h-8 rounded-lg bg-purple-50 text-[#8B5CF6] flex items-center justify-center shrink-0">
                          <Scissors className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="mt-1.5 md:mt-2 text-xl md:text-2xl font-black text-[#8B5CF6]">
                        {todayAppointments.filter(a => a.status === 'In corso').length}
                      </div>
                      <div className="mt-1 text-sm text-slate-700 truncate font-medium">
                        {todayAppointments.find(a => a.status === 'In corso')?.clientName || 'Nessuno ora'}
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-pink-100 shadow-sm flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] md:text-sm font-medium text-slate-600">Da Riattivare</span>
                        <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                          <Clock className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="mt-1.5 md:mt-2 text-xl md:text-2xl font-black text-amber-600">{inactiveClients.length}</div>
                      <div className="mt-1 text-sm text-amber-800 font-semibold">Fermi da &gt;60gg</div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-pink-100 shadow-sm flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] md:text-sm font-medium text-slate-600">No-Show</span>
                        <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                          <AlertCircle className="w-4 h-4" />
                        </div>
                      </div>
                      {plan.hasFeature('noshow') ? (
                        <>
                          <div className="mt-1.5 md:mt-2 text-xl md:text-2xl font-black text-rose-600">{noShowAppointments.length}</div>
                          <div className="mt-1 text-sm text-slate-700 truncate font-medium">su {appointments.length} totali</div>
                        </>
                      ) : (
                        <button type="button" onClick={openBilling} className="mt-2 text-left text-sm font-semibold text-[#8B5CF6]">
                          Disponibile nel piano PRO
                        </button>
                      )}
                    </div>
                  </div>

                  {/* ELENCO APPUNTAMENTI */}
                  <div className="bg-white rounded-2xl border border-pink-100 shadow-sm overflow-hidden">
                    <div className="p-4 md:p-5 border-b border-pink-50">
                      <h3 className="font-bold text-[#1E1B2E] text-base flex items-center gap-2">
                        <Clock className="w-4 h-4 text-[#E95F8F]" />
                        Appuntamenti di Oggi ({formatDisplayDate(todayStr, { withWeekday: true, includeYear: false })})
                      </h3>
                      <p className="text-sm text-slate-600 mt-0.5">Tutti gli slot in ordine orario</p>
                    </div>

                    <div className="divide-y divide-pink-50">
                      {todayAppointments.length === 0 ? (
                        <div className="p-8 text-center space-y-4">
                          <p className="text-slate-600 text-sm">Nessun appuntamento in programma per oggi.</p>
                          <button
                            type="button"
                            onClick={() => handleOpenNewAppointment()}
                            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#E95F8F] to-[#8B5CF6] text-white font-bold text-sm shadow hover:opacity-95 transition"
                          >
                            <Plus className="w-4 h-4" />
                            Crea il primo appuntamento
                          </button>
                        </div>
                      ) : (
                        todayAppointments.map((app) => (
                          <div key={app.id} className="p-4 md:p-5 hover:bg-pink-50/30 transition flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div className="flex items-start gap-3.5">
                              <div className="w-14 text-center shrink-0">
                                <span className="block font-black text-base md:text-lg text-[#1E1B2E] font-mono leading-none">{app.time}</span>
                                <span className="text-sm text-slate-600 font-medium mt-1 block">{app.durationMinutes} min</span>
                              </div>
                              <div className="w-1 self-stretch rounded-full bg-gradient-to-b from-[#E95F8F] to-[#8B5CF6] shrink-0" />
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenClientHistory(app.clientName, app.clientPhone)}
                                    className="font-bold text-[#1E1B2E] text-sm md:text-base hover:text-[#E95F8F] text-left transition cursor-pointer truncate"
                                  >
                                    {app.clientName}
                                  </button>
                                  {getStatusBadge(app.status)}
                                </div>
                                <div className="text-sm text-slate-700 font-medium mt-1">
                                  <span>{app.serviceName}</span> • <span className="font-semibold text-slate-900">€{app.price}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                              <button
                                type="button"
                                onClick={() => handleOpenCheckout(app)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
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
                                settings={plan.hasFeature('whatsapp_templates') ? settings : { ...settings, googleReviewLink: undefined }}
                                compact={true}
                                templatesLocked={!plan.hasFeature('whatsapp_templates')}
                                onUpgrade={openBilling}
                                onSent={(type, client) => showToast(`WhatsApp aperto per ${client}`)}
                              />

                              <select
                                value={app.status}
                                onChange={(e) => handleStatusChange(app.id, e.target.value as AppointmentStatus)}
                                className="text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2.5 py-1.5 outline-none font-medium"
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
                      templatesLocked={!plan.hasFeature('whatsapp_templates')}
                      noshowLocked={!plan.hasFeature('noshow')}
                      onUpgrade={openBilling}
                    />
                  ) : (
                    <div className="bg-white rounded-2xl border border-pink-100 shadow-sm divide-y divide-pink-50">
                      {appointments
                        .filter(a => appointmentDateFilter === 'all' || a.date === todayStr)
                        .map(app => (
                          <div key={app.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div className="flex items-start gap-3.5">
                              <div className="w-16 text-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                                <span className="text-sm text-slate-600 font-bold block">{app.date}</span>
                                <span className="text-sm font-black text-[#8B5CF6] font-mono">{app.time}</span>
                              </div>
                              <div>
                                <h4 className="font-bold text-slate-900 text-sm md:text-base">{app.clientName}</h4>
                                <p className="text-sm text-slate-600 mt-0.5">{app.serviceName} • €{app.price}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 self-end md:self-center">
                              <button
                                type="button"
                                onClick={() => handleOpenCheckout(app)}
                                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold"
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
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-base outline-none focus:ring-2 focus:ring-[#8B5CF6]"
                      />
                    </div>
                    <button
                      onClick={() => setIsNewClientOpen(true)}
                      className="bg-[#E95F8F] text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" /> Nuovo Cliente
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {clients
                      .filter(c => c.firstName.toLowerCase().includes(clientSearch.toLowerCase()) || c.lastName.toLowerCase().includes(clientSearch.toLowerCase()) || c.phone.includes(clientSearch))
                      .map(client => (
                        <div key={client.id} className="bg-white p-4 rounded-2xl border border-pink-100 shadow-sm space-y-2.5">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4
                                onClick={() => handleOpenClientHistory(client)}
                                className="font-bold text-[#1E1B2E] text-base hover:text-[#E95F8F] cursor-pointer"
                              >
                                {client.firstName} {client.lastName}
                              </h4>
                              <p className="text-sm text-slate-600 font-mono mt-0.5">{client.phone}</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenClientHistory(client)}
                                className="px-2.5 py-1 bg-purple-50 text-[#8B5CF6] text-xs font-bold rounded-lg border border-purple-200"
                              >
                                Scheda
                              </button>
                              <button
                                onClick={() => openWhatsApp(client.phone, `${client.firstName} ${client.lastName}`)}
                                className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200"
                              >
                                <MessageSquare className="w-4 h-4" />
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
                  <div className="bg-white p-4 rounded-2xl border border-pink-100 shadow-sm flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-base text-slate-900">Listino Servizi</h3>
                      <p className="text-sm text-slate-600 mt-0.5">{services.length} trattamenti disponibili</p>
                    </div>
                    <button
                      onClick={() => setIsNewServiceOpen(true)}
                      className="bg-[#E95F8F] text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" /> Nuovo
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {services.map(srv => (
                      <div key={srv.id} className="bg-white p-4 rounded-2xl border border-pink-100 shadow-sm flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start">
                            <span className="text-xs font-bold text-[#8B5CF6] bg-purple-50 px-2.5 py-0.5 rounded-full">{srv.category}</span>
                            <span className="font-black text-base text-[#E95F8F]">€{srv.price}</span>
                          </div>
                          <h4 className="font-bold text-slate-900 text-base mt-2">{srv.name}</h4>
                          <p className="text-sm text-slate-600 mt-1">{srv.description}</p>
                        </div>
                        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-sm text-slate-600">
                          <span>{srv.durationMinutes} min</span>
                          <button
                            type="button"
                            onClick={() => handleSetServiceActive(srv.id, !srv.isActive)}
                            className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
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
                plan.hasFeature('stats') ? (
                  <SalonStatsView
                    appointments={appointments}
                    services={services}
                    showToast={showToast}
                  />
                ) : (
                  <ProUpsellCard
                    description="Statistiche, KPI e incassi sono nel piano PRO."
                    onUpgrade={openBilling}
                  />
                )
              )}

              {/* SUBSCRIPTION TAB */}
              {activeTab === 'subscription' && (
                <div className="space-y-4 max-w-3xl">
                  <SalonSubscriptionManager
                    subscription={settings.subscription}
                    salonName={settings.name}
                    billing={salonBilling}
                    showToast={showToast}
                    onSelectPlan={startStripeCheckout}
                    onOpenPortal={openStripePortal}
                  />
                </div>
              )}

              {/* IMPOSTAZIONI */}
              {activeTab === 'settings' && billingOpen && (
                <div className="space-y-4 max-w-3xl pb-8 animate-fadeIn">
                  <button
                    type="button"
                    onClick={() => setBillingOpen(false)}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-[#8B5CF6]"
                  >
                    <ChevronRight className="w-4 h-4 rotate-180" />
                    Impostazioni
                  </button>
                  <SalonSubscriptionManager
                    subscription={settings.subscription}
                    salonName={settings.name}
                    billing={salonBilling}
                    showToast={showToast}
                    onSelectPlan={startStripeCheckout}
                    onOpenPortal={openStripePortal}
                  />
                </div>
              )}

              {activeTab === 'settings' && !billingOpen && (
                <div className="space-y-4 md:space-y-6 max-w-3xl pb-8 animate-fadeIn">
                  <button
                    type="button"
                    onClick={() => setBillingOpen(true)}
                    className="w-full bg-white p-4 rounded-2xl border border-pink-100 shadow-sm flex items-center justify-between gap-3 text-left"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#E95F8F] to-[#8B5CF6] text-white flex items-center justify-center shrink-0">
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-[#1E1B2E]">Abbonamento</p>
                        <p className="text-sm text-slate-600 truncate">{billingRow.plan}</p>
                        <p className="text-sm text-slate-600">{billingRow.detail}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
                  </button>

                  {/* LOGO */}
                  <div className="bg-white p-4 md:p-6 rounded-2xl border border-pink-100 shadow-sm space-y-4">
                    <div className="border-b border-pink-50 pb-3">
                      <h3 className="font-bold text-base text-[#1E1B2E] flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-[#E95F8F]" />
                        Logo Ufficiale Salone
                      </h3>
                      <p className="text-sm text-slate-600 mt-1">
                        Carica il marchio del salone. Verrà mostrato nell'header e nei messaggi.
                      </p>
                    </div>

                    {plan.hasFeature('custom_logo') ? (
                      <SalonLogoUploader
                        currentLogoUrl={settings.logoUrl}
                        salonName={settings.name}
                        ownerName={settings.ownerName}
                        onLogoChange={handleLogoChange}
                        onLogoFile={handleLogoFile}
                        showToast={showToast}
                      />
                    ) : (
                      <ProUpsellCard
                        description="Il logo personalizzato del salone è nel piano PRO."
                        onUpgrade={openBilling}
                      />
                    )}
                  </div>

                  {/* DATI SALONE */}
                  <div className="bg-white p-4 md:p-6 rounded-2xl border border-pink-100 shadow-sm space-y-4">
                    <div className="border-b border-pink-50 pb-3">
                      <h3 className="font-bold text-base text-[#1E1B2E] flex items-center gap-2">
                        <Store className="w-4 h-4 text-[#8B5CF6]" />
                        Dati Attività & Orari
                      </h3>
                      <p className="text-sm text-slate-600 mt-0.5">
                        Configura i recapiti usati per WhatsApp, indirizzo fisico e fasce orarie.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Nome Salone */}
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1 text-sm">Nome Salone *</label>
                        <input
                          type="text"
                          value={settings.name}
                          onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                          placeholder="Es. Luce & Stile Hair & Beauty"
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#8B5CF6] outline-none text-base"
                        />
                      </div>

                      {/* Nome Titolare */}
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1 text-sm">Nome Titolare *</label>
                        <input
                          type="text"
                          value={settings.ownerName}
                          onChange={(e) => setSettings({ ...settings, ownerName: e.target.value })}
                          placeholder="Es. Elena Bianchi"
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#8B5CF6] outline-none text-base"
                        />
                      </div>

                      {/* WhatsApp Ufficiale */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-slate-700 font-semibold flex items-center gap-1.5 text-sm">
                            <Phone className="w-3.5 h-3.5 text-emerald-600" />
                            <span>WhatsApp Ufficiale Salone *</span>
                          </label>
                          <span className="text-xs text-emerald-700 font-mono font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            {sanitizePhoneNumber(settings.whatsappNumber).formattedWithPlus}
                          </span>
                        </div>
                        <input
                          type="text"
                          value={settings.whatsappNumber}
                          onChange={(e) => setSettings({ ...settings, whatsappNumber: e.target.value })}
                          placeholder="Es. 340 1234567 o +39 340 1234567"
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-emerald-700 font-bold focus:ring-2 focus:ring-[#8B5CF6] outline-none text-base"
                        />
                        <p className="text-sm text-slate-600 mt-1">
                          Prefisso internazionale applicato in automatico ai promemoria.
                        </p>
                      </div>

                      {/* Indirizzo Salone */}
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1 text-sm">Indirizzo Fisico (Via / Piazza) *</label>
                        <input
                          type="text"
                          value={settings.address}
                          onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                          placeholder="Es. Via Roma, 45"
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#8B5CF6] outline-none text-base"
                        />
                      </div>

                      {/* Città */}
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1 text-sm">Città & CAP *</label>
                        <input
                          type="text"
                          value={settings.city}
                          onChange={(e) => setSettings({ ...settings, city: e.target.value })}
                          placeholder="Es. Lecco (LC)"
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#8B5CF6] outline-none text-base"
                        />
                      </div>

                      {/* Orari di Apertura */}
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1 flex items-center gap-1 text-sm">
                          <Clock className="w-3.5 h-3.5 text-[#8B5CF6]" />
                          <span>Fasce Orarie di Apertura</span>
                        </label>
                        <input
                          type="text"
                          value={settings.openHours}
                          onChange={(e) => setSettings({ ...settings, openHours: e.target.value })}
                          placeholder="Es. Mar - Sab: 09:00 - 19:30"
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#8B5CF6] outline-none text-base"
                        />
                      </div>

                      {/* Orario / Giorni di Chiusura */}
                      <div className="md:col-span-2">
                        <label className="block text-slate-700 font-semibold mb-1 flex items-center gap-1 text-sm text-rose-700">
                          <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          <span>Orario di Chiusura & Giorni di Riposo</span>
                        </label>
                        <input
                          type="text"
                          value={(settings as any).closingHours || ''}
                          onChange={(e) => setSettings({ ...settings, closingHours: e.target.value } as any)}
                          placeholder="Es. Chiuso Domenica e Lunedì • Pausa pranzo: 13:00 - 14:00"
                          className="w-full p-2.5 bg-rose-50/50 border border-rose-200 rounded-xl focus:ring-2 focus:ring-rose-400 outline-none text-base text-rose-950 font-medium"
                        />
                        <p className="text-sm text-slate-600 mt-1">
                          Specifica i giorni o gli orari di chiusura in cui il salone non riceve clienti.
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between flex-wrap gap-2">
                      <span className="text-sm text-slate-600">
                        I dati aggiornati si rifletteranno subito nei messaggi WhatsApp.
                      </span>
                      <button
                        type="button"
                        onClick={handleSaveSettings}
                        className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-[#E95F8F] to-[#8B5CF6] hover:opacity-90 text-white font-bold text-sm rounded-xl shadow transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
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
                    teamLocked={!plan.hasFeature('staff_management')}
                    onUpgrade={openBilling}
                  />

                  <div className="text-sm text-slate-600 flex flex-wrap items-center gap-2 px-1">
                    <span>Documenti</span>
                    <LegalLinks
                      className="flex items-center gap-2"
                      linkClassName="font-semibold text-[#8B5CF6] hover:underline"
                    />
                  </div>

                  <div className="bg-white p-4 md:p-6 rounded-2xl border border-rose-100 shadow-sm">
                    {!confirmLogout ? (
                      <button
                        type="button"
                        onClick={() => setConfirmLogout(true)}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm font-bold inline-flex items-center justify-center gap-2 hover:bg-rose-100 transition"
                      >
                        <LogOut className="w-4 h-4" />
                        Esci dall'account
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm font-semibold text-[#1E1B2E]">Confermi di voler uscire da Nuvia su questo dispositivo?</p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setConfirmLogout(false)}
                            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-bold hover:bg-slate-50 transition"
                          >
                            Annulla
                          </button>
                          <button
                            type="button"
                            onClick={handleLogout}
                            className="px-4 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 transition inline-flex items-center gap-2"
                          >
                            <LogOut className="w-4 h-4" />
                            Conferma uscita
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </main>

            {/* BOTTOM BAR MOBILE */}
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
                    className={`flex min-w-0 flex-col items-center gap-0.5 px-0.5 py-1 rounded-xl transition ${
                      active ? 'text-[#E95F8F] font-bold' : 'text-slate-600'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm leading-none whitespace-nowrap">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      {/* MODALE NUOVO APPUNTAMENTO */}
      {isNewAppointmentOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[92vh] overflow-y-auto p-5 md:p-6 shadow-2xl border border-pink-100 space-y-4">
            <div className="flex items-center justify-between border-b border-pink-50 pb-3">
              <h3 className="font-bold text-[#1E1B2E] text-base flex items-center gap-2">
                <Scissors className="w-4 h-4 text-[#E95F8F]" /> Nuovo Appuntamento
              </h3>
              <button onClick={handleCloseNewAppointment} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddAppointment} className="space-y-4 text-sm">
              <div>
                <label className="block text-slate-700 font-semibold mb-1 text-sm">Nome Cliente *</label>
                <input
                  type="text"
                  required
                  placeholder="Nome e cognome cliente..."
                  value={newAppClientName}
                  onChange={(e) => setNewAppClientName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1 text-sm">Cellulare WhatsApp *</label>
                <input
                  type="text"
                  required
                  placeholder="+39 340 1234567"
                  value={newAppClientPhone}
                  onChange={(e) => setNewAppClientPhone(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-base"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1 text-sm">Data</label>
                  <input
                    type="date"
                    value={newAppDate}
                    onChange={(e) => setNewAppDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1 text-sm">Orario</label>
                  <input
                    type="time"
                    value={newAppTime}
                    onChange={(e) => setNewAppTime(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-base"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleCloseNewAppointment}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium text-sm"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#E95F8F] text-white font-bold rounded-xl shadow-md hover:bg-[#d84d7d] text-sm"
                >
                  Salva Appuntamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE NUOVO CLIENTE (RISOLTO IL CRASH SUL TASTO SALVA) */}
      {isNewClientOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 md:p-6 shadow-2xl border border-pink-100 space-y-4">
            <div className="flex items-center justify-between border-b border-pink-50 pb-3">
              <h3 className="font-bold text-[#1E1B2E] text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-[#8B5CF6]" /> Aggiungi Nuovo Cliente
              </h3>
              <button onClick={() => setIsNewClientOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const fName = (form.elements.namedItem('fName') as HTMLInputElement)?.value?.trim() || '';
                const lName = (form.elements.namedItem('lName') as HTMLInputElement)?.value?.trim() || '';
                const phone = (form.elements.namedItem('phone') as HTMLInputElement)?.value?.trim() || '';
                const email = (form.elements.namedItem('email') as HTMLInputElement)?.value?.trim() || '';
                const notes = (form.elements.namedItem('notes') as HTMLTextAreaElement)?.value?.trim() || '';

                if (!fName || !phone) {
                  showToast('Inserisci almeno nome e cellulare');
                  return;
                }

                let createdCli: Client | null = null;
                if (isValidUUID(currentSalonId)) {
                  try {
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
                  } catch (err) {
                    console.warn('Errore salvataggio Supabase, fallback locale:', err);
                  }
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
                
                setClients((prev) => [newCli, ...prev]);
                setIsNewClientOpen(false);
                showToast(`Cliente ${fName} ${lName} inserito con successo!`);
              }}
              className="space-y-3.5 text-sm"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1 text-sm">Nome *</label>
                  <input name="fName" required placeholder="Nome" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base outline-none focus:ring-2 focus:ring-[#8B5CF6]" />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1 text-sm">Cognome *</label>
                  <input name="lName" required placeholder="Cognome" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base outline-none focus:ring-2 focus:ring-[#8B5CF6]" />
                </div>
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1 text-sm">Cellulare *</label>
                <input name="phone" required placeholder="+39 340 1234567" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-base outline-none focus:ring-2 focus:ring-[#8B5CF6]" />
              </div>
              <div className="pt-2 flex justify-end gap-2.5">
                <button type="button" onClick={() => setIsNewClientOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-medium cursor-pointer">
                  Annulla
                </button>
                <button type="submit" className="px-5 py-2 bg-[#8B5CF6] hover:bg-[#7846ea] text-white font-bold rounded-xl shadow text-sm cursor-pointer">
                  Salva Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE NUOVO SERVIZIO */}
      {isNewServiceOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 md:p-6 shadow-2xl border border-pink-100 space-y-4">
            <div className="flex items-center justify-between border-b border-pink-50 pb-3">
              <h3 className="font-bold text-[#1E1B2E] text-base flex items-center gap-2">
                <Scissors className="w-4 h-4 text-[#E95F8F]" /> Nuovo Servizio
              </h3>
              <button onClick={() => setIsNewServiceOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
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
              className="space-y-3.5 text-sm"
            >
              <div>
                <label className="block text-slate-700 font-semibold mb-1 text-sm">Nome Servizio *</label>
                <input name="srvName" required placeholder="Es. Piega Glamour" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1 text-sm">Durata (min)</label>
                  <input name="srvDuration" type="number" defaultValue={45} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base" />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1 text-sm">Prezzo (€)</label>
                  <input name="srvPrice" type="number" defaultValue={30} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-[#E95F8F] text-base" />
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2.5">
                <button type="button" onClick={() => setIsNewServiceOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-medium">
                  Annulla
                </button>
                <button type="submit" className="px-5 py-2 bg-[#E95F8F] text-white font-bold rounded-xl shadow text-sm">
                  Aggiungi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALI PROMEMORIA, CASSA E STORICO */}
      <QuickRemindersModal
        isOpen={isRemindersModalOpen}
        onClose={() => setIsRemindersModalOpen(false)}
        appointments={appointments}
        settings={plan.hasFeature('whatsapp_templates') ? settings : { ...settings, googleReviewLink: undefined }}
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
        onUpgradePlan={openBilling}
        noshowLocked={!plan.hasFeature('noshow')}
      />
    </div>
  );
}
