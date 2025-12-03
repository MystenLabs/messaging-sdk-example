import { SuiStackMessagingClient, ChannelMessagesDecryptedRequest } from '@mysten/messaging';
import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';

export class MessageSender {
  private messagingClient: SuiStackMessagingClient;
  private suiClient: SuiClient;
  private keypair: Ed25519Keypair;
  private botAddress: string;

  constructor(
    messagingClient: SuiStackMessagingClient,
    suiClient: SuiClient,
    keypair: Ed25519Keypair,
    botAddress: string
  ) {
    this.messagingClient = messagingClient;
    this.suiClient = suiClient;
    this.keypair = keypair;
    this.botAddress = botAddress;
  }

  /**
   * Update the messaging client (used when session key is renewed)
   */
  updateMessagingClient(messagingClient: SuiStackMessagingClient): void {
    this.messagingClient = messagingClient;
  }

  /**
   * Send a message to a channel
   * @param channelId The channel ID to send the message to
   * @param messageText The message text to send
   */
  async sendMessage(channelId: string, messageText: string): Promise<void> {
    try {
      console.log(`📤 Sending message to channel ${channelId}...`);

      // 1. Get member cap for channel
      const memberCapId = await this.getMemberCapForChannel(channelId);
      if (!memberCapId) {
        throw new Error(`No member cap found for channel ${channelId}`);
      }

      // 2. Get encrypted key for channel
      const encryptedKey = await this.getEncryptedKeyForChannel(channelId);
      if (!encryptedKey) {
        throw new Error(`No encrypted key found for channel ${channelId}`);
      }

      // 3. Create transaction
      const tx = new Transaction();

      tx.setSender(this.keypair.toSuiAddress())

      // 4. Use messagingClient.sendMessage() to create transaction builder
      const sendMessageTxBuilder = await this.messagingClient.sendMessage(
        channelId,
        memberCapId,
        this.botAddress,
        messageText,
        encryptedKey,
        undefined // No attachments for now
      );

      // 5. Build transaction
      await sendMessageTxBuilder(tx);

      // 7. Sign transaction with bot's keypair
      const result = await this.keypair.signAndExecuteTransaction({
        transaction: tx, 
        client: this.suiClient
      });

      // 8. Wait for transaction confirmation
      await this.suiClient.waitForTransaction({
        digest: result.digest,
        options: { showEffects: true },
      });

      console.log(`✅ Message sent successfully (tx: ${result.digest})`);
    } catch (error) {
      console.error(`❌ Error sending message to channel ${channelId}:`, error);
      throw error;
    }
  }

  /**
   * Get member cap ID for a channel
   */
  private async getMemberCapForChannel(channelId: string): Promise<string | null> {
    try {
      const memberships = await this.messagingClient.getChannelMemberships({
        address: this.botAddress,
      });

      const membership = memberships.memberships.find(
        (m) => m.channel_id === channelId
      );

      return membership?.member_cap_id || null;
    } catch (error) {
      console.error('Error getting member cap:', error);
      return null;
    }
  }

  /**
   * Get encrypted key for a channel
   */
  private async getEncryptedKeyForChannel(channelId: string): Promise<ChannelMessagesDecryptedRequest['encryptedKey'] | null> {
    try {
      // Get channel object to access encryption key
      // getChannelObjectsByChannelIds returns an array directly
      const channels = await this.messagingClient.getChannelObjectsByChannelIds({
        channelIds: [channelId],
        userAddress: this.botAddress,
      });

      if (!channels || channels.length === 0) {
        return null;
      }

      const channel = channels[0];
      const encryptedKeyBytes = channel.encryption_key_history.latest;
      const keyVersion = channel.encryption_key_history.latest_version;

      // Ensure encryptedBytes is properly typed
      // Create a new ArrayBuffer and copy the bytes to ensure proper typing
      const buffer = new ArrayBuffer(encryptedKeyBytes.length);
      const view = new Uint8Array(buffer);
      view.set(encryptedKeyBytes);

      // Convert version to number if it's bigint (to match EncryptedSymmetricKey type)
      const versionNumber = typeof keyVersion === 'bigint' ? Number(keyVersion) : keyVersion;

      return {
        $kind: 'Encrypted' as const,
        encryptedBytes: view,
        version: versionNumber,
      } as ChannelMessagesDecryptedRequest['encryptedKey'];
    } catch (error) {
      console.error('Error getting encrypted key:', error);
      return null;
    }
  }
}

