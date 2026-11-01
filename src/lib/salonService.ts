
import { supabase } from './supabase';
import { Appointment, Client, Service, SalonSettings, UserSession, AppointmentStatus, StaffMember, StaffColor } from '../types';
import type { SalonBilling } from './plan';

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function mapSalonBilling(row: Record<string, unknown>, createdAt: string | null): SalonBilling {
  return {
    plan: (row.plan as string | null) ?? null,
    planInterval: (row.plan_interval as string | null) ?? null,
    subscriptionStatus: (row.subscription_status as string | null) ?? null,
    trialEndsAt: (row.trial_ends_at as string | null) ?? null,
    currentPeriodEnd: (row.current_period_end as string | null) ?? null,
    stripeCustomerId: (row.stripe_customer_id as string | null) ?? null,
    stripeSubscriptionId: (row.stripe_subscription_id as string | null) ?? null,
    createdAt,
  };
}

/** Undefined se le colonne di fatturazione non esistono ancora: l'app resta sul piano locale. */
export async function fetchSalonBilling(salonId: string): Promise<SalonBilling | undefined> {
  if (!isValidUUID(salonId)) return undefined;
  const columns =
    'plan, plan_interval, subscription_status, trial_ends_at, current_period_end, stripe_customer_id, stripe_subscription_id, created_at';
  const first = await supabase.from('salons').select(columns).eq('id', salonId).maybeSingle();
  if (!first.error && first.data) {
    return mapSalonBilling(first.data as Record<string, unknown>, (first.data as { created_at?: string | null }).created_at ?? null);
  }
  const message = first.error?.message || '';
  if (first.error && /created_at/i.test(message) && !/plan|subscription_status|stripe_/i.test(message)) {
    const second = await supabase
      .from('salons')
      .select('plan, plan_interval, subscription_status, trial_ends_at, current_period_end, stripe_customer_id, stripe_subscription_id')
      .eq('id', salonId)
      .maybeSingle();
    if (second.error || !second.data) return undefined;
    return mapSalonBilling(second.data as Record<string, unknown>, null);
  }
  return undefined;
}

export interface RegisterSalonParams {
  salonName: string;
  ownerName: string;
  email: string;
  phone: string;
  password?: string;
}

function mapSignUpError(error: { message?: string; status?: number }): Error {
  const message = error.message || '';
  if (message.includes('already registered') || error.status === 422) {
    return new Error('Questo indirizzo email è già registrato. Accedi con le tue credenziali.');
  }
  if (message.includes('rate limit') || error.status === 429) {
    return new Error('Limite richieste invio email superato. Riprova tra pochi minuti o accedi.');
  }
  return new Error(message || 'Errore durante la registrazione del salone.');
}

function mapPostSignupSignInError(error: { message?: string }): Error {
  const message = (error.message || '').toLowerCase();
  if (message.includes('not confirmed') || message.includes('non confermat')) {
    return new Error(
      'Controlla la tua email per confermare l’account. Dopo la conferma accedi: il salone verrà creato automaticamente.'
    );
  }
  if (message.includes('invalid login')) {
    return new Error('Account creato. Accedi con la stessa email e password per completare l’attivazione del salone.');
  }
  return new Error(error.message || 'Registrazione avviata, ma l’accesso non è riuscito. Prova ad accedere.');
}

/**
 * REGISTRAZIONE SALONE DELEGATA AL TRIGGER POSTGRESQL:
 * 1. signUp passando i dati del salone dentro options.data (salon_name, owner_name, whatsapp_number)
 *    senza un salon_id inventato: l'UUID arriva dal trigger o da ensureSalonForAuthUser
 * 2. Se data.session non è già presente, esegui subito signInWithPassword
 * Il database PostgreSQL tramite trigger crea il salone, il profilo salon_users e i servizi predefiniti.
 */
