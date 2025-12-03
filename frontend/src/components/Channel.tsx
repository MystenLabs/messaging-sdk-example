import { useEffect, useState, useRef } from 'react';
import { Card, Flex, Text, Box, Button, TextField, Badge } from '@radix-ui/themes';
import { useMessaging } from '../hooks/useMessaging';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { formatTimestamp, formatAddress } from '../utils/formatters';
import { trackEvent, trackError, AnalyticsEvents } from '../utils/analytics';
import { useSessionKey } from '../providers/SessionKeyProvider';
import { SessionExpirationModal } from './SessionExpirationModal';

interface ChannelProps {
  channelId: string;
  onBack: () => void;
}

export function Channel({ channelId, onBack }: ChannelProps) {
  const currentAccount = useCurrentAccount();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isLoadingOlderRef = useRef(false);
  const { sessionKey } = useSessionKey();
  const {
    currentChannel,
    messages,
    getChannelById,
    fetchMessages,
    fetchLatestMessages,
    sendMessage,
    isFetchingMessages,
    isSendingMessage,
    hasMoreMessages,
    channelError,
    isReady,
  } = useMessaging();

  const [messageText, setMessageText] = useState('');
  const [isSessionExpired, setIsSessionExpired] = useState(false);

  // Check session expiration
  const checkSessionExpiration = () => {
    if (sessionKey && sessionKey.isExpired()) {
      setIsSessionExpired(true);
      return true;
    }
    setIsSessionExpired(false);
    return false;
  };

  // Monitor session key changes
  useEffect(() => {
    if (sessionKey) {
      // Check if expired when session key exists
      if (sessionKey.isExpired()) {
        setIsSessionExpired(true);
      } else {
        setIsSessionExpired(false);
      }
    } else {
      // No session key means it's expired or not initialized
      setIsSessionExpired(true);
    }
  }, [sessionKey]);

  // Fetch channel on mount
  useEffect(() => {
    if (!isReady || !channelId) return;

    // Check expiration before fetching
    if (checkSessionExpiration()) {
      return;
    }

    // Track channel open event
    trackEvent(AnalyticsEvents.CHANNEL_OPENED, {
      channel_id: channelId,
    });

    // Fetch channel object (messages will be fetched in separate effect when channel loads)
    getChannelById(channelId);
    
    // Only re-run when channelId or isReady changes, not when functions change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, channelId, sessionKey]);

  // Fetch messages when current channel is loaded
  useEffect(() => {
    if (!currentChannel || currentChannel.id.id !== channelId) {
      return;
    }

    if (checkSessionExpiration()) {
      return;
    }

    // Fetch initial messages for this channel
    fetchMessages();
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChannel, channelId]);

  // Auto-refresh messages every 5 seconds
  useEffect(() => {
    if (!currentChannel || !isReady) return;

    const interval = setInterval(() => {
      if (!checkSessionExpiration()) {
        fetchLatestMessages();
      }
    }, 5000);

    return () => {
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChannel, isReady]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    // Don't scroll if we're loading older messages
    if (!isLoadingOlderRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    // Reset the flag after messages update
    isLoadingOlderRef.current = false;
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check expiration before sending
    if (checkSessionExpiration()) {
      return;
    }

    if (!messageText.trim() || isSendingMessage) {
      return;
    }

    const result = await sendMessage(messageText);
    if (result) {
      setMessageText(''); // Clear input on success
      // Track successful message send
      trackEvent(AnalyticsEvents.MESSAGE_SENT, {
        channel_id: channelId,
        message_length: messageText.length,
      });
    } else if (channelError) {
      // Track message sending error
      trackError('message_send', channelError, {
        channel_id: channelId,
      });
    }
  };

  const handleLoadMore = () => {
    // Check expiration before loading more
    if (checkSessionExpiration()) {
      return;
    }

    if (hasMoreMessages && !isFetchingMessages) {
      isLoadingOlderRef.current = true;
      fetchMessages(true);
      // Track loading more messages
      trackEvent(AnalyticsEvents.MESSAGES_LOADED_MORE, {
        channel_id: channelId,
      });
    }
  };

  if (!isReady) {
    return (
      <Card>
        <Text size="2" color="gray">
          Waiting for messaging client to initialize...
        </Text>
      </Card>
    );
  }

  return (
    <>
      <SessionExpirationModal isOpen={isSessionExpired} />
      <Card style={{ height: '600px', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {/* Header */}
      <Box p="3" style={{ borderBottom: '1px solid var(--gray-a3)' }}>
        <Flex justify="between" align="center">
          <Flex gap="3" align="center">
            <Button size="2" variant="soft" onClick={onBack} disabled={isSessionExpired}>
              ← Back
            </Button>
            <Box>
              <Text size="3" weight="bold">Channel</Text>
              {currentChannel && (
                <Text size="1" color="gray" style={{ display: 'block' }}>
                  {formatAddress(currentChannel.id.id)}
                </Text>
              )}
            </Box>
          </Flex>
          {currentChannel && (
            <Flex gap="2">
              <Badge color="green" size="1">
                {currentChannel.messages_count} messages
              </Badge>
            </Flex>
          )}
        </Flex>
      </Box>

      {/* Messages Area */}
      <Box
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Load More Button */}
        {hasMoreMessages && (
          <Box style={{ textAlign: 'center', marginBottom: '16px' }}>
            <Button
              size="2"
              variant="soft"
              onClick={handleLoadMore}
              disabled={isFetchingMessages || isSessionExpired}
            >
              {isFetchingMessages ? 'Loading...' : 'Load older messages'}
            </Button>
          </Box>
        )}

        {/* Messages */}
        {messages.length === 0 && !isFetchingMessages ? (
          <Box style={{ textAlign: 'center', padding: '32px' }}>
            <Text size="2" color="gray">
              No messages yet. Start the conversation!
            </Text>
          </Box>
        ) : (
          <Flex direction="column" gap="2">
            {messages.map((message, index) => {
              const isOwnMessage = message.sender === currentAccount?.address;
              return (
                <Box
                  key={index}
                  style={{
                    alignSelf: isOwnMessage ? 'flex-end' : 'flex-start',
                    maxWidth: '70%',
                  }}
                >
                  <Box
                    p="3"
                    style={{
                      backgroundColor: isOwnMessage ? 'var(--accent-a3)' : 'var(--gray-a3)',
                      borderRadius: 'var(--radius-2)',
                    }}
                  >
                    <Flex direction="column" gap="1">
                      <Text size="1" color="gray">
                        {isOwnMessage ? 'You' : formatAddress(message.sender)}
                      </Text>
                      {message.text && <Text size="2">{message.text}</Text>}
                      <Text size="1" color="gray">
                        {formatTimestamp(message.createdAtMs)}
                      </Text>
                    </Flex>
                  </Box>
                </Box>
              );
            })}
          </Flex>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />

        {isFetchingMessages && messages.length === 0 && (
          <Box style={{ textAlign: 'center', padding: '32px' }}>
            <Text size="2" color="gray">Loading messages...</Text>
          </Box>
        )}
      </Box>

      {/* Error Display */}
      {channelError && (
        <Box p="3" style={{ borderTop: '1px solid var(--gray-a3)' }}>
          <Text size="2" color="red">
            Error: {channelError}
          </Text>
        </Box>
      )}

      {/* Message Input */}
      <Box p="3" style={{ borderTop: '1px solid var(--gray-a3)' }}>
        <form onSubmit={handleSendMessage}>
          <Flex gap="2">
            <TextField.Root
              size="3"
              placeholder="Type a message..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              disabled={isSendingMessage || !isReady || isSessionExpired}
              style={{ flex: 1 }}
            />
            <Button
              size="3"
              type="submit"
              disabled={!messageText.trim() || isSendingMessage || !isReady || isSessionExpired}
            >
              {isSendingMessage ? 'Sending...' : 'Send'}
            </Button>
          </Flex>
        </form>
      </Box>
    </Card>
    </>
  );
}