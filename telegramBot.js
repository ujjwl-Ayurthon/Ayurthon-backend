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

  const negMarks = test.negative_marks > 0 ? `\n➖ Negative Marking: ${test.negative_marks}` : '\n✅ No Negative Marking';

  // Clean message — no raw URL visible
  const message =
`${typeEmoji[test.type] || '📝'} *Ayurthon — ${typeLabel[test.type] || 'Test'}*

📚 *${test.title}*
━━━━━━━━━━━━━━━━
❓ Questions: *${test.questions?.length || test.total_marks}*
⏱ Duration: *${test.duration_minutes} Minutes*
🏆 Total Marks: *${test.total_marks}*${negMarks}
━━━━━━━━━━━━━━━━
📊 Result & Leaderboard turant milega!

_सभी को शुभकामनाएं! 🌿_`;

  // Inline keyboard — URL hidden inside button
  const inlineKeyboard = {
    inline_keyboard: [[
      {
        text: '🚀 Launch CBT Test — अभी Attempt करें',
        url: testLink
      }
    ]]
  };

  await bot.sendMessage(channelId, message, {
    parse_mode:              'Markdown',
    reply_markup:            inlineKeyboard,
    disable_web_page_preview: true
  });
}

async function sendMessage(chatId, message) {
  if (!bot) return;
  await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
}

module.exports = { bot, sendTestToChannel, sendMessage };
