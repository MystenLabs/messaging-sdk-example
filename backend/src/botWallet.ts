import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { BOT_PRIVATE_KEY } from './config.js';

/**
 * Creates an Ed25519 keypair from the bot's private key
 */
export function createBotKeypair(): Ed25519Keypair {
  if (!BOT_PRIVATE_KEY) {
    throw new Error('BOT_PRIVATE_KEY is not set');
  }

  try {
    return Ed25519Keypair.fromSecretKey(BOT_PRIVATE_KEY);
  } catch (error) {
    throw new Error(
      `Failed to create bot keypair: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Gets the bot's address from the keypair
 */
export function getBotAddress(keypair: Ed25519Keypair): string {
  return keypair.toSuiAddress();
}

