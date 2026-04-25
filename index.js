// index.js
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');

// Environment variables
const {
    BOT_TOKEN,
    GUILD_ID,
    LOG_CHANNEL_ID,
    TRANSCRIPT_CHANNEL_ID,
    TICKET_CATEGORY_ID,
    TICKET_PANEL_CHANNEL_ID,
    APP_PANEL_CHANNEL_ID,
    STAFF_ROLES,
    STAFF_ROLE_ID,
    DESIGNER_ROLE_ID,
    EVENT_HOSTER_ROLE_ID,
    PARTNERSHIP_ROLE_ID,
    DEVELOPER_ROLE_ID,
    BANNER_URL = "https://media.discordapp.net/attachments/1480969775344652470/1496647110525845625/DF7E4FDA-66D3-49FF-BD5E-7C746253AE2D.png"
} = process.env;

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

// Premium ticket types
const TICKET_TYPES = {
    pub: { name: "Public Lounge", emoji: "🍻", color: "#38BDF8", desc: "General discussions & community chats" },
    bugs: { name: "Bug Report", emoji: "🐛", color: "#EF4444", desc: "Report technical issues or glitches" },
    abuse: { name: "Abuse Report", emoji: "⚠️", color: "#F97316", desc: "Report rule violations or harassment" },
    server: { name: "Server Support", emoji: "⚙️", color: "#8B5CF6", desc: "Technical support & server inquiries" }
};

// Application roles
const APP_ROLES = {
    staff: { name: "🛠 Staff Team", emoji: "🛠", roleId: STAFF_ROLE_ID, color: "#5865F2" },
    designer: { name: "🎨 Designer", emoji: "🎨", roleId: DESIGNER_ROLE_ID, color: "#EB459E" },
    event: { name: "🎉 Event Hoster", emoji: "🎉", roleId: EVENT_HOSTER_ROLE_ID, color: "#FEE75C" },
    partnership: { name: "🤝 Partnership", emoji: "🤝", roleId: PARTNERSHIP_ROLE_ID, color: "#57F287" },
    developer: { name: "💻 Developer", emoji: "💻", roleId: DEVELOPER_ROLE_ID, color: "#17A2B8" }
};

const staffRolesArray = STAFF_ROLES ? STAFF_ROLES.split(',') : [];
const activeTickets = new Map();
const pendingApplications = new Map();

// Generate transcript
async function generateTranscript(channel) {
    const messages = await channel.messages.fetch({ limit: 100 });
    const sorted = Array.from(messages.values()).reverse();
    
    let transcript = `═══════════════════════════════════\n`;
    transcript += `🎫 TICKET TRANSCRIPT\n`;
    transcript += `═══════════════════════════════════\n\n`;
    transcript += `📋 Channel: ${channel.name}\n`;
    transcript += `📅 Created: ${channel.createdAt.toLocaleString()}\n`;
    transcript += `👤 Created by: ${channel.topic || "Unknown"}\n`;
    transcript += `───────────────────────────────────\n\n`;
    
    for (const msg of sorted) {
        transcript += `[${msg.createdAt.toLocaleString()}] ${msg.author.tag}:\n`;
        transcript += `${msg.content || '(Embed / Attachment)'}\n`;
        transcript += `───────────────────────────────────\n`;
    }
    
    const filePath = `/tmp/transcript-${channel.id}-${Date.now()}.txt`;
    fs.writeFileSync(filePath, transcript);
    return filePath;
}

// Premium log embed
async function log(guild, title, description, color = 0x2b2d31, footer = null) {
    const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
    if (!logChannel) return;
    
    const embed = new EmbedBuilder()
        .setTitle(`📋 ${title}`)
        .setDescription(`\`\`\`yml\n${description}\n\`\`\``)
        .setColor(color)
        .setTimestamp()
        .setFooter({ text: footer || "Premium System" });
    
    await logChannel.send({ embeds: [embed] });
}

