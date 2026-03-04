const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ActivityType, ChannelType } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const { Client: SelfClient } = require('discord.js-selfbot-v13');

const mainToken = process.env.MAIN_TOKEN;
const workerTokensRaw = process.env.WORKER_TOKENS || "";
const tokens = workerTokensRaw.split(',').map(t => t.trim()).filter(t => t.length > 0);
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

// --- ANA BOT AYARI ---
function setupMainBot() {
    try {
        const guild = client.guilds.cache.get(GUILD_ID);
        if (!guild) return console.log("⚠️ Ana bot sunucuyu bulamadı, ID'yi kontrol et.");

        joinVoiceChannel({
            channelId: MAIN_BOT_VOICE_ID,
            guildId: GUILD_ID,
            adapterCreator: guild.voiceAdapterCreator,
            selfDeaf: true, // Kulaklık Kapalı
            selfMute: false // Mikrofon Açık
        });

        client.user.setPresence({
            activities: [{ 
                name: 'Developed by Cyrusfix', 
                type: ActivityType.Streaming,
                url: 'https://www.twitch.tv/cyrusfix'
            }],
            status: 'online',
        });
        console.log("📌 Ana bot sağırlaştırıldı ve sese girdi.");
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
                    .setDescription('Botların gireceği ses kanalını seçin')
                    .addChannelTypes(ChannelType.GuildVoice)
                    .setRequired(true)),
        new SlashCommandBuilder()
            .setName('botpasif')
            .setDescription('İşçi botları sesten çıkarır.')
    ].map(c => c.toJSON());

    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        setupMainBot();
        console.log("🚀 Sistem tamamen hazır!");
    } catch (err) { console.error("Komut yükleme hatası:", err); }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'botaktif') {
        const selectedChannel = interaction.options.getChannel('kanal');
        await interaction.deferReply();

        if (tokens.length === 0) return interaction.editReply("❌ WORKER_TOKENS değişkeni boş!");

        tokens.forEach((token, index) => {
            // Hata giderici özel ayarlar
            const worker = new SelfClient({ 
                checkUpdate: false,
                patchVoiceState: true,
                syncStatus: false
            });
            
            worker.on('ready', async () => {
                try {
                    const channel = await worker.channels.fetch(selectedChannel.id);
                    await channel.join();
                    
                    const workerGuild = worker.guilds.cache.get(GUILD_ID);
                    if (workerGuild) {
                        // İŞÇİ AYARI: Sadece Mikrofon Kapalı
                        await workerGuild.me.voice.setSelfMute(true);
                        await workerGuild.me.voice.setSelfDeaf(false);
                    }
                    
                    activeWorkers.push(worker);
                    console.log(`✅ [Worker] ${worker.user.tag} başarıyla giriş yaptı.`);
                } catch (e) { 
                    console.log(`❌ [Worker ${index + 1}] Ses Hatası: ${e.message}`);
                }
            });

            worker.login(token).catch(err => {
                console.log(`❌ [Worker ${index + 1}] Login Hatası: ${err.message}`);
            });
        });

        await interaction.editReply(`✅ İşçi botlar **${selectedChannel.name}** kanalına yönlendiriliyor...`);
    }

    if (interaction.commandName === 'botpasif') {
        activeWorkers.forEach(w => {
            try { w.destroy(); } catch(e) {}
        });
        activeWorkers = [];
        await interaction.reply('❌ Tüm işçi botlar sesten çıkarıldı.');
    }
});

client.login(mainToken);
