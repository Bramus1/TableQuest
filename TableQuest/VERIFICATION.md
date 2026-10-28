# Verifica TableQuest · 27 ottobre 2026

## Risultati

- Compilazione TypeScript e build Vite/PWA completate.
- 6 test unitari passati: ordinamento iniziativa, parità, avanzamento/ritorno turno, round e limiti dell’indicatore HP.
- 40 verifiche PostgreSQL/PGlite passate usando le migrazioni reali: ruoli, campagne, inviti, privacy, HP, condizioni, risorse, combattimenti, inventario, valuta, operazioni idempotenti e permessi del trigger profilo.
- 4 flussi browser passati su layout desktop e telefono: registrazione/login, campagna, personaggio, HP, risorse, sessione, combattimento, diario, trasferimenti, logout, inviti, messaggi privati e blocco delle modifiche offline. Questi test usano un trasporto Auth/HTTP di prova con il vero schema PostgreSQL.
- 2 verifiche della build PWA passate: manifest, service worker attivo e ricaricamento della pagina senza rete, su desktop e telefono emulato.

## Backend reale

Progetto **TableQuest** `mvwxtjmcrzjvmnejwdwt`, organizzazione **Bramus1**, regione Parigi. BandHub non è stato modificato.

Tre identità temporanee, predisposte già confermate nel solo database di TableQuest, hanno verificato tramite le vere API Supabase:

1. Login email/password con tre client separati.
2. Creazione della campagna e ingresso tramite invito.
3. Impossibilità per il giocatore di leggere le statistiche nemiche riservate.
4. Ricezione di un cambio turno tramite WebSocket Supabase Realtime.
5. Consegna Realtime del messaggio privato al destinatario; nessun accesso per l’altro giocatore.
6. Rifiuto di un’operazione riservata al DM.
7. Conclusione della sessione.

Un controllo aggiuntivo ha aperto l’app reale in Edge, senza intercettare o simulare le API: il cambio turno è comparso nel browser senza refresh in circa **919 ms**, seguito dalla notifica e dalla lettura del messaggio privato. Nessun errore JavaScript rilevato. Gli account e le campagne temporanei sono stati eliminati dopo la verifica.

## Limiti della verifica

Non sono stati verificati l’invio delle email di conferma tramite SMTP né l’installazione su dispositivi iOS/Android fisici. Frontend pubblicato su https://tablequest-seven.vercel.app, deployment `dpl_GzsLYRnK7wPWzKvZUsPpr2SQXCkd` in stato READY. Verificati HTTP 200 per pagina principale, rotta /combat e manifest PWA senza autenticazione Vercel. Impostazioni Auth degli URL, SMTP e passaggi di pubblicazione sono nel README. Le regole di gioco restano a gestione manuale: nessun motore automatico di regole D&D o scadenza automatica delle condizioni.

Gli avvisi Supabase rimasti riguardano le funzioni SECURITY DEFINER intenzionalmente esposte con controlli espliciti di autorizzazione e la protezione opzionale contro password compromesse non abilitata. I relativi collegamenti di approfondimento sono nel README.

## Aggiornamento calendario

Pubblicato il calendario della campagna: deployment `dpl_CGwkSbCFJdmC6jMnQe3Tix7Df68K`, stato READY. Verificati HTTP 200 della rotta /calendar e del nuovo modulo JavaScript sul dominio pubblico. Migrazione applicata al solo progetto TableQuest.

45 test database passati, inclusi isolamento fra campagne, proprietario della risposta, blocco scritture dirette, ripetizione idempotente e validazione orari. TypeScript, build PWA e 6 test unitari passati. Due flussi browser desktop/mobile passati con salvataggio disponibilità, persistenza dopo reload e navigazione mensile, seguiti dai flussi esistenti di personaggio, combattimento e inventario. Il trasporto di prova è stato aggiornato per riprodurre il formato date PostgreSQL delle API Supabase. La sincronizzazione Realtime della nuova tabella è configurata ma non è stata ripetuta una prova con due account sul backend ospitato.

## Dettatura vocale · 28 ottobre 2026

Pubblicata su Vercel la build `dpl_BPAjSkQn9NUaDz7jdU2Y9X58JeLE` (READY). Nel sito pubblico Edge mostra il pulsante Detta nel modulo di registrazione senza errori JavaScript; nessun microfono è stato attivato durante questa verifica.

TypeScript e build PWA riusciti. I tre casi browser sono passati sia in desktop sia in mobile: fallback alla tastiera senza SpeechRecognition; inviti/messaggi e comportamento offline; registrazione e calendario con trascrizione simulata, deduplicazione dei risultati, testo esistente conservato, arresto e permesso negato, più i flussi personaggio/combattimento/inventario. Il primo processo combinato è stato interrotto perché rimasto bloccato dopo i casi desktop; i casi mobile sono stati eseguiti separatamente. I test simulano il servizio SpeechRecognition: qualità della trascrizione audio reale e supporto sui telefoni fisici restano da verificare. Il browser può usare un servizio remoto; TableQuest conserva soltanto il testo salvato dall’utente.

## Personaggi, calendario e mostri · 28 ottobre 2026

Pubblicato il deployment `dpl_8hjaYpAQ2s2aaC1WXBjtpQ2Q313n`, stato READY, sul dominio pubblico TableQuest. Migrazione applicata esclusivamente al progetto TableQuest: velocità convertite in feet, bestiario privato del DM, validazione ritratti e recupero completo HP nel riposo lungo.

49 test database passati, TypeScript e build PWA riusciti. Il flusso browser esteso è passato separatamente su desktop e mobile: caricamento foto, velocità in feet, recupero HP, assenza dello stato nei tre tipi richiesti, calendario senza riepilogo vuoto e con giorni evidenziati, creazione e inserimento mostri in combattimento. Su mobile è stata corretta la sincronizzazione del test inventario attendendo la chiusura del modulo prima di cambiare scheda. I test usano il backend simulato con migrazioni SQL; non sono stati modificati i dati reali degli utenti per le prove.
