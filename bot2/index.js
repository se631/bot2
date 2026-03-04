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
            selfDeaf: true, // ANA BOT: Sadece Kulaklık Kapalı
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
                // KRİTİK AYAR: 'all' hatasını ve güvenlik engellerini aşmak için tarayıcıyı taklit eder
                ws: { properties: { os: 'Windows', browser: 'Discord Client', release_channel: 'stable' } },
                patchVoiceState: true 
            });
            
            worker.on('ready', async () => {
                console.log(`📡 ${worker.user.tag} bağlandı, sese hazırlanıyor...`);
                
                // Bağlantı stabilitesi için kısa bir gecikme
                setTimeout(async () => {
                    try {
                        const guild = worker.guilds.cache.get(GUILD_ID);
                        const channel = await worker.channels.fetch(selectedChannel.id);
                        
                        await channel.join();
                        
                        // İŞÇİ AYARI: Sadece Mikrofon Kapalı
                        if (guild) {
                            await guild.me.voice.setSelfMute(true); 
                            await guild.me.voice.setSelfDeaf(false); 
                        }
                        
                        activeWorkers.push(worker);
                        console.log(`✅ [İŞÇİ] ${worker.user.tag} kanala girdi!`);
                    } catch (e) { 
                        console.log(`❌ [İŞÇİ] ${worker.user.tag} Ses Hatası: ${e.message}`); 
                    }
                }, 3000);
            });

            worker.login(token).catch(e => console.log(`❌ [TOKEN] ${index + 1} Giriş Başarısız!`));
        });

        await interaction.editReply(`✅ İşçi botlar **${selectedChannel.name}** kanalına yönlendiriliyor...`);
    }

    if (interaction.commandName === 'botpasif') {
        activeWorkers.forEach(w => { try { w.destroy(); } catch(e) {} });
        activeWorkers = [];
        await interaction.reply('❌ Tüm işçi botlar sesten çıkarıldı.');
    }
});

client.login(mainToken);
