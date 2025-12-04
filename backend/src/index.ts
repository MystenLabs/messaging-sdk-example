// Load environment variables from .env file
import 'dotenv/config';

import http from 'http';
import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SessionKey } from '@mysten/seal';
import { SuiStackMessagingClient } from '@mysten/messaging';
import { createBotKeypair, getBotAddress } from './botWallet.js';
import { getOrCreateSessionKey } from './sessionKey.js';
import { createMessagingClient } from './messagingClient.js';
import { MessageIndexer } from './eventIndexer.js';
import { LLMService } from './llmService.js';
import { MessageSender } from './messageSender.js';
import { SUI_RPC_URL, POLLING_INTERVAL_MS } from './config.js';
import { handleSponsorTransaction, handleSponsorTransactionFinalize } from './api.js';

const PORT = process.env.PORT || 3000;

let isRunning = true;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if session key needs renewal and renew if necessary
 * Returns true if renewal occurred, false otherwise
 */
async function checkAndRenewSessionKey(
  currentSessionKey: SessionKey,
  suiClient: SuiClient,
  keypair: Ed25519Keypair,
  botAddress: string,
  messageIndexer: MessageIndexer,
  messageSender: MessageSender
): Promise<{ sessionKey: SessionKey; messagingClient: SuiStackMessagingClient; renewed: boolean }> {
  // Check if session key is expired or about to expire
  if (currentSessionKey.isExpired()) {
    console.log('🔄 Session key expired, renewing...');

    // Create new session key
    const newSessionKey = await getOrCreateSessionKey(suiClient, keypair, botAddress);

    // Create new messaging client with new session key
    const newMessagingClient = createMessagingClient(newSessionKey);

    // Update both indexer and sender with new client
    messageIndexer.updateMessagingClient(newMessagingClient);
    messageSender.updateMessagingClient(newMessagingClient);

    console.log('✅ Session key renewed successfully');

    return {
      sessionKey: newSessionKey,
      messagingClient: newMessagingClient,
      renewed: true
    };
  }

  return {
    sessionKey: currentSessionKey,
    messagingClient: createMessagingClient(currentSessionKey),
    renewed: false
  };
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

    // Start polling loop with session key tracking
    await pollLoop(
      messageIndexer,
      aiService,
      messageSender,
      suiClient,
      keypair,
      botAddress,
      sessionKey
    );
  } catch (error) {
    console.error('❌ Failed to initialize bot:', error);
    process.exit(1);
  }
}

async function pollLoop(
  indexer: MessageIndexer,
  aiService: LLMService,
  messageSender: MessageSender,
  suiClient: SuiClient,
  keypair: Ed25519Keypair,
  botAddress: string,
  initialSessionKey: SessionKey
): Promise<void> {
  console.log('🚀 Starting message polling loop...');

  // Get initial cursor (skip historical messages)
  let lastCursor = await indexer.getInitialCursor();
  console.log('⏭️  Starting from latest cursor (skipping historical messages)\n');

  // Track current session key
  let currentSessionKey = initialSessionKey;

  while (isRunning) {
    try {
      // Check and renew session key if needed
      const renewalResult = await checkAndRenewSessionKey(
        currentSessionKey,
        suiClient,
        keypair,
        botAddress,
        indexer,
        messageSender
      );

      // Update session key reference if renewed
      if (renewalResult.renewed) {
        currentSessionKey = renewalResult.sessionKey;
      }

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
  // Enable CORS for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, zklogin-jwt');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check endpoint
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }

  // API: POST /api/sponsor-transaction
  if (req.url === '/api/sponsor-transaction' && req.method === 'POST') {
    handleSponsorTransaction(req, res);
    return;
  }

  // API: POST /api/sponsor-transaction/:digest
  const sponsorFinalizeMatch = req.url?.match(/^\/api\/sponsor-transaction\/([^\/]+)$/);
  if (sponsorFinalizeMatch && req.method === 'POST') {
    const digest = sponsorFinalizeMatch[1];
    handleSponsorTransactionFinalize(req, res, digest);
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

