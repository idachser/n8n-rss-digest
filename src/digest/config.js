return [{
  json: {
    // Куда слать дайджест: ваш Telegram id (личка с ботом), @канал или -100... (бот — админ канала)
    chatId: '135656943',
    // Сюда приходят сообщения о сломанных лентах; '' — не отправлять
    adminChatId: '',
    digestTitle: 'Дайджест новостей',
    lookbackHours: 26,
    maxItemsPerSource: 20,
    maxItemsTotal: 150,
    topN: 10,
    // 'gemini' или 'claude'
    provider: 'gemini',
    geminiModel: 'gemini-3.6-flash',
    claudeModel: 'claude-opus-5-5',
    claudeEffort: 'medium',
    seenRetentionDays: 30,
  },
}];
