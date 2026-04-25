const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');

// ============================================
// ENVIRONMENT VARIABLES
// ============================================
const {
    BOT_TOKEN,
    GUILD_ID,
    TICKET_LOG_CHANNEL_ID,
    APPLICATION_LOG_CHANNEL_ID,
    TRANSCRIPT_CHANNEL_ID,
    TICKET_CATEGORY_ID,
    TICKET_PANEL_CHANNEL_ID,
    APP_PANEL_CHANNEL_ID,
    STAFF_ROLES,
    STAFF_ROLE_ID,
    BANNER_URL = "https://media.discordapp.net/attachments/1480969775344652470/1496647110525845625/DF7E4FDA-66D3-49FF-BD5E-7C746253AE2D.png"
} = process.env;

// ============================================
// CLIENT INITIALIZATION
// ============================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel, Partials.Message]
});

// ============================================
// CONFIGURATION
// ============================================
const TICKET_TYPES = {
    pub: { name: "Public Lounge", emoji: "🍻", color: "#38BDF8", desc: "General discussions & community chats" },
    bugs: { name: "Bug Report", emoji: "🐛", color: "#EF4444", desc: "Report technical issues or glitches" },
    abuse: { name: "Abuse Report", emoji: "⚠️", color: "#F97316", desc: "Report rule violations or harassment" },
    server: { name: "Server Support", emoji: "⚙️", color: "#8B5CF6", desc: "Technical support & server inquiries" }
};

const APPLICATION_POSITIONS = {
    staff: { name: "🛠 Staff Team", emoji: "🛠", color: "#5865F2", description: "Help moderate and manage the community" },
    designer: { name: "🎨 Designer", emoji: "🎨", color: "#EB459E", description: "Create graphics and visual content" },
    event: { name: "🎉 Event Hoster", emoji: "🎉", color: "#FEE75C", description: "Organize fun community events" },
    partnership: { name: "🤝 Partnership", emoji: "🤝", color: "#57F287", description: "Handle collaborations and partnerships" },
    developer: { name: "💻 Developer", emoji: "💻", color: "#17A2B8", description: "Work on bots and coding projects" }
};

const staffRolesArray = STAFF_ROLES ? STAFF_ROLES.split(',').map(r => r.trim()) : [];
const activeTickets = new Map();

// ============================================
// LOGGING FUNCTIONS (SEPARATED)
// ============================================

// Send ticket log (uses TICKET_LOG_CHANNEL_ID)
async function sendTicketLog(guild, title, description, color = 0x2b2d31, fields = []) {
    const logChannel = guild.channels.cache.get(TICKET_LOG_CHANNEL_ID);
    if (!logChannel) {
        console.error(`❌ Ticket log channel not found! ID: ${TICKET_LOG_CHANNEL_ID}`);
        return;
    }
    
    const embed = new EmbedBuilder()
        .setTitle(`🎫 ${title}`)
        .setDescription(`\`\`\`yaml\n${description}\n\`\`\``)
        .setColor(color)
        .setTimestamp()
        .setFooter({ text: "Ticket System • Logged" });
    
    if (fields.length) embed.addFields(fields);
    
    await logChannel.send({ embeds: [embed] });
}

// Send application log (uses APPLICATION_LOG_CHANNEL_ID)
async function sendApplicationLog(guild, title, description, color = 0x2b2d31, fields = []) {
    const logChannel = guild.channels.cache.get(APPLICATION_LOG_CHANNEL_ID);
    if (!logChannel) {
        console.error(`❌ Application log channel not found! ID: ${APPLICATION_LOG_CHANNEL_ID}`);
        return;
    }
    
    const embed = new EmbedBuilder()
        .setTitle(`📋 ${title}`)
        .setDescription(`\`\`\`yaml\n${description}\n\`\`\``)
        .setColor(color)
        .setTimestamp()
        .setFooter({ text: "Application System • Logged" });
    
    if (fields.length) embed.addFields(fields);
    
    await logChannel.send({ embeds: [embed] });
}

