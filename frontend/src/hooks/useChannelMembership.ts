import { useState, useCallback } from 'react';
import { useMessagingClient } from '../providers/MessagingClientProvider';
import { useCurrentAccount } from '@mysten/dapp-kit';

/**
 * Internal utility hook for managing member cap caching.
 * This hook provides efficient member cap lookups by caching memberships.
 */
export const useChannelMembership = () => {
  const messagingClient = useMessagingClient();
  const currentAccount = useCurrentAccount();

  // Cache for member caps to avoid repeated membership fetches
  const [memberCapCache, setMemberCapCache] = useState<Map<string, string>>(new Map());
  const [membershipsCache, setMembershipsCache] = useState<{ memberships: Array<{ member_cap_id: string; channel_id: string }> } | null>(null);

  /**
   * Get member cap ID for a specific channel.
   * Uses caching to avoid repeated API calls.
   */
  const getMemberCapForChannel = useCallback(async (channelId: string): Promise<string | null> => {
    if (!messagingClient || !currentAccount) {
      return null;
    }

    // Check cache first
    const cachedCap = memberCapCache.get(channelId);
    if (cachedCap) {
      return cachedCap;
    }

    try {
      // Use cached memberships if available, otherwise fetch
      let memberships = membershipsCache;
      if (!memberships) {
        memberships = await messagingClient.getChannelMemberships({
          address: currentAccount.address,
        });
        setMembershipsCache(memberships);
      }

      const membership = memberships.memberships.find(m => m.channel_id === channelId);
      const memberCapId = membership?.member_cap_id || null;
      
      // Cache the result
      if (memberCapId) {
        setMemberCapCache(prev => new Map(prev).set(channelId, memberCapId));
      }
      
      return memberCapId;
    } catch (err) {
      console.error('Error getting member cap:', err);
      return null;
    }
  }, [messagingClient, currentAccount, memberCapCache, membershipsCache]);

  /**
   * Clear all caches. Useful when account changes or channels are refreshed.
   */
  const clearCache = useCallback(() => {
    setMemberCapCache(new Map());
    setMembershipsCache(null);
  }, []);

  return {
    getMemberCapForChannel,
    clearCache,
  };
};

