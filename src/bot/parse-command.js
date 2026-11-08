const msg = $input.first().json.message;
if (!msg || !msg.chat) return [];

const chatId = msg.chat.id;
const raw = (msg.text || '').trim();
const m = raw.match(/^\/(\w+)(?:@\S+)?\s*([\s\S]*)$/);
let cmd = m ? m[1].toLowerCase() : '';
const arg = (m ? m[2] : raw).trim();
if (!m && /^https?:\/\//i.test(raw)) cmd = 'add';

const HELP = [
  'RSS-Digest. Befehle:',
  '/add <url> — RSS/Atom-Feed hinzufügen (oder einfach den Link schicken)',
  '/list — Liste der Quellen',
  '/remove <Nummer oder URL> — Quelle entfernen',
].join('\n');

if (cmd === 'add') {
  const url = arg.split(/\s+/)[0] || '';
  if (!/^https?:\/\/\S+\.\S+/i.test(url)) {
    return [{ json: { route: 3, chatId, text: 'Bitte die Feed-Adresse angeben: /add https://example.com/rss' } }];
  }
  return [{ json: { route: 0, chatId, url } }];
}
if (['remove', 'rm', 'del', 'delete'].includes(cmd)) {
  if (!arg) return [{ json: { route: 3, chatId, text: 'Bitte eine Nummer aus /list oder eine URL angeben: /remove 2' } }];
  return [{ json: { route: 1, chatId, arg } }];
}
if (cmd === 'list') return [{ json: { route: 2, chatId } }];

return [{ json: { route: 3, chatId, text: HELP } }];
