const { chatId, url } = $('Check duplicate').first().json;
const items = $input.all().map((i) => i.json);
const entries = items.filter((j) => j.title || j.link);

if (entries.length === 0) {
  const reason = items.find((j) => j.error)?.error || 'der Feed hat keine Einträge oder ist kein RSS/Atom';
  return [{ json: { ok: false, chatId, text: `Feed konnte nicht gelesen werden: ${url}\n${reason}` } }];
}

// The Code node sandbox has no global URL constructor.
const title = (url.match(/^https?:\/\/(?:www\.|rss\.|feeds?\.)?([^/:?#]+)/i) || [])[1] || url;

return [{ json: { ok: true, chatId, url, title, count: entries.length } }];
