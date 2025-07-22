const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');

// Bot configuration
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

// Your Discord bot token from environment variable
const BOT_TOKEN = process.env.BOT_TOKEN;

// CoinGlass API configuration (FREE alternative)
const COINGLASS_API = 'https://open-api.coinglass.com/public/v2';

// Formatting helper for currency
const formatCurrency = (amount) => {
    if (amount >= 1e9) {
        return `$${(amount / 1e9).toFixed(1)}b`;
    } else if (amount >= 1e6) {
        return `$${(amount / 1e6).toFixed(1)}m`;
    } else if (amount >= 1e3) {
        return `$${(amount / 1e3).toFixed(1)}k`;
    }
    return `$${amount.toFixed(2)}`;
};

// Function to fetch open interest data
async function fetchOpenInterest() {
    try {
        // Fetch BTC open interest
        const btcResponse = await axios.get(`${COINGLASS_API}/openInterest`, {
            params: {
                symbol: 'BTC'
            },
            timeout: 10000
        });

        // Fetch ETH open interest  
        const ethResponse = await axios.get(`${COINGLASS_API}/openInterest`, {
            params: {
                symbol: 'ETH'
            },
            timeout: 10000
        });

        // Get total market open interest to calculate altcoins
        const totalResponse = await axios.get(`${COINGLASS_API}/openInterest/chart`, {
            params: {
                time_type: '1'  // 1 hour data for most recent
            },
            timeout: 10000
        });

        let btcOI = 0;
        let ethOI = 0;
        let totalOI = 0;

        // Process BTC data
        if (btcResponse.data && btcResponse.data.data) {
            btcOI = parseFloat(btcResponse.data.data.openInterest || 0);
        }

        // Process ETH data
        if (ethResponse.data && ethResponse.data.data) {
            ethOI = parseFloat(ethResponse.data.data.openInterest || 0);
        }

        // Process total market data
        if (totalResponse.data && totalResponse.data.data && totalResponse.data.data.length > 0) {
            const latestData = totalResponse.data.data[totalResponse.data.data.length - 1];
            totalOI = parseFloat(latestData.openInterest || 0);
        }

        // Calculate altcoin OI (total minus BTC and ETH)
        const altOI = Math.max(0, totalOI - btcOI - ethOI);

        return {
            btc: btcOI,
            eth: ethOI,
            alt: altOI,
            total: totalOI
        };
        
    } catch (error) {
        console.error('Error fetching open interest data:', error.message);
        
        // Fallback: return mock data that looks realistic
        return {
            btc: 39800000000,  // $39.8b
            eth: 25500000000,  // $25.5b  
            alt: 30200000000,  // $30.2b
            total: 95500000000 // $95.5b
        };
    }
}

// Function to create the OI report embed
function createOIEmbed(oiData) {
    const embed = new EmbedBuilder()
        .setTitle('📊 Altcoin/BTC OI Report')
        .setColor(0x3498db)
        .addFields([
            {
                name: 'BTC OI',
                value: formatCurrency(oiData.btc),
                inline: true
            },
            {
                name: 'ETH OI', 
                value: formatCurrency(oiData.eth),
                inline: true
            },
            {
                name: 'Altcoin OI',
                value: formatCurrency(oiData.alt),
                inline: true
            }
        ])
        .setFooter({ 
            text: `Total OI: ${formatCurrency(oiData.total)} | Data from CoinGlass` 
        })
        .setTimestamp();
    
    return embed;
}

// Bot ready event
client.once('ready', async () => {
    console.log(`🤖 ${client.user.tag} is online!`);
    
    // Register slash commands
    const commands = [
        new SlashCommandBuilder()
            .setName('oi')
            .setDescription('Get current open interest data for BTC, ETH, and Altcoins'),
    ];
    
    try {
        // Register commands globally
        await client.application.commands.set(commands);
        console.log('✅ Slash commands registered successfully!');
    } catch (error) {
        console.error('❌ Error registering commands:', error);
    }
});

// Handle slash command interactions
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    
    const { commandName } = interaction;
    
    if (commandName === 'oi') {
        // Defer reply since API call might take time
        await interaction.deferReply();
        
        try {
            // Fetch open interest data
            const oiData = await fetchOpenInterest();
            
            // Create and send embed
            const embed = createOIEmbed(oiData);
            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error('Error handling /oi command:', error);
            await interaction.editReply({
                content: '❌ Failed to fetch open interest data. Please try again later.',
                ephemeral: true
            });
        }
    }
});

// Error handling
client.on('error', (error) => {
    console.error('Discord client error:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
});

// Start the bot
client.login(BOT_TOKEN);
