return [{
  json: {
    // Ziel des Digests: Ihre Telegram-ID (Privatchat mit dem Bot), @Kanal oder -100... (Bot muss Kanal-Admin sein)
    chatId: '135656943',
    // Empfänger von Meldungen über defekte Feeds; '' = keine Meldungen
    adminChatId: '',
    digestTitle: 'Nachrichten-Digest',
    lookbackHours: 26,
    maxItemsPerSource: 20,
    maxItemsTotal: 150,
    topN: 10,
    // 'gemini' oder 'claude'
    provider: 'gemini',
    geminiModel: 'gemini-3.6-flash',
    // Wird genutzt, wenn geminiModel nach allen Versuchen nicht antwortet (z. B. 503 bei Überlastung)
    geminiFallbackModel: 'gemini-3.5-flash-lite',
    claudeModel: 'claude-opus-5-5',
    claudeEffort: 'medium',
    seenRetentionDays: 30,
  },
}];
