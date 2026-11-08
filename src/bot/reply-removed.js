const { chatId, url, title } = $('Resolve source').first().json;
return [{ json: { chatId, text: `Entfernt: ${title}\n${url}` } }];
