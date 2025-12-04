import { Card, Flex, Text, Button, Box, Heading } from '@radix-ui/themes';
import { useSessionKey } from '../providers/SessionKeyProvider';

interface SessionExpirationModalProps {
  isOpen: boolean;
}

export function SessionExpirationModal({ isOpen }: SessionExpirationModalProps) {
  const { initializeManually, isInitializing } = useSessionKey();

  // Keep modal open while initializing to prevent flash/pause
  if (!isOpen && !isInitializing) {
    return null;
  }

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
      >
        {/* Modal content */}
        <Card
          style={{
            width: '90%',
            maxWidth: '500px',
            zIndex: 10000,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
          }}
        >
          <Flex direction="column" gap="4" p="4">
            <Heading size="5" weight="bold">
              Start New Session
            </Heading>

            <Text size="3">
              The SDK uses Seal for encrypting messages and attachments. 
              The Seal SDK requires a session key, which contains a signature from your account and allows 
              the app to retrieve Seal decryption keys for a limited time (30 minutes) without requiring 
              repeated confirmations for each message.
            </Text>

            <Text size="2" color="gray">
              Please sign a new session key to continue using the messaging features.
            </Text>

            <Flex gap="2" justify="end">
              <Button
                onClick={initializeManually}
                variant="solid"
                size="3"
                disabled={isInitializing}
              >
                {isInitializing ? 'Signing...' : 'Sign Session Key'}
              </Button>
            </Flex>
          </Flex>
        </Card>
      </Box>
    </>
  );
}


