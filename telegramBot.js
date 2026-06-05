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

function getChannels() {
  const channels = [];
  let i = 1;
  while (process.env[`TELEGRAM_CHANNEL_${i}`]) {
    channels.push({
      id:   process.env[`TELEGRAM_CHANNEL_${i}`].trim(),
      name: process.env[`TELEGRAM_CHANNEL_${i}_NAME`] || `Channel ${i}`
    });
    i++;
  }
  if (channels.length === 0 && process.env.TELEGRAM_CHANNEL_ID) {
    channels.push({ id: process.env.TELEGRAM_CHANNEL_ID, name: 'Main Channel' });
  }
  return channels;
}

async function sendTestToChannel(test, testLink, channelId) {
  if (!bot) throw new Error('Bot not initialized');

  const channels = getChannels();
  const targetId = channelId || channels[0]?.id;
  if (!targetId) throw new Error('No channel ID configured');

  const typeEmoji = { daily: '📅', diagnostic: '🩺', weekly: '📆', grand: '🏆' };
  const typeLabel = { daily: 'Daily CBT', diagnostic: 'Diagnostic Test', weekly: 'Weekly CBT', grand: 'Grand Test' };
  const negMarks  = test.negative_marks > 0
    ? `\n➖ Negative Marking: ${test.negative_marks}`
    : '\n✅ No Negative Marking';

  const message =
`${typeEmoji[test.type] || '📝'} *Ayurthon — ${typeLabel[test.type] || 'Test'}*

📚 *${test.title}*
━━━━━━━━━━━━━━━━
❓ Questions: *${test.questions?.length || test.total_marks}*
⏱ Duration: *${test.duration_minutes} Minutes*
🏆 Total Marks: *${test.total_marks}*${negMarks}
━━━━━━━━━━━━━━━━
📊 Result & Leaderboard turant milega\\!

_सभी को शुभकामनाएं\\! 🌿_`;

  await bot.sendMessage(targetId, message, {
    parse_mode: 'MarkdownV2',
    reply_markup: {
      inline_keyboard: [[
        { text: '🚀 Launch CBT Test — अभी Attempt करें', url: testLink }
      ]]
    },
    disable_web_page_preview: true
  });
}

function getChannelList() {
  return getChannels();
}

async function sendMessage(chatId, message) {
  if (!bot) return;
  await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
}

module.exports = { bot, sendTestToChannel, sendMessage, getChannelList };