// Create ticket panel
async function createTicketPanel(channel) {
    const embed = new EmbedBuilder()
        .setTitle("🌟 SUPPORT TICKET SYSTEM")
        .setDescription(
            `> **Welcome to our premium support hub**\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `**📌 HOW IT WORKS**\n` +
            `• Select a ticket type below\n` +
            `• A private channel will be created\n` +
            `• Our team will assist you ASAP\n` +
            `• Tickets are automatically logged\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `**⚡ BEFORE OPENING**\n` +
            `• Be respectful and patient\n` +
            `• Provide detailed information\n` +
            `• Do not create multiple tickets\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `**⏰ RESPONSE TIME**\n` +
            `• Average: 5-10 minutes\n` +
            `• Peak hours: 15-20 minutes\n` +
            `• 24/7 Support Available\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
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
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `**📌 AVAILABLE POSITIONS**\n` +
            `• 🛠 **Staff Team** - Manage and moderate the server\n` +
            `• 🎨 **Designer** - Create graphics and visual content\n` +
            `• 🎉 **Event Hoster** - Organize fun community events\n` +
            `• 🤝 **Partnership** - Handle collaborations and partnerships\n` +
            `• 💻 **Developer** - Work on bots and coding projects\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `**📝 REQUIREMENTS**\n` +
            `• Be active and responsible\n` +
            `• Have good communication skills\n` +
            `• Follow server rules and guidelines\n` +
            `• Be at least 13 years old (Discord ToS)\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `**✅ HOW TO APPLY**\n` +
            `• Select a role from the dropdown below\n` +
            `• Fill out the application form\n` +
            `• Submit your application\n` +
            `• Wait for staff review\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `*Select a position to begin your application* 🚀`
        )
        .setColor(0x2b2d31)
        .setImage(BANNER_URL)
        .setFooter({ text: "Staff Application System • Applications reviewed within 48h", iconURL: client.user.displayAvatarURL() })
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

// Send application to review channel
async function sendApplicationForReview(guild, application) {
    const reviewChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
    if (!reviewChannel) return;

    const embed = new EmbedBuilder()
        .setTitle(`${APP_ROLES[application.role].emoji} NEW APPLICATION - ${APP_ROLES[application.role].name}`)
        .setDescription(`**Applicant:** ${application.userTag} (<@${application.userId}>)\n**Applied for:** ${APP_ROLES[application.role].name}\n**Applied at:** <t:${Math.floor(application.timestamp / 1000)}:F>`)
        .setColor(APP_ROLES[application.role].color)
        .setThumbnail(application.userAvatar)
        .setImage(BANNER_URL)
        .setTimestamp();

    // Add application answers
    for (const [question, answer] of Object.entries(application.answers)) {
        embed.addFields({ name: `📌 ${question}`, value: answer.length > 1024 ? answer.substring(0, 1021) + '...' : answer || 'Not provided', inline: false });
    }

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`approve_${application.userId}_${application.role}`)
                .setLabel('Approve')
                .setEmoji('✅')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`deny_${application.userId}_${application.role}`)
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

client.once('ready', async () => {
    console.log(`✨ ${client.user.tag} is now online!`);
    
    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) {
        console.error("❌ Guild not found! Check GUILD_ID environment variable.");
        return;
    }

    // Setup ticket panel
    const ticketPanelChannel = client.channels.cache.get(TICKET_PANEL_CHANNEL_ID);
    if (ticketPanelChannel) {
        const messages = await ticketPanelChannel.messages.fetch({ limit: 10 });
        await ticketPanelChannel.bulkDelete(messages);
        await createTicketPanel(ticketPanelChannel);
        console.log("✅ Ticket panel deployed!");
    }

    // Setup application panel
    const appPanelChannel = client.channels.cache.get(APP_PANEL_CHANNEL_ID);
    if (appPanelChannel) {
        const messages = await appPanelChannel.messages.fetch({ limit: 10 });
        await appPanelChannel.bulkDelete(messages);
        await createApplicationPanel(appPanelChannel);
        console.log("✅ Application panel deployed!");
    }
});

client.on('interactionCreate', async (interaction) => {
    // Ticket System
    if (interaction.isButton() && interaction.customId.startsWith('ticket_')) {
        const type = interaction.customId.replace('ticket_', '');
        const typeConfig = TICKET_TYPES[type];
        
        // Check existing ticket
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
                topic: `Ticket Owner: ${interaction.user.tag} (${interaction.user.id})`,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
                    ...staffRolesArray.map(roleId => ({ id: roleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] }))
                ]
            });
            
            activeTickets.set(ticketChannel.id, { userId: interaction.user.id, type });
            
            const welcomeEmbed = new EmbedBuilder()
                .setTitle(`${typeConfig.emoji} ${typeConfig.name.toUpperCase()} TICKET`)
                .setDescription(
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `**👋 Welcome ${interaction.user}!**\n\n` +
                    `> **Ticket Type:** ${typeConfig.name}\n` +
                    `> **Category:** ${typeConfig.desc}\n` +
                    `> **Priority:** Normal\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `**📝 INSTRUCTIONS**\n` +
                    `• Please describe your issue in detail\n` +
                    `• Attach screenshots if possible\n` +
                    `• Our team will respond shortly\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `**🔒 TICKET CONTROLS**\n` +
                    `• Click **Close Ticket** to end this session\n` +
                    `• Click **Claim Ticket** to assign a staff member\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
                )
                .setColor(typeConfig.color)
                .setImage(BANNER_URL)
                .setFooter({ text: `Ticket ID: ${ticketChannel.id} • Support Team`, iconURL: interaction.guild.iconURL() })
                .setTimestamp();
            
            const closeRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('close')
                        .setLabel('CLOSE TICKET')
                        .setEmoji('🔒')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('claim')
                        .setLabel('CLAIM TICKET')
                        .setEmoji('🎫')
                        .setStyle(ButtonStyle.Secondary)
                );
            
            await ticketChannel.send({ 
                content: `${interaction.user} | ${staffRolesArray.map(id => `<@&${id}>`).join(', ')}`,
                embeds: [welcomeEmbed], 
                components: [closeRow] 
            });
            
            await log(interaction.guild, "TICKET OPENED", `User: ${interaction.user.tag}\nType: ${typeConfig.name}\nChannel: #${ticketChannel.name}`, 0x22C55E);
            
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
    
    // Close ticket
    else if (interaction.isButton() && interaction.customId === 'close') {
        if (!activeTickets.has(interaction.channel.id)) {
            return interaction.reply({ content: "❌ Invalid ticket channel.", ephemeral: true });
        }
        
        const closeEmbed = new EmbedBuilder()
            .setTitle("🔒 CLOSING TICKET")
            .setDescription("> This ticket will be closed in **5 seconds**...\n> A transcript has been saved to the logs.")
            .setColor(0xEF4444);
        
        await interaction.reply({ embeds: [closeEmbed], ephemeral: false });
        
        const transcriptPath = await generateTranscript(interaction.channel);
        const logChannel = interaction.guild.channels.cache.get(TRANSCRIPT_CHANNEL_ID || LOG_CHANNEL_ID);
        
        if (logChannel) {
            const transcriptEmbed = new EmbedBuilder()
                .setTitle("📄 TICKET TRANSCRIPT")
                .setDescription(`**Channel:** ${interaction.channel.name}\n**Closed by:** ${interaction.user.tag}\n**Ticket Type:** ${activeTickets.get(interaction.channel.id)?.type || 'Unknown'}`)
                .setColor(0xF97316)
                .setTimestamp();
            
            await logChannel.send({ 
                embeds: [transcriptEmbed],
                files: [transcriptPath] 
            });
        }
        
        await log(interaction.guild, "TICKET CLOSED", `User: <@${activeTickets.get(interaction.channel.id)?.userId || 'Unknown'}>\nClosed by: ${interaction.user.tag}\nChannel: #${interaction.channel.name}`, 0xEF4444);
        
        setTimeout(async () => {
            await interaction.channel.delete();
            activeTickets.delete(interaction.channel.id);
            fs.unlinkSync(transcriptPath);
        }, 5000);
    }
    
    // Claim ticket
    else if (interaction.isButton() && interaction.customId === 'claim') {
        const ticket = activeTickets.get(interaction.channel.id);
        if (!ticket) return interaction.reply({ content: "❌ Invalid ticket.", ephemeral: true });
        
        const isStaff = staffRolesArray.some(roleId => interaction.member.roles.cache.has(roleId));
        if (!isStaff) {
            return interaction.reply({ 
                embeds: [new EmbedBuilder().setDescription("❌ Only staff members can claim tickets.").setColor(0xEF4444)], 
                ephemeral: true 
            });
        }
        
        ticket.claimedBy = interaction.user.id;
        activeTickets.set(interaction.channel.id, ticket);
        
        const claimEmbed = new EmbedBuilder()
            .setTitle("🎫 TICKET CLAIMED")
            .setDescription(`> **${interaction.user}** has claimed this ticket and will assist you shortly.\n> Please provide any additional information if needed.`)
            .setColor(0x22C55E)
            .setTimestamp();
        
        await interaction.reply({ embeds: [claimEmbed] });
        
        await log(interaction.guild, "TICKET CLAIMED", `Channel: #${interaction.channel.name}\nStaff: ${interaction.user.tag}`, 0x3B82F6);
    }

    // Application System - Dropdown selection
    else if (interaction.isStringSelectMenu() && interaction.customId === 'apply_select') {
        const selectedRole = interaction.values[0];
        const roleConfig = APP_ROLES[selectedRole];
        
        if (!roleConfig) return;
        
        // Store application data
        pendingApplications.set(interaction.user.id, {
            role: selectedRole,
            userId: interaction.user.id,
            userTag: interaction.user.tag,
            userAvatar: interaction.user.displayAvatarURL(),
            timestamp: Date.now(),
            answers: {}
        });
        
        // Create modal based on role
        const modal = new ModalBuilder()
            .setCustomId(`apply_modal_${selectedRole}`)
            .setTitle(`${roleConfig.emoji} ${roleConfig.name} Application`);
        
        // Common questions
        const ageInput = new TextInputBuilder()
            .setCustomId('age')
            .setLabel('How old are you?')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('Enter your age...');
        
        const experienceInput = new TextInputBuilder()
            .setCustomId('experience')
            .setLabel('Relevant experience for this role')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setPlaceholder('Describe your experience...');
        
        const whyInput = new TextInputBuilder()
            .setCustomId('why')
            .setLabel('Why do you want this position?')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setPlaceholder('Explain why you are interested...');
        
        const timezoneInput = new TextInputBuilder()
            .setCustomId('timezone')
            .setLabel('Your timezone and availability')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('e.g., EST, available 4-10 PM');
        
        const firstRow = new ActionRowBuilder().addComponents(ageInput);
        const secondRow = new ActionRowBuilder().addComponents(timezoneInput);
        const thirdRow = new ActionRowBuilder().addComponents(experienceInput);
        const fourthRow = new ActionRowBuilder().addComponents(whyInput);
        
        modal.addComponents(firstRow, secondRow, thirdRow, fourthRow);
        
        // Add role-specific questions
        if (selectedRole === 'designer') {
            const portfolioInput = new TextInputBuilder()
                .setCustomId('portfolio')
                .setLabel('Portfolio or previous work')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setPlaceholder('Provide links to your designs...');
            const fifthRow = new ActionRowBuilder().addComponents(portfolioInput);
            modal.addComponents(fifthRow);
        } else if (selectedRole === 'developer') {
            const skillsInput = new TextInputBuilder()
                .setCustomId('skills')
                .setLabel('Programming languages & skills')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setPlaceholder('List your coding languages and projects...');
            const fifthRow = new ActionRowBuilder().addComponents(skillsInput);
            modal.addComponents(fifthRow);
        } else if (selectedRole === 'event') {
            const ideasInput = new TextInputBuilder()
                .setCustomId('ideas')
                .setLabel('Event ideas you would host')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setPlaceholder('Describe events you would organize...');
            const fifthRow = new ActionRowBuilder().addComponents(ideasInput);
            modal.addComponents(fifthRow);
        } else if (selectedRole === 'partnership') {
            const networkInput = new TextInputBuilder()
                .setCustomId('network')
                .setLabel('Partnerships or network connections')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false)
                .setPlaceholder('List any relevant connections...');
            const fifthRow = new ActionRowBuilder().addComponents(networkInput);
            modal.addComponents(fifthRow);
        }
        
        await interaction.showModal(modal);
    }
    
    // Application Modal Submit
    else if (interaction.isModalSubmit() && interaction.customId.startsWith('apply_modal_')) {
        const role = interaction.customId.replace('apply_modal_', '');
        const roleConfig = APP_ROLES[role];
        
        if (!roleConfig) return;
        
        // Collect answers
        const answers = {
            age: interaction.fields.getTextInputValue('age'),
            timezone: interaction.fields.getTextInputValue('timezone'),
            experience: interaction.fields.getTextInputValue('experience'),
            why: interaction.fields.getTextInputValue('why')
        };
        
        if (role === 'designer') {
            answers.portfolio = interaction.fields.getTextInputValue('portfolio');
        } else if (role === 'developer') {
            answers.skills = interaction.fields.getTextInputValue('skills');
        } else if (role === 'event') {
            answers.ideas = interaction.fields.getTextInputValue('ideas');
        } else if (role === 'partnership') {
            const network = interaction.fields.getTextInputValue('network');
            if (network) answers.network = network;
        }
        
        const application = pendingApplications.get(interaction.user.id);
        if (application) {
            application.answers = answers;
            await sendApplicationForReview(interaction.guild, application);
            pendingApplications.delete(interaction.user.id);
        }
        
        const successEmbed = new EmbedBuilder()
            .setTitle("✅ APPLICATION SUBMITTED")
            .setDescription(`> Your application for **${roleConfig.name}** has been submitted!\n> Our team will review it within 48 hours.\n> You will be notified via DM about the decision.`)
            .setColor(0x22C55E)
            .setImage(BANNER_URL)
            .setTimestamp();
        
        await interaction.reply({ embeds: [successEmbed], ephemeral: true });
        
        // Try to DM the user
        try {
            const dmEmbed = new EmbedBuilder()
                .setTitle("📋 Application Received")
                .setDescription(`Thank you for applying for **${roleConfig.name}** in our server!\n\nYour application is now under review. You will receive a response within 48 hours.\n\n**Application ID:** \`${application?.userId || interaction.user.id}\``)
                .setColor(0x5865F2)
                .setTimestamp();
            await interaction.user.send({ embeds: [dmEmbed] });
        } catch (e) {
            // User has DMs disabled
        }
    }
    
    // Approve/Deny buttons
    else if (interaction.isButton() && (interaction.customId.startsWith('approve_') || interaction.customId.startsWith('deny_'))) {
        const isStaff = staffRolesArray.some(roleId => interaction.member.roles.cache.has(roleId));
        if (!isStaff) {
            return interaction.reply({ 
                embeds: [new EmbedBuilder().setDescription("❌ Only staff members can review applications.").setColor(0xEF4444)], 
                ephemeral: true 
            });
        }
        
        const [action, userId, role] = interaction.customId.split('_');
        const roleConfig = APP_ROLES[role];
        
        if (!roleConfig || !userId) return;
        
        const guild = interaction.guild;
        const member = await guild.members.fetch(userId).catch(() => null);
        
        if (action === 'approve') {
            if (member && roleConfig.roleId) {
                await member.roles.add(roleConfig.roleId).catch(console.error);
                
                const approveEmbed = new EmbedBuilder()
                    .setTitle("✅ APPLICATION APPROVED")
                    .setDescription(`> Your application for **${roleConfig.name}** has been approved!\n> Welcome to the team! You now have access to the ${roleConfig.name} role.`)
                    .setColor(0x22C55E)
                    .setTimestamp();
                
                await interaction.reply({ 
                    embeds: [new EmbedBuilder()
                        .setTitle("✅ Application Approved")
                        .setDescription(`Successfully approved ${member?.user?.tag || userId} for ${roleConfig.name} and assigned the role.`)
                        .setColor(0x22C55E)
                    ], 
                    ephemeral: false 
                });
                
                try {
                    await member?.send({ embeds: [approveEmbed] });
                } catch (e) {}
                
                await log(guild, "APPLICATION APPROVED", `User: ${member?.user?.tag || userId}\nRole: ${roleConfig.name}\nReviewed by: ${interaction.user.tag}`, 0x22C55E);
            } else {
                await interaction.reply({ 
                    content: `❌ Could not find member or role for ${userId}. They may have left the server.`, 
                    ephemeral: true 
                });
            }
        } else if (action === 'deny') {
            const denyEmbed = new EmbedBuilder()
                .setTitle("❌ APPLICATION DENIED")
                .setDescription(`> Thank you for applying for **${roleConfig.name}**.\n> Unfortunately, your application has been denied at this time.\n> Feel free to reapply in 30 days.`)
                .setColor(0xEF4444)
                .setTimestamp();
            
            await interaction.reply({ 
                embeds: [new EmbedBuilder()
                    .setTitle("❌ Application Denied")
                    .setDescription(`Denied ${member?.user?.tag || userId} for ${roleConfig.name}.`)
                    .setColor(0xEF4444)
                ], 
                ephemeral: false 
            });
            
            try {
                await member?.send({ embeds: [denyEmbed] });
            } catch (e) {}
            
            await log(guild, "APPLICATION DENIED", `User: ${member?.user?.tag || userId}\nRole: ${roleConfig.name}\nReviewed by: ${interaction.user.tag}`, 0xEF4444);
        }
        
        // Disable buttons after review
        const row = ActionRowBuilder.from(interaction.message.components[0]);
        row.components.forEach(component => component.setDisabled(true));
        await interaction.message.edit({ components: [row] });
    }
});

client.login(BOT_TOKEN);
