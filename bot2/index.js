const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ActivityType } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const { Client: SelfClient } = require('discord.js-selfbot-v13');
const fs = require('fs');

// db.json dosyasını oku
const db = JSON.parse(fs.readFileSync('./db.json', 'utf8'));

const mainToken = db.mainToken;
const tokens = db.tokens;
const MAIN_BOT_VOICE_ID = "1478527879762673795"; // Ana botun duracağı kanal
const GUILD_ID = "1460662786014314579"; // Botun bulunduğu sunucu

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages
    ]
});

let activeWorkers = [];

// --- ANA BOT SES VE DURUM AYARI ---
function setupMainBot() {
    // Ses Bağlantısı (Sağırlaştırılmış)
    joinVoiceChannel({
        channelId: MAIN_BOT_VOICE_ID,
        guildId: GUILD_ID,
        adapterCreator: client.guilds.cache.get(GUILD_ID).voiceAdapterCreator,
        selfDeaf: false,
        selfMute: true
    });

    // "Developed by Cyrusfix" Yayını
    client.user.setPresence({
        activities: [{ 
            name: 'Developed by CyrusFix', 
            type: ActivityType.Streaming,
            url: 'https://www.twitch.tv/cyrusfix' // Twitch linki şarttır, rastgele olabilir
        }],
        status: 'online',
    });

    console.log("📌 Ana bot sese bağlandı ve yayın durumu güncellendi.");
}

client.once('ready', async () => {
    const rest = new REST({ version: '10' }).setToken(mainToken);
    const commands = [
        new SlashCommandBuilder().setName('botaktif').setDescription('Tokenleri bulunduğun sese sokar.'),
        new SlashCommandBuilder().setName('botpasif').setDescription('Tokenleri sesten çıkarır.')
    ].map(c => c.toJSON());

    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    
    setupMainBot();
    console.log(`${client.user.tag} sistemi hazır!`);
});

// Komut Yönetimi
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'botaktif') {
        const userChannel = interaction.member.voice.channel;
        if (!userChannel) return interaction.reply({ content: 'Bir ses kanalında olmalısın!', ephemeral: true });

        await interaction.deferReply();

        tokens.forEach((token) => {
            const worker = new SelfClient({ checkUpdate: false });
            worker.on('ready', async () => {
                try {
                    const channel = await worker.channels.fetch(userChannel.id);
                    await channel.join();
                    
                    // İşçi hesapları da sağırlaştır (Görseldeki gibi)
                    const me = worker.guilds.cache.get(interaction.guildId).me;
                    await me.voice.setSelfDeaf(false);
                    await me.voice.setSelfMute(true);
                    
                    activeWorkers.push(worker);
                } catch (e) { console.log("Hata: " + e.message); }
            });
            worker.login(token).catch(() => {});
        });

        await interaction.editReply(`✅ **${tokens.length}** adet hesap sese katıldı.`);
    }

    if (interaction.commandName === 'botpasif') {
        activeWorkers.forEach(w => w.destroy());
        activeWorkers = [];
        await interaction.reply('❌ Tüm yan hesaplar sesten çekildi.');
    }
});

// Bot düşerse tekrar bağlansın
client.on('voiceStateUpdate', (oldState, newState) => {
    if (newState.id === client.user.id && !newState.channelId) {
        setupMainBot();
    }
});

client.login(mainToken);