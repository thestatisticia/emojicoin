import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const RPC_URL = 'https://rpc1mainnet.qie.digital/';
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!PRIVATE_KEY) {
    console.error("❌ Please set PRIVATE_KEY environment variable in .env file");
    process.exit(1);
}

async function main() {
    console.log("🚀 Deploying TokenFactory to QIE Network...\n");

    // Create provider and wallet
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const formattedKey = PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`;
    const wallet = new ethers.Wallet(formattedKey, provider);

    console.log(`📝 Deploying from: ${wallet.address}`);
    
    // Check balance
    const balance = await provider.getBalance(wallet.address);
    console.log(`💰 Balance: ${ethers.formatEther(balance)} QIE\n`);

    if (balance === 0n) {
        console.error("❌ Insufficient balance. Please fund your wallet with QIE tokens.");
        process.exit(1);
    }

    // Load artifact
    const artifactPath = path.resolve(__dirname, '../src/artifacts/contracts/TokenFactory.sol/TokenFactory.json');
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

    console.log("📦 Creating contract factory...");
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

    console.log("⏳ Deploying contract (this may take a minute)...\n");
    const contract = await factory.deploy();
    
    console.log(`📤 Transaction hash: ${contract.deploymentTransaction().hash}`);
    console.log("⏳ Waiting for deployment confirmation...\n");

    await contract.waitForDeployment();
    const contractAddress = await contract.getAddress();

    console.log(`✅ TokenFactory deployed successfully!`);
    console.log(`📍 Contract Address: ${contractAddress}`);
    console.log(`🔗 View on explorer: https://mainnet.qie.digital/address/${contractAddress}\n`);

    // Save address to file
    const addressPath = path.resolve(__dirname, '../src/factoryAddress.json');
    fs.writeFileSync(addressPath, JSON.stringify({ address: contractAddress }, null, 2));
    console.log(`💾 Saved address to: ${addressPath}`);

    // Verify the contract was deployed
    const code = await provider.getCode(contractAddress);
    if (code === '0x') {
        console.error("❌ Warning: Contract code not found at address. Deployment may have failed.");
        process.exit(1);
    } else {
        console.log("✅ Contract code verified on blockchain");
    }
}

main().catch((error) => {
    console.error("❌ Deployment failed:");
    console.error(error);
    process.exit(1);
});