export async function registerSalon(params: RegisterSalonParams): Promise<{ data: any }> {
  const { salonName, ownerName, email, phone, password } = params;

  if (!password || password.trim().length < 6) {
    throw new Error('Inserisci una password valida (minimo 6 caratteri).');
  }

  const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;

  // 1. Chiamata signUp passando i dati del salone dentro 'options.data' (niente salon-${Date.now()})
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectTo,
      data: {
        salon_name: salonName,
        owner_name: ownerName,
        whatsapp_number: phone,
      },
    },
  });

  if (error) {
    console.error('Supabase Auth error (signUp):', error);
    throw mapSignUpError(error as { message?: string; status?: number });
  }

  const identities = (data?.user as { identities?: unknown[] } | null)?.identities;
  if (data?.user && Array.isArray(identities) && identities.length === 0) {
    throw new Error('Questo indirizzo email è già registrato. Accedi con le tue credenziali.');
  }

  // 2. Se data.session non è già presente, chiama subito signInWithPassword
  if (!data?.session) {
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      console.error('Supabase Auth error (post-signup signIn):', signInError);
      throw mapPostSignupSignInError(signInError);
    }
    return { data: signInData };
  }

  return { data };
}

/**
 * Registrazione email: stesso collegamento salone UUID di Google/OAuth
 * (trigger Postgres oppure ensureSalonForAuthUser). Non assegna id salon-${timestamp}.
 */
export async function registerEmailOwner(
  params: RegisterSalonParams
): Promise<{ session: UserSession; salon: SalonSettings }> {
  const salonName = params.salonName.trim();
  const ownerName = params.ownerName.trim() || 'Titolare';
  const email = params.email.trim();
  const phone = params.phone.trim();

  if (!salonName) {
    throw new Error('Inserisci il nome del tuo salone.');
  }

  const { data } = await registerSalon({
    salonName,
    ownerName,
    email,
    phone,
    password: params.password,
  });

  const sessionUser = data?.session?.user || data?.user;
  if (!sessionUser?.id) {
    throw new Error(
      'Controlla la tua email per confermare l’account. Dopo la conferma accedi: il salone verrà creato automaticamente.'
    );
  }

  const ensured = await ensureSalonForAuthUser({
    userId: sessionUser.id,
    email: sessionUser.email || email,
    meta: {
      ...(sessionUser.user_metadata || {}),
      salon_name: salonName,
      owner_name: ownerName,
      whatsapp_number: phone,
    },
  });

  if (!isValidUUID(ensured.salonId)) {
    throw new Error('Impossibile creare il salone. Riprova tra qualche istante.');
  }

  const session: UserSession = {
    id: sessionUser.id,
    email: sessionUser.email || email,
    salonId: ensured.salonId,
    salonName: ensured.salonName || salonName,
    ownerName: ensured.ownerName || ownerName,
    role: 'owner',
  };

  const salon: SalonSettings = {
    salonId: ensured.salonId,
    name: ensured.salonName || salonName,
    ownerName: ensured.ownerName || ownerName,
    email: ensured.salon?.email || email,
    phone,
    whatsappNumber: phone || ensured.salon?.whatsappNumber || '',
    address: ensured.salon?.address || '',
    city: ensured.salon?.city || '',
    openHours: ensured.salon?.openHours || 'Mar - Sab: 09:00 - 19:30',
    currency: '€',
    autoReminders: ensured.salon?.autoReminders ?? true,
    logoUrl: ensured.salon?.logoUrl,
    staffMembers: [
      {
        id: 'staff-1',
        name: ensured.ownerName || ownerName,
        role: 'Titolare',
        color: 'purple',
        isActive: true,
        phone,
        email,
      },
    ],
  };

  return { session, salon };
}

export interface EnsureSalonResult {
  salonId: string;
  salonName: string;
  ownerName: string;
  role: 'owner' | 'staff';
  salon?: SalonSettings;
}

/**
 * Garantisce un salone UUID per un utente autenticato (OAuth / sessione).
 * Se manca il collegamento in salon_users, crea il salone e fa upsert del profilo owner.
 * Non usa mai password e non assegna 'salon-default'.
 */
export async function ensureSalonForAuthUser(params: {
  userId: string;
  email: string;
  meta?: Record<string, any>;
  existingSalonId?: string;
}): Promise<EnsureSalonResult> {
  const meta = params.meta || {};
  let salonId =
    (params.existingSalonId && isValidUUID(params.existingSalonId) ? params.existingSalonId : '') ||
    (meta.salon_id && isValidUUID(meta.salon_id) ? meta.salon_id : '');

  let role: 'owner' | 'staff' = 'owner';
  let ownerName = meta.owner_name || params.email.split('@')[0] || 'Titolare';
  let salonName = meta.salon_name || 'Il Mio Salone';
  let salonRecord: any = null;

  if (!salonId) {
    const { data: profile } = await supabase
      .from('salon_users')
      .select('salon_id, role, full_name')
      .eq('id', params.userId)
      .maybeSingle();

    if (profile?.salon_id && isValidUUID(profile.salon_id)) {
      salonId = profile.salon_id;
      role = (profile.role as 'owner' | 'staff') || 'owner';
      if (profile.full_name) ownerName = profile.full_name;
    }
  }

  if (salonId && isValidUUID(salonId)) {
    const { data: sRecord } = await supabase
      .from('salons')
      .select('*')
      .eq('id', salonId)
      .maybeSingle();
    salonRecord = sRecord;
    if (salonRecord) {
      salonName = salonRecord.name || salonName;
      ownerName = salonRecord.owner_name || ownerName;
    }
  }

  if (!salonId || !isValidUUID(salonId)) {
    salonName = meta.salon_name || 'Il Mio Salone';
    ownerName = meta.owner_name || params.email.split('@')[0] || 'Titolare';

    const trialEndsAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const insertPayload = {
      name: salonName,
      owner_name: ownerName,
      email: params.email,
      whatsapp_number: meta.whatsapp_number || '',
    };
    let { data: created, error: createErr } = await supabase
      .from('salons')
      .insert({ ...insertPayload, trial_ends_at: trialEndsAt })
      .select('id, name, owner_name, email, whatsapp_number, address, city, open_hours, logo_url')
      .single();

    if (createErr && /trial_ends_at/i.test(createErr.message || '')) {
      const retry = await supabase
        .from('salons')
        .insert(insertPayload)
        .select('id, name, owner_name, email, whatsapp_number, address, city, open_hours, logo_url')
        .single();
      created = retry.data;
      createErr = retry.error;
    }

    if (createErr || !created?.id) {
      console.error('Errore creazione salone OAuth:', createErr);
      throw new Error(createErr?.message || 'Impossibile creare il salone per questo account.');
    }

    salonId = created.id;
    salonRecord = created;

    const { error: linkErr } = await supabase.from('salon_users').upsert(
      {
        id: params.userId,
        salon_id: salonId,
        role: 'owner',
        full_name: ownerName,
        email: params.email,
      },
      { onConflict: 'id' }
    );

    if (linkErr) {
      console.error('Errore collegamento salon_users:', linkErr);
      // salon creato: continuiamo comunque con l'UUID
    }

    // Propaga salon_id nei metadata utente (best-effort)
    try {
      await supabase.auth.updateUser({
        data: {
          salon_id: salonId,
          salon_name: salonName,
          owner_name: ownerName,
        },
      });
    } catch {}
  } else {
    // Assicura il collegamento anche se salon già noto
    await supabase.from('salon_users').upsert(
      {
        id: params.userId,
        salon_id: salonId,
        role,
        full_name: ownerName,
        email: params.email,
      },
      { onConflict: 'id' }
    );
  }

  let salonSettings: SalonSettings | undefined;
  if (salonRecord) {
    salonSettings = {
      salonId: salonRecord.id || salonId,
      name: salonRecord.name || salonName,
      ownerName: salonRecord.owner_name || ownerName,
      email: salonRecord.email || params.email,
      phone: salonRecord.whatsapp_number || '',
      whatsappNumber: salonRecord.whatsapp_number || '',
      address: salonRecord.address || '',
      city: salonRecord.city || '',
      openHours: salonRecord.open_hours || '09:00 - 19:30',
      currency: '€',
      autoReminders: true,
      logoUrl: salonRecord.logo_url || undefined,
    };
  }

  return {
    salonId,
    salonName: salonSettings?.name || salonName,
    ownerName: salonSettings?.ownerName || ownerName,
    role,
    salon: salonSettings,
  };
}

/**
 * LOGIN E PERSISTENZA SESSIONE (AUTH SIGN-IN):
 * - Chiama supabase.auth.signInWithPassword({ email, password })
 * - Garantisce un salonId UUID via ensureSalonForAuthUser (niente 'salon-default')
 */
export async function loginSalon(email: string, password: string): Promise<{ session: UserSession; salon?: SalonSettings }> {
  console.log("1. Tentativo login...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    if (authError.message.includes('Invalid login credentials')) {
      throw new Error('Email o password errati. Verifica le credenziali inserite.');
    }
    if (authError.message.includes('Email not confirmed')) {
      throw new Error('Email non ancora confermata. Controlla la tua casella di posta.');
    }
    throw new Error(authError.message || 'Errore di autenticazione.');
  }

  console.log("2. Auth riuscita...");
  const userId = authData.user.id;
  const userEmail = authData.user.email || email;
  const meta = authData.user.user_metadata || {};

  const ensured = await ensureSalonForAuthUser({
    userId,
    email: userEmail,
    meta,
  });

  const session: UserSession = {
    id: userId,
    email: userEmail,
    salonId: ensured.salonId,
    salonName: ensured.salonName,
    ownerName: ensured.ownerName,
    role: ensured.role,
  };

  return { session, salon: ensured.salon };
}

/**
 * 4. CARICAMENTO DATI MULTI-TENANT (FETCHING REALE):
 */
export async function fetchAppointmentsFromSupabase(salonId: string, dateFilter?: string): Promise<Appointment[]> {
  if (!isValidUUID(salonId)) {
    return [];
  }

  let query = supabase.from('appointments').select('*').eq('salon_id', salonId);

  if (dateFilter && dateFilter !== 'all') {
    query = query.eq('appointment_date', dateFilter);
  }

  const { data, error } = await query
    .order('appointment_date', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) {
    console.error('Error fetching appointments:', error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    salonId: row.salon_id,
    clientName: row.client_name || 'Cliente',
    clientPhone: row.client_phone || '',
    serviceId: row.client_id || 'serv-1',
    serviceName: row.service_names || 'Servizio Salone',
    serviceNames: row.service_names ? row.service_names.split(', ') : [],
    price: Number(row.price) || 0,
    durationMinutes: Number(row.duration_minutes) || 30,
    date: row.appointment_date || '',
    time: row.start_time ? row.start_time.slice(0, 5) : '09:00',
    status: (row.status as AppointmentStatus) || 'Confermato',
    notes: row.notes || '',
    staffId: row.staff_id || 'staff-1',
    staffName: row.staff_name || 'Staff',
    paymentMethod: row.payment_method || undefined,
    isPaid: !!row.is_paid,
  }));
}

export async function fetchClientsFromSupabase(salonId: string): Promise<Client[]> {
  if (!isValidUUID(salonId)) {
    return [];
  }

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('salon_id', salonId)
    .order('first_name', { ascending: true });

  if (error) {
    console.error('Error fetching clients:', error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    salonId: row.salon_id,
    firstName: row.first_name || '',
    lastName: row.last_name || '',
    phone: row.phone || '',
    email: row.email || '',
    notes: '',
    technicalNotes: row.technical_notes || '',
    status: (row.status as 'Attivo' | 'Inattivo') || 'Attivo',
    noShowCount: Number(row.no_show_count) || 0,
    totalAppointments: 0,
    totalSpent: 0,
    tags: [],
    isBlocked: false,
  }));
}

export async function fetchServicesFromSupabase(salonId: string): Promise<Service[]> {
  if (!isValidUUID(salonId)) {
    return [];
  }

  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('salon_id', salonId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching services:', error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    salonId: row.salon_id,
    name: row.name,
    category: row.category || 'Capelli',
    durationMinutes: Number(row.duration_minutes) || 30,
    price: Number(row.price) || 0,
    isActive: row.is_active !== false,
    description: row.description || '',
  }));
}

/**
 * INSERIMENTI REALI MULTI-TENANT CON SALON_ID
 */
export async function insertAppointmentToSupabase(
  app: {
    salonId: string;
    clientName: string;
    clientPhone: string;
    clientId?: string;
    serviceNames: string[];
    date: string;
    time: string;
    endTime?: string;
    price: number;
    durationMinutes: number;
    status: AppointmentStatus;
    notes?: string;
    staffId?: string;
    staffName?: string;
  }
): Promise<Appointment | null> {
  const newId = generateUUID();
  const validClientId = app.clientId && isValidUUID(app.clientId) ? app.clientId : null;

  const payload: any = {
    id: newId,
    salon_id: app.salonId,
    client_name: app.clientName,
    client_phone: app.clientPhone,
    client_id: validClientId,
    service_names: app.serviceNames.join(', '),
    appointment_date: app.date,
    start_time: app.time,
    end_time: app.endTime || null,
    price: app.price,
    duration_minutes: app.durationMinutes,
    status: app.status || 'Confermato',
    notes: app.notes || '',
    staff_id: app.staffId || 'staff-1',
    staff_name: app.staffName || 'Staff',
    payment_method: null,
    is_paid: false,
  };

  const { data, error } = await supabase.from('appointments').insert(payload).select().single();
  if (error) {
    console.error('Error inserting appointment:', error);
  }

  return {
    id: data?.id || newId,
    salonId: app.salonId,
    clientName: app.clientName,
    clientPhone: app.clientPhone,
    serviceId: 'serv-1',
    serviceName: app.serviceNames.join(', '),
    serviceNames: app.serviceNames,
    price: app.price,
    durationMinutes: app.durationMinutes,
    date: app.date,
    time: app.time,
    status: app.status,
    notes: app.notes,
    staffId: app.staffId,
    staffName: app.staffName,
    isPaid: false,
  };
}

export async function insertClientToSupabase(
  client: {
    salonId: string;
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
    technicalNotes?: string;
    status?: 'Attivo' | 'Inattivo';
    noShowCount?: number;
  }
): Promise<Client | null> {
  const newId = generateUUID();

  const payload = {
    id: newId,
    salon_id: client.salonId,
    first_name: client.firstName,
    last_name: client.lastName,
    phone: client.phone,
    email: client.email || '',
    technical_notes: client.technicalNotes || '',
    status: client.status || 'Attivo',
    no_show_count: client.noShowCount || 0,
  };

  const { data, error } = await supabase.from('clients').insert(payload).select().single();
  if (error) {
    console.error('Error inserting client:', error);
  }

  return {
    id: data?.id || newId,
    salonId: client.salonId,
    firstName: client.firstName,
    lastName: client.lastName,
    phone: client.phone,
    email: client.email || '',
    notes: '',
    technicalNotes: client.technicalNotes || '',
    status: (client.status as any) || 'Attivo',
    noShowCount: client.noShowCount || 0,
    totalAppointments: 0,
    totalSpent: 0,
    tags: [],
    isBlocked: false,
  };
}

export async function insertServiceToSupabase(
  service: {
    salonId: string;
    name: string;
    category: any;
    durationMinutes: number;
    price: number;
    isActive?: boolean;
    description?: string;
  }
): Promise<Service | null> {
  const newId = generateUUID();

  const payload = {
    id: newId,
    salon_id: service.salonId,
    name: service.name,
    category: service.category,
    duration_minutes: service.durationMinutes,
    price: service.price,
    is_active: service.isActive !== false,
    description: service.description || '',
  };

  const { data, error } = await supabase.from('services').insert(payload).select().single();
  if (error) {
    console.error('Error inserting service:', error);
  }

  return {
    id: data?.id || newId,
    salonId: service.salonId,
    name: service.name,
    category: service.category,
    durationMinutes: service.durationMinutes,
    price: service.price,
    isActive: service.isActive !== false,
    description: service.description || '',
  };
}

export async function updateAppointmentInSupabase(id: string, updates: Partial<Appointment>): Promise<void> {
  if (!isValidUUID(id)) return;
  const dbUpdates: any = {};
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.paymentMethod !== undefined) dbUpdates.payment_method = updates.paymentMethod;
  if (updates.isPaid !== undefined) dbUpdates.is_paid = updates.isPaid;
  if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
  if (updates.price !== undefined) dbUpdates.price = updates.price;
  if (updates.date !== undefined) dbUpdates.appointment_date = updates.date;
  if (updates.time !== undefined) dbUpdates.start_time = updates.time;

  await supabase.from('appointments').update(dbUpdates).eq('id', id);
}

