const { chatId, url, title, count } = $('Check feed').first().json;
return [{
  json: {
    chatId,
    text: `Добавлено: ${title}\n${url}\nЗаписей в ленте сейчас: ${count}`,
  },
}];
