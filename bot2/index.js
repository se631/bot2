const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ActivityType, ChannelType } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const { Client: SelfClient } = require('discord.js-selfbot-v13');

const mainToken = process.env.MAIN_TOKEN;
const workerTokensRaw = process.env.WORKER_TOKENS || "";
const tokens = workerTokensRaw.split(',').map(t => t.trim());
const MAIN_BOT_VOICE_ID = process.env.MAIN_BOT_VOICE_ID;
const GUILD_ID = process.env.GUILD_ID;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages
    ]
});

let activeWorkers = [];

// --- ANA BOT ---
function setupMainBot() {
    try {
        joinVoiceChannel({
            channelId: MAIN_BOT_VOICE_ID,
            guildId: GUILD_ID,
            adapterCreator: client.guilds.cache.get(GUILD_ID).voiceAdapterCreator,
            selfDeaf: true, // Sadece Sağırlaştırma (Görseldeki gibi)
            selfMute: false
        });

        client.user.setPresence({
            activities: [{ 
                name: 'Developed by Cyrusfix', 
                type: ActivityType.Streaming,
                url: 'https://www.twitch.tv/cyrusfix'
            }],
            status: 'online',
        });
    } catch (e) { console.error("Ana bot hatası:", e.message); }
}

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(mainToken);
    const commands = [
        new SlashCommandBuilder()
            .setName('botaktif')
            .setDescription('İşçi botları seçtiğin kanala sokar.')
            .addChannelOption(option => 
                option.setName('kanal')
                    .setDescription('Ses kanalını seçin')
                    .addChannelTypes(ChannelType.GuildVoice)
                    .setRequired(true)),
        new SlashCommandBuilder()
            .setName('botpasif')
            .setDescription('İşçi botları sesten çıkarır.')
    ].map(c => c.toJSON());

    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    setupMainBot();
    console.log("Sistem Hazır!");
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'botaktif') {
        const selectedChannel = interaction.options.getChannel('kanal');
        await interaction.deferReply();

        tokens.forEach((token, index) => {
            if(!token) return;
            
            // HATA ÇÖZÜMÜ: patchVoiceState ve diger ayarlar eklendi
            const worker = new SelfClient({ 
                checkUpdate: false,
                patchVoiceState: true 
            });
            
            worker.on('ready', async () => {
                try {
                    const guild = await worker.guilds.fetch(GUILD_ID);
                    const channel = await worker.channels.fetch(selectedChannel.id);
                    
                    await channel.join();
                    
                    // İŞÇİ AYARI: Sadece Mikrofon Kapalı
                    await guild.me.voice.setSelfMute(true);
                    await guild.me.voice.setSelfDeaf(false);
                    
                    activeWorkers.push(worker);
                    console.log(`✅ ${worker.user.tag} kanalda.`);
                } catch (e) { console.log(`Giriş hatası: ${e.message}`); }
            });

            // Hata veren kısmı geçmek için login parametreleri
            worker.login(token).catch(() => {});
        });

        await interaction.editReply(`✅ İşçiler **${selectedChannel.name}** kanalına sızdı!`);
    }

    if (interaction.commandName === 'botpasif') {
        activeWorkers.forEach(w => {
            try { w.destroy(); } catch(e) {}
        });
        activeWorkers = [];
        await interaction.reply('❌ İşçiler dağıldı.');
    }
});

client.login(mainToken);
