const express = require('express');
const { Resend } = require('resend');

const app = express();
app.use(express.json());

const resend = new Resend(process.env.RESEND_API_KEY);

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
      } else {
        textMessage = `[התקבלה הודעה מסוג: ${messageData.typeMessage}]`;
      }

      console.log(`הודעה מ-${senderName} (${senderPhone}): ${textMessage}`);

      const targetEmail = process.env.TARGET_EMAIL || process.env.EMAIL_USER;

      // שליחה דרך HTTP API עם טיפול מפורט בשגיאות
      const response = await resend.emails.send({
        from: 'Onboarding <onboarding@resend.dev>',
        to: [targetEmail],
        subject: `WhatsApp: ${senderName} (${senderPhone})`,
        text: `הודעה חדשה מ-WhatsApp:\n\nמאת: ${senderName}\nטלפון: ${senderPhone}\n\nתוכן ההודעה:\n${textMessage}\n\n---\nלמענה, פשוט לחץ 'השיב' במייל זה.`,
      });

      if (response.error) {
        console.error('שגיאה מ-Resend:', response.error.message);
      } else {
        console.log('המייל נשלח בהצלחה! מזהה:', response.data.id);
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('שגיאה בשרת:', error.message);
    res.status(200).send('OK');
  }
});

app.get('/', (req, res) => {
  res.send('Server is running');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
