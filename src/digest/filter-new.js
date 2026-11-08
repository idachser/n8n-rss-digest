const cfg = $('Config').first().json;
const { items } = $('Normalize').first().json;
const seen = new Set($input.all().map((i) => i.json.link).filter(Boolean));

const newest = (a, b) => (b.ts ?? 0) - (a.ts ?? 0);
const perSource = new Map();
for (const it of items) {
  if (seen.has(it.link)) continue;
  if (!perSource.has(it.feed)) perSource.set(it.feed, []);
  perSource.get(it.feed).push(it);
}

const candidates = [...perSource.values()]
  .flatMap((list) => list.sort(newest).slice(0, cfg.maxItemsPerSource))
  .sort(newest)
  .slice(0, cfg.maxItemsTotal);

if (candidates.length === 0) return [];
return [{ json: { candidates } }];
