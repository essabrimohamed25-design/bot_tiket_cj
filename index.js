const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');

// ============================================
// ENVIRONMENT VARIABLES
// ============================================
const {
    BOT_TOKEN,
    GUILD_ID,
    STAFF_ROLES,
    BANNER_URL = "https://media.discordapp.net/attachments/1480969775344652470/1496647110525845625/DF7E4FDA-66D3-49FF-BD5E-7C746253AE2D.png",
    TICKET_CATEGORY_ID,
    TICKET_PANEL_CHANNEL_ID,
    TICKET_LOG_CHANNEL_ID,
    TRANSCRIPT_CHANNEL_ID,
    APP_PANEL_CHANNEL_ID,
    APP_REVIEW_CHANNEL_ID,
    APP_ACCEPTED_CHANNEL_ID,
    APP_REJECTED_CHANNEL_ID
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
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildEmojisAndStickers,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel, Partials.Message]
});

// ============================================
// CONFIGURATION
// ============================================

// Ticket Types
const TICKET_TYPES = {
    pub: { name: "Public Lounge", emoji: "🍻", color: "#38BDF8", desc: "General discussions & community chats" },
    bugs: { name: "Bug Report", emoji: "🐛", color: "#EF4444", desc: "Report technical issues or glitches" },
    abuse: { name: "Abuse Report", emoji: "⚠️", color: "#F97316", desc: "Report rule violations or harassment" },
    server: { name: "Server Support", emoji: "⚙️", color: "#8B5CF6", desc: "Technical support & server inquiries" }
};

// Application Positions
const APPLICATION_POSITIONS = {
    staff: { name: "🛠 Staff Team", emoji: "🛠", color: "#5865F2", description: "Help moderate and manage the community" },
    designer: { name: "🎨 Designer", emoji: "🎨", color: "#EB459E", description: "Create graphics and visual content" },
    event: { name: "🎉 Event Hoster", emoji: "🎉", color: "#FEE75C", description: "Organize fun community events" },
    partnership: { name: "🤝 Partnership", emoji: "🤝", color: "#57F287", description: "Handle collaborations and partnerships" },
    developer: { name: "💻 Developer", emoji: "💻", color: "#17A2B8", description: "Work on bots and coding projects" }
};

// Application Questions (same for all positions)
const APPLICATION_QUESTIONS = [
    { id: "fullname", label: "Full name", placeholder: "Enter your full name...", style: TextInputStyle.Short, required: true },
    { id: "age", label: "How old are you?", placeholder: "Enter your age...", style: TextInputStyle.Short, required: true },
    { id: "why", label: "Why do you want to join this team?", placeholder: "Explain your motivation...", style: TextInputStyle.Paragraph, required: true },
    { id: "skills", label: "Do you have skills? What are they?", placeholder: "Describe your skills...", style: TextInputStyle.Paragraph, required: true },
    { id: "experience", label: "Do you have experience?", placeholder: "Tell us about your experience...", style: TextInputStyle.Paragraph, required: true },
    { id: "availability", label: "How much time can you be online?", placeholder: "e.g., 2-3 hours per day", style: TextInputStyle.Short, required: true },
    { id: "device", label: "PC or Phone or Both?", placeholder: "PC / Phone / Both", style: TextInputStyle.Short, required: true }
];

const staffRolesArray = STAFF_ROLES ? STAFF_ROLES.split(',').map(r => r.trim()) : [];
const activeTickets = new Map();

// ============================================
// HELPER FUNCTIONS
// ============================================

async function sendLog(guild, channelId, embed) {
    if (!channelId) {
        console.log(`⚠️ Missing channel ID for log`);
        return;
    }
    const channel = guild.channels.cache.get(channelId);
    if (channel) {
        await channel.send({ embeds: [embed] }).catch(err => console.error(`Failed to send log:`, err.message));
    } else {
        console.log(`⚠️ Channel not found: ${channelId}`);
    }
}

async function generateTranscript(channel, ticketData) {
    try {
        const messages = await channel.messages.fetch({ limit: 200 });
        const sorted = Array.from(messages.values()).reverse();
        
        let transcript = `═══════════════════════════════════════════════════\n`;
        transcript += `                    🎫 TICKET TRANSCRIPT\n`;
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
    } catch (error) {
        console.error(`Error generating transcript: ${error.message}`);
        return null;
    }
}

