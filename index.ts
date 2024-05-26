import { createWalletClient, http, Chain, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createSmartAccountClient, createPaymaster, IPaymaster, PaymasterMode } from "@biconomy/account";
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Sepolia chain configuration
const sepoliaChain: Chain = {
  id: 11155111,
  name: 'sepolia',
  nativeCurrency: {
    name: 'Sepolia Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [process.env.RPC_URL || 'https://rpc.sepolia.org'],
    },
  },
  blockExplorers: {
    default: { name: 'Etherscan', url: 'https://sepolia.etherscan.io' },
  },
  testnet: true,
};

async function main() {
  // Configuration
  const config = {
    privateKey: process.env.PRIVATE_KEY as string,
    bundlerUrl: process.env.BUNDLER_URL as string, 
    paymasterUrl: process.env.PAYMASTER_URL as string, 
    paymasterApiKey: process.env.PAYMASTER_API_KEY as string, 
    rpcUrl: process.env.RPC_URL as string
  };

  // Generate EOA from private key
  const account = privateKeyToAccount(`0x${config.privateKey}`);
  const signer = createWalletClient({
    account,
    chain: sepoliaChain,
    transport: http(),
  });

  // Create Paymaster
  const paymaster: IPaymaster = await createPaymaster({
    paymasterUrl: config.paymasterUrl,
    //apiKey: config.paymasterApiKey,
    strictMode: true
  });

  // Create Smart Account
  const smartWallet = await createSmartAccountClient({
    signer,
    chainId: sepoliaChain.id,
    paymaster,
    bundlerUrl: config.bundlerUrl,
  });

  const saAddress = await smartWallet.getAccountAddress();
  const logData: string[] = [];
  logData.push(`SA Address: ${saAddress}`);

  // Define the recipient's address and transaction data
  const toAddress = process.env.TO_ADDRESS as string; // New recipient's address
  const transactionData = "0x"; // No data for a simple transfer
  const amountInEther = process.env.AMOUNT_IN_ETHER as string; // Amount to send in Ether
  const value = parseEther(amountInEther); // Convert Ether to Wei

  // Build the transaction
  const tx = {
    to: toAddress,
    value, // Specify the value in Wei
    data: transactionData,
  };

  try {
    // Send the transaction and get the transaction hash
    const userOpResponse = await smartWallet.sendTransaction(tx, {
      paymasterServiceData: { mode: PaymasterMode.SPONSORED }
    });
    const { transactionHash } = await userOpResponse.waitForTxHash();
    logData.push(`Transaction Hash: ${transactionHash}`);

    const userOpReceipt = await userOpResponse.wait();
    logData.push(`UserOp receipt: ${JSON.stringify(userOpReceipt, null, 2)}`);

    if (userOpReceipt.success === "true") {
      logData.push(`Transaction receipt: ${JSON.stringify(userOpReceipt.receipt, null, 2)}`);
      if (userOpReceipt.paymaster !== "0x") {
        logData.push(`Gas fees were covered by the Paymaster: ${userOpReceipt.paymaster}`);
      } else {
        logData.push(`Gas fees were not covered by the Paymaster.`);
      }
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      logData.push(`Transaction Error: ${error.message}`);
    }
  } finally {
    // Save the log data to a file
    fs.writeFileSync('output.txt', logData.join('\n'));
  }
}

main().catch(console.error);
