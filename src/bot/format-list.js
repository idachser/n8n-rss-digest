const { chatId } = $('Parse command').first().json;
const rows = $input.all()
  .map((i) => i.json)
  .filter((r) => r.url)
  .sort((a, b) => a.id - b.id);

const text = rows.length
  ? ['Источники:', ...rows.map((r, i) => `${i + 1}. ${r.title || ''}\n${r.url}`)].join('\n')
  : 'Источников пока нет. Добавьте: /add https://example.com/rss';

return [{ json: { chatId, text } }];
