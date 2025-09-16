import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { getCurrentContract } from "./utils/get-current-contract";
import { getUserInput } from "./utils/get-user-input";
import type { SecretOfTheDeepNFT } from "../typechain-types";

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

async function main() {
  console.log("📤 Token Payback System\n");

  const currentContract = await getCurrentContract();
  console.log(`📋 Contract: ${currentContract.contractAddress}`);
  console.log(`🌐 Network: ${currentContract.network}\n`);

  const nftContract = await ethers.getContractAt("SecretOfTheDeepNFT", currentContract.contractAddress) as SecretOfTheDeepNFT;
  
  // Get USDC address
  const usdcAddress = await nftContract.usdcAddress();
  console.log(`💵 USDC Address: ${usdcAddress}\n`);

  // Get signer
  const [signer] = await ethers.getSigners();
  console.log(`👤 Signer: ${signer.address}`);

  // Check if signer is owner
  const owner = await nftContract.owner();
  if (signer.address.toLowerCase() !== owner.toLowerCase()) {
    console.error("❌ Error: Signer is not the contract owner");
    console.log(`   Owner: ${owner}`);
    console.log(`   Signer: ${signer.address}`);
    return;
  }

  console.log("✅ Signer is the contract owner\n");

  // Get USDC contract
  const usdcContract = await ethers.getContractAt("IERC20", usdcAddress);
  
  // Check current balances
  const contractBalance = await nftContract.getUSDCBalance();
  
  console.log("💰 Contract USDC Balance");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`📋 Available USDC: ${ethers.formatUnits(contractBalance, 6)} USDC\n`);

  if (contractBalance === BigInt(0)) {
    console.log("❌ Error: Contract has no USDC for payback");
    console.log("   Use 'add-usdc.ts' script to add USDC to the contract");
    return;
  }

  // Get user inputs using helper functions
  console.log("🎯 Select token and holder for payback:");
  
  const { tokenId, name: tokenName } = await askTokenInfo(nftContract);
  console.log(`✅ Selected: ${tokenName} (Token ID: ${tokenId})\n`);

  const fromAddress = await askTargetWallet();
  
  // Check holder balance
  const holderBalance = await nftContract.balanceOf(fromAddress, tokenId);
  if (holderBalance === BigInt(0)) {
    console.log(`❌ Error: Address ${fromAddress} has no ${tokenName} tokens`);
    return;
  }

  console.log(`✅ Holder has ${holderBalance} ${tokenName} tokens\n`);

  // Get token amount
  const tokenAmountStr = await getUserInput(`Enter amount of ${tokenName} tokens to buy back: `);
  const tokenAmountNum = parseInt(tokenAmountStr);
  
  if (isNaN(tokenAmountNum) || tokenAmountNum <= 0) {
    console.log("❌ Error: Invalid token amount");
    return;
  }

  const tokenAmount = BigInt(tokenAmountNum);
  
  if (tokenAmount > holderBalance) {
    console.log(`❌ Error: Holder only has ${holderBalance} tokens, but you requested ${tokenAmount}`);
    return;
  }

  console.log(`✅ Token amount: ${tokenAmount} ${tokenName}\n`);

  // Get USDC amount
  const usdcAmountStr = await getUserInput("Enter USDC amount to pay (e.g., 10.5 for 10.5 USDC): ");
  const usdcAmountNum = parseFloat(usdcAmountStr);
  
  if (isNaN(usdcAmountNum) || usdcAmountNum <= 0) {
    console.log("❌ Error: Invalid USDC amount");
    return;
  }

  const usdcAmount = ethers.parseUnits(usdcAmountStr, 6);
  
  if (usdcAmount > contractBalance) {
    console.log(`❌ Error: Contract only has ${ethers.formatUnits(contractBalance, 6)} USDC, but you requested ${ethers.formatUnits(usdcAmount, 6)} USDC`);
    return;
  }

  console.log(`✅ USDC amount: ${ethers.formatUnits(usdcAmount, 6)} USDC\n`);

  // Show transaction summary
  console.log("📋 Transaction Summary");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Token: ${tokenId} (${tokenName})`);
  console.log(`From: ${fromAddress}`);
  console.log(`Token Amount: ${tokenAmount}`);
  console.log(`USDC Amount: ${ethers.formatUnits(usdcAmount, 6)} USDC`);
  console.log(`Contract USDC Before: ${ethers.formatUnits(contractBalance, 6)} USDC`);
  console.log(`Contract USDC After: ${ethers.formatUnits(contractBalance - usdcAmount, 6)} USDC\n`);

  // Confirm transaction
  const confirmation = await getUserInput("Confirm payback transaction? (y/N): ");
  if (confirmation.toLowerCase() !== 'y' && confirmation.toLowerCase() !== 'yes') {
    console.log("❌ Transaction cancelled");
    return;
  }

  // Execute payback
  console.log("📝 Executing payback transaction...");
  const tx = await nftContract.payback(fromAddress, tokenId, tokenAmount, usdcAmount);
  
  console.log(`🔗 Transaction hash: ${tx.hash}`);
  console.log("⏳ Waiting for confirmation...");
  
  const receipt = await tx.wait();
  console.log(`✅ Transaction confirmed in block ${receipt?.blockNumber}`);

  // Check new balances
  const newContractBalance = await nftContract.getUSDCBalance();
  const newHolderBalance = await nftContract.balanceOf(fromAddress, tokenId);
  
  console.log("\n💰 Updated Balances");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`📋 Contract USDC: ${ethers.formatUnits(newContractBalance, 6)} USDC`);
  console.log(`👤 Holder ${tokenId} tokens: ${newHolderBalance}`);
  console.log(`📊 Tokens burned: ${tokenAmount}`);
  console.log(`💵 USDC paid: ${ethers.formatUnits(usdcAmount, 6)} USDC`);

  // Show available functions
  console.log("\n🎯 Available USDC Functions");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("💰 addUSDC(uint256 amount)");
  console.log("   - Add USDC to contract for payback (owner only)");
  console.log("");
  console.log("💸 withdrawUSDC(uint256 amount)");
  console.log("   - Emergency USDC withdrawal to owner (owner only)");
  console.log("");
  console.log("📤 payback(address from, uint256 tokenId, uint256 tokenAmount, uint256 usdcAmount)");
  console.log("   - Buy back tokens for USDC (owner only)");
  console.log("");
  console.log("💰 getUSDCBalance()");
  console.log("   - Get current USDC balance");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
