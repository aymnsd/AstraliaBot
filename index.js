const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
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
//  VARIABLES GLOBALES
// ============================================================

client.snipeMap = new Map();
client.giveaways = new Map();
client.logsChannels = {};

// ============================================================
//  QUAND LE BOT EST PRÊT
// ============================================================

client.once('ready', async () => {
    console.log(`✅ ${client.user.tag} est en ligne !`);

    // ============================================================
    //  COMMANDES SLASH
    // ============================================================

    const commands = [
        // Utilitaires
        { name: 'help', description: 'Liste des commandes disponibles' },
        { name: 'embed', description: 'Créer un embed personnalisé' },
        { name: 'userinfo', description: 'Infos d\'un utilisateur', options: [{ name: 'user', type: 6, description: 'L\'utilisateur', required: false }] },
        { name: 'serverinfo', description: 'Infos du serveur' },
        { name: 'clear', description: 'Supprimer des messages', options: [{ name: 'amount', type: 4, description: 'Nombre de messages (1-100)', required: true }] },
        { name: 'refresh', description: 'Recréer le salon' },
        { name: 'invite', description: 'Lien d\'invitation du bot' },
        { name: 'gw', description: 'Lancer un giveaway', options: [{ name: 'prize', type: 3, description: 'Le prix', required: true }, { name: 'duration', type: 4, description: 'Durée en minutes', required: true }] },
        { name: 'reroll', description: 'Rechoisir un gagnant', options: [{ name: 'message_id', type: 3, description: 'ID du message giveaway', required: true }] },
        { name: 'poll', description: 'Créer un sondage', options: [{ name: 'question', type: 3, description: 'La question', required: true }] },

        // Modération
        { name: 'ban', description: 'Bannir un membre', options: [{ name: 'user', type: 6, description: 'L\'utilisateur', required: true }, { name: 'reason', type: 3, description: 'Raison', required: false }] },
        { name: 'tempban', description: 'Bannissement temporaire', options: [{ name: 'user', type: 6, description: 'L\'utilisateur', required: true }, { name: 'duration', type: 4, description: 'Durée en minutes', required: true }, { name: 'reason', type: 3, description: 'Raison', required: false }] },
        { name: 'unban', description: 'Débannir un membre', options: [{ name: 'user_id', type: 3, description: 'ID de l\'utilisateur', required: true }] },
        { name: 'kick', description: 'Expulser un membre', options: [{ name: 'user', type: 6, description: 'L\'utilisateur', required: true }, { name: 'reason', type: 3, description: 'Raison', required: false }] },
        { name: 'mute', description: 'Mute temporairement un membre', options: [{ name: 'user', type: 6, description: 'L\'utilisateur', required: true }, { name: 'duration', type: 4, description: 'Durée en minutes', required: true }] },
        { name: 'unmute', description: 'Enlever le mute', options: [{ name: 'user', type: 6, description: 'L\'utilisateur', required: true }] },

        // Configuration
        { name: 'config', description: 'Panneau de configuration', options: [
            { name: 'action', type: 3, description: 'Action à configurer', required: true, choices: [
                { name: 'Roles Owner & Staff', value: 'roles' },
                { name: 'Logs', value: 'logs' },
                { name: 'Arrivées (bienvenue permanent)', value: 'arrivals' },
                { name: 'Greet (bienvenue temporaire)', value: 'greet' },
                { name: 'Tickets', value: 'tickets' },
                { name: 'Rôle Soutien', value: 'support_role' },
                { name: 'Media-only', value: 'media_only' },
                { name: 'Anti-Link', value: 'anti_link' }
            ]},
            { name: 'channel', type: 7, description: 'Salon (pour logs, tickets, etc.)', required: false }
        ] },
    ];

    await client.application.commands.set(commands);
    console.log('✅ Commandes slash enregistrées !');
});

