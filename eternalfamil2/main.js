require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ActivityType } = require('discord.js');
const { Client: SelfBotClient } = require('discord.js-selfbot-v13');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');

// 1. Ana Botumuz
const mainBot = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
    ]
});

// Ayarlar ve Değişkenler
const botToken = process.env.ANA_BOT_TOKEN;
const mainBotChannelId = process.env.ANA_BOT_KANALI;
// Gelişmiş string işlemleri ile token listesini güvenli bir şekilde çekiyoruz
const userTokens = process.env.YAN_HESAPLAR ? process.env.YAN_HESAPLAR.split(',').map(t => t.trim()).filter(Boolean) : [];
const selfBots = []; // Aktif edilecek hesapların listesi

// Konsol Renklendirmeleri
const colors = {
    yellow: '\x1b[33m',
    green: '\x1b[32m',
    cyan: '\x1b[36m',
    red: '\x1b[31m',
    reset: '\x1b[0m'
};

// Ana Bot Başladığında
mainBot.once('ready', async () => {
    console.log(`${colors.green}✅ Ana bot başarıyla giriş yaptı: ${mainBot.user.tag}${colors.reset}`);

    // Yayında statüsü ve yazısı
    mainBot.user.setActivity('Developed By CyrusFix', {
        type: ActivityType.Streaming,
        url: 'https://www.twitch.tv/discord'
    });

    // Slash commandlarımızı hazırlayalım
    const commands = [
        new SlashCommandBuilder()
            .setName('botaktif')
            .setDescription('Kullanıcı hesaplarını belirlediğiniz ses kanalına sokar.')
            .addStringOption(option =>
                option.setName('kanal_id')
                    .setDescription('Girilecek ses kanalının ID\'sini girin')
                    .setRequired(true)),
        new SlashCommandBuilder()
            .setName('botdeaktif')
            .setDescription('Tüm kullanıcı hesaplarını bulundukları ses kanalından çıkarır.')
    ].map(command => command.toJSON());

    // API'ye komutları gönderelim
    const rest = new REST({ version: '10' }).setToken(botToken);
    try {
        console.log(`${colors.cyan}⚙️ Slash komutları yükleniyor...${colors.reset}`);
        await rest.put(
            Routes.applicationCommands(mainBot.user.id),
            { body: commands },
        );
        console.log(`${colors.green}✅ Slash komutları başarıyla yüklendi!${colors.reset}`);
    } catch (error) {
        console.error(`${colors.red}❌ Slash komutları yüklenirken hata oluştu:${colors.reset}`, error);
    }

    // Ana Botun Belirlenen Kanala Katılması (Mikrofon açık, kulaklık kapalı)
    if (mainBotChannelId) {
        try {
            const channel = await mainBot.channels.fetch(mainBotChannelId);
            if (channel && channel.isVoiceBased()) {
                joinVoiceChannel({
                    channelId: channel.id,
                    guildId: channel.guild.id,
                    adapterCreator: channel.guild.voiceAdapterCreator,
                    selfMute: false, // Mikrofon açık
                    selfDeaf: true,  // Kulaklık kapalı
                    group: 'main_bot'
                });
                console.log(`${colors.cyan}🔊 Ana bot ${channel.name} isimli sese katıldı (Mikrofon Açık, Kulaklık Kapalı).${colors.reset}`);
            } else {
                console.log(`${colors.yellow}⚠️ ANA_BOT_KANALI bulanamadı veya bir ses kanalı değil.${colors.reset}`);
            }
        } catch (error) {
            console.error(`${colors.red}❌ Ana bot kanala katılırken hata oluştu:${colors.reset}`, error.message);
        }
    }

    // Kullanıcı hesaplarının (SelfBotların) başlatılması
    if (userTokens.length > 0) {
        console.log(`${colors.cyan}⏳ Toplam ${userTokens.length} token için giriş yapılıyor...${colors.reset}`);
        for (const token of userTokens) {
            const selfBot = new SelfBotClient({ checkUpdate: false });

            selfBot.on('ready', () => {
                console.log(`${colors.green}🤖 Özel hesap giriş yaptı: ${selfBot.user.tag}${colors.reset}`);
                selfBot.user.setActivity('Developed By CyrusFix');
            });

            try {
                await selfBot.login(token);
                selfBots.push(selfBot);
            } catch (e) {
                console.error(`${colors.red}❌ Token hatalı veya giriş başarısız (${token.substring(0, 5)}...):${colors.reset}`, e.message);
            }
        }
    } else {
        console.log(`${colors.yellow}⚠️ Değişkenler (Variables) kısmında YAN_HESAPLAR bulunamadı.${colors.reset}`);
    }
});

