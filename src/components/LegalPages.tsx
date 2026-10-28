import React, { useEffect } from 'react';
import { Scissors } from 'lucide-react';
import type { PublicLegalPath } from '../lib/publicRoutes';

/**
 * Sostituire con l'email reale del titolare del trattamento prima dei piloti.
 * È l'unico recapito mostrato in Privacy e Termini.
 */
export const LEGAL_CONTACT_EMAIL_PLACEHOLDER = '[inserire-email-titolare]';

const DRAFT_NOTICE =
  'Bozza modello per il titolare del prodotto SalonDesk. Questo testo non è stato revisionato da uno studio legale: va completato (titolare, sede, email) e verificato prima dell’uso con clienti reali.';

interface LegalLinksProps {
  className?: string;
  linkClassName?: string;
}

export const LegalLinks: React.FC<LegalLinksProps> = ({
  className = '',
  linkClassName = 'hover:underline',
}) => (
  <nav className={className} aria-label="Informazioni legali">
    <a href="/privacy" className={linkClassName}>
      Privacy
    </a>
    <span aria-hidden="true">·</span>
    <a href="/termini" className={linkClassName}>
      Termini
    </a>
  </nav>
);

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-bold text-[#1E1B2E]">{title}</h2>
      <div className="space-y-2 text-sm text-slate-600 leading-relaxed">{children}</div>
    </section>
  );
}

