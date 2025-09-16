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

async function main() {
  console.log("💰 Dividend Payout System\n");

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
  
  // Check current balance
  const contractBalance = await nftContract.getUSDCBalance();
  
  console.log("💰 Contract USDC Balance");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`📋 Available USDC: ${ethers.formatUnits(contractBalance, 6)} USDC\n`);

  if (contractBalance === BigInt(0)) {
    console.log("❌ Error: Contract has no USDC for dividend payout");
    console.log("   Use 'add-usdc.ts' script to add USDC to the contract");
    return;
  }

  // Get user inputs
  console.log("🎯 Select recipient for dividend payout:");
  
  const toAddress = await askTargetWallet();
  console.log(`✅ Recipient: ${toAddress}\n`);

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
  console.log(`To: ${toAddress}`);
  console.log(`USDC Amount: ${ethers.formatUnits(usdcAmount, 6)} USDC`);
  console.log(`Contract USDC Before: ${ethers.formatUnits(contractBalance, 6)} USDC`);
  console.log(`Contract USDC After: ${ethers.formatUnits(contractBalance - usdcAmount, 6)} USDC\n`);

  // Confirm transaction
  const confirmation = await getUserInput("Confirm dividend payout transaction? (y/N): ");
  if (confirmation.toLowerCase() !== 'y' && confirmation.toLowerCase() !== 'yes') {
    console.log("❌ Transaction cancelled");
    return;
  }

  // Execute dividend payout
  console.log("📝 Executing dividend payout transaction...");
  const tx = await nftContract.payDividend(toAddress, usdcAmount);
  
  console.log(`🔗 Transaction hash: ${tx.hash}`);
  console.log("⏳ Waiting for confirmation...");
  
  const receipt = await tx.wait();
  console.log(`✅ Transaction confirmed in block ${receipt?.blockNumber}`);

  // Check new balance
  const newContractBalance = await nftContract.getUSDCBalance();
  
  console.log("\n💰 Updated Balances");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`📋 Contract USDC: ${ethers.formatUnits(newContractBalance, 6)} USDC`);
  console.log(`💵 Dividend paid: ${ethers.formatUnits(usdcAmount, 6)} USDC`);
  console.log(`👤 Recipient: ${toAddress}`);

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
  console.log("💰 payDividend(address to, uint256 usdcAmount)");
  console.log("   - Pay dividend to specified address (owner only)");
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
