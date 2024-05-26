// server.js
const express = require('express');
const bodyParser = require('body-parser');
const { createWalletClient, http, Chain, parseEther } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { createSmartAccountClient, createPaymaster, PaymasterMode } = require('@biconomy/account');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = 3000;
const cors = require('cors'); // Import the cors module

app.use(bodyParser.json());
app.use(cors());

const sepoliaChain = {
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

app.post('/execute-transaction', async (req, res) => {
  try {
    const config = {
      privateKey: process.env.PRIVATE_KEY,
      bundlerUrl: process.env.BUNDLER_URL,
      paymasterUrl: process.env.PAYMASTER_URL,
      paymasterApiKey: process.env.PAYMASTER_API_KEY,
      rpcUrl: process.env.RPC_URL,
    };

    const account = privateKeyToAccount(`0x${config.privateKey}`);
    const signer = createWalletClient({
      account,
      chain: sepoliaChain,
      transport: http(),
    });

    const paymaster = await createPaymaster({
      paymasterUrl: config.paymasterUrl,
      strictMode: true
    });

    const smartWallet = await createSmartAccountClient({
      signer,
      chainId: sepoliaChain.id,
      paymaster,
      bundlerUrl: config.bundlerUrl,
    });

    const toAddress = req.body.toAddress;
    const transactionData = req.body.transactionData || "0x";
    const amountInEther = req.body.amountInEther;
    const value = parseEther(amountInEther);

    const tx = {
      to: toAddress,
      value,
      data: transactionData,
    };

    const userOpResponse = await smartWallet.sendTransaction(tx, {
      paymasterServiceData: { mode: PaymasterMode.SPONSORED }
    });

    const { transactionHash } = await userOpResponse.waitForTxHash();

    const userOpReceipt = await userOpResponse.wait();

    if (userOpReceipt.success === "true") {
      let message = `Transaction Hash: ${transactionHash}`;
      if (userOpReceipt.paymaster !== "0x") {
        message += `. Gas fees were covered by the Paymaster: ${userOpReceipt.paymaster}`;
      } else {
        message += `. Gas fees were not covered by the Paymaster.`;
      }
      res.status(200).json({ message });
    } else {
      res.status(500).json({ message: 'Transaction failed' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
