# RSS-Digest → Telegram (n8n)

Sie verwalten Ihre Liste von RSS/Atom-Feeds über einen Telegram-Bot. Einmal täglich sammelt n8n die neuen Beiträge, ein LLM (Gemini oder Claude) wählt das Wichtigste aus und fasst es kurz zusammen, und der Bot schickt den Digest in Ihren Privatchat oder veröffentlicht ihn in einem Kanal.

## Inhalt

| Datei | Funktion |
|---|---|
| `workflows/setup.json` | Legt die Data Tables `rss_sources` und `rss_seen` an. Einmal manuell ausführen. |
| `workflows/bot.json` | Bot: `/add <url>`, `/list`, `/remove <Nummer oder URL>`. Vor dem Hinzufügen prüft er, ob der Feed lesbar ist und ob er schon in der Liste steht. |
| `workflows/digest.json` | Täglich um 9:00: Feeds → Neues der letzten 26 Std. → bereits Verarbeitetes aussortieren → Gemini oder Claude → Beitrag in Telegram. |

So funktioniert der Digest:

- Alle Feeds werden in einem Durchlauf gelesen. Ein defekter Feed bricht den Lauf nicht ab; auf Wunsch kommt eine eigene Meldung an den Admin (`adminChatId`).
- Alle Links, die dem Modell schon gezeigt wurden (nicht nur die veröffentlichten), bleiben 30 Tage in `rss_seen`. Eine heute aussortierte Meldung taucht morgen also nicht wieder als „neu“ auf.
- Limits: höchstens 20 Beiträge pro Quelle und 150 insgesamt pro Anfrage an das Modell.
- Das Modell bekommt eine nummerierte Liste und antwortet mit JSON (Structured Outputs): `id`, Überschrift und Zusammenfassung. Links und Quellennamen stammen aus dem Feed, nicht aus der Modellantwort, deshalb kann es keine erfundenen Links geben.
- Der Beitrag wird als Telegram-HTML mit Escaping gebaut. Ist er länger als das Telegram-Limit, wird er auf mehrere Nachrichten aufgeteilt.

## Installation

