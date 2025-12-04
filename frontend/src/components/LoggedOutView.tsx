import { Card, Flex, Text, Button, Box, Separator, Badge, Heading } from '@radix-ui/themes';

export function LoggedOutView() {
  return (
    <Flex direction="column" gap="4">
      {/* Welcome Section */}
      <Box style={{ textAlign: 'center', padding: '2rem 0' }}>
        <Heading size="8" mb="3">Welcome to Sui Messenger</Heading>
        <Text size="4" color="gray" style={{ display: 'block', marginBottom: '1rem' }}>
          Private, serverless messaging built on the Sui Stack
        </Text>
        <Text size="3" color="gray" style={{ display: 'block', marginBottom: '2rem', maxWidth: '600px', margin: '0 auto' }}>
          Sign in to start chatting with full ownership of your messages.
        </Text>
        <Text size="3" weight="bold" style={{ display: 'block' }}>
          👆 Sign in with your gmail above to get started
        </Text>
      </Box>

      {/* Ghost AI Assistant Card */}
      <Card
        style={{
          background: 'linear-gradient(135deg, var(--accent-a2) 0%, var(--accent-a3) 100%)',
          border: '2px solid var(--accent-a5)',
          opacity: 0.6,
          filter: 'blur(1px)',
          pointerEvents: 'none',
          animation: 'pulse 2s ease-in-out infinite'
        }}
      >
        <Flex direction="column" gap="3" align="center" justify="center" py="4">
          <Box>
            <Text size="5" weight="bold" align="center" style={{ display: 'block' }}>
              🤖 AI Assistant
            </Text>
            <Text size="2" color="gray" align="center" style={{ display: 'block', marginTop: '8px' }}>
              Start a conversation with our AI assistant
            </Text>
          </Box>
          <Button size="4" disabled style={{ minWidth: '200px' }}>
            Start Chat with AI
          </Button>
        </Flex>
      </Card>

      {/* Ghost Create Channel Card */}
      <Card
        style={{
          opacity: 0.6,
          filter: 'blur(1px)',
          pointerEvents: 'none',
          animation: 'pulse 2s ease-in-out infinite 0.3s'
        }}
      >
        <Flex direction="column" gap="3">
          <Box>
            <Text size="4" weight="bold">Create New Channel</Text>
          </Box>
          <Separator size="4" />
          <Box>
            <Text size="2" color="gray">
              Enter one or more Sui addresses separated by commas to create a private messaging channel.
            </Text>
          </Box>
          <Box
            style={{
              padding: 'var(--space-3)',
              backgroundColor: 'var(--gray-a3)',
              borderRadius: 'var(--radius-2)',
              border: '1px solid var(--gray-a5)',
            }}
          >
            <Text size="2" color="gray">Enter Sui addresses (0x..., 0x..., ...)</Text>
          </Box>
          <Button size="3" disabled>
            Create Channel
          </Button>
        </Flex>
      </Card>

      {/* Ghost Channel List Card */}
      <Card
        style={{
          opacity: 0.6,
          filter: 'blur(1px)',
          pointerEvents: 'none',
          animation: 'pulse 2s ease-in-out infinite 0.6s'
        }}
      >
        <Flex direction="column" gap="3">
          <Flex justify="between" align="center">
            <Text size="4" weight="bold">
              Your Channels
            </Text>
            <Button size="2" variant="soft" disabled>
              Refresh
            </Button>
          </Flex>

          <Separator size="4" />

          {/* Ghost Channel Items */}
          {[1, 2].map((i) => (
            <Box
              key={i}
              p="3"
              style={{
                backgroundColor: 'var(--gray-a2)',
                borderRadius: 'var(--radius-2)',
                border: '1px solid var(--gray-a3)',
              }}
            >
              <Flex direction="column" gap="2">
                <Flex justify="between" align="start">
                  <Box>
                    <Text size="2" weight="bold">
                      Channel ID
                    </Text>
                    <Text size="1" color="gray" style={{ display: 'block' }}>
                      0x1234...abcd
                    </Text>
                  </Box>
                  <Badge color="green" size="1">
                    Active
                  </Badge>
                </Flex>

                <Flex gap="4">
                  <Box>
                    <Text size="1" color="gray">
                      Messages
                    </Text>
                    <Text size="2" weight="medium" style={{ display: 'block' }}>
                      12
                    </Text>
                  </Box>

                  <Box>
                    <Text size="1" color="gray">
                      Members
                    </Text>
                    <Text size="2" weight="medium" style={{ display: 'block' }}>
                      3
                    </Text>
                  </Box>

                  <Box>
                    <Text size="1" color="gray">
                      Created
                    </Text>
                    <Text size="2" weight="medium" style={{ display: 'block' }}>
                      2 days ago
                    </Text>
                  </Box>
                </Flex>

                <Separator size="4" />
                <Box>
                  <Text size="1" color="gray">
                    Last Message
                  </Text>
                  <Text size="2" style={{ display: 'block', marginTop: '4px' }}>
                    Hey! This is an example message...
                  </Text>
                  <Text size="1" color="gray">
                    from: 0xabc...def • 1 hour ago
                  </Text>
                </Box>
              </Flex>
            </Box>
          ))}
        </Flex>
      </Card>

      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              opacity: 0.6;
            }
            50% {
              opacity: 0.4;
            }
          }
        `}
      </style>
    </Flex>
  );
}
