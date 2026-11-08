return $input.all()
  .map((i) => i.json)
  .filter((r) => r.url)
  .sort((a, b) => a.id - b.id)
  .map((r) => ({ json: { url: r.url, title: r.title || r.url } }));
