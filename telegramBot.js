let bot = null;

try {
  if (process.env.TELEGRAM_TOKEN) {
    const TelegramBot = require('node-telegram-bot-api');
    bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: false });
    console.log('✅ Telegram Bot initialized');
  }
} catch (err) {
  console.error('❌ Telegram Bot error:', err.message);
}

async function sendTestToChannel(test, testLink) {
  if (!bot) throw new Error('Bot not initialized');
  const channelId = process.env.TELEGRAM_CHANNEL_ID;
  if (!channelId) throw new Error('TELEGRAM_CHANNEL_ID not set');

  const typeEmoji = { daily: '📅', diagnostic: '🩺', weekly: '📆', grand: '🏆' };
  const typeLabel = { daily: 'Daily CBT', diagnostic: 'Diagnostic Test', weekly: 'Weekly CBT', grand: 'Grand Test' };

  const message = `
🔔 *Ayurthon ${typeLabel[test.type] || 'Test'} Live\\!*

📚 *${test.title}*

${typeEmoji[test.type] || '📝'} Type: ${typeLabel[test.type] || 'Test'}
⏱ Duration: ${test.duration_minutes} Minutes
❓ Questions: ${test.questions.length}

🏆 Leaderboard milega result ke saath\\!

👉 [अभी Attempt करें](${testLink})

_All the best\\! 🌿_
  `.trim();

  await bot.sendMessage(channelId, message, { parse_mode: 'MarkdownV2', disable_web_page_preview: false });
}

async function sendMessage(chatId, message) {
  if (!bot) return;
  await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
}

module.exports = { bot, sendTestToChannel, sendMessage };