// ============================================================
//  COMMANDES PRÉFIXÉES (+)
// ============================================================

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('+')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // --- Utilitaires ---

    if (command === 'say') {
        if (!message.member.permissions.has('ManageMessages')) {
            return message.reply('❌ Tu n\'as pas la permission.');
        }
        const text = args.join(' ');
        if (!text) return message.reply('📌 Utilisation : `+say <message>`');
        await message.delete();
        await message.channel.send(text);
    }

    if (command === 'ping') {
        await message.reply(`🏓 Pong ! Latence : ${client.ws.ping}ms`);
    }

    if (command === 'snipe') {
        const msg = client.snipeMap?.get(message.channel.id);
        if (!msg) return message.reply('❌ Aucun message supprimé récemment.');
        const embed = new EmbedBuilder()
            .setColor('#2C2F33')
            .setAuthor({ name: msg.author.tag, iconURL: msg.author.displayAvatarURL({ dynamic: true }) })
            .setDescription(msg.content)
            .setFooter({ text: `Supprimé à ${msg.createdAt.toLocaleTimeString()}` });
        await message.channel.send({ embeds: [embed] });
    }

    // --- Modération ---

    if (command === 'clear') {
        if (!message.member.permissions.has('ManageMessages')) {
            return message.reply('❌ Tu n\'as pas la permission.');
        }
        const amount = parseInt(args[0]);
        if (!amount || amount < 1 || amount > 100) {
            return message.reply('📌 Utilisation : `+clear 10` (1 à 100 messages)');
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

    if (command === 'tempban') {
        if (!message.member.permissions.has('BanMembers')) {
            return message.reply('❌ Tu n\'as pas la permission.');
        }
        const user = message.mentions.users.first();
        if (!user) return message.reply('❌ Mentionne un membre à bannir.');
        const duration = parseInt(args[1]);
        if (!duration || duration < 1) {
            return message.reply('📌 Utilisation : `+tempban @membre 10` (minutes)');
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
        if (!userId) return message.reply('📌 Utilisation : `+unban <user_id>`');
        await message.guild.members.unban(userId);
        await message.reply(`✅ Utilisateur ${userId} débanni.`);
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
            return message.reply('📌 Utilisation : `+mute @membre 10` (minutes)');
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

    if (command === 'media_only') {
        if (!message.member.permissions.has('ManageChannels')) {
            return message.reply('❌ Tu n\'as pas la permission.');
        }
        // Active/désactive le mode media-only (permet uniquement les médias)
        const current = client.mediaOnlyChannels?.has(message.channel.id) || false;
        if (current) {
            client.mediaOnlyChannels.delete(message.channel.id);
            await message.reply('❌ Mode media-only désactivé dans ce salon.');
        } else {
            if (!client.mediaOnlyChannels) client.mediaOnlyChannels = new Set();
            client.mediaOnlyChannels.add(message.channel.id);
            await message.reply('✅ Mode media-only activé dans ce salon. Seuls les médias sont autorisés.');
        }
    }
});

// ============================================================
//  SNIPE (cache des messages supprimés)
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

    // ---------- HELP ----------

    if (commandName === 'help') {
        const embed = new EmbedBuilder()
            .setColor('#6C2BD9')
            .setTitle('📋 Centre de commandes')
            .setDescription('Voici la liste de toutes les commandes disponibles.')
            .addFields(
                { name: '━━━━━━━━━━━━━━━━━━━', value: '▸ **Utilitaires**', inline: false },
                { name: '`/embed`', value: 'Créer un embed personnalisé', inline: true },
                { name: '`/help`', value: 'Afficher cette aide', inline: true },
                { name: '`/userinfo`', value: 'Infos d\'un utilisateur', inline: true },
                { name: '`/serverinfo`', value: 'Infos du serveur', inline: true },
                { name: '`/clear`', value: 'Supprimer des messages', inline: true },
                { name: '`/refresh`', value: 'Recréer le salon', inline: true },
                { name: '`/invite`', value: 'Lien d\'invitation du bot', inline: true },
                { name: '`/gw`', value: 'Lancer un giveaway', inline: true },
                { name: '`/reroll`', value: 'Rechoisir un gagnant', inline: true },
                { name: '`/poll`', value: 'Créer un sondage', inline: true },

                { name: '━━━━━━━━━━━━━━━━━━━', value: '▸ **Modération**', inline: false },
                { name: '`/ban`', value: 'Bannir un membre', inline: true },
                { name: '`/tempban`', value: 'Bannissement temporaire', inline: true },
                { name: '`/unban`', value: 'Débannir un membre', inline: true },
                { name: '`/kick`', value: 'Expulser un membre', inline: true },
                { name: '`/mute`', value: 'Mute temporaire', inline: true },
                { name: '`/unmute`', value: 'Enlever le mute', inline: true },

                { name: '━━━━━━━━━━━━━━━━━━━', value: '▸ **Configuration**', inline: false },
                { name: '`/config`', value: 'Panneau de configuration', inline: true },

                { name: '━━━━━━━━━━━━━━━━━━━', value: '▸ **Commandes préfixées (+)**', inline: false },
                { name: '`+say`', value: 'Envoyer un message', inline: true },
                { name: '`+ping`', value: 'Latence du bot', inline: true },
                { name: '`+clear`', value: 'Supprimer des messages', inline: true },
                { name: '`+lock`', value: 'Verrouiller le salon', inline: true },
                { name: '`+unlock`', value: 'Déverrouiller le salon', inline: true },
                { name: '`+snipe`', value: 'Récupérer le dernier message supprimé', inline: true },
                { name: '`+media_only`', value: 'Activer/désactiver le mode media-only', inline: true }
            )
            .setFooter({ text: 'Astralia 🐉 · Tape /help pour réafficher cette aide' })
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    }

    // ---------- EMBED ----------

    if (commandName === 'embed') {
        if (!interaction.member.permissions.has('ManageMessages')) {
            return interaction.reply({ content: '❌ Tu n\'as pas la permission.', ephemeral: true });
        }
        const embed = new EmbedBuilder()
            .setColor('#6C2BD9')
            .setTitle('📌 Exemple d\'embed')
            .setDescription('Personnalise ton embed avec un modal !');
        return interaction.reply({ embeds: [embed] });
    }

    // ---------- USERINFO ----------

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

    // ---------- SERVERINFO ----------

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

    // ---------- CLEAR ----------

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

    // ---------- REFRESH ----------

    if (commandName === 'refresh') {
        if (!interaction.member.permissions.has('ManageChannels')) {
            return interaction.reply({ content: '❌ Tu n\'as pas la permission.', ephemeral: true });
        }
        const channel = interaction.channel;
        const position = channel.position;
        const category = channel.parent;
        const topic = channel.topic;

        await channel.clone({
            name: channel.name,
            topic: topic,
            position: position,
            parent: category,
            permissionOverwrites: channel.permissionOverwrites.cache.map(overwrite => ({
                id: overwrite.id,
                allow: overwrite.allow,
                deny: overwrite.deny,
                type: overwrite.type
            }))
        });

        await channel.delete();
        return interaction.reply({ content: '✅ Salon recréé !', ephemeral: true });
    }

    // ---------- INVITE ----------

    if (commandName === 'invite') {
        return interaction.reply({
            content: `🔗 **Invite le bot :** [Clique ici](https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot+applications.commands)`,
            ephemeral: true
        });
    }

    // ---------- POLL ----------

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

    // ---------- GIVEAWAY ----------

    if (commandName === 'gw') {
        if (!interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ content: '❌ Seul un admin peut lancer un giveaway.', ephemeral: true });
        }
        const prize = options.getString('prize');
        const duration = options.getInteger('duration');

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🎉 GIVEAWAY !')
            .setDescription(`**Prix :** ${prize}\n**Durée :** ${duration} minutes\n\nRéagis avec 🎉 pour participer !`)
            .setFooter({ text: `Lancé par ${interaction.user.username}` })
            .setTimestamp(Date.now() + duration * 60000);

        const message = await interaction.reply({ embeds: [embed], fetchReply: true });
        await message.react('🎉');

        client.giveaways.set(message.id, {
            prize: prize,
            channelId: interaction.channel.id,
            messageId: message.id,
            endTime: Date.now() + duration * 60000
        });

        setTimeout(async () => {
            const msg = await interaction.channel.messages.fetch(message.id);
            const reaction = msg.reactions.cache.get('🎉');
            if (!reaction) return interaction.channel.send('❌ Aucun participant.');

            const users = await reaction.users.fetch();
            const participants = users.filter(u => !u.bot);
            if (participants.size === 0) return interaction.channel.send('❌ Aucun participant.');

            const winner = participants.random();
            await interaction.channel.send(`🎉 **Félicitations à ${winner} !** Tu as gagné : **${prize}** !`);
        }, duration * 60000);
    }

    // ---------- REROLL ----------

    if (commandName === 'reroll') {
        if (!interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ content: '❌ Seul un admin peut relancer un giveaway.', ephemeral: true });
        }
        const messageId = options.getString('message_id');
        try {
            const message = await interaction.channel.messages.fetch(messageId);
            const reaction = message.reactions.cache.get('🎉');
            if (!reaction) return interaction.reply('❌ Aucune réaction trouvée.');

            const users = await reaction.users.fetch();
            const participants = users.filter(u => !u.bot);
            if (participants.size === 0) return interaction.reply('❌ Aucun participant.');

            const winner = participants.random();
            await interaction.reply(`🎉 **Nouveau gagnant : ${winner} !**`);
        } catch (error) {
            return interaction.reply('❌ Message introuvable. Vérifie l\'ID.');
        }
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

    // ---------- CONFIG ----------

    if (commandName === 'config') {
        if (!interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ content: '❌ Seul un administrateur peut configurer.', ephemeral: true });
        }

        const action = options.getString('action');
        const channel = options.getChannel('channel');

        let description = '';

        switch (action) {
            case 'roles':
                description = '🔧 **Configuration des rôles Owner et Staff**\nUtilisez les commandes :\n`/setowner @membre`\n`/setstaff @membre`\n*(à implémenter)*';
                break;
            case 'logs':
                if (!channel) return interaction.reply({ content: '❌ Mentionne un salon pour les logs.', ephemeral: true });
                client.logsChannels.logs = channel.id;
                description = `✅ Logs configurés dans ${channel}`;
                break;
            case 'arrivals':
                description = '✉️ **Message de bienvenue permanent**\nConfigure le message de bienvenue dans les paramètres du serveur ou avec `!setwelcome`.';
                break;
            case 'greet':
                description = '👋 **Message de bienvenue temporaire**\nConfigure le message qui se supprime avec la commande `!setgreet`.';
                break;
            case 'tickets':
                if (!channel) return interaction.reply({ content: '❌ Mentionne un salon pour les tickets.', ephemeral: true });
                description = `🎫 **Système de tickets**\nSalon configuré : ${channel}\n*(à implémenter avec un bot de tickets)*`;
                break;
            case 'support_role':
                description = '🛡️ **Rôle Soutien**\nRôle attribué basé sur le statut Discord (en ligne, AFK, etc.)\n*(à implémenter)*';
                break;
            case 'media_only':
                description = '📎 **Mode Media-only**\nActive/désactive le mode media-only avec la commande `+media_only` dans un salon.';
                break;
            case 'anti_link':
                description = '🔗 **Anti-Link**\nBloque les liens dans les salons configurés.\n*(à implémenter)*';
                break;
            default:
                description = '⚠️ Action inconnue.';
        }

        const embed = new EmbedBuilder()
            .setColor('#6C2BD9')
            .setTitle('⚙️ Panneau de configuration')
            .setDescription(description)
            .setFooter({ text: 'Astralia Bot' });

        return interaction.reply({ embeds: [embed] });
    }
});

