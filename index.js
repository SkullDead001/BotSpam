const {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
downloadMediaMessage
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

const imagePath = 'imagen/img1.png';
const bannerFile = 'banner.txt';
let banner = fs.existsSync(bannerFile) ? fs.readFileSync(bannerFile, 'utf-8') : 'TEXTO DEL BANNER AQUÍ';

const owners = ['5214437913563', '5217152613752', '5217461632611'];

let envioProgramadoIniciado = false;
let intervaloEnvio = 3 * 60 * 60 * 1000;
let intervalId = null;

const gruposPermitidosFile = 'grupos_permitidos.json';
let gruposPermitidos = [];

if (fs.existsSync(gruposPermitidosFile)) {
  try {
    const data = JSON.parse(fs.readFileSync(gruposPermitidosFile, 'utf-8'));
    if (Array.isArray(data.permitidos)) {
      gruposPermitidos = data.permitidos;
    }
  } catch (err) {
    console.error('Error al leer grupos_permitidos.json:', err);
  }
}

function guardarGruposPermitidos() {
  fs.writeFileSync(gruposPermitidosFile, JSON.stringify({ permitidos: gruposPermitidos }, null, 2));
}

// Cargar intervalo desde config.json si existe
if (fs.existsSync('config.json')) {
  try {
    const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
    if (config.intervaloEnvioHoras && config.intervaloEnvioHoras > 0) {
      intervaloEnvio = config.intervaloEnvioHoras * 60 * 60 * 1000;
      console.log(`Intervalo de envío cargado: ${config.intervaloEnvioHoras} hora(s)`);
    }
  } catch (err) {
    console.error('Error al leer config.json:', err);
  }
}

async function startBot() {
  try {
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState('./auth');

    const client = makeWASocket({ auth: state, version });

    client.ev.on('creds.update', saveCreds);

    if (!fs.existsSync('imagen')) {
      fs.mkdirSync('imagen');
    }

    client.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log("Escanea este código QR para conectar:");
        qrcode.generate(qr, { small: true });
      }

      if (connection === 'close') {
        const reason = lastDisconnect?.error?.output?.statusCode || 0;
        if (reason === DisconnectReason.loggedOut) {
          console.log('Usuario desconectado. Cerrando...');
          process.exit(0);
        }
        console.log('Conexión cerrada. Intentando reconectar...');
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
        const gruposFiltrados = groupChats.filter(gid => gruposPermitidos.includes(gid));
        let media = null;

        try {
          media = await fs.promises.readFile(imagePath);
        } catch {
          console.log("No se encontró la imagen, solo se enviará texto.");
        }

        for (const chatId of gruposFiltrados) {
          try {
            if (media) {
              
        const mensajes = await client.loadMessages(chatId, 5);
        const ultimo = mensajes[mensajes.length - 1];

        if (ultimo && ultimo.key.fromMe) {
          const textoUltimo = ultimo.message?.conversation ||
            ultimo.message?.extendedTextMessage?.text ||
            ultimo.message?.imageMessage?.caption || '';

          if (textoUltimo.trim() === banner.trim()) {
            console.log(`⏭️ Ya se envió el banner recientemente en ${chatId}, se omite.`);
            continue;
          }
        }
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
      intervalId = setInterval(enviarMensajesGrupos, intervaloEnvio);
    }
    
    const actividadUsuarios = {};

    client.ev.on('messages.upsert', async ({ messages }) => {
      const message = messages[0];
      if (!message?.message || message.key.fromMe) return;

      const sender = message.key.remoteJid;
      const isGroup = sender.endsWith('@g.us');
      const senderNumber = message.key.participant
        ? message.key.participant.split('@')[0]
        : sender.split('@')[0];

      // Anti-spam en privado
      if (!isGroup && !owners.includes(senderNumber)) {
        const ahora = Date.now();
        const ventana = 30 * 1000;
        const limite = 5;

        if (!actividadUsuarios[senderNumber]) {
          actividadUsuarios[senderNumber] = [];
        }

        actividadUsuarios[senderNumber] = actividadUsuarios[senderNumber].filter(ts => ahora - ts < ventana);
        actividadUsuarios[senderNumber].push(ahora);

        if (actividadUsuarios[senderNumber].length > limite) {
          await client.sendMessage(sender, {
            text: '🚫 Has sido bloqueado por enviar demasiados mensajes seguidos.',
          });

          try {
            await client.updateBlockStatus(sender, 'block');
            console.log(`🔒 Usuario bloqueado por spam: ${senderNumber}`);
          } catch (err) {
            console.error(`❌ Error al bloquear ${senderNumber}:`, err);
          }

          return;
        }
      }

      const body = message.message.conversation ||
        message.message.extendedTextMessage?.text || '';

      if (!isGroup && !owners.includes(senderNumber)) {
        let mensajePrivado = 'AQUI VA EL MENSAJE EN CASO DE QUE LE ESCRIBAN AL PRIVADO';
        if (fs.existsSync('privado.txt')) {
          mensajePrivado = fs.readFileSync('privado.txt', 'utf-8');
        }

        await client.sendMessage(sender, {
          text: mensajePrivado,
        });

        return;
      }

      if (!owners.includes(senderNumber)) return;

      if (body.startsWith('.setbanner')) {
        const nuevoBanner = body.slice(10).trim();
        if (!nuevoBanner) {
          return await client.sendMessage(sender, {
            text: '❌ Escribe el nuevo texto del banner. Ej: *.setbanner Bienvenidos al grupo*',
          });
        }
        banner = nuevoBanner;
        fs.writeFileSync(bannerFile, banner, 'utf-8');
        return await client.sendMessage(sender, {
          text: `✅ Banner actualizado:\n\n${banner}`,
        });
      }

      if (body === '.banner') {
        let media = null;
        try {
          media = await fs.promises.readFile(imagePath);
        } catch {
          media = null;
        }

        if (media) {
          return await client.sendMessage(sender, {
            image: media,
            caption: `📢 Banner actual:\n\n${banner}`,
          });
        } else {
          return await client.sendMessage(sender, {
            text: `📢 Banner actual (sin imagen):\n\n${banner}`,
          });
        }
      }

      if (body === '.listgrupos') {
        const grupos = await client.groupFetchAllParticipating();
        const nombres = Object.values(grupos)
          .map(g => `${g.subject} → ${g.id}`)
          .join('\n');

        return await client.sendMessage(sender, {
          text: `📋 Lista de grupos donde estoy:\n\n${nombres}`
        });
      }
      
      if (body.startsWith('.addgrupo')) {
        const nombre = body.slice(9).trim().toLowerCase();
        const grupos = await client.groupFetchAllParticipating();
        const grupo = Object.values(grupos).find(g => g.subject.toLowerCase().includes(nombre));
        if (!grupo) {
          return await client.sendMessage(sender, {
            text: '❌ Grupo no encontrado. Usa *.listgrupos* para ver nombres exactos.',
          });
        }
        if (!gruposPermitidos.includes(grupo.id)) {
          gruposPermitidos.push(grupo.id);
          guardarGruposPermitidos();
        }
        return await client.sendMessage(sender, {
          text: `✅ Grupo "${grupo.subject}" agregado a la lista de envío.`,
        });
      }

      if (body.startsWith('.delgrupo')) {
        const nombre = body.slice(9).trim().toLowerCase();
        const grupos = await client.groupFetchAllParticipating();
        const grupo = Object.values(grupos).find(g => g.subject.toLowerCase().includes(nombre));
        if (!grupo) {
          return await client.sendMessage(sender, {
            text: '❌ Grupo no encontrado. Usa *.listgrupos* para ver nombres exactos.',
          });
        }
        gruposPermitidos = gruposPermitidos.filter(gid => gid !== grupo.id);
        guardarGruposPermitidos();
        return await client.sendMessage(sender, {
          text: `✅ Grupo "${grupo.subject}" eliminado de la lista de envío.`,
        });
      }

      if (body === '.setimg') {
        const context = message.message?.extendedTextMessage?.contextInfo;
        const quoted = context?.quotedMessage;
        const quotedKey = {
          remoteJid: sender,
          fromMe: false,
          id: context?.stanzaId,
          participant: context?.participant
        };

        if (!quoted || !quoted.imageMessage) {
          return await client.sendMessage(sender, {
            text: '❌ Debes responder a una imagen con el comando *.setimg*.',
          });
        }

        try {
          const imgBuffer = await downloadMediaMessage(
  { message: quoted, key: quotedKey },
  'buffer',
  {},
  {
    logger: console,
    reuploadRequest: client.updateMediaMessage,
  }
);

          fs.writeFileSync(imagePath, imgBuffer);
          return await client.sendMessage(sender, {
            text: '✅ Imagen del banner actualizada correctamente.',
          });
        } catch (err) {
          console.error(err);
          return await client.sendMessage(sender, {
            text: '❌ No se pudo guardar la imagen. Asegúrate de responder a una imagen válida y reciente.',
          });
        }
      }

      if (body.startsWith('.setprivado')) {
        const nuevoPrivado = body.slice(12).trim();
        if (!nuevoPrivado) {
          return await client.sendMessage(sender, {
            text: '❌ Escribe el nuevo mensaje. Ej: *.setprivado Hola, ¿cómo puedo ayudarte?*',
          });
        }
        fs.writeFileSync('privado.txt', nuevoPrivado, 'utf-8');
        return await client.sendMessage(sender, {
          text: `✅ Mensaje privado actualizado:\n\n${nuevoPrivado}`,
        });
      }

      if (body.startsWith('.setinterval')) {
        const horas = parseInt(body.slice(12).trim());
        if (isNaN(horas) || horas < 1) {
          return await client.sendMessage(sender, {
            text: '❌ Debes indicar un número válido de horas. Ej: *.setinterval 2*',
          });
        }
        intervaloEnvio = horas * 60 * 60 * 1000;
        fs.writeFileSync('config.json', JSON.stringify({ intervaloEnvioHoras: horas }, null, 2));
        if (intervalId) clearInterval(intervalId);
        intervalId = setInterval(enviarMensajesGrupos, intervaloEnvio);
        return await client.sendMessage(sender, {
          text: `✅ Intervalo actualizado. Ahora se enviará cada ${horas} hora(s).`,
        });
      }
    });
  } catch (error) {
    console.error("Error al iniciar el bot:", error);
    setTimeout(startBot, 10000);
  }
}

startBot();
