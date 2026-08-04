# CE Translator – Vercel-Deployment-Anleitung

Diese Anleitung erklärt Schritt für Schritt, wie du die CE Translator App auf Vercel deployst.
Sie ist für Nicht-Techniker geschrieben und vollständig auf Deutsch.

---

## Was du brauchst

- Einen **Vercel-Account** (kostenlos unter https://vercel.com)
- Einen **GitHub-Account** (kostenlos unter https://github.com)
- Deinen **OpenAI API-Key** (https://platform.openai.com/api-keys)
- Den **Code** dieser App (als ZIP oder Git-Repository)

---

## Schritt 1 – GitHub-Konto erstellen und Code hochladen

### 1a. GitHub-Konto erstellen (falls noch nicht vorhanden)
1. Gehe zu https://github.com/signup
2. Gib E-Mail-Adresse, Passwort und Benutzernamen ein
3. Bestätige deine E-Mail-Adresse

### 1b. Neues Repository erstellen
1. Klicke oben rechts auf **„+"** → **„New repository"**
2. Gib einen Namen ein, z.B. `ce-translator`
3. Wähle **„Private"** (empfohlen)
4. Klicke auf **„Create repository"**

### 1c. Code hochladen
Öffne einen Terminal im Projektordner (`public_html`) und führe aus:

```bash
git init
git add .
git commit -m "Initial commit – CE Translator"
git branch -M main
git remote add origin https://github.com/DEIN-USERNAME/ce-translator.git
git push -u origin main
```

> Ersetze `DEIN-USERNAME` mit deinem GitHub-Benutzernamen.

---

## Schritt 2 – Vercel-Konto erstellen

1. Gehe zu https://vercel.com/signup
2. Wähle **„Continue with GitHub"** (einfachste Option)
3. Erlaube Vercel den Zugriff auf dein GitHub-Konto
4. Du bist jetzt in deinem Vercel-Dashboard

---

## Schritt 3 – Projekt zu Vercel hinzufügen

1. Klicke auf **„Add New…"** → **„Project"**
2. Wähle dein GitHub-Repository `ce-translator` aus der Liste
3. Klicke auf **„Import"**
4. Vercel erkennt das Projekt automatisch

### Einstellungen auf der Import-Seite:
| Einstellung | Wert |
|-------------|------|
| Framework Preset | **Other** |
| Root Directory | _(leer lassen)_ |
| Build Command | `npm install && npm run build --workspace apps/web` |
| Output Directory | `dist/apps/web` |
| Install Command | `npm install` |

---

## Schritt 4 – Umgebungsvariablen setzen (wichtig!)

Bevor du auf **„Deploy"** klickst, scrolle nach unten zu **„Environment Variables"**.

Füge diese Variablen ein:

| Name | Wert | Beschreibung |
|------|------|--------------|
| `INTEGRATED_AI_API_KEY` | `sk-...` | Dein OpenAI API-Key |
| `INTEGRATED_AI_API_URL` | `https://api.openai.com/v1` | OpenAI API URL |
| `OPENAI_TTS_MODEL` | `tts-1` | Text-to-Speech Modell |
| `CORS_ORIGIN` | `https://DEINE-APP.vercel.app` | Deine Vercel-URL (nach dem ersten Deploy eintragen) |
| `NODE_ENV` | `production` | Produktionsmodus |

> **Hinweis:** Den Wert für `CORS_ORIGIN` kennst du erst nach dem ersten Deployment. Setze ihn danach in den Projekt-Einstellungen unter **Settings → Environment Variables**.

---

## Schritt 5 – Deployen

1. Klicke auf **„Deploy"**
2. Vercel baut und deployt die App automatisch (dauert 2–4 Minuten)
3. Du siehst eine URL wie: `https://ce-translator-xyz.vercel.app`
4. Klicke auf die URL, um die App zu öffnen 🎉

---

## Schritt 6 – CORS-Variable nachträglich setzen

Nach dem ersten Deployment:
1. Gehe zu deinem Projekt in Vercel
2. Klicke auf **„Settings"** → **„Environment Variables"**
3. Bearbeite `CORS_ORIGIN` und gib deine tatsächliche Vercel-URL ein  
   (z.B. `https://ce-translator-xyz.vercel.app`)
4. Gehe zu **„Deployments"** und klicke auf **„Redeploy"**, damit die Änderung wirksam wird

---

## Schritt 7 – App testen

### 7a. Health-Check im Browser
Öffne: `https://DEINE-APP.vercel.app/api/health`  
→ Erwartet: `{"status":"ok"}` oder ähnliches

### 7b. Status prüfen
Öffne: `https://DEINE-APP.vercel.app/api/status`  
→ Zeigt detaillierte Informationen über Backend-Dienste

### 7c. Übersetzung testen
Öffne die App unter deiner Vercel-URL und:
- Gib einen deutschen Satz ein
- Wähle eine Zielsprache (z.B. Englisch)
- Klicke auf **„Übersetzen"**
- Teste auch die Spracheingabe und Sprachausgabe

### 7d. Foto-Übersetzer testen
- Lade ein Bild mit Text hoch
- Prüfe, ob der Text erkannt und übersetzt wird

---

## Automatisches Deployment bei Git Push

Vercel deployt die App automatisch bei jedem `git push`:

```bash
# Änderungen vornehmen ...
git add .
git commit -m "Meine Änderung"
git push origin main
```

→ Vercel erkennt den Push und startet automatisch einen neuen Build.

---

## PocketBase (Datenbank) auf Vercel

> ⚠️ **Wichtiger Hinweis:** Vercel Serverless Functions haben **kein persistentes Dateisystem**.
> PocketBase (SQLite-Datenbank) kann daher **nicht direkt auf Vercel** betrieben werden.

### Was bedeutet das für CE Translator?
- Die **Übersetzungsfunktion** funktioniert vollständig ohne Datenbank ✅
- Der **Verlauf** wird im Browser-LocalStorage gespeichert ✅
- Die **Spracheingabe und -ausgabe** funktionieren vollständig ✅
- Der **Foto-Übersetzer** verarbeitet Bilder im Arbeitsspeicher (kein Storage nötig) ✅

### Wenn du eine persistente Datenbank benötigst:

**Option A: PocketBase auf einem eigenen Server (empfohlen)**
1. Miete einen günstigen VPS (z.B. Hetzner, DigitalOcean ab ~$4/Monat)
2. Installiere PocketBase auf dem VPS
3. Setze `POCKETBASE_URL` in Vercel auf die URL deines PocketBase-Servers

**Option B: Railway.app**
- Deploye PocketBase auf https://railway.app (hat kostenlosen Tier)
- Volumen-Storage für SQLite-Daten

**Option C: Hostinger Horizons (dieser Dienst)**
- Verwende Hostinger Horizons statt Vercel (alles inklusive, kein Extra-Setup)

---

## Umgebungsvariablen – Komplette Übersicht

| Variable | Beschreibung | Erforderlich | Beispiel |
|----------|-------------|--------------|---------|
| `INTEGRATED_AI_API_KEY` | OpenAI API-Key für Übersetzung und TTS | ✅ Ja | `sk-abc123...` |
| `INTEGRATED_AI_API_URL` | OpenAI API Basis-URL | ✅ Ja | `https://api.openai.com/v1` |
| `OPENAI_TTS_MODEL` | TTS-Modell (Sprachausgabe) | Optional | `tts-1` |
| `CORS_ORIGIN` | Deine App-URL für CORS | ✅ Ja | `https://meine-app.vercel.app` |
| `NODE_ENV` | Umgebungsmodus | ✅ Ja | `production` |
| `POCKETBASE_URL` | PocketBase-Server URL | Optional | `https://pb.meinserver.de` |

---

## Häufige Probleme

### Problem: „Function Timeout" bei der Übersetzung
Vercel Free-Tier hat ein 10-Sekunden-Limit für Serverless Functions.  
→ **Lösung:** Upgrade auf Vercel Pro ($20/Monat) für 60-Sekunden-Limit.  
→ **Alternative:** Hostinger Horizons oder Heroku für längere Timeouts.

### Problem: „504 Gateway Timeout"
Die OpenAI API hat länger als erwartet gebraucht.  
→ Prüfe deinen OpenAI API-Status: https://status.openai.com  
→ Prüfe dein OpenAI-Guthaben: https://platform.openai.com/usage

### Problem: CORS-Fehler im Browser
`CORS_ORIGIN` ist nicht korrekt gesetzt.  
→ Setze `CORS_ORIGIN` auf deine genaue Vercel-URL (mit `https://`, ohne Schrägstrich am Ende)  
→ Führe ein Redeploy durch

### Problem: Seite lädt, Übersetzung funktioniert nicht
→ Prüfe die Browser-Konsole (F12) auf Fehlermeldungen  
→ Prüfe `https://DEINE-APP.vercel.app/api/health`  
→ Überprüfe, ob `INTEGRATED_AI_API_KEY` korrekt gesetzt ist

### Problem: Build schlägt fehl
→ Öffne das Build-Log in Vercel (Deployments → aktuelles Deployment → Logs)  
→ Häufige Ursache: Node.js-Version. Vercel verwendet standardmäßig Node 18 – stelle sicher, dass dein Code kompatibel ist.

---

## Vercel-Limits (Free Tier)

| Limit | Wert |
|-------|------|
| Deployments/Monat | Unbegrenzt |
| Bandbreite/Monat | 100 GB |
| Serverless Function Dauer | Max. 10 Sekunden |
| Serverless Function Aufrufe/Monat | 100.000 |
| Domains | 1 kostenlose `.vercel.app`-Domain |

> Für eine **eigene Domain** (z.B. `meineapp.de`) ist kein Upgrade nötig – du kannst sie kostenlos in Vercel hinzufügen unter **Settings → Domains**.

---

## App aktualisieren

Nach jeder Codeänderung:

```bash
git add .
git commit -m "Beschreibung der Änderung"
git push origin main
```

Vercel deployt automatisch die neue Version. Das alte Deployment bleibt als Backup verfügbar (unter **Deployments**).

---

## Nützliche Links

| Ressource | URL |
|-----------|-----|
| Vercel Dashboard | https://vercel.com/dashboard |
| Vercel Docs | https://vercel.com/docs |
| OpenAI API Keys | https://platform.openai.com/api-keys |
| OpenAI API Status | https://status.openai.com |
| OpenAI Nutzung & Guthaben | https://platform.openai.com/usage |

---

*Erstellt für CE Translator – KI-Übersetzungs-App*
