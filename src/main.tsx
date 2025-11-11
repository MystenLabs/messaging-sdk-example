import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import "@mysten/dapp-kit/dist/index.css";
import "@radix-ui/themes/styles.css";

import { SuiClientProvider, useSuiClientContext, WalletProvider } from "@mysten/dapp-kit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Theme } from "@radix-ui/themes";
import App from "./App.tsx";
import { networkConfig } from "./networkConfig.ts";
import { SuiClient } from "@mysten/sui/client";
import { isEnokiNetwork, registerEnokiWallets } from '@mysten/enoki';

const queryClient = new QueryClient();

const createClient = () => {
  return new SuiClient({
    url: "https://fullnode.testnet.sui.io:443",
    mvr: {
      overrides: {
        packages: {
          '@local-pkg/sui-stack-messaging': "0x984960ebddd75c15c6d38355ac462621db0ffc7d6647214c802cd3b685e1af3d", // Or provide your own package ID
        },
      },
    },
  })
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Theme appearance="dark">
      <QueryClientProvider client={queryClient}>
        <SuiClientProvider createClient={createClient} networks={networkConfig} defaultNetwork="testnet">
          <RegisterEnokiWallets />
          <WalletProvider
            autoConnect
          >
            <App />
          </WalletProvider>
        </SuiClientProvider>
      </QueryClientProvider>
    </Theme>
  </React.StrictMode>,
);

function RegisterEnokiWallets() {
	const { client, network } = useSuiClientContext();
	useEffect(() => {
		if (!isEnokiNetwork(network)) return;
		const { unregister } = registerEnokiWallets({
			apiKey: 'enoki_public_4e47cb0c7a02b73409dbc2131b862590',
			providers: {
				// Provide the client IDs for each of the auth providers you want to use:
				google: {
					clientId: '424085524335-ihhpr8ar2cofsj9pkp3gco3cnqaf57q1.apps.googleusercontent.com',
				},
			},
			client,
			network,
		});
		return unregister;
	}, [client, network]);
	return null;
}