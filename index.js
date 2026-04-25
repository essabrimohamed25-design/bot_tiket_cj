const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');

// ============================================
// ENVIRONMENT VARIABLES
// ============================================
const {
    BOT_TOKEN,
    GUILD_ID,
    TICKET_LOG_CHANNEL_ID,
    TRANSCRIPT_CHANNEL_ID,
    TICKET_CATEGORY_ID,
    TICKET_PANEL_CHANNEL_ID,
    APP_PANEL_CHANNEL_ID,
    APP_REVIEW_CHANNEL_ID,
    APP_ACCEPTED_CHANNEL_ID,
    APP_REJECTED_CHANNEL_ID,
    STAFF_ROLES,
    BANNER_URL = "https://media.discordapp.net/attachments/1480969775344652470/1496647110525845625/DF7E4FDA-66D3-49FF-BD5E-7C746253AE2D.png"
} = process.env;

// ============================================
// CLIENT INITIALIZATION
// ============================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel, Partials.Message]
});

// ============================================
// TICKET CONFIGURATION
// ============================================
const TICKET_TYPES = {
    pub: { name: "Public Lounge", emoji: "🍻", color: "#38BDF8", desc: "Discussions générales & chats communautaires" },
    bugs: { name: "Bug Report", emoji: "🐛", color: "#EF4444", desc: "Signaler des problèmes techniques" },
    abuse: { name: "Abuse Report", emoji: "⚠️", color: "#F97316", desc: "Signaler des violations des règles" },
    server: { name: "Server Support", emoji: "⚙️", color: "#8B5CF6", desc: "Support technique & questions sur le serveur" }
};

const staffRolesArray = STAFF_ROLES ? STAFF_ROLES.split(',').map(r => r.trim()) : [];
const activeTickets = new Map();

// ============================================
// APPLICATION CONFIGURATION (French)
// ============================================
const APPLICATION_POSITIONS = {
    staff: { name: "Staff Team", emoji: "🛠", color: "#5865F2", description: "Aidez à modérer et gérer la communauté" }
};

const APPLICATION_QUESTIONS = [
    { id: "fullname", label: "Nom complet", placeholder: "Entrez votre nom et prénom...", style: TextInputStyle.Short, required: true },
    { id: "age", label: "Âge", placeholder: "Entrez votre âge...", style: TextInputStyle.Short, required: true },
    { id: "why", label: "Pourquoi voulez-vous rejoindre l'équipe staff ?", placeholder: "Expliquez votre motivation...", style: TextInputStyle.Paragraph, required: true },
    { id: "skills", label: "Avez-vous des compétences ? Lesquelles ?", placeholder: "Décrivez vos compétences...", style: TextInputStyle.Paragraph, required: true },
    { id: "experience", label: "Avez-vous de l'expérience ?", placeholder: "Parlez de votre expérience...", style: TextInputStyle.Paragraph, required: true },
    { id: "availability", label: "Combien de temps pouvez-vous être en ligne ?", placeholder: "Ex: 2-3 heures par jour...", style: TextInputStyle.Short, required: true },
    { id: "device", label: "PC ou Téléphone ou Les deux ?", placeholder: "PC / Téléphone / Les deux", style: TextInputStyle.Short, required: true }
];

// ============================================
// HELPER FUNCTIONS
// ============================================

async function sendLog(guild, channelId, embed) {
    if (!channelId) return;
    const channel = guild.channels.cache.get(channelId);
    if (channel) {
        await channel.send({ embeds: [embed] }).catch(err => console.error(`Failed to send log:`, err.message));
    }
}

