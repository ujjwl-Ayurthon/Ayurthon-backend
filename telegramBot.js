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

// Build channels array from env variables
function getChannels() {
  const channels = [];
  let i = 1;
  while (process.env[`TELEGRAM_CHANNEL_${i}`]) {
    const rawId = process.env[`TELEGRAM_CHANNEL_${i}`].trim();
    // Keep only digits and leading minus sign
    const numericId = rawId.replace(/[^0-9-]/g, '');
    channels.push({
      id:   numericId,
      name: process.env[`TELEGRAM_CHANNEL_${i}_NAME`]?.trim() || `Channel ${i}`
    });
    i++;
  }
  // Fallback to old single variable
  if (channels.length === 0 && process.env.TELEGRAM_CHANNEL_ID) {
    channels.push({
      id:   process.env.TELEGRAM_CHANNEL_ID.replace(/[^0-9-]/g, ''),
      name: 'Main Channel'
    });
  }
  return channels;
}

// Resolve channel — accept id or name, return numeric id
function resolveChannelId(channelIdOrName) {
  const channels = getChannels();
  if (!channelIdOrName) return channels[0]?.id || null;

  // Try exact id match first
  const byId = channels.find(c => c.id === String(channelIdOrName).trim());
  if (byId) return byId.id;

  // Try name match (case-insensitive)
  const byName = channels.find(
    c => c.name.toLowerCase() === String(channelIdOrName).trim().toLowerCase()
  );
  if (byName) return byName.id;

  // Try partial name match
  const partial = channels.find(
    c => c.name.toLowerCase().includes(String(channelIdOrName).trim().toLowerCase())
  );
  if (partial) return partial.id;

  // Fallback to first channel
  return channels[0]?.id || null;
}

// Send test notification using HTML parse_mode (safe for Sanskrit/special chars)
async function sendTestToChannel(test, testLink, channelIdOrName, customMessage) {
  if (!bot) throw new Error('Bot not initialized');

  const targetId = resolveChannelId(channelIdOrName);
  if (!targetId) throw new Error('No valid channel ID found. Check TELEGRAM_CHANNEL_1 env variable.');

  console.log(`📤 Sending to channel: ${targetId}`);

  const typeEmoji = { daily: '📅', diagnostic: '🩺', weekly: '📆', grand: '🏆' };
  const typeLabel = { daily: 'Daily CBT', diagnostic: 'Diagnostic Test', weekly: 'Weekly CBT', grand: 'Grand Test' };

  const negMarksLine = (test.negative_marks && Number(test.negative_marks) > 0)
    ? `\n➖ <b>Negative Marking:</b> ${test.negative_marks}`
    : '\n✅ <b>No Negative Marking</b>';

  // Use custom message if admin edited it, otherwise use default
  const messageText = customMessage || `${typeEmoji[test.type] || '📝'} <b>Ayurthon — ${typeLabel[test.type] || 'Test'}</b>

📚 <b>${test.title}</b>
━━━━━━━━━━━━━━━━
❓ <b>Questions:</b> ${test.questions?.length || test.total_marks}
⏱ <b>Duration:</b> ${test.duration_minutes} Minutes
🏆 <b>Total Marks:</b> ${test.total_marks}${negMarksLine}
━━━━━━━━━━━━━━━━
📊 Result &amp; Leaderboard turant milega!

<i>सभी को शुभकामनाएं! 🌿</i>`;

  await bot.sendMessage(targetId, messageText, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [[
        { text: '🚀 Launch CBT Test — अभी Attempt करें', url: testLink }
      ]]
    },
    disable_web_page_preview: true
  });

  console.log(`✅ Message sent to ${targetId}`);
}

function getChannelList() {
  return getChannels();
}

async function sendMessage(chatId, message) {
  if (!bot) return;
  try {
    await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
  } catch (err) {
    console.error('sendMessage error:', err.message);
  }
}

module.exports = { bot, sendTestToChannel, sendMessage, getChannelList };
