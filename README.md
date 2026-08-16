# quatsch.pro

Mobile-first Web-App fuer Sprach-, Text- und Bilduebersetzung. Der Produktionsbetrieb besteht aus einem einzelnen Node/Express-Dienst, der die gebaute React-App und die geschuetzte API unter derselben Domain ausliefert.

## Funktionen

- Texteingabe und automatische Erkennung der Ausgangssprache
- Sprachaufnahme ueber die Browser Speech Recognition API
- Einweg- und Dialoguebersetzung
- Bild-OCR mit anschliessender Uebersetzung
- Vorlesen mit Browserstimmen und serverseitigem TTS-Fallback
- Lokaler Verlauf, Einstellungen und installierbare PWA
- Health Checks, Rate Limits, strukturierte Logs und kontrolliertes Herunterfahren

## Lokal starten

```bash
cp .env.example .env
npm ci
npm run build
OPENAI_API_KEY=... npm start
```

Die App ist danach unter `http://localhost:3000` erreichbar. Der Health Check liegt unter `http://localhost:3000/healthz`.

## Pruefen

```bash
npm run check
docker build -t quatsch-pro .
```

Alle geheimen Werte werden als Umgebungsvariablen gesetzt. `.env`-Dateien, PocketBase-Livedaten und exportierte Datenbanken duerfen nicht committed werden.

Weitere Betriebs- und Rollback-Schritte stehen in [DEPLOYMENT.md](DEPLOYMENT.md).
