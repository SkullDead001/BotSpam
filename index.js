const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});

let cachedChats = [];
let respondedChats = new Set();
const banner = `

🤝🏻 TRATO ADMIN 🤝🏻

TODO AL 50 😱

🚫NO GENTE DESESPERADA🚫

📱 FACTURAS  
📱• TELCEL -SOLO VIRGEN
📱• MOVISTAR
📱• AT&T
📱• NETWAY INTERNET -NUEVO-


🏡 PAGOS DE SERVICIOS 
🏠• WIZZ
🏠• IZZI
🏠• TOTAL PLAY 
🏠• MEGACABLE
🏠• AGUA 
🏠• AGUA DE SALTILLO
🏠• CFE -SOLO VIRGEN-
🏠• GAS NATURGY
🏠• INTERNET ZOE 

🎓 COLEGIATURAS 
🎓• Cetys de Mexicali
🎓• UTEL

🛍️ COMPRAS 
🛍️• BERSHKA
🛍️• PALACIO DE HIERRO
🛍️• AMAZON 
🛍️• SEGUROS: AXA  
🛍️• SHEIN
🛍️• TEMU
🛍️° PECO
🛍️°FARMACIAS SAN PABLO
🛍️°MERCADO LIBRE 
🛍️°WALMART
PARA COMPRAS SE REQUIERE CUENTA CON HISTORIAL

💠Nuevo
Cuentas straming 
📺NETFLIX / TAMBIEN PERFILES/
📺HBO

 📞RECARGAS AL 50 
📱 MOVISTAR -SE REQUIERE CUENTA-
📱• AT&T -SE REQUIERE CUENTA-
📱• BAIT
📱• Telcel

🍔 COMIDA
🍔• UBER EATS

⚠️NO GARANTIA SOBRE REBOTE⚠️

▶️ PUEDES PREGUNTAR SIN COMPROMISO 😏

`;

const imagePath = '/root/pana-bot/log.png';

client.on('qr', (qr) => {
  qrcode.generate(qr, { small: true });
  console.log('Escanea el QR con tu WhatsApp');
});

client.on('ready', async () => {
  console.log('El bot está listo');

  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const randomInterval = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

  async function updateChats() {
    try {
      cachedChats = await client.getChats();
      console.log('Chats actualizados en caché.');
    } catch (error) {
      console.error('Error al actualizar los chats:', error);
    }
  }

  async function enviarMensajesGrupos() {
    try {
      await updateChats();
      const groupChats = cachedChats.filter(chat => chat.id._serialized.endsWith('@g.us'));

      let media = null;
      if (fs.existsSync(imagePath)) {
        media = MessageMedia.fromFilePath(imagePath);
        console.log("Imagen encontrada y lista para enviar.");
      } else {
        console.log("No se encontró la imagen, solo se enviará texto.");
      }

      for (const chat of groupChats) {
        console.log(`Enviando mensaje al grupo: ${chat.id._serialized}`);
        try {
          if (media) {
            await client.sendMessage(chat.id._serialized, media, { caption: banner });
          } else {
            await client.sendMessage(chat.id._serialized, banner);
          }
        } catch (error) {
          console.error(`Error al enviar mensaje al grupo ${chat.id._serialized}:`, error);
        }
      }

      console.log("Se enviaron los mensajes a todos los grupos.");
    } catch (error) {
      console.error('Error al enviar mensajes a los grupos:', error);
    }
  }

  async function iniciarEnvioProgramado() {
    while (true) {
      console.log("Iniciando el envío programado de mensajes...");
      try {
        await enviarMensajesGrupos();
      } catch (error) {
        console.error('Error en el envío de mensajes:', error);
      }
      
      const nextCycleDelay = randomInterval(3 * 60 * 60 * 1000, 3 * 60 * 60 * 1000); // Exactamente 3 horas
      console.log(`Esperando ${Math.round(nextCycleDelay / (60 * 60 * 1000))} horas para el próximo envío...`);
      await wait(nextCycleDelay);
    }
  }

  await updateChats();
  iniciarEnvioProgramado();
});

client.on('message', async (message) => {
  try {
    if (!message.from.endsWith('@g.us') && !respondedChats.has(message.from)) {
      console.log(`Recibiendo mensaje privado de: ${message.from}`);
      await client.sendMessage(
        message.from,
       GRACIAS POR SU PREFERENCIA, DISCULPA EN UN MONTO ESTARE CON USTED, DE ANTEMANO GRACIAS ;)
      );
      respondedChats.add(message.from);
    }
  } catch (error) {
    console.error(`Error al responder al mensaje privado de ${message.from}:`, error);
  }
});

client.initialize();