async function generateTranscript(channel, ticketData) {
    const messages = await channel.messages.fetch({ limit: 200 });
    const sorted = Array.from(messages.values()).reverse();
    
    let transcript = `═══════════════════════════════════════════════════\n`;
    transcript += `                    🎫 TRANSCRIPT DU TICKET\n`;
    transcript += `═══════════════════════════════════════════════════\n\n`;
    transcript += `📋 Channel: ${channel.name}\n`;
    transcript += `📅 Created: ${channel.createdAt.toLocaleString()}\n`;
    transcript += `👤 Owner: ${ticketData.userTag || "Unknown"}\n`;
    transcript += `🆔 Channel ID: ${channel.id}\n`;
    transcript += `───────────────────────────────────────────────────\n\n`;
    
    for (const msg of sorted) {
        const timestamp = msg.createdAt.toLocaleString();
        const author = msg.author.tag;
        const content = msg.content || '[Embed or Attachment]';
        transcript += `[${timestamp}] ${author}:\n${content}\n───────────────────────────────────────────────────\n`;
    }
    
    transcript += `\n📊 Transcript Generated: ${new Date().toLocaleString()}\n`;
    transcript += `═══════════════════════════════════════════════════`;
    
    const filePath = `/tmp/transcript-${channel.id}-${Date.now()}.txt`;
    fs.writeFileSync(filePath, transcript);
    return filePath;
}

async function getModerator(guild, actionType, targetId, timeout = 5000) {
    try {
        const logs = await guild.fetchAuditLogs({ type: actionType, limit: 5 });
        const entry = logs.entries.find(e => e.target.id === targetId);
        if (entry && (Date.now() - entry.createdTimestamp) < timeout) {
            return { executor: entry.executor, reason: entry.reason || "No reason provided" };
        }
        return null;
    } catch (error) {
        return null;
    }
}

function isStaff(member) {
    return staffRolesArray.some(roleId => member.roles.cache.has(roleId));
}

// ============================================
// TICKET PANEL
// ============================================
async function createTicketPanel(channel) {
    const embed = new EmbedBuilder()
        .setTitle("🌟 SYSTÈME DE TICKETS")
        .setDescription(
            `> **Bienvenue sur notre centre de support premium**\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `**📌 COMMENT ÇA FONCTIONNE**\n` +
            `• Sélectionnez un type de ticket ci-dessous\n` +
            `• Un canal privé sera créé\n` +
            `• Notre équipe vous assistera rapidement\n` +
            `• Les tickets sont automatiquement enregistrés\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `**⚡ AVANT D'OUVRIR**\n` +
            `• Soyez respectueux et patient\n` +
            `• Fournissez des informations détaillées\n` +
            `• Ne créez pas de tickets multiples\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `**⏰ TEMPS DE RÉPONSE**\n` +
            `• Moyenne: 5-10 minutes\n` +
            `• Heures de pointe: 15-20 minutes\n` +
            `• Support 24/7 disponible\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `*Cliquez sur un bouton ci-dessous pour commencer* 🚀`
        )
        .setColor(0x2b2d31)
        .setImage(BANNER_URL)
        .setFooter({ text: "Système de Tickets Premium • 24/7", iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('ticket_pub')
                .setLabel("Public Lounge")
                .setEmoji("🍻")
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('ticket_bugs')
                .setLabel("Bug Report")
                .setEmoji("🐛")
                .setStyle(ButtonStyle.Danger)
        );

    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('ticket_abuse')
                .setLabel("Abuse Report")
                .setEmoji("⚠️")
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('ticket_server')
                .setLabel("Server Support")
                .setEmoji("⚙️")
                .setStyle(ButtonStyle.Primary)
        );
    
    await channel.send({ embeds: [embed], components: [row1, row2] });
}

