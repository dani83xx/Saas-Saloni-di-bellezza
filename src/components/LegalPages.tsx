import React, { useEffect } from 'react';
import type { PublicLegalPath } from '../lib/publicRoutes';

/** Recapito privacy mostrato in Privacy e Termini. */
export const LEGAL_CONTACT_EMAIL = 'lookixdigital@outlook.com';

const DRAFT_NOTICE =
  'Bozza modello per il titolare del prodotto Nuvia. Questo testo non è stato revisionato da uno studio legale e va verificato prima dell’uso con clienti reali.';

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

function ContactEmail() {
  return (
    <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="font-mono font-semibold text-[#8B5CF6] hover:underline">
      {LEGAL_CONTACT_EMAIL}
    </a>
  );
}

function ControllerDetails() {
  return (
    <ul className="list-disc pl-5 space-y-1">
      <li>Titolare / ragione sociale: Lookix Digital</li>
      <li>Referente: Daniele Negri</li>
      <li>Sede: Via Spluga 1, Lecco</li>
      <li>
        Email di contatto privacy: <ContactEmail />
      </li>
    </ul>
  );
}

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
    document.title = isPrivacy ? 'Privacy — Nuvia' : 'Termini e condizioni — Nuvia';
    return () => {
      document.title = previous;
    };
  }, [isPrivacy]);

  return (
    <div className="min-h-screen bg-[#FDF8FA] text-[#1E1B2E]">
      <header className="bg-white border-b border-pink-100">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <a href="/" className="flex items-center gap-2 font-bold tracking-tight">
            <span className="w-9 h-9 rounded-xl bg-white border border-purple-100 shadow-sm flex items-center justify-center p-1.5">
              <img src="/nuvia-mark.png" alt="" className="w-full h-full object-contain" />
            </span>
            Nuvia
          </a>
          <a href="/" className="text-xs font-semibold text-[#8B5CF6] hover:underline">
            Torna all’app
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {isPrivacy && (
          <>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <p className="font-bold">Modello in bozza — non è un parere legale</p>
              <p className="mt-1">{DRAFT_NOTICE}</p>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Nuvia</p>
              <h1 className="text-2xl font-black tracking-tight mt-1">Informativa privacy</h1>
              <p className="text-xs text-slate-500 mt-1">Ultimo aggiornamento del modello: 29 ottobre 2026</p>
            </div>
          </>
        )}

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
          Il titolare del trattamento dei dati dell’account Nuvia è Lookix Digital, che pubblica e
          gestisce il servizio.
        </p>
        <ControllerDetails />
      </Section>

      <Section title="2. Di cosa si occupa Nuvia">
        <p>
          Nuvia è un gestionale per saloni di bellezza. Serve a organizzare il salone: anagrafica clienti,
          appuntamenti, servizi, staff e lo stato dell’abbonamento (oggi la prova gratuita; i pagamenti online
          non sono ancora attivi).
        </p>
        <p>
          Per i dati dell’account del salone (email di accesso, impostazioni, prova) il titolare è il soggetto
          indicato sopra. Per i dati dei clienti finali del salone inseriti dal titolare dell’attività, il
          titolare del trattamento è di regola il salone stesso: Nuvia agisce come responsabile del
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

      <Section title="4. Sub-responsabili e luogo dei dati">
        <p>
          I dati dell’applicazione sono ospitati nell’Unione europea, su Supabase nella regione di Francoforte
          (eu-central-1).
        </p>
        <p>Sub-responsabili del trattamento:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Supabase — database e autenticazione.</li>
          <li>Vercel — hosting dell’applicazione.</li>
          <li>Google — accesso con login OAuth.</li>
          <li>Stripe — pagamenti, previsto in futuro e non ancora attivo.</li>
        </ul>
        <p>
          Se un fornitore tratta dati negli Stati Uniti, il trasferimento è coperto dall’EU-US Data Privacy
          Framework e/o dalle clausole contrattuali tipo (SCC).
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
          Per esercitare i diritti scrivi a <ContactEmail />. In questa bozza non c’è un pulsante automatico
          di export o cancellazione: la richiesta si fa via
          email. Puoi anche proporre reclamo all’autorità di controllo (in Italia, il Garante per la
          protezione dei dati personali).
        </p>
      </Section>

      <Section title="8. Contatto">
        <p>
          Email del titolare: <ContactEmail />.
        </p>
      </Section>
    </div>
  );
}

function TermsBody() {
  return (
    <div className="bg-white rounded-2xl border border-pink-100 p-5 md:p-6 space-y-5">
      <header className="space-y-1 border-b border-pink-50 pb-4">
        <h1 className="text-xl md:text-2xl font-black tracking-tight text-[#1E1B2E]">
          TERMINI E CONDIZIONI GENERALI DI CONTRATTO (SaaS B2B)
        </h1>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">NUVIA CRM FOR BEAUTY BUSINESS</p>
        <p className="text-xs text-slate-500">Ultimo aggiornamento: 29 ottobre 2026</p>
      </header>

      <Section title="1. Oggetto del Contratto e Disposizioni Generali">
        <p>
          1.1. I presenti Termini e Condizioni Generali di Servizio (di seguito, "Termini") disciplinano l'accesso e l'utilizzo della piattaforma software in modalità Software-as-a-Service denominata Nuvia crm for beauty business (di seguito, la "Piattaforma" o il "Servizio"), accessibile tramite applicazione web fornita da Lookix Digital di Daniele Negri, con sede legale in Via Spluga 1, Lecco (LC), Codice Fiscale: NGRDLG83M15E507F, email di contatto: lookixdigital@outlook.com (di seguito, il "Fornitore").
        </p>
        <p>
          1.2. Il Servizio è destinato esclusivamente a persone fisiche o giuridiche che operano nell'esercizio della propria attività professionale o commerciale (Clientela B2B), quali saloni di bellezza, acconciatori, centri estetici e operatori del settore wellness. È espressamente esclusa l'applicabilità delle disposizioni del D.lgs. 206/2005 (Codice del Consumo). Il soggetto che stipula il presente accordo in nome e per conto dell'attività commerciale garantisce espressamente di possedere i relativi poteri di rappresentanza legale.
        </p>
      </Section>

      <Section title="2. Registrazione, Credenziali e Gestione dell'Account">
        <p>
          2.1. Per utilizzare Nuvia crm for beauty business, l'Utente deve completare la procedura di registrazione fornendo dati veritieri, completi e costantemente aggiornati.
        </p>
        <p>
          2.2. Le credenziali di autenticazione e accesso (incluse quelle collegate a meccanismi Single Sign-On di terze parti come Google OAuth) hanno natura strettamente personale e riservata. L'Utente è l'unico responsabile della custodia e della riservatezza delle credenziali e risponde di qualunque attività o operazione posta in essere tramite il proprio profilo.
        </p>
        <p>
          2.3. L'Utente si impegna a segnalare tempestivamente al Fornitore qualsiasi perdita di riservatezza, violazione della sicurezza o accesso non autorizzato al proprio account.
        </p>
      </Section>

      <Section title="3. Funzionalità, Periodo di Prova e Piani di Abbonamento">
        <p>
          3.1. Nuvia crm for beauty business eroga servizi software cloud per la gestione operativa del salone (gestione anagrafica clienti, pianificazione appuntamenti, catalogo servizi/trattamenti e coordinamento del personale).
        </p>
        <p>
          3.2. Periodo di Prova Gratuita: L'attivazione iniziale dell'account include una prova gratuita di 7 (sette) giorni, accessibile senza obbligo di inserimento preventivo dei dati di pagamento. Durante la prova non viene effettuato alcun addebito.
        </p>
        <p>
          3.3. Piani a Pagamento e Modalità di Fatturazione: Al termine del periodo di prova, l'accesso continuativo alle funzionalità della Piattaforma è subordinato alla sottoscrizione di un piano di abbonamento. I corrispettivi, le periodicità di fatturazione (mensile o annuale) e le specifiche funzionalità incluse nei vari livelli di servizio sono consultabili all'interno dell'applicazione e vengono riepilogati in modo trasparente prima della conferma del pagamento tramite la piattaforma Stripe Billing. Tutti i corrispettivi si intendono al netto dell'IVA e di eventuali oneri di legge. In assenza di formale sottoscrizione al termine della prova, l'accesso alle funzionalità operative viene sospeso.
        </p>
        <p>
          3.4. Variazione dei Prezzi: Il Fornitore si riserva la facoltà di modificare i corrispettivi dei piani per i cicli di rinnovo successivi, con preavviso di almeno 30 (trenta) giorni comunicato via email o all'interno della Piattaforma.
        </p>
      </Section>

      <Section title="4. Condizioni d'Uso e Obblighi dell'Utente">
        <p>
          4.1. L'Utente si obbliga ad accedere e utilizzare la Piattaforma nel pieno rispetto delle norme di legge vigenti, dell'ordine pubblico e dei presenti Termini.
        </p>
        <p>4.2. È fatto divieto espresso all'Utente di:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Utilizzare il Servizio per scopi non consentiti dalla legge, fraudolenti o lesivi dei diritti di terzi;</li>
          <li>Inserire o elaborare dati personali della propria clientela finale in assenza di un'adeguata base giuridica di trattamento ai sensi del GDPR;</li>
          <li>Compiere attività di reverse engineering, decompilazione, scansione di vulnerabilità o attacchi all'integrità del software, dei server o dei database;</li>
          <li>Cedere a terzi, sublicenziare, noleggiare o rivendere le credenziali di accesso al Servizio al di fuori del personale e collaboratori autorizzati del proprio salone.</li>
        </ul>
      </Section>

      <Section title="5. Proprietà Intellettuale">
        <p>
          Tutti i diritti di proprietà intellettuale e industriale relativi a Nuvia crm for beauty business (a titolo esemplificativo: marchio "Nuvia", codice sorgente, architettura PostgreSQL su Supabase, frontend Vercel, grafiche, marchi e banche dati) sono di titolarità esclusiva del Fornitore. All'Utente viene concessa unicamente una licenza d'uso temporanea, non esclusiva, non cedibile e revocabile per la sola durata del rapporto contrattuale.
        </p>
      </Section>

      <Section title="6. Disponibilità, Manutenzione e Garanzie (As-Is)">
        <p>
          6.1. La Piattaforma viene messa a disposizione "nello stato di fatto e di diritto in cui si trova" (AS-IS e AS-AVAILABLE), con particolare riguardo alle versioni pilota, beta o di test funzionale.
        </p>
        <p>
          6.2. Il Fornitore non assicura che il Servizio sia privo di difetti o interruzioni, né garantisce percentuali minime vincolanti di disponibilità oraria continua (uptime garantito) durante la fase attuale.
        </p>
        <p>
          6.3. Il Fornitore potrà sospendere temporaneamente l'erogazione per eseguire aggiornamenti, interventi tecnici di manutenzione o interventi di sicurezza.
        </p>
        <p>
          6.4. Backup: Fermo restando il meccanismo di replica a livello cloud, l'Utente è tenuto a mantenere una copia autonoma di riserva di tutti i dati operativi rilevanti per la propria continuità aziendale.
        </p>
      </Section>

      <Section title="7. Limitazione di Responsabilità">
        <p>
          7.1. Salvo il caso inderogabile di dolo o colpa grave ai sensi dell'art. 1229 c.c., il Fornitore risponde unicamente per i danni diretti ed effettivi causati all'Utente.
        </p>
        <p>
          7.2. È categoricamente esclusa qualsiasi responsabilità del Fornitore per danni indiretti, perdita di fatturato, perdita di clienti, interruzione dell'attività economica o corruzione e perdita accidentale di dati inseriti dall'Utente.
        </p>
        <p>
          7.3. La responsabilità economica complessiva del Fornitore verso l'Utente non potrà comunque eccedere l'importo totale effettivamente corrisposto dall'Utente nei 12 (dodici) mesi precedenti l'evento dannoso (oppure la somma forfettaria massima di € 100,00 qualora l'evento si verifichi nel corso del periodo di prova gratuita).
        </p>
      </Section>

      <Section title="8. Manleva">
        <p>
          L'Utente terrà indenne e manleverà il Fornitore e i suoi partner tecnologici da qualsiasi pretesa, sanzione pecuniaria, onere o richiesta risarcitoria avanzata da terzi (ivi compresi i clienti finali del salone o l'Autorità Garante Privacy) originata dal trattamento illecito dei dati caricati dall'Utente o da una violazione dei presenti Termini.
        </p>
      </Section>

      <Section title="9. Modifiche Contrattuali">
        <p>
          Il Fornitore si riserva la facoltà di apportare modifiche ai presenti Termini. Le variazioni verranno notificate via email o mediante avviso in applicazione. La prosecuzione nell'uso della Piattaforma costituirà integrale accettazione delle nuove condizioni contrattuali.
        </p>
      </Section>

      <Section title="10. Legge Applicabile e Foro Competente">
        <p>10.1. I presenti Termini sono disciplinati in via esclusiva dalla Legge Italiana.</p>
        <p>
          10.2. Per qualunque controversia relativa alla validità, interpretazione, esecuzione o risoluzione del presente accordo, le parti stabiliscono la competenza territoriale esclusiva del Foro di Lecco.
        </p>
      </Section>

      <Section title="ALLEGATO A — ACCORDO DI NOMINA A RESPONSABILE DEL TRATTAMENTO (DPA - ART. 28 GDPR)">
        <p>
          L'accettazione dei Termini comporta la stipula e la piena efficacia vincolante del presente Accordo tra l'Utente (Titolare) e Lookix Digital (Responsabile).
        </p>
        <p>
          1. Ripartizione dei Ruoli: Rispetto ai dati personali dei clienti finali e dei collaboratori inseriti sulla Piattaforma (appuntamenti, numeri di telefono, storico trattamenti, note operative), l'Utente assume il ruolo di Titolare del Trattamento, mentre il Fornitore agisce in veste di Responsabile del Trattamento (Art. 28 GDPR).
        </p>
        <p>
          2. Istruzioni del Titolare: Il Responsabile tratta tali dati unicamente sulla base delle istruzioni documentate dell'Utente e al solo fine di fornire le funzioni gestionali di Nuvia crm for beauty business.
        </p>
        <p>
          3. Misure di Sicurezza: Il Responsabile attua misure tecniche e organizzative proporzionate al rischio ex art. 32 GDPR (traffico crittografato HTTPS/TLS, cifratura a riposo nei database Supabase PostgreSQL collocati in Germania presso la regione AWS eu-central-1, segregazione dei dati e controllo accessi).
        </p>
        <p>4. Sub-responsabili autorizzati: Il Titolare autorizza espressamente il ricorso ai seguenti sub-fornitori:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Supabase Inc.: Database e logiche backend con data center ubicato nello Spazio Economico Europeo (Francoforte, Germania, eu-central-1) e servizio Supabase Auth.</li>
          <li>Vercel Inc.: Hosting dell'infrastruttura frontend della Piattaforma.</li>
          <li>Google LLC: Fornitore del servizio di Single Sign-On (Google Login).</li>
          <li>Stripe Payments Europe, Ltd.: Gateway di elaborazione pagamenti e fatturazione Stripe Billing.</li>
        </ul>
        <p>
          5. Cancellazione al termine: A seguito della chiusura dell'account, il Responsabile procederà alla cancellazione definitiva o all'esportazione dei dati della clientela su richiesta del Titolare, fatti salvi i termini di conservazione previsti dalla legge.
        </p>
      </Section>
    </div>
  );
}