// Generate ticket transcript
async function generateTranscript(channel) {
    const messages = await channel.messages.fetch({ limit: 200 });
    const sorted = Array.from(messages.values()).reverse();
    
    let transcript = `═══════════════════════════════════════════════════\n`;
    transcript += `                    🎫 TICKET TRANSCRIPT\n`;
    transcript += `═══════════════════════════════════════════════════\n\n`;
    transcript += `📋 Channel: ${channel.name}\n`;
    transcript += `📅 Created: ${channel.createdAt.toLocaleString()}\n`;
    transcript += `👤 Owner: ${channel.topic || "Unknown"}\n`;
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

// Check if user is staff
function isStaff(member) {
    return staffRolesArray.some(roleId => member.roles.cache.has(roleId));
}

// ============================================
// PANEL CREATION
// ============================================

// Create ticket panel
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

// Create application panel
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
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('Staff Team')
                .setDescription('Apply for a staff position')
                .setEmoji('🛠')
                .setValue('staff'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Designer')
                .setDescription('Apply as a designer')
                .setEmoji('🎨')
                .setValue('designer'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Event Hoster')
                .setDescription('Apply as an event hoster')
                .setEmoji('🎉')
                .setValue('event'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Partnership')
                .setDescription('Apply for partnerships')
                .setEmoji('🤝')
                .setValue('partnership'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Developer')
                .setDescription('Apply as a developer')
                .setEmoji('💻')
                .setValue('developer')
        );

    const row = new ActionRowBuilder().addComponents(selectMenu);
    await channel.send({ embeds: [embed], components: [row] });
}

// ============================================
// APPLICATION SUBMISSION
// ============================================

async function sendApplicationForReview(guild, application) {
    const reviewChannel = guild.channels.cache.get(APPLICATION_LOG_CHANNEL_ID);
    if (!reviewChannel) {
        console.error(`❌ Application log channel not found for review! ID: ${APPLICATION_LOG_CHANNEL_ID}`);
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

    // Add all answers
    for (const [question, answer] of Object.entries(application.answers)) {
        const formattedQuestion = question.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        embed.addFields({ 
            name: `📌 ${formattedQuestion}`, 
            value: answer.length > 1024 ? answer.substring(0, 1021) + '...' : answer || 'Not provided', 
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
// EVENT HANDLERS
// ============================================

client.once('ready', async () => {
    console.log(`✨ ${client.user.tag} is now online!`);
    console.log(`📁 Logged in and ready to serve!`);
    
    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) {
        console.error("❌ Guild not found! Check GUILD_ID environment variable.");
        return;
    }

    // Validate log channels
    if (!TICKET_LOG_CHANNEL_ID) console.warn("⚠️ TICKET_LOG_CHANNEL_ID not set!");
    if (!APPLICATION_LOG_CHANNEL_ID) console.warn("⚠️ APPLICATION_LOG_CHANNEL_ID not set!");
    
    // Setup ticket panel
    const ticketPanelChannel = client.channels.cache.get(TICKET_PANEL_CHANNEL_ID);
    if (ticketPanelChannel) {
        const messages = await ticketPanelChannel.messages.fetch({ limit: 10 });
        await ticketPanelChannel.bulkDelete(messages);
        await createTicketPanel(ticketPanelChannel);
        console.log("✅ Ticket panel deployed!");
    } else {
        console.warn("⚠️ Ticket panel channel not found!");
    }

    // Setup application panel
    const appPanelChannel = client.channels.cache.get(APP_PANEL_CHANNEL_ID);
    if (appPanelChannel) {
        const messages = await appPanelChannel.messages.fetch({ limit: 10 });
        await appPanelChannel.bulkDelete(messages);
        await createApplicationPanel(appPanelChannel);
        console.log("✅ Application panel deployed!");
    } else {
        console.warn("⚠️ Application panel channel not found!");
    }
});

// Ticket System - Button Handler
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    
    // ========== OPEN TICKET ==========
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
            
            // Send to TICKET log channel
            await sendTicketLog(interaction.guild, "TICKET OPENED", `User: ${interaction.user.tag}\nType: ${typeConfig.name}\nChannel: #${ticketChannel.name}`, 0x22C55E);
            
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
    
    // ========== CLOSE TICKET ==========
    else if (interaction.customId === 'close_ticket') {
        const ticketData = activeTickets.get(interaction.channel.id);
        if (!ticketData) {
            return interaction.reply({ content: "❌ This is not a valid ticket channel.", ephemeral: true });
        }
        
        const closeEmbed = new EmbedBuilder()
            .setTitle("🔒 CLOSING TICKET")
            .setDescription("> This ticket will be closed in **5 seconds**...\n> A transcript has been saved to the logs.")
            .setColor(0xEF4444);
        
        await interaction.reply({ embeds: [closeEmbed] });
        
        const transcriptPath = await generateTranscript(interaction.channel);
        const transcriptChannel = interaction.guild.channels.cache.get(TRANSCRIPT_CHANNEL_ID || TICKET_LOG_CHANNEL_ID);
        
        if (transcriptChannel) {
            const transcriptEmbed = new EmbedBuilder()
                .setTitle("📄 TICKET TRANSCRIPT")
                .setDescription(`**Channel:** ${interaction.channel.name}\n**Closed by:** ${interaction.user.tag}\n**Ticket Type:** ${ticketData.type || 'Unknown'}\n**Owner:** ${ticketData.userTag || 'Unknown'}`)
                .setColor(0xF97316)
                .setTimestamp();
            
            await transcriptChannel.send({ embeds: [transcriptEmbed], files: [transcriptPath] });
        }
        
        // Send to TICKET log channel
        await sendTicketLog(interaction.guild, "TICKET CLOSED", `User: ${ticketData.userTag}\nClosed by: ${interaction.user.tag}\nChannel: #${interaction.channel.name}`, 0xEF4444);
        
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
    
    // ========== CLAIM TICKET ==========
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
            .setDescription(`> **${interaction.user}** has claimed this ticket and will assist you shortly.\n> Please provide any additional information if needed.`)
            .setColor(0x22C55E)
            .setTimestamp();
        
        await interaction.reply({ embeds: [claimEmbed] });
        
        // Send to TICKET log channel
        await sendTicketLog(interaction.guild, "TICKET CLAIMED", `Channel: #${interaction.channel.name}\nStaff: ${interaction.user.tag}\nTicket Owner: ${ticketData.userTag}`, 0x3B82F6);
    }
});

// Application System - Dropdown Handler
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== 'apply_select') return;
    
    const selectedPosition = interaction.values[0];
    const positionConfig = APPLICATION_POSITIONS[selectedPosition];
    
    if (!positionConfig) return;
    
    // Create modal
    const modal = new ModalBuilder()
        .setCustomId(`apply_modal_${selectedPosition}`)
        .setTitle(`${positionConfig.emoji} ${positionConfig.name} Application`);
    
    // Common questions
    const ageInput = new TextInputBuilder()
        .setCustomId('age')
        .setLabel('How old are you?')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('Enter your age...')
        .setMaxLength(3);
    
    const timezoneInput = new TextInputBuilder()
        .setCustomId('timezone')
        .setLabel('Your timezone and availability')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('e.g., EST, available 4-10 PM');
    
    const experienceInput = new TextInputBuilder()
        .setCustomId('experience')
        .setLabel('Relevant experience for this role')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setPlaceholder('Describe your experience...')
        .setMaxLength(1500);
    
    const whyInput = new TextInputBuilder()
        .setCustomId('why')
        .setLabel('Why do you want this position?')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setPlaceholder('Explain why you are interested...')
        .setMaxLength(1500);
    
    const firstRow = new ActionRowBuilder().addComponents(ageInput);
    const secondRow = new ActionRowBuilder().addComponents(timezoneInput);
    const thirdRow = new ActionRowBuilder().addComponents(experienceInput);
    const fourthRow = new ActionRowBuilder().addComponents(whyInput);
    
    modal.addComponents(firstRow, secondRow, thirdRow, fourthRow);
    
    // Add position-specific questions
    if (selectedPosition === 'designer') {
        const portfolioInput = new TextInputBuilder()
            .setCustomId('portfolio')
            .setLabel('Portfolio or previous work')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setPlaceholder('Provide links to your designs or attach examples...')
            .setMaxLength(1000);
        const fifthRow = new ActionRowBuilder().addComponents(portfolioInput);
        modal.addComponents(fifthRow);
    } else if (selectedPosition === 'developer') {
        const skillsInput = new TextInputBuilder()
            .setCustomId('skills')
            .setLabel('Programming languages & skills')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setPlaceholder('List your coding languages, frameworks, and projects...')
            .setMaxLength(1000);
        const fifthRow = new ActionRowBuilder().addComponents(skillsInput);
        modal.addComponents(fifthRow);
    } else if (selectedPosition === 'event') {
        const ideasInput = new TextInputBuilder()
            .setCustomId('ideas')
            .setLabel('Event ideas you would host')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setPlaceholder('Describe the types of events you would organize...')
            .setMaxLength(1000);
        const fifthRow = new ActionRowBuilder().addComponents(ideasInput);
        modal.addComponents(fifthRow);
    } else if (selectedPosition === 'partnership') {
        const networkInput = new TextInputBuilder()
            .setCustomId('network')
            .setLabel('Partnerships or network connections')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setPlaceholder('List any relevant connections or experience...')
            .setMaxLength(1000);
        const fifthRow = new ActionRowBuilder().addComponents(networkInput);
        modal.addComponents(fifthRow);
    } else if (selectedPosition === 'staff') {
        const strengthsInput = new TextInputBuilder()
            .setCustomId('strengths')
            .setLabel('What are your strengths?')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setPlaceholder('Why would you be a good staff member?')
            .setMaxLength(1000);
        const fifthRow = new ActionRowBuilder().addComponents(strengthsInput);
        modal.addComponents(fifthRow);
    }
    
    await interaction.showModal(modal);
});

// Application System - Modal Submit Handler
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isModalSubmit()) return;
    if (!interaction.customId.startsWith('apply_modal_')) return;
    
    const position = interaction.customId.replace('apply_modal_', '');
    const positionConfig = APPLICATION_POSITIONS[position];
    
    if (!positionConfig) return;
    
    // Collect all answers
    const answers = {
        age: interaction.fields.getTextInputValue('age'),
        timezone: interaction.fields.getTextInputValue('timezone'),
        experience: interaction.fields.getTextInputValue('experience'),
        why: interaction.fields.getTextInputValue('why')
    };
    
    // Add position-specific answers
    if (position === 'designer') {
        answers.portfolio = interaction.fields.getTextInputValue('portfolio');
    } else if (position === 'developer') {
        answers.skills = interaction.fields.getTextInputValue('skills');
    } else if (position === 'event') {
        answers.ideas = interaction.fields.getTextInputValue('ideas');
    } else if (position === 'partnership') {
        const network = interaction.fields.getTextInputValue('network');
        if (network) answers.network = network;
    } else if (position === 'staff') {
        answers.strengths = interaction.fields.getTextInputValue('strengths');
    }
    
    const application = {
        position: position,
        userId: interaction.user.id,
        userTag: interaction.user.tag,
        userAvatar: interaction.user.displayAvatarURL(),
        timestamp: Date.now(),
        answers: answers
    };
    
    // Send to review channel (APPLICATION_LOG_CHANNEL_ID)
    await sendApplicationForReview(interaction.guild, application);
    
    // Send to APPLICATION log channel as log entry
    await sendApplicationLog(interaction.guild, "APPLICATION SUBMITTED", `User: ${interaction.user.tag}\nPosition: ${positionConfig.name}\nUser ID: ${interaction.user.id}`, positionConfig.color);
    
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
});

