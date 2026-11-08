const { chatId, url, title } = $('Resolve source').first().json;
return [{ json: { chatId, text: `Удалено: ${title}\n${url}` } }];
