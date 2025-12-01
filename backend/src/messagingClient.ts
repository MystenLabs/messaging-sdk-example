import { SuiClient } from '@mysten/sui/client';
import { SealClient } from '@mysten/seal';
import { SuiStackMessagingClient, WalrusStorageAdapter } from '@mysten/messaging';
import { SessionKey } from '@mysten/seal';
import { SUI_RPC_URL, SEAL_SERVERS, WALRUS_CONFIG } from './config.js';

/**
 * Creates and initializes the SuiStackMessagingClient for the bot
 */
export function createMessagingClient(sessionKey: SessionKey): SuiStackMessagingClient {
  try {
    // Create the base SuiClient
    const suiClient = new SuiClient({
      url: SUI_RPC_URL,
    });

    // Extend with SealClient extension
    const extendedClient = suiClient
      .$extend(
        SealClient.asClientExtension({
          serverConfigs: SEAL_SERVERS.map((id) => ({
            objectId: id,
            weight: 1,
          })),
        })
      )
      .$extend(
        SuiStackMessagingClient.experimental_asClientExtension({
          storage: (client: SuiClient) =>
            new WalrusStorageAdapter(client, {
              publisher: WALRUS_CONFIG.publisher,
              aggregator: WALRUS_CONFIG.aggregator,
              epochs: WALRUS_CONFIG.epochs,
            }),
          sessionKey,
        })
      );

    return extendedClient.messaging;
  } catch (error) {
    throw new Error(
      `Failed to create messaging client: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

