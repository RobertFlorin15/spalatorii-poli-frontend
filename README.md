# Laundry — Frontend

Web application for scheduling washing machines and dryers in student dorms.

## Features

- **Equipment List**: quick overview of available washing machines and dryers, with filtering and real-time status.
- **Time-Slot Scheduling**: interactive 30-minute time-slot table for selecting and reserving slots.
- **My Bookings**: view active bookings and history, with options to cancel or shorten an ongoing reservation.
- **Admin Panel**: add/delete equipment, enable/disable machines, and configure operating hours as well as maximum booking duration.
- **Light / Dark Theme**: full support for light and dark modes.

## Tech Stack

- React 19 + Vite
- Tailwind CSS v4
- Firebase Firestore
- `date-fns`

## Local Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables in a `.env` file (if using the Firestore provider):
   ```env
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```