// ============================================
// APPLICATION PANEL
// ============================================
async function createApplicationPanel(channel) {
    const embed = new EmbedBuilder()
        .setTitle("📋 CANDIDATURE STAFF")
        .setDescription(
            `> **Rejoignez notre équipe et aidez à façonner la communauté !**\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `**📌 POSTE DISPONIBLE**\n` +
            `• 🛠 **Staff Team** - Modérez et gérez le serveur\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `**📝 QUESTIONS DU FORMULAIRE**\n` +
            `• Nom complet\n` +
            `• Âge\n` +
            `• Motivation\n` +
            `• Compétences\n` +
            `• Expérience\n` +
            `• Disponibilité\n` +
            `• Équipement\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `**✅ COMMENT POSTULER**\n` +
            `• Sélectionnez le poste dans le menu déroulant\n` +
            `• Remplissez le formulaire\n` +
            `• Soumettez votre candidature\n` +
            `• L'équipe examinera votre dossier\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `*Sélectionnez un poste pour commencer* 🚀`
        )
        .setColor(0x2b2d31)
        .setImage(BANNER_URL)
        .setFooter({ text: "Système de Candidature • Réponse sous 48h", iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('apply_select')
        .setPlaceholder('🎯 Sélectionnez un poste...')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('Staff Team')
                .setDescription('Postulez pour devenir membre du staff')
                .setEmoji('🛠')
                .setValue('staff')
        );

    const row = new ActionRowBuilder().addComponents(selectMenu);
    await channel.send({ embeds: [embed], components: [row] });
}

// ============================================
// APPLICATION SUBMISSION
// ============================================
async function sendApplicationForReview(guild, application) {
    const reviewChannel = guild.channels.cache.get(APP_REVIEW_CHANNEL_ID);
    if (!reviewChannel) {
        console.error("Review channel not found!");
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle(`🛠 NOUVELLE CANDIDATURE - STAFF`)
        .setDescription(
            `**Candidat:** ${application.userTag} (<@${application.userId}>)\n` +
            `**Poste:** Staff Team\n` +
            `**Soumis:** <t:${Math.floor(application.timestamp / 1000)}:F>\n` +
            `**ID Utilisateur:** \`${application.userId}\``
        )
        .setColor(0x5865F2)
        .setThumbnail(application.userAvatar)
        .setImage(BANNER_URL)
        .setTimestamp();

    for (const [question, answer] of Object.entries(application.answers)) {
        const questionLabels = {
            fullname: "Nom complet",
            age: "Âge",
            why: "Motivation",
            skills: "Compétences",
            experience: "Expérience",
            availability: "Disponibilité",
            device: "Équipement"
        };
        const label = questionLabels[question] || question;
        embed.addFields({ 
            name: `📌 ${label}`, 
            value: answer.length > 1024 ? answer.substring(0, 1021) + '...' : answer || "Non fourni", 
            inline: false 
        });
    }

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`app_accept_${application.userId}_staff`)
                .setLabel('Accepter')
                .setEmoji('✅')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`app_reject_${application.userId}_staff`)
                .setLabel('Refuser')
                .setEmoji('❌')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setLabel('Voir Profil')
                .setURL(`https://discord.com/users/${application.userId}`)
                .setStyle(ButtonStyle.Link)
        );

    await reviewChannel.send({ embeds: [embed], components: [buttons] });
}

// ============================================
// READY EVENT
// ============================================
client.once('ready', async () => {
    console.log(`✨ ${client.user.tag} est en ligne !`);
    console.log(`📋 Bot de Tickets & Candidatures - Version Française`);
    
    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) {
        console.error("❌ Serveur non trouvé ! Vérifiez GUILD_ID");
        return;
    }

    // Ticket Panel
    const ticketPanelChannel = client.channels.cache.get(TICKET_PANEL_CHANNEL_ID);
    if (ticketPanelChannel) {
        const messages = await ticketPanelChannel.messages.fetch({ limit: 10 });
        await ticketPanelChannel.bulkDelete(messages);
        await createTicketPanel(ticketPanelChannel);
        console.log("✅ Panneau de tickets déployé !");
    }

    // Application Panel
    const appPanelChannel = client.channels.cache.get(APP_PANEL_CHANNEL_ID);
    if (appPanelChannel) {
        const messages = await appPanelChannel.messages.fetch({ limit: 10 });
        await appPanelChannel.bulkDelete(messages);
        await createApplicationPanel(appPanelChannel);
        console.log("✅ Panneau de candidatures déployé !");
    }

    console.log(`\n🚀 Bot prêt !`);
});

