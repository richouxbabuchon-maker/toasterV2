require('dotenv').config();

console.log("🚀 Bot démarré");

const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    SlashCommandBuilder,
    REST,
    Routes
} = require('discord.js');

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

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    await rest.put(
        Routes.applicationGuildCommands(client.user.id, config.guildId),
        { body: commands }
    );

    console.log("✅ Slash commands OK");
});

// ================= JOIN =================

client.on('guildMemberAdd', async (member) => {

    try {
        await member.roles.add(config.unverifiedRole);

        const channel = member.guild.channels.cache.get(config.welcomeChannel);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setTitle("🚀 Bienvenue")
            .setDescription("Définis ton pseudo RP pour accéder au serveur.")
            .setColor(0x0B3D91);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("change_nick")
                .setLabel("✏️ Définir mon pseudo")
                .setStyle(ButtonStyle.Primary)
        );

        channel.send({
            content: `${member}`,
            embeds: [embed],
            components: [row]
        });

    } catch (err) {
        console.error(err);
    }
});

// ================= INTERACTIONS =================

client.on('interactionCreate', async (interaction) => {

    // ===== PANEL =====
    if (interaction.isChatInputCommand() && interaction.commandName === 'panel') {

        const embed = new EmbedBuilder()
            .setTitle("🚀 Support Center")
            .setDescription("Choisis une catégorie")
            .setColor(0x0B3D91);

        return interaction.reply({ embeds: [embed] });
    }

    // ===== BUTTON RP =====
    if (interaction.isButton() && interaction.customId === "change_nick") {

        const modal = new ModalBuilder()
            .setCustomId("set_rp_name")
            .setTitle("Pseudo RP");

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

    // ===== MODAL RP =====
    if (interaction.isModalSubmit() && interaction.customId === "set_rp_name") {

        const rpName = interaction.fields.getTextInputValue("rp_name");
        const member = interaction.member;

        try {
            const regex = /^[A-Za-zÀ-ÿ]+ [A-Za-zÀ-ÿ]+$/;

            if (!regex.test(rpName)) {
                return interaction.reply({
                    content: "❌ Format invalide (Prénom Nom)",
                    flags: 64
                });
            }

            await member.setNickname(rpName);

            await member.roles.add(config.memberRole);
            await member.roles.remove(config.unverifiedRole);

            return interaction.reply({
                content: "✅ Accès débloqué ! Bienvenue.",
                flags: 64
            });

        } catch (err) {
            console.error(err);

            return interaction.reply({
                content: "❌ Erreur système",
                flags: 64
            });
        }
    }
});

// ================= LOGIN =================

client.login(process.env.TOKEN);