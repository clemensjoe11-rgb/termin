# Lokale Kontakt + RDV Website

## Start
1. `cp .env.sample .env` und SMTP/ADMIN_EMAIL ausfüllen.
2. `npm i`
3. `npm start`
4. Browser: http://localhost:3000

## Features
- Kontakt-Section.
- Button "Nehmen Sie sich ein RDV" blendet Termintabelle ein.
- Termin wählen, E-Mail eingeben, Buchung absenden.
- Bestätigungs-Mail an Nutzer, Admin-Mail an ADMIN_EMAIL.
- Slots sind in-memory (beim Neustart neu generiert).