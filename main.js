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
    Routes,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');

const discordTranscripts = require('discord-html-transcripts');
const config = require('./config');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
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
        { body: commands }
    );

    console.log("✅ Slash commands OK");
});

// ================= MEMBER JOIN =================

client.on('guildMemberAdd', async (member) => {

    try {

        // rôle bloqué
        const unverified = member.guild.roles.cache.get(config.unverifiedRole);
        if (unverified) await member.roles.add(unverified).catch(() => {});

        const channel = member.guild.channels.cache.get(config.welcomeChannel);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setTitle("🚀 Bienvenue dans l'agence NASA")
            .setDescription(
                "👋 Avant d'accéder au serveur,\n" +
                "tu dois définir ton identité RP.\n\n" +
                "📌 Format obligatoire : `Prénom Nom`"
            )
            .setColor(0x0B3D91)
            .setFooter({ text: "NASA Identity System" });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("change_nick")
                .setLabel("✏️ Définir mon identité")
                .setStyle(ButtonStyle.Primary)
        );

        await channel.send({
            content: `${member}`,
            embeds: [embed],
            components: [row]
        });

    } catch (err) {
        console.error("JOIN ERROR:", err);
    }
});

// ================= INTERACTIONS =================

client.on('interactionCreate', async interaction => {

    try {

        // ================= PANEL =================

        if (interaction.isChatInputCommand() && interaction.commandName === 'panel') {

            const embed = new EmbedBuilder()
                .setTitle("🚀 NASA Support Center")
                .setDescription("🛰️ Choisis une mission pour ouvrir un ticket.")
                .setColor(0x0B3D91);

            const menu = new StringSelectMenuBuilder()
                .setCustomId('ticket_select')
                .setPlaceholder('Sélectionner une mission')
                .addOptions([
                    { label: 'Recrutement', value: 'recrutement', emoji: '📋' },
                    { label: 'Direction', value: 'contacter_la_direction', emoji: '⚠️' },
                    { label: 'Partenariats', value: 'partenariats', emoji: '🤝' }
                ]);

            return interaction.reply({
                embeds: [embed],
                components: [new ActionRowBuilder().addComponents(menu)]
            });
        }

        // ================= BUTTON RP NAME =================

        if (interaction.isButton() && interaction.customId === "change_nick") {

            const modal = new ModalBuilder()
                .setCustomId("nickname_modal")
                .setTitle("Identité RP");

            const input = new TextInputBuilder()
                .setCustomId("rp_name")
                .setLabel("Prénom Nom")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMinLength(3)
                .setMaxLength(32);

            modal.addComponents(new ActionRowBuilder().addComponents(input));

            return interaction.showModal(modal);
        }

        // ================= MODAL RP =================

        if (interaction.isModalSubmit() && interaction.customId === "nickname_modal") {

            const rpName = interaction.fields.getTextInputValue("rp_name");

            await interaction.member.setNickname(rpName).catch(() => {});

            const unverified = interaction.guild.roles.cache.get(config.unverifiedRole);
            const memberRole = interaction.guild.roles.cache.get(config.memberRole);

            if (unverified) await interaction.member.roles.remove(unverified).catch(() => {});
            if (memberRole) await interaction.member.roles.add(memberRole).catch(() => {});

            return interaction.reply({
                content: `✅ Identité validée : **${rpName}**`,
                flags: 64
            });
        }

        // ================= TICKETS =================

        if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {

            const type = interaction.values[0];

            const category = config.categories[type];
            const staffRole = interaction.guild.roles.cache.get(config.staffRole);

            if (!category || !staffRole) {
                return interaction.reply({ content: "❌ config invalide", flags: 64 });
            }

            const rpName = interaction.member.displayName || interaction.user.username;
            const emoji = config.ticketEmojis?.[type] || "📋";

            const channel = await interaction.guild.channels.create({
                name: `${emoji}・${rpName}`,
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
                .setDescription(`Catégorie : **${type}**`)
                .setColor(0x57F287);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("close_ticket")
                    .setLabel("Fermer")
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji("🔒")
            );

            await channel.send({ embeds: [embed], components: [row] });

            return interaction.reply({
                content: `✅ Ticket créé : ${channel}`,
                flags: 64
            });
        }

        // ================= CLOSE =================

        if (interaction.isButton() && interaction.customId === "close_ticket") {

            return interaction.reply({
                content: "Confirmer fermeture ?",
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId("confirm_close")
                            .setLabel("Confirmer")
                            .setStyle(ButtonStyle.Danger)
                    )
                ],
                flags: 64
            });
        }

        // ================= CONFIRM CLOSE =================

        if (interaction.isButton() && interaction.customId === "confirm_close") {

            await interaction.deferReply({ flags: 64 });

            const transcript = await discordTranscripts.createTranscript(interaction.channel);

            const logs = interaction.guild.channels.cache.get(config.logsChannel);

            if (logs) {
                logs.send({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle("📡 Ticket fermé")
                            .setDescription(`Par ${interaction.user.tag}`)
                            .setColor(0xED4245)
                    ],
                    files: [transcript]
                });
            }

            await interaction.editReply("Fermeture...");

            setTimeout(() => interaction.channel.delete().catch(() => {}), 1500);
        }

    } catch (err) {
        console.error("ERROR:", err);

        if (interaction.isRepliable()) {
            interaction.reply({ content: "❌ erreur système", flags: 64 }).catch(() => {});
        }
    }
});

// ================= LOGIN =================

client.login(process.env.TOKEN);