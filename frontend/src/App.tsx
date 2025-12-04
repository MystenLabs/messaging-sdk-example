import { useCurrentAccount } from "@mysten/dapp-kit";
import { Box, Container, Flex, Heading, IconButton } from "@radix-ui/themes";
import { GitHubLogoIcon, DiscordLogoIcon } from "@radix-ui/react-icons";
import { SessionKeyProvider } from "./providers/SessionKeyProvider";
import { MessagingClientProvider } from "./providers/MessagingClientProvider";

import { CreateChannel } from "./components/CreateChannel";
import { ChannelList } from "./components/ChannelList";
import { Channel } from "./components/Channel";
import { ChatWithAI } from "./components/ChatWithAI";
import { useState, useEffect } from "react";
import { isValidSuiObjectId } from "@mysten/sui/utils";
import { trackEvent, AnalyticsEvents } from "./utils/analytics";
import CreateUsernameModal from "./components/createUsernameModal";
import { useUserSubname } from "./hooks/useUserSubname";
import { ProfileDropdown } from "./components/ProfileDropdown";
import { SessionExpirationModal } from "./components/SessionExpirationModal";
import { useSessionKey } from "./providers/SessionKeyProvider";

function AppContent() {
  const currentAccount = useCurrentAccount();
  const { hasSubname, isLoading: isSubnameLoading } = useUserSubname();
  const { sessionKey, isInitializing } = useSessionKey();
  const [prevAccount, setPrevAccount] = useState(currentAccount);
  const [channelId, setChannelId] = useState<string | null>(() => {
    const hash = window.location.hash.slice(1);
    return isValidSuiObjectId(hash) ? hash : null;
  });
  const [shouldCreateUsername, setShouldCreateUsername] = useState(false);
  const [shouldShowSessionModal, setShouldShowSessionModal] = useState(false);

  // Track wallet connection changes
  useEffect(() => {
    if (currentAccount && !prevAccount) {
      trackEvent(AnalyticsEvents.WALLET_CONNECTED, {
        address: currentAccount.address,
      });
    } else if (!currentAccount && prevAccount) {
      trackEvent(AnalyticsEvents.WALLET_DISCONNECTED);
    }
    setPrevAccount(currentAccount);
  }, [currentAccount, prevAccount]);

  // Show username modal if user has no subnames
  useEffect(() => {
    console.log('address', currentAccount?.address)
    if (currentAccount && !isSubnameLoading && !hasSubname) {
      setShouldCreateUsername(true);
    }
  }, [currentAccount, hasSubname, isSubnameLoading])

  // Show session modal if user has subname but no session or expired session
  useEffect(() => {
    if (currentAccount && !isSubnameLoading && hasSubname && !isInitializing) {
      const needsSession = !sessionKey || sessionKey.isExpired();
      setShouldShowSessionModal(needsSession);
    } else {
      setShouldShowSessionModal(false);
    }
  }, [currentAccount, hasSubname, isSubnameLoading, sessionKey, isInitializing])

  // Listen for hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      setChannelId(isValidSuiObjectId(hash) ? hash : null);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Check if user is ready (has both subname and active session)
  const isUserReady = hasSubname && sessionKey && !sessionKey.isExpired();

  return (
    <>
      <CreateUsernameModal isOpen={shouldCreateUsername} onClose={() => setShouldCreateUsername(false)} />
      <SessionExpirationModal isOpen={shouldShowSessionModal} />
      <Flex
        position="sticky"
        px="4"
        py="2"
        justify="between"
        align="center"
        style={{
          borderBottom: "1px solid var(--gray-a2)",
        }}
      >
        <Flex align="center" gap="2">
          <Heading>Messaging SDK Example</Heading>
          <IconButton
            size="2"
            variant="ghost"
            onClick={() => {
              trackEvent(AnalyticsEvents.GITHUB_CLICKED);
              window.open('https://github.com/MystenLabs/messaging-sdk-example', '_blank');
            }}
          >
            <GitHubLogoIcon width="24" height="24" />
          </IconButton>
          <IconButton
            size="2"
            variant="ghost"
            onClick={() => {
              trackEvent(AnalyticsEvents.DISCORD_CLICKED);
              window.open('https://discord.gg/sS893zcPMN', '_blank');
            }}
          >
            <DiscordLogoIcon width="24" height="24" />
          </IconButton>
        </Flex>

        <Box>
          <ProfileDropdown />
        </Box>
      </Flex>
      <Container>
        <Container
          mt="5"
          pt="2"
          px="4"
        >
          {currentAccount ? (
            isUserReady ? (
              channelId ? (
                <Channel
                  channelId={channelId}
                  onBack={() => {
                    window.location.hash = '';
                    setChannelId(null);
                  }}
                />
              ) : (
                <Flex direction="column" gap="4">
                  <ChatWithAI />
                  <CreateChannel />
                  <ChannelList />
                </Flex>
              )
            ) : null
          ) : (
            <Heading>Please sign in</Heading>
          )}
        </Container>
      </Container>
    </>
  );
}

function App() {
  return (
    <SessionKeyProvider>
      <MessagingClientProvider>
        <AppContent />
      </MessagingClientProvider>
    </SessionKeyProvider>
  );
}

export default App;
