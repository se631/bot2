const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ActivityType } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const { Client: SelfClient } = require('discord.js-selfbot-v13');

// Değişkenleri Railway'den çekiyoruz
const mainToken = process.env.MAIN_TOKEN;
const workerTokensRaw = process.env.WORKER_TOKENS || "";
const tokens = workerTokensRaw.split(',').map(t => t.trim());
const MAIN_BOT_VOICE_ID = process.env.MAIN_BOT_VOICE_ID; // Ana botun sabit kalacağı yer
const GUILD_ID = process.env.GUILD_ID;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages
    ]
});

let activeWorkers = [];

// Ana botun sürekli duracağı sabit kanal fonksiyonu
function setupMainBot() {
    try {
        joinVoiceChannel({
            channelId: MAIN_BOT_VOICE_ID,
            guildId: GUILD_ID,
            adapterCreator: client.guilds.cache.get(GUILD_ID).voiceAdapterCreator,
            selfDeaf: true, // Sağırlaştırma
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
        console.log("📌 Ana bot sabit ses kanalına bağlandı.");
    } catch (e) {
        console.error("Ana bot ses hatası:", e.message);
    }
}

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(mainToken);
    const commands = [
        new SlashCommandBuilder()
            .setName('botaktif')
            .setDescription('İşçi botları bulunduğun ses kanalına çağırır.'),
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
        // Komutu kullanan kişinin kanalını buluyoruz
        const targetChannel = interaction.member.voice.channel;

        if (!targetChannel) {
            return interaction.reply({ content: '❌ Bu komutu kullanmak için bir ses kanalında olmalısın!', ephemeral: true });
        }

        await interaction.deferReply();

        tokens.forEach((token, index) => {
            if(!token) return;
            const worker = new SelfClient({ checkUpdate: false });
            
            worker.on('ready', async () => {
                try {
                    const channel = await worker.channels.fetch(targetChannel.id);
                    await channel.join();
                    
                    // İşçi bot ayarları (Sağır + Mute)
                    const guild = worker.guilds.cache.get(interaction.guildId);
                    if (guild) {
                        await guild.me.voice.setSelfDeaf(false);
                        await guild.me.voice.setSelfMute(true);
                    }
                    
                    activeWorkers.push(worker);
                    console.log(`[Worker ${index + 1}] Kanala giriş yaptı: ${targetChannel.name}`);
                } catch (e) { 
                    console.log(`[Worker ${index + 1}] Giriş hatası: ${e.message}`); 
                }
            });

            worker.login(token).catch(() => console.log(`[Worker ${index + 1}] Token geçersiz!`));
        });

        await interaction.editReply(`✅ **${tokens.length}** adet işçi bot **${targetChannel.name}** kanalına başarıyla çekildi!`);
    }

    if (interaction.commandName === 'botpasif') {
        if (activeWorkers.length === 0) {
            return interaction.reply({ content: 'Zaten aktif bir işçi bot yok.', ephemeral: true });
        }
        
        activeWorkers.forEach(w => w.destroy());
        activeWorkers = [];
        await interaction.reply('❌ Tüm işçi botlar sesten çıkarıldı.');
    }
});

client.login(mainToken);
