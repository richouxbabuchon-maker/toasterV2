require('dotenv').config();

console.log("🚀 Bot démarré");

const {
    Client,
    GatewayIntentBits,
    ChannelType,
    PermissionsBitField,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    EmbedBuilder,
    SlashCommandBuilder,
    ButtonBuilder,
    ButtonStyle,
    REST,
    Routes
} = require('discord.js');

const discordTranscripts = require('discord-html-transcripts');
const config = require('./config');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// ================= READY =================

client.once('ready', async () => {
    console.log(`🟢 Connecté: ${client.user.tag}`);

    const commands = [
        new SlashCommandBuilder()
            .setName('panel')
            .setDescription('Ouvre le centre de support')
    ].map(c => c.toJSON());

    const rest = new REST({ version: '10' }).setToken(config.token);

    await rest.put(
        Routes.applicationGuildCommands(client.user.id, config.guildId),
        { body: [] }
    );

    await rest.put(
        Routes.applicationGuildCommands(client.user.id, config.guildId),
        { body: commands }
    );

    console.log("✅ Slash commands OK");
});

// ================= INTERACTIONS =================

client.on('interactionCreate', async interaction => {

    console.log("🔥", interaction.type, interaction.customId || interaction.commandName);

    try {

        // ================= PANEL (NASA EMBED) =================
        if (interaction.isChatInputCommand() && interaction.commandName === 'panel') {

            const embed = new EmbedBuilder()
                .setTitle("🚀 NASA Support Center")
                .setDescription(
                    "👨‍🚀 Bienvenue à la NASA Support System\n\n" +
                    "🛰️ Quelle est votre demande aujourd’hui ?\n" +
                    "Veuillez sélectionner une catégorie ci-dessous pour ouvrir un ticket."
                )
                .setColor(0x0B3D91)
                .setThumbnail("https://upload.wikimedia.org/wikipedia/commons/e/e5/NASA_logo.svg")
                .setImage("https://www.nasa.gov/wp-content/uploads/2023/03/nasa-logo-web-rgb.png")
                .addFields(
                    { name: "📡 Statut", value: "Tous systèmes opérationnels", inline: true },
                    { name: "⏱ Réponse", value: "Dans les meilleurs délais", inline: true },
                    { name: "🎫 Support", value: "Disponible 24/7", inline: true }
                )
                .setFooter({
                    text: "NASA Support System • Automated Ticket Center",
                    iconURL: "https://upload.wikimedia.org/wikipedia/commons/e/e5/NASA_logo.svg"
                })
                .setTimestamp();

            const menu = new StringSelectMenuBuilder()
                .setCustomId('ticket_select')
                .setPlaceholder('🛰️ Sélectionner une mission')
                .addOptions([
                    { label: 'Recrutement', value: 'recrutement', emoji: '📋' },
                    { label: 'Contacter la Direction', value: 'contacter_la_direction', emoji: '⚠️' },
                    { label: 'Partenariats', value: 'partenariats', emoji: '❓' }
                ]);

            return interaction.reply({
                embeds: [embed],
                components: [new ActionRowBuilder().addComponents(menu)]
            });
        }

        // ================= CREATE TICKET =================
        if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {

            const type = interaction.values[0];

            const category = config.categories[type];
            const staffRole = interaction.guild.roles.cache.get(config.staffRole);

            if (!category || !staffRole) {
                return interaction.reply({
                    content: "❌ Configuration invalide",
                    flags: 64
                });
                await interaction.message.edit({
                    components: interaction.message.components
                });
            }

            const member = interaction.member;

            const hasBypass = config.bypassRoles?.some(role =>
                member.roles.cache.has(role)
            );

            // 🔥 ANTI DOUBLE TICKET PAR CATEGORIE
            if (!hasBypass) {
                const existing = interaction.guild.channels.cache.find(c =>
                    c.topic === `ticket-${interaction.user.id}-${type}`
                );

                if (existing) {
                    return interaction.reply({
                        content: `❌ Tu as déjà une mission **${type}** : ${existing}`,
                        flags: 64
                    });
                }
            }

            const ticketMember = await interaction.guild.members.fetch(interaction.user.id);

            const displayName = member.displayName || member.user.username;

            const emoji = config.ticketEmojis?.[type] || "📋, ⚠️, 🤝";

            const channel = await interaction.guild.channels.create({
                name: `${emoji}·${displayName}`,

                type: ChannelType.GuildText,
                parent: category,
                topic: `ticket-${interaction.user.id}-${type}`,
                permissionOverwrites: [
                    {
                        id: interaction.guild.id,
                        deny: [PermissionsBitField.Flags.ViewChannel]
                    },
                    {
                        id: interaction.user.id,
                        allow: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.SendMessages,
                            PermissionsBitField.Flags.ReadMessageHistory
                        ]
                    },
                    {
                        id: staffRole.id,
                        allow: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.SendMessages,
                            PermissionsBitField.Flags.ReadMessageHistory
                        ]
                    }
                ]
            });

            const embed = new EmbedBuilder()
                .setTitle("🛰️ Mission ouverte")
                .setDescription(
                    `Bienvenue ${interaction.user}\n\n` +
                    `📂 Catégorie : **${type}**\n` +
                    `👨‍🚀 Un agent vous répondra bientôt.`
                )
                .setColor(0x57F287)
                .setTimestamp();

            let row;

            // ✅  Ticket recrutement
            if (type === "recrutement") {

                row = new ActionRowBuilder().addComponents(

                    new ButtonBuilder()
                        .setCustomId('validate_ticket')
                        .setLabel('Valider entretien')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('✅'),

                    new ButtonBuilder()
                        .setCustomId('refuse_ticket')
                        .setLabel('Refuser entretien')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('❌'), 
                    new ButtonBuilder()
                        .setCustomId('close_ticket')
                        .setLabel('Fermer la mission')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒')      
                );

            } else {

                // ✅ Autres tickets
                row = new ActionRowBuilder().addComponents(

                    new ButtonBuilder()
                        .setCustomId('close_ticket')
                        .setLabel('Fermer la mission')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒')
                );
            }

            await channel.send({
                embeds: [embed],
                components: [row]
            });

            return interaction.reply({
                content: `✅ Mission ouverte : ${channel}`,
                flags: 64
            }).then(() => {

                if (interaction.message?.editable) {
                    interaction.message.edit({
                        components: interaction.message.components
                    }).catch(() => {});
                }
            });
        }

        // ================= BUTTONS =================
        if (interaction.isButton()) {

            const id = interaction.customId;

            // ================= CLOSE =================
            if (id === 'close_ticket') {

                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle("🔒 Fermeture de mission")
                            .setDescription("Confirmer la fermeture de cette mission ?")
                            .setColor(0xED4245)
                    ],
                    components: [
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId('confirm_close')
                                .setLabel('Confirmer')
                                .setStyle(ButtonStyle.Danger),

                            new ButtonBuilder()
                                .setCustomId('cancel_close')
                                .setLabel('Annuler')
                                .setStyle(ButtonStyle.Secondary)
                        )
                    ],
                    flags: 64
                });
            }

            // ================= CONFIRM CLOSE =================
            if (id === 'confirm_close') {

                await interaction.deferReply({ flags: 64 });

                try {
                    const transcript = await discordTranscripts.createTranscript(interaction.channel);

                    const logs = interaction.guild.channels.cache.get(config.logsChannel);

                    if (logs) {
                        logs.send({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle("📡 Mission fermée")
                                    .setDescription(`Par ${interaction.user.tag}`)
                                    .setColor(0xED4245)
                            ],
                            files: [transcript]
                        });
                    }

                    await interaction.editReply("🔒 Fermeture de la mission...");

                    setTimeout(() => {
                        interaction.channel.delete().catch(() => {});
                    }, 1500);

                } catch (err) {
                    console.error(err);
                    return interaction.editReply("❌ Erreur lors de la fermeture");
                }
            }

            // =============== CANCEL ===============
            if (id === 'cancel_close') {

                return interaction.update({
                    embeds: [
                        new EmbedBuilder()
                            .setDescription("❌ Fermeture annulée")
                            .setColor(0x2ECC71)
                    ],
                    components: []
                });
            }    

            // ================== VALIDATE ===============
            if (id === 'validate_ticket') {

                if (!interaction.channel.topic.includes('recrutement')) {
                    return interaction.reply({
                        content: '❌ Réservé aux tickets recrutement',
                        flags: 64

                    
                    });
                    console.log(config.validatedCategory);
                    console.log("TOPIC:", interaction.channel.topic);
                }

                try {

                    console.log("CAT:", config.validatedCategory);
                    console.log("CHANNEL:", interaction.channel.name);

                    // 🔥 Déplacer salon
                    await interaction.channel.setParent(config.validatedCategory);

                    console.log("✅ Ticket déplacé");

                    // 🔥 RESET PERMISSIONS DU SALON
                    await interaction.channel.permissionOverwrites.set([
                        {
                            id: interaction.guild.id,
                            deny: [PermissionsBitField.Flags.ViewChannel]
                        },
                        {
                            id: interaction.channel.topic.split('-')[1], // créateur
                            allow: [
                                PermissionsBitField.Flags.ViewChannel,
                                PermissionsBitField.Flags.SendMessages,
                                PermissionsBitField.Flags.ReadMessageHistory
                            ]
                        },
                        {
                            id: config.staffRole,
                            allow: [
                                PermissionsBitField.Flags.ViewChannel,
                                PermissionsBitField.Flags.SendMessages,
                                PermissionsBitField.Flags.ReadMessageHistory
                            ]
                        }
                    ]);

                    // 🔥 Renommer salon
                    const topic = interaction.channel.topic;

                    if (!topic) return;

                    const [, ownerId, type] = interaction.channel.topic.split('-');

                    const ownerMember = await interaction.guild.members.fetch(ownerId).catch(() => null);

                    // 🔥 Donner rôle
                    const ticketOwnerId = interaction.channel.topic.split('-')[1];


                    if (member && config.acceptedRole) {
                        await member.roles.add(config.acceptedRole).catch(() => {});
                    }

                    // 🔥 Logs
                    const logs = interaction.guild.channels.cache.get(config.logsChannel);

                    if (logs) {
                        logs.send({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle('✅ Entretien validé')
                                    .setDescription(`${interaction.user.tag} a validé un candidat`)
                                    .setColor(0x57F287)
                            ]
                        });
                    }

                    return interaction.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle('✅ Entretien validé')
                                .setDescription('Le candidat a été accepté.')
                                .setColor(0x57F287)
                        ]
                    });
                } catch (err) {
                    console.error("❌ ERREUR MOVE:", err);

                    return interaction.reply({
                        content: '❌ Erreur validation',
                        flags: 64
                    });

                    console.log("CONFIG DEBUG:", config.validatedCategory);
                }
            }  

            console.log("DISPLAY NAME:", member.displayName);
            console.log("USERNAME:", member.user.username);
            
            // ================= REFUSE =================
            if (id === 'refuse_ticket') {

                if (!interaction.channel.name.includes('recrutement')) {
                    return interaction.reply({
                        content: '❌ Réservé aux tickets recrutement',
                        flags: 64
                    });
                }

                try {

                    // 🔥 Logs
                    const logs = interaction.guild.channels.cache.get(config.logsChannel);

                    if (logs) {
                        logs.send({
                            embeds: [
                                new EmbedBuilder()
                                .setTitle('❌ Entretien refusé')
                                .setDescription(`${interaction.user.tag} a refusé un candidat`)
                                .setColor(0xED4245)
                            ]
                            
                        });
                    }

                    return interaction.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle('❌ Entretien refusé')
                                .setDescription('Le candidat a été refusé.')
                                .setColor(0xED4245)
                        ]
                    });
                } catch (err) {
                    console.error(err);

                    return interaction.reply({
                        content: '❌ Erreur refus',
                        flags: 64
                    });
                }
            }
        }            

    } catch (err) {
        console.error("❌ ERROR:", err);

        if (interaction.isRepliable()) {
            return interaction.reply({
                content: "❌ Erreur système",
                flags: 64
            }).catch(() => {});
        }
    }
});

// ================= LOGIN =================

client.login(process.env.TOKEN);