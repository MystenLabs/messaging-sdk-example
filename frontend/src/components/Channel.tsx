import { useEffect, useState, useRef } from 'react';
import { Card, Flex, Text, Box, Button, TextField, Badge, IconButton } from '@radix-ui/themes';
import { FileIcon, Cross2Icon } from '@radix-ui/react-icons';
import { useMessaging } from '../hooks/useMessaging';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { formatTimestamp, formatAddress } from '../utils/formatters';
import { trackEvent, trackError, AnalyticsEvents } from '../utils/analytics';
import { AttachmentDisplay } from './AttachmentDisplay';
import { formatFileSize, getFileIcon } from '../utils/attachments';
import { useSessionKey } from '../providers/SessionKeyProvider';
import { SessionExpirationModal } from './SessionExpirationModal';

interface ChannelProps {
  channelId: string;
  onBack: () => void;
  onInteraction?: () => void;
}

export function Channel({ channelId, onBack, onInteraction }: ChannelProps) {
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
    messagesCursor,
    hasMoreMessages,
    channelError,
    isReady,
  } = useMessaging();

  const [messageText, setMessageText] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  // Fetch channel and messages on mount
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

    let isMounted = true;

    // Fetch channel and messages
    getChannelById(channelId).then(() => {
      if (isMounted && !checkSessionExpiration()) {
        fetchMessages(channelId);
      }
    });

    // Auto-refresh messages every 60 seconds (only fetch new messages, don't replace existing)
    const interval = setInterval(() => {
      if (isMounted && !checkSessionExpiration()) {
        fetchLatestMessages(channelId);
      }
    }, 60000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
    // Only re-run when channelId or isReady changes, not when functions change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, channelId, sessionKey]);

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

    if ((!messageText.trim() && selectedFiles.length === 0) || isSendingMessage) {
      return;
    }

    const attachments = selectedFiles.length > 0 ? selectedFiles : undefined;
    const result = await sendMessage(channelId, messageText, attachments);
    if (result) {
      setMessageText(''); // Clear input on success
      setSelectedFiles([]); // Clear selected files
      // Track successful message send
      trackEvent(AnalyticsEvents.MESSAGE_SENT, {
        channel_id: channelId,
        message_length: messageText.length,
        has_attachments: attachments ? attachments.length : 0,
      });
      // Track interaction for feedback
      if (onInteraction) {
        onInteraction();
      }
    } else if (channelError) {
      // Track message sending error
      trackError('message_send', channelError, {
        channel_id: channelId,
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setSelectedFiles(prev => [...prev, ...files]);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleLoadMore = () => {
    // Check expiration before loading more
    if (checkSessionExpiration()) {
      return;
    }

    if (messagesCursor && !isFetchingMessages) {
      isLoadingOlderRef.current = true;
      fetchMessages(channelId, messagesCursor);
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
                      {message.attachments && message.attachments.length > 0 && (
                        <Flex direction="column" gap="1" mt={message.text ? "2" : "0"}>
                          {message.attachments.map((attachment, attIndex) => (
                            <AttachmentDisplay key={attIndex} attachment={attachment} />
                          ))}
                        </Flex>
                      )}
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
        {/* Selected Files Preview */}
        {selectedFiles.length > 0 && (
          <Box mb="2" p="2" style={{ backgroundColor: 'var(--gray-a2)', borderRadius: 'var(--radius-2)' }}>
            <Flex direction="column" gap="1">
              {selectedFiles.map((file, index) => (
                <Flex key={index} gap="2" align="center" justify="between">
                  <Flex gap="2" align="center" style={{ flex: 1, minWidth: 0 }}>
                    <Text size="3">{getFileIcon(file.type, file.name)}</Text>
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <Text size="2" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {file.name}
                      </Text>
                      <Text size="1" color="gray">
                        {formatFileSize(file.size)}
                      </Text>
                    </Box>
                  </Flex>
                  <IconButton
                    size="1"
                    variant="ghost"
                    onClick={() => handleRemoveFile(index)}
                    style={{ flexShrink: 0 }}
                  >
                    <Cross2Icon />
                  </IconButton>
                </Flex>
              ))}
            </Flex>
          </Box>
        )}

        <form onSubmit={handleSendMessage}>
          <Flex gap="2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              disabled={isSendingMessage || !isReady || isSessionExpired}
            />
            <IconButton
              size="3"
              variant="soft"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSendingMessage || !isReady || isSessionExpired}
            >
              <FileIcon />
            </IconButton>
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
              disabled={(!messageText.trim() && selectedFiles.length === 0) || isSendingMessage || !isReady || isSessionExpired}
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