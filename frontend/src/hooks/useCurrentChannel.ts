import { useState, useCallback, useRef } from 'react';
import { useMessagingClient } from '../providers/MessagingClientProvider';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { DecryptedChannelObject, DecryptMessageResult, ChannelMessagesDecryptedRequest, PollingState } from '@mysten/messaging';
import { useChannelMembership } from './useChannelMembership';
import { useSponsoredTransaction } from './useSponsoredTransaction';

/**
 * Hook for managing the current channel, messages, and message operations.
 * Groups message-related queries and mutations together.
 */
export const useCurrentChannel = () => {
  const messagingClient = useMessagingClient();
  const { sponsorAndExecuteTransaction } = useSponsoredTransaction();
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const { getMemberCapForChannel } = useChannelMembership();

  // Current channel state
  const [currentChannel, setCurrentChannel] = useState<DecryptedChannelObject | null>(null);
  const [messages, setMessages] = useState<DecryptMessageResult[]>([]);
  const [isFetchingMessages, setIsFetchingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [pollingState, setPollingState] = useState<PollingState | null>(null);

  // Track in-flight requests to prevent duplicate simultaneous calls
  const inFlightRequests = useRef<Set<string>>(new Set());
  // Ref to track cursor without causing callback recreation
  const messagesCursorRef = useRef<bigint | null>(null);

  // ============================================
  // QUERIES (Read Operations)
  // ============================================

  /**
   * Get a specific channel by ID and set it as the current channel.
   * Resets polling state and message cursor when channel changes.
   * 
   * @param channelId - The channel ID to fetch
   * @returns The channel object, or null if not found
   * 
   * @example
   * const channel = await getChannelById('0xabc...');
   */
  const getChannelById = useCallback(async (channelId: string) => {
    if (!messagingClient || !currentAccount) {
      return null;
    }

    setMessageError(null);
    // Reset polling state and cursor when channel changes
    setPollingState(null);
    messagesCursorRef.current = null;

    try {
      const response = await messagingClient.getChannelObjectsByChannelIds({
        channelIds: [channelId],
        userAddress: currentAccount.address,
      });

      if (response.length > 0) {
        setCurrentChannel(response[0]);
        return response[0];
      }
      return null;
    } catch (err) {
      const errorMsg = err instanceof Error ? `[getChannelById] ${err.message}` : '[getChannelById] Failed to fetch channel';
      setMessageError(errorMsg);
      console.error('Error fetching channel:', err);
      return null;
    }
  }, [messagingClient, currentAccount]);

  /**
   * Fetch messages for the current channel.
   * Uses getChannelMessages with backward direction for initial load and pagination.
   * 
   * @param loadMore - If true, fetches older messages and prepends them. If false, fetches recent messages.
   * 
   * @example
   * // Initial load
   * fetchMessages();
   * 
   * // Load more (pagination - scroll up for older messages)
   * fetchMessages(true);
   */
  const fetchMessages = useCallback(async (loadMore: boolean = false) => {
    if (!messagingClient || !currentAccount || !currentChannel) {
      return;
    }

    const channelId = currentChannel.id.id;
    const cursor = loadMore ? messagesCursorRef.current : null;
    const requestKey = `fetchMessages-${channelId}-${cursor ?? 'initial'}`;
    
    // Check if request is already in flight
    if (inFlightRequests.current.has(requestKey)) {
      return;
    }

    inFlightRequests.current.add(requestKey);
    setIsFetchingMessages(true);
    setMessageError(null);

    try {
      // Use getChannelMessages with backward direction for initial load and pagination
      const response = await messagingClient.getChannelMessages({
        channelId,
        userAddress: currentAccount.address,
        cursor: cursor, // null for initial load, existing cursor for pagination
        limit: 20,
        direction: 'backward', // fetch older messages
      });

      if (!loadMore) {
        // Initial fetch, replace messages
        setMessages(response.messages);
        // Initialize polling state with the newest message cursor
        setPollingState({
          channelId,
          lastCursor: response.cursor,
          lastMessageCount: BigInt(response.messages.length),
        });
      } else {
        // Pagination, prepend older messages to the start of the array
        setMessages(prev => [...response.messages, ...prev]);
      }

      // Update messagesCursor and hasMoreMessages
      messagesCursorRef.current = response.cursor;
      setHasMoreMessages(response.hasNextPage);
    } catch (err) {
      const errorMsg = err instanceof Error ? `[fetchMessages] ${err.message}` : '[fetchMessages] Failed to fetch messages';
      setMessageError(errorMsg);
      console.error('Error fetching messages:', err);
    } finally {
      setIsFetchingMessages(false);
      inFlightRequests.current.delete(requestKey);
    }
  }, [messagingClient, currentAccount, currentChannel]);

  /**
   * Fetch only new messages since last poll (for auto-refresh).
   * Uses getLatestMessages with polling state to efficiently fetch only new messages.
   * Appends new messages to the end of the list without resetting pagination.
   * 
   * @example
   * // In a useEffect with setInterval
   * const interval = setInterval(() => {
   *   fetchLatestMessages();
   * }, 10000);
   */
  const fetchLatestMessages = useCallback(async () => {
    if (!messagingClient || !currentAccount || !currentChannel) {
      return;
    }

    const channelId = currentChannel.id.id;

    if (!pollingState || pollingState.channelId !== channelId) {
      // If no polling state, fall back to regular fetch
      return fetchMessages();
    }

    const requestKey = `fetchLatestMessages-${channelId}`;
    
    // Check if request is already in flight
    if (inFlightRequests.current.has(requestKey)) {
      return;
    }

    inFlightRequests.current.add(requestKey);
    setMessageError(null);

    try {
      const response = await messagingClient.getLatestMessages({
        channelId,
        userAddress: currentAccount.address,
        pollingState,
        limit: 50,
      });

      // Only append if there are new messages
      if (response.messages.length > 0) {
        // Append new messages to the end of the array
        setMessages(prev => [...prev, ...response.messages]);

        // Update polling state with new cursor and total message count
        setPollingState(prevState => ({
          channelId,
          lastCursor: response.cursor,
          lastMessageCount: BigInt((prevState?.lastMessageCount || BigInt(0)) as any) + BigInt(response.messages.length),
        }));

        // Update messagesCursor for pagination continuity
        messagesCursorRef.current = response.cursor;
      }
      
      setHasMoreMessages(response.hasNextPage);
    } catch (err) {
      // Silently fail for polling - don't show errors for background refreshes
      console.error('Error fetching latest messages:', err);
    } finally {
      inFlightRequests.current.delete(requestKey);
    }
  }, [messagingClient, currentAccount, currentChannel, pollingState, fetchMessages]);

  /**
   * Internal utility: Get encrypted key for the current channel
   */
  const getEncryptedKeyForChannel = useCallback(async () => {
    if (!currentChannel) return null;

    const encryptedKeyBytes = currentChannel.encryption_key_history.latest;
    const keyVersion = currentChannel.encryption_key_history.latest_version;

    return {
      $kind: 'Encrypted' as const,
      encryptedBytes: new Uint8Array(encryptedKeyBytes),
      version: keyVersion,
    } as ChannelMessagesDecryptedRequest['encryptedKey'];
  }, [currentChannel]);

  // ============================================
  // MUTATIONS (Write Operations)
  // ============================================

  /**
   * Send a message to the current channel.
   * 
   * This demonstrates the complete message sending flow:
   * 1. Get member cap for the channel
   * 2. Get encryption key
   * 3. Build and execute the send message transaction
   * 4. Wait for confirmation
   * 5. Poll for new messages (including the sent message)
   * 
   * @param message - The message text to send
   * @param attachments - Optional array of files to attach
   * @returns Object containing the transaction digest, or null if failed
   * 
   * @example
   * const result = await sendMessage('Hello!', [fileAttachment]);
   * if (result) {
   *   console.log('Message sent:', result.digest);
   * }
   */
  const sendMessage = useCallback(async (message: string, attachments?: File[]) => {
    if (!messagingClient || !currentAccount || !currentChannel) {
      setMessageError('[sendMessage] Messaging client, account, or channel not available');
      return null;
    }

    const channelId = currentChannel.id.id;

    setIsSendingMessage(true);
    setMessageError(null);

    try {
      // Get member cap ID
      const memberCapId = await getMemberCapForChannel(channelId);
      if (!memberCapId) {
        throw new Error('No member cap found for channel');
      }

      // Get encrypted key
      const encryptedKey = await getEncryptedKeyForChannel();
      if (!encryptedKey) {
        throw new Error('No encrypted key found for channel');
      }

      console.log('encryptedKey', encryptedKey)
      console.log('message', message)
      

      // Create and execute send message transaction using sponsored transaction
      const tx = new Transaction();
      const sendMessageTxBuilder = await messagingClient.sendMessage(
        channelId,
        memberCapId,
        currentAccount.address,
        message,
        encryptedKey,
      );
      await sendMessageTxBuilder(tx);

      const result = await sponsorAndExecuteTransaction(tx);

      if (!result) {
        throw new Error('Failed to execute sponsored transaction');
      }

      // Wait for transaction
      await suiClient.waitForTransaction({
        digest: result.digest,
        options: { showEffects: true },
      });

      // Poll for new messages (will include the sent message)
      await fetchMessages();

      return { digest: result.digest };
    } catch (err) {
      const errorMsg = err instanceof Error ? `[sendMessage] ${err.message}` : '[sendMessage] Failed to send message';
      setMessageError(errorMsg);
      console.error('Error sending message:', err);
      return null;
    } finally {
      setIsSendingMessage(false);
    }
  }, [messagingClient, currentAccount, currentChannel, sponsorAndExecuteTransaction, suiClient, getMemberCapForChannel, getEncryptedKeyForChannel, fetchMessages]);

  return {
    // Query state
    currentChannel,
    messages,
    isFetchingMessages,
    hasMoreMessages,
    
    // Query functions
    getChannelById,
    fetchMessages,
    fetchLatestMessages,
    
    // Mutation state
    isSendingMessage,
    
    // Mutation functions
    sendMessage,
    
    // Error state
    messageError,
  };
};

