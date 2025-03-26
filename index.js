const { 
  makeWASocket, 
  useMultiFileAuthState, 
  fetchLatestBaileysVersion, 
  DisconnectReason 
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

const imagePath = 'imagen/img1.png';
const banner = `TEXTO DEL BANNER AQUÍ`;

let envioProgramadoIniciado = false;

async function startBot() {
  try {
    console.log("Obteniendo la versión más reciente de Baileys...");
    const { version } = await fetchLatestBaileysVersion();

    console.log("Cargando credenciales...");
    const { state, saveCreds } = await useMultiFileAuthState('./auth');

    console.log("Iniciando el cliente de WhatsApp...");
    const client = makeWASocket({
      auth: state,
      version
    });

    client.ev.on('creds.update', saveCreds);

    client.ev.on('qr', (qr) => {
      qrcode.generate(qr, { small: true });
      console.log('Escanea el QR con tu WhatsApp');
    });

    client.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === 'close') {
        const reason = lastDisconnect?.error?.output?.statusCode || 0;
        if (reason === DisconnectReason.loggedOut) {
          console.log('Usuario desconectado. Cerrando...');
          process.exit(0);
        }
        console.log('Conexión cerrada. Intentando reconectar en 5 segundos...');
        setTimeout(startBot, 5000);
      } else if (connection === 'open') {
        console.log('El bot está listo');
        iniciarEnvioProgramado(client);
      }
    });

    async function obtenerGrupos() {
      try {
        const grupos = await client.groupFetchAllParticipating();
        return Object.keys(grupos);
      } catch (error) {
        console.error('Error al obtener los grupos:', error);
        return [];
      }
    }

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

    function iniciarEnvioProgramado() {
      if (envioProgramadoIniciado) return;
      envioProgramadoIniciado = true;
      console.log("Iniciando el envío programado de mensajes...");
      enviarMensajesGrupos();
      setInterval(enviarMensajesGrupos, 3 * 60 * 60 * 1000);
    }

    client.ev.on('messages.upsert', async ({ messages }) => {
      const message = messages[0];
      if (!message?.key?.remoteJid || message.key.remoteJid.includes('@g.us') || message.key.fromMe) return;

      console.log(`Recibiendo mensaje privado de: ${message.key.remoteJid}`);
      await client.sendMessage(
        message.key.remoteJid,
        { text: 'ESTE NÚMERO SOLO ES UN BOT《wa.me/4811515144》NUMERO OFICIAL Y GRACIAS POR SU PREFERENCIA' }
      );
    });

  } catch (error) {
    console.error("Error al iniciar el bot:", error);
    console.log("Reintentando en 10 segundos...");
    setTimeout(startBot, 10000);
  }
}

startBot();
