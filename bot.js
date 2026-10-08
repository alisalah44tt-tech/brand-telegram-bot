const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

const token = process.env.BOT_TOKEN;

if (!token) {
  console.error('❌ BOT_TOKEN غير موجود');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

const CHANNEL_USERNAME = 'Pubg_Libya_Store';

// ========================================
// المالك الوحيد
// ========================================

const OWNER_ID = Number(process.env.OWNER_ID || 7923337516);
const OWNER_BUTTON = '⚙️ لوحة تحكم المالك';

function isOwner(userId) {
  return Number(userId) === OWNER_ID;
}

// ========================================
// ملف البيانات (الحفظ الدائم)
// مهم: الاستضافة لازم تدعم تخزين دائم،
// ويمكن تغيير المسار بمتغير DATA_FILE
// ========================================

const DATA_FILE = process.env.DATA_FILE
  ? path.resolve(process.env.DATA_FILE)
  : path.join(__dirname, 'brand-data.json');

// ========================================
// الإعدادات الافتراضية
// ========================================

const DEFAULT_SETTINGS = {
  welcome: `🔥 مرحبًا بك في بوت BRAND Libya 🇱🇾

🎮 كل خدمات PUBG في مكان واحد

💎 شحن UC
🛒 بيع وشراء الحسابات
🎁 المسابقات والسحوبات
📞 تواصل معنا في أي وقت

👇 اختر الخدمة التي تريدها من الأزرار بالأسفل`,

  buttons: {
    latest: '🔥 آخر الحسابات',
    search: '🔍 البحث عن حساب',
    publish: '📋 طلب نشر حساب',
    charge: '💎 شحن UC والألعاب',
    rating: '⭐ تقييم الخدمة',
    contact: '📞 التواصل مع الإدارة',
    contests: '🎁 المسابقات والسحوبات'
  },

  publishMsg: `📋 طلب نشر حساب

لإضافة حساب للبيع، أرسل بيانات الحساب وصوره هنا.

📞 للتواصل:
{contact}`,

  pricesMsg: `🎮 شحن شدات PUBG

🟢📱 المدار الجديد
الشحن عن طريق رصيد المدار:

• 60 شدة — 14 رصيد
• 325 شدة — 69 رصيد
• 660 شدة — 135 رصيد
• 1800 شدة — 335 رصيد
• 3050 شدة — 670 رصيد

🟣📱 ليبيانا
الشحن عن طريق رصيد ليبيانا:

• 60 شدة — 12 رصيد
• 325 شدة — 60 رصيد
• 660 شدة — 120 رصيد
• 1800 شدة — 300 رصيد
• 3850 شدة — 600 رصيد

🏦 المصرف
الشحن عن طريق المصرف:

• 60 شدة — 11 د.ل
• 325 شدة — 52 د.ل
• 660 شدة — 100 د.ل
• 1800 شدة — 255 د.ل
• 3850 شدة — 500 د.ل

🔥 توجد باقات أعلى وتوفير حسب الطلب.

📞 للتفاصيل والتواصل:
{contact}`,

  contestsMsg: `🎁 المسابقات والسحوبات

تابع القناة لمعرفة آخر المسابقات والسحوبات.`,

  contacts: {
    publish: '@dy_x2',
    charge: '@violletry',
    admin: '@dy_x2 @violletry'
  }
};

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function mergeSettings(saved) {
  const s = clone(DEFAULT_SETTINGS);

  if (!saved || typeof saved !== 'object') return s;

  ['welcome', 'publishMsg', 'pricesMsg', 'contestsMsg'].forEach(key => {
    if (typeof saved[key] === 'string' && saved[key].trim()) {
      s[key] = saved[key];
    }
  });

  if (saved.buttons && typeof saved.buttons === 'object') {
    Object.keys(s.buttons).forEach(key => {
      if (
        typeof saved.buttons[key] === 'string' &&
        saved.buttons[key].trim()
      ) {
        s.buttons[key] = saved.buttons[key];
      }
    });
  }

  if (saved.contacts && typeof saved.contacts === 'object') {
    Object.keys(s.contacts).forEach(key => {
      if (
        typeof saved.contacts[key] === 'string' &&
        saved.contacts[key].trim()
      ) {
        s.contacts[key] = saved.contacts[key];
      }
    });
  }

  return s;
}

// ========================================
// تحميل وحفظ البيانات
// ========================================

function loadData() {
  const fresh = {
    settings: clone(DEFAULT_SETTINGS),
    accounts: [],
    nextAccountNumber: 1,
    ratings: [],
    ratedUsers: {},
    reviews: []
  };

  if (!fs.existsSync(DATA_FILE)) return fresh;

  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

    fresh.settings = mergeSettings(raw.settings);

    if (Array.isArray(raw.accounts)) {
      fresh.accounts = raw.accounts.filter(
        a => a && typeof a.number === 'string'
      );
    }

    if (Array.isArray(raw.ratings)) {
      fresh.ratings = raw.ratings.filter(
        r => Number.isInteger(r) && r >= 1 && r <= 5
      );
    }

    if (
      raw.ratedUsers &&
      typeof raw.ratedUsers === 'object' &&
      !Array.isArray(raw.ratedUsers)
    ) {
      fresh.ratedUsers = raw.ratedUsers;
    }

    if (Array.isArray(raw.reviews)) {
      fresh.reviews = raw.reviews;
    }

    const maxNumber = fresh.accounts.reduce(
      (max, a) =>
        Math.max(max, parseInt(a.number.replace('#', ''), 10) || 0),
      0
    );

    fresh.nextAccountNumber = Math.max(
      parseInt(raw.nextAccountNumber, 10) || 1,
      maxNumber + 1
    );

    return fresh;

  } catch (error) {

    console.log(
      '❌ ملف البيانات تالف، تم حفظ نسخة منه وبدء ملف جديد:',
      error.message
    );

    try {
      fs.copyFileSync(
        DATA_FILE,
        `${DATA_FILE}.corrupt-${Date.now()}`
      );
    } catch (_) {}

    return fresh;
  }
}

const db = loadData();

function saveData() {
  try {
    const tmp = `${DATA_FILE}.tmp`;

    fs.writeFileSync(
      tmp,
      JSON.stringify(db, null, 2),
      'utf8'
    );

    fs.renameSync(tmp, DATA_FILE);

    return true;

  } catch (error) {

    console.log(
      '❌ تعذر حفظ البيانات:',
      error.message
    );

    return false;
  }
}

// ========================================
// تخزين الحسابات والتقييمات (محفوظة في الملف)
// ========================================

const accounts = db.accounts;
const ratings = db.ratings;
const ratedUsers = db.ratedUsers;

// المستخدم الذي ينتظر كتابة ملاحظة
const waitingForReview = new Set();

// حالة تعديل المالك (انتظار نص جديد)
const ownerState = new Map();

// ========================================
// تجميع صور الألبوم
// ========================================

const mediaGroups = new Map();

// ========================================
// أزرار البوت
// ========================================

function keyboardFor(userId) {

  const b = db.settings.buttons;

  const rows = [
    [b.latest, b.search],
    [b.publish, b.charge],
    [b.rating, b.contact],
    [b.contests]
  ];

  if (isOwner(userId)) {
    rows.push([OWNER_BUTTON]);
  }

  return {
    reply_markup: {
      keyboard: rows,
      resize_keyboard: true,
      persistent: true
    }
  };
}

function buttonKey(text) {

  const b = db.settings.buttons;

  return Object.keys(b).find(key => b[key] === text) || null;
}

// ========================================
// جهات التواصل
// ========================================

function normalizeHandles(str) {

  return String(str || '')
    .split(/[\s,،]+/)
    .map(t => t.trim())
    .filter(Boolean)
    .map(t =>
      /^[A-Za-z0-9_]{3,32}$/.test(t) ? `@${t}` : t
    );
}

function validHandle(t) {
  return /^(@[A-Za-z0-9_]{3,32}|https?:\/\/\S+)$/.test(t);
}

function contactLines(which) {

  return normalizeHandles(
    db.settings.contacts[which]
  ).join('\n');
}

function fillContact(text, which) {

  return String(text).replace(
    /\{contact\}/g,
    contactLines(which)
  );
}

// ========================================
// /start
// ========================================

bot.onText(/\/start/, (msg) => {

  const userId = msg.from ? msg.from.id : msg.chat.id;

  ownerState.delete(userId);

  bot.sendMessage(
    msg.chat.id,
    db.settings.welcome,
    keyboardFor(userId)
  );
});

// ========================================
// إنشاء رقم الحساب
// ========================================

function createAccountNumber() {
  const number = String(db.nextAccountNumber).padStart(3, '0');
  return `#${number}`;
}

// ========================================
// البحث عن الحساب بالرقم
// ========================================

function findAccountByNumber(input) {
  if (!input) return null;

  let search = String(input).trim().toLowerCase();

  search = search.replace('#', '');

  const number = parseInt(search, 10);

  if (isNaN(number)) {
    return null;
  }

  const formatted = String(number).padStart(3, '0');

  return accounts.find(
    account =>
      account.number.replace('#', '') === formatted
  ) || null;
}

// ========================================
// إرسال الحساب مع جميع الصور
// ========================================

async function sendSelectedAccount(chatId, account, userId) {

  const kb = keyboardFor(
    userId !== undefined ? userId : chatId
  );

  if (!account) {
    return bot.sendMessage(
      chatId,
      `❌ هذا الحساب غير موجود.`,
      kb
    );
  }

  if (
    account.photos &&
    account.photos.length > 0
  ) {
    try {
      const media = account.photos.map(
        (photo, index) => {
          const item = {
            type: 'photo',
            media: photo
          };

          if (index === 0) {
            item.caption =
              `🧾 رقم الحساب: ${account.number}\n\n` +
              account.text;
          }

          return item;
        }
      );

      await bot.sendMediaGroup(
        chatId,
        media.slice(0, 10)
      );

      return;

    } catch (error) {
      console.log(
        'تعذر إرسال الصور كألبوم:',
        error.message
      );
    }
  }

  return bot.sendMessage(
    chatId,
    `🧾 رقم الحساب: ${account.number}

${account.text}

━━━━━━━━━━━━━━`,
    kb
  );
}

// ========================================
// حفظ حساب جديد
// ========================================

async function saveAccount(messages) {
  try {
    if (!messages || messages.length === 0) {
      return;
    }

    messages.sort(
      (a, b) => a.message_id - b.message_id
    );

    const firstMessage = messages[0];

    const text =
      firstMessage.text ||
      firstMessage.caption ||
      '';

    if (
      !text.includes('ببجي') &&
      !text.includes('بـبـجي') &&
      !text.toLowerCase().includes('pubg')
    ) {
      return;
    }

    const alreadyExists = accounts.find(
      account =>
        account.messageId === firstMessage.message_id
    );

    if (alreadyExists) {
      return;
    }

    const accountNumber =
      createAccountNumber();

    const photos = [];

    messages.forEach(message => {
      if (
        message.photo &&
        message.photo.length > 0
      ) {
        const lastPhoto =
          message.photo[
            message.photo.length - 1
          ];

        photos.push(lastPhoto.file_id);
      }
    });

    const account = {
      number: accountNumber,
      messageId: firstMessage.message_id,
      text: text,
      photos: photos,
      date: Date.now()
    };

    accounts.push(account);

    db.nextAccountNumber++;

    saveData();

    console.log(
      `✅ تم حفظ الحساب ${accountNumber} | الصور: ${photos.length}`
    );

    if (!text.includes('🧾 رقم الحساب:')) {

      const newText =
        `🧾 رقم الحساب: ${accountNumber}\n\n` +
        text;

      try {

        if (firstMessage.caption !== undefined) {

          await bot.editMessageCaption(
            newText,
            {
              chat_id: firstMessage.chat.id,
              message_id:
                firstMessage.message_id
            }
          );

        } else if (firstMessage.text) {

          await bot.editMessageText(
            newText,
            {
              chat_id: firstMessage.chat.id,
              message_id:
                firstMessage.message_id
            }
          );
        }

        account.text = newText;

        saveData();

      } catch (error) {

        console.log(
          'تعذر إضافة رقم الحساب للمنشور:',
          error.message
        );

      }
    }

  } catch (error) {

    console.log(
      '❌ خطأ أثناء حفظ الحساب:',
      error.message
    );

  }
}

// ========================================
// استقبال منشورات القناة
// ========================================

bot.on('channel_post', async (msg) => {

  try {

    if (!msg.chat.username) return;

    if (
      msg.chat.username.toLowerCase() !==
      CHANNEL_USERNAME.toLowerCase()
    ) {
      return;
    }

    if (msg.media_group_id) {

      if (!mediaGroups.has(msg.media_group_id)) {

        mediaGroups.set(
          msg.media_group_id,
          []
        );

      }

      const group =
        mediaGroups.get(msg.media_group_id);

      group.push(msg);

      if (group.timer) {
        clearTimeout(group.timer);
      }

      group.timer = setTimeout(
        async () => {

          const messages =
            mediaGroups.get(
              msg.media_group_id
            );

          mediaGroups.delete(
            msg.media_group_id
          );

          if (messages) {
            await saveAccount(messages);
          }

        },
        2000
      );

      return;
    }

    await saveAccount([msg]);

  } catch (error) {

    console.log(
      '❌ خطأ في منشور القناة:',
      error.message
    );

  }

});

// ========================================
// حساب متوسط التقييم
// ========================================

function getRatingInfo() {

  if (ratings.length === 0) {

    return {
      average: '0.0',
      count: 0
    };

  }

  const total =
    ratings.reduce(
      (sum, rating) => sum + rating,
      0
    );

  const average =
    total / ratings.length;

  return {
    average: average.toFixed(1),
    count: ratings.length
  };
}

// ========================================
// النجوم حسب المتوسط
// ========================================

function getStars(average) {

  const rounded =
    Math.round(Number(average));

  let stars = '';

  for (let i = 1; i <= 5; i++) {

    if (i <= rounded) {
      stars += '⭐';
    } else {
      stars += '☆';
    }

  }

  return stars;
}

// ========================================
// عرض التقييم
// ========================================

function showRating(chatId) {

  const info = getRatingInfo();

  const stars =
    getStars(info.average);

  return bot.sendMessage(
    chatId,
    `⭐ تقييم خدمة BRAND | PUBG

${stars}

⭐ المتوسط: ${info.average} / 5
👥 عدد التقييمات: ${info.count}

👇 اختر تقييمك من 1 إلى 5 نجوم:`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '⭐',
              callback_data: 'rate_1'
            },
            {
              text: '⭐⭐',
              callback_data: 'rate_2'
            },
            {
              text: '⭐⭐⭐',
              callback_data: 'rate_3'
            }
          ],
          [
            {
              text: '⭐⭐⭐⭐',
              callback_data: 'rate_4'
            },
            {
              text: '⭐⭐⭐⭐⭐',
              callback_data: 'rate_5'
            }
          ],
          [
            {
              text: '📊 مشاهدة التقييمات',
              callback_data: 'show_ratings'
            }
          ]
        ]
      }
    }
  );

}

// ========================================
// لوحة تحكم المالك
// ========================================

const TEXT_FIELDS = {
  welcome: {
    label: '👋 رسالة الترحيب',
    hint: ''
  },
  publishMsg: {
    label: '📋 رسالة طلب نشر الحسابات',
    hint:
      '\n\n💡 اكتب {contact} في المكان الذي تريد ظهور جهة التواصل فيه، ويتم استبدالها تلقائيًا من إعدادات جهات التواصل.'
  },
  pricesMsg: {
    label: '💎 أسعار الشحن',
    hint:
      '\n\n💡 اكتب {contact} في المكان الذي تريد ظهور جهة التواصل فيه، ويتم استبدالها تلقائيًا من إعدادات جهات التواصل.'
  },
  contestsMsg: {
    label: '🎁 رسالة المسابقات',
    hint: ''
  }
};

const BUTTON_LABELS = {
  latest: 'آخر الحسابات',
  search: 'البحث عن حساب',
  publish: 'طلب نشر حساب',
  charge: 'شحن UC والألعاب',
  rating: 'تقييم الخدمة',
  contact: 'التواصل مع الإدارة',
  contests: 'المسابقات والسحوبات'
};

const CONTACT_LABELS = {
  publish: '📋 طلب نشر الحساب',
  charge: '💎 شحن UC والألعاب',
  admin: '📞 التواصل مع الإدارة'
};

const ACCOUNTS_PAGE_SIZE = 8;

function panelMarkup() {

  return {
    inline_keyboard: [
      [
        { text: TEXT_FIELDS.welcome.label, callback_data: 'own_edit_welcome' },
        { text: '🔘 أسماء الأزرار', callback_data: 'own_buttons' }
      ],
      [
        { text: TEXT_FIELDS.publishMsg.label, callback_data: 'own_edit_publishMsg' }
      ],
      [
        { text: TEXT_FIELDS.pricesMsg.label, callback_data: 'own_edit_pricesMsg' },
        { text: TEXT_FIELDS.contestsMsg.label, callback_data: 'own_edit_contestsMsg' }
      ],
      [
        { text: '📞 جهات التواصل', callback_data: 'own_contacts' }
      ],
      [
        { text: '🧾 إدارة الحسابات', callback_data: 'own_accounts_0' },
        { text: '⭐ التقييمات', callback_data: 'own_ratings' }
      ],
      [
        { text: '❌ إغلاق', callback_data: 'own_close' }
      ]
    ]
  };
}

const PANEL_TEXT = '⚙️ لوحة تحكم المالك\n\nاختر ما تريد تعديله 👇';

function sendPanel(chatId) {

  return bot.sendMessage(
    chatId,
    PANEL_TEXT,
    { reply_markup: panelMarkup() }
  );
}

function backToPanelMarkup() {

  return {
    inline_keyboard: [
      [{ text: '⚙️ لوحة التحكم', callback_data: 'own_menu' }]
    ]
  };
}

function cancelMarkup(extraRow) {

  const rows = [];

  if (extraRow) rows.push(extraRow);

  rows.push([
    { text: '✖️ إلغاء', callback_data: 'own_cancel' }
  ]);

  return { inline_keyboard: rows };
}

// تعديل رسالة الأزرار الحالية أو إرسال جديدة
async function show(query, text, markup) {

  try {

    await bot.editMessageText(
      text,
      {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
        reply_markup: markup || { inline_keyboard: [] }
      }
    );

  } catch (error) {

    if (/not modified/i.test(error.message)) return;

    await bot.sendMessage(
      query.message.chat.id,
      text,
      { reply_markup: markup || { inline_keyboard: [] } }
    );
  }
}

function snippet(account) {

  const t =
    String(account.text || '')
      .replace(/🧾 رقم الحساب:\s*#\d+/, '')
      .trim()
      .split('\n')[0] || '—';

  return t.slice(0, 40);
}

function accountsPage(page) {

  const list = accounts.slice().reverse();

  const pages = Math.max(
    1,
    Math.ceil(list.length / ACCOUNTS_PAGE_SIZE)
  );

  page = Math.min(Math.max(page, 0), pages - 1);

  const slice = list.slice(
    page * ACCOUNTS_PAGE_SIZE,
    (page + 1) * ACCOUNTS_PAGE_SIZE
  );

  if (list.length === 0) {

    return {
      text: '🧾 إدارة الحسابات\n\nلا توجد حسابات محفوظة حاليًا.',
      markup: backToPanelMarkup()
    };
  }

  const lines = slice.map(
    a => `${a.number} — ${snippet(a)}`
  );

  const rows = slice.map(a => {

    const n = a.number.replace('#', '');

    return [
      { text: `👁 ${a.number}`, callback_data: `own_view_${n}` },
      { text: `🗑 حذف ${a.number}`, callback_data: `own_del_${n}` }
    ];
  });

  const nav = [];

  if (page > 0) {
    nav.push({
      text: '⬅️ الأحدث',
      callback_data: `own_accounts_${page - 1}`
    });
  }

  if (page < pages - 1) {
    nav.push({
      text: 'الأقدم ➡️',
      callback_data: `own_accounts_${page + 1}`
    });
  }

  if (nav.length) rows.push(nav);

  rows.push([
    { text: '⚙️ لوحة التحكم', callback_data: 'own_menu' }
  ]);

  return {
    text:
      `🧾 إدارة الحسابات (${list.length})\n` +
      `صفحة ${page + 1} / ${pages}\n\n` +
      lines.join('\n') +
      `\n\n⚠️ الحذف من بيانات البوت فقط، ولا يحذف منشور القناة.`,
    markup: { inline_keyboard: rows }
  };
}

function ratingsReport() {

  const info = getRatingInfo();

  const counts = [5, 4, 3, 2, 1].map(
    star =>
      `${'⭐'.repeat(star)}: ${ratings.filter(r => r === star).length}`
  );

  const notes =
    db.reviews
      .slice(-10)
      .reverse()
      .map(r => `${'⭐'.repeat(r.rating || 0)} ${r.note}`)
      .join('\n\n');

  let text =
    `⭐ التقييمات\n\n` +
    `${getStars(info.average)}\n` +
    `المتوسط: ${info.average} / 5\n` +
    `عدد التقييمات: ${info.count}\n\n` +
    counts.join('\n') +
    `\n\n📝 آخر الملاحظات:\n\n` +
    (notes || 'لا توجد ملاحظات بعد.');

  if (text.length > 4000) {
    text = text.slice(0, 3990) + '…';
  }

  return text;
}

// ========================================
// استقبال تعديلات المالك (نصوص)
// ========================================

async function handleOwnerInput(msg, state) {

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const raw = msg.text;
  const value = raw.trim();

  if (state.type === 'field') {

    if (value.length === 0 || value.length > 4000) {
      return bot.sendMessage(
        chatId,
        '❌ النص لازم يكون بين 1 و 4000 حرف. أرسله من جديد أو اضغط إلغاء.',
        { reply_markup: cancelMarkup() }
      );
    }

    db.settings[state.field] = value;

    ownerState.delete(userId);

    const ok = saveData();

    return bot.sendMessage(
      chatId,
      ok
        ? `✅ تم حفظ: ${TEXT_FIELDS[state.field].label}`
        : '⚠️ تم التعديل لكن تعذر الحفظ في الملف، راجع إعدادات الاستضافة.',
      { reply_markup: backToPanelMarkup() }
    );
  }

  if (state.type === 'button') {

    if (value.length === 0 || value.length > 40 || value.includes('\n')) {
      return bot.sendMessage(
        chatId,
        '❌ اسم الزر لازم يكون سطر واحد وأقل من 40 حرف. أرسله من جديد أو اضغط إلغاء.',
        { reply_markup: cancelMarkup() }
      );
    }

    const used =
      value === OWNER_BUTTON ||
      Object.keys(db.settings.buttons).some(
        key =>
          key !== state.key &&
          db.settings.buttons[key] === value
      );

    if (used) {
      return bot.sendMessage(
        chatId,
        '❌ هذا الاسم مستخدم لزر آخر. اختر اسمًا مختلفًا أو اضغط إلغاء.',
        { reply_markup: cancelMarkup() }
      );
    }

    db.settings.buttons[state.key] = value;

    ownerState.delete(userId);

    const ok = saveData();

    await bot.sendMessage(
      chatId,
      ok
        ? `✅ تم تغيير اسم الزر إلى: ${value}`
        : '⚠️ تم التعديل لكن تعذر الحفظ في الملف.',
      keyboardFor(userId)
    );

    return bot.sendMessage(
      chatId,
      '⚙️ للرجوع للوحة التحكم:',
      { reply_markup: backToPanelMarkup() }
    );
  }

  if (state.type === 'contact') {

    const handles = normalizeHandles(value);

    if (
      handles.length === 0 ||
      !handles.every(validHandle)
    ) {
      return bot.sendMessage(
        chatId,
        '❌ أرسل يوزر واحد أو أكثر مثل: @username (افصل بينها بمسافة). أرسله من جديد أو اضغط إلغاء.',
        { reply_markup: cancelMarkup() }
      );
    }

    db.settings.contacts[state.which] = handles.join(' ');

    ownerState.delete(userId);

    const ok = saveData();

    return bot.sendMessage(
      chatId,
      ok
        ? `✅ تم حفظ جهة التواصل (${CONTACT_LABELS[state.which]}):\n${handles.join('\n')}`
        : '⚠️ تم التعديل لكن تعذر الحفظ في الملف.',
      { reply_markup: backToPanelMarkup() }
    );
  }
}

// ========================================
// أزرار لوحة المالك
// ========================================

async function handleOwnerCallback(query) {

  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const d = query.data;

  if (d === 'own_menu') {
    ownerState.delete(userId);
    return show(query, PANEL_TEXT, panelMarkup());
  }

  if (d === 'own_close') {
    ownerState.delete(userId);
    try {
      await bot.deleteMessage(chatId, query.message.message_id);
    } catch (_) {}
    return;
  }

  if (d === 'own_cancel') {
    ownerState.delete(userId);
    return show(query, '✖️ تم الإلغاء.', backToPanelMarkup());
  }

  // ---------- تعديل النصوص ----------

  if (d.startsWith('own_edit_')) {

    const field = d.replace('own_edit_', '');

    if (!TEXT_FIELDS[field]) return;

    ownerState.set(userId, { type: 'field', field });

    await bot.sendMessage(
      chatId,
      `📝 ${TEXT_FIELDS[field].label}\n\nالنص الحالي:`
    );

    await bot.sendMessage(chatId, db.settings[field]);

    return bot.sendMessage(
      chatId,
      `✏️ أرسل النص الجديد الآن.${TEXT_FIELDS[field].hint}`,
      {
        reply_markup: cancelMarkup([
          {
            text: '↩️ استرجاع الافتراضي',
            callback_data: `own_def_${field}`
          }
        ])
      }
    );
  }

  if (d.startsWith('own_def_')) {

    const field = d.replace('own_def_', '');

    if (!TEXT_FIELDS[field]) return;

    db.settings[field] = DEFAULT_SETTINGS[field];

    ownerState.delete(userId);

    saveData();

    return show(
      query,
      `✅ تم استرجاع النص الافتراضي: ${TEXT_FIELDS[field].label}`,
      backToPanelMarkup()
    );
  }

  // ---------- أسماء الأزرار ----------

  if (d === 'own_buttons') {

    const rows = Object.keys(BUTTON_LABELS).map(key => [
      {
        text: `🔘 ${db.settings.buttons[key]}`,
        callback_data: `own_btn_${key}`
      }
    ]);

    rows.push([
      { text: '⚙️ لوحة التحكم', callback_data: 'own_menu' }
    ]);

    return show(
      query,
      '🔘 أسماء الأزرار\n\nاختر الزر الذي تريد تغيير اسمه:',
      { inline_keyboard: rows }
    );
  }

  if (d.startsWith('own_btn_')) {

    const key = d.replace('own_btn_', '');

    if (!BUTTON_LABELS[key]) return;

    ownerState.set(userId, { type: 'button', key });

    return bot.sendMessage(
      chatId,
      `🔘 الاسم الحالي: ${db.settings.buttons[key]}\n\n✏️ أرسل الاسم الجديد للزر (يمكنك استخدام إيموجي):`,
      { reply_markup: cancelMarkup() }
    );
  }

  // ---------- جهات التواصل ----------

  if (d === 'own_contacts') {

    const c = db.settings.contacts;

    const rows = Object.keys(CONTACT_LABELS).map(which => [
      {
        text: `${CONTACT_LABELS[which]}`,
        callback_data: `own_contact_${which}`
      }
    ]);

    rows.push([
      { text: '⚙️ لوحة التحكم', callback_data: 'own_menu' }
    ]);

    return show(
      query,
      `📞 جهات التواصل\n\n` +
      `📋 نشر الحساب: ${c.publish}\n` +
      `💎 الشحن والألعاب: ${c.charge}\n` +
      `📞 الإدارة: ${c.admin}\n\n` +
      `اختر ما تريد تعديله:`,
      { inline_keyboard: rows }
    );
  }

  if (d.startsWith('own_contact_')) {

    const which = d.replace('own_contact_', '');

    if (!CONTACT_LABELS[which]) return;

    ownerState.set(userId, { type: 'contact', which });

    return bot.sendMessage(
      chatId,
      `${CONTACT_LABELS[which]}\n\nالحالي: ${db.settings.contacts[which]}\n\n✏️ أرسل اليوزر الجديد مثل @username (يمكن أكثر من يوزر مفصولين بمسافة):`,
      { reply_markup: cancelMarkup() }
    );
  }

  // ---------- إدارة الحسابات ----------

  if (d.startsWith('own_accounts_')) {

    const page = parseInt(d.replace('own_accounts_', ''), 10) || 0;

    const p = accountsPage(page);

    return show(query, p.text, p.markup);
  }

  if (d.startsWith('own_view_')) {

    const account = findAccountByNumber(d.replace('own_view_', ''));

    return sendSelectedAccount(chatId, account, userId);
  }

  if (d.startsWith('own_del_')) {

    const account = findAccountByNumber(d.replace('own_del_', ''));

    if (!account) {
      return show(query, '❌ هذا الحساب غير موجود.', backToPanelMarkup());
    }

    const n = account.number.replace('#', '');

    return show(
      query,
      `🗑 هل تريد حذف الحساب ${account.number} من بيانات البوت؟\n\n${snippet(account)}\n\n⚠️ لا يحذف منشور القناة، ولا يمكن التراجع.`,
      {
        inline_keyboard: [
          [
            { text: '✅ نعم، احذف', callback_data: `own_delok_${n}` },
            { text: '✖️ لا', callback_data: 'own_accounts_0' }
          ]
        ]
      }
    );
  }

  if (d.startsWith('own_delok_')) {

    const account = findAccountByNumber(d.replace('own_delok_', ''));

    if (!account) {
      return show(query, '❌ هذا الحساب غير موجود.', backToPanelMarkup());
    }

    accounts.splice(accounts.indexOf(account), 1);

    saveData();

    const p = accountsPage(0);

    return show(
      query,
      `✅ تم حذف الحساب ${account.number}\n\n${p.text}`,
      p.markup
    );
  }

  // ---------- التقييمات ----------

  if (d === 'own_ratings') {
    return show(query, ratingsReport(), backToPanelMarkup());
  }
}

// ========================================
// أوامر المالك
// ========================================

bot.onText(/^\/admin(@\w+)?$/, async (msg) => {

  try {

    const userId = msg.from ? msg.from.id : null;

    if (!isOwner(userId) || msg.chat.type !== 'private') {
      return bot.sendMessage(
        msg.chat.id,
        '⛔ هذه الخدمة للمالك فقط.',
        keyboardFor(userId)
      );
    }

    ownerState.delete(userId);

    return sendPanel(msg.chat.id);

  } catch (error) {

    console.log('❌ خطأ في /admin:', error.message);

  }
});

bot.onText(/^\/cancel(@\w+)?$/, async (msg) => {

  try {

    const userId = msg.from ? msg.from.id : null;

    if (isOwner(userId) && ownerState.has(userId)) {

      ownerState.delete(userId);

      return bot.sendMessage(
        msg.chat.id,
        '✖️ تم الإلغاء.',
        { reply_markup: backToPanelMarkup() }
      );
    }

  } catch (error) {

    console.log('❌ خطأ في /cancel:', error.message);

  }
});

// ========================================
// رسائل المستخدمين
// ========================================

bot.on('message', async (msg) => {

  try {

    const chatId = msg.chat.id;
    const text = msg.text;
    const userId = msg.from ? msg.from.id : chatId;

    if (
      !text ||
      /^\/(start|admin|cancel)(@\w+)?(\s|$)/.test(text)
    ) {
      return;
    }

    const kb = keyboardFor(userId);

    const ownerPrivate =
      isOwner(userId) &&
      msg.chat.type === 'private';

    const menuKey = buttonKey(text);

    // ====================================
    // زر لوحة تحكم المالك
    // ====================================

    if (text === OWNER_BUTTON) {

      if (!ownerPrivate) {
        return bot.sendMessage(
          chatId,
          '⛔ هذه الخدمة للمالك فقط.',
          kb
        );
      }

      ownerState.delete(userId);

      return sendPanel(chatId);
    }

    // ====================================
    // المالك ينتظر منه نص جديد
    // ====================================

    if (ownerPrivate && ownerState.has(userId)) {

      if (menuKey) {
        ownerState.delete(userId);
      } else {
        return handleOwnerInput(
          msg,
          ownerState.get(userId)
        );
      }
    }

    // ====================================
    // إذا المستخدم ينتظر كتابة الملاحظة
    // ====================================

    if (waitingForReview.has(chatId)) {

      waitingForReview.delete(chatId);

      db.reviews.push({
        rating: ratedUsers[chatId] || 0,
        note: text.slice(0, 500),
        date: Date.now()
      });

      if (db.reviews.length > 1000) {
        db.reviews.splice(0, db.reviews.length - 1000);
      }

      saveData();

      return bot.sendMessage(
        chatId,
        `❤️ شكراً لك على تقييمك!

تم استلام ملاحظتك بنجاح.

⭐ تقييمك محفوظ معنا.`,
        kb
      );

    }

    // ====================================
    // آخر الحسابات
    // ====================================

    if (menuKey === 'latest') {

      if (accounts.length === 0) {

        return bot.sendMessage(
          chatId,
          `🔥 آخر الحسابات:

لا توجد حسابات منشورة بعد.`,
          kb
        );

      }

      const latest =
        accounts
          .slice(-10)
          .reverse();

      const buttons = [];

      latest.forEach(account => {

        buttons.push([
          {
            text:
              `🧾 ${account.number}`,

            callback_data:
              `account_${account.number.replace('#', '')}`
          }
        ]);

      });

      buttons.push([
        {
          text: '🏠 القائمة الرئيسية',
          callback_data: 'main_menu'
        }
      ]);

      return bot.sendMessage(
        chatId,
        `🔥 آخر الحسابات

اختر رقم الحساب الذي تريد رؤيته 👇`,
        {
          reply_markup: {
            inline_keyboard: buttons
          }
        }
      );

    }

    // ====================================
    // البحث
    // ====================================

    if (menuKey === 'search') {

      return bot.sendMessage(
        chatId,
        `🔍 أرسل رقم الحساب الذي تريد البحث عنه.

مثال:

001

أو:

#001`,
        kb
      );

    }

    // ====================================
    // طلب نشر حساب
    // ====================================

    if (menuKey === 'publish') {

      return bot.sendMessage(
        chatId,
        fillContact(db.settings.publishMsg, 'publish'),
        kb
      );

    }

    // ====================================
    // شحن UC
    // ====================================

    if (menuKey === 'charge') {

      return bot.sendMessage(
        chatId,
        fillContact(db.settings.pricesMsg, 'charge'),
        kb
      );

    }

    // ====================================
    // تقييم الخدمة
    // ====================================

    if (menuKey === 'rating') {

      return showRating(chatId);

    }

    // ====================================
    // التواصل مع الإدارة
    // ====================================

    if (menuKey === 'contact') {

      const lines =
        normalizeHandles(db.settings.contacts.admin)
          .map(h => `👤 ${h}`)
          .join('\n');

      return bot.sendMessage(
        chatId,
        `📞 للتواصل مع الإدارة:

${lines}`,
        kb
      );

    }

    // ====================================
    // المسابقات والسحوبات
    // ====================================

    if (menuKey === 'contests') {

      return bot.sendMessage(
        chatId,
        db.settings.contestsMsg,
        kb
      );

    }

    // ====================================
    // البحث المباشر بالرقم
    // ====================================

    const accountByNumber =
      findAccountByNumber(text);

    if (accountByNumber) {

      return sendSelectedAccount(
        chatId,
        accountByNumber,
        userId
      );

    }

    // ====================================
    // البحث بالكلمة أو الاسم
    // ====================================

    const search =
      text.trim().toLowerCase();

    if (search.length > 0) {

      const results =
        accounts.filter(account => {

          return (
            account.number
              .toLowerCase()
              .includes(search) ||

            account.text
              .toLowerCase()
              .includes(search)
          );

        });

      if (results.length === 0) {

        return bot.sendMessage(
          chatId,
          `❌ لم يتم العثور على حساب مطابق.

جرّب رقم حساب مثل:

#001`,
          kb
        );

      }

      if (results.length === 1) {

        return sendSelectedAccount(
          chatId,
          results[0],
          userId
        );

      }

      const buttons = [];

      results
        .slice(0, 10)
        .forEach(account => {

          buttons.push([
            {
              text:
                `🧾 ${account.number}`,

              callback_data:
                `account_${account.number.replace('#', '')}`
            }
          ]);

        });

      return bot.sendMessage(
        chatId,
        `🔎 تم العثور على ${results.length} حساب.

اختر الحساب الذي تريد رؤيته 👇`,
        {
          reply_markup: {
            inline_keyboard: buttons
          }
        }
      );

    }

  } catch (error) {

    console.log(
      '❌ خطأ في رسالة المستخدم:',
      error.message
    );

  }

});

// ========================================
// أزرار الحسابات + التقييم
// ========================================

bot.on('callback_query', async (query) => {

  try {

    const chatId =
      query.message.chat.id;

    const userId =
      query.from.id;

    const data =
      query.data;

    // ====================================
    // أزرار المالك: ممنوعة على أي شخص آخر
    // ====================================

    if (data.startsWith('own_')) {

      if (
        !isOwner(userId) ||
        query.message.chat.type !== 'private'
      ) {

        return bot.answerCallbackQuery(
          query.id,
          {
            text: '⛔ هذه الخدمة للمالك فقط.',
            show_alert: true
          }
        );

      }

      await bot.answerCallbackQuery(
        query.id
      );

      return handleOwnerCallback(query);

    }

    await bot.answerCallbackQuery(
      query.id
    );

    const kb = keyboardFor(userId);

    // ====================================
    // القائمة الرئيسية
    // ====================================

    if (data === 'main_menu') {

      return bot.sendMessage(
        chatId,
        db.settings.welcome,
        kb
      );

    }

    // ====================================
    // عرض التقييمات
    // ====================================

    if (data === 'show_ratings') {

      const info =
        getRatingInfo();

      const stars =
        getStars(info.average);

      return bot.sendMessage(
        chatId,
        `📊 تقييم BRAND | PUBG

${stars}

⭐ المتوسط: ${info.average} / 5
👥 عدد التقييمات: ${info.count}

الحد الأقصى للتقييم: ⭐⭐⭐⭐⭐`,
        kb
      );

    }

    // ====================================
    // تقييم من 1 إلى 5
    // ====================================

    if (data.startsWith('rate_')) {

      const rating =
        parseInt(
          data.replace('rate_', ''),
          10
        );

      if (
        isNaN(rating) ||
        rating < 1 ||
        rating > 5
      ) {

        return bot.sendMessage(
          chatId,
          `❌ التقييم يجب أن يكون من 1 إلى 5 نجوم.`,
          kb
        );

      }

      // منع التقييم أكثر من مرة
      if (
        Object.prototype.hasOwnProperty.call(
          ratedUsers,
          chatId
        )
      ) {

        const info =
          getRatingInfo();

        return bot.sendMessage(
          chatId,
          `⚠️ أنت قيّمت الخدمة مسبقاً.

⭐ المتوسط الحالي: ${info.average} / 5
👥 عدد التقييمات: ${info.count}`,
          kb
        );

      }

      ratings.push(rating);

      ratedUsers[chatId] = rating;

      saveData();

      const info =
        getRatingInfo();

      return bot.sendMessage(
        chatId,
        `❤️ شكراً لك على تقييمك!

${'⭐'.repeat(rating)}

تم تسجيل تقييمك بنجاح.

⭐ المتوسط الحالي: ${info.average} / 5
👥 عدد التقييمات: ${info.count}

هل تريد إضافة ملاحظة؟`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '📝 إضافة ملاحظة',
                  callback_data: 'add_review'
                }
              ],
              [
                {
                  text: '🏠 القائمة الرئيسية',
                  callback_data: 'main_menu'
                }
              ]
            ]
          }
        }
      );

    }

    // ====================================
    // إضافة ملاحظة
    // ====================================

    if (data === 'add_review') {

      waitingForReview.add(chatId);

      return bot.sendMessage(
        chatId,
        `📝 اكتب ملاحظتك الآن:

رأيك يساعدنا على تحسين الخدمة ❤️`
      );

    }

    // ====================================
    // اختيار حساب
    // ====================================

    if (data.startsWith('account_')) {

      const number =
        data.replace(
          'account_',
          ''
        );

      const account =
        findAccountByNumber(number);

      if (!account) {

        return bot.sendMessage(
          chatId,
          `❌ هذا الحساب غير موجود.`,
          kb
        );

      }

      return sendSelectedAccount(
        chatId,
        account,
        userId
      );

    }

  } catch (error) {

    console.log(
      '❌ خطأ في الزر:',
      error.message
    );

  }

});

// ========================================
// أخطاء البوت
// ========================================

bot.on('polling_error', error => {

  console.log(
    '❌ Polling Error:',
    error.message
  );

});

// ========================================
// تشغيل البوت
// ========================================

console.log(
  '================================'
);

console.log(
  '🔥 BRAND Libya Bot يعمل الآن'
);

console.log(
  '📡 القناة:',
  CHANNEL_USERNAME
);

console.log(
  '⭐ نظام التقييم: 1 - 5 نجوم'
);

console.log(
  '💾 ملف البيانات:',
  DATA_FILE
);

console.log(
  `📦 حسابات: ${accounts.length} | تقييمات: ${ratings.length}`
);

console.log(
  '================================'
);

