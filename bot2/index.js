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

// ANA BOT AYARI
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
        new SlashCommandBuilder().setName('botaktif').setDescription('İşçileri sokar.').addChannelOption(o => o.setName('kanal').setDescription('Kanal seç').setRequired(true)),
        new SlashCommandBuilder().setName('botpasif').setDescription('İşçileri çıkarır.')
    ].map(c => c.toJSON());
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    setupMainBot();
    console.log("🚀 Sistem hazır!");
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'botaktif') {
        const selectedChannel = interaction.options.getChannel('kanal');
        await interaction.deferReply();

        tokens.forEach((token, index) => {
            const worker = new SelfClient({ 
                checkUpdate: false,
                ws: { properties: { os: 'Windows', browser: 'Discord Client', release_channel: 'stable' } }
            });

            // KRİTİK DÜZELTME: Loglardaki 'reading all' hatasını engellemek için ayar yöneticisini devre dışı bırakıyoruz
            worker.on('raw', (packet) => {
                if (packet.t === 'READY') {
                    packet.d.user_settings = undefined; // Hata veren ayarları siliyoruz
                }
            });

            worker.on('ready', async () => {
                console.log(`📡 ${worker.user.tag} bağlandı.`);
                setTimeout(async () => {
                    try {
                        const channel = await worker.channels.fetch(selectedChannel.id);
                        await channel.join();
                        
                        const guild = worker.guilds.cache.get(GUILD_ID);
                        if (guild) {
                            await guild.me.voice.setSelfMute(true); // Mikrofon Kapalı
                            await guild.me.voice.setSelfDeaf(false); // Kulaklık Açık
                        }
                        
                        activeWorkers.push(worker);
                        console.log(`✅ ${worker.user.tag} kanalda!`);
                    } catch (e) { console.log(`❌ Ses Hatası: ${e.message}`); }
                }, 2000);
            });

            worker.login(token).catch(() => console.log(`❌ Token ${index+1} hatalı!`));
        });

        await interaction.editReply(`✅ İşlem başlatıldı.`);
    }

    if (interaction.commandName === 'botpasif') {
        activeWorkers.forEach(w => { try { w.destroy(); } catch(e) {} });
        activeWorkers = [];
        await interaction.reply('❌ İşçiler çıkarıldı.');
    }
});

client.login(mainToken);