function isStaff(member) {
    return staffRolesArray.some(roleId => member.roles.cache.has(roleId));
}

// ============================================
// PANEL CREATION
// ============================================

async function createTicketPanel(channel) {
    const embed = new EmbedBuilder()
        .setTitle("🌟 SUPPORT TICKET SYSTEM")
        .setDescription(
            `> **Welcome to our premium support hub**\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `**📌 HOW IT WORKS**\n` +
            `• Select a ticket type below\n` +
            `• A private channel will be created\n` +
            `• Our team will assist you ASAP\n` +
            `• Tickets are automatically logged\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `**⚡ BEFORE OPENING**\n` +
            `• Be respectful and patient\n` +
            `• Provide detailed information\n` +
            `• Do not create multiple tickets\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `**⏰ RESPONSE TIME**\n` +
            `• Average: 5-10 minutes\n` +
            `• Peak hours: 15-20 minutes\n` +
            `• 24/7 Support Available\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `*Click a button below to get started* 🚀`
        )
        .setColor(0x2b2d31)
        .setImage(BANNER_URL)
        .setFooter({ text: "Premium Support System • 24/7", iconURL: client.user.displayAvatarURL() })
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

async function createApplicationPanel(channel) {
    const embed = new EmbedBuilder()
        .setTitle("📋 STAFF APPLICATION SYSTEM")
        .setDescription(
            `> **Join our team and help shape the community!**\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `**📌 AVAILABLE POSITIONS**\n` +
            `• 🛠 **Staff Team** - Moderate and manage the server\n` +
            `• 🎨 **Designer** - Create graphics and visual content\n` +
            `• 🎉 **Event Hoster** - Organize fun community events\n` +
            `• 🤝 **Partnership** - Handle collaborations and partnerships\n` +
            `• 💻 **Developer** - Work on bots and coding projects\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `**📝 REQUIREMENTS**\n` +
            `• Be active and responsible\n` +
            `• Have good communication skills\n` +
            `• Follow server rules and guidelines\n` +
            `• Be at least 13 years old (Discord ToS)\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `**✅ HOW TO APPLY**\n` +
            `• Select a position from the dropdown below\n` +
            `• Fill out the application form\n` +
            `• Submit your application\n` +
            `• Staff will review and contact you\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `*Select a position to begin your application* 🚀`
        )
        .setColor(0x2b2d31)
        .setImage(BANNER_URL)
        .setFooter({ text: "Staff Application System • Reviewed within 48h", iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('apply_select')
        .setPlaceholder('🎯 Select a position to apply for...')
        .addOptions([
            new StringSelectMenuOptionBuilder()
                .setLabel('🛠 Staff Team')
                .setDescription('Apply for a staff position')
                .setEmoji('🛠')
                .setValue('staff'),
            new StringSelectMenuOptionBuilder()
                .setLabel('🎨 Designer')
                .setDescription('Apply as a designer')
                .setEmoji('🎨')
                .setValue('designer'),
            new StringSelectMenuOptionBuilder()
                .setLabel('🎉 Event Hoster')
                .setDescription('Apply as an event hoster')
                .setEmoji('🎉')
                .setValue('event'),
            new StringSelectMenuOptionBuilder()
                .setLabel('🤝 Partnership')
                .setDescription('Apply for partnerships')
                .setEmoji('🤝')
                .setValue('partnership'),
            new StringSelectMenuOptionBuilder()
                .setLabel('💻 Developer')
                .setDescription('Apply as a developer')
                .setEmoji('💻')
                .setValue('developer')
        ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);
    await channel.send({ embeds: [embed], components: [row] });
}

// ============================================
// APPLICATION SUBMISSION
// ============================================

async function sendApplicationForReview(guild, application) {
    const reviewChannel = guild.channels.cache.get(APP_REVIEW_CHANNEL_ID);
    if (!reviewChannel) {
        console.error(`❌ Review channel not found! ID: ${APP_REVIEW_CHANNEL_ID}`);
        return;
    }

    const position = APPLICATION_POSITIONS[application.position];
    
    const embed = new EmbedBuilder()
        .setTitle(`${position.emoji} NEW APPLICATION - ${position.name}`)
        .setDescription(
            `**Applicant:** ${application.userTag} (<@${application.userId}>)\n` +
            `**Position:** ${position.name}\n` +
            `**Applied:** <t:${Math.floor(application.timestamp / 1000)}:F>\n` +
            `**User ID:** \`${application.userId}\``
        )
        .setColor(position.color)
        .setThumbnail(application.userAvatar)
        .setImage(BANNER_URL)
        .setTimestamp();

    const questionLabels = {
        fullname: "Full name",
        age: "Age",
        why: "Why join this team?",
        skills: "Skills",
        experience: "Experience",
        availability: "Availability",
        device: "Device"
    };

    for (const [question, answer] of Object.entries(application.answers)) {
        const label = questionLabels[question] || question;
        embed.addFields({ 
            name: `📌 ${label}`, 
            value: answer.length > 1024 ? answer.substring(0, 1021) + '...' : answer || "Not provided", 
            inline: false 
        });
    }

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`app_approve_${application.userId}_${application.position}`)
                .setLabel('Approve')
                .setEmoji('✅')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`app_deny_${application.userId}_${application.position}`)
                .setLabel('Deny')
                .setEmoji('❌')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setLabel('View Profile')
                .setURL(`https://discord.com/users/${application.userId}`)
                .setStyle(ButtonStyle.Link)
        );

    await reviewChannel.send({ embeds: [embed], components: [buttons] });
}

// ============================================
// READY EVENT
// ============================================
client.once('ready', async () => {
    console.log(`✨ ${client.user.tag} is online!`);
    console.log(`📋 Ticket & Application Bot - Version 4.0`);
    
    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) {
        console.error("❌ Guild not found! Check GUILD_ID environment variable.");
        return;
    }

    // Setup ticket panel
    if (TICKET_PANEL_CHANNEL_ID) {
        const ticketPanelChannel = client.channels.cache.get(TICKET_PANEL_CHANNEL_ID);
        if (ticketPanelChannel) {
            const messages = await ticketPanelChannel.messages.fetch({ limit: 10 }).catch(() => []);
            if (messages.size) await ticketPanelChannel.bulkDelete(messages).catch(() => {});
            await createTicketPanel(ticketPanelChannel);
            console.log("✅ Ticket panel deployed!");
        } else {
            console.warn("⚠️ Ticket panel channel not found!");
        }
    }

    // Setup application panel
    if (APP_PANEL_CHANNEL_ID) {
        const appPanelChannel = client.channels.cache.get(APP_PANEL_CHANNEL_ID);
        if (appPanelChannel) {
            const messages = await appPanelChannel.messages.fetch({ limit: 10 }).catch(() => []);
            if (messages.size) await appPanelChannel.bulkDelete(messages).catch(() => {});
            await createApplicationPanel(appPanelChannel);
            console.log("✅ Application panel deployed!");
        } else {
            console.warn("⚠️ Application panel channel not found!");
        }
    }

    console.log(`\n🚀 Bot is ready!`);
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
        
        // Check for existing open ticket
        for (const [id, data] of activeTickets) {
            if (data.userId === interaction.user.id) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle("❌ TICKET LIMIT REACHED")
                    .setDescription(`> You already have an open ticket!\n> Please close your existing ticket before creating a new one.\n\n**Channel:** <#${id}>`)
                    .setColor(0xEF4444);
                return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
        
        await interaction.reply({ 
            embeds: [new EmbedBuilder().setDescription("🔄 `Creating your premium ticket...`").setColor(0x38BDF8)], 
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
                    `**👋 Welcome ${interaction.user}!**\n\n` +
                    `> **Ticket Type:** ${typeConfig.name}\n` +
                    `> **Category:** ${typeConfig.desc}\n` +
                    `> **Priority:** Normal\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `**📝 INSTRUCTIONS**\n` +
                    `• Please describe your issue in detail\n` +
                    `• Attach screenshots if possible\n` +
                    `• Our team will respond shortly\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `**🔒 TICKET CONTROLS**\n` +
                    `• Click **Close Ticket** to end this session\n` +
                    `• Click **Claim Ticket** to assign a staff member\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
                )
                .setColor(typeConfig.color)
                .setImage(BANNER_URL)
                .setFooter({ text: `Ticket ID: ${ticketChannel.id} | Support Team`, iconURL: interaction.guild.iconURL() })
                .setTimestamp();
            
            const actionRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('close_ticket')
                        .setLabel('CLOSE TICKET')
                        .setEmoji('🔒')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('claim_ticket')
                        .setLabel('CLAIM TICKET')
                        .setEmoji('🎫')
                        .setStyle(ButtonStyle.Secondary)
                );
            
            const mentionText = `${interaction.user} | ${staffRolesArray.map(id => `<@&${id}>`).join(', ')}`;
            await ticketChannel.send({ content: mentionText, embeds: [welcomeEmbed], components: [actionRow] });
            
            // Send log
            const logEmbed = new EmbedBuilder()
                .setTitle("🎫 TICKET OPENED")
                .setDescription(`**User:** ${interaction.user.tag}\n**Type:** ${typeConfig.name}\n**Channel:** ${ticketChannel}`)
                .setColor(0x22C55E)
                .setTimestamp();
            await sendLog(interaction.guild, TICKET_LOG_CHANNEL_ID, logEmbed);
            
            const successEmbed = new EmbedBuilder()
                .setTitle("✅ TICKET CREATED")
                .setDescription(`> Your ticket has been created!\n> **Channel:** ${ticketChannel}\n> Support team will assist you shortly.`)
                .setColor(0x22C55E);
            
            await interaction.editReply({ embeds: [successEmbed], ephemeral: true });
            
        } catch (err) {
            console.error(err);
            const errorEmbed = new EmbedBuilder()
                .setTitle("❌ ERROR")
                .setDescription("> Failed to create ticket. Please contact an administrator.")
                .setColor(0xEF4444);
            await interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
    
    // CLOSE TICKET - DELETE IMMEDIATELY WITHOUT MESSAGE
    else if (interaction.customId === 'close_ticket') {
        const ticketData = activeTickets.get(interaction.channel.id);
        if (!ticketData) {
            return interaction.reply({ content: "❌ This is not a valid ticket channel.", ephemeral: true });
        }
        
        // Acknowledge the interaction silently
        await interaction.deferReply({ ephemeral: true });
        
        // Generate transcript
        const transcriptPath = await generateTranscript(interaction.channel, ticketData);
        
        // Send transcript to log channel
        if (transcriptPath && TRANSCRIPT_CHANNEL_ID) {
            const transcriptChannel = interaction.guild.channels.cache.get(TRANSCRIPT_CHANNEL_ID);
            if (transcriptChannel) {
                const transcriptEmbed = new EmbedBuilder()
                    .setTitle("📄 TICKET TRANSCRIPT")
                    .setDescription(`**Channel:** ${interaction.channel.name}\n**Closed by:** ${interaction.user.tag}\n**Type:** ${ticketData.type || 'Unknown'}\n**Owner:** ${ticketData.userTag || 'Unknown'}`)
                    .setColor(0xF97316)
                    .setTimestamp();
                await transcriptChannel.send({ embeds: [transcriptEmbed], files: [transcriptPath] });
            }
        }
        
        // Send close log
        const logEmbed = new EmbedBuilder()
            .setTitle("🔒 TICKET CLOSED")
            .setDescription(`**User:** ${ticketData.userTag}\n**Closed by:** ${interaction.user.tag}\n**Channel:** #${interaction.channel.name}`)
            .setColor(0xEF4444)
            .setTimestamp();
        await sendLog(interaction.guild, TICKET_LOG_CHANNEL_ID, logEmbed);
        
        // Delete the channel immediately
        try {
            await interaction.channel.delete();
            activeTickets.delete(interaction.channel.id);
            if (transcriptPath) fs.unlinkSync(transcriptPath);
        } catch (err) {
            console.error(err);
        }
    }
    
    // CLAIM TICKET
    else if (interaction.customId === 'claim_ticket') {
        const ticketData = activeTickets.get(interaction.channel.id);
        if (!ticketData) {
            return interaction.reply({ content: "❌ This is not a valid ticket channel.", ephemeral: true });
        }
        
        if (!isStaff(interaction.member)) {
            return interaction.reply({ 
                embeds: [new EmbedBuilder().setDescription("❌ Only staff members can claim tickets.").setColor(0xEF4444)], 
                ephemeral: true 
            });
        }
        
        if (ticketData.claimedBy) {
            return interaction.reply({ 
                embeds: [new EmbedBuilder().setDescription(`❌ This ticket has already been claimed by <@${ticketData.claimedBy}>.`).setColor(0xEF4444)], 
                ephemeral: true 
            });
        }
        
        ticketData.claimedBy = interaction.user.id;
        ticketData.claimedAt = Date.now();
        activeTickets.set(interaction.channel.id, ticketData);
        
        const claimEmbed = new EmbedBuilder()
            .setTitle("🎫 TICKET CLAIMED")
            .setDescription(`> **${interaction.user}** has claimed this ticket and will assist you shortly.`)
            .setColor(0x22C55E)
            .setTimestamp();
        
        await interaction.reply({ embeds: [claimEmbed] });
        
        const logEmbed = new EmbedBuilder()
            .setTitle("🎫 TICKET CLAIMED")
            .setDescription(`**Channel:** #${interaction.channel.name}\n**Staff:** ${interaction.user.tag}\n**Ticket Owner:** ${ticketData.userTag}`)
            .setColor(0x3B82F6)
            .setTimestamp();
        await sendLog(interaction.guild, TICKET_LOG_CHANNEL_ID, logEmbed);
    }
});

// ============================================
// APPLICATION SYSTEM - DROPDOWN HANDLER (FIXED)
// ============================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== 'apply_select') return;
    
    const selectedPosition = interaction.values[0];
    const positionConfig = APPLICATION_POSITIONS[selectedPosition];
    
    if (!positionConfig) {
        console.error(`Unknown position: ${selectedPosition}`);
        return interaction.reply({ content: "❌ An error occurred. Please try again.", ephemeral: true });
    }
    
    // Create modal
    const modal = new ModalBuilder()
        .setCustomId(`apply_modal_${selectedPosition}`)
        .setTitle(`${positionConfig.emoji} ${positionConfig.name} Application`);
    
    // Add all questions
    const rows = [];
    for (const question of APPLICATION_QUESTIONS) {
        const input = new TextInputBuilder()
            .setCustomId(question.id)
            .setLabel(question.label)
            .setStyle(question.style)
            .setRequired(question.required)
            .setPlaceholder(question.placeholder)
            .setMaxLength(question.style === TextInputStyle.Paragraph ? 1500 : 100);
        
        const row = new ActionRowBuilder().addComponents(input);
        rows.push(row);
    }
    
    modal.addComponents(rows);
    
    try {
        await interaction.showModal(modal);
    } catch (error) {
        console.error(`Error showing modal: ${error.message}`);
        await interaction.reply({ content: "❌ Failed to open application form. Please try again.", ephemeral: true });
    }
});

// ============================================
// APPLICATION SYSTEM - MODAL SUBMIT HANDLER
// ============================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isModalSubmit()) return;
    if (!interaction.customId.startsWith('apply_modal_')) return;
    
    const position = interaction.customId.replace('apply_modal_', '');
    const positionConfig = APPLICATION_POSITIONS[position];
    
    if (!positionConfig) {
        console.error(`Unknown position from modal: ${position}`);
        return interaction.reply({ content: "❌ An error occurred. Please try again.", ephemeral: true });
    }
    
    // Collect answers
    const answers = {};
    for (const question of APPLICATION_QUESTIONS) {
        try {
            answers[question.id] = interaction.fields.getTextInputValue(question.id);
        } catch (error) {
            answers[question.id] = "Not provided";
        }
    }
    
    const application = {
        position: position,
        userId: interaction.user.id,
        userTag: interaction.user.tag,
        userAvatar: interaction.user.displayAvatarURL(),
        timestamp: Date.now(),
        answers: answers
    };
    
    try {
        // Send to review channel
        await sendApplicationForReview(interaction.guild, application);
        
        const successEmbed = new EmbedBuilder()
            .setTitle("✅ APPLICATION SUBMITTED")
            .setDescription(
                `> Your application for **${positionConfig.name}** has been submitted!\n\n` +
                `**What happens next?**\n` +
                `• Our team will review your application within 48 hours\n` +
                `• You will be contacted via DM if you're selected\n` +
                `• Please be patient and do not DM staff about your application\n\n` +
                `Thank you for your interest in joining our team! 🎉`
            )
            .setColor(0x22C55E)
            .setImage(BANNER_URL)
            .setTimestamp();
        
        await interaction.reply({ embeds: [successEmbed], ephemeral: true });
        
        // Send DM confirmation
        try {
            const dmEmbed = new EmbedBuilder()
                .setTitle("📋 Application Received")
                .setDescription(
                    `Thank you for applying for **${positionConfig.name}**!\n\n` +
                    `**Application Details:**\n` +
                    `• Position: ${positionConfig.name}\n` +
                    `• Submitted: <t:${Math.floor(Date.now() / 1000)}:F>\n\n` +
                    `Your application is now under review. You will receive a response within 48 hours.\n\n` +
                    `Good luck! 🍀`
                )
                .setColor(positionConfig.color)
                .setTimestamp();
            await interaction.user.send({ embeds: [dmEmbed] });
        } catch (e) {
            console.log(`Could not DM ${interaction.user.tag}`);
        }
        
    } catch (error) {
        console.error(`Error submitting application: ${error.message}`);
        await interaction.reply({ content: "❌ Failed to submit application. Please try again later.", ephemeral: true });
    }
});

// ============================================
// APPLICATION REVIEW - APPROVE BUTTON
// ============================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('app_approve_')) return;
    
    if (!isStaff(interaction.member)) {
        return interaction.reply({ 
            embeds: [new EmbedBuilder().setDescription("❌ Only staff members can review applications.").setColor(0xEF4444)], 
            ephemeral: true 
        });
    }
    
    const parts = interaction.customId.split('_');
    const userId = parts[2];
    const position = parts[3];
    const positionConfig = APPLICATION_POSITIONS[position];
    
    if (!positionConfig) {
        return interaction.reply({ content: "❌ Invalid position.", ephemeral: true });
    }
    
    const guild = interaction.guild;
    const member = await guild.members.fetch(userId).catch(() => null);
    
    // Accepted Embed for Log Channel
    const acceptLogEmbed = new EmbedBuilder()
        .setTitle("✅ APPLICATION APPROVED")
        .setDescription(
            `**Applicant:** ${member?.user?.tag || userId}\n` +
            `**Position:** ${positionConfig.name}\n` +
            `**Reviewed by:** ${interaction.user.tag}\n` +
            `**Date:** <t:${Math.floor(Date.now() / 1000)}:F>`
        )
        .setColor(0x22C55E)
        .setThumbnail(member?.user?.displayAvatarURL() || null)
        .setTimestamp()
        .setFooter({ text: "Application approved" });
    
    await sendLog(guild, APP_ACCEPTED_CHANNEL_ID, acceptLogEmbed);
    
    // DM to user
    try {
        const acceptDMEmbed = new EmbedBuilder()
            .setTitle("✅ Application Approved!")
            .setDescription(
                `**Congratulations ${member?.user?.username || 'Applicant'}!**\n\n` +
                `Your application for **${positionConfig.name}** has been **approved**!\n\n` +
                `**Next Steps:**\n` +
                `• A staff member will reach out to you shortly\n` +
                `• Please check your DMs for further instructions\n` +
                `• Welcome to the team! 🎉`
            )
            .setColor(0x22C55E)
            .setTimestamp();
        await member?.send({ embeds: [acceptDMEmbed] });
    } catch (e) {
        console.log(`Could not DM ${userId}`);
    }
    
    await interaction.reply({ 
        embeds: [new EmbedBuilder()
            .setTitle("✅ Application Approved")
            .setDescription(`Successfully approved **${member?.user?.tag || userId}** for **${positionConfig.name}**.`)
            .setColor(0x22C55E)
        ], 
        ephemeral: false 
    });
    
    // Disable buttons
    const row = ActionRowBuilder.from(interaction.message.components[0]);
    row.components.forEach(component => component.setDisabled(true));
    await interaction.message.edit({ components: [row] }).catch(() => {});
});

// ============================================
// APPLICATION REVIEW - DENY BUTTON WITH MODAL
// ============================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('app_deny_')) return;
    
    if (!isStaff(interaction.member)) {
        return interaction.reply({ 
            embeds: [new EmbedBuilder().setDescription("❌ Only staff members can review applications.").setColor(0xEF4444)], 
            ephemeral: true 
        });
    }
    
    const parts = interaction.customId.split('_');
    const userId = parts[2];
    const position = parts[3];
    
    // Create modal for rejection reason
    const modal = new ModalBuilder()
        .setCustomId(`reject_modal_${userId}_${position}`)
        .setTitle("Deny Application");
    
    const reasonInput = new TextInputBuilder()
        .setCustomId('reason')
        .setLabel("Rejection Reason")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setPlaceholder("e.g., Not enough experience, application too short...")
        .setMaxLength(1000);
    
    const row = new ActionRowBuilder().addComponents(reasonInput);
    modal.addComponents(row);
    
    // Store message for later disabling
    client.denyMessageMap = client.denyMessageMap || new Map();
    client.denyMessageMap.set(`${userId}_${position}`, interaction.message);
    
    await interaction.showModal(modal);
});

// ============================================
// REJECT MODAL SUBMIT HANDLER
// ============================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isModalSubmit()) return;
    if (!interaction.customId.startsWith('reject_modal_')) return;
    
    const parts = interaction.customId.replace('reject_modal_', '').split('_');
    const userId = parts[0];
    const position = parts[1];
    const reason = interaction.fields.getTextInputValue('reason');
    
    const positionConfig = APPLICATION_POSITIONS[position];
    if (!positionConfig) {
        return interaction.reply({ content: "❌ Invalid position.", ephemeral: true });
    }
    
    const guild = interaction.guild;
    const member = await guild.members.fetch(userId).catch(() => null);
    
    // Rejected Embed for Log Channel
    const rejectLogEmbed = new EmbedBuilder()
        .setTitle("❌ APPLICATION DENIED")
        .setDescription(
            `**Applicant:** ${member?.user?.tag || userId}\n` +
            `**Position:** ${positionConfig.name}\n` +
            `**Reviewed by:** ${interaction.user.tag}\n` +
            `**Date:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n` +
            `**Reason:**\n> ${reason}`
        )
        .setColor(0xEF4444)
        .setThumbnail(member?.user?.displayAvatarURL() || null)
        .setTimestamp()
        .setFooter({ text: "Application denied" });
    
    await sendLog(guild, APP_REJECTED_CHANNEL_ID, rejectLogEmbed);
    
    // DM to user with reason
    try {
        const rejectDMEmbed = new EmbedBuilder()
            .setTitle("❌ Application Denied")
            .setDescription(
                `**Hello ${member?.user?.username || 'Applicant'}**,\n\n` +
                `Thank you for applying for **${positionConfig.name}**.\n\n` +
                `Unfortunately, your application has been **denied** at this time.\n\n` +
                `**Reason:**\n> ${reason}\n\n` +
                `You may reapply in **30 days**. Thank you for your interest!`
            )
            .setColor(0xEF4444)
            .setTimestamp();
        await member?.send({ embeds: [rejectDMEmbed] });
    } catch (e) {
        console.log(`Could not DM ${userId}`);
    }
    
    await interaction.reply({ 
        embeds: [new EmbedBuilder()
            .setTitle("❌ Application Denied")
            .setDescription(`Denied **${member?.user?.tag || userId}** for **${positionConfig.name}**.\n\n**Reason:** ${reason}`)
            .setColor(0xEF4444)
        ], 
        ephemeral: false 
    });
    
    // Disable buttons on original message
    const originalMessage = client.denyMessageMap?.get(`${userId}_${position}`);
    if (originalMessage) {
        const row = ActionRowBuilder.from(originalMessage.components[0]);
        row.components.forEach(component => component.setDisabled(true));
        await originalMessage.edit({ components: [row] }).catch(() => {});
        client.denyMessageMap.delete(`${userId}_${position}`);
    }
});

// ============================================
// ERROR HANDLING
// ============================================
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception:', error);
});

// ============================================
// LOGIN
// ============================================
client.login(BOT_TOKEN);
