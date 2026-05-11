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
        Routes.applicationGuildCommands(
            client.user.id,
            config.guildId
        ),
        { body: commands }
    );

    console.log("✅ Slash commands OK");
});

// ================= MEMBER JOIN =================

client.on('guildMemberAdd', async (member) => {

    const unverifiedRole = member.guild.roles.cache.get(config.unverifiedRole);
    if (unverifiedRole) {
        await member.roles.add(unverifiedRole).catch(() => {});
    }

    const channel = member.guild.channels.cache.get(config.welcomeChannel);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setTitle("🚀 Bienvenue dans notre agence spatiale")
        .setDescription(
            "👋 Avant d'accéder au serveur,\n" +
            "vous devez définir votre identité RP.\n\n" +
            "📌 Format obligatoire : Prénom Nom"
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
});

// ================= INTERACTIONS =================

client.on('interactionCreate', async interaction => {

    console.log("🔥", interaction.type, interaction.customId || interaction.commandName);

    try {

        // ================= PANEL =================

        if (interaction.isChatInputCommand() && interaction.commandName === 'panel') {

            const embed = new EmbedBuilder()
                .setTitle("🚀 NASA Support Center")
                .setDescription(
                    "👨‍🚀 Bienvenue à la NASA Support System\n\n" +
                    "🛰️ Quelle est votre demande aujourd’hui ?\n" +
                    "Veuillez sélectionner une catégorie ci-dessous pour ouvrir un ticket."
                )
                .setColor(0x0B3D91);

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

        // ================= MODAL =================

        if (interaction.isButton() && interaction.customId === "change_nick") {

            const modal = new ModalBuilder()
                .setCustomId("nickname_modal")
                .setTitle("Identité RP");

            const input = new TextInputBuilder()
                .setCustomId("rp_name")
                .setLabel("Prénom Nom")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(input)
            );

            return interaction.showModal(modal);
        }

        // ================= SUBMIT MODAL =================

        if (interaction.isModalSubmit() && interaction.customId === "nickname_modal") {

            const rpName = interaction.fields.getTextInputValue("rp_name");

            await interaction.member.setNickname(rpName);

            const role = interaction.guild.roles.cache.get(config.unverifiedRole);
            if (role) await interaction.member.roles.remove(role);

            const memberRole = interaction.guild.roles.cache.get(config.memberRole);
            if (memberRole) await interaction.member.roles.add(memberRole);

            return interaction.reply({
                content: `✅ Ton identité RP est maintenant : **${rpName}**`,
                flags: 64
            });
        }

        // ================= TICKETS =================

        if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {

            const type = interaction.values[0];

            const category = config.categories[type];
            const staffRole = interaction.guild.roles.cache.get(config.staffRole);

            const rpName = interaction.member.displayName || interaction.user.username;

            const channel = await interaction.guild.channels.create({
                name: `🎫・${rpName}`,
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
                            PermissionsBitField.Flags.SendMessages
                        ]
                    },
                    {
                        id: staffRole.id,
                        allow: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.SendMessages
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
                .setColor(0x57F287);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('Fermer la mission')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒')
            );

            await channel.send({
                embeds: [embed],
                components: [row]
            });

            return interaction.reply({
                content: `✅ Mission ouverte : ${channel}`,
                flags: 64
            });
        }

        // ================= CLOSE =================

        if (interaction.isButton() && interaction.customId === "close_ticket") {

            const transcript = await discordTranscripts.createTranscript(interaction.channel);

            const logs = interaction.guild.channels.cache.get(config.logsChannel);

            if (logs) {
                logs.send({
                    files: [transcript],
                    embeds: [
                        new EmbedBuilder()
                            .setTitle("📡 Mission fermée")
                            .setColor(0xED4245)
                    ]
                });
            }

            await interaction.reply({ content: "Fermeture...", flags: 64 });

            setTimeout(() => {
                interaction.channel.delete().catch(() => {});
            }, 1500);
        }

    } catch (err) {
        console.error("ERROR:", err);
    }
});

// ================= LOGIN =================

client.login(process.env.TOKEN);