// Application Review - Approve/Deny Buttons
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('app_approve_') && !interaction.customId.startsWith('app_deny_')) return;
    
    // Check staff permission
    if (!isStaff(interaction.member)) {
        return interaction.reply({ 
            embeds: [new EmbedBuilder().setDescription("❌ Only staff members can review applications.").setColor(0xEF4444)], 
            ephemeral: true 
        });
    }
    
    const [_, action, userId, position] = interaction.customId.split('_');
    const positionConfig = APPLICATION_POSITIONS[position];
    
    if (!positionConfig) return;
    
    const guild = interaction.guild;
    const member = await guild.members.fetch(userId).catch(() => null);
    
    if (action === 'approve') {
        const approveEmbed = new EmbedBuilder()
            .setTitle("✅ APPLICATION APPROVED")
            .setDescription(
                `> Congratulations! Your application for **${positionConfig.name}** has been approved!\n\n` +
                `**Next Steps:**\n` +
                `• A staff member will reach out to you shortly\n` +
                `• Please check your DMs for further instructions\n` +
                `• Welcome to the team! 🎉`
            )
            .setColor(0x22C55E)
            .setTimestamp();
        
        await interaction.reply({ 
            embeds: [new EmbedBuilder()
                .setTitle("✅ Application Approved")
                .setDescription(`Successfully approved **${member?.user?.tag || userId}** for **${positionConfig.name}**.`)
                .setColor(0x22C55E)
            ], 
            ephemeral: false 
        });
        
        try {
            if (member) await member.send({ embeds: [approveEmbed] });
        } catch (e) {}
        
        // Send to APPLICATION log channel
        await sendApplicationLog(guild, "APPLICATION APPROVED", `User: ${member?.user?.tag || userId}\nPosition: ${positionConfig.name}\nReviewed by: ${interaction.user.tag}`, 0x22C55E);
        
    } else if (action === 'deny') {
        const denyEmbed = new EmbedBuilder()
            .setTitle("❌ APPLICATION DENIED")
            .setDescription(
                `> Thank you for applying for **${positionConfig.name}**.\n\n` +
                `Unfortunately, your application has been **denied** at this time.\n\n` +
                `**Reasons may include:**\n` +
                `• Not meeting the requirements\n` +
                `• Limited availability\n` +
                `• Better suited candidates\n\n` +
                `You may reapply in **30 days**. Thank you for your interest!`
            )
            .setColor(0xEF4444)
            .setTimestamp();
        
        await interaction.reply({ 
            embeds: [new EmbedBuilder()
                .setTitle("❌ Application Denied")
                .setDescription(`Denied **${member?.user?.tag || userId}** for **${positionConfig.name}**.`)
                .setColor(0xEF4444)
            ], 
            ephemeral: false 
        });
        
        try {
            if (member) await member.send({ embeds: [denyEmbed] });
        } catch (e) {}
        
        // Send to APPLICATION log channel
        await sendApplicationLog(guild, "APPLICATION DENIED", `User: ${member?.user?.tag || userId}\nPosition: ${positionConfig.name}\nReviewed by: ${interaction.user.tag}`, 0xEF4444);
    }
    
    // Disable buttons after review
    const row = ActionRowBuilder.from(interaction.message.components[0]);
    row.components.forEach(component => component.setDisabled(true));
    await interaction.message.edit({ components: [row] });
});

// ============================================
// ERROR HANDLING
// ============================================
process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) {
    console.error('Uncaught exception:', error);
});

// ============================================
// LOGIN
// ============================================
client.login(BOT_TOKEN);
