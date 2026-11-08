const cfg = $('Config').first().json;
const { candidates } = $input.first().json;

const fmtDate = (ts) => (ts ? new Date(ts).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : 'без даты');
const list = candidates
  .map((c, i) => `[${i + 1}] ${c.source} · ${fmtDate(c.ts)}\n${c.title}${c.snippet ? `\n${c.snippet}` : ''}`)
  .join('\n\n');

const system = [
  'Ты — редактор новостного Telegram-канала. Из списка свежих публикаций СМИ ты собираешь короткий дайджест самого важного.',
  '',
  'Как отбирать:',
  '- Значимость: последствия для многих людей, экономики, политики, технологий, науки; новые факты, а не мнения и пересказы.',
  '- Одна и та же история в нескольких источниках — один пункт; возьми самую информативную публикацию. Освещение в нескольких СМИ — признак значимости.',
  '- Не бери рекламу, гороскопы, развлекательную мелочь, анонсы без содержания, кликбейт.',
  `- Не больше ${cfg.topN} пунктов; если значимого меньше — меньше. Порядок — от самого важного.`,
  '',
  'Как писать (по-русски, независимо от языка источника):',
  '- title: короткий информативный заголовок своими словами, без кавычек-ёлочек вокруг всего заголовка и без эмодзи.',
  '- summary: 1–2 предложения — суть и почему это важно. Только факты из публикации, ничего не додумывай.',
  '- intro: одно предложение об общей картине дня.',
  '- id: номер публикации из списка в квадратных скобках.',
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

const user = `Публикации (${candidates.length}):\n\n${list}`;

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
