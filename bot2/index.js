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

// Ana botun sabit duracağı kanal
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
        console.log("📌 Ana bot sabit kanala bağlandı.");
    } catch (e) { console.error("Ana bot hatası:", e.message); }
}

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(mainToken);
    
    // KOMUT GÜNCELLEMESİ: Kanal seçeneği eklendi
    const commands = [
        new SlashCommandBuilder()
            .setName('botaktif')
            .setDescription('İşçi botları seçtiğin kanala sokar.')
            .addChannelOption(option => 
                option.setName('kanal')
                    .setDescription('Botların gireceği ses kanalını seçin')
                    .addChannelTypes(ChannelType.GuildVoice) // Sadece ses kanallarını göster
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
        // Seçilen kanalı alıyoruz
        const selectedChannel = interaction.options.getChannel('kanal');

        await interaction.deferReply();

        tokens.forEach((token, index) => {
            if(!token) return;
            const worker = new SelfClient({ checkUpdate: false });
            
            worker.on('ready', async () => {
                try {
                    const channel = await worker.channels.fetch(selectedChannel.id);
                    await channel.join();
                    
                    const guild = worker.guilds.cache.get(interaction.guildId);
                    if (guild) {
                        await guild.me.voice.setSelfDeaf(false);
                        await guild.me.voice.setSelfMute(true);
                    }
                    
                    activeWorkers.push(worker);
                } catch (e) { console.log(`Worker ${index + 1} hatası: ${e.message}`); }
            });

            worker.login(token).catch(() => {});
        });

        await interaction.editReply(`✅ İşçi botlar **${selectedChannel.name}** kanalına yönlendirildi!`);
    }

    if (interaction.commandName === 'botpasif') {
        activeWorkers.forEach(w => w.destroy());
        activeWorkers = [];
        await interaction.reply('❌ Tüm işçi botlar sesten çıkarıldı.');
    }
});

client.login(mainToken);

