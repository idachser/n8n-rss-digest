const { chatId, arg } = $('Parse command').first().json;
// Only scheme and host are case-insensitive; paths and queries are not.
const norm = (u) => String(u).trim().replace(/\/+$/, '').replace(/^[a-z]+:\/\/[^/?#]+/i, (h) => h.toLowerCase());
const rows = $input.all()
  .map((i) => i.json)
  .filter((r) => r.url)
  .sort((a, b) => a.id - b.id);

const target = /^\d+$/.test(arg)
  ? rows[Number(arg) - 1]
  : rows.find((r) => norm(r.url) === norm(arg));

if (!target) {
  return [{ json: { found: false, chatId, text: `Источник «${arg}» не найден. Смотрите /list` } }];
}
return [{ json: { found: true, chatId, url: target.url, title: target.title || target.url } }];