export const LegalDocument: React.FC<{ kind: PublicLegalPath }> = ({ kind }) => {
  const isPrivacy = kind === 'privacy';

  useEffect(() => {
    const previous = document.title;
    document.title = isPrivacy ? 'Privacy — SalonDesk' : 'Termini di servizio — SalonDesk';
    return () => {
      document.title = previous;
    };
  }, [isPrivacy]);

  return (
    <div className="min-h-screen bg-[#FDF8FA] text-[#1E1B2E]">
      <header className="bg-white border-b border-pink-100">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <a href="/" className="flex items-center gap-2 font-bold tracking-tight">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#E95F8F] to-[#8B5CF6] text-white flex items-center justify-center">
              <Scissors className="w-4 h-4" />
            </span>
            SalonDesk
          </a>
          <a href="/" className="text-xs font-semibold text-[#8B5CF6] hover:underline">
            Torna all’app
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-bold">Modello in bozza — non è un parere legale</p>
          <p className="mt-1">{DRAFT_NOTICE}</p>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">SalonDesk</p>
          <h1 className="text-2xl font-black tracking-tight mt-1">
            {isPrivacy ? 'Informativa privacy' : 'Termini di servizio'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">Ultimo aggiornamento del modello: 28 ottobre 2026</p>
        </div>

        {isPrivacy ? <PrivacyBody /> : <TermsBody />}

        <LegalLinks
          className="flex items-center gap-2 text-xs text-slate-500 pt-4 border-t border-pink-100"
          linkClassName="font-semibold text-[#8B5CF6] hover:underline"
        />
      </main>
    </div>
  );
};

function PrivacyBody() {
  return (
    <div className="bg-white rounded-2xl border border-pink-100 p-5 md:p-6 space-y-5">
      <Section title="1. Titolare del trattamento">
        <p>
          Il titolare del trattamento dei dati dell’account SalonDesk è il soggetto che pubblica e gestisce
          il servizio. I dati qui sotto sono segnaposto da compilare prima del go-live.
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Nome o ragione sociale: [nome del titolare]</li>
          <li>Sede: [indirizzo completo]</li>
          <li>
            Email di contatto:{' '}
            <span className="font-mono font-semibold">{LEGAL_CONTACT_EMAIL_PLACEHOLDER}</span>
          </li>
          <li>P. IVA / codice fiscale: [se applicabile]</li>
        </ul>
      </Section>

      <Section title="2. Di cosa si occupa SalonDesk">
        <p>
          SalonDesk è un gestionale per saloni di bellezza. Serve a organizzare il salone: anagrafica clienti,
          appuntamenti, servizi, staff e lo stato dell’abbonamento (oggi la prova gratuita; i pagamenti online
          non sono ancora attivi).
        </p>
        <p>
          Per i dati dell’account del salone (email di accesso, impostazioni, prova) il titolare è il soggetto
          indicato sopra. Per i dati dei clienti finali del salone inseriti dal titolare dell’attività, il
          titolare del trattamento è di regola il salone stesso: SalonDesk agisce come responsabile del
          trattamento, su istruzione del salone. Questa ripartizione va confermata dal titolare del prodotto.
        </p>
      </Section>

      <Section title="3. Dati trattati e finalità">
        <p>In base a come usi l’app, possono essere trattati:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Account: email, identificativo utente, ruolo, dati di autenticazione gestiti dal fornitore di login.</li>
          <li>Salone: nome, titolare, telefono, indirizzo, orari, logo.</li>
          <li>Operatività: clienti, appuntamenti, servizi, note e staff che inserisci tu.</li>
          <li>Abbonamento: piano, stato della prova e data di fine prova. Nessun dato di carta è raccolto finché i pagamenti non saranno davvero attivi.</li>
          <li>Dati tecnici di sessione necessari a mantenere l’accesso.</li>
        </ul>
        <p>
          Le finalità sono erogare il gestionale, tenere l’account al sicuro, applicare la prova gratuita e,
          quando esisterà, gestire l’abbonamento. La base giuridica tipica, da confermare, è l’esecuzione del
          contratto (o di misure precontrattuali) e, se richiesto, un obbligo di legge.
        </p>
      </Section>

      <Section title="4. Responsabili del trattamento">
        <p>Per far funzionare l’app il titolare si avvale almeno di questi fornitori:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Supabase — autenticazione e database dell’applicazione.</li>
          <li>Vercel — hosting e distribuzione del sito.</li>
        </ul>
        <p>
          Possono trattare dati anche al di fuori dello Spazio economico europeo, secondo i loro contratti e
          le clausole tipo. Il titolare deve verificare le regioni effettivamente scelte nel progetto e i
          relativi accordi. Un eventuale fornitore di pagamenti sarà indicato qui solo quando sarà collegato
          davvero: oggi non c’è un circuito di pagamento attivo.
        </p>
      </Section>

      <Section title="5. Cookie tecnici">
        <p>
          L’accesso usa cookie o memorizzazione tecnica equivalente per la sessione di autenticazione
          (accesso e rinnovo della sessione). Sono strumenti tecnici necessari al login, non cookie di
          profilazione pubblicitaria. Questa bozza non descrive altri cookie.
        </p>
      </Section>

      <Section title="6. Conservazione">
        <p>
          I dati dell’account e del salone restano per il tempo in cui l’account è attivo e per il periodo
          necessario a obblighi di legge o a difendere un diritto. I tempi esatti li definisce il titolare
          prima della pubblicazione definitiva.
        </p>
      </Section>

      <Section title="7. Diritti: accesso, esportazione, cancellazione">
        <p>Puoi chiedere al titolare, nei limiti di legge:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>accesso ai dati e una copia (esportazione / portabilità, quando applicabile);</li>
          <li>rettifica dei dati inesatti;</li>
          <li>cancellazione;</li>
          <li>limitazione o opposizione al trattamento, nei casi previsti.</li>
        </ul>
        <p>
          Per esercitare i diritti scrivi a{' '}
          <span className="font-mono font-semibold">{LEGAL_CONTACT_EMAIL_PLACEHOLDER}</span>. In questa bozza
          non c’è un pulsante automatico di export o cancellazione: la richiesta si fa via email. Puoi anche
          proporre reclamo all’autorità di controllo (in Italia, il Garante per la protezione dei dati
          personali).
        </p>
      </Section>

      <Section title="8. Contatto">
        <p>
          Email del titolare:{' '}
          <span className="font-mono font-semibold">{LEGAL_CONTACT_EMAIL_PLACEHOLDER}</span>. Sostituiscila
          con un indirizzo presidiato prima di invitare i primi saloni.
        </p>
      </Section>
    </div>
  );
}

function TermsBody() {
  return (
    <div className="bg-white rounded-2xl border border-pink-100 p-5 md:p-6 space-y-5">
      <Section title="1. Servizio">
        <p>
          SalonDesk è un gestionale in cloud per saloni di bellezza: clienti, appuntamenti, servizi e
          impostazioni del salone. L’uso dell’account implica l’accettazione di questi termini e
          dell’informativa privacy.
        </p>
      </Section>

      <Section title="2. Account">
        <p>
          Chi si registra dichiara di poter rappresentare il salone. Le credenziali sono personali. Sei
          responsabile di ciò che inserisci, compresi i dati dei tuoi clienti, e di avere una base valida
          per trattarli.
        </p>
      </Section>

      <Section title="3. Prova gratuita e pagamenti">
        <p>
          I nuovi account includono una prova gratuita di 7 giorni, senza carta. I pagamenti online degli
          abbonamenti a pagamento non sono ancora attivi: finché non verrà comunicata l’attivazione, non
          viene effettuato alcun addebito e nessuna azione nell’app equivale a un pagamento riuscito. Prezzi
          e piani mostrati in interfaccia sono indicativi.
        </p>
      </Section>

      <Section title="4. Uso consentito">
        <p>
          Il servizio va usato per la gestione lecita del salone. Non è consentito caricare dati illeciti,
          tentare di accedere ad account altrui o compromettere la piattaforma.
        </p>
      </Section>

      <Section title="5. Disponibilità">
        <p>
          Il servizio è fornito nello stato in cui si trova, in particolare durante i piloti. Possono esserci
          interruzioni, correzioni e funzioni ancora incomplete. Fai copie dei dati che ti servono per
          l’attività.
        </p>
      </Section>

      <Section title="6. Limitazione di responsabilità">
        <p>
          Nei limiti consentiti dalla legge italiana, il titolare non risponde di mancati guadagni o di danni
          indiretti legati all’uso del gestionale in questa fase. Nulla in questa bozza esclude diritti che
          non si possono rinunciare, inclusi quelli dei consumatori quando applicabili. Il testo definitivo
          va rivisto da un legale.
        </p>
      </Section>

      <Section title="7. Modifiche e legge applicabile">
        <p>
          Il titolare può aggiornare questi termini. La legge applicabile prevista è quella italiana; il foro
          competente va indicato dal titolare nel testo definitivo, nel rispetto delle norme inderogabili.
        </p>
      </Section>

      <Section title="8. Contatto">
        <p>
          Per domande su questi termini:{' '}
          <span className="font-mono font-semibold">{LEGAL_CONTACT_EMAIL_PLACEHOLDER}</span>.
        </p>
      </Section>
    </div>
  );
}
