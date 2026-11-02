const express = require('express');
const axios = require('axios');
const nodemailer = require('nodemailer');

const app = express();

// תמיכה בטפסים וב-JSON (נדרש עבור SendGrid ו-Green API)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// הגדרת הטרנספורטר לשליחת מיילים דרך Gmail (SMTP)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: false, // true עבור 465, false עבור 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // סיסמת אפליקציה בת 16 אותיות
  },
});

// ==========================================
// 1. קבלת הודעה מ-WhatsApp -> שליחה ל-Gmail
// ==========================================
app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;

    // בדיקה שמדובר בהודעה נכנסת (incomingMessageReceived)
    if (body && body.typeWebhook === 'incomingMessageReceived') {
      const senderData = body.senderData || {};
      const messageData = body.messageData || {};

      const senderName = senderData.senderName || 'איש קשר';
      const senderPhone = senderData.chatId ? senderData.chatId.replace('@c.us', '') : 'לא ידוע';
      
      // חילוץ תוכן ההודעה
      let textMessage = '';
      if (messageData.typeMessage === 'textMessage') {
        textMessage = messageData.textMessageData?.textMessage || '';
      } else if (messageData.typeMessage === 'extendedTextMessage') {
        textMessage = messageData.extendedTextMessageData?.text || '';
      } else {
        textMessage = `[התקבלה הודעה מסוג: ${messageData.typeMessage}]`;
      }

      console.log(`הודעה חדשה מ-${senderName} (${senderPhone}): ${textMessage}`);

      // בניית המייל לשליחה
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.TARGET_EMAIL,
        subject: `WhatsApp: ${senderName} (${senderPhone})`,
        text: `הודעה חדשה מ-WhatsApp:\n\nמאת: ${senderName}\nטלפון: ${senderPhone}\n\nתוכן ההודעה:\n${textMessage}\n\n---\nלמענה, פשוט לחץ 'השיב' (Reply) במייל זה.`,
      };

      await transporter.sendMail(mailOptions);
      console.log('המייל נשלח בהצלחה ל-Gmail!');
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('שגיאה בעיבוד ה-Webhook מ-Green API:', error.message);
    res.status(500).send('Error');
  }
});

// ==========================================
// 2. קבלת מייל מ-SendGrid -> שליחה ל-WhatsApp
// ==========================================
app.post('/email-webhook', async (req, res) => {
  try {
    const { subject, text } = req.body;

    console.log('התקבל מייל נכנס מ-SendGrid!');
    console.log(`נושא המייל: ${subject}`);

    // 1. חילוץ מספר הטלפון מתוך נושא המייל (Subject)
    // מחפש רצף ספרות (למשל 0501234567 או 972501234567)
    const phoneMatch = subject ? subject.match(/\d{9,12}/) : null;

    if (!phoneMatch) {
      console.error('לא נמצא מספר טלפון תקין בנושא המייל.');
      return res.status(400).send('No phone number found in subject');
    }

    let targetPhone = phoneMatch[0];

    // המרה לפורמט בינלאומי במידת הצורך (אם מתחיל ב-0)
    if (targetPhone.startsWith('0')) {
      targetPhone = '972' + targetPhone.substring(1);
    }

    // 2. ניקוי תוכן ההודעה (הסרת ציטוטים של מיילים קודמים אם מדובר ב-Reply)
    let cleanText = text || '';
    if (cleanText.includes('On ') && cleanText.includes(' wrote:')) {
      cleanText = cleanText.split(/On .* wrote:/)[0];
    }
    cleanText = cleanText.trim();

    console.log(`שולח הודעת WhatsApp ל-Phone: ${targetPhone}`);
    console.log(`תוכן ההודעה: ${cleanText}`);

    // 3. שליחת ההודעה דרך Green API
    const greenApiUrl = `${process.env.GREEN_API_URL}/waInstance${process.env.GREEN_API_ID_INSTANCE}/sendMessage/${process.env.GREEN_API_TOKEN}`;

    await axios.post(greenApiUrl, {
      chatId: `${targetPhone}@c.us`,
      message: cleanText,
    });

    console.log('ההודעה נשלחה בהצלחה ל-WhatsApp!');
    res.status(200).send('OK');
  } catch (error) {
    console.error('שגיאה בעיבוד המייל מ-SendGrid ושליחה ל-Green API:', error.message);
    res.status(500).send('Error');
  }
});

// השרת מקשיב בפורט המוגדר מ-Render
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
