# Rennrad Dashboard

Private Web-App (PWA) für Rennrad-Fahrten. Statische Seite, Daten in Supabase (Schema `rad`), Zugriff nur mit Login.

## Stand
Phase 1, erster Teil: Login, Datenstand und Import der Rohdatei. Übersicht, Räder und Fahrt erfassen folgen.

## Dateien
- `index.html`, `style.css`, `app.js`: Oberfläche
- `import.js`: Einlesen der Rohdatei und Schreiben nach `rad.*`
- `config.js`: Projekt-URL und publishable key (öffentlich, kein Geheimnis)
- `supabase/001_rad_schema.sql`: Tabellen und Zugriffsregeln (bereits angelegt)

## Veröffentlichen (GitHub Pages)
1. Neues öffentliches Repo `rennrad-dashboard` anlegen.
2. Alle Dateien hochladen (Add file → Upload files).
3. Settings → Pages → Source: Deploy from a branch, Branch `main`, Ordner `/ (root)`.
4. Nach ca. 1 Minute erreichbar unter `https://<dein-name>.github.io/rennrad-dashboard/`.

## Nie ins Repo
Excel-Dateien, Passwörter, `service_role`-Schlüssel, Strava-Secret.
