# Stripe Billing (modalità test) — Nuvia

Le chiavi non stanno nel repository. Le Edge Functions leggono i secret dall’ambiente Supabase. Il progetto è `izbhxyhepzwsgobtihfc`.

Esegui prima lo SQL in `supabase/migrations/20261101120000_salon_stripe_billing.sql` (oppure la versione estesa di `20261031220000_salon_plan.sql` se non l’hai ancora applicata). Senza quelle colonne il checkout non può salvare il cliente Stripe.

## 1. Secret

Dalla cartella del repo, con la CLI collegata al progetto:

```bash
supabase secrets set \
  STRIPE_SECRET_KEY=sk_test_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  APP_URL=https://saas-saloni-di-bellezza.vercel.app \
  --project-ref izbhxyhepzwsgobtihfc
```

- `STRIPE_SECRET_KEY`: chiave segreta di **test** (Stripe → Sviluppatori → Chiavi API). Non usare `sk_live`.
- `STRIPE_WEBHOOK_SECRET`: signing secret dell’endpoint creato al punto 3 (`whsec_...`).
- `APP_URL`: origine dell’app, senza slash finale. In checkout e portale, se il browser manda l’header `Origin`, quello ha la precedenza; `APP_URL` serve quando l’header manca.

`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` le inserisce Supabase da solo sulle funzioni. Non copiarle nel codice.

In locale puoi usare `APP_URL=http://localhost:5173`.

## 2. Pubblicare le funzioni

CLI:

```bash
supabase functions deploy create-checkout-session --project-ref izbhxyhepzwsgobtihfc
supabase functions deploy create-portal-session --project-ref izbhxyhepzwsgobtihfc
supabase functions deploy stripe-webhook --no-verify-jwt --project-ref izbhxyhepzwsgobtihfc
```

`supabase/config.toml` ha già `verify_jwt = false` solo per `stripe-webhook`. Stripe non manda il JWT di Supabase: la funzione controlla `Stripe-Signature` con `STRIPE_WEBHOOK_SECRET`.

Da dashboard: Edge Functions → crea/aggiorna le tre funzioni incollando il codice in `supabase/functions/<nome>/index.ts` (e i file in `supabase/functions/_shared`). Su `stripe-webhook` disattiva **Enforce JWT verification**.

## 3. Webhook Stripe (test)

Stripe → Sviluppatori → Webhook → Aggiungi endpoint.

URL:

```text
https://izbhxyhepzwsgobtihfc.supabase.co/functions/v1/stripe-webhook
```

Eventi da selezionare:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

Copia il signing secret in `STRIPE_WEBHOOK_SECRET` e ridistribuisci non è necessario: i secret sono letti a runtime. Se la funzione era già avviata, il nuovo secret vale dalla richiesta successiva.

## 4. Customer Portal (test)

Stripe → Impostazioni → Billing → Customer portal.

Attiva il portale in **modalità test**. Consenti al cliente di:

- aggiornare il metodo di pagamento
- vedere e scaricare le fatture
- annullare l’abbonamento

Salva. Senza questo passaggio, «Gestisci abbonamento» e «Apri fatture nel portale» rispondono con un errore Stripe.

## 5. Prezzi già collegati

Gli ID di test sono in `supabase/functions/_shared/pricing.ts` (riusati dall’app):

| Piano | Intervallo | Price ID |
| --- | --- | --- |
| BASE | mensile 39 € | `price_1UWtw2FoM4I9wzRcCxs1O8aY` |
| BASE | annuale 390 € | `price_1UWuHNFoM4I9wzRcNh8kZ1Sn` |
| PRO | mensile 69 € | `price_1UWtxCFoM4I9wzRc8Fri9T7i` |
| PRO | annuale 590 € | `price_1UWuTjFoM4I9wzRc68LYs0k7` |

Checkout: `mode=subscription`, tasse automatiche spente, indirizzo di fatturazione obbligatorio, raccolta Partita IVA / tax ID per il B2B italiano.

## 6. Prova

1. Accedi con un titolare reale (non la demo).
2. Impostazioni → Abbonamento → Attiva piano.
3. Paga con una carta di test, per esempio `4242 4242 4242 4242`.
4. Torni su `/?billing=success`: toast di conferma e, dopo il webhook, piano e stato sul salone.
5. «Gestisci abbonamento» apre il portale. Annullare il pagamento torna con `/?billing=cancel` e il toast «Nessun addebito».
