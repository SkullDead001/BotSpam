const { 
  makeWASocket, 
  useMultiFileAuthState, 
  fetchLatestBaileysVersion, 
  DisconnectReason, 
  delay 
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

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

const imagePath = 'imagen/img1.png';

// Función para iniciar el bot
async function startBot() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState('./auth');

    const { version } = await fetchLatestBaileysVersion();

    const client = makeWASocket({
      auth: state,
      version
    });

    // Evento para generar y mostrar el código QR
    client.ev.on('qr', (qr) => {
      qrcode.generate(qr, { small: true });
      console.log('Escanea el QR con tu WhatsApp');
    });

    // Evento de conexión
    client.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === 'close') {
        const reason = lastDisconnect?.error?.output?.statusCode;
        if (reason === DisconnectReason.loggedOut) {
          console.log('Usuario desconectado. Cerrando...');
          process.exit(0);
        }
        console.log('Conexión cerrada. Intentando reconectar en 5 segundos...');
        setTimeout(startBot, 5000);
      } else if (connection === 'open') {
        console.log('El bot está listo');
        iniciarEnvioProgramado();
      }
    });

    // Función para obtener los grupos del bot
    async function obtenerGrupos() {
      try {
        const grupos = await client.groupFetchAllParticipating();
        return Object.keys(grupos); // Devuelve una lista de IDs de los grupos
      } catch (error) {
        console.error('Error al obtener los grupos:', error);
        return [];
      }
    }

    // Función para enviar mensajes a los grupos
    async function enviarMensajesGrupos() {
      try {
        const groupChats = await obtenerGrupos();

        let media = null;
        try {
          media = await fs.promises.readFile(imagePath);
          console.log("Imagen encontrada y lista para enviar.");
        } catch {
          console.log("No se encontró la imagen, solo se enviará texto.");
        }

        for (const chatId of groupChats) {
          console.log(`Enviando mensaje al grupo: ${chatId}`);
          try {
            if (media) {
              await client.sendMessage(chatId, { image: media, caption: banner });
            } else {
              await client.sendMessage(chatId, { text: banner });
            }
          } catch (error) {
            console.error(`Error al enviar mensaje al grupo ${chatId}:`, error);
          }
        }

        console.log("Se enviaron los mensajes a todos los grupos.");
      } catch (error) {
        console.error('Error al enviar mensajes a los grupos:', error);
      }
    }

    // Envío programado de mensajes cada 3 horas
    function iniciarEnvioProgramado() {
      console.log("Iniciando el envío programado de mensajes...");
      enviarMensajesGrupos();
      setInterval(enviarMensajesGrupos, 3 * 60 * 60 * 1000); // Cada 3 horas
    }

    // Manejo de mensajes privados
    client.ev.on('messages.upsert', async ({ messages, type }) => {
      const message = messages[0];
      if (message?.key?.remoteJid && !message.key.remoteJid.includes('@g.us')) {
        console.log(`Recibiendo mensaje privado de: ${message.key.remoteJid}`);
        await client.sendMessage(
          message.key.remoteJid,
          { text: 'ESTE NÚMERO SOLO ES UN BOT《wa.me/4811515144》NUMERO OFICIAL Y GRACIAS POR SU PREFERENCIA' }
        );
      }
    });

  } catch (error) {
    console.error("Error al iniciar el bot:", error);
    console.log("Reintentando en 10 segundos...");
    setTimeout(startBot, 10000);
  }
}

// Iniciar el bot
startBot();
