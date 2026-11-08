const cfg = $('Config').first().json;
const { candidates } = $input.first().json;

const fmtDate = (ts) => (ts ? new Date(ts).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : 'ohne Datum');
const list = candidates
  .map((c, i) => `[${i + 1}] ${c.source} · ${fmtDate(c.ts)}\n${c.title}${c.snippet ? `\n${c.snippet}` : ''}`)
  .join('\n\n');

const system = [
  'Du bist Redakteur eines Telegram-Nachrichtenkanals. Aus einer Liste aktueller Medienbeiträge stellst du einen kurzen Digest des Wichtigsten zusammen.',
  '',
  'Auswahl:',
  '- Relevanz: Folgen für viele Menschen, Wirtschaft, Politik, Technologie, Wissenschaft; neue Fakten statt Meinungen und Nacherzählungen.',
  '- Dieselbe Geschichte aus mehreren Quellen ist ein Punkt; nimm den informativsten Beitrag. Berichten mehrere Medien darüber, spricht das für Relevanz.',
  '- Keine Werbung, Horoskope, Unterhaltungs-Kleinkram, inhaltslose Ankündigungen oder Clickbait.',
  `- Höchstens ${cfg.topN} Punkte; gibt es weniger Relevantes, dann weniger. Reihenfolge: das Wichtigste zuerst.`,
  '',
  'Schreibweise (auf Deutsch, unabhängig von der Sprache der Quelle):',
  '- title: kurze, informative Überschrift in eigenen Worten, ohne Anführungszeichen um die ganze Überschrift und ohne Emojis.',
  '- summary: 1–2 Sätze: worum es geht und warum es wichtig ist. Nur Fakten aus dem Beitrag, nichts hinzudichten.',
  '- intro: ein Satz zum Gesamtbild des Tages.',
  '- id: die Nummer des Beitrags aus der Liste in eckigen Klammern.',
].join('\n');

const schema = {
  type: 'object',
  properties: {
    intro: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          title: { type: 'string' },
          summary: { type: 'string' },
        },
        required: ['id', 'title', 'summary'],
        additionalProperties: false,
      },
    },
  },
  required: ['intro', 'items'],
  additionalProperties: false,
};

const user = `Beiträge (${candidates.length}):\n\n${list}`;

if (cfg.provider === 'gemini') {
  const { additionalProperties, ...itemSchema } = schema.properties.items.items;
  const geminiSchema = {
    type: 'object',
    properties: { ...schema.properties, items: { type: 'array', items: itemSchema } },
    required: schema.required,
  };
  return [{
    json: {
      provider: 'gemini',
      body: {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: geminiSchema,
          maxOutputTokens: 16000,
        },
      },
    },
  }];
}

return [{
  json: {
    provider: 'claude',
    body: {
      model: cfg.claudeModel,
      max_tokens: 16000,
      output_config: { effort: cfg.claudeEffort, format: { type: 'json_schema', schema } },
      fallbacks: 'default',
      system,
      messages: [{ role: 'user', content: user }],
    },
  },
}];
