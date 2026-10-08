
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

const token = process.env.BOT_TOKEN;

if (!token) {
  console.error('❌ BOT_TOKEN غير موجود في متغيرات البيئة');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

const OWNER_ID = 7923337516;
const CHANNEL_USERNAME = 'Pubg_Libya_Store';
const DATA_FILE = path.join(__dirname, 'brand-data.json');

const DEFAULT_SETTINGS = {
  welcome: `🔥 مرحبًا بك في بوت BRAND Libya 🇱🇾

🎮 كل خدمات PUBG في مكان واحد

💎 شحن UC
🛒 بيع وشراء الحسابات
🎁 المسابقات والسحوبات
📞 تواصل معنا في أي وقت

👇 اختر الخدمة التي تريدها من الأزرار بالأسفل`,

  labels: {
    latest: '🔥 آخر الحسابات',
    search: '🔍 البحث عن حساب',
    publish: '📋 طلب نشر حساب',
    uc: '💎 شحن UC والألعاب',
    rating: '⭐ تقييم الخدمة',
    contact: '📞 التواصل مع الإدارة',
    contests: '🎁 المسابقات والسحوبات'
  },

  contacts: ['@dy_x2', '@violletry'],

  publishText: `📋 طلب نشر حساب

لإضافة حساب للبيع، أرسل بيانات الحساب وصوره هنا.

📞 للتواصل مع الإدارة:
@dy_x2
@violletry`,

  ucText: `🎮 شحن شدات PUBG

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
@violletry`,

  contactText: `📞 للتواصل مع الإدارة:

👤 @dy_x2
👤 @violletry`,

  contestsText: `🎁 المسابقات والسحوبات

تابع القناة لمعرفة آخر المسابقات والسحوبات.`
};

// ========================================
// تحميل البيانات المحفوظة
// ========================================

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const saved = JSON.parse(
        fs.readFileSync(DATA_FILE, 'utf8')
      );

      return {
        settings: {
          ...DEFAULT_SETTINGS,
          ...(saved.settings || {}),
          labels: {
            ...DEFAULT_SETTINGS.labels,
            ...((saved.settings || {}).labels || {})
          }
        },

        accounts: Array.isArray(saved.accounts)
          ? saved.accounts
          : [],

        nextAccountNumber:
          Number(saved.nextAccountNumber) || 1,

        ratings: Array.isArray(saved.ratings)
          ? saved.ratings
          : [],

        ratedUsers: Array.isArray(saved.ratedUsers)
          ? saved.ratedUsers
          : []
      };
    }
  } catch (error) {
    console.error(
      'تعذر قراءة ملف البيانات:',
      error.message
    );
  }

  return {
    settings: JSON.parse(
      JSON.stringify(DEFAULT_SETTINGS)
    ),
    accounts: [],
    nextAccountNumber: 1,
    ratings: [],
    ratedUsers: []
  };
}

const stored = loadData();

let settings = stored.settings;
const accounts = stored.accounts;
let nextAccountNumber = stored.nextAccountNumber;
const ratings = stored.ratings;
const ratedUsers = new Set(stored.ratedUsers);

const waitingForReview = new Set();
const pendingAdminInput = new Map();
const mediaGroups = new Map();

// ========================================
// حفظ البيانات
// ========================================

function saveData() {
  try {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({
        settings,
        accounts,
        nextAccountNumber,
        ratings,
        ratedUsers: [...ratedUsers]
      }, null, 2),
      'utf8'
    );
  } catch (error) {
    console.error(
      '❌ تعذر حفظ البيانات. تأكد أن الاستضافة تسمح بالكتابة:',
      error.message
    );
  }
}

// ========================================
// التحقق من المالك
// ========================================

function isOwner(userId) {
  return Number(userId) === OWNER_ID;
}

// ========================================
// لوحة الأزرار الرئيسية
// ========================================

function mainKeyboard(userId) {
  const rows = [
    [
      settings.labels.latest,
      settings.labels.search
    ],
    [
      settings.labels.publish,
      settings.labels.uc
    ],
    [
      settings.labels.rating,
      settings.labels.contact
    ],
    [
      settings.labels.contests
    ]
  ];

  if (isOwner(userId)) {
    rows.push(['⚙️ لوحة تحكم المالك']);
  }

  return {
    reply_markup: {
      keyboard: rows,
      resize_keyboard: true,
      persistent: true
    }
  };
}

// ========================================
// لوحة تحكم المالك
// ========================================

function ownerPanel() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '✏️ تعديل رسالة الترحيب',
            callback_data: 'admin_welcome'
          }
        ],
        [
          {
            text: '🧩 تعديل أسماء الأزرار',
            callback_data: 'admin_labels'
          }
        ],
        [
          {
            text: '💎 تعديل أسعار/رسالة الشحن',
            callback_data: 'admin_uc'
          }
        ],
        [
          {
            text: '👤 تعديل يوزرات التواصل',
            callback_data: 'admin_contacts'
          }
        ],
        [
          {
            text: '📋 تعديل رسالة طلب النشر',
            callback_data: 'admin_publish'
          }
        ],
        [
          {
            text: '🎁 تعديل رسالة المسابقات',
            callback_data: 'admin_contests'
          }
        ],
        [
          {
            text: '🎮 إدارة الحسابات',
            callback_data: 'admin_accounts'
          }
        ],
        [
          {
            text: '❌ إغلاق لوحة التحكم',
            callback_data: 'admin_close'
          }
        ]
      ]
    }
  };
}

// ========================================
// إنشاء رقم الحساب
// ========================================

function createAccountNumber() {
  return `#${String(nextAccountNumber).padStart(3, '0')}`;
}

// ========================================
// البحث عن الحساب بالرقم
// ========================================

function findAccountByNumber(input) {
  if (!input) return null;

  const number = parseInt(
    String(input).trim().replace('#', ''),
    10
  );

  if (Number.isNaN(number)) return null;

  const formatted = String(number).padStart(3, '0');

  return accounts.find(
    account =>
      account.number.replace('#', '') === formatted
  ) || null;
}

// ========================================
// إرسال الحساب مع الصور
// ========================================

async function sendSelectedAccount(
  chatId,
  account,
  userId
) {
  if (!account) {
    return bot.sendMessage(
      chatId,
      '❌ هذا الحساب غير موجود.',
      mainKeyboard(userId)
    );
  }

  if (account.photos && account.photos.length) {
    try {
      const media = account.photos
        .slice(0, 10)
        .map((photo, index) => {
          const item = {
            type: 'photo',
            media: photo
          };

          if (index === 0) {
            item.caption =
              `🧾 رقم الحساب: ${account.number}\n\n` +
              account.text;

            item.caption = item.caption.slice(0, 1024);
          }

          return item;
        });

      await bot.sendMediaGroup(chatId, media);
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
    mainKeyboard(userId)
  );
}

// ========================================
// حفظ حساب جديد من القناة
// ========================================

async function saveAccount(messages) {
  try {
    if (!messages || !messages.length) return;

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

    const alreadyExists = accounts.some(
      account =>
        account.chatId === firstMessage.chat.id &&
        account.messageId === firstMessage.message_id
    );

    if (alreadyExists) return;

    const photos = [];

    for (const message of messages) {
      if (message.photo && message.photo.length) {
        photos.push(
          message.photo[message.photo.length - 1].file_id
        );
      }
    }

    const number = createAccountNumber();

    const account = {
      number,
      chatId: firstMessage.chat.id,
      messageId: firstMessage.message_id,
      text: text.startsWith('🧾 رقم الحساب:')
        ? text
        : `🧾 رقم الحساب: ${number}\n\n${text}`,
      originalText: text,
      photos: photos.slice(0, 10),
      date: Date.now()
    };

    accounts.push(account);
    nextAccountNumber++;

    saveData();

    console.log(
      `✅ تم حفظ الحساب ${number} | الصور: ${photos.length}`
    );

    if (text && !text.includes('🧾 رقم الحساب:')) {
      try {
        if (firstMessage.caption !== undefined) {
          await bot.editMessageCaption(
            account.text,
            {
              chat_id: firstMessage.chat.id,
              message_id: firstMessage.message_id
            }
          );
        } else if (firstMessage.text) {
          await bot.editMessageText(
            account.text,
            {
              chat_id: firstMessage.chat.id,
              message_id: firstMessage.message_id
            }
          );
        }
      } catch (error) {
        console.log(
          'تعذر إضافة رقم الحساب للمنشور:',
          error.message
        );
      }
    }

  } catch (error) {
    console.error(
      '❌ خطأ أثناء حفظ الحساب:',
      error.message
    );
  }
}

// ========================================
// حساب متوسط التقييم
// ========================================

function getRatingInfo() {
  if (!ratings.length) {
    return {
      average: '0.0',
      count: 0
    };
  }

  return {
    average: (
      ratings.reduce(
        (sum, rating) => sum + rating,
        0
      ) / ratings.length
    ).toFixed(1),

    count: ratings.length
  };
}

// ========================================
// النجوم حسب المتوسط
// ========================================

function getStars(average) {
  const rounded = Math.round(Number(average));

  return Array.from(
    { length: 5 },
    (_, index) => index < rounded ? '⭐' : '☆'
  ).join('');
}

// ========================================
// عرض التقييم
// ========================================

function showRating(chatId, userId) {
  const info = getRatingInfo();

  return bot.sendMessage(
    chatId,
    `⭐ تقييم خدمة BRAND | PUBG

${getStars(info.average)}

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
// طلب نص من المالك
// ========================================

function askAdminForText(
  chatId,
  userId,
  key,
  prompt
) {
  if (!isOwner(userId)) {
    return bot.sendMessage(
      chatId,
      '⛔ هذا الخيار للمالك فقط.'
    );
  }

  pendingAdminInput.set(
    Number(userId),
    { key }
  );

  return bot.sendMessage(
    chatId,
    `${prompt}\n\nأرسل النص الجديد في رسالة واحدة. للإلغاء أرسل /cancel`
  );
}

// ========================================
// أمر البداية
// ========================================

bot.onText(/^\/start(?:@\w+)?$/, msg => {
  bot.sendMessage(
    msg.chat.id,
    settings.welcome,
    mainKeyboard(msg.from.id)
  );
});

// ========================================
// فتح لوحة المالك
// ========================================

bot.onText(/^\/admin(?:@\w+)?$/, msg => {
  if (!isOwner(msg.from.id)) {
    return bot.sendMessage(
      msg.chat.id,
      '⛔ لوحة التحكم مخصصة لمالك البوت فقط.'
    );
  }

  return bot.sendMessage(
    msg.chat.id,
    '👑 لوحة تحكم مالك BRAND\nاختر ما تريد تعديله:',
    ownerPanel()
  );
});

// ========================================
// إلغاء تعديل
// ========================================

bot.onText(/^\/cancel$/, msg => {
  if (pendingAdminInput.has(Number(msg.from.id))) {
    pendingAdminInput.delete(Number(msg.from.id));

    return bot.sendMessage(
      msg.chat.id,
      'تم إلغاء التعديل.',
      mainKeyboard(msg.from.id)
    );
  }
});

// ========================================
// استقبال منشورات القناة
// ========================================

bot.on('channel_post', async msg => {
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
        mediaGroups.set(msg.media_group_id, []);
      }

      const group = mediaGroups.get(msg.media_group_id);
      group.push(msg);

      if (group.timer) clearTimeout(group.timer);

      group.timer = setTimeout(async () => {
        const messages = mediaGroups.get(msg.media_group_id);

        mediaGroups.delete(msg.media_group_id);

        if (messages) {
          await saveAccount(messages);
        }
      }, 2000);

      return;
    }

    await saveAccount([msg]);

  } catch (error) {
    console.error(
      '❌ خطأ في منشور القناة:',
      error.message
    );
  }
});

// ========================================
// استقبال رسائل المستخدمين
// ========================================

bot.on('message', async msg => {
  try {
    const chatId = msg.chat.id;
    const userId = msg.from && msg.from.id;
    const text = msg.text;

    if (!text) return;

    if (
      /^\/start(?:@\w+)?$/.test(text) ||
      /^\/cancel$/.test(text) ||
      /^\/admin(?:@\w+)?$/.test(text)
    ) {
      return;
    }

    // إدخال إعدادات لوحة المالك
    if (pendingAdminInput.has(Number(userId))) {
      if (!isOwner(userId)) {
        pendingAdminInput.delete(Number(userId));

        return bot.sendMessage(
          chatId,
          '⛔ غير مسموح.'
        );
      }

      const pending = pendingAdminInput.get(Number(userId));
      pendingAdminInput.delete(Number(userId));

      const value = text.trim();

      if (!value) {
        return bot.sendMessage(
          chatId,
          '❌ النص فارغ، لم يتم الحفظ.'
        );
      }

      if (pending.key === 'welcome') {
        settings.welcome = value;

      } else if (pending.key === 'ucText') {
        settings.ucText = value;

      } else if (pending.key === 'publishText') {
        settings.publishText = value;

      } else if (pending.key === 'contactText') {
        settings.contactText = value;

      } else if (pending.key === 'contestsText') {
        settings.contestsText = value;

      } else if (pending.key === 'contacts') {
        const usernames = value
          .split(/\s+/)
          .filter(Boolean)
          .map(item =>
            item.startsWith('@') ? item : `@${item}`
          );

        if (!usernames.length) {
          return bot.sendMessage(
            chatId,
            '❌ اكتب يوزر واحد على الأقل.'
          );
        }

        settings.contacts = usernames.slice(0, 5);

        settings.contactText =
          `📞 للتواصل مع الإدارة:\n\n` +
          settings.contacts
            .map(user => `👤 ${user}`)
            .join('\n');

        settings.publishText =
          `📋 طلب نشر حساب\n\n` +
          `لإضافة حساب للبيع، أرسل بيانات الحساب وصوره هنا.\n\n` +
          `📞 للتواصل مع الإدارة:\n` +
          settings.contacts.join('\n');

        settings.ucText = settings.ucText.replace(
          /@[A-Za-z0-9_]{5,}/g,
          settings.contacts[settings.contacts.length - 1]
        );

      } else if (pending.key.startsWith('label:')) {
        const labelKey = pending.key.split(':')[1];
        settings.labels[labelKey] = value;

      } else if (pending.key === 'accountText') {
        const account = findAccountByNumber(pending.number);

        if (account) {
          account.text = value;
          account.originalText = value;
        }
      }

      saveData();

      return bot.sendMessage(
        chatId,
        '✅ تم حفظ التعديل بنجاح.',
        mainKeyboard(userId)
      );
    }

    // لوحة تحكم المالك
    if (text === '⚙️ لوحة تحكم المالك') {
      if (!isOwner(userId)) {
        return bot.sendMessage(chatId, '⛔ غير مسموح.');
      }

      return bot.sendMessage(
        chatId,
        '👑 لوحة تحكم مالك BRAND\nاختر ما تريد تعديله:',
        ownerPanel()
      );
    }

    // آخر الحسابات
    if (text === settings.labels.latest) {
      if (!accounts.length) {
        return bot.sendMessage(
          chatId,
          '🔥 آخر الحسابات:\n\nلا توجد حسابات منشورة بعد تشغيل البوت.',
          mainKeyboard(userId)
        );
      }

      const buttons = accounts
        .slice(-10)
        .reverse()
        .map(account => [
          {
            text: `🧾 ${account.number}`,
            callback_data:
              `account_${account.number.replace('#', '')}`
          }
        ]);

      buttons.push([
        {
          text: '🏠 القائمة الرئيسية',
          callback_data: 'main_menu'
        }
      ]);

      return bot.sendMessage(
        chatId,
        '🔥 آخر الحسابات\n\nاختر رقم الحساب الذي تريد رؤيته 👇',
        {
          reply_markup: {
            inline_keyboard: buttons
          }
        }
      );
    }

    // البحث عن حساب
    if (text === settings.labels.search) {
      return bot.sendMessage(
        chatId,
        '🔍 أرسل رقم الحساب الذي تريد البحث عنه.\n\nمثال: 001\nأو: #001',
        mainKeyboard(userId)
      );
    }

    // طلب نشر حساب
    if (text === settings.labels.publish) {
      return bot.sendMessage(
        chatId,
        settings.publishText,
        mainKeyboard(userId)
      );
    }

    // شحن UC
    if (text === settings.labels.uc) {
      return bot.sendMessage(
        chatId,
        settings.ucText,
        mainKeyboard(userId)
      );
    }

    // تقييم الخدمة
    if (text === settings.labels.rating) {
      return showRating(chatId, userId);
    }

    // التواصل مع الإدارة
    if (text === settings.labels.contact) {
      return bot.sendMessage(
        chatId,
        settings.contactText,
        mainKeyboard(userId)
      );
    }

    // المسابقات والسحوبات
    if (text === settings.labels.contests) {
      return bot.sendMessage(
        chatId,
        settings.contestsText,
        mainKeyboard(userId)
      );
    }

    // ملاحظة التقييم
    if (waitingForReview.has(Number(userId))) {
      waitingForReview.delete(Number(userId));

      return bot.sendMessage(
        chatId,
        '❤️ شكراً لك! تم استلام ملاحظتك بنجاح.',
        mainKeyboard(userId)
      );
    }

    // البحث المباشر بالرقم
    const accountByNumber = findAccountByNumber(text);

    if (accountByNumber) {
      return sendSelectedAccount(
        chatId,
        accountByNumber,
        userId
      );
    }

    // البحث بالكلمة أو الاسم
    const search = text.trim().toLowerCase();

    const results = accounts.filter(account =>
      account.number.toLowerCase().includes(search) ||
      (account.text || '').toLowerCase().includes(search)
    );

    if (!results.length) {
      return bot.sendMessage(
        chatId,
        '❌ لم يتم العثور على حساب مطابق.\n\nجرّب رقم حساب مثل #001',
        mainKeyboard(userId)
      );
    }

    if (results.length === 1) {
      return sendSelectedAccount(
        chatId,
        results[0],
        userId
      );
    }

    const buttons = results
      .slice(0, 10)
      .map(account => [
        {
          text: `🧾 ${account.number}`,
          callback_data:
            `account_${account.number.replace('#', '')}`
        }
      ]);

    return bot.sendMessage(
      chatId,
      `🔎 تم العثور على ${results.length} حساب.\n\nاختر الحساب الذي تريد رؤيته 👇`,
      {
        reply_markup: {
          inline_keyboard: buttons
        }
      }
    );

  } catch (error) {
    console.error(
      '❌ خطأ في رسالة المستخدم:',
      error.message
    );
  }
});

// ========================================
// أزرار الحسابات والتقييم ولوحة المالك
// ========================================

bot.on('callback_query', async query => {
  try {
    const chatId = query.message && query.message.chat.id;
    const userId = query.from && query.from.id;
    const data = query.data || '';

    // حماية كل أزرار الإدارة
    if (data.startsWith('admin_') && !isOwner(userId)) {
      await bot.answerCallbackQuery(query.id, {
        text: 'هذا الخيار للمالك فقط.',
        show_alert: true
      });

      return;
    }

    await bot.answerCallbackQuery(query.id);

    // إغلاق لوحة المالك
    if (data === 'admin_close') {
      return bot.sendMessage(
        chatId,
        'تم إغلاق لوحة التحكم.',
        mainKeyboard(userId)
      );
    }

    // تعديل الترحيب
    if (data === 'admin_welcome') {
      return askAdminForText(
        chatId,
        userId,
        'welcome',
        '✏️ تعديل رسالة الترحيب'
      );
    }

    // تعديل أسعار ورسالة الشحن
    if (data === 'admin_uc') {
      return askAdminForText(
        chatId,
        userId,
        'ucText',
        '💎 تعديل رسالة الشحن والأسعار'
      );
    }

    // تعديل رسالة طلب النشر
    if (data === 'admin_publish') {
      return askAdminForText(
        chatId,
        userId,
        'publishText',
        '📋 تعديل رسالة طلب نشر الحساب'
      );
    }

    // تعديل المسابقات
    if (data === 'admin_contests') {
      return askAdminForText(
        chatId,
        userId,
        'contestsText',
        '🎁 تعديل رسالة المسابقات والسحوبات'
      );
    }

    // تعديل يوزرات التواصل
    if (data === 'admin_contacts') {
      return askAdminForText(
        chatId,
        userId,
        'contacts',
        '👤 اكتب يوزرات التواصل، كل يوزر في سطر أو افصل بينهم بمسافة.\nمثال:\n@dy_x2\n@violletry'
      );
    }

    // اختيار الزر المراد تغيير اسمه
    if (data === 'admin_labels') {
      return bot.sendMessage(
        chatId,
        '🧩 اختر الزر الذي تريد تغيير اسمه:',
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: 'آخر الحسابات',
                  callback_data: 'admin_label:latest'
                },
                {
                  text: 'البحث',
                  callback_data: 'admin_label:search'
                }
              ],
              [
                {
                  text: 'طلب نشر حساب',
                  callback_data: 'admin_label:publish'
                },
                {
                  text: 'الشحن',
                  callback_data: 'admin_label:uc'
                }
              ],
              [
                {
                  text: 'التقييم',
                  callback_data: 'admin_label:rating'
                },
                {
                  text: 'التواصل',
                  callback_data: 'admin_label:contact'
                }
              ],
              [
                {
                  text: 'المسابقات',
                  callback_data: 'admin_label:contests'
                }
              ],
              [
                {
                  text: '⬅️ رجوع',
                  callback_data: 'admin_back'
                }
              ]
            ]
          }
        }
      );
    }

    // تنفيذ اختيار اسم الزر
    if (data.startsWith('admin_label:')) {
      const key = data.split(':')[1];

      if (
        !Object.prototype.hasOwnProperty.call(
          settings.labels,
          key
        )
      ) {
        return;
      }

      return askAdminForText(
        chatId,
        userId,
        `label:${key}`,
        `✏️ أرسل الاسم الجديد لزر: ${settings.labels[key]}`
      );
    }

    // الرجوع للوحة المالك
    if (data === 'admin_back') {
      return bot.sendMessage(
        chatId,
        '👑 لوحة تحكم مالك BRAND',
        ownerPanel()
      );
    }

    // إدارة الحسابات
    if (data === 'admin_accounts') {
      if (!accounts.length) {
        return bot.sendMessage(
          chatId,
          'لا توجد حسابات محفوظة لإدارتها.',
          ownerPanel()
        );
      }

      const buttons = accounts
        .slice(-30)
        .reverse()
        .map(account => [
          {
            text: `✏️ تعديل ${account.number}`,
            callback_data:
              `admin_editacc:${account.number.replace('#', '')}`
          },
          {
            text: `🗑 حذف ${account.number}`,
            callback_data:
              `admin_delacc:${account.number.replace('#', '')}`
          }
        ]);

      buttons.push([
        {
          text: '⬅️ رجوع',
          callback_data: 'admin_back'
        }
      ]);

      return bot.sendMessage(
        chatId,
        '🎮 إدارة الحسابات: اختر تعديل أو حذف الحساب.',
        {
          reply_markup: {
            inline_keyboard: buttons
          }
        }
      );
    }

    // تعديل وصف الحساب
    if (data.startsWith('admin_editacc:')) {
      const number = data.split(':')[1];
      const account = findAccountByNumber(number);

      if (!account) {
        return bot.sendMessage(
          chatId,
          'الحساب غير موجود.',
          ownerPanel()
        );
      }

      pendingAdminInput.set(
        Number(userId),
        {
          key: 'accountText',
          number
        }
      );

      return bot.sendMessage(
        chatId,
        `✏️ أرسل الوصف الجديد للحساب ${account.number}.\nأرسل /cancel للإلغاء.`
      );
    }

    // حذف الحساب من سجل البوت
    if (data.startsWith('admin_delacc:')) {
      const number = data.split(':')[1];

      const index = accounts.findIndex(
        account =>
          account.number.replace('#', '') === number
      );

      if (index < 0) {
        return bot.sendMessage(
          chatId,
          'الحساب غير موجود.',
          ownerPanel()
        );
      }

      const deleted = accounts.splice(index, 1)[0];

      saveData();

      return bot.sendMessage(
        chatId,
        `✅ تم حذف الحساب ${deleted.number} من سجل البوت.\n\nملاحظة: هذا لا يحذف المنشور الأصلي من القناة.`,
        ownerPanel()
      );
    }

    // القائمة الرئيسية
    if (data === 'main_menu') {
      return bot.sendMessage(
        chatId,
        settings.welcome,
        mainKeyboard(userId)
      );
    }

    // مشاهدة التقييمات
    if (data === 'show_ratings') {
      const info = getRatingInfo();

      return bot.sendMessage(
        chatId,
        `📊 تقييم BRAND | PUBG

${getStars(info.average)}

⭐ المتوسط: ${info.average} / 5
👥 عدد التقييمات: ${info.count}`,
        mainKeyboard(userId)
      );
    }

    // التقييم من 1 إلى 5
    if (data.startsWith('rate_')) {
      const rating = parseInt(
        data.replace('rate_', ''),
        10
      );

      if (
        !Number.isInteger(rating) ||
        rating < 1 ||
        rating > 5
      ) {
        return bot.sendMessage(
          chatId,
          '❌ التقييم يجب أن يكون من 1 إلى 5 نجوم.',
          mainKeyboard(userId)
        );
      }

      if (ratedUsers.has(Number(userId))) {
        const info = getRatingInfo();

        return bot.sendMessage(
          chatId,
          `⚠️ أنت قيّمت الخدمة مسبقاً.

⭐ المتوسط: ${info.average} / 5
👥 عدد التقييمات: ${info.count}`,
          mainKeyboard(userId)
        );
      }

      ratings.push(rating);
      ratedUsers.add(Number(userId));

      saveData();

      const info = getRatingInfo();

      return bot.sendMessage(
        chatId,
        `❤️ شكراً لك على تقييمك!

${'⭐'.repeat(rating)}

تم تسجيل تقييمك بنجاح.

⭐ المتوسط: ${info.average} / 5
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

    // إضافة ملاحظة للتقييم
    if (data === 'add_review') {
      waitingForReview.add(Number(userId));

      return bot.sendMessage(
        chatId,
        '📝 اكتب ملاحظتك الآن:\n\nرأيك يساعدنا على تحسين الخدمة ❤️'
      );
    }

    // اختيار حساب
    if (data.startsWith('account_')) {
      const account = findAccountByNumber(
        data.replace('account_', '')
      );

      return sendSelectedAccount(
        chatId,
        account,
        userId
      );
    }

  } catch (error) {
    console.error(
      '❌ خطأ في الزر:',
      error.message
    );
  }
});

// ========================================
// أخطاء البوت
// ========================================

bot.on('polling_error', error => {
  console.error(
    '❌ Polling Error:',
    error.message
  );
});

// ========================================
// تشغيل البوت
// ========================================

console.log('================================');
console.log('🔥 BRAND Libya Bot يعمل الآن');
console.log('📡 القناة:', CHANNEL_USERNAME);
console.log('👑 Owner ID:', OWNER_ID);
console.log('⭐ نظام التقييم: 1 - 5 نجوم');
console.log('================================');