// ============================================
// TICKET SYSTEM - BUTTON HANDLER
// ============================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    
    // OPEN TICKET
    if (interaction.customId.startsWith('ticket_')) {
        const type = interaction.customId.replace('ticket_', '');
        const typeConfig = TICKET_TYPES[type];
        if (!typeConfig) return;
        
        for (const [id, data] of activeTickets) {
            if (data.userId === interaction.user.id) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle("❌ LIMITE ATTEINTE")
                    .setDescription(`> Vous avez déjà un ticket ouvert !\n> Veuillez fermer votre ticket existant avant d'en créer un nouveau.\n\n**Canal:** <#${id}>`)
                    .setColor(0xEF4444);
                return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
        
        await interaction.reply({ 
            embeds: [new EmbedBuilder().setDescription("🔄 `Création de votre ticket...`").setColor(0x38BDF8)], 
            ephemeral: true 
        });
        
        const ticketName = `${type}-${interaction.user.username}`;
        
        try {
            const ticketChannel = await interaction.guild.channels.create({
                name: ticketName,
                type: ChannelType.GuildText,
                parent: TICKET_CATEGORY_ID,
                topic: `Ticket Owner: ${interaction.user.tag} (${interaction.user.id}) | Type: ${typeConfig.name}`,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
                    ...staffRolesArray.map(roleId => ({ id: roleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] }))
                ]
            });
            
            activeTickets.set(ticketChannel.id, { 
                userId: interaction.user.id, 
                userTag: interaction.user.tag,
                type: typeConfig.name,
                createdAt: Date.now()
            });
            
            const welcomeEmbed = new EmbedBuilder()
                .setTitle(`${typeConfig.emoji} ${typeConfig.name.toUpperCase()} TICKET`)
                .setDescription(
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `**👋 Bienvenue ${interaction.user}!**\n\n` +
                    `> **Type de ticket:** ${typeConfig.name}\n` +
                    `> **Catégorie:** ${typeConfig.desc}\n` +
                    `> **Priorité:** Normale\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `**📝 INSTRUCTIONS**\n` +
                    `• Décrivez votre problème en détail\n` +
                    `• Ajoutez des captures d'écran si possible\n` +
                    `• Notre équipe répondra rapidement\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `**🔒 CONTROLES**\n` +
                    `• Cliquez sur **Fermer** pour terminer\n` +
                    `• Cliquez sur **Prendre en charge** pour assigner un staff\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
                )
                .setColor(typeConfig.color)
                .setImage(BANNER_URL)
                .setFooter({ text: `Ticket ID: ${ticketChannel.id} | Support Team` })
                .setTimestamp();
            
            const actionRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('close_ticket')
                        .setLabel('FERMER')
                        .setEmoji('🔒')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('claim_ticket')
                        .setLabel('PRENDRE EN CHARGE')
                        .setEmoji('🎫')
                        .setStyle(ButtonStyle.Secondary)
                );
            
            const mentionText = `${interaction.user} | ${staffRolesArray.map(id => `<@&${id}>`).join(', ')}`;
            await ticketChannel.send({ content: mentionText, embeds: [welcomeEmbed], components: [actionRow] });
            
            const successEmbed = new EmbedBuilder()
                .setTitle("✅ TICKET CRÉÉ")
                .setDescription(`> Votre ticket a été créé !\n> **Canal:** ${ticketChannel}\n> L'équipe vous assistera sous peu.`)
                .setColor(0x22C55E);
            
            await interaction.editReply({ embeds: [successEmbed], ephemeral: true });
            
        } catch (err) {
            console.error(err);
            const errorEmbed = new EmbedBuilder()
                .setTitle("❌ ERREUR")
                .setDescription("> Impossible de créer le ticket. Contactez un administrateur.")
                .setColor(0xEF4444);
            await interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
    
    // CLOSE TICKET
    else if (interaction.customId === 'close_ticket') {
        const ticketData = activeTickets.get(interaction.channel.id);
        if (!ticketData) {
            return interaction.reply({ content: "❌ Ceci n'est pas un ticket valide.", ephemeral: true });
        }
        
        const closeEmbed = new EmbedBuilder()
            .setTitle("🔒 FERMETURE")
            .setDescription("> Ce ticket sera fermé dans **5 secondes**...\n> Un transcript a été sauvegardé.")
            .setColor(0xEF4444);
        
        await interaction.reply({ embeds: [closeEmbed] });
        
        const transcriptPath = await generateTranscript(interaction.channel, ticketData);
        const transcriptChannel = interaction.guild.channels.cache.get(TRANSCRIPT_CHANNEL_ID || TICKET_LOG_CHANNEL_ID);
        
        if (transcriptChannel) {
            const transcriptEmbed = new EmbedBuilder()
                .setTitle("📄 TRANSCRIPT")
                .setDescription(`**Canal:** ${interaction.channel.name}\n**Fermé par:** ${interaction.user.tag}\n**Type:** ${ticketData.type || 'Unknown'}\n**Propriétaire:** ${ticketData.userTag || 'Unknown'}`)
                .setColor(0xF97316)
                .setTimestamp();
            
            await transcriptChannel.send({ embeds: [transcriptEmbed], files: [transcriptPath] });
        }
        
        setTimeout(async () => {
            try {
                await interaction.channel.delete();
                activeTickets.delete(interaction.channel.id);
                fs.unlinkSync(transcriptPath);
            } catch (err) {
                console.error(err);
            }
        }, 5000);
    }
    
    // CLAIM TICKET
    else if (interaction.customId === 'claim_ticket') {
        const ticketData = activeTickets.get(interaction.channel.id);
        if (!ticketData) {
            return interaction.reply({ content: "❌ Ceci n'est pas un ticket valide.", ephemeral: true });
        }
        
        if (!isStaff(interaction.member)) {
            return interaction.reply({ 
                embeds: [new EmbedBuilder().setDescription("❌ Seuls les membres du staff peuvent prendre en charge les tickets.").setColor(0xEF4444)], 
                ephemeral: true 
            });
        }
        
        if (ticketData.claimedBy) {
            return interaction.reply({ 
                embeds: [new EmbedBuilder().setDescription(`❌ Ce ticket a déjà été pris en charge par <@${ticketData.claimedBy}>.`).setColor(0xEF4444)], 
                ephemeral: true 
            });
        }
        
        ticketData.claimedBy = interaction.user.id;
        ticketData.claimedAt = Date.now();
        activeTickets.set(interaction.channel.id, ticketData);
        
        const claimEmbed = new EmbedBuilder()
            .setTitle("🎫 TICKET PRIS EN CHARGE")
            .setDescription(`> **${interaction.user}** a pris en charge ce ticket.\n> Il vous assistera dans quelques instants.`)
            .setColor(0x22C55E)
            .setTimestamp();
        
        await interaction.reply({ embeds: [claimEmbed] });
    }
});

