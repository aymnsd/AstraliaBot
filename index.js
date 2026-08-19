const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const axios = require('axios');
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
client.welcomeChannel = null;
client.mediaOnlyChannels = new Set();
client.antiLinkEnabled = false;
client.warns = new Map();

// ============================================================
//  QUAND LE BOT EST PRÊT
// ============================================================

client.once('ready', async () => {
    console.log(`✅ ${client.user.tag} est en ligne !`);

    const commands = [
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
        { name: 'ban', description: 'Bannir un membre', options: [{ name: 'user', type: 6, description: 'L\'utilisateur', required: true }, { name: 'reason', type: 3, description: 'Raison', required: false }] },
        { name: 'tempban', description: 'Bannissement temporaire', options: [{ name: 'user', type: 6, description: 'L\'utilisateur', required: true }, { name: 'duration', type: 4, description: 'Durée en minutes', required: true }, { name: 'reason', type: 3, description: 'Raison', required: false }] },
        { name: 'unban', description: 'Débannir un membre', options: [{ name: 'user_id', type: 3, description: 'ID de l\'utilisateur', required: true }] },
        { name: 'kick', description: 'Expulser un membre', options: [{ name: 'user', type: 6, description: 'L\'utilisateur', required: true }, { name: 'reason', type: 3, description: 'Raison', required: false }] },
        { name: 'mute', description: 'Mute temporairement un membre', options: [{ name: 'user', type: 6, description: 'L\'utilisateur', required: true }, { name: 'duration', type: 4, description: 'Durée en minutes', required: true }] },
        { name: 'unmute', description: 'Enlever le mute', options: [{ name: 'user', type: 6, description: 'L\'utilisateur', required: true }] },
        { name: 'config', description: 'Panneau de configuration', options: [
            { name: 'action', type: 3, description: 'Action à configurer', required: true, choices: [
                { name: 'Logs', value: 'logs' },
                { name: 'Bienvenue', value: 'welcome' },
                { name: 'Anti-Link', value: 'antilink' },
                { name: 'Media-only', value: 'media_only' }
            ]},
            { name: 'channel', type: 7, description: 'Salon (pour logs, bienvenue, etc.)', required: false }
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

    if (command === 'say') {
        if (!message.member.permissions.has('ManageMessages')) return message.reply('❌ Permission manquante.');
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

    if (command === 'clear') {
        if (!message.member.permissions.has('ManageMessages')) return message.reply('❌ Permission manquante.');
        const amount = parseInt(args[0]);
        if (!amount || amount < 1 || amount > 100) return message.reply('📌 Utilisation : `+clear 10` (1 à 100 messages)');
        await message.channel.bulkDelete(amount, true);
        const msg = await message.channel.send(`✅ ${amount} messages supprimés.`);
        setTimeout(() => msg.delete(), 3000);
    }

    if (command === 'lock') {
        if (!message.member.permissions.has('ManageChannels')) return message.reply('❌ Permission manquante.');
        await message.channel.permissionOverwrites.edit(message.guild.id, { SendMessages: false });
        await message.reply('🔒 Salon verrouillé.');
    }

    if (command === 'unlock') {
        if (!message.member.permissions.has('ManageChannels')) return message.reply('❌ Permission manquante.');
        await message.channel.permissionOverwrites.edit(message.guild.id, { SendMessages: true });
        await message.reply('🔓 Salon déverrouillé.');
    }

    if (command === 'ban') {
        if (!message.member.permissions.has('BanMembers')) return message.reply('❌ Permission manquante.');
        const user = message.mentions.users.first();
        if (!user) return message.reply('❌ Mentionne un membre.');
        const reason = args.slice(1).join(' ') || 'Aucune raison';
        await message.guild.members.ban(user.id, { reason });
        await message.reply(`✅ ${user.tag} banni. Raison : ${reason}`);
    }

    if (command === 'kick') {
        if (!message.member.permissions.has('KickMembers')) return message.reply('❌ Permission manquante.');
        const user = message.mentions.users.first();
        if (!user) return message.reply('❌ Mentionne un membre.');
        const reason = args.slice(1).join(' ') || 'Aucune raison';
        const member = message.guild.members.cache.get(user.id);
        await member.kick(reason);
        await message.reply(`✅ ${user.tag} expulsé. Raison : ${reason}`);
    }

    if (command === 'mute') {
        if (!message.member.permissions.has('ModerateMembers')) return message.reply('❌ Permission manquante.');
        const user = message.mentions.users.first();
        if (!user) return message.reply('❌ Mentionne un membre.');
        const duration = parseInt(args[1]);
        if (!duration || duration < 1) return message.reply('📌 Utilisation : `+mute @membre 10` (minutes)');
        const member = message.guild.members.cache.get(user.id);
        await member.timeout(duration * 60000, 'Mute temporaire');
        await message.reply(`🔇 ${user.tag} mute pour ${duration} minutes.`);
    }

    if (command === 'unmute') {
        if (!message.member.permissions.has('ModerateMembers')) return message.reply('❌ Permission manquante.');
        const user = message.mentions.users.first();
        if (!user) return message.reply('❌ Mentionne un membre.');
        const member = message.guild.members.cache.get(user.id);
        await member.timeout(null);
        await message.reply(`✅ ${user.tag} unmute.`);
    }

    if (command === 'media_only') {
        if (!message.member.permissions.has('ManageChannels')) return message.reply('❌ Permission manquante.');
        if (client.mediaOnlyChannels.has(message.channel.id)) {
            client.mediaOnlyChannels.delete(message.channel.id);
            await message.reply('❌ Media-only désactivé.');
        } else {
            client.mediaOnlyChannels.add(message.channel.id);
            await message.reply('✅ Media-only activé.');
        }
    }

    if (command === 'antilink') {
        if (!message.member.permissions.has('Administrator')) return message.reply('❌ Seul un admin peut configurer.');
        const action = args[0];
        if (action === 'on') {
            client.antiLinkEnabled = true;
            await message.reply('✅ Anti-link activé.');
        } else if (action === 'off') {
            client.antiLinkEnabled = false;
            await message.reply('❌ Anti-link désactivé.');
        } else {
            await message.reply('📌 Utilisation : `+antilink on/off`');
        }
    }

    if (command === 'setlogs') {
        if (!message.member.permissions.has('Administrator')) return message.reply('❌ Seul un admin peut configurer.');
        const channel = message.mentions.channels.first();
        if (!channel) return message.reply('❌ Mentionne un salon.');
        client.logsChannels.logs = channel.id;
        await message.reply(`✅ Salon de logs défini : ${channel}`);
    }

    if (command === 'setwelcome') {
        if (!message.member.permissions.has('Administrator')) return message.reply('❌ Seul un admin peut configurer.');
        const channel = message.mentions.channels.first();
        if (!channel) return message.reply('❌ Mentionne un salon.');
        client.welcomeChannel = channel.id;
        await message.reply(`✅ Salon de bienvenue défini : ${channel}`);
    }

    if (command === 'ticket') {
        if (!message.member.permissions.has('Administrator')) return message.reply('❌ Seul un admin peut ouvrir un ticket.');
        const embed = new EmbedBuilder()
            .setColor('#6C2BD9')
            .setTitle('🎫 Ouvrir un ticket')
            .setDescription('Clique sur le bouton ci-dessous pour ouvrir un ticket.');
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('open_ticket')
                    .setLabel('🎫 Ouvrir un ticket')
                    .setStyle(ButtonStyle.Primary)
            );
        await message.channel.send({ embeds: [embed], components: [row] });
        await message.delete();
    }

    if (command === 'close') {
        if (!message.channel.name.startsWith('ticket-')) return message.reply('❌ Ce n\'est pas un ticket.');
        if (!message.member.permissions.has('Administrator')) return message.reply('❌ Seul un admin peut fermer.');
        await message.reply('🔒 Fermeture dans 5 secondes...');
        setTimeout(async () => {
            await message.channel.delete();
        }, 5000);
    }

    if (command === 'warn') {
        if (!message.member.permissions.has('ModerateMembers')) return message.reply('❌ Permission manquante.');
        const user = message.mentions.users.first();
        if (!user) return message.reply('❌ Mentionne un membre.');
        const reason = args.slice(1).join(' ') || 'Aucune raison';
        if (!client.warns.has(user.id)) client.warns.set(user.id, []);
        client.warns.get(user.id).push({ reason, moderator: message.author.tag, date: new Date().toLocaleDateString() });
        await message.reply(`✅ ${user.tag} a été averti. Raison : ${reason}`);
        try {
            await user.send(`⚠️ Tu as reçu un avertissement sur ${message.guild.name}.\nRaison : ${reason}`);
        } catch (error) {}
    }

    if (command === 'warns') {
        if (!message.member.permissions.has('ModerateMembers')) return message.reply('❌ Permission manquante.');
        const user = message.mentions.users.first();
        if (!user) return message.reply('❌ Mentionne un membre.');
        const warns = client.warns.get(user.id) || [];
        if (warns.length === 0) return message.reply(`✅ ${user.tag} n'a aucun avertissement.`);
        const embed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle(`⚠️ Avertissements de ${user.username}`)
            .setDescription(warns.map((w, i) => `**${i+1}.** ${w.reason} (par ${w.moderator}, le ${w.date})`).join('\n'))
            .setFooter({ text: `Total : ${warns.length} avertissements` });
        await message.reply({ embeds: [embed] });
    }

    if (command === 'clearwarns') {
        if (!message.member.permissions.has('ModerateMembers')) return message.reply('❌ Permission manquante.');
        const user = message.mentions.users.first();
        if (!user) return message.reply('❌ Mentionne un membre.');
        client.warns.delete(user.id);
        await message.reply(`✅ Avertissements de ${user.tag} supprimés.`);
    }

    if (command === 'ia') {
        const question = args.join(' ');
        if (!question) return message.reply('📌 Pose une question après `!ia`.');
        try {
            const response = await axios.post(
                'https://api-inference.huggingface.co/models/mistralai/Mixtral-8x7B-Instruct-v0.1',
                { inputs: question },
                { headers: { 'Authorization': `Bearer ${process.env.HF_TOKEN || 'fake'}` } }
            );
            const answer = response.data[0]?.generated_text || 'Je n\'ai pas compris.';
            await message.reply(`🤖 ${answer.slice(0, 2000)}`);
        } catch (error) {
            await message.reply('❌ L\'IA est indisponible pour le moment.');
        }
    }
});

// ============================================================
//  LOGS
// ============================================================

client.on('messageDelete', async (message) => {
    if (message.author?.bot) return;
    const logChannelId = client.logsChannels?.logs;
    if (!logChannelId) return;
    const logChannel = message.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;
    const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🗑️ Message supprimé')
        .addFields(
            { name: 'Auteur', value: message.author?.tag || 'Inconnu', inline: true },
            { name: 'Salon', value: message.channel.name, inline: true },
            { name: 'Contenu', value: message.content || 'Aucun contenu', inline: false }
        )
        .setTimestamp();
    await logChannel.send({ embeds: [embed] });
});

client.on('messageUpdate', async (oldMessage, newMessage) => {
    if (oldMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;
    const logChannelId = client.logsChannels?.logs;
    if (!logChannelId) return;
    const logChannel = oldMessage.guild.channels.cache.get(logChannelId);
    if (!logChannel) return;
    const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('✏️ Message modifié')
        .addFields(
            { name: 'Auteur', value: oldMessage.author?.tag || 'Inconnu', inline: true },
            { name: 'Salon', value: oldMessage.channel.name, inline: true },
            { name: 'Ancien message', value: oldMessage.content || 'Aucun contenu', inline: false },
            { name: 'Nouveau message', value: newMessage.content || 'Aucun contenu', inline: false }
        )
        .setTimestamp();
    await logChannel.send({ embeds: [embed] });
});

// ============================================================
//  ANTI-LINK
// ============================================================

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!client.antiLinkEnabled) return;
    const linkRegex = /(https?:\/\/[^\s]+|discord\.gg\/[^\s]+|discord\.com\/invite\/[^\s]+)/i;
    if (linkRegex.test(message.content)) {
        if (!message.member.permissions.has('ManageMessages')) {
            await message.delete();
            const warnMsg = await message.channel.send(`❌ ${message.author}, les liens sont interdits.`);
            setTimeout(() => warnMsg.delete(), 5000);
        }
    }
});

// ============================================================
//  SNIPE
// ============================================================

client.on('messageDelete', (message) => {
    if (message.author?.bot) return;
    client.snipeMap.set(message.channel.id, {
        content: message.content,
        author: message.author,
        createdAt: message.createdAt
    });
});

// ============================================================
//  TICKETS
// ============================================================

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    if (interaction.customId !== 'open_ticket') return;
    const category = interaction.guild.channels.cache.find(c => c.name === 'Tickets' && c.type === 4);
    if (!category) {
        return interaction.reply({ content: '❌ Crée une catégorie "Tickets" d\'abord.', ephemeral: true });
    }
    const channel = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: 0,
        parent: category.id,
        permissionOverwrites: [
            { id: interaction.guild.id, deny: ['ViewChannel'] },
            { id: interaction.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
            { id: interaction.guild.members.me.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageChannels'] }
        ]
    });
    const embed = new EmbedBuilder()
        .setColor('#6C2BD9')
        .setTitle('🎫 Ticket ouvert')
        .setDescription(`Bienvenue ${interaction.user}, un staff va bientôt vous aider.`)
        .setFooter({ text: 'Pour fermer, utilisez +close' });
    await channel.send({ embeds: [embed] });
    await interaction.reply({ content: `✅ Ticket ouvert : ${channel}`, ephemeral: true });
});

