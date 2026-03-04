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

// --- ANA BOT AYARI ---
function setupMainBot() {
    try {
        joinVoiceChannel({
            channelId: MAIN_BOT_VOICE_ID,
            guildId: GUILD_ID,
            adapterCreator: client.guilds.cache.get(GUILD_ID).voiceAdapterCreator,
            selfDeaf: true, // Kulaklık Kapalı (Görseldeki gibi)
            selfMute: false // Mikrofon Açık (Ama ses gitmez, sadece simge gözükmez)
        });

        client.user.setPresence({
            activities: [{ 
                name: 'Developed by Cyrusfix', 
                type: ActivityType.Streaming,
                url: 'https://www.twitch.tv/cyrusfix'
            }],
            status: 'online',
        });
        console.log("📌 Ana bot sağırlaştırılmış modda sese bağlandı.");
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

    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    setupMainBot();
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'botaktif') {
        const selectedChannel = interaction.options.getChannel('kanal');
        await interaction.deferReply();

        tokens.forEach((token, index) => {
            if(!token) return;
            const worker = new SelfClient({ checkUpdate: false });
            
            worker.on('ready', async () => {
                try {
                    const guild = worker.guilds.cache.get(GUILD_ID);
                    if (!guild) return console.log(`Worker ${index+1} sunucuda değil.`);

                    const channel = await worker.channels.fetch(selectedChannel.id);
                    await channel.join();
                    
                    // İŞÇİ AYARI: Sadece Mikrofon Kapalı
                    await guild.me.voice.setSelfMute(true); 
                    await guild.me.voice.setSelfDeaf(false); 
                    
                    activeWorkers.push(worker);
                    console.log(`✅ [Worker] ${worker.user.tag} sese girdi.`);
                } catch (e) { console.log(`Worker ${index + 1} hatası: ${e.message}`); }
            });

            worker.login(token).catch(() => console.log(`Token geçersiz: ${index+1}`));
        });

        await interaction.editReply(`✅ İşçi botlar **${selectedChannel.name}** kanalına gönderildi.`);
    }

    if (interaction.commandName === 'botpasif') {
        activeWorkers.forEach(w => w.destroy());
        activeWorkers = [];
        await interaction.reply('❌ Tüm işçi botlar sesten çıkarıldı.');
    }
});

client.login(mainToken);
