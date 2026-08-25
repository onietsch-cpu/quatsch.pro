# Produktionsbetrieb

## Architektur

Ein Railway Persistent Service baut den Root-`Dockerfile` aus GitHub. Der Container liefert Frontend und API auf dem von Railway gesetzten `PORT` aus. Die Anwendung ist stateless: Verlauf und Einstellungen bleiben im Browser, deshalb ist fuer den aktuellen Funktionsumfang weder PocketBase noch Supabase erforderlich.

Railway ist der einzige Produktions-, Domain-, Deployment-, Log- und Rollback-Pfad. Vercel ist nicht Teil der Laufzeit, der Vorschau, des Fallbacks oder der Abnahme. Die produktiven Domains `quatsch.pro` und `www.quatsch.pro` zeigen ausschliesslich auf den Railway-Dienst.

## Deployment-Pipeline

1. Aenderungen auf einem separaten Branch implementieren und durch einen Pull Request pruefen.
2. GitHub Actions fuehrt Installation, Produktions-Audit, Lint, Tests, Vite-Build und Docker-Build aus.
3. Nur einen gruenen, konfliktfreien Pull Request nach `main` mergen.
4. Railway `Wait for CI` wartet auf den erfolgreichen GitHub-Actions-Check des neuen `main`-Commits. Bei fehlgeschlagener CI darf kein Produktionsdeployment starten.
5. Railway baut den Root-`Dockerfile` und aktiviert das Deployment erst, wenn `/healthz` HTTP 200 liefert.
6. Danach Domains, Kernfunktionen, HTTP-Logs und Rollback-Bereitschaft pruefen.

GitHub-Statusmeldungen anderer Hosting-Plattformen sind nicht Teil dieser Pipeline und duerfen nicht als erforderliche Merge- oder Deployment-Bedingung konfiguriert werden.

## Erforderliche Variablen

In Railway unter `Service > Variables` setzen:

| Variable | Wert |
| --- | --- |
| `OPENAI_API_KEY` | geheimer API-Schluessel, niemals als Build-Argument oder GitHub-Secret im Frontend |
| `OPENAI_API_BASE_URL` | `https://api.openai.com/v1` |
| `OPENAI_TRANSLATION_MODEL` | `gpt-4.1-mini` oder ein im Konto freigeschaltetes kompatibles Text-/Vision-Modell |
| `OPENAI_TTS_MODEL` | `tts-1` |
| `CORS_ORIGIN` | `https://quatsch.pro,https://www.quatsch.pro` |

`PORT` und `NODE_ENV` werden von Railway beziehungsweise dem Container gesetzt.

## Kein Ruhemodus

Railway `Serverless` (frueher App Sleeping) muss fuer den Produktionsdienst ausgeschaltet sein:

1. [Railway Dashboard](https://railway.com/dashboard) oeffnen und den Dienst fuer `quatsch.pro` waehlen.
2. `Settings > Deploy > Serverless` auf **Disabled** stellen.
3. Unter `Deployments` neu deployen.

Dies ist eine Kontoeinstellung und kann nicht verlaesslich durch `railway.json` erzwungen werden. Ein externer Keep-alive-Ping ist kein Ersatz fuer die deaktivierte Schlafoption.

## Verifikation nach Deployment

```bash
curl --fail --silent --show-error https://quatsch.pro/healthz
curl --fail --silent --show-error https://quatsch.pro/hcgi/api/health
```

Danach im Browser pruefen:

1. Textuebersetzung in zwei Sprachrichtungen
2. Dialogmodus auf Mobilgeraet: Aufnahme nur nach explizitem Tastendruck, kein automatischer Richtungswechsel
3. Bildaufnahme beziehungsweise Upload bis 8 MiB mit OCR und manueller Wiederholung nach einem Fehler
4. Vorlesen und Browser-Neuladen
5. PWA-Installation und Verlauf/Einstellungen

Der Health Check bestaetigt Prozessbereitschaft und zeigt nur an, ob ein Provider konfiguriert ist; er gibt keine Zugangsdaten aus.

## Stabilitaet

- Railway `Wait for CI` verhindert Deployments nach fehlgeschlagenen GitHub-Actions-Checks.
- Railway prueft `/healthz` vor der Aktivierung eines Deployments.
- Bei Prozessfehlern erfolgen hoechstens zehn kontrollierte Neustarts.
- Alte und neue Version ueberlappen 20 Sekunden; SIGTERM erhaelt 15 Sekunden Drain-Zeit.
- Upstream-Aufrufe haben ein 45-Sekunden-Timeout und maximal zwei Wiederholungen bei Netzwerk-, Rate-Limit- oder 5xx-Fehlern.
- Requests erhalten eine `X-Request-Id`, die in Fehlerantworten und Logs korreliert werden kann.

## Rollback

Im Railway-Deployment-Verlauf die letzte bestaetigte Version waehlen und `Rollback` ausfuehren. Alternativ den Pull Request rueckgaengig machen und `main` neu deployen. Da die App keine serverseitige Migration ausfuehrt, ist der Code-Rollback datenbankunabhaengig.

## Supabase

Supabase wird erst benoetigt, wenn Verlauf, Konten oder geteilte Daten geraeteuebergreifend gespeichert werden sollen. Dann ist vor jeder Umsetzung das konkrete Supabase-Projekt zu bestaetigen; Schema, RLS, Indizes und Rollback werden als versionierte Migrationen angelegt.
