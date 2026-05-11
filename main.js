require('dotenv').config();

console.log("🚀 Bot démarré");

const {
    Client,
    GatewayIntentBits,
    PermissionsBitField,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    EmbedBuilder,
    SlashCommandBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    REST,
    Routes,
    ChannelType
} = require('discord.js');

const config = require('./config');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages
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

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    await rest.put(
        Routes.applicationGuildCommands(client.user.id, config.guildId),
        { body: commands }
    );

    console.log("✅ Slash commands OK");
});


// ================= WELCOME SYSTEM =================

client.on('guildMemberAdd', async (member) => {

    const channel = member.guild.channels.cache.get(config.welcomeChannel);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setTitle("🚀 Bienvenue sur le serveur")
        .setDescription(
            "👋 Bienvenue !\n\n" +
            "⚠️ Tu dois définir ton pseudo RP pour accéder au serveur.\n\n" +
            "Clique sur le bouton ci-dessous."
        )
        .setColor(0x0B3D91);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("change_nick")
            .setLabel("✏️ Définir mon pseudo RP")
            .setStyle(ButtonStyle.Primary)
    );

    channel.send({
        content: `${member}`,
        embeds: [embed],
        components: [row]
    });
});


// ================= INTERACTIONS =================

client.on('interactionCreate', async (interaction) => {

    try {

        // ================= PANEL NASA =================
        if (interaction.isChatInputCommand() && interaction.commandName === "panel") {

            const embed = new EmbedBuilder()
                .setTitle("🚀 NASA Support Center")
                .setDescription(
                    "👨‍🚀 Bienvenue dans le système de support de la NASA\n\n" +
                    "🛰️ Sélectionne une mission pour ouvrir un ticket."
                )
                .setColor(0x0B3D91)
                .setThumbnail("https://upload.wikimedia.org/wikipedia/commons/e/e5/NASA_logo.svg")
                .setImage("https://www.nasa.gov/wp-content/uploads/2023/03/nasa-logo-web-rgb.png")
                .addFields(
                    { name: "📡 Statut", value: "Tous systèmes opérationnels", inline: true },
                    { name: "⏱ Réponse", value: "Rapide (24/7)", inline: true },
                    { name: "🎫 Support", value: "Actif", inline: true }
                )
                .setFooter({
                    text: "NASA Support System • Ticket Center",
                    iconURL: "https://upload.wikimedia.org/wikipedia/commons/e/e5/NASA_logo.svg"
                })
                .setTimestamp();

            const menu = new StringSelectMenuBuilder()
                .setCustomId("ticket_select")
                .setPlaceholder("Sélectionner une mission")
                .addOptions([
                    { label: "Recrutement", value: "recrutement", emoji: "📋" },
                    { label: "Support", value: "support", emoji: "⚠️" }
                ]);

            return interaction.reply({
                embeds: [embed],
                components: [new ActionRowBuilder().addComponents(menu)]
            });
        }


        // ================= RP BUTTON =================
        if (interaction.isButton() && interaction.customId === "change_nick") {

            const modal = new ModalBuilder()
                .setCustomId("rp_modal")
                .setTitle("Pseudo RP");

            const input = new TextInputBuilder()
                .setCustomId("rp_name")
                .setLabel("Prénom Nom RP")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(input)
            );

            return interaction.showModal(modal);
        }


        // ================= RP SUBMIT =================
        if (interaction.isModalSubmit() && interaction.customId === "rp_modal") {

            const rpName = interaction.fields.getTextInputValue("rp_name");

            const member = interaction.member;

            try {
                await member.setNickname(rpName);
            } catch (err) {
                console.log("Impossible de changer le pseudo");
            }

            const role = interaction.guild.roles.cache.get(config.acceptedRole);
            if (role) await member.roles.add(role);

            return interaction.reply({
                content: "✅ Pseudo RP validé, accès débloqué !",
                ephemeral: true
            });
        }


        // ================= TICKETS =================
        if (interaction.isStringSelectMenu() && interaction.customId === "ticket_select") {

            const type = interaction.values[0];

            const channel = await interaction.guild.channels.create({
                name: `ticket-${interaction.user.username}`,
                type: ChannelType.GuildText,
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
                        id: config.staffRole,
                        allow: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.SendMessages,
                            PermissionsBitField.Flags.ReadMessageHistory
                        ]
                    }
                ]
            });

            return interaction.reply({
                content: `🎫 Ticket créé : ${channel}`,
                ephemeral: true
            });
        }

    } catch (err) {
        console.error("ERROR:", err);

        if (interaction.isRepliable()) {
            interaction.reply({
                content: "❌ Erreur système",
                ephemeral: true
            }).catch(() => {});
        }
    }
});


// ================= LOGIN =================

client.login(process.env.TOKEN);