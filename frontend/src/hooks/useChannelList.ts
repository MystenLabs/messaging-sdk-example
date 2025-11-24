import { useState, useCallback, useEffect, useRef } from 'react';
import { useMessagingClient } from '../providers/MessagingClientProvider';
import { useSignAndExecuteTransaction, useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { DecryptedChannelObject } from '@mysten/messaging';
import { useChannelMembership } from './useChannelMembership';

/**
 * Hook for managing channel list and channel creation.
 * Groups channel-related queries and mutations together.
 */
export const useChannelList = () => {
  const messagingClient = useMessagingClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const { clearCache } = useChannelMembership();

  // Channel state
  const [channels, setChannels] = useState<DecryptedChannelObject[]>([]);
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [isFetchingChannels, setIsFetchingChannels] = useState(false);
  const [channelError, setChannelError] = useState<string | null>(null);
  const [hasMoreChannels, setHasMoreChannels] = useState(false);

  // Track in-flight requests to prevent duplicate simultaneous calls
  const inFlightRequests = useRef<Set<string>>(new Set());
  // Ref to track cursor without causing callback recreation
  const channelsCursorRef = useRef<string | null>(null);

  // ============================================
  // QUERIES (Read Operations)
  // ============================================

  /**
   * Fetch channels for the current user.
   * 
   * @param loadMore - If true, appends to existing channels. If false, replaces all channels.
   * 
   * @example
   * // Initial load
   * fetchChannels();
   * 
   * // Load more (pagination)
   * fetchChannels(true);
   */
  const fetchChannels = useCallback(async (loadMore: boolean = false) => {
    if (!messagingClient || !currentAccount) {
      return;
    }

    const cursor = loadMore ? channelsCursorRef.current : null;
    const requestKey = `fetchChannels-${currentAccount.address}-${cursor ?? 'initial'}`;
    
    // Check if request is already in flight
    if (inFlightRequests.current.has(requestKey)) {
      return;
    }

    inFlightRequests.current.add(requestKey);
    setIsFetchingChannels(true);
    setChannelError(null);

    try {
      const response = await messagingClient.getChannelObjectsByAddress({
        address: currentAccount.address,
        cursor: cursor,
        limit: 10,
      });

      if (loadMore) {
        // Append new channels to existing ones
        setChannels(prev => [...prev, ...response.channelObjects]);
      } else {
        // Replace all channels (refresh)
        setChannels(response.channelObjects);
        // Invalidate member cap cache when channels are refreshed
        clearCache();
      }

      channelsCursorRef.current = response.cursor;
      setHasMoreChannels(response.hasNextPage);
    } catch (err) {
      const errorMsg = err instanceof Error ? `[fetchChannels] ${err.message}` : '[fetchChannels] Failed to fetch channels';
      setChannelError(errorMsg);
      console.error('Error fetching channels:', err);
    } finally {
      setIsFetchingChannels(false);
      inFlightRequests.current.delete(requestKey);
    }
  }, [messagingClient, currentAccount, clearCache]);

  // ============================================
  // MUTATIONS (Write Operations)
  // ============================================

  /**
   * Create a new channel with specified recipients.
   * 
   * This demonstrates the complete channel creation flow:
   * 1. Create the channel object
   * 2. Get generated capabilities
   * 3. Generate and attach encryption key
   * 4. Refresh the channel list
   * 
   * @param recipientAddresses - Array of Sui addresses to add as initial members
   * @returns Object containing the channelId, or null if failed
   * 
   * @example
   * const result = await createChannel(['0xabc...', '0xdef...']);
   * if (result) {
   *   console.log('Created channel:', result.channelId);
   * }
   */
  const createChannel = useCallback(async (recipientAddresses: string[]) => {
    if (!messagingClient || !currentAccount) {
      setChannelError('[createChannel] Messaging client or account not available');
      return null;
    }

    setIsCreatingChannel(true);
    setChannelError(null);

    try {
      // Create channel flow
      const flow = messagingClient.createChannelFlow({
        creatorAddress: currentAccount.address,
        initialMemberAddresses: recipientAddresses,
      });

      // Step 1: Build and execute channel creation
      const channelTx = flow.build();
      const { digest } = await signAndExecute({
        transaction: channelTx,
      });

      // Wait for transaction and get channel ID
      const { objectChanges } = await suiClient.waitForTransaction({
        digest,
        options: { showObjectChanges: true },
      });

      const createdChannel = objectChanges?.find(
        (change) => change.type === 'created' && change.objectType?.endsWith('::channel::Channel')
      );

      const channelId = (createdChannel as any)?.objectId;

      // Step 2: Get generated caps
      const { creatorMemberCap } = await flow.getGeneratedCaps({ digest });

      // Step 3: Generate and attach encryption key
      const attachKeyTx = await flow.generateAndAttachEncryptionKey({
        creatorMemberCap,
      });

      const { digest: finalDigest } = await signAndExecute({
        transaction: attachKeyTx,
      });

      // Wait for final transaction
      const { effects } = await suiClient.waitForTransaction({
        digest: finalDigest,
        options: { showEffects: true },
      });

      if (effects?.status.status !== 'success') {
        throw new Error('Transaction failed');
      }

      // Refresh channels list
      await fetchChannels();

      return { channelId };
    } catch (err) {
      const errorMsg = err instanceof Error ? `[createChannel] ${err.message}` : '[createChannel] Failed to create channel';
      setChannelError(errorMsg);
      console.error('Error creating channel:', err);
      return null;
    } finally {
      setIsCreatingChannel(false);
    }
  }, [messagingClient, currentAccount, signAndExecute, suiClient, fetchChannels]);

  // Fetch channels when client is ready (initial fetch only)
  useEffect(() => {
    if (messagingClient && currentAccount) {
      fetchChannels();
    }
  }, [messagingClient, currentAccount, fetchChannels]);

  return {
    // Query state
    channels,
    isFetchingChannels,
    hasMoreChannels,
    
    // Query functions
    fetchChannels,
    
    // Mutation state
    isCreatingChannel,
    
    // Mutation functions
    createChannel,
    
    // Error state
    channelError,
  };
};

