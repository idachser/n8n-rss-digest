const cfg = $('Config').first().json;
const since = Date.now() - cfg.lookbackHours * 3600 * 1000;

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', laquo: '«', raquo: '»', mdash: '—', ndash: '–', hellip: '…' };
const clean = (s) => String(s || '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (all, e) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : all;
    }
    return ENTITIES[e.toLowerCase()] ?? all;
  })
  .replace(/\s+/g, ' ')
  .trim();

const failed = new Set();
const bySource = new Map();
const seenLinks = new Set();

$input.all().forEach((item, idx) => {
  let src = {};
  try {
    src = $('Prepare sources').itemMatching(idx).json;
  } catch (e) {}
  const j = item.json;
  if (j.error) {
    failed.add(src.url || '?');
    return;
  }
  const link = String(j.link || j.guid || '').trim();
  const title = clean(j.title);
  if (!/^https?:\/\//i.test(link) || !title || seenLinks.has(link)) return;

  const ts = Date.parse(j.isoDate || j.pubDate || '');
  if (!Number.isNaN(ts) && ts < since) return;
  seenLinks.add(link);

  const key = src.url || '?';
  if (!bySource.has(key)) bySource.set(key, []);
  bySource.get(key).push({
    link,
    title: title.slice(0, 300),
    snippet: clean(j.contentSnippet || j.content || j.summary).slice(0, 400),
    source: src.title || key,
    feed: key,
    ts: Number.isNaN(ts) ? null : ts,
  });
});

return [{ json: { items: [...bySource.values()].flat(), failed: [...failed] } }];
