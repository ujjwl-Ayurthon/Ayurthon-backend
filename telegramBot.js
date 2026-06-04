const TelegramBot = require('node-telegram-bot-api');

let bot = null;

// Initialize bot only if token exists
if (process.env.TELEGRAM_TOKEN) {
  try {
    bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: false });
    console.log('✅ Telegram Bot initialized');
  } catch (err) {
    console.error('❌ Telegram Bot init error:', err.message);
  }
}

// ─── Send Test Link to Channel ─────────────────────────────
async function sendTestToChannel(test, testLink) {
  if (!bot) throw new Error('Telegram bot not initialized');

  const channelId = process.env.TELEGRAM_CHANNEL_ID;
  if (!channelId) throw new Error('TELEGRAM_CHANNEL_ID not set');

  const typeEmoji = {
    daily:      '📅',
    diagnostic: '🩺',
    weekly:     '📆',
    grand:      '🏆'
  };

  const typeLabel = {
    daily:      'Daily CBT',
    diagnostic: 'Diagnostic Test',
    weekly:     'Weekly CBT',
    grand:      'Grand Test'
  };

  const emoji = typeEmoji[test.type] || '📝';
  const label = typeLabel[test.type] || 'Test';

  const message = `
🔔 *Ayurthon ${label} Live!*

📚 *${test.title}*

${emoji} Type: ${label}
⏱ Duration: ${test.duration_minutes} Minutes
❓ Questions: ${test.questions.length}
📊 Total Marks: ${test.total_marks}

🏆 Leaderboard milega result ke saath!

👉 [अभी Attempt करें](${testLink})

_All the best! 🌿_
  `.trim();

  await bot.sendMessage(channelId, message, {
    parse_mode: 'Markdown',
    disable_web_page_preview: false
  });
}

// ─── Send Custom Message ───────────────────────────────────
async function sendMessage(chatId, message) {
  if (!bot) return;
  await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
}

module.exports = { bot, sendTestToChannel, sendMessage };
