const express = require('express');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());

// הגדרת שליחת מייל בפורט 587 הנתמך ב-Render
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // חייב להיות false עבור פורט 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // סיסמת אפליקציה בת 16 אותיות ללא רווחים
  },
  tls: {
    rejectUnauthorized: false
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
});

// קבלת הודעות מ-WhatsApp והעברתן ל-Gmail
app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;

    if (body && body.typeWebhook === 'incomingMessageReceived') {
      const senderData = body.senderData || {};
      const messageData = body.messageData || {};

      const senderName = senderData.senderName || 'איש קשר';
      const senderPhone = senderData.chatId ? senderData.chatId.replace('@c.us', '') : 'לא ידוע';
      
      let textMessage = '';
      if (messageData.typeMessage === 'textMessage') {
        textMessage = messageData.textMessageData?.textMessage || '';
      } else if (messageData.typeMessage === 'extendedTextMessage') {
        textMessage = messageData.extendedTextMessageData?.text || '';
      } else {
        textMessage = `[התקבלה הודעה מסוג: ${messageData.typeMessage}]`;
      }

      console.log(`הודעה מ-${senderName} (${senderPhone}): ${textMessage}`);

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.TARGET_EMAIL || process.env.EMAIL_USER,
        subject: `WhatsApp: ${senderName} (${senderPhone})`,
        text: `הודעה חדשה מ-WhatsApp:\n\nמאת: ${senderName}\nטלפון: ${senderPhone}\n\nתוכן ההודעה:\n${textMessage}\n\n---\nלמענה, פשוט לחץ 'השיב' במייל זה.`,
      };

      await transporter.sendMail(mailOptions);
      console.log('המייל נשלח בהצלחה ל-Gmail!');
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('שגיאה:', error.message);
    res.status(500).send('Error');
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
