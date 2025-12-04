import { useCurrentAccount, useWallets } from '@mysten/dapp-kit';
import { AuthProvider, EnokiWallet, getSession, isEnokiWallet } from '@mysten/enoki';
import { useEffect, useState } from 'react';

/**
 * Hook to get the zkLogin JWT from the Enoki wallet session.
 * This is required for making authenticated requests to Enoki APIs
 * like sponsored transactions and subname creation.
 *
 * @returns Object containing jwt, isLoading, and error state
 *
 * @example
 * const { jwt, isLoading, error } = useSessionJWT();
 * if (jwt) {
 *   // Use jwt for authenticated requests
 * }
 */
export const useSessionJWT = () => {
  const currentAccount = useCurrentAccount();
  const wallets = useWallets();
  const [jwt, setJwt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!currentAccount) {
      setJwt(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Find the Enoki wallet (currently only Google is supported)
    const enokiWallets = wallets.filter(isEnokiWallet);
    const walletsByProvider = enokiWallets.reduce(
      (map, wallet) => map.set(wallet.provider, wallet),
      new Map<AuthProvider, EnokiWallet>(),
    );
    const googleWallet = walletsByProvider.get('google');

    if (googleWallet) {
      getSession(googleWallet)
        .then((session) => {
          if (!session?.jwt) {
            throw new Error('Session does not contain JWT');
          }
          console.log('Session JWT retrieved successfully');
          setJwt(session.jwt);
          setIsLoading(false);
        })
        .catch((err) => {
          console.error('Error fetching session JWT:', err);
          setError(err instanceof Error ? err : new Error('Failed to fetch session JWT'));
          setJwt(null);
          setIsLoading(false);
        });
    } else {
      setError(new Error('No Enoki wallet found'));
      setJwt(null);
      setIsLoading(false);
    }
  }, [currentAccount, wallets]);

  return { jwt, isLoading, error };
};