1. **Bot.** Legen Sie bei [@BotFather](https://t.me/BotFather) einen Bot an und notieren Sie das Token. Schreiben Sie dem Bot `/start`, sonst kann er Ihnen nicht schreiben. Für die Veröffentlichung in einem Kanal fügen Sie den Bot dort als **Administrator** hinzu.
2. **Ihre Telegram-User-ID** erfahren Sie bei [@userinfobot](https://t.me/userinfobot). Der Bot reagiert nur auf diese ID.
3. **Start.** Lokal: `docker compose up -d`. Der Bot braucht eine öffentliche HTTPS-Adresse, sonst kann Telegram ihm keine Befehle zustellen. Auf dem Server liefert sie Caddy (siehe „Server“). Lokal können Sie `sh scripts/tunnel.sh` ausführen: Es startet einen Cloudflare Quick Tunnel und setzt `WEBHOOK_URL`. Die Tunnel-Adresse ändert sich bei jedem Neustart des Tunnels; danach das Skript erneut ausführen.
4. **Import:**
   ```sh
   docker compose exec n8n n8n import:workflow --separate --input=/workflows
   ```
   Oder manuell in der UI: *Workflows → Import from File*.
5. **Credentials** (in der n8n-UI, *Credentials → Add*):
   - **Telegram API**: Bot-Token. Wählen Sie es in den Nodes `Telegram Trigger`, `Reply`, `Send to Telegram` und `Notify admin` aus.
   - **Header Auth** für Gemini: Name `x-goog-api-key`, Value = Schlüssel aus [Google AI Studio](https://aistudio.google.com/apikey). Im Node `Gemini` auswählen.
   - **Header Auth** für Claude (falls benötigt): Name `x-api-key`, Value = Schlüssel aus der [Claude Console](https://platform.claude.com/settings/keys). Im Node `Claude` auswählen.
6. **Einstellungen:**
   - `RSS Digest — Bot zur Quellenverwaltung`, Node `Telegram Trigger`: unter *Restrict to User IDs* Ihre ID (mehrere IDs durch Komma getrennt).
   - `RSS Digest — täglicher Digest`, Node `Config`: `chatId` (Ihre ID für den Privatchat, `@Kanal` oder `-100…`), `provider`, optional `adminChatId`, `topN`, `lookbackHours` usw.
   - Der Zeitplan wird im Node `Schedule` geändert (Cron, die Zeitzone kommt aus `TZ`).
7. Führen Sie einmal `RSS Digest — Tabellen anlegen` aus und **veröffentlichen** (Publish) Sie danach Bot und Digest.
8. Schreiben Sie dem Bot `/add https://www.tagesschau.de/index~rss2.xml` und dann `/list`. Den Digest können Sie manuell mit *Execute workflow* starten.

> Wenn Sie das JSON aktualisiert und erneut importiert haben, veröffentlichen Sie den Workflow neu: Die veröffentlichte Version aktualisiert sich nicht von selbst.

## Modell

Der Anbieter wird in `Config` über das Feld `provider` gewählt:

- `gemini` (Standard): `geminiModel: 'gemini-3.6-flash'`, Aufruf von `models.generateContent`. Die Gemini API hat einen kostenlosen Tarif für die Flash-Modelle; die aktuellen Limits stehen in AI Studio. Im kostenlosen Tarif darf Google die Anfragen zur Verbesserung seiner Produkte nutzen.
- `claude`: `claudeModel: 'claude-opus-5-5'` mit `claudeEffort: 'medium'`, Aufruf der Messages API. `fallbacks: "default"` ist aktiv: Lehnt ein Sicherheitsklassifikator die Anfrage ab, wiederholt Anthropic sie auf einem passenden Modell. Günstiger: `claude-sonnet-5-5` oder `claude-haiku-5-5`.

Beide Anbieter bekommen denselben Prompt und dasselbe JSON-Schema; der Rest des Workflows hängt nicht von der Wahl ab.

## Server

Damit der Bot immer antwortet und der Digest auch bei ausgeschaltetem Rechner kommt, läuft n8n auf einem Server zusammen mit Caddy. Caddy holt sich das HTTPS-Zertifikat von Let's Encrypt selbst.

1. **DNS.** Legen Sie beim Domain-Anbieter einen A-Record für eine Subdomain (z. B. `n8n`) mit der IP des Servers an. Das Blog auf der Hauptdomain ist davon nicht betroffen.
2. **Server.** Installieren Sie Docker (`curl -fsSL https://get.docker.com | sh`) und öffnen Sie die Ports 80 und 443 (z. B. `ufw allow 80,443/tcp`).
3. **Backup des lokalen n8n.** Auf Ihrem Rechner:
   ```sh
   sh scripts/backup.sh
   ```
   Das erzeugt `n8n_data.tgz`: Workflows, Credentials samt Verschlüsselungsschlüssel und die Tabellen mit den Feeds. Im Archiv liegen das Bot-Token und die API-Schlüssel; behandeln Sie es wie ein Passwort.
4. **Auf den Server kopieren:**
   ```sh
   rsync -av --exclude .git --exclude .env ./ user@server:~/n8n-rss-digest/
   ```
5. **Auf dem Server:**
   ```sh
   cd ~/n8n-rss-digest
   cp .env.example .env        # N8N_DOMAIN=n8n.ihredomain
   sh scripts/restore.sh
   docker compose -f docker-compose.yml -f docker-compose.server.yml up -d
   ```
6. Öffnen Sie `https://n8n.ihredomain` und melden Sie sich mit demselben Konto an. Veröffentlichen (**Publish**) Sie Bot und Digest. Beim Veröffentlichen des Bots teilt n8n Telegram die Webhook-Adresse selbst mit.
7. **Stoppen Sie das lokale n8n** (`docker compose down`), sonst kann der Digest doppelt kommen. Löschen Sie `n8n_data.tgz` auf dem Server und lokal.

Workflows auf dem Server aktualisieren: `git pull` oder `rsync`, dann `docker compose -f docker-compose.yml -f docker-compose.server.yml exec n8n n8n import:workflow --separate --input=/workflows`. Schließen Sie vor dem Import die Browser-Tabs mit diesen Workflows, starten Sie n8n nach dem Import neu und veröffentlichen Sie erneut. In der UI zugewiesene Credentials werden beim Import zurückgesetzt und müssen neu ausgewählt werden.

## Entwicklung

Der Code der Code-Nodes liegt als einzelne Dateien in `src/`. Das JSON in `workflows/` erzeugt ein Skript:

```sh
node scripts/build.mjs
```
