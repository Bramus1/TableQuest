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

Non sono stati verificati l’invio delle email di conferma tramite SMTP né l’installazione su dispositivi iOS/Android fisici. Il frontend non è ancora pubblicato su Vercel. Impostazioni Auth degli URL, SMTP e passaggi di pubblicazione sono nel README. Le regole di gioco restano a gestione manuale: nessun motore automatico di regole D&D o scadenza automatica delle condizioni.

Gli avvisi Supabase rimasti riguardano le funzioni SECURITY DEFINER intenzionalmente esposte con controlli espliciti di autorizzazione e la protezione opzionale contro password compromesse non abilitata. I relativi collegamenti di approfondimento sono nel README.
