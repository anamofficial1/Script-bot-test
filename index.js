/*
AUTHOR  : @dliinotdev

SUPPORT : AlwaysDlii [ ME ]
          : Deepseek AI
          : frmnzz.json
          : XTRX | DITTH Xyace
          : Archi
          : All Patrner Dlii
          : All Buyyer Script
NOTE : NO DELETE TEKS INI,HARGAILAH PEMBUAT SCRIPT
*/
const { Telegraf } = require('telegraf');
const cron = require('node-cron');
const fs = require('fs');
const config = require('./config');

// Inisialisasi bot
const bot = new Telegraf(config.BOT_TOKEN);

// Load data dari file
let data = {
  groups: [],
  users: []
};

let premiumData = {
  premiumUsers: [],
  credits: {},
  settings: {
    autoBroadcastEnabled: false,
    currentBroadcastMessage: null,
    lastBroadcastTime: null
  }
};

// Fungsi untuk menyimpan data
function saveData() {
  fs.writeFileSync(config.DATA_FILE, JSON.stringify(data, null, 2));
}

function savePremiumData() {
  fs.writeFileSync(config.PREMIUM_FILE, JSON.stringify(premiumData, null, 2));
}

function replyHTML(ctx, text) {
  return ctx.reply(text, { parse_mode: 'HTML' });
}

// Coba load data yang ada
try {
  data = JSON.parse(fs.readFileSync(config.DATA_FILE));
} catch (e) {
  console.log("Membuat file data baru...");
  saveData();
}

try {
  premiumData = JSON.parse(fs.readFileSync(config.PREMIUM_FILE));
} catch (e) {
  console.log("Membuat file premium baru...");
  savePremiumData();
}

// Fungsi broadcast
async function broadcastMessage(message, isForward = false, fromChatId, messageId) {
  const activeGroups = data.groups.filter(group => group.active);
  let successCount = 0;

  for (const group of activeGroups) {
    try {
      if (isForward) {
        await bot.telegram.forwardMessage(group.chatId, fromChatId, messageId);
      } else {
        await bot.telegram.sendMessage(group.chatId, message);
      }
      successCount++;
    } catch (error) {
      console.error(`Gagal mengirim ke grup ${group.chatId}:`, error.message);
      group.active = false;
      saveData();
    }
  }

  premiumData.settings.lastBroadcastTime = new Date().toISOString();
  savePremiumData();

  return {
    success: successCount,
    total: activeGroups.length
  };
}

// Setup auto broadcast
function setupAutoBroadcast() {
  if (premiumData.settings.autoBroadcastEnabled && premiumData.settings.currentBroadcastMessage) {
    console.log("Menjadwalkan auto broadcast...");
    cron.schedule(`*/${config.AUTO_BC_INTERVAL} * * * *`, async () => {
      console.log("Menjalankan auto broadcast...");
      const result = await broadcastMessage(premiumData.settings.currentBroadcastMessage);
      console.log(`Auto broadcast berhasil dikirim ke ${result.success}/${result.total} grup`);
    });
  }
}

// Command handlers
bot.start((ctx) => {
  ctx.replyWithMarkdown(`<blockquote>
<b>👋 Halo! Saya ${config.BOT_NAME}</b>
<b>saya di buat untuk menginformasikan informasi dari admin bot untuk pengguna bot ini.</b>

<b>🔹 Fitur Utama:</b>
- /share - Kirim pesan ke semua grup
- /autobc - Mulai auto broadcast
- /stopautobc - Hentikan auto broadcast
- /addgroup - Tambahkan grup ke sistem
- /listgroup - Lihat daftar grup
- /addakses - Tambahkan user premium (Owner only)

<b>📌 Bot dibuat oleh:</b> ${config.AUTHOR}
</blockquote>`);
});

// Broadcast command
bot.command('share', async (ctx) => {
  if (!ctx.message.reply_to_message) {
    return ctx.reply(`<blockquote>Silakan reply pesan yang ingin di-broadcast!</blockquote>`);
  }

  const isOwner = ctx.from.id === config.OWNER_ID;
  const isPremium = premiumData.premiumUsers.includes(ctx.from.id.toString());

  if (!isOwner && !isPremium) {
    return ctx.reply(`<blockquote><b>❌Akses Ditolak</b>\nHanya owner dan premium user yang bisa menggunakan fitur ini!</blockquote>`);
  }

  try {
    const result = await broadcastMessage(
      ctx.message.reply_to_message.text,
      true,
      ctx.chat.id,
      ctx.message.reply_to_message.message_id
    );

    ctx.reply(`<blockquote>✅ Broadcast berhasil dikirim ke <b>${result.success}</b> dari <b>${result.total}</b> grup!</blockquote>`);
  } catch (error) {
    console.error("Error broadcasting:", error);
    ctx.reply(`<blockquote>❌ Gagal melakukan broadcast!</blockquote>`);
  }
});

// Start auto broadcast
bot.command('autobc', async (ctx) => {
  if (ctx.from.id !== config.OWNER_ID) {
    return ctx.reply(`<blockquote><b>❌ Akses Ditolak</b>\nHanya owner yang bisa menggunakan fitur ini!</blockquote>`);
  }

  if (!ctx.message.reply_to_message) {
    return ctx.reply(`<blockquote>Silakan reply pesan yang ingin dijadikan auto broadcast!</blockquote>`);
  }

  premiumData.settings.autoBroadcastEnabled = true;
  premiumData.settings.currentBroadcastMessage = ctx.message.reply_to_message.text;
  savePremiumData();

  setupAutoBroadcast();

  ctx.reply(`<blockquote>✅ Auto broadcast telah diaktifkan!</blockquote>`);
});

// Stop auto broadcast
bot.command('stopautobc', async (ctx) => {
  if (ctx.from.id !== config.OWNER_ID) {
    return ctx.reply(`<blockquote><b>❌Akses Ditolak</b>\nHanya owner yang bisa menggunakan fitur ini!</blockquote>`);
  }

  premiumData.settings.autoBroadcastEnabled = false;
  premiumData.settings.currentBroadcastMessage = null;
  savePremiumData();

  ctx.reply(`<blockquote>❌ Auto broadcast telah dihentikan!</blockquote>`);
});

// Add group command
bot.command('addgroup', async (ctx) => {
  if (ctx.chat.type === 'private') {
    return ctx.reply(`<blockquote><b>❌ Akses Ditolak</b>\nCommand ini hanya bisa digunakan di dalam grup!</blockquote>`);
  }

  const existingGroup = data.groups.find(g => g.chatId === ctx.chat.id);
  if (existingGroup) {
    return ctx.reply(`<blockquote>Grup ini sudah terdaftar!</blockquote>`);
  }

  data.groups.push({
    chatId: ctx.chat.id,
    title: ctx.chat.title || "Unknown",
    active: true,
    addedBy: ctx.from.id,
    addedAt: new Date().toISOString()
  });

  saveData();

  ctx.reply(`<blockquote>✅ Grup berhasil ditambahkan ke sistem broadcast!</blockquote>`);
});

// List groups command
bot.command('listgroup', async (ctx) => {
  if (ctx.from.id !== config.OWNER_ID) {
    return ctx.reply(`<blockquote>Hanya owner yang bisa menggunakan fitur ini!</blockquote>`);
  }

  const activeGroups = data.groups.filter(g => g.active);
  const inactiveGroups = data.groups.filter(g => !g.active);

  ctx.replyWithMarkdown(`<blockquote>
<b>📊 STATISTIK GRUP:</b>
🔹 Total : ${data.groups.length}
✅ Aktif : ${activeGroups.length}
❌ Nonaktif : ${inactiveGroups.length}
</blockquote>`);
});

// Add premium user
bot.command('addakses', async (ctx) => {
  if (ctx.from.id !== config.OWNER_ID) {
    return ctx.reply(`<blockquote>Hanya owner yang bisa menggunakan fitur ini!</blockquote>`);
  }

  const userId = ctx.message.text.split(' ')[1];
  if (!userId) {
    return ctx.reply(`<blockquote><b>Silakan sertakan user ID!</b>\nContoh: /addpremium 123456789</blockquote>`);
  }

  if (premiumData.premiumUsers.includes(userId)) {
    return ctx.reply(`<blockquote>User sudah premium</blockquote>`");
  }

  premiumData.premiumUsers.push(userId);
  savePremiumData();

  ctx.reply(`<blockquote>✅ User <b>${userId}</b> berhasil ditambahkan sebagai premium!</blockquote>`);
});

// Handle new chat members (bot added to group)
bot.on('new_chat_members', async (ctx) => {
  if (ctx.message.new_chat_members.some(member => member.id === ctx.botInfo.id)) {
    const existingGroup = data.groups.find(g => g.chatId === ctx.chat.id);
    if (!existingGroup) {
      data.groups.push({
        chatId: ctx.chat.id,
        title: ctx.chat.title || "Unknown",
        active: true,
        addedBy: ctx.from.id,
        addedAt: new Date().toISOString()
      });
      saveData();
    } else if (!existingGroup.active) {
      existingGroup.active = true;
      saveData();
    }

    ctx.reply(`<blockquote>
<b>🤖 Makasi bro udh masukin gw ke group ini!</b>

<b>🔹 Untuk mendaftarkan grup ke sistem broadcast, ketik:</b>
/addgroup

<b>🔹 Info lengkap ketik:</b>
/start

<b>Owner Contact:</b>
Cs: @PraiOfficial
</blockquote>`);
  }
});

// Handle bot removed from group
bot.on('left_chat_member', async (ctx) => {
  if (ctx.message.left_chat_member.id === ctx.botInfo.id) {
    const group = data.groups.find(g => g.chatId === ctx.chat.id);
    if (group) {
      group.active = false;
      saveData();
    }
  }
});

// Error handling
bot.catch((err, ctx) => {
  console.error('Error:', err);
  ctx.reply(`<blockquote>Terjadi kesalahan saat memproses perintah!</blockquote>`);
});

// Start bot
console.log("🤖 Bot sedang dimulai...");
bot.launch()
  .then(() => {
    console.log(`✅ ${config.BOT_NAME} berhasil dijalankan!`);
    setupAutoBroadcast();
  })
  .catch(err => console.error("Gagal memulai bot:", err));

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));