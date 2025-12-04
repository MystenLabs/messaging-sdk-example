import { useCallback } from 'react';
import { Transaction } from '@mysten/sui/transactions';
import { useCurrentAccount, useSignTransaction, useSuiClient } from '@mysten/dapp-kit';
import { useSessionJWT } from './useSessionJWT';
import { BACKEND_URL } from '../constants';

/**
 * Hook for executing sponsored transactions via Enoki.
 * This enables gasless transactions for users by having the backend sponsor them.
 *
 * @returns Object containing sponsorAndExecuteTransaction function
 *
 * @example
 * const { sponsorAndExecuteTransaction } = useSponsoredTransaction();
 *
 * const tx = new Transaction();
 * // ... build transaction
 * const result = await sponsorAndExecuteTransaction(tx);
 * if (result) {
 *   console.log('Transaction executed:', result.digest);
 * }
 */
export const useSponsoredTransaction = () => {
  const currentAccount = useCurrentAccount();
  const { mutateAsync: signTransaction } = useSignTransaction();
  const suiClient = useSuiClient();
  const { jwt } = useSessionJWT();

  /**
   * Sponsor and execute a transaction using Enoki.
   *
   * Flow:
   * 1. Build transaction with onlyTransactionKind
   * 2. Send to backend to get initial sponsorship
   * 3. Sign the returned transaction bytes
   * 4. Send signature to backend for final sponsorship
   * 5. Execute the fully sponsored transaction
   *
   * @param tx - The transaction to execute
   * @returns Object with digest, or null if failed
   */
  const sponsorAndExecuteTransaction = useCallback(
    async (tx: Transaction): Promise<{ digest: string } | null> => {
      if (!currentAccount) {
        console.error('No account connected');
        return null;
      }

      if (!jwt) {
        console.error('No JWT available for sponsored transaction');
        return null;
      }

      try {
        // Step 1: Build transaction with onlyTransactionKind
        console.log('Building transaction for sponsorship...');
        const transactionBlockKindBytes = await tx.build({
          client: suiClient,
          onlyTransactionKind: true,
        });

        // Convert Uint8Array to base64 string (browser-compatible)
        const transactionBlockKindBytesBase64 = btoa(
          String.fromCharCode(...transactionBlockKindBytes)
        );

        // Step 2: Request initial sponsorship from backend
        console.log('Requesting transaction sponsorship from backend...');
        const sponsorResponse = await fetch(`${BACKEND_URL}/api/sponsor-transaction`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            transactionBlockKindBytes: transactionBlockKindBytesBase64,
            network: 'testnet',
            zkLoginJwt: jwt,
          }),
        });

        if (!sponsorResponse.ok) {
          const errorData = await sponsorResponse.json();
          throw new Error(`Failed to sponsor transaction: ${errorData.error || sponsorResponse.statusText}`);
        }

        const sponsorResponseData = await sponsorResponse.json();

        console.log('data', sponsorResponseData)

        // Step 3: Sign the sponsored transaction bytes
        console.log('Signing sponsored transaction...');
        const signatureResult = await signTransaction(
          {
            transaction: sponsorResponseData.data.bytes, 
          }, 
        );

        // Step 4: Send signature to backend for final sponsorship
        console.log('Finalizing sponsored transaction...');
        const finalizeResponse = await fetch(
          `${BACKEND_URL}/api/sponsor-transaction/${sponsorResponseData.data.digest}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              signature: signatureResult.signature,
              zkLoginJwt: jwt,
            }),
          }
        );

        if (!finalizeResponse.ok) {
          const errorData = await finalizeResponse.json();
          throw new Error(`Failed to finalize sponsored transaction: ${errorData.error || finalizeResponse.statusText}`);
        }

        const finalizeResponseData = await finalizeResponse.json();

        console.log('finalizeResponseData', finalizeResponseData)

        return { digest: finalizeResponseData.data.digest };
      } catch (error) {
        console.error('Error in sponsored transaction:', error);
        throw error;
      }
    },
    [currentAccount, suiClient, jwt]
  );

  return { sponsorAndExecuteTransaction };
};