// ============================================
// APPLICATION SYSTEM - DROPDOWN HANDLER
// ============================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== 'apply_select') return;
    
    const modal = new ModalBuilder()
        .setCustomId('apply_modal')
        .setTitle(`🛠 Candidature Staff`);
    
    const components = [];
    
    for (const question of APPLICATION_QUESTIONS) {
        const input = new TextInputBuilder()
            .setCustomId(question.id)
            .setLabel(question.label)
            .setStyle(question.style)
            .setRequired(question.required)
            .setPlaceholder(question.placeholder)
            .setMaxLength(question.style === TextInputStyle.Paragraph ? 1500 : 100);
        
        const row = new ActionRowBuilder().addComponents(input);
        components.push(row);
    }
    
    modal.addComponents(components);
    await interaction.showModal(modal);
});

// ============================================
// APPLICATION SYSTEM - MODAL SUBMIT HANDLER
// ============================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isModalSubmit()) return;
    if (interaction.customId !== 'apply_modal') return;
    
    const answers = {};
    for (const question of APPLICATION_QUESTIONS) {
        answers[question.id] = interaction.fields.getTextInputValue(question.id);
    }
    
    const application = {
        position: 'staff',
        userId: interaction.user.id,
        userTag: interaction.user.tag,
        userAvatar: interaction.user.displayAvatarURL(),
        timestamp: Date.now(),
        answers: answers
    };
    
    await sendApplicationForReview(interaction.guild, application);
    
    const successEmbed = new EmbedBuilder()
        .setTitle("✅ CANDIDATURE ENVOYÉE")
        .setDescription(
            `> Votre candidature pour **Staff Team** a été soumise !\n\n` +
            `**Etapes suivantes:**\n` +
            `• Notre équipe examinera votre dossier sous 48h\n` +
            `• Vous serez contacté par MP si vous êtes retenu\n` +
            `• Merci de votre intérêt ! 🎉`
        )
        .setColor(0x22C55E)
        .setImage(BANNER_URL)
        .setTimestamp();
    
    await interaction.reply({ embeds: [successEmbed], ephemeral: true });
    
    try {
        const dmEmbed = new EmbedBuilder()
            .setTitle("📋 Candidature Reçue")
            .setDescription(
                `Merci d'avoir postulé pour **Staff Team** !\n\n` +
                `**Détails:**\n` +
                `• Poste: Staff Team\n` +
                `• Soumis: <t:${Math.floor(Date.now() / 1000)}:F>\n\n` +
                `Votre candidature est en cours d'examen. Vous recevrez une réponse sous 48h.\n\n` +
                `Bonne chance ! 🍀`
            )
            .setColor(0x5865F2)
            .setTimestamp();
        await interaction.user.send({ embeds: [dmEmbed] });
    } catch (e) {
        console.log(`Impossible d'envoyer un MP à ${interaction.user.tag}`);
    }
});

// ============================================
// APPLICATION REVIEW - ACCEPT/REJECT
// ============================================

// ACCEPT HANDLER
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('app_accept_')) return;
    
    if (!isStaff(interaction.member)) {
        return interaction.reply({ 
            embeds: [new EmbedBuilder().setDescription("❌ Seuls les membres du staff peuvent examiner les candidatures.").setColor(0xEF4444)], 
            ephemeral: true 
        });
    }
    
    const parts = interaction.customId.split('_');
    const userId = parts[2];
    
    const guild = interaction.guild;
    const member = await guild.members.fetch(userId).catch(() => null);
    
    // Accepted Embed for Log Channel
    const acceptLogEmbed = new EmbedBuilder()
        .setTitle("✅ CANDIDATURE ACCEPTÉE")
        .setDescription(
            `**Candidat:** ${member?.user?.tag || userId}\n` +
            `**Poste:** Staff Team\n` +
            `**Examiné par:** ${interaction.user.tag}\n` +
            `**Date:** <t:${Math.floor(Date.now() / 1000)}:F>`
        )
        .setColor(0x22C55E)
        .setThumbnail(member?.user?.displayAvatarURL() || null)
        .setTimestamp()
        .setFooter({ text: "Candidature acceptée" });
    
    await sendLog(guild, APP_ACCEPTED_CHANNEL_ID, acceptLogEmbed);
    
    // DM to user
    try {
        const acceptDMEmbed = new EmbedBuilder()
            .setTitle("✅ Félicitations ! Candidature Acceptée")
            .setDescription(
                `**Félicitations ${member?.user?.username || 'Candidat'} !**\n\n` +
                `Votre candidature pour rejoindre **l'équipe Staff** a été **acceptée** !\n\n` +
                `**Prochaines étapes:**\n` +
                `• Un membre de l'équipe vous contactera prochainement\n` +
                `• Vous recevrez les instructions pour commencer\n` +
                `• Bienvenue dans l'équipe ! 🎉`
            )
            .setColor(0x22C55E)
            .setTimestamp();
        await member?.send({ embeds: [acceptDMEmbed] });
    } catch (e) {}
    
    await interaction.reply({ 
        embeds: [new EmbedBuilder()
            .setTitle("✅ Candidature Acceptée")
            .setDescription(`Vous avez accepté la candidature de **${member?.user?.tag || userId}** pour Staff Team.`)
            .setColor(0x22C55E)
        ], 
        ephemeral: false 
    });
    
    // Disable buttons
    const row = ActionRowBuilder.from(interaction.message.components[0]);
    row.components.forEach(component => component.setDisabled(true));
    await interaction.message.edit({ components: [row] });
});

// REJECT HANDLER with Modal
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('app_reject_')) return;
    
    if (!isStaff(interaction.member)) {
        return interaction.reply({ 
            embeds: [new EmbedBuilder().setDescription("❌ Seuls les membres du staff peuvent examiner les candidatures.").setColor(0xEF4444)], 
            ephemeral: true 
        });
    }
    
    const parts = interaction.customId.split('_');
    const userId = parts[2];
    
    // Store userId for later use
    interaction.client.rejectData = { userId };
    
    // Create modal for rejection reason
    const modal = new ModalBuilder()
        .setCustomId(`reject_modal_${userId}`)
        .setTitle("Refuser la candidature");
    
    const reasonInput = new TextInputBuilder()
        .setCustomId('reason')
        .setLabel("Raison du refus")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setPlaceholder("Ex: Manque d'expérience, disponibilité insuffisante...")
        .setMaxLength(1000);
    
    const row = new ActionRowBuilder().addComponents(reasonInput);
    modal.addComponents(row);
    
    await interaction.showModal(modal);
});

// REJECT MODAL SUBMIT HANDLER
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isModalSubmit()) return;
    if (!interaction.customId.startsWith('reject_modal_')) return;
    
    const userId = interaction.customId.replace('reject_modal_', '');
    const reason = interaction.fields.getTextInputValue('reason');
    
    const guild = interaction.guild;
    const member = await guild.members.fetch(userId).catch(() => null);
    
    // Rejected Embed for Log Channel
    const rejectLogEmbed = new EmbedBuilder()
        .setTitle("❌ CANDIDATURE REFUSÉE")
        .setDescription(
            `**Candidat:** ${member?.user?.tag || userId}\n` +
            `**Poste:** Staff Team\n` +
            `**Examiné par:** ${interaction.user.tag}\n` +
            `**Date:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n` +
            `**Raison du refus:**\n> ${reason}`
        )
        .setColor(0xEF4444)
        .setThumbnail(member?.user?.displayAvatarURL() || null)
        .setTimestamp()
        .setFooter({ text: "Candidature refusée" });
    
    await sendLog(guild, APP_REJECTED_CHANNEL_ID, rejectLogEmbed);
    
    // DM to user with reason
    try {
        const rejectDMEmbed = new EmbedBuilder()
            .setTitle("❌ Candidature Refusée")
            .setDescription(
                `**Bonjour ${member?.user?.username || 'Candidat'}**,\n\n` +
                `Nous vous remercions d'avoir postulé pour rejoindre **l'équipe Staff**.\n\n` +
                `Malheureusement, votre candidature n'a pas été retenue pour le moment.\n\n` +
                `**Raison du refus:**\n> ${reason}\n\n` +
                `Vous pourrez postuler à nouveau dans 30 jours.\n\n` +
                `Merci de votre compréhension et bon courage pour la suite !`
            )
            .setColor(0xEF4444)
            .setTimestamp();
        await member?.send({ embeds: [rejectDMEmbed] });
    } catch (e) {}
    
    await interaction.reply({ 
        embeds: [new EmbedBuilder()
            .setTitle("❌ Candidature Refusée")
            .setDescription(`Vous avez refusé la candidature de **${member?.user?.tag || userId}** pour Staff Team.\n\n**Raison:** ${reason}`)
            .setColor(0xEF4444)
        ], 
        ephemeral: false 
    });
    
    // Disable buttons on original message
    if (interaction.message) {
        const row = ActionRowBuilder.from(interaction.message.components[0]);
        row.components.forEach(component => component.setDisabled(true));
        await interaction.message.edit({ components: [row] }).catch(() => {});
    }
});

// ============================================
// ERROR HANDLING
// ============================================
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled rejection:', error.message);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception:', error.message);
});

// ============================================
// LOGIN
// ============================================
client.login(BOT_TOKEN);