export async function updateClientInSupabase(id: string, updates: Partial<Client>): Promise<void> {
  if (!isValidUUID(id)) return;
  const dbUpdates: any = {};
  if (updates.technicalNotes !== undefined) dbUpdates.technical_notes = updates.technicalNotes;
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.noShowCount !== undefined) dbUpdates.no_show_count = updates.noShowCount;
  if (updates.firstName !== undefined) dbUpdates.first_name = updates.firstName;
  if (updates.lastName !== undefined) dbUpdates.last_name = updates.lastName;
  if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
  if (updates.email !== undefined) dbUpdates.email = updates.email;

  await supabase.from('clients').update(dbUpdates).eq('id', id);
}

export async function updateServiceInSupabase(id: string, updates: Partial<Service>): Promise<void> {
  if (!isValidUUID(id)) return;
  const dbUpdates: any = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.category !== undefined) dbUpdates.category = updates.category;
  if (updates.price !== undefined) dbUpdates.price = updates.price;
  if (updates.durationMinutes !== undefined) dbUpdates.duration_minutes = updates.durationMinutes;
  if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
  if (updates.description !== undefined) dbUpdates.description = updates.description;

  await supabase.from('services').update(dbUpdates).eq('id', id);
}

export async function deleteServiceInSupabase(id: string): Promise<void> {
  if (!isValidUUID(id)) return;
  await supabase.from('services').delete().eq('id', id);
}

export async function deleteAppointmentInSupabase(id: string): Promise<void> {
  if (!isValidUUID(id)) return;
  await supabase.from('appointments').delete().eq('id', id);
}

const STAFF_COLORS_OK = new Set<StaffColor>([
  'pink', 'purple', 'emerald', 'amber', 'blue', 'rose', 'indigo', 'teal',
]);

const DEMO_STAFF_SEED = [
  { id: 'staff-1', name: 'Elena Bianchi' },
  { id: 'staff-2', name: 'Sara Villa' },
  { id: 'staff-3', name: 'Chiara Rossi' },
  { id: 'staff-4', name: 'Luca Moretti' },
];

function asStaffColor(value: unknown): StaffColor {
  return STAFF_COLORS_OK.has(value as StaffColor) ? (value as StaffColor) : 'purple';
}

function isDemoStaffSeed(list: StaffMember[]): boolean {
  if (list.length !== DEMO_STAFF_SEED.length) return false;
  return list.every((member, index) => member.id === DEMO_STAFF_SEED[index].id && member.name === DEMO_STAFF_SEED[index].name);
}

function mapStaffRow(row: any): StaffMember {
  return {
    id: row.id,
    name: row.name || 'Collaboratore',
    role: row.role || 'Collaboratore',
    color: asStaffColor(row.color),
    isActive: row.active !== false,
    phone: row.phone || undefined,
    email: row.email || undefined,
  };
}

export async function fetchStaffFromSupabase(salonId: string): Promise<StaffMember[]> {
  if (!isValidUUID(salonId)) return [];
  const { data, error } = await supabase
    .from('staff')
    .select('*')
    .eq('salon_id', salonId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapStaffRow);
}

function staffPayload(salonId: string, member: StaffMember, id: string) {
  return {
    id,
    salon_id: salonId,
    name: member.name.trim() || 'Collaboratore',
    role: member.role.trim() || 'Collaboratore',
    color: asStaffColor(member.color),
    phone: member.phone?.trim() || null,
    email: member.email?.trim() || null,
    active: member.isActive !== false,
  };
}

export async function insertStaffMember(salonId: string, member: StaffMember): Promise<StaffMember> {
  const id = isValidUUID(member.id) ? member.id : generateUUID();
  const { data, error } = await supabase
    .from('staff')
    .insert(staffPayload(salonId, member, id))
    .select('*')
    .single();
  if (error) throw error;
  return mapStaffRow(data);
}