// ============================================================
//  GESTION DES COMMANDES SLASH
// ============================================================

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName, options } = interaction;

    if (commandName === 'help') {
        const embed = new EmbedBuilder()
            .setColor('#6C2BD9')
            .setTitle('📋 Centre de commandes')
            .setDescription('Voici la liste de toutes les commandes disponibles.')
            .addFields(
                { name: '📦 Utilitaires', value: '`/help`, `/embed`, `/userinfo`, `/serverinfo`, `/clear`, `/refresh`, `/invite`, `/gw`, `/reroll`, `/poll`', inline: false },
                { name: '🛡️ Modération', value: '`/ban`, `/tempban`, `/unban`, `/kick`, `/mute`, `/unmute`', inline: false },
                { name: '⚙️ Configuration', value: '`/config`', inline: false },
                { name: '⌨️ Préfixées (+)', value: '`+say`, `+ping`, `+clear`, `+lock`, `+unlock`, `+snipe`, `+media_only`, `+ban`, `+kick`, `+mute`, `+unmute`, `+warn`, `+warns`, `+clearwarns`, `+ticket`, `+close`, `+antilink`, `+setlogs`, `+setwelcome`, `+ia`', inline: false }
            )
            .setFooter({ text: 'Astralia 🐉 · Tape /help' })
            .setTimestamp();
        return interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'embed') {
        if (!interaction.member.permissions.has('ManageMessages')) {
            return interaction.reply({ content: '❌ Permission manquante.', ephemeral: true });
        }
        const embed = new EmbedBuilder()
            .setColor('#6C2BD9')
            .setTitle('📌 Exemple d\'embed')
            .setDescription('Personnalise ton embed avec un modal !');
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
            return interaction.reply({ content: '❌ Permission manquante.', ephemeral: true });
        }
        const amount = options.getInteger('amount');
        if (amount < 1 || amount > 100) {
            return interaction.reply({ content: '❌ Choisis un nombre entre 1 et 100.', ephemeral: true });
        }
        await interaction.channel.bulkDelete(amount, true);
        return interaction.reply({ content: `✅ ${amount} messages supprimés.`, ephemeral: true });
    }

    if (commandName === 'refresh') {
        if (!interaction.member.permissions.has('ManageChannels')) {
            return interaction.reply({ content: '❌ Permission manquante.', ephemeral: true });
        }
        const channel = interaction.channel;
        const position = channel.position;
        const category = channel.parent;
        const topic = channel.topic;
        const newChannel = await channel.clone({
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
        return interaction.reply({ content: `✅ Salon recréé : ${newChannel}`, ephemeral: true });
    }

    if (commandName === 'invite') {
        return interaction.reply({
            content: `🔗 **Invite le bot :** [Clique ici](https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot+applications.commands)`,
            ephemeral: true
        });
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
        client.giveaways.set(message.id, { prize, channelId: interaction.channel.id, messageId: message.id, endTime: Date.now() + duration * 60000 });
        setTimeout(async () => {
            try {
                const msg = await interaction.channel.messages.fetch(message.id);
                const reaction = msg.reactions.cache.get('🎉');
                if (!reaction) return interaction.channel.send('❌ Aucun participant.');
                const users = await reaction.users.fetch();
                const participants = users.filter(u => !u.bot);
                if (participants.size === 0) return interaction.channel.send('❌ Aucun participant.');
                const winner = participants.random();
                await interaction.channel.send(`🎉 **Félicitations à ${winner} !** Tu as gagné : **${prize}** !`);
            } catch (error) {}
        }, duration * 60000);
    }

    if (commandName === 'reroll') {
        if (!interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ content: '❌ Seul un admin peut relancer.', ephemeral: true });
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

    // MODÉRATION SLASH
    if (commandName === 'ban') {
        if (!interaction.member.permissions.has('BanMembers')) return interaction.reply({ content: '❌ Permission manquante.', ephemeral: true });
        const user = options.getUser('user');
        const reason = options.getString('reason') || 'Aucune raison';
        const member = interaction.guild.members.cache.get(user.id);
        if (member && !member.bannable) return interaction.reply({ content: '❌ Je ne peux pas bannir ce membre.', ephemeral: true });
        await interaction.guild.members.ban(user.id, { reason });
        return interaction.reply({ content: `✅ ${user.tag} banni. Raison : ${reason}` });
    }

    if (commandName === 'tempban') {
        if (!interaction.member.permissions.has('BanMembers')) return interaction.reply({ content: '❌ Permission manquante.', ephemeral: true });
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
        if (!interaction.member.permissions.has('BanMembers')) return interaction.reply({ content: '❌ Permission manquante.', ephemeral: true });
        const userId = options.getString('user_id');
        await interaction.guild.members.unban(userId);
        return interaction.reply({ content: `✅ Utilisateur ${userId} débanni.` });
    }

    if (commandName === 'kick') {
        if (!interaction.member.permissions.has('KickMembers')) return interaction.reply({ content: '❌ Permission manquante.', ephemeral: true });
        const user = options.getUser('user');
        const reason = options.getString('reason') || 'Aucune raison';
        const member = interaction.guild.members.cache.get(user.id);
        if (!member.kickable) return interaction.reply({ content: '❌ Je ne peux pas expulser ce membre.', ephemeral: true });
        await member.kick(reason);
        return interaction.reply({ content: `✅ ${user.tag} expulsé. Raison : ${reason}` });
    }

    if (commandName === 'mute') {
        if (!interaction.member.permissions.has('ModerateMembers')) return interaction.reply({ content: '❌ Permission manquante.', ephemeral: true });
        const user = options.getUser('user');
        const duration = options.getInteger('duration');
        const member = interaction.guild.members.cache.get(user.id);
        if (!member.moderatable) return interaction.reply({ content: '❌ Je ne peux pas mute ce membre.', ephemeral: true });
        await member.timeout(duration * 60000, 'Mute temporaire');
        return interaction.reply({ content: `🔇 ${user.tag} mute pour ${duration} minutes.` });
    }

    if (commandName === 'unmute') {
        if (!interaction.member.permissions.has('ModerateMembers')) return interaction.reply({ content: '❌ Permission manquante.', ephemeral: true });
        const user = options.getUser('user');
        const member = interaction.guild.members.cache.get(user.id);
        await member.timeout(null);
        return interaction.reply({ content: `✅ ${user.tag} unmute.` });
    }

    if (commandName === 'config') {
        if (!interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ content: '❌ Seul un administrateur peut configurer.', ephemeral: true });
        }
        const action = options.getString('action');
        const channel = options.getChannel('channel');
        let description = '';
        switch (action) {
            case 'logs':
                if (!channel) return interaction.reply({ content: '❌ Mentionne un salon.', ephemeral: true });
                client.logsChannels.logs = channel.id;
                description = `✅ Logs configurés dans ${channel}`;
                break;
            case 'welcome':
                if (!channel) return interaction.reply({ content: '❌ Mentionne un salon.', ephemeral: true });
                client.welcomeChannel = channel.id;
                description = `✅ Salon de bienvenue défini : ${channel}`;
                break;
            case 'antilink':
                client.antiLinkEnabled = !client.antiLinkEnabled;
                description = client.antiLinkEnabled ? '✅ Anti-link activé.' : '❌ Anti-link désactivé.';
                break;
            case 'media_only':
                if (!channel) return interaction.reply({ content: '❌ Mentionne un salon.', ephemeral: true });
                if (client.mediaOnlyChannels.has(channel.id)) {
                    client.mediaOnlyChannels.delete(channel.id);
                    description = `❌ Media-only désactivé dans ${channel}`;
                } else {
                    client.mediaOnlyChannels.add(channel.id);
                    description = `✅ Media-only activé dans ${channel}`;
                }
                break;
            default:
                description = '⚠️ Action inconnue.';
        }
        const embed = new EmbedBuilder().setColor('#6C2BD9').setTitle('⚙️ Configuration').setDescription(description).setFooter({ text: 'Astralia Bot' });
        return interaction.reply({ embeds: [embed] });
    }
});

// ============================================================
//  BIENVENUE
// ============================================================

client.on('guildMemberAdd', async (member) => {
    const channelId = client.welcomeChannel || '1536880794516201482';
    const channel = member.guild.channels.cache.get(channelId);
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
    if (role) await member.roles.add(role).catch(console.error);
});

// ============================================================
//  VÉRIFICATION NSFW (!verif)
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
//  BOUTON VERIFICATION NSFW
// ============================================================

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    if (interaction.customId === 'verify_nsfw') {
        const member = interaction.member;
        const role = interaction.guild.roles.cache.find(r => r.name === 'accès NSFW');
        if (!role) {
            await interaction.reply({ content: '❌ Rôle "accès NSFW" introuvable.', ephemeral: true });
            return;
        }
        if (member.roles.cache.has(role.id)) {
            await interaction.reply({ content: '❌ Tu as déjà le rôle.', ephemeral: true });
            return;
        }
        await member.roles.add(role);
        await interaction.reply({ content: '✅ **Tu as maintenant accès aux salons NSFW !** 🔞', ephemeral: true });
    }
});

// ============================================================
//  SERVEUR HTTP POUR RENDER
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