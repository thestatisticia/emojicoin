import { createWalletClient, http, publicActions, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const RPC_URL = 'https://rpc1mainnet.qie.digital/';
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!PRIVATE_KEY) {
    console.error("Please set PRIVATE_KEY environment variable");
    process.exit(1);
}

// Define QIE Chain
const qieChain = defineChain({
    id: 1990,
    name: 'QIEMainnet',
    network: 'qie',
    nativeCurrency: {
        decimals: 18,
        name: 'QIEV3',
        symbol: 'QIEV3',
    },
    rpcUrls: {
        default: { http: ['https://rpc1mainnet.qie.digital/'] },
        public: { http: ['https://rpc1mainnet.qie.digital/'] },
    },
    blockExplorers: {
        default: { name: 'QIE Scan', url: 'https://mainnet.qie.digital/' },
    },
});

// Add 0x prefix if missing
const formattedKey = PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`;

async function main() {
    console.log("🚀 Deploying TokenFactory with Viem...");

    const account = privateKeyToAccount(formattedKey);

    const client = createWalletClient({
        account,
        chain: qieChain,
        transport: http(RPC_URL)
    }).extend(publicActions);

    console.log(`Connected to Account: ${account.address}`);

    // Load Artifact
    const artifactPath = path.resolve(__dirname, '../src/artifacts/contracts/TokenFactory.sol/TokenFactory.json');
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

    const hash = await client.deployContract({
        abi: artifact.abi,
        bytecode: artifact.bytecode,
        args: []
    });

    console.log(`Transaction Hash: ${hash}`);
    console.log("Waiting for confirmation...");

    const receipt = await client.waitForTransactionReceipt({ hash });

    if (receipt.contractAddress) {
        console.log(`✅ TokenFactory deployed to: ${receipt.contractAddress}`);

        // Save address to a file for the frontend to read easily
        const addressPath = path.resolve(__dirname, '../src/factoryAddress.json');
        fs.writeFileSync(addressPath, JSON.stringify({ address: receipt.contractAddress }, null, 2));
        console.log(`Saved address to ${addressPath}`);
    } else {
        console.error("Deployment failed or contract address not found in receipt.");
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
