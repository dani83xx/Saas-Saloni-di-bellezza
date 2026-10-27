
import { supabase } from './supabase';
import { Appointment, Client, Service, SalonSettings, UserSession, AppointmentStatus } from '../types';

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

export interface RegisterSalonParams {
  salonName: string;
  ownerName: string;
  email: string;
  phone: string;
  password?: string;
}

/**
 * REGISTRAZIONE SALONE DELEGATA AL TRIGGER POSTGRESQL:
 * 1. signUp passando i dati del salone dentro options.data (salon_name, owner_name, whatsapp_number)
 * 2. Se data.session non è già presente, esegui subito signInWithPassword
 * Il database PostgreSQL tramite trigger crea istantaneamente il salone, il profilo salon_users e i servizi predefiniti.
 */
export async function registerSalon(params: RegisterSalonParams): Promise<{ data: any }> {
  const { salonName, ownerName, email, phone, password } = params;

  if (!password || password.trim().length < 6) {
    throw new Error('Inserisci una password valida (minimo 6 caratteri).');
  }

  // 1. Chiamata signUp passando i dati del salone dentro 'options.data'
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        salon_name: salonName,
        owner_name: ownerName,
        whatsapp_number: phone,
      },
    },
  });

  if (error) {
    console.error('Supabase Auth error (signUp):', error);
    if (error.message.includes('already registered') || (error as any).status === 422) {
      throw new Error('Questo indirizzo email è già registrato. Accedi con le tue credenziali.');
    }
    if (error.message.includes('rate limit') || (error as any).status === 429) {
      throw new Error('Limite richieste invio email superato. Riprova tra pochi minuti o accedi.');
    }
    throw new Error(error.message || 'Errore durante la registrazione del salone.');
  }

  // 2. Se data.session non è già presente, chiama subito signInWithPassword
  if (!data?.session) {
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      console.error('Supabase Auth error (post-signup signIn):', signInError);
      throw signInError;
    }
    return { data: signInData };
  }

  return { data };
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

    const { data: created, error: createErr } = await supabase
      .from('salons')
      .insert({
        name: salonName,
        owner_name: ownerName,
        email: params.email,
        whatsapp_number: meta.whatsapp_number || '',
      })
      .select('id, name, owner_name, email, whatsapp_number, address, city, open_hours, logo_url')
      .single();

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


