const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ActivityType, ChannelType } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const { Client: SelfClient } = require('discord.js-selfbot-v13');

const mainToken = process.env.MAIN_TOKEN;
const workerTokensRaw = process.env.WORKER_TOKENS || "";
const tokens = workerTokensRaw.split(',').map(t => t.trim()).filter(t => t.length > 0);
const MAIN_BOT_VOICE_ID = process.env.MAIN_BOT_VOICE_ID;
const GUILD_ID = process.env.GUILD_ID;

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages]
});

let activeWorkers = [];

// --- ANA BOT BAĞLANTISI ---
function setupMainBot() {
    try {
        joinVoiceChannel({
            channelId: MAIN_BOT_VOICE_ID,
            guildId: GUILD_ID,
            adapterCreator: client.guilds.cache.get(GUILD_ID).voiceAdapterCreator,
            selfDeaf: true, // Kulaklık Kapalı
            selfMute: false
        });
        client.user.setPresence({
            activities: [{ name: 'Developed by Cyrusfix', type: ActivityType.Streaming, url: 'https://www.twitch.tv/cyrusfix' }],
            status: 'online',
        });
        console.log("📌 Ana bot sese girdi.");
    } catch (e) { console.error("Ana bot hatası:", e.message); }
}

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(mainToken);
    const commands = [
        new SlashCommandBuilder()
            .setName('botaktif')
            .setDescription('İşçi botları seçtiğin kanala sokar.')
            .addChannelOption(o => o.setName('kanal').setDescription('Ses kanalını seçin').addChannelTypes(ChannelType.GuildVoice).setRequired(true)),
        new SlashCommandBuilder()
            .setName('botpasif')
            .setDescription('İşçi botları sesten çıkarır.')
    ].map(c => c.toJSON());

    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    setupMainBot();
    console.log("🚀 Sistem hazır! Komutları kullanabilirsin.");
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'botaktif') {
        const selectedChannel = interaction.options.getChannel('kanal');
        await interaction.deferReply();

        tokens.forEach((token, index) => {
            const worker = new SelfClient({ 
                checkUpdate: false,
                // Discord'un 'all' hatasını ve güvenlik engelini aşmak için properties:
                ws: { properties: { os: 'Windows', browser: 'Discord Client', release_channel: 'stable' } }
            });
            
            worker.on('ready', async () => {
                console.log(`📡 ${worker.user.tag} bağlandı, 3sn sonra sese giriyor...`);
                
                // Güvenlik için kısa bir bekleme
                setTimeout(async () => {
                    try {
                        const guild = worker.guilds.cache.get(GUILD_ID);
                        const channel = await worker.channels.fetch(selectedChannel.id);
                        
                        await channel.join();
                        
                        // İŞÇİ AYARI: Mikrofon Kapalı, Kulaklık Açık
                        if (guild) {
                            await guild.me.voice.setSelfMute(true);
                            await guild.me.voice.setSelfDeaf(false);
                        }
                        
                        activeWorkers.push(worker);
                        console.log(`✅ [İŞÇİ] ${worker.user.tag} kanala sızdı!`);
                    } catch (e) { 
                        console.log(`❌ [İŞÇİ] ${worker.user.tag} Ses Hatası: ${e.message}`); 
                    }
                }, 3000);
            });

            worker.login(token).catch(e => console.log(`❌ [TOKEN] ${index + 1} Giriş Başarısız: ${e.message}`));
        });

        await interaction.editReply(`✅ İşlem başlatıldı! **${selectedChannel.name}** kanalı kontrol ediliyor.`);
    }

    if (interaction.commandName === 'botpasif') {
        activeWorkers.forEach(w => { try { w.destroy(); } catch(e) {} });
        activeWorkers = [];
        await interaction.reply('❌ Tüm işçiler çekildi.');
    }
});

client.login(mainToken);