export async function updateStaffMember(member: StaffMember): Promise<void> {
  if (!isValidUUID(member.id)) return;
  const { error } = await supabase
    .from('staff')
    .update({
      name: member.name.trim() || 'Collaboratore',
      role: member.role.trim() || 'Collaboratore',
      color: asStaffColor(member.color),
      phone: member.phone?.trim() || null,
      email: member.email?.trim() || null,
      active: member.isActive !== false,
    })
    .eq('id', member.id);
  if (error) throw error;
}

export async function deleteStaffMember(id: string): Promise<void> {
  if (!isValidUUID(id)) return;
  const { error } = await supabase.from('staff').delete().eq('id', id);
  if (error) throw error;
}

/** Persist a full roster diff. New non-UUID ids are replaced and returned. */
export async function saveStaffRoster(
  salonId: string,
  previous: StaffMember[],
  next: StaffMember[]
): Promise<StaffMember[]> {
  if (!isValidUUID(salonId)) return next;
  const saved: StaffMember[] = [];
  const previousById = new Map(previous.map((member) => [member.id, member]));
  const nextIds = new Set(next.map((member) => member.id));

  for (const member of next) {
    const prior = previousById.get(member.id);
    if (!prior) {
      saved.push(await insertStaffMember(salonId, member));
      continue;
    }
    const changed =
      prior.name !== member.name ||
      prior.role !== member.role ||
      prior.color !== member.color ||
      prior.phone !== member.phone ||
      prior.email !== member.email ||
      prior.isActive !== member.isActive;
    if (changed) await updateStaffMember(member);
    saved.push(member);
  }

  for (const member of previous) {
    if (!nextIds.has(member.id)) await deleteStaffMember(member.id);
  }

  return saved;
}

function extensionForMime(mime: string): string {
  if (mime.includes('svg')) return 'svg';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  return 'png';
}

export function dataUrlToBlob(dataUrl: string): { blob: Blob; contentType: string; extension: string } {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) throw new Error('Logo non valido.');
  const header = dataUrl.slice(0, comma);
  const data = dataUrl.slice(comma + 1);
  const contentType = /data:([^;,]+)/.exec(header)?.[1] || 'image/png';
  if (/;base64/i.test(header)) {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return { blob: new Blob([bytes], { type: contentType }), contentType, extension: extensionForMime(contentType) };
  }
  const text = decodeURIComponent(data);
  return { blob: new Blob([text], { type: contentType }), contentType, extension: extensionForMime(contentType) };
}

