const cfg = $('Config').first().json;
const { candidates } = $('Filter new').first().json;
const res = $input.first().json;

function claudeText(r) {
  if (r.stop_reason === 'refusal') {
    throw new Error(`Claude отказался отвечать: ${JSON.stringify(r.stop_details)}`);
  }
  if (r.stop_reason === 'max_tokens') throw new Error('Ответ Claude обрезан по max_tokens');
  return (r.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
}

function geminiText(r) {
  const cand = (r.candidates || [])[0];
  if (!cand) {
    throw new Error(`Gemini не вернул ответ: ${JSON.stringify(r.promptFeedback || r).slice(0, 500)}`);
  }
  if (cand.finishReason && cand.finishReason !== 'STOP') {
    throw new Error(`Gemini остановился с finishReason=${cand.finishReason}`);
  }
  return (cand.content?.parts || []).filter((p) => !p.thought && p.text).map((p) => p.text).join('');
}

const text = cfg.provider === 'gemini' ? geminiText(res) : claudeText(res);
let data;
try {
  data = JSON.parse(text);
} catch (e) {
  throw new Error(`Модель вернула не JSON: ${text.slice(0, 500)}`);
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s) => esc(s).replace(/"/g, '&quot;');

const used = new Set();
const picks = [];
for (const it of data.items || []) {
  const c = candidates[it.id - 1];
  if (!c || used.has(it.id)) continue;
  used.add(it.id);
  picks.push({ ...it, c });
  if (picks.length >= cfg.topN) break;
}
if (picks.length === 0) return [];

const date = $now.setLocale('ru').toFormat('d MMMM yyyy');
const blocks = [
  `<b>📰 ${esc(cfg.digestTitle)} — ${esc(date)}</b>`,
  ...(data.intro ? [`<i>${esc(data.intro)}</i>`] : []),
  ...picks.map((p, i) =>
    `${i + 1}. <b>${esc(p.title)}</b>\n${esc(p.summary)}\n<a href="${escAttr(p.c.link)}">${esc(p.c.source)}</a>`),
];

const LIMIT = 4000;
const posts = [];
let cur = '';
for (const block of blocks) {
  if (cur && cur.length + 2 + block.length > LIMIT) {
    posts.push(cur);
    cur = block;
  } else {
    cur = cur ? `${cur}\n\n${block}` : block;
  }
}
if (cur) posts.push(cur);

return posts.map((text) => ({ json: { chatId: cfg.chatId, text } }));
