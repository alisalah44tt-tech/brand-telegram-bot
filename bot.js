const TelegramBot = require('node-telegram-bot-api');

const token = process.env.BOT_TOKEN;

if (!token) {
  console.error('❌ BOT_TOKEN غير موجود');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

const CHANNEL_USERNAME = 'Pubg_Libya_Store';

// ========================================
// تخزين الحسابات
// ========================================

const accounts = [];

let nextAccountNumber = 1;

// ========================================
// نظام التقييم
// ========================================

const ratings = [];

// المستخدمون الذين قيّموا بالفعل
const ratedUsers = new Set();

// المستخدم الذي ينتظر كتابة ملاحظة
const waitingForReview = new Set();

// ========================================
// تجميع صور الألبوم
// ========================================

const mediaGroups = new Map();

// ========================================
// أزرار البوت
// ========================================

const keyboard = {
  reply_markup: {
    keyboard: [
      ['🔥 آخر الحسابات', '🔍 البحث عن حساب'],
      ['📋 طلب نشر حساب', '💎 شحن UC والألعاب'],
      ['⭐ تقييم الخدمة', '📞 التواصل مع الإدارة'],
      ['🎁 المسابقات والسحوبات']
    ],
    resize_keyboard: true,
    persistent: true
  }
};

// ========================================
// /start
// ========================================

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `🔥 مرحبًا بك في بوت BRAND Libya 🇱🇾

🎮 كل خدمات PUBG في مكان واحد

💎 شحن UC
🛒 بيع وشراء الحسابات
🎁 المسابقات والسحوبات
📞 تواصل معنا في أي وقت

👇 اختر الخدمة التي تريدها من الأزرار بالأسفل`,
    keyboard
  );
});

// ========================================
// إنشاء رقم الحساب
// ========================================

function createAccountNumber() {
  const number = String(nextAccountNumber).padStart(3, '0');
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

async function sendSelectedAccount(chatId, account) {
  if (!account) {
    return bot.sendMessage(
      chatId,
      `❌ هذا الحساب غير موجود.`,
      keyboard
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
    keyboard
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

    nextAccountNumber++;

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
// رسائل المستخدمين
// ========================================

bot.on('message', async (msg) => {

  try {

    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text || text === '/start') {
      return;
    }

    // ====================================
    // إذا المستخدم ينتظر كتابة الملاحظة
    // ====================================

    if (waitingForReview.has(chatId)) {

      waitingForReview.delete(chatId);

      return bot.sendMessage(
        chatId,
        `❤️ شكراً لك على تقييمك!

تم استلام ملاحظتك بنجاح.

⭐ تقييمك محفوظ معنا.`,
        keyboard
      );

    }

    // ====================================
    // آخر الحسابات
    // ====================================

    if (text === '🔥 آخر الحسابات') {

      if (accounts.length === 0) {

        return bot.sendMessage(
          chatId,
          `🔥 آخر الحسابات:

لا توجد حسابات منشورة بعد تشغيل البوت.`,
          keyboard
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

    if (text === '🔍 البحث عن حساب') {

      return bot.sendMessage(
        chatId,
        `🔍 أرسل رقم الحساب الذي تريد البحث عنه.

مثال:

001

أو:

#001`,
        keyboard
      );

    }

    // ====================================
    // طلب نشر حساب
    // ====================================

    if (text === '📋 طلب نشر حساب') {

      return bot.sendMessage(
        chatId,
        `📋 طلب نشر حساب

لإضافة حساب للبيع، أرسل بيانات الحساب وصوره هنا.

📞 للتواصل مع الإدارة:
@ali_alzntane
@natoo_06`,
        keyboard
      );

    }

    // ====================================
    // شحن UC
    // ====================================

    if (text === '💎 شحن UC والألعاب') {

      return bot.sendMessage(
        chatId,
        `🎮 شحن شدات PUBG

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
@natoo_06`,
        keyboard
      );

    }

    // ====================================
    // تقييم الخدمة
    // ====================================

    if (text === '⭐ تقييم الخدمة') {

      return showRating(chatId);

    }

    // ====================================
    // التواصل مع الإدارة
    // ====================================

    if (text === '📞 التواصل مع الإدارة') {

      return bot.sendMessage(
        chatId,
        `📞 للتواصل مع الإدارة:

👤 @ali_alzntane
👤 @natoo_06`,
        keyboard
      );

    }

    // ====================================
    // المسابقات والسحوبات
    // ====================================

    if (text === '🎁 المسابقات والسحوبات') {

      return bot.sendMessage(
        chatId,
        `🎁 المسابقات والسحوبات

تابع القناة لمعرفة آخر المسابقات والسحوبات.`,
        keyboard
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
        accountByNumber
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
          keyboard
        );

      }

      if (results.length === 1) {

        return sendSelectedAccount(
          chatId,
          results[0]
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

    const data =
      query.data;

    await bot.answerCallbackQuery(
      query.id
    );

    // ====================================
    // القائمة الرئيسية
    // ====================================

    if (data === 'main_menu') {

      return bot.sendMessage(
        chatId,
        `🔥 مرحبًا بك في بوت BRAND Libya 🇱🇾

👇 اختر الخدمة التي تريدها من الأزرار بالأسفل`,
        keyboard
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
        keyboard
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
          keyboard
        );

      }

      // منع التقييم أكثر من مرة
      if (ratedUsers.has(chatId)) {

        const info =
          getRatingInfo();

        return bot.sendMessage(
          chatId,
          `⚠️ أنت قيّمت الخدمة مسبقاً.

⭐ المتوسط الحالي: ${info.average} / 5
👥 عدد التقييمات: ${info.count}`,
          keyboard
        );

      }

      ratings.push(rating);

      ratedUsers.add(chatId);

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
          keyboard
        );

      }

      return sendSelectedAccount(
        chatId,
        account
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
  '================================'
);