// Etkileşimler (Mesaj/Slash Command) dinleniyor..
mainBot.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'botaktif') {
        const targetChannelId = interaction.options.getString('kanal_id');

        await interaction.reply({ content: `⏳ Kullanıcı hesapları <#${targetChannelId}> kanalına bağlanıyor... Lütfen bekleyiniz.`, ephemeral: true });

        // Bağlantı durumlarını kontrol için sayaçlar
        let basarili = 0;
        let basarisiz = 0;

        for (const selfBot of selfBots) {
            try {
                // Kanal selfBot'un cache'inde olmayabilir, fetch atalım
                const channel = await selfBot.channels.fetch(targetChannelId);

                // Selfbot v13 olduğu için isVoiceBased yerine isVoice() kullanılır
                if (!channel || (typeof channel.isVoice === 'function' && !channel.isVoice()) || (typeof channel.isVoice !== 'function' && channel.type !== 'GUILD_VOICE' && channel.type !== 'GUILD_STAGE_VOICE')) {
                    throw new Error('Kanal bulunamadı veya geçerli bir ses kanalı değil.');
                }

                joinVoiceChannel({
                    channelId: channel.id,
                    guildId: channel.guild.id,
                    adapterCreator: channel.guild.voiceAdapterCreator,
                    selfMute: true,  // Mikrofon kapalı
                    selfDeaf: true,  // Kulaklık kapalı (Tasarruf için önerilir)
                    group: selfBot.user.id // Her bot için farklı grup şart
                });

                basarili++;
            } catch (error) {
                console.error(`${colors.red}❌ ${selfBot.user?.tag || 'Bilinmeyen Kullanıcı'} kanala bağlanamadı:${colors.reset} ${error.message}`);
                basarisiz++;
            }
        }

        await interaction.editReply({
            content: `✅ İşlem tamamlandı!\n🟢 **${basarili}** hesap başarıyla sese bağlandı.\n🔴 **${basarisiz}** hesapta hata oluştu.`
        });
    }

    if (interaction.commandName === 'botdeaktif') {
        await interaction.reply({ content: `🔌 Hesaplar sesten ayrılıyor...`, ephemeral: true });

        for (const selfBot of selfBots) {
            try {
                // Tüm sunuculardaki ses bağlantılarını kontrol edip botu sesten çıkarıyoruz.
                selfBot.guilds.cache.forEach(guild => {
                    const conn = getVoiceConnection(guild.id, selfBot.user.id);
                    if (conn) {
                        conn.destroy(); // Bağlantıyı kapat (sesten çık)
                    }
                });
            } catch (error) {
                console.error(`Botdeaktif sırasında hata (${selfBot.user?.tag}):`, error.message);
            }
        }

        await interaction.editReply({ content: `✅ Tüm kullanıcı hesapları bulundukları ses kanallarından ayrıldı.` });
    }
});

// Eğer token bulunamazsa uyarı ver
if (!botToken) {
    console.error(`${colors.red}❌ Lütfen Variables (Değişkenler) panelindeki ANA_BOT_TOKEN değerini doldurun.${colors.reset}`);
    process.exit(1);
}

// Ana Botu Başlat
mainBot.login(botToken).catch(err => {
    console.error(`${colors.red}❌ Ana bot giriş başarısız oldu (Token hatalı olabilir):${colors.reset}`, err.message);
});
