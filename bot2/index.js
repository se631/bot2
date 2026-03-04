const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');

// Railway Variables kısmından bu iki bilgiyi doğru girdiğinden emin ol
const mainToken = process.env.MAIN_TOKEN;
const MAIN_BOT_VOICE_ID = process.env.MAIN_BOT_VOICE_ID;
const GUILD_ID = process.env.GUILD_ID;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates
    ]
});

client.once('ready', () => {
    console.log(`✅ ${client.user.tag} olarak giriş yapıldı!`);

    try {
        const guild = client.guilds.cache.get(GUILD_ID);
        if (!guild) {
            console.log("⚠️ Sunucu (GUILD_ID) bulunamadı. ID'yi kontrol et.");
            return;
        }

        // SES KANALINA GİRİŞ VE SAĞIRLAŞTIRMA
        joinVoiceChannel({
            channelId: MAIN_BOT_VOICE_ID,
            guildId: GUILD_ID,
            adapterCreator: guild.voiceAdapterCreator,
            selfDeaf: true, // Kulaklık Kapalı (Sağırlaştırılmış)
            selfMute: false  // Mikrofon Açık
        });

        // DURUM MESAJI (Streaming)
        client.user.setPresence({
            activities: [{ 
                name: 'Developed by Cyrusfix', 
                type: ActivityType.Streaming,
                url: 'https://www.twitch.tv/cyrusfix'
            }],
            status: 'online',
        });

        console.log("🎙️ Bot sese girdi ve kulaklık kapatıldı.");
    } catch (e) {
        console.error("❌ Bir hata oluştu:", e.message);
    }
});

client.login(mainToken);
