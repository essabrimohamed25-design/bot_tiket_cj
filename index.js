const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');

// Environment variables
const {
    BOT_TOKEN,
    GUILD_ID,
    LOG_CHANNEL_ID,
    TICKET_CATEGORY_ID,
    PANEL_CHANNEL_ID,
    STAFF_ROLES,
    BANNER_URL = "https://media.discordapp.net/attachments/1480969775344652470/1496647110525845625/DF7E4FDA-66D3-49FF-BD5E-7C746253AE2D.png"
} = process.env;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel]
});

// Premium ticket types with better formatting
const TICKET_TYPES = {
    pub: { 
        name: "Public Lounge", 
        emoji: "🍻", 
        color: "#38BDF8", 
        desc: "General discussions & community chats",
        gradient: "🔹"
    },
    bugs: { 
        name: "Bug Report", 
        emoji: "🐛", 
        color: "#EF4444", 
        desc: "Report technical issues or glitches",
        gradient: "🔸"
    },
    abuse: { 
        name: "Abuse Report", 
        emoji: "⚠️", 
        color: "#F97316", 
        desc: "Report rule violations or harassment",
        gradient: "🔻"
    },
    server: { 
        name: "Server Support", 
        emoji: "⚙️", 
        color: "#8B5CF6", 
        desc: "Technical support & server inquiries",
        gradient: "🔹"
    }
};

const staffRolesArray = STAFF_ROLES ? STAFF_ROLES.split(',') : [];
const activeTickets = new Map();

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
        .setFooter({ text: footer || "Ticket System • Premium" });
    
    await logChannel.send({ embeds: [embed] });
}

// Create premium ticket panel
async function createPanel(channel) {
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

    // Premium button design - split into two beautiful rows
    const row1 = new ActionRowBuilder();
    const row2 = new ActionRowBuilder();
    
    const types = Object.entries(TICKET_TYPES);
    
    // Row 1: Pub & Bugs
    const pubBtn = new ButtonBuilder()
        .setCustomId('ticket_pub')
        .setLabel("Public Lounge")
        .setEmoji("🍻")
        .setStyle(ButtonStyle.Success);
    
    const bugsBtn = new ButtonBuilder()
        .setCustomId('ticket_bugs')
        .setLabel("Bug Report")
        .setEmoji("🐛")
        .setStyle(ButtonStyle.Danger);
    
    // Row 2: Abuse & Server
    const abuseBtn = new ButtonBuilder()
        .setCustomId('ticket_abuse')
        .setLabel("Abuse Report")
        .setEmoji("⚠️")
        .setStyle(ButtonStyle.Danger);
    
    const serverBtn = new ButtonBuilder()
        .setCustomId('ticket_server')
        .setLabel("Server Support")
        .setEmoji("⚙️")
        .setStyle(ButtonStyle.Primary);
    
    row1.addComponents(pubBtn, bugsBtn);
    row2.addComponents(abuseBtn, serverBtn);
    
    await channel.send({ embeds: [embed], components: [row1, row2] });
}

client.once('ready', async () => {
    console.log(`✨ ${client.user.tag} is now online!`);
    
    const panelChannel = client.channels.cache.get(PANEL_CHANNEL_ID);
    if (panelChannel) {
        await panelChannel.bulkDelete(100).catch(() => {});
        await createPanel(panelChannel);
        console.log("✅ Premium ticket panel deployed!");
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    
    // Open ticket
    if (interaction.customId.startsWith('ticket_')) {
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
            
            // Premium welcome embed
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
    else if (interaction.customId === 'close') {
        if (!activeTickets.has(interaction.channel.id)) {
            return interaction.reply({ content: "❌ Invalid ticket channel.", ephemeral: true });
        }
        
        const closeEmbed = new EmbedBuilder()
            .setTitle("🔒 CLOSING TICKET")
            .setDescription("> This ticket will be closed in **5 seconds**...\n> A transcript has been saved to the logs.")
            .setColor(0xEF4444);
        
        await interaction.reply({ embeds: [closeEmbed], ephemeral: false });
        
        const transcriptPath = await generateTranscript(interaction.channel);
        const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
        
        if (logChannel) {
            const transcriptEmbed = new EmbedBuilder()
                .setTitle("📄 TICKET TRANSCRIPT")
                .setDescription(`**Channel:** ${interaction.channel.name}\n**Closed by:** ${interaction.user.tag}\n**Ticket Type:** ${activeTickets.get(interaction.channel.id).type}`)
                .setColor(0xF97316)
                .setTimestamp();
            
            await logChannel.send({ 
                embeds: [transcriptEmbed],
                files: [transcriptPath] 
            });
        }
        
        await log(interaction.guild, "TICKET CLOSED", `User: <@${activeTickets.get(interaction.channel.id).userId}>\nClosed by: ${interaction.user.tag}\nChannel: #${interaction.channel.name}`, 0xEF4444);
        
        setTimeout(async () => {
            await interaction.channel.delete();
            activeTickets.delete(interaction.channel.id);
            fs.unlinkSync(transcriptPath);
        }, 5000);
    }
    
    // Claim ticket
    else if (interaction.customId === 'claim') {
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
});

client.login(BOT_TOKEN);
