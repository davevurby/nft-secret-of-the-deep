import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("🚀 Deploying SecretOfTheDeepNFT to Polygon...");

  // Check if we have the required environment variables
  if (!process.env.PRIVATE_KEY) {
    throw new Error("Please set PRIVATE_KEY in your .env file");
  }

  const [deployer] = await ethers.getSigners();
  console.log(`Deploying with account: ${deployer.address}`);

  // Get network info first
  const network = await ethers.provider.getNetwork();

  // Check balance
  const balance = await ethers.provider.getBalance(deployer.address);
  const currency = network.chainId === 137n ? "MATIC" : "POL";
  console.log(`Account balance: ${ethers.formatEther(balance)} ${currency}`);

  if (balance < ethers.parseEther("0.1")) {
    throw new Error("Insufficient balance. Please add some MATIC to your wallet. Recommended: at least 1 MATIC for deployment.");
  }

  // Deploy the contract
  const SecretOfTheDeepNFT = await ethers.getContractFactory("SecretOfTheDeepNFT");
  const nftContract = await SecretOfTheDeepNFT.deploy();

  await nftContract.waitForDeployment();

  const address = await nftContract.getAddress();
  console.log(`✅ SecretOfTheDeepNFT deployed to: ${address}`);

  // Save contract address to .current.json
  const currentData = {
    contractAddress: address,
    network: network.chainId === 137n ? "Polygon Mainnet" : network.chainId === 80002n ? "Polygon Amoy" : "Unknown",
    chainId: network.chainId.toString(),
    deployer: deployer.address,
    deployedAt: new Date().toISOString()
  };

  const currentFilePath = path.join(__dirname, "..", ".current.json");
  fs.writeFileSync(currentFilePath, JSON.stringify(currentData, null, 2));
  console.log(`📝 Contract info saved to: .current.json`);

  // Verify the deployment
  const owner = await nftContract.owner();
  console.log(`Contract owner: ${owner}`);

  // Display initial tokens
  console.log("\n📋 Initial tokens:");
  for (let i = 1; i <= 3; i++) {
    const tokenInfo = await nftContract.getTokenInfo(i);
    console.log(`Token ${i}: ${tokenInfo.name} (Max Supply: ${tokenInfo.maxSupply})`);
  }

  // Get network name
  const networkName = network.chainId === 137n ? "Polygon Mainnet" : network.chainId === 80002n ? "Polygon Amoy" : "Unknown";
  
  console.log(`\n🌐 Network: ${networkName} (Chain ID: ${network.chainId})`);
  const explorerUrl = network.chainId === 137n 
    ? `https://polygonscan.com/address/${address}`
    : `https://amoy.polygonscan.com/address/${address}`;
  console.log(`🔍 Contract Explorer: ${explorerUrl}`);
  
  console.log("\n🎉 Deployment completed successfully!");
  console.log("\n📝 Next steps:");
  console.log("1. Add the contract to MetaMask");
  console.log("2. Mint some tokens using the interact script");
  console.log("3. View your NFTs in MetaMask");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
