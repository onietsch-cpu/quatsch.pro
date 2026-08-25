# quatsch.pro

Mobile-first Web-App fuer Sprach-, Text- und Bilduebersetzung. Der Produktionsbetrieb besteht aus einem einzelnen Node/Express-Dienst, der die gebaute React-App und die geschuetzte API unter derselben Domain ausliefert.

## Funktionen

- Texteingabe und automatische Erkennung der Ausgangssprache
- Sprachaufnahme ueber die Browser Speech Recognition API
- Einweguebersetzung mit wechselbarer Zielsprache und manueller Wiederholung bei Fehlern
- Manuell gesteuerter Dialogmodus ohne automatische Mikrofonaktivierung oder Richtungswechsel
- Bild-OCR bis 8 MiB mit anschliessender Uebersetzung und manueller Wiederholung
- Vorlesen mit Browserstimmen und serverseitigem TTS-Fallback
- Lokaler Verlauf, Einstellungen und installierbare PWA
- Health Checks, Rate Limits, strukturierte Logs und kontrolliertes Herunterfahren

## Produktionspfad

Railway ist der einzige Produktions-, Domain-, Deployment-, Log- und Rollback-Pfad. Vercel ist weder Laufzeitziel noch Preview- oder Fallback-Plattform fuer dieses Repository.

Aenderungen durchlaufen einen Pull Request und GitHub Actions. Nach erfolgreicher CI wird nach `main` gemergt. Railway wartet mit `Wait for CI` auf den erfolgreichen `main`-Check, baut danach den Root-`Dockerfile`, aktiviert die neue Version erst nach erfolgreichem `/healthz`-Check und behaelt die vorherige Version als Rollback-Ziel.

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

Alle geheimen Werte werden als Umgebungsvariablen gesetzt. `.env`-Dateien, PocketBase-Livedaten und exportierte Datenbanken duerfen nicht committed werden. Der aktuelle Produktionspfad verwendet weder PocketBase noch Supabase.

Weitere Betriebs- und Rollback-Schritte stehen in [DEPLOYMENT.md](DEPLOYMENT.md).
