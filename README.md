# CE Translator – KI-Übersetzungs-App

Eine mobile-first Progressive Web App (PWA) für bidirektionale Echtzeit-Übersetzung mit Spracheingabe, Sprachausgabe und Foto-Übersetzung.

## Features

- **Texttranslation** – 70+ Sprachen, automatische Spracherkennung
- **Spracheingabe** – Web Speech Recognition API (Mikrofon)
- **Sprachausgabe** – Browser Speech Synthesis mit sprachspezifischen Stimmen
- **Dialogmodus** – Bidirektionale Konversation für 2 Personen
- **Foto-Übersetzer** – OCR + Übersetzung via OpenAI Vision API
- **Verlauf** – Letzte 20 Übersetzungen (lokal gespeichert)
- **PWA** – Offline-Support, installierbar auf iOS/Android/Desktop
- **Dark/Light/System** Theme

## Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Express.js 5 + Node.js 22
- **KI**: OpenAI GPT-4o (Übersetzung + OCR) + TTS
- **Datenbank**: PocketBase (für Bild-Uploads)

## Lokale Entwicklung

```bash
# Abhängigkeiten installieren
npm install

# Umgebungsvariablen konfigurieren
cp apps/api/.env.example apps/api/.env
# .env bearbeiten: INTEGRATED_AI_API_KEY=sk-...

# Dev-Server starten
npm run dev
```

App läuft auf: http://localhost:3000  
API läuft auf: http://localhost:3001

## Deployment

- **Vercel**: Siehe [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md)
- **Heroku**: Siehe [HEROKU_DEPLOYMENT.md](HEROKU_DEPLOYMENT.md)

## Umgebungsvariablen

| Variable | Beschreibung | Erforderlich |
|----------|-------------|--------------|
| `INTEGRATED_AI_API_KEY` | OpenAI API-Key | ✅ |
| `INTEGRATED_AI_API_URL` | OpenAI API URL | ✅ |
| `OPENAI_TTS_MODEL` | TTS-Modell (tts-1) | Optional |
| `CORS_ORIGIN` | App-URL für CORS | ✅ |
| `NODE_ENV` | production/development | ✅ |

## Lizenz

Privat / Proprietär – C-Experts
