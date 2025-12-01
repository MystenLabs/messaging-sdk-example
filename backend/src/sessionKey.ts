import { SessionKey } from '@mysten/seal';
import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { PACKAGE_ID, SESSION_KEY_TTL_MINUTES } from './config.js';

let cachedSessionKey: SessionKey | null = null;
let sessionKeyExpiry: number | null = null;

/**
 * Creates and signs a SessionKey for the bot wallet
 * The bot can sign programmatically without user interaction
 */
export async function createBotSessionKey(
  suiClient: SuiClient,
  keypair: Ed25519Keypair,
  address: string
): Promise<SessionKey> {
  try {
    // Create a new session key
    const sessionKey = await SessionKey.create({
      address,
      packageId: PACKAGE_ID,
      ttlMin: SESSION_KEY_TTL_MINUTES,
      suiClient,
    });

    // Get the personal message that needs to be signed
    const personalMessage = sessionKey.getPersonalMessage();

    // Sign the message with the bot's keypair
    // signPersonalMessage returns a signature object with a signature property
    const signature = await keypair.signPersonalMessage(
      Buffer.from(personalMessage)
    );

    // Set the signature on the session key
    // The signature object has a signature property that contains the serialized signature
    await sessionKey.setPersonalMessageSignature(signature.signature);

    return sessionKey;
  } catch (error) {
    throw new Error(
      `Failed to create session key: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Gets a valid session key, creating a new one if needed or expired
 */
export async function getOrCreateSessionKey(
  suiClient: SuiClient,
  keypair: Ed25519Keypair,
  address: string
): Promise<SessionKey> {
  // Check if we have a cached session key that's still valid
  if (cachedSessionKey && sessionKeyExpiry && Date.now() < sessionKeyExpiry) {
    if (!cachedSessionKey.isExpired()) {
      return cachedSessionKey;
    }
  }

  // Create a new session key
  const newSessionKey = await createBotSessionKey(suiClient, keypair, address);
  
  // Cache it with expiry time (set expiry slightly before actual expiry for safety)
  cachedSessionKey = newSessionKey;
  sessionKeyExpiry = Date.now() + (SESSION_KEY_TTL_MINUTES - 1) * 60 * 1000;

  return newSessionKey;
}

