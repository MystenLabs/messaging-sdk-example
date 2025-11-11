import { createContext, ReactNode, useMemo, useContext } from 'react';
import { useSuiClient } from '@mysten/dapp-kit';
import { SealClient } from '@mysten/seal';
import { SuiStackMessagingClient, WalrusStorageAdapter } from '@mysten/messaging';
import { useSessionKey } from './SessionKeyProvider';
import { SuiClient } from '@mysten/sui/client';

// Hard-coded Seal server configurations for testnet
const SEAL_SERVERS = [
  '0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75',
  '0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8',
];

const MessagingClientContext = createContext<SuiStackMessagingClient | null>(null);

export const useMessagingClient = (): SuiStackMessagingClient | null => {
  const ctx = useContext(MessagingClientContext);
  if (ctx === undefined) {
    throw new Error('useMessagingClient must be used within a MessagingClientProvider');
  }
  return ctx;
};

export const MessagingClientProvider = ({
  children,
}: {
  children: ReactNode | ReactNode[];
}) => {
  const suiClient = useSuiClient();
  const { sessionKey } = useSessionKey();

  const messagingClient = useMemo(() => {
    if (!sessionKey) return null;

    try {
      // Create the extended client with SealClient and MessagingClient
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
      console.error('Failed to create messaging client:', error);
      return null;
    }
  }, [suiClient, sessionKey]);

  return (
    <MessagingClientContext.Provider value={messagingClient}>
      {children}
    </MessagingClientContext.Provider>
  );
};