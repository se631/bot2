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

function setupMainBot() {
    try {
        joinVoiceChannel({
            channelId: MAIN_BOT_VOICE_ID,
            guildId: GUILD_ID,
            adapterCreator: client.guilds.cache.get(GUILD_ID).voiceAdapterCreator,
            selfDeaf: true,
            selfMute: false
        });
        client.user.setPresence({
            activities: [{ name: 'Developed by Cyrusfix', type: ActivityType.Streaming, url: 'https://www.twitch.tv/cyrusfix' }],
            status: 'online',
        });
    } catch (e) { console.error("Ana bot hatası:", e.message); }
}

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(mainToken);
    const commands = [
        new SlashCommandBuilder().setName('botaktif').setDescription('İşçileri seçtiğin kanala sokar.').addChannelOption(o => o.setName('kanal').setDescription('Ses kanalını seçin').addChannelTypes(ChannelType.GuildVoice).setRequired(true)),
        new SlashCommandBuilder().setName('botpasif').setDescription('İşçileri çıkarır.')
    ].map(c => c.toJSON());
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    setupMainBot();
    console.log("🚀 Sistem Hazır!");
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'botaktif') {
        const selectedChannel = interaction.options.getChannel('kanal');
        await interaction.deferReply();

        tokens.forEach((token, index) => {
            const worker = new SelfClient({ 
                checkUpdate: false,
                // KRİTİK AYAR: Hatayı engelleyen kısım
                ws: { properties: { os: 'Linux', browser: 'Discord Client', release_channel: 'stable' } }
            });
            
            worker.on('ready', async () => {
                try {
                    const channel = await worker.channels.fetch(selectedChannel.id);
                    await channel.join();
                    const guild = worker.guilds.cache.get(GUILD_ID);
                    if (guild) {
                        await guild.me.voice.setSelfMute(true); // İşçi: Mikrofon Kapalı
                        await guild.me.voice.setSelfDeaf(false); // İşçi: Kulaklık Açık
                    }
                    activeWorkers.push(worker);
                    console.log(`✅ ${worker.user.tag} sese girdi.`);
                } catch (e) { console.log(`Hata: ${e.message}`); }
            });
            worker.login(token).catch(e => console.log("Login hatası!"));
        });
        await interaction.editReply(`✅ İşçiler **${selectedChannel.name}** kanalına yönlendirildi.`);
    }

    if (interaction.commandName === 'botpasif') {
        activeWorkers.forEach(w => { try { w.destroy(); } catch(e) {} });
        activeWorkers = [];
        await interaction.reply('❌ İşçiler sesten çıkarıldı.');
    }
});

client.login(mainToken);
