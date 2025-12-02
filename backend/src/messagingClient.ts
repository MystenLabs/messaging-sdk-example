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
    const extendedClient = new SuiClient({
        url: "https://fullnode.testnet.sui.io:443",
      })
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
            storage: (client) =>
              new WalrusStorageAdapter(client, {
                publisher: 'https://publisher.walrus-testnet.walrus.space',
                aggregator: 'https://aggregator.testnet.walrus.mirai.cloud',
                epochs: 10,
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

