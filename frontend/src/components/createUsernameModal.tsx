import { useCurrentAccount, useWallets } from "@mysten/dapp-kit";
import { Box, Card, Flex, Heading, Button, Text, TextField } from "@radix-ui/themes";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useRef } from "react";
import {AuthProvider, EnokiWallet, getSession, isEnokiWallet} from "@mysten/enoki";

interface CreateUsernameModalProps {
  isOpen: boolean;
  onClose?: () => void;
}

export default function CreateUsernameModal({ isOpen, onClose }: CreateUsernameModalProps) {
  const currentAccount = useCurrentAccount();
  const wallets = useWallets();
  const jwt = useRef<string | null>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (username: string) => {
      if (!jwt.current) {
        throw new Error('Missing jwt');
      }

      const response = await fetch('https://api.enoki.mystenlabs.com/v1/subnames', {
        method: 'POST',
        headers: {
          Authorization: `Bearer enoki_public_4e47cb0c7a02b73409dbc2131b862590`,
          'zklogin-jwt': jwt.current,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          domain: 'sui-stack.sui',
          network: 'testnet',
          subname: username,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create username');
      }

      return response.json();
    },
    onSuccess: () => {
      if (currentAccount?.address) {
        queryClient.invalidateQueries({
          queryKey: ['subnames', currentAccount.address]
        });
      }
      onClose?.();
    },
  });

  useEffect(() => {
    if (currentAccount) {
      const enokiWallets = wallets.filter(isEnokiWallet);
      const walletsByProvider = enokiWallets.reduce(
        (map, wallet) => map.set(wallet.provider, wallet),
        new Map<AuthProvider, EnokiWallet>(),
      );
      const googleWallet = walletsByProvider.get('google');

      if (googleWallet) {
        getSession(googleWallet)
          .then(session => {
            if (!session?.jwt) {
              throw new Error('Session does not contain JWT');
            }
            // console.log('JWT:', JSON.stringify(decodeJwt(session.jwt), null, 2));
            console.log('Session:', JSON.stringify(session, null, 2));
            jwt.current = session.jwt
          })
          .catch(error => console.error('Error fetching session:', error));
      }
    }
  }, [currentAccount, wallets]);

  if (!isOpen) {
    return null;
  }

  const validateUsername = (value: string): string | null => {
    if (!value.trim()) {
      return "Username is required";
    }
    if (value.length < 3) {
      return "Username must be at least 3 characters";
    }
    if (value.length > 20) {
      return "Username must be less than 20 characters";
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
      return "Username can only contain letters, numbers, hyphens, and underscores";
    }
    return null;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const username = formData.get("username") as string;

    const validationError = validateUsername(username);
    if (validationError) {
      mutation.reset();
      return;
    }

    try {
      await mutation.mutateAsync(username);
    } catch {
      // Error is handled by mutation state
    }
  };

  return (
    <>
      {/* Backdrop overlay */}
      <Box
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onClick={onClose}
      >
        {/* Modal content */}
        <Card
          style={{
            width: '90%',
            maxWidth: '500px',
            zIndex: 10000,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <form onSubmit={handleSubmit}>
            <Flex direction="column" gap="4" p="4">
              <Heading size="5" weight="bold">
                Create Username
              </Heading>

              <Text size="3">
                Choose a unique username to identify yourself in the messaging app.
              </Text>

              <Flex direction="column" gap="2">
                <label htmlFor="username">
                  <Text as="span" size="2" weight="medium">
                    Username
                  </Text>
                </label>
                <TextField.Root
                  id="username"
                  name="username"
                  placeholder="Enter your username"
                  disabled={mutation.isPending}
                  aria-invalid={!!mutation.isError}
                  aria-describedby={mutation.isError ? "username-error" : undefined}
                  autoFocus
                  required
                />
                {mutation.isError && (
                  <Text id="username-error" size="2" color="red" role="alert">
                    {mutation.error instanceof Error ? mutation.error.message : "Failed to create username"}
                  </Text>
                )}
              </Flex>

              <Flex gap="2" justify="end">
                <Button
                  type="button"
                  variant="soft"
                  size="3"
                  onClick={onClose}
                  disabled={mutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="solid"
                  size="3"
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? 'Creating...' : 'Create Username'}
                </Button>
              </Flex>
            </Flex>
          </form>
        </Card>
      </Box>
    </>
  );

}
