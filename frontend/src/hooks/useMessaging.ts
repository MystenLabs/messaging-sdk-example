import { useMessagingClient } from '../providers/MessagingClientProvider';
import { useSessionKey } from '../providers/SessionKeyProvider';
import { useChannelList } from './useChannelList';
import { useCurrentChannel } from './useCurrentChannel';

/**
 * Facade hook that composes all messaging functionality.
 * This hook provides backwards compatibility by combining useChannelList and useCurrentChannel.
 * 
 * For better performance in production, consider using the specific hooks directly:
 * - useChannelList: For channel list and creation
 * - useCurrentChannel: For current channel and messages
 * 
 * @example
 * // Using the facade (backwards compatible)
 * const { channels, messages, sendMessage } = useMessaging();
 * 
 * @example
 * // Using specific hooks (better performance)
 * const { channels, createChannel } = useChannelList();
 * const { messages, sendMessage } = useCurrentChannel();
 */
export const useMessaging = () => {
  const messagingClient = useMessagingClient();
  const { sessionKey, isInitializing, error } = useSessionKey();
  
  // Compose the focused hooks
  const channelList = useChannelList();
  const currentChannel = useCurrentChannel();

  return {
    // Messaging client and session state
    client: messagingClient,
    sessionKey,
    isInitializing,
    error,
    isReady: !!messagingClient && !!sessionKey,

    // Channel list queries and state
    channels: channelList.channels,
    fetchChannels: channelList.fetchChannels,
    isFetchingChannels: channelList.isFetchingChannels,
    hasMoreChannels: channelList.hasMoreChannels,

    // Channel list mutations
    createChannel: channelList.createChannel,
    isCreatingChannel: channelList.isCreatingChannel,

    // Current channel queries and state
    currentChannel: currentChannel.currentChannel,
    messages: currentChannel.messages,
    getChannelById: currentChannel.getChannelById,
    fetchMessages: currentChannel.fetchMessages,
    fetchLatestMessages: currentChannel.fetchLatestMessages,
    isFetchingMessages: currentChannel.isFetchingMessages,
    hasMoreMessages: currentChannel.hasMoreMessages,

    // Message mutations
    sendMessage: currentChannel.sendMessage,
    isSendingMessage: currentChannel.isSendingMessage,

    // Combined error state (for backwards compatibility)
    channelError: channelList.channelError || currentChannel.messageError,
    
    // Legacy exports for backwards compatibility
    messagesCursor: null, // Now managed internally as ref
  };
};
