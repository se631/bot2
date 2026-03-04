const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ActivityType } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const { Client: SelfClient } = require('discord.js-selfbot-v13');

// Değişkenleri Railway'den (process.env) çekiyoruz
const mainToken = process.env.MAIN_TOKEN;
const workerTokensRaw = process.env.WORKER_TOKENS || "";
const tokens = workerTokensRaw.split(',').map(t => t.trim()); // Virgülle ayrılmış tokenleri listeye çevirir
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
            activities: [{ 
                name: 'Developed by Cyrusfix', 
                type: ActivityType.Streaming,
                url: 'https://www.twitch.tv/cyrusfix'
            }],
            status: 'online',
        });
        console.log("📌 Ana bot sese bağlandı.");
    } catch (e) {
        console.error("Ses bağlantı hatası:", e.message);
    }
}

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(mainToken);
    const commands = [
        new SlashCommandBuilder().setName('botaktif').setDescription('Tokenleri sese sokar.'),
        new SlashCommandBuilder().setName('botpasif').setDescription('Tokenleri çıkarır.')
    ].map(c => c.toJSON());

    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    setupMainBot();
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'botaktif') {
        const userChannel = interaction.member.voice.channel;
        if (!userChannel) return interaction.reply({ content: 'Bir ses kanalında olmalısın!', ephemeral: true });

        await interaction.deferReply();

        tokens.forEach((token) => {
            if(!token) return;
            const worker = new SelfClient({ checkUpdate: false });
            worker.on('ready', async () => {
                try {
                    const channel = await worker.channels.fetch(userChannel.id);
                    await channel.join();
                    const me = worker.guilds.cache.get(interaction.guildId).me;
                    await me.voice.setSelfDeaf(false);
                    await me.voice.setSelfMute(true);
                    activeWorkers.push(worker);
                } catch (e) { console.log("Worker hatası: " + e.message); }
            });
            worker.login(token).catch(() => {});
        });

        await interaction.editReply(`✅ İşçi hesaplar sese katıldı.`);
    }

    if (interaction.commandName === 'botpasif') {
        activeWorkers.forEach(w => w.destroy());
        activeWorkers = [];
        await interaction.reply('❌ Tüm yan hesaplar kapatıldı.');
    }
});

client.login(mainToken);


