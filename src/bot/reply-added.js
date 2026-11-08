const { chatId, url, title, count } = $('Check feed').first().json;
return [{
  json: {
    chatId,
    text: `Hinzugefügt: ${title}\n${url}\nAktuelle Einträge im Feed: ${count}`,
  },
}];
