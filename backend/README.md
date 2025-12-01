# Messaging AI Bot Backend

Backend server for the messaging SDK example app's AI chatbot feature.

## Setup

1. Install dependencies:
```bash
cd backend
pnpm install
```

2. Generate a bot wallet keypair:
```bash
# You can use Node.js to generate a keypair
node -e "const { Ed25519Keypair } = require('@mysten/sui/keypairs/ed25519'); const kp = Ed25519Keypair.generate(); console.log('Private Key:', kp.getSecretKey()); console.log('Address:', kp.toSuiAddress());"
```

3. Get an OpenAI API key:
   - Go to [OpenAI Platform](https://platform.openai.com/api-keys)
   - Sign up or log in to your OpenAI account
   - Create a new API key
   - Copy the API key (you'll need it for the `.env` file)

4. Create a `.env` file with required environment variables:
```env
# Bot wallet private key (Ed25519, hex format)
# This is the private key from the keypair you generated above
BOT_PRIVATE_KEY=your_private_key_here

# OpenAI API key (required)
# Get your API key from https://platform.openai.com/api-keys
OPENAI_API_KEY=your_openai_api_key_here

# Polling interval in milliseconds (optional, default: 30000 = 30 seconds)
POLLING_INTERVAL_MS=30000

# Server port (optional, default: 3000)
PORT=3000
```

5. Fund the bot wallet:
   - The bot wallet address is printed when the server starts
   - Send some SUI testnet tokens to this address for gas fees
   - You can get testnet SUI from the [Sui Testnet Faucet](https://discord.com/channels/916379725201563759/971488439931392130)

## Development

Run the development server with hot reload:
```bash
pnpm dev
```

The server will:
- Initialize the bot wallet
- Create a session key for the bot
- Initialize the messaging client
- Initialize the AI service (GPT-4o-mini)
- Start polling for new messages in all channels the bot is a member of
- Automatically respond to user messages with AI-generated responses

## Build

Build the TypeScript code:
```bash
pnpm build
```

## Production

Run the production server:
```bash
pnpm start
```

## Health Check

The server exposes a health check endpoint at `/health`:
```bash
curl http://localhost:3000/health
```

## How It Works

1. **Bot Wallet**: The bot uses an Ed25519 keypair to sign transactions and messages
2. **Session Key**: The bot creates a Seal session key (valid for 30 minutes) to encrypt/decrypt messages
3. **Polling**: The bot polls all channels it's a member of every 30 seconds (configurable) for new messages
4. **Message Detection**: Uses `getLatestMessages()` with `PollingState` to efficiently fetch only new messages since the last poll
5. **AI Responses**: When a user sends a message, the bot:
   - Filters out its own messages to prevent reply loops
   - Generates an AI response using OpenAI's GPT-4o-mini model
   - Maintains conversation history (last 10 messages per channel) for context
   - Sends the AI response back to the channel on-chain

## Notes

- The bot wallet needs to be funded with SUI for gas fees
- Session keys expire after 30 minutes and are automatically refreshed
- PollingState is stored in memory (will be lost on restart - optimization for later)
- Conversation history is stored in memory (last 10 messages per channel) to manage API token usage
- The bot uses GPT-4o-mini which is cost-effective for this use case
- OpenAI API calls are made per user message, so costs scale with usage
- The bot ignores its own messages to prevent infinite reply loops

