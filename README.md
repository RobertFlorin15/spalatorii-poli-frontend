# Spălătorie — Frontend

Aplicație web pentru programarea mașinilor de spălat și uscătoarelor din cămin.

## Funcționalități

- **Lista utilajelor**: vizualizare rapidă a mașinilor de spălat și a uscătoarelor disponibile, cu filtrare și stare în timp real.
- **Programare pe intervale**: tabel interactiv pe intervale de 30 de minute pentru selectarea și rezervarea unui interval.
- **Rezervările mele**: vizualizarea rezervărilor active și a istoricului, cu posibilitatea de anulare sau scurtare a unei rezervări în curs.
- **Panou Administrator**: adăugare/ștergere utilaje, activare/dezactivare și configurarea programului de funcționare și a duratei maxime per rezervare.
- **Temă Light / Dark**: suport complet pentru mod luminos și întunecat.

## Tehnologii

- React 19 + Vite
- Tailwind CSS v4
- Firebase Firestore
- `date-fns`

## Rulare locală

1. Instalează dependențele:
   ```bash
   npm install
   ```

2. Configurează variabilele de mediu într-un fișier `.env` (dacă folosești provider-ul Firestore):
   ```env
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   ```

3. Pornește serverul de dezvoltare:
   ```bash
   npm run dev
   ```
