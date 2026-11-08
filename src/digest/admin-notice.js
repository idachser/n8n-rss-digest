const cfg = $('Config').first().json;
const { failed } = $input.first().json;
if (!cfg.adminChatId || failed.length === 0) return [];
return [{ json: { chatId: cfg.adminChatId, text: `⚠️ Folgende Feeds konnten nicht gelesen werden:\n${failed.join('\n')}` } }];
