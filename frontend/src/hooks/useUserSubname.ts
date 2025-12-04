import { useCurrentAccount } from '@mysten/dapp-kit';
import { useQuery } from '@tanstack/react-query';

const ENOKI_API_KEY = 'enoki_public_4e47cb0c7a02b73409dbc2131b862590';
const NETWORK = 'testnet';
const DOMAIN = 'sui-stack.sui';

interface SubnamesResponse {
  subnames: Array<{
    name: string;
    status: string;
    createdAt: string;
  }>;
}

async function fetchUserSubnames(address: string): Promise<SubnamesResponse> {
  const response = await fetch(
    'https://api.enoki.mystenlabs.com/v1/subnames?' +
      new URLSearchParams({
        network: NETWORK,
        address: address,
        domain: DOMAIN,
      }),
    {
      headers: {
        Authorization: `Bearer ${ENOKI_API_KEY}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error('Failed to fetch subnames');
  }

  const data = await response.json();
  return data.data;
}

export const useUserSubname = () => {
  const currentAccount = useCurrentAccount();

  const query = useQuery({
    queryKey: ['subnames', currentAccount?.address],
    queryFn: () => fetchUserSubnames(currentAccount!.address),
    enabled: !!currentAccount?.address,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  const subname = query.data?.subnames?.[0]?.name;
  const hasSubname = !!subname;

  return {
    subname,
    hasSubname,
    isLoading: query.isLoading,
    error: query.error,
  };
};
