import { useCurrentAccount, useDisconnectWallet, ConnectModal } from "@mysten/dapp-kit";
import { Button, DropdownMenu, Avatar, Flex } from "@radix-ui/themes";
import { ChevronDownIcon } from "@radix-ui/react-icons";
import { useUserSubname } from "../hooks/useUserSubname";
import { isEnokiWallet } from "@mysten/enoki";

export function ProfileDropdown() {
  const currentAccount = useCurrentAccount();
  const { mutate: disconnect } = useDisconnectWallet();
  const { subname, isLoading } = useUserSubname();

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getInitial = () => {
    if (subname) {
      return subname[0].toUpperCase();
    }
    return currentAccount?.address[0].toUpperCase() || "?";
  };

  if (!currentAccount) {
    return (
      <ConnectModal
        trigger={
          <Button size="3" variant="solid">
            Sign In
          </Button>
        }
        walletFilter={(wallet) => isEnokiWallet(wallet)}
      />
    );
  }

  return (
    <>
      <style>
        {`
          @media (min-width: 768px) {
            .profile-subname, .profile-chevron {
              display: inline-block !important;
            }
          }
        `}
      </style>
      <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        <Button size="3" variant="soft" style={{ cursor: "pointer" }}>
          <Flex align="center" gap="2">
            <Avatar
              size="1"
              fallback={getInitial()}
              radius="full"
              style={{ width: "24px", height: "24px" }}
            />
            {!isLoading && subname && (
              <span style={{ display: "none" }} className="profile-subname">
                {subname}
              </span>
            )}
            <ChevronDownIcon className="profile-chevron" style={{ display: "none" }} />
          </Flex>
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Label>
          {subname && (
            <div style={{ fontWeight: 600 }}>
              {subname}
            </div>
          )}
        </DropdownMenu.Label>
        <DropdownMenu.Label>
          <div style={{ fontSize: "12px", opacity: 0.7 }}>
            {formatAddress(currentAccount.address)}
          </div>
        </DropdownMenu.Label>
        <DropdownMenu.Separator />
        <DropdownMenu.Item onClick={() => disconnect()}>
          Disconnect
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
    </>
  );
}
