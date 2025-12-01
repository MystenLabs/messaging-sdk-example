// Package ID for the messaging SDK (same as frontend)
export const PACKAGE_ID = '0x984960ebddd75c15c6d38355ac462621db0ffc7d6647214c802cd3b685e1af3d';

// Seal server configurations for testnet (same as frontend)
export const SEAL_SERVERS = [
  '0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75',
  '0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8',
];

// Walrus configuration for testnet
export const WALRUS_CONFIG = {
  publisher: 'https://publisher.walrus-testnet.walrus.space',
  aggregator: 'https://aggregator.testnet.walrus.mirai.cloud',
  epochs: 10,
};

// Sui RPC URL for testnet
export const SUI_RPC_URL = 'https://fullnode.testnet.sui.io:443';

// Session key TTL in minutes (same as frontend)
export const SESSION_KEY_TTL_MINUTES = 30;

// Polling interval in milliseconds (default 10 seconds for responsive bot)
export const POLLING_INTERVAL_MS = parseInt(
  process.env.POLLING_INTERVAL_MS || '10000',
  10
);

// Bot wallet private key (required)
export const BOT_PRIVATE_KEY = process.env.BOT_PRIVATE_KEY;
if (!BOT_PRIVATE_KEY) {
  throw new Error('BOT_PRIVATE_KEY environment variable is required');
}

// OpenAI API key (required)
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}

