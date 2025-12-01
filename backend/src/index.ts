// Load environment variables from .env file
import 'dotenv/config';

import http from 'http';
import { SuiClient } from '@mysten/sui/client';
import { createBotKeypair, getBotAddress } from './botWallet.js';
import { getOrCreateSessionKey } from './sessionKey.js';
import { createMessagingClient } from './messagingClient.js';
import { MessageIndexer } from './eventIndexer.js';
import { LLMService } from './llmService.js';
import { MessageSender } from './messageSender.js';
import { SUI_RPC_URL, POLLING_INTERVAL_MS } from './config.js';

const PORT = process.env.PORT || 3000;

let isRunning = true;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function initializeBot() {
  try {
    console.log('🤖 Initializing AI bot...');

    // Create bot wallet
    const keypair = createBotKeypair();
    const botAddress = getBotAddress(keypair);
    console.log(`📍 Bot address: ${botAddress}`);

    // Create Sui client
    const suiClient = new SuiClient({
      url: SUI_RPC_URL,
    });

    // Create session key for bot
    console.log('🔑 Creating session key...');
    const sessionKey = await getOrCreateSessionKey(suiClient, keypair, botAddress);
    console.log('✅ Session key created');

    // Create messaging client
    console.log('💬 Initializing messaging client...');
    const messagingClient = createMessagingClient(sessionKey);
    console.log('✅ Messaging client initialized');

    // Create AI service
    console.log('🤖 Initializing AI service...');
    const aiService = new LLMService();
    console.log('✅ AI service initialized');

    // Create message sender
    console.log('📤 Initializing message sender...');
    const messageSender = new MessageSender(
      messagingClient,
      suiClient,
      keypair,
      botAddress
    );
    console.log('✅ Message sender initialized');

    // Create message indexer
    console.log('📋 Initializing message indexer...');
    const messageIndexer = new MessageIndexer(messagingClient, botAddress);
    console.log('✅ Message indexer initialized');

    console.log('✅ Bot initialization complete\n');

    // Start polling loop
    await pollLoop(messageIndexer, aiService, messageSender);
  } catch (error) {
    console.error('❌ Failed to initialize bot:', error);
    process.exit(1);
  }
}

async function pollLoop(
  indexer: MessageIndexer,
  aiService: LLMService,
  messageSender: MessageSender
): Promise<void> {
  console.log('🚀 Starting message polling loop...');

  // Get initial cursor (skip historical messages)
  let lastCursor = await indexer.getInitialCursor();
  console.log('⏭️  Starting from latest cursor (skipping historical messages)\n');

  while (isRunning) {
    try {
      const { messages, nextCursor } = await indexer.getMessagesSince(lastCursor);

      if (messages.length > 0) {
        console.log(`📨 Found ${messages.length} new message(s)`);

        for (const msg of messages) {
          console.log(`\n💬 Processing message from ${msg.sender.slice(0, 8)}...`);
          console.log(`   Channel: ${msg.channelId.slice(0, 8)}...`);
          console.log(`   Text: ${msg.text}`);

          // Generate AI response
          const reply = await aiService.generateResponse(msg.text, []);
          console.log(`   🤖 AI response: ${reply}`);

          // Send reply to channel
          await messageSender.sendMessage(msg.channelId, reply);
          console.log(`   ✅ Reply sent\n`);
        }
      }

      lastCursor = nextCursor ?? lastCursor;

      await sleep(POLLING_INTERVAL_MS);
    } catch (error) {
      console.error('❌ Error in polling loop:', error);
      await sleep(POLLING_INTERVAL_MS);
    }
  }
}

const server = http.createServer((req, res) => {
  // Health check endpoint
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }

  // Default 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

server.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  
  // Initialize bot after server starts
  await initializeBot();
});

// Graceful shutdown
async function shutdown() {
  console.log('🛑 Shutting down gracefully...');

  isRunning = false;

  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

