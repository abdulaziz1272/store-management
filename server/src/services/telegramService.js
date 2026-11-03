// Sends messages and files to Telegram using the Bot API.
// Needs Node 18+ (it has fetch, FormData and Blob built in).
//
// How to get the values:
//  1) Talk to @BotFather in Telegram, create a bot, copy the token -> TELEGRAM_BOT_TOKEN
//  2) Add the bot to the group (or start a chat with it), send any message
//  3) Open https://api.telegram.org/bot<TOKEN>/getUpdates and find "chat":{"id": ...}
//     That number is TELEGRAM_CHAT_ID (group ids are negative numbers)

const AppError = require('../utils/AppError');

function getConfig() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    throw new AppError(500, 'Telegram sozlanmagan (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)');
  }

  return { token, chatId };
}

async function callTelegram(token, method, body) {
  const response = await fetch('https://api.telegram.org/bot' + token + '/' + method, {
    method: 'POST',
    body,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.ok) {
    throw new Error('Telegram xatosi: ' + (data.description || response.status));
  }

  return data;
}

async function sendTelegramMessage(text) {
  const { token, chatId } = getConfig();

  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('text', text);

  return callTelegram(token, 'sendMessage', form);
}

// caption can be up to 1024 characters
async function sendTelegramDocument(buffer, fileName, caption) {
  const { token, chatId } = getConfig();

  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('caption', caption.slice(0, 1000));
  form.append('document', new Blob([buffer], { type: 'application/pdf' }), fileName);

  return callTelegram(token, 'sendDocument', form);
}

module.exports = { sendTelegramMessage, sendTelegramDocument };