// ============================================================
//  MESSAGE DE BIENVENUE (optionnel)
// ============================================================

client.on('guildMemberAdd', async (member) => {
    const channel = member.guild.channels.cache.get('1536880794516201482'); // #bienvenue
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setColor('#6C2BD9')
        .setTitle('🌟 Bienvenue sur ASTRALIA 🐉 !')
        .setDescription(`Hey ${member.user}, bienvenue dans la communauté ! 🔥`)
        .addFields(
            { name: '📜 Règles', value: `Va lire le règlement dans <#1536852817585774635>`, inline: true },
            { name: '📍 NSFW', value: `Le contenu adulte est dans <#1536873680058192014>`, inline: true },
            { name: '💬 Chat', value: `Présente-toi dans <#1536870817797902387>`, inline: false }
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
//  COMMANDE !verif (pour le message de vérification NSFW)
// ============================================================

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (message.content === '!verif') {
        const embed = new EmbedBuilder()
            .setColor('#2c63b0')
            .setDescription(`# Espace NSFW | 18

▸ Des salons NSFW avec + de 10k de médias
▸ Être sur la backup si le serveur saute
▸ Un rôle exclusif @accès NSFW

## Pour avoir accès c'est simple
▸ Clique sur le bouton "VERIFIE TOI ICI"
▸ Accepte l'autorisation du bot

## C'est tout !`)
            .setImage('https://i.imgur.com/2r13ZX4.jpeg');

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('verify_nsfw')
                    .setLabel('🔞 VERIFIE TOI ICI')
                    .setStyle(ButtonStyle.Danger)
            );

        await message.channel.send({ embeds: [embed], components: [row] });
        await message.delete();
    }
});

// ============================================================
//  GESTION DU BOUTON "VERIFIE TOI ICI"
// ============================================================

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'verify_nsfw') {
        const member = interaction.member;
        const role = interaction.guild.roles.cache.find(r => r.name === 'accès NSFW');

        if (!role) {
            await interaction.reply({
                content: '❌ Le rôle "accès NSFW" n\'existe pas. Contacte un administrateur.',
                ephemeral: true
            });
            return;
        }

        if (member.roles.cache.has(role.id)) {
            await interaction.reply({
                content: '❌ Tu as déjà le rôle NSFW !',
                ephemeral: true
            });
            return;
        }

        await member.roles.add(role);
        await interaction.reply({
            content: '✅ **Tu as maintenant accès aux salons NSFW !** 🔞',
            ephemeral: true
        });
    }
});

// ============================================================
//  SERVEUR HTTP POUR RENDER (Keep Alive)
// ============================================================

const http = require('http');
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Serveur HTTP en écoute sur le port ${PORT}`);
});

// ============================================================
//  CONNEXION DU BOT
// ============================================================

client.login(process.env.TOKEN);