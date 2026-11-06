/**
 * Prove SQL su PGlite, non sul progetto Supabase di produzione.
 * Non chiama Meta, non usa token veri e non applica la migration sul database live.
 * I ruoli sono simulati con SET ROLE e con request.jwt.claim.*, non con PostgREST.
 * pg_cron, pg_net e vault non vengono eseguiti: la migration esce da quel blocco se mancano.
 */
import { beforeAll, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const FIXTURE = `
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('request.jwt.claim.role', true), '');
$$;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object('role', auth.role());
$$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;
CREATE TABLE public.salons (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  email text,
  address text,
  city text,
  plan text,
  plan_interval text,
  subscription_status text,
  trial_ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.clients (
  id uuid PRIMARY KEY,
  salon_id uuid NOT NULL REFERENCES public.salons (id),
  first_name text,
  phone text,
  email text
);
CREATE TABLE public.appointments (
  id uuid PRIMARY KEY,
  salon_id uuid NOT NULL REFERENCES public.salons (id),
  client_id uuid,
  client_name text,
  service_names text,
  staff_name text,
  appointment_date date,
  start_time time,
  status text
);
CREATE TABLE public.salon_users (
  id uuid PRIMARY KEY,
  salon_id uuid NOT NULL REFERENCES public.salons (id),
  role text,
  full_name text,
  email text
);
`;

const GRANTS = `
GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT SELECT, UPDATE ON public.salons TO authenticated;
GRANT SELECT, UPDATE ON public.appointments TO authenticated;
GRANT SELECT ON public.clients TO authenticated;
GRANT SELECT ON public.whatsapp_consent_events TO authenticated;
GRANT EXECUTE ON FUNCTION public.nuvia_record_whatsapp_consent(uuid, text, text) TO authenticated;
`;

describe('promemoria WhatsApp sul database', () => {
  const db = new PGlite();
  const ids = {
    proMonth: crypto.randomUUID(),
    proYear: crypto.randomUUID(),
    baseMonth: crypto.randomUUID(),
    baseYear: crypto.randomUUID(),
    trial: crypto.randomUUID(),
    expired: crypto.randomUUID(),
    other: crypto.randomUUID(),
    owner: crypto.randomUUID(),
    admin: crypto.randomUUID(),
    operator: crypto.randomUUID(),
    otherOwner: crypto.randomUUID(),
    yearOwner: crypto.randomUUID(),
  };

  beforeAll(async () => {
    await db.exec(FIXTURE);
    await db.exec(readFileSync(new URL('../../supabase/migrations/20261105233000_automatic_reminders.sql', import.meta.url), 'utf8'));
    await db.exec(readFileSync(new URL('../../supabase/migrations/20261106220000_whatsapp_reminders.sql', import.meta.url), 'utf8'));
    await db.exec(GRANTS);
    await db.exec(`
      INSERT INTO public.salons (id, name, plan, plan_interval, subscription_status) VALUES
        ('${ids.proMonth}', 'Pro Mese', 'pro', 'mese', 'active'),
        ('${ids.proYear}', 'Pro Anno', 'pro', 'anno', 'active'),
        ('${ids.baseMonth}', 'Base Mese', 'base', 'mese', 'active'),
        ('${ids.baseYear}', 'Base Anno', 'base', 'anno', 'active');
      INSERT INTO public.salons (id, name, trial_ends_at) VALUES
        ('${ids.trial}', 'Prova', now() + interval '3 days'),
        ('${ids.expired}', 'Prova scaduta', now() - interval '1 day');
      INSERT INTO public.salons (id, name, plan, plan_interval, subscription_status) VALUES
        ('${ids.other}', 'Altro', 'pro', 'mese', 'active');
      INSERT INTO public.salon_users (id, salon_id, role) VALUES
        ('${ids.owner}', '${ids.proMonth}', 'owner'),
        ('${ids.admin}', '${ids.proMonth}', 'admin'),
        ('${ids.operator}', '${ids.proMonth}', 'operator'),
        ('${ids.otherOwner}', '${ids.other}', 'owner'),
        ('${ids.yearOwner}', '${ids.proYear}', 'owner');
    `);
  });

  test('BASE non si accende, PRO mensile e annuale sì, la prova segue la data', async () => {
    await expect(call(`SELECT public.nuvia_set_whatsapp_reminders('${ids.baseMonth}', true)`)).rejects.toThrow(/REMINDER_PLAN_LOCKED/);
    await expect(call(`SELECT public.nuvia_set_whatsapp_reminders('${ids.baseYear}', true)`)).rejects.toThrow(/REMINDER_PLAN_LOCKED/);
    await call(`SELECT public.nuvia_set_whatsapp_reminders('${ids.proMonth}', true)`);
    await call(`SELECT public.nuvia_set_whatsapp_reminders('${ids.proYear}', true)`);
    await call(`SELECT public.nuvia_set_whatsapp_reminders('${ids.trial}', true)`);
    await expect(call(`SELECT public.nuvia_set_whatsapp_reminders('${ids.expired}', true)`)).rejects.toThrow(/REMINDER_PLAN_LOCKED/);
    const flags = await db.query<{ name: string; enabled: boolean }>(`
      SELECT name, whatsapp_reminders_enabled AS enabled
      FROM public.salons
      WHERE id IN ('${ids.proMonth}', '${ids.baseMonth}', '${ids.trial}')
      ORDER BY name
    `);
    expect(flags.rows.map((row) => [row.name, row.enabled])).toEqual([
      ['Base Mese', false],
      ['Pro Mese', true],
      ['Prova', true],
    ]);
  });

  test('il ruolo authenticated non accende il canale e l’operatore non registra il consenso', async () => {
    await session('authenticated', ids.owner);
    await expect(call(`
      UPDATE public.salons
      SET whatsapp_reminders_enabled = true
      WHERE id = '${ids.baseMonth}'
    `)).rejects.toThrow(/WHATSAPP_ENABLE_SERVER_ONLY|Da configurare/);
    await expect(call(`SELECT public.nuvia_whatsapp_due(1)`)).rejects.toThrow(/permission denied/);
    const clientId = await seedClient(ids.proMonth, '3401234567');
    await session('authenticated', ids.operator);
    await expect(call(`
      SELECT public.nuvia_record_whatsapp_consent('${clientId}', 'granted', 'chiesto in salone')
    `)).rejects.toThrow(/WHATSAPP_CONSENT_DENIED|Permesso negato/);
    await resetSession();
  });

  test('il consenso non è precompilato, la revoca ferma l’invio e un altro salone non può firmarlo', async () => {
    await resetSession();
    const clientId = await seedClient(ids.proMonth, '340 111 2233');
    const events = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.whatsapp_consent_events WHERE client_id = '${clientId}'`);
    expect(events.rows[0].n).toBe(0);
    expect(await dueIds()).not.toContain(await appointmentFor(ids.proMonth, clientId));

    await session('authenticated', ids.otherOwner);
    await expect(call(`
      SELECT public.nuvia_record_whatsapp_consent('${clientId}', 'granted', 'tentativo altro salone')
    `)).rejects.toThrow(/WHATSAPP_CONSENT_DENIED|Permesso negato/);

    await session('authenticated', ids.admin);
    await call(`SELECT public.nuvia_record_whatsapp_consent('${clientId}', 'granted', 'chiesto alla reception')`);
    const appointmentId = await appointmentFor(ids.proMonth, clientId);
    expect(await dueIds()).toContain(appointmentId);

    await session('authenticated', ids.admin);
    await call(`SELECT public.nuvia_record_whatsapp_consent('${clientId}', 'revoked', 'il cliente ha detto no')`);
    expect(await dueIds()).not.toContain(appointmentId);
    const history = await db.query<{ action: string }>(`
      SELECT action FROM public.whatsapp_consent_events
      WHERE client_id = '${clientId}'
      ORDER BY created_at, id
    `);
    expect(history.rows.map((row) => row.action)).toEqual(['granted', 'revoked']);
    await resetSession();
  });

  test('email e WhatsApp non si cancellano a vicenda, il secondo giro non duplica, timeout ambiguo non si rilascia', async () => {
    await resetSession();
    const clientId = await seedClient(ids.proYear, '3490001122', 'giulia@example.com');
    await session('authenticated', ids.yearOwner);
    await call(`SELECT public.nuvia_record_whatsapp_consent('${clientId}', 'granted', 'modulo firmato in salone')`);
    await resetSession();
    await db.exec(`UPDATE public.salons SET auto_reminders = true WHERE id = '${ids.proYear}'`);
    const appointmentId = await appointmentFor(ids.proYear, clientId);

    const whatsapp = await db.query<{ rows: unknown }>(`SELECT public.nuvia_whatsapp_due(10) AS rows`);
    const emailBefore = await db.query<{ reminder_sent_at: string | null }>(`
      SELECT reminder_sent_at FROM public.appointments WHERE id = '${appointmentId}'
    `);
    expect(JSON.stringify(whatsapp.rows[0].rows)).toContain(appointmentId);
    expect(emailBefore.rows[0].reminder_sent_at).toBeNull();

    const email = await db.query<{ rows: unknown }>(`SELECT public.nuvia_claim_due_reminders(10) AS rows`);
    const whatsappStatus = await db.query<{ status: string }>(`
      SELECT whatsapp_reminder_status AS status FROM public.appointments WHERE id = '${appointmentId}'
    `);
    expect(JSON.stringify(email.rows[0].rows)).toContain(appointmentId);
    expect(whatsappStatus.rows[0].status).toBe('claimed');

    const second = await db.query<{ rows: unknown }>(`SELECT public.nuvia_whatsapp_due(10) AS rows`);
    expect(second.rows[0].rows).toEqual([]);

    const claim = await db.query<{ claim_id: string }>(`
      SELECT whatsapp_reminder_claim_id AS claim_id FROM public.appointments WHERE id = '${appointmentId}'
    `);
    const ambiguous = await db.query<{ ok: boolean }>(`
      SELECT public.nuvia_finish_whatsapp_reminder('${appointmentId}', '${claim.rows[0].claim_id}', 'ambiguous') AS ok
    `);
    const released = await db.query<{ ok: boolean }>(`
      SELECT public.nuvia_release_whatsapp_reminder('${appointmentId}', '${claim.rows[0].claim_id}') AS ok
    `);
    expect(ambiguous.rows[0].ok).toBe(true);
    expect(released.rows[0].ok).toBe(false);
    const after = await db.query<{ rows: unknown }>(`SELECT public.nuvia_whatsapp_due(10) AS rows`);
    expect(JSON.stringify(after.rows[0].rows)).not.toContain(appointmentId);
  });

  test('spostamento e annullo bloccano il canale, un numero invalido no', async () => {
    await resetSession();
    const clientId = await seedClient(ids.proMonth, '3331234567');
    await session('authenticated', ids.admin);
    await call(`SELECT public.nuvia_record_whatsapp_consent('${clientId}', 'granted', 'confermato di persona')`);
    await resetSession();
    const appointmentId = await appointmentFor(ids.proMonth, clientId);
    expect(await dueIds()).toContain(appointmentId);

    await session('authenticated', ids.admin);
    await call(`
      UPDATE public.appointments
      SET appointment_date = ((now() AT TIME ZONE 'Europe/Rome') + interval '5 days')::date
      WHERE id = '${appointmentId}'
    `);
    const cleared = await db.query<{ status: string | null; email_sent: string | null }>(`
      SELECT whatsapp_reminder_status AS status, reminder_sent_at::text AS email_sent
      FROM public.appointments WHERE id = '${appointmentId}'
    `);
    expect(cleared.rows[0].status).toBeNull();
    expect(await dueIds()).not.toContain(appointmentId);

    const cancelledClient = await seedClient(ids.proMonth, '3201234567');
    await session('authenticated', ids.admin);
    await call(`SELECT public.nuvia_record_whatsapp_consent('${cancelledClient}', 'granted', 'foglio accettazione')`);
    await resetSession();
    const cancelledId = await appointmentFor(ids.proMonth, cancelledClient, 'Annullato');
    expect(await dueIds()).not.toContain(cancelledId);

    const badClient = await seedClient(ids.proMonth, 'abc');
    await session('authenticated', ids.owner);
    await expect(call(`
      SELECT public.nuvia_record_whatsapp_consent('${badClient}', 'granted', 'numero illeggibile')
    `)).rejects.toThrow(/WHATSAPP_PHONE_INVALID/);
    await resetSession();
  });

  test('un salone BASE forzato e uno non configurato non entrano nel claim', async () => {
    await resetSession();
    await db.exec(`ALTER TABLE public.salons DISABLE TRIGGER nuvia_guard_whatsapp_reminders`);
    await db.exec(`
      UPDATE public.salons
      SET whatsapp_reminders_enabled = true, whatsapp_sender_ready = true
      WHERE id = '${ids.baseYear}'
    `);
    await db.exec(`ALTER TABLE public.salons ENABLE TRIGGER nuvia_guard_whatsapp_reminders`);
    const baseClient = await seedClient(ids.baseYear, '3471234567');
    await db.exec(`
      INSERT INTO public.whatsapp_consent_events (salon_id, client_id, action, source, consented_phone, recorded_by)
      VALUES ('${ids.baseYear}', '${baseClient}', 'granted', 'inserimento diretto di test', public.nuvia_whatsapp_phone('3471234567'), '${ids.owner}')
    `);
    const baseAppointment = await appointmentFor(ids.baseYear, baseClient);
    expect(await dueIds()).not.toContain(baseAppointment);

    await db.exec(`
      UPDATE public.salons
      SET whatsapp_reminders_enabled = false, whatsapp_sender_ready = false
      WHERE id = '${ids.proMonth}'
    `);
    const idsAfter = await dueIds();
    expect(idsAfter.every((id) => id.length > 0)).toBe(true);
    const proStillDue = await db.query(`
      SELECT id FROM public.appointments WHERE salon_id = '${ids.proMonth}'
    `);
    for (const row of proStillDue.rows as Array<{ id: string }>) {
      expect(idsAfter).not.toContain(row.id);
    }
  });

  async function call(statement: string) {
    return db.exec(statement);
  }

  async function session(role: string, userId: string) {
    await db.exec(`SELECT set_config('request.jwt.claim.role', '${role}', false)`);
    await db.exec(`SELECT set_config('request.jwt.claim.sub', '${userId}', false)`);
    await db.exec(`SET ROLE ${role === 'service_role' ? 'service_role' : 'authenticated'}`);
  }

  async function resetSession() {
    await db.exec('RESET ROLE');
    await db.exec(`SELECT set_config('request.jwt.claim.role', '', false)`);
    await db.exec(`SELECT set_config('request.jwt.claim.sub', '', false)`);
  }

  async function seedClient(salonId: string, phone: string, email = '') {
    await resetSession();
    const id = crypto.randomUUID();
    await db.exec(`
      INSERT INTO public.clients (id, salon_id, first_name, phone, email)
      VALUES ('${id}', '${salonId}', 'Giulia', '${phone}', '${email}')
    `);
    return id;
  }

  async function appointmentFor(salonId: string, clientId: string, status = 'Confermato') {
    await resetSession();
    const existing = await db.query<{ id: string }>(`
      SELECT id FROM public.appointments
      WHERE salon_id = '${salonId}' AND client_id = '${clientId}' AND status = '${status}'
      LIMIT 1
    `);
    if (existing.rows[0]?.id) return existing.rows[0].id;
    const id = crypto.randomUUID();
    await db.exec(`
      INSERT INTO public.appointments (
        id, salon_id, client_id, client_name, service_names, appointment_date, start_time, status, reminder_anchor_at
      ) VALUES (
        '${id}',
        '${salonId}',
        '${clientId}',
        'Giulia Rossi',
        'Taglio',
        ((now() AT TIME ZONE 'Europe/Rome') + interval '24 hours')::date,
        ((now() AT TIME ZONE 'Europe/Rome') + interval '24 hours')::time,
        '${status}',
        now() - interval '3 days'
      )
    `);
    return id;
  }

  async function dueIds() {
    await resetSession();
    const result = await db.query<{ rows: Array<{ id: string }> | null }>(`SELECT public.nuvia_whatsapp_due(20) AS rows`);
    const value = result.rows[0]?.rows;
    if (!Array.isArray(value)) return [];
    return value.map((row) => row.id);
  }
});
