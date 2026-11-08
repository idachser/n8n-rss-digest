const { chatId, url } = $('Parse command').first().json;
// Only scheme and host are case-insensitive; paths and queries are not.
const norm = (u) => String(u).trim().replace(/\/+$/, '').replace(/^[a-z]+:\/\/[^/?#]+/i, (h) => h.toLowerCase());
const duplicate = $input.all().some((i) => i.json.url && norm(i.json.url) === norm(url));

return [{
  json: {
    chatId,
    url,
    duplicate,
    text: duplicate ? `Этот источник уже в списке: ${url}` : '',
  },
}];