async function uploadLogoBlob(salonId: string, blob: Blob, contentType: string, extension: string): Promise<string> {
  const path = `${salonId}/${generateUUID()}.${extension}`;
  const { error } = await supabase.storage.from('salon-logos').upload(path, blob, {
    contentType,
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from('salon-logos').getPublicUrl(path);
  const publicUrl = data.publicUrl;
  const { error: updateError } = await supabase.from('salons').update({ logo_url: publicUrl }).eq('id', salonId);
  if (updateError) throw updateError;
  return publicUrl;
}

export async function uploadSalonLogoFile(salonId: string, file: File): Promise<string> {
  if (!isValidUUID(salonId)) throw new Error('Salone non valido.');
  const contentType = file.type || 'image/png';
  return uploadLogoBlob(salonId, file, contentType, extensionForMime(contentType));
}

export async function uploadSalonLogoDataUrl(salonId: string, dataUrl: string): Promise<string> {
  const parsed = dataUrlToBlob(dataUrl);
  return uploadLogoBlob(salonId, parsed.blob, parsed.contentType, parsed.extension);
}

export async function clearSalonLogo(salonId: string): Promise<void> {
  if (!isValidUUID(salonId)) return;
  const { data: existing } = await supabase.storage.from('salon-logos').list(salonId);
  if (existing?.length) {
    await supabase.storage.from('salon-logos').remove(existing.map((file) => `${salonId}/${file.name}`));
  }
  const { error } = await supabase.from('salons').update({ logo_url: null }).eq('id', salonId);
  if (error) throw error;
}

function readStoredSettings(): Record<string, any> | null {
  try {
    const raw = localStorage.getItem('salondesk_settings');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function clearLocalStaffAndDataLogo(salonId: string) {
  const parsed = readStoredSettings();
  if (!parsed) return;
  if (parsed.salonId && parsed.salonId !== salonId) return;
  delete parsed.staffMembers;
  if (typeof parsed.logoUrl === 'string' && parsed.logoUrl.startsWith('data:')) delete parsed.logoUrl;
  localStorage.setItem('salondesk_settings', JSON.stringify(parsed));
  localStorage.setItem(`nuvia_staff_logo_migrated_${salonId}`, '1');
}

async function remapAppointmentStaffIds(
  salonId: string,
  idMap: Record<string, string>,
  nameToId: Map<string, string>
): Promise<void> {
  const { data, error } = await supabase
    .from('appointments')
    .select('id, staff_id, staff_name')
    .eq('salon_id', salonId);
  if (error || !data) return;

  for (const row of data) {
    const current = typeof row.staff_id === 'string' ? row.staff_id : '';
    let nextId = current && idMap[current] ? idMap[current] : '';
    if (!nextId && current && !isValidUUID(current)) {
      const byName = nameToId.get(String(row.staff_name || '').trim().toLowerCase());
      if (byName) nextId = byName;
    }
    if (!nextId || nextId === current) continue;
    await supabase.from('appointments').update({ staff_id: nextId }).eq('id', row.id);
  }
}

export interface StaffLogoSyncResult {
  staff: StaffMember[];
  logoUrl?: string;
  staffIdMap: Record<string, string>;
}

/**
 * Load staff and logo from Supabase. If the database is empty and this browser
 * still has staff or a data-URL logo for the same salon, copy them once.
 */
export async function syncStaffAndLogo(params: {
  salonId: string;
  memoryStaff?: StaffMember[];
  memoryLogo?: string;
  memorySalonId?: string;
}): Promise<StaffLogoSyncResult> {
  const { salonId } = params;
  if (!isValidUUID(salonId)) {
    return { staff: params.memoryStaff || [], logoUrl: params.memoryLogo, staffIdMap: {} };
  }

  const remoteStaff = await fetchStaffFromSupabase(salonId);
  const { data: salonRow, error: salonError } = await supabase
    .from('salons')
    .select('logo_url')
    .eq('id', salonId)
    .maybeSingle();
  if (salonError) throw salonError;

  const stored = readStoredSettings();
  const storedMatches = stored?.salonId === salonId;
  const memoryMatches = params.memorySalonId === salonId;
  const storedStaff = storedMatches && Array.isArray(stored?.staffMembers) ? (stored.staffMembers as StaffMember[]) : [];
  const localStaff = storedStaff.length ? storedStaff : memoryMatches ? params.memoryStaff || [] : [];
  const storedLogo = storedMatches && typeof stored?.logoUrl === 'string' ? stored.logoUrl : '';
  const localLogo = storedLogo || (memoryMatches ? params.memoryLogo || '' : '');
  const migratedFlag = localStorage.getItem(`nuvia_staff_logo_migrated_${salonId}`) === '1';

  let staff = remoteStaff;
  let logoUrl = (salonRow?.logo_url as string | null) || undefined;
  const staffIdMap: Record<string, string> = {};

  if (!migratedFlag && staff.length === 0 && localStaff.length > 0 && !isDemoStaffSeed(localStaff)) {
    const nameCounts = new Map<string, number>();
    for (const member of localStaff) {
      const key = member.name.trim().toLowerCase();
      nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
    }
    const inserted: StaffMember[] = [];
    for (const member of localStaff) {
      const created = await insertStaffMember(salonId, member);
      staffIdMap[member.id] = created.id;
      inserted.push(created);
    }
    const nameToId = new Map<string, string>();
    for (const member of inserted) {
      const key = member.name.trim().toLowerCase();
      if ((nameCounts.get(key) || 0) === 1) nameToId.set(key, member.id);
    }
    await remapAppointmentStaffIds(salonId, staffIdMap, nameToId);
    staff = inserted;
  }

  if (!logoUrl && localLogo.startsWith('data:')) {
    logoUrl = await uploadSalonLogoDataUrl(salonId, localLogo);
  }

  if (!migratedFlag || staff.length > 0 || logoUrl) {
    clearLocalStaffAndDataLogo(salonId);
  }

  return { staff, logoUrl, staffIdMap };
}


