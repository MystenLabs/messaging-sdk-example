import { useState, useEffect } from 'react';
import { Card, Flex, Text, Button, Box } from '@radix-ui/themes';
import { useMessaging } from '../hooks/useMessaging';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { trackEvent, AnalyticsEvents } from '../utils/analytics';

const AI_BOT_ADDRESS = '0x4ab7f7e53747695ee8302328ac2adb0eda1b78d719f1e1ef7a06d39cf0dd052f';

export function ChatWithAI() {
  const { channels, createChannel, isCreatingChannel, isFetchingChannels, isReady, client } = useMessaging();
  const currentAccount = useCurrentAccount();
  const [isCheckingChannel, setIsCheckingChannel] = useState(true);
  const [existingChannelId, setExistingChannelId] = useState<string | null>(null);

  // Check if a channel with the AI bot already exists
  useEffect(() => {
    if (!isReady || isFetchingChannels || !channels || !client) {
      setIsCheckingChannel(true);
      return;
    }

    const checkForAIChannel = async () => {
      setIsCheckingChannel(true);

      try {
        // Check each channel for AI bot membership
        for (const channel of channels) {
          const membersResponse = await client.getChannelMembers(channel.id.id);
          const memberAddresses = membersResponse.members.map((m) => m.memberAddress.toLowerCase());

          if (memberAddresses.includes(AI_BOT_ADDRESS.toLowerCase())) {
            setExistingChannelId(channel.id.id);
            setIsCheckingChannel(false);
            return;
          }
        }

        // No AI channel found
        setExistingChannelId(null);
      } catch (error) {
        console.error('Error checking for AI channel:', error);
      } finally {
        setIsCheckingChannel(false);
      }
    };

    checkForAIChannel();
  }, [channels, isReady, isFetchingChannels, client]);

  const handleChatWithAI = async () => {
    if (!currentAccount) {
      return;
    }

    // If channel exists, navigate to it
    if (existingChannelId) {
      trackEvent(AnalyticsEvents.CHANNEL_OPENED, {
        channel_id: existingChannelId,
        is_ai_bot: true,
      });
      window.location.hash = existingChannelId;
      return;
    }

    // Otherwise, create a new channel with the AI bot
    const result = await createChannel([AI_BOT_ADDRESS]);

    if (result?.channelId) {
      trackEvent(AnalyticsEvents.CHANNEL_CREATED, {
        channel_id: result.channelId,
        is_ai_bot: true,
      });
      // Navigate to the newly created channel
      window.location.hash = result.channelId;
    }
  };

  const getButtonText = () => {
    if (isCheckingChannel || isFetchingChannels) return 'Checking...';
    if (isCreatingChannel) return 'Creating AI Channel...';
    if (existingChannelId) return 'Chat with AI';
    return 'Start Chat with AI';
  };

  const getDescription = () => {
    if (isCheckingChannel || isFetchingChannels) {
      return 'Checking for existing AI conversation...';
    }
    if (existingChannelId) {
      return 'Continue your conversation with our AI assistant';
    }
    return 'Start a new conversation with our AI assistant';
  };

  return (
    <Card mb="4" style={{
      background: 'linear-gradient(135deg, var(--accent-a2) 0%, var(--accent-a3) 100%)',
      border: '2px solid var(--accent-a5)',
    }}>
      <Flex direction="column" gap="3" align="center" justify="center" py="4">
        <Box>
          <Text size="5" weight="bold" align="center" style={{ display: 'block' }}>
            🤖 AI Assistant
          </Text>
          <Text size="2" color="gray" align="center" style={{ display: 'block', marginTop: '8px' }}>
            {getDescription()}
          </Text>
        </Box>

        <Button
          size="4"
          onClick={handleChatWithAI}
          disabled={!isReady || isCheckingChannel || isCreatingChannel || isFetchingChannels}
          style={{ minWidth: '200px' }}
        >
          {getButtonText()}
        </Button>

        {!isReady && (
          <Text size="2" color="gray">
            Waiting for messaging client to initialize...
          </Text>
        )}
      </Flex>
    </Card>
  );
}
