import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import type { SecretOfTheDeepNFT } from "../typechain-types/contracts/SecretOfTheDeepNFT";
import { getUserInput } from "./utils/get-user-input";
import { getCurrentContract } from "./utils/get-current-contract";
import { mintToWallet } from "./domain/mint-2-wallet";

/**
 * Ask the user for a wallet address.
 * 
 * User can also enter a saved wallet name.
 * 
 * @returns 
 */
async function askTargetWallet(): Promise<string> {
  // Read wallets from .wallets.json
  const walletsFilePath = path.join(__dirname, "..", ".wallets.json");
  let wallets: Record<string, string> = {};
  
  if (fs.existsSync(walletsFilePath)) {
    wallets = JSON.parse(fs.readFileSync(walletsFilePath, "utf8"));
  }

  if (Object.keys(wallets).length > 0) {
    console.log("📋 Available saved wallets:");
    Object.entries(wallets).forEach(([name, address]) => {
      console.log(`   ${name}: ${address}`);
    });
  }

  const input = await getUserInput("Enter wallet address or name: ");
  
  // Check if it's a saved wallet name
  if (wallets[input]) {
    console.log(`✅ Using saved wallet: ${input} (${wallets[input]})`);
    return wallets[input];
  }
  
  // Check if it's a valid address
  if (ethers.isAddress(input)) {
    return input;
  }
  
  throw new Error(`Invalid wallet address or unknown wallet name "${input}"`);
}

/**
 * Ask the user for a token ID.
 * 
 * @returns 
 */
async function askTokenInfo(nftContract: SecretOfTheDeepNFT): Promise<{ tokenId: number, name: string }> {
  // Get available tokens from contract
  const tokens: Array<{ id: number, name: string, isActive: boolean }> = [];
  
  // Check first 10 token IDs (reasonable range for most contracts)
  for (let i = 1; i <= 10; i++) {
    try {
      const tokenInfo = await nftContract.getTokenInfo(i);
      if (tokenInfo.isActive) {
        tokens.push({
          id: i,
          name: tokenInfo.name,
          isActive: tokenInfo.isActive
        });
      }
    } catch (error) {
      // Token doesn't exist, continue to next
      break;
    }
  }

  if (tokens.length === 0) {
    throw new Error("No active tokens found in contract");
  }

  console.log("\n🪙 Available tokens:");
  tokens.forEach(token => {
    console.log(`   ${token.id}: ${token.name}`);
  });

  const tokenIdStr = await getUserInput(`Enter token ID (1-${tokens.length}): `);
  const tokenId = parseInt(tokenIdStr);
  
  if (isNaN(tokenId) || tokenId < 1 || tokenId > tokens.length) {
    throw new Error(`Invalid token ID. Please enter a number between 1 and ${tokens.length}.`);
  }

  const token = tokens.find(t => t.id === tokenId);
  if (!token) {
    throw new Error(`Token ID ${tokenId} not found`);
  }

  return { tokenId, name: token.name };
}

/**
 * Ask the user for an amount to mint.
 * 
 * @returns 
 */
async function askAmount(): Promise<number> {
  const amountStr = await getUserInput("Enter amount to mint: ");
  const amount = parseInt(amountStr);
  
  if (isNaN(amount) || amount <= 0) {
    throw new Error("Invalid amount. Please enter a positive number.");
  }
  
  return amount;
}

async function main() {
  const currentContract = await getCurrentContract();
  
  console.log("🪙 Minting tokens to specific wallet...");
  console.log(`Contract: ${currentContract.contractAddress}`);
  console.log(`Network: ${currentContract.network}\n`);

  // Get user input
  const targetWallet = await askTargetWallet();
  
  const SecretOfTheDeepNFT = await ethers.getContractFactory("SecretOfTheDeepNFT");
  const nftContract = SecretOfTheDeepNFT.attach(currentContract.contractAddress) as SecretOfTheDeepNFT;
  
  const { tokenId, name: tokenName } = await askTokenInfo(nftContract);
  const amount = await askAmount();

  console.log(`\n📋 Summary:`);
  console.log(`Target Wallet: ${targetWallet}`);
  console.log(`Token: ${tokenName} (ID: ${tokenId})`);
  console.log(`Amount: ${amount}\n`);

  // Confirm minting
  const confirm = await getUserInput(`\n🪙 Mint ${amount} ${tokenName} to ${targetWallet}? (y/N): `);
  if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
    console.log("❌ Minting cancelled.");
    return;
  }

  // Use the universal mintToWallet function
  console.log(`\n🪙 Minting ${amount} ${tokenName} to ${targetWallet}...`);
  
  const result = await mintToWallet(nftContract, targetWallet, tokenId, amount);
  
  if (result.success) {
    console.log("✅ Minting successful!");
    console.log(`Transaction hash: ${result.transactionHash}`);
    
    console.log(`\n📊 Updated balances:`);
    console.log(`Target wallet ${result.tokenName}: ${result.newBalance}`);
    console.log(`Total supply: ${result.newSupply}`);
    
    console.log(`\n🔗 View on Polygonscan:`);
    console.log(`https://polygonscan.com/address/${targetWallet}`);
  } else {
    console.error(`❌ Minting failed: ${result.error}`);
    throw new Error(result.error);
  }

  console.log("\n🎉 Script completed successfully!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ Script failed:", error);
      process.exit(1);
    });