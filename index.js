const express = require('express');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());

// יצירת טרנספורט עמיד בפני חסימות פורטים ב-Render (אכיפת IPv4 ופורט 465 SSL)
const createRobustTransporter = () => {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // שימוש ב-SSL ישיר העוקף חסימות STARTTLS
    family: 4,   // כפיית IPv4 בלבד למניעת שגיאת ENETUNREACH ב-Render
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS ? process.env.EMAIL_PASS.replace(/\s+/g, '') : '', // ניקוי רווחים אוטומטי
    },
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });
};

// טרנספורט גיבוי בפורט 587 למקרה של חסימת SSL
const createFallbackTransporter = () => {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    family: 4,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS ? process.env.EMAIL_PASS.replace(/\s+/g, '') : '',
    },
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
  });
};

// פונקציית שליחה עמידה שמנסה את שני הפורטים
async function sendMailWithRetry(mailOptions) {
  try {
    const transporter = createRobustTransporter();
    await transporter.sendMail(mailOptions);
    console.log('המייל נשלח בהצלחה ל-Gmail (דרך SSL)!');
  } catch (err) {
    console.warn('ניסיון ראשון נכשל, מנסה דרך פורט גיבוי 587:', err.message);
    const fallbackTransporter = createFallbackTransporter();
    await fallbackTransporter.sendMail(mailOptions);
    console.log('המייל נשלח בהצלחה ל-Gmail (דרך גיבוי 587)!');
  }
}

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
      } else if (messageData.typeMessage === 'imageMessage') {
        textMessage = `[תמונה]: ${messageData.fileMessageData?.downloadUrl || ''}`;
      } else if (messageData.typeMessage === 'documentMessage') {
        textMessage = `[מסמך/קובץ]: ${messageData.fileMessageData?.downloadUrl || ''}`;
      } else if (messageData.typeMessage === 'audioMessage') {
        textMessage = `[הודעה קולית]: ${messageData.fileMessageData?.downloadUrl || ''}`;
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

      await sendMailWithRetry(mailOptions);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('שגיאה בטיפול בהודעה:', error.message);
    res.status(200).send('OK'); // החזרת OK ל-Green API כדי למנוע השהיות חוזרות
  }
});

app.get('/', (req, res) => {
  res.send('Server is running smoothly');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
