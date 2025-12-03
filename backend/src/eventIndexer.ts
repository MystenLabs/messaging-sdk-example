import 'dotenv/config';
import { SuiClient } from '@mysten/sui/client';
import { EventId, SuiEvent, SuiEventFilter } from '@mysten/sui/client';
import { SuiStackMessagingClient } from '@mysten/messaging';
import { PACKAGE_ID, SUI_RPC_URL } from './config.js';
import { exit } from 'process';

type SuiEventsCursor = EventId | null | undefined;

export interface IndexedMessage {
  channelId: string;
  sender: string;
  text: string;
  timestamp: bigint;
  messageIndex: number;
  keyVersion: number;
}

export class MessageIndexer {
  private client: SuiClient;
  private messagingClient: SuiStackMessagingClient;
  private botAddress: string;
  private botMemberChannels: Set<string> = new Set();
  private startTimestamp: bigint;

  constructor(messagingClient: SuiStackMessagingClient, botAddress: string) {
    this.client = new SuiClient({ url: SUI_RPC_URL });
    this.messagingClient = messagingClient;
    this.botAddress = botAddress;
    // Set start timestamp to current time - only process messages after this
    this.startTimestamp = BigInt(Date.now());
    console.log(`⏰ Bot start time: ${new Date(Number(this.startTimestamp)).toISOString()}`);
  }

  /**
   * Update the messaging client (used when session key is renewed)
   */
  updateMessagingClient(messagingClient: SuiStackMessagingClient): void {
    this.messagingClient = messagingClient;
  }

  /**
   * Get initial cursor to start from (skips historical messages)
   */
  async getInitialCursor(): Promise<SuiEventsCursor> {
    try {
      const filter: SuiEventFilter = {
        MoveEventModule: {
          module: 'message',
          package: PACKAGE_ID,
        },
      };

      const { nextCursor } = await this.client.queryEvents({
        query: filter,
        order: 'descending',
        limit: 0,
      });

      return nextCursor;
    } catch (error) {
      console.error('⚠️  Error getting initial cursor:', error);
      return null;
    }
  }

  /**
   * Get messages since the given cursor
   * Returns filtered messages (only from bot's channels, excluding bot's own messages)
   */
  async getMessagesSince(cursor: SuiEventsCursor): Promise<{
    messages: IndexedMessage[];
    nextCursor: SuiEventsCursor;
  }> {
    try {
      await this.updateBotMemberChannels();

      const filter: SuiEventFilter = {
        MoveEventModule: {
          module: 'message',
          package: PACKAGE_ID,
        },
      };

      const { data, hasNextPage, nextCursor } = await this.client.queryEvents({
        query: filter,
        cursor,
        order: 'ascending',
      });

      const filteredMessages = await this.filterAndDecryptMessages(data);

      return {
        messages: filteredMessages,
        nextCursor: nextCursor || cursor,
      };
    } catch (error) {
      console.error('❌ Error getting messages:', error);
      return {
        messages: [],
        nextCursor: cursor,
      };
    }
  }

  /**
   * Filter and decrypt messages
   */
  private async filterAndDecryptMessages(events: SuiEvent[]): Promise<IndexedMessage[]> {
    const messages: IndexedMessage[] = [];

    for (const event of events) {
      // Only MessageAddedEvent
      if (!event.type.endsWith('MessageAddedEvent')) {
        continue;
      }

      const eventData = event.parsedJson as any;
      const channelId = eventData.channel_id;
      const sender = eventData.sender;

      // Skip if not in bot's member channels
      if (!this.botMemberChannels.has(channelId)) {
        continue;
      }

      // Skip bot's own messages
      if (sender === this.botAddress) {
        continue;
      }

      // Skip messages sent before bot started
      const messageTimestamp = BigInt(event.timestampMs || '0');
      if (messageTimestamp < this.startTimestamp) {
        continue;
      }

      try {
        console.log(eventData);
        exit
        // Decrypt message
        const decryptedText = await this.decryptMessage(
          channelId,
          eventData.message_index
        );

        if (decryptedText) {
          messages.push({
            channelId,
            sender,
            text: decryptedText,
            timestamp: BigInt(event.timestampMs || '0'),
            messageIndex: eventData.message_index,
            keyVersion: eventData.key_version,
          });
        }
      } catch (error) {
        console.error(`Failed to decrypt message in channel ${channelId}:`, error);
      }
    }

    return messages;
  }

  /**
   * Decrypt a message using the messaging client
   */
  private async decryptMessage(
    channelId: string,
    messageCursor: string
  ): Promise<string | null> {
    try {
      const response = await this.messagingClient.getLatestMessages({
        channelId,
        userAddress: this.botAddress,
        pollingState: {
          lastCursor: null, 
          channelId, 
          lastMessageCount: BigInt(messageCursor)
        },
        limit: 1
      });
      console.log(response)

      if (response.messages.length > 0 && response.messages[0].text) {
        return response.messages[0].text;
      }

      return null;
    } catch (error) {
      console.error('Error decrypting message:', error);
      return null;
    }
  }

  /**
   * Update the list of channels where bot is a member
   */
  private async updateBotMemberChannels(): Promise<void> {
    console.log('🔍 Fetching bot member channels...');

    try {
      const memberCapType = `${PACKAGE_ID}::member_cap::MemberCap`;
      let cursor = null;
      let hasNextPage = true;
      const allMemberCaps = [];

      while (hasNextPage) {
        const response = await this.client.getOwnedObjects({
          owner: this.botAddress,
          filter: { StructType: memberCapType },
          options: {
            showContent: true,
          },
          cursor,
        });

        allMemberCaps.push(...response.data);
        hasNextPage = response.hasNextPage;
        cursor = response.nextCursor;
      }

      console.log(`📋 Found ${allMemberCaps.length} member cap(s) for bot`);

      this.botMemberChannels.clear();
      for (const memberCap of allMemberCaps) {
        if (memberCap.data?.content?.dataType === 'moveObject') {
          const fields = (memberCap.data.content as any).fields;
          const channelId = fields.channel_id;
          if (channelId) {
            this.botMemberChannels.add(channelId);
            console.log(`   ✓ Channel: ${channelId.slice(0, 8)}...`);
          }
        }
      }

      console.log(`✅ Tracking ${this.botMemberChannels.size} channel(s)\n`);
    } catch (error) {
      console.error('❌ Error fetching member channels:', error);
    }
  }
}
