const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField } = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessages
    ]
});

// ============================================================
//  QUAND LE BOT EST PRÊT
// ============================================================

client.once('ready', async () => {
    console.log(`✅ ${client.user.tag} est en ligne !`);

    // ============================================================
    //  ENREGISTRER LES COMMANDES SLASH
    // ============================================================

    const commands = [
        // Utilitaires
        { name: 'embed', description: 'Créer un embed personnalisé' },
        { name: 'help', description: 'Liste des commandes disponibles' },
        { name: 'userinfo', description: 'Infos d\'un utilisateur', options: [{ name: 'user', type: 6, description: 'L\'utilisateur', required: false }] },
        { name: 'serverinfo', description: 'Infos du serveur' },
        { name: 'clear', description: 'Supprimer des messages', options: [{ name: 'amount', type: 4, description: 'Nombre de messages (1-100)', required: true }] },
        { name: 'invite', description: 'Lien d\'invitation du bot' },
        { name: 'poll', description: 'Créer un sondage', options: [{ name: 'question', type: 3, description: 'La question', required: true }] },

        // Modération
        { name: 'ban', description: 'Bannir un membre', options: [{ name: 'user', type: 6, description: 'L\'utilisateur', required: true }, { name: 'reason', type: 3, description: 'Raison', required: false }] },
        { name: 'kick', description: 'Expulser un membre', options: [{ name: 'user', type: 6, description: 'L\'utilisateur', required: true }, { name: 'reason', type: 3, description: 'Raison', required: false }] },
        { name: 'mute', description: 'Mute temporairement un membre', options: [{ name: 'user', type: 6, description: 'L\'utilisateur', required: true }, { name: 'duration', type: 4, description: 'Durée en minutes', required: true }] },
        { name: 'unmute', description: 'Enlever le mute', options: [{ name: 'user', type: 6, description: 'L\'utilisateur', required: true }] },
        { name: 'tempban', description: 'Bannissement temporaire', options: [{ name: 'user', type: 6, description: 'L\'utilisateur', required: true }, { name: 'duration', type: 4, description: 'Durée en minutes', required: true }, { name: 'reason', type: 3, description: 'Raison', required: false }] },
        { name: 'unban', description: 'Débannir un membre', options: [{ name: 'user_id', type: 3, description: 'ID de l\'utilisateur', required: true }] },

        // Configuration
        { name: 'config', description: 'Panneau de configuration' },
    ];

    await client.application.commands.set(commands);
    console.log('✅ Commandes slash enregistrées !');
});

// ============================================================
//  COMMANDES AVEC PRÉFIXE (!)  
// ============================================================

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // ---------- UTILITAIRES ----------

    if (command === 'ping') {
        await message.reply(`🏓 Pong ! Latence : ${client.ws.ping}ms`);
    }

    if (command === 'say') {
        if (!message.member.permissions.has('ManageMessages')) {
            return message.reply('❌ Tu n\'as pas la permission.');
        }
        const text = args.join(' ');
        if (!text) return message.reply('📌 Utilisation : `!say <message>`');
        await message.delete();
        await message.channel.send(text);
    }

    if (command === 'snipe') {
        // Permet de récupérer le dernier message supprimé (nécessite un cache)
        const msg = message.client.snipeMap?.get(message.channel.id);
        if (!msg) return message.reply('❌ Aucun message supprimé récemment.');
        const embed = new EmbedBuilder()
            .setColor('#2C2F33')
            .setAuthor({ name: msg.author.tag, iconURL: msg.author.displayAvatarURL({ dynamic: true }) })
            .setDescription(msg.content)
            .setFooter({ text: `Supprimé à ${msg.createdAt.toLocaleTimeString()}` });
        await message.channel.send({ embeds: [embed] });
    }

    // ---------- MODÉRATION ----------

    if (command === 'clear') {
        if (!message.member.permissions.has('ManageMessages')) {
            return message.reply('❌ Tu n\'as pas la permission.');
        }
        const amount = parseInt(args[0]);
        if (!amount || amount < 1 || amount > 100) {
            return message.reply('📌 Utilisation : `!clear 10` (1 à 100 messages)');
        }
        await message.channel.bulkDelete(amount, true);
        const msg = await message.channel.send(`✅ ${amount} messages supprimés.`);
        setTimeout(() => msg.delete(), 3000);
    }

    if (command === 'lock') {
        if (!message.member.permissions.has('ManageChannels')) {
            return message.reply('❌ Tu n\'as pas la permission.');
        }
        await message.channel.permissionOverwrites.edit(message.guild.id, { SendMessages: false });
        await message.reply('🔒 Salon verrouillé.');
    }

    if (command === 'unlock') {
        if (!message.member.permissions.has('ManageChannels')) {
            return message.reply('❌ Tu n\'as pas la permission.');
        }
        await message.channel.permissionOverwrites.edit(message.guild.id, { SendMessages: true });
        await message.reply('🔓 Salon déverrouillé.');
    }

    if (command === 'ban') {
        if (!message.member.permissions.has('BanMembers')) {
            return message.reply('❌ Tu n\'as pas la permission.');
        }
        const user = message.mentions.users.first();
        if (!user) return message.reply('❌ Mentionne un membre à bannir.');
        const reason = args.slice(1).join(' ') || 'Aucune raison';
        await message.guild.members.ban(user.id, { reason });
        await message.reply(`✅ ${user.tag} a été banni. Raison : ${reason}`);
    }

    if (command === 'kick') {
        if (!message.member.permissions.has('KickMembers')) {
            return message.reply('❌ Tu n\'as pas la permission.');
        }
        const user = message.mentions.users.first();
        if (!user) return message.reply('❌ Mentionne un membre à expulser.');
        const reason = args.slice(1).join(' ') || 'Aucune raison';
        const member = message.guild.members.cache.get(user.id);
        await member.kick(reason);
        await message.reply(`✅ ${user.tag} a été expulsé. Raison : ${reason}`);
    }

    if (command === 'mute') {
        if (!message.member.permissions.has('ModerateMembers')) {
            return message.reply('❌ Tu n\'as pas la permission.');
        }
        const user = message.mentions.users.first();
        if (!user) return message.reply('❌ Mentionne un membre à mute.');
        const duration = parseInt(args[1]);
        if (!duration || duration < 1) {
            return message.reply('📌 Utilisation : `!mute @membre 10` (minutes)');
        }
        const member = message.guild.members.cache.get(user.id);
        await member.timeout(duration * 60000, 'Mute temporaire');
        await message.reply(`🔇 ${user.tag} mute pour ${duration} minutes.`);
    }

    if (command === 'unmute') {
        if (!message.member.permissions.has('ModerateMembers')) {
            return message.reply('❌ Tu n\'as pas la permission.');
        }
        const user = message.mentions.users.first();
        if (!user) return message.reply('❌ Mentionne un membre à unmute.');
        const member = message.guild.members.cache.get(user.id);
        await member.timeout(null);
        await message.reply(`✅ ${user.tag} a été unmute.`);
    }

    if (command === 'tempban') {
        if (!message.member.permissions.has('BanMembers')) {
            return message.reply('❌ Tu n\'as pas la permission.');
        }
        const user = message.mentions.users.first();
        if (!user) return message.reply('❌ Mentionne un membre à bannir.');
        const duration = parseInt(args[1]);
        if (!duration || duration < 1) {
            return message.reply('📌 Utilisation : `!tempban @membre 10` (minutes)');
        }
        const reason = args.slice(2).join(' ') || 'Aucune raison';
        await message.guild.members.ban(user.id, { reason });
        setTimeout(async () => {
            await message.guild.members.unban(user.id);
        }, duration * 60000);
        await message.reply(`✅ ${user.tag} banni pour ${duration} minutes.`);
    }

    if (command === 'unban') {
        if (!message.member.permissions.has('BanMembers')) {
            return message.reply('❌ Tu n\'as pas la permission.');
        }
        const userId = args[0];
        if (!userId) return message.reply('📌 Utilisation : `!unban <user_id>`');
        await message.guild.members.unban(userId);
        await message.reply(`✅ Utilisateur ${userId} débanni.`);
    }

    // ---------- SNIPE (cache des messages supprimés) ----------

    // Capturer les messages supprimés pour la commande !snipe
    client.snipeMap = new Map();
});

// ============================================================
//  CAPTURER LES MESSAGES SUPPRIMÉS POUR !SNIPE
// ============================================================

client.on('messageDelete', (message) => {
    if (message.author.bot) return;
    client.snipeMap.set(message.channel.id, {
        content: message.content,
        author: message.author,
        createdAt: message.createdAt
    });
});

// ============================================================
//  GESTION DES COMMANDES SLASH
// ============================================================

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options } = interaction;

    // ---------- UTILITAIRES ----------

    if (commandName === 'help') {
        const embed = new EmbedBuilder()
            .setColor('#6C2BD9')
            .setTitle('📋 Liste des commandes')
            .addFields(
                { name: '🛠️ Utilitaires', value: '`/embed`, `/help`, `/userinfo`, `/serverinfo`, `/clear`, `/invite`, `/poll`', inline: false },
                { name: '🛡️ Modération', value: '`/ban`, `/kick`, `/mute`, `/unmute`, `/tempban`, `/unban`', inline: false },
                { name: '⚙️ Configuration', value: '`/config`', inline: false },
                { name: '⌨️ Commandes préfixées', value: '`!ping`, `!say`, `!clear`, `!lock`, `!unlock`, `!snipe`, `!ban`, `!kick`, `!mute`, `!unmute`, `!tempban`, `!unban`', inline: false }
            );
        return interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'userinfo') {
        const user = options.getUser('user') || interaction.user;
        const member = interaction.guild.members.cache.get(user.id);
        const embed = new EmbedBuilder()
            .setColor('#6C2BD9')
            .setTitle(`👤 Infos de ${user.username}`)
            .addFields(
                { name: 'ID', value: user.id, inline: true },
                { name: 'Compte créé', value: user.createdAt.toLocaleDateString(), inline: true },
                { name: 'A rejoint', value: member ? member.joinedAt.toLocaleDateString() : 'Inconnu', inline: true },
                { name: 'Rôles', value: member ? member.roles.cache.map(r => r.name).join(', ') : 'Aucun', inline: false }
            )
            .setThumbnail(user.displayAvatarURL({ dynamic: true }));
        return interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'serverinfo') {
        const guild = interaction.guild;
        const embed = new EmbedBuilder()
            .setColor('#6C2BD9')
            .setTitle(`📊 Infos de ${guild.name}`)
            .addFields(
                { name: '👥 Membres', value: `${guild.memberCount}`, inline: true },
                { name: '📅 Créé le', value: guild.createdAt.toLocaleDateString(), inline: true },
                { name: '👑 Propriétaire', value: (await guild.fetchOwner()).user.tag, inline: true },
                { name: '📁 Salons', value: `${guild.channels.cache.size}`, inline: true },
                { name: '🎭 Rôles', value: `${guild.roles.cache.size}`, inline: true },
                { name: '🚀 Boosts', value: `${guild.premiumSubscriptionCount || 0}`, inline: true }
            )
            .setThumbnail(guild.iconURL({ dynamic: true }));
        return interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'clear') {
        if (!interaction.member.permissions.has('ManageMessages')) {
            return interaction.reply({ content: '❌ Tu n\'as pas la permission.', ephemeral: true });
        }
        const amount = options.getInteger('amount');
        if (amount < 1 || amount > 100) {
            return interaction.reply({ content: '❌ Choisis un nombre entre 1 et 100.', ephemeral: true });
        }
        await interaction.channel.bulkDelete(amount, true);
        return interaction.reply({ content: `✅ ${amount} messages supprimés.`, ephemeral: true });
    }

    if (commandName === 'poll') {
        const question = options.getString('question');
        const embed = new EmbedBuilder()
            .setColor('#6C2BD9')
            .setTitle('📊 Sondage')
            .setDescription(question)
            .setFooter({ text: `Proposé par ${interaction.user.username}` });
        const message = await interaction.reply({ embeds: [embed], fetchReply: true });
        await message.react('👍');
        await message.react('👎');
        await message.react('🤷');
        return;
    }

    if (commandName === 'invite') {
        return interaction.reply({
            content: `🔗 **Invite le bot :** [Clique ici](https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot+applications.commands)`,
            ephemeral: true
        });
    }

    if (commandName === 'embed') {
        if (!interaction.member.permissions.has('ManageMessages')) {
            return interaction.reply({ content: '❌ Tu n\'as pas la permission.', ephemeral: true });
        }
        // Commande basique, tu peux l'améliorer avec un modal
        const embed = new EmbedBuilder()
            .setColor('#6C2BD9')
            .setTitle('📌 Exemple d\'embed')
            .setDescription('Personnalise ton embed avec un modal !');
        return interaction.reply({ embeds: [embed] });
    }

    // ---------- MODÉRATION ----------

    if (commandName === 'ban') {
        if (!interaction.member.permissions.has('BanMembers')) {
            return interaction.reply({ content: '❌ Permission manquante.', ephemeral: true });
        }
        const user = options.getUser('user');
        const reason = options.getString('reason') || 'Aucune raison';
        const member = interaction.guild.members.cache.get(user.id);
        if (member && !member.bannable) {
            return interaction.reply({ content: '❌ Je ne peux pas bannir ce membre.', ephemeral: true });
        }
        await interaction.guild.members.ban(user.id, { reason });
        return interaction.reply({ content: `✅ ${user.tag} a été banni. Raison : ${reason}` });
    }

    if (commandName === 'kick') {
        if (!interaction.member.permissions.has('KickMembers')) {
            return interaction.reply({ content: '❌ Permission manquante.', ephemeral: true });
        }
        const user = options.getUser('user');
        const reason = options.getString('reason') || 'Aucune raison';
        const member = interaction.guild.members.cache.get(user.id);
        if (!member.kickable) {
            return interaction.reply({ content: '❌ Je ne peux pas expulser ce membre.', ephemeral: true });
        }
        await member.kick(reason);
        return interaction.reply({ content: `✅ ${user.tag} a été expulsé. Raison : ${reason}` });
    }

    if (commandName === 'mute') {
        if (!interaction.member.permissions.has('ModerateMembers')) {
            return interaction.reply({ content: '❌ Permission manquante.', ephemeral: true });
        }
        const user = options.getUser('user');
        const duration = options.getInteger('duration');
        const member = interaction.guild.members.cache.get(user.id);
        if (!member.moderatable) {
            return interaction.reply({ content: '❌ Je ne peux pas mute ce membre.', ephemeral: true });
        }
        await member.timeout(duration * 60000, 'Mute temporaire');
        return interaction.reply({ content: `🔇 ${user.tag} mute pour ${duration} minutes.` });
    }

    if (commandName === 'unmute') {
        if (!interaction.member.permissions.has('ModerateMembers')) {
            return interaction.reply({ content: '❌ Permission manquante.', ephemeral: true });
        }
        const user = options.getUser('user');
        const member = interaction.guild.members.cache.get(user.id);
        await member.timeout(null);
        return interaction.reply({ content: `✅ ${user.tag} a été unmute.` });
    }

    if (commandName === 'tempban') {
        if (!interaction.member.permissions.has('BanMembers')) {
            return interaction.reply({ content: '❌ Permission manquante.', ephemeral: true });
        }
        const user = options.getUser('user');
        const duration = options.getInteger('duration');
        const reason = options.getString('reason') || 'Aucune raison';
        await interaction.guild.members.ban(user.id, { reason });
        setTimeout(async () => {
            await interaction.guild.members.unban(user.id);
        }, duration * 60000);
        return interaction.reply({ content: `✅ ${user.tag} banni pour ${duration} minutes. Raison : ${reason}` });
    }

    if (commandName === 'unban') {
        if (!interaction.member.permissions.has('BanMembers')) {
            return interaction.reply({ content: '❌ Permission manquante.', ephemeral: true });
        }
        const userId = options.getString('user_id');
        await interaction.guild.members.unban(userId);
        return interaction.reply({ content: `✅ Utilisateur ${userId} débanni.` });
    }

    if (commandName === 'config') {
        if (!interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ content: '❌ Seul un administrateur peut configurer.', ephemeral: true });
        }
        const embed = new EmbedBuilder()
            .setColor('#6C2BD9')
            .setTitle('⚙️ Configuration')
            .setDescription('Pour configurer les logs, utilisez les commandes suivantes :\n`/setlogs logs`\n`/setlogs moderation`\n`/setlogs welcome`\n`/setlogs tickets`')
            .setFooter({ text: 'Astralia Bot' });
        return interaction.reply({ embeds: [embed] });
    }
});

// ============================================================
//  MESSAGE DE BIENVENUE
// ============================================================

client.on('guildMemberAdd', async (member) => {
    const channel = member.guild.channels.cache.get('ID_BIENVENUE'); // Remplace par l'ID de #bienvenue
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setColor('#6C2BD9')
        .setTitle('🌟 Bienvenue sur ASTRALIA 🐉 !')
        .setDescription(`Hey ${member.user}, bienvenue dans la communauté ! 🔥`)
        .addFields(
            { name: '📜 Règles', value: `Va lire le règlement dans <#ID_REGLEMENT>`, inline: true },
            { name: '📍 NSFW', value: `Le contenu adulte est dans <#ID_NSFW>`, inline: true },
            { name: '💬 Chat', value: `Présente-toi dans <#ID_CHAT>`, inline: false }
        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: `Membre #${member.guild.memberCount}` });

    await channel.send({ embeds: [embed] });

    const role = member.guild.roles.cache.find(r => r.name === 'membre');
    if (role) {
        await member.roles.add(role).catch(console.error);
    }
});

// ============================================================
//  SERVEUR HTTP POUR RENDER (Keep Alive)
// ============================================================

const http = require('http');
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running!');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Serveur HTTP en écoute sur le port ${PORT}`);
});

// ============================================================
//  CONNEXION DU BOT
// ============================================================

client.login(process.env.TOKEN);