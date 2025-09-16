import { ethers } from "hardhat";
import { getCurrentContract } from "./utils/get-current-contract";
import type { SecretOfTheDeepNFT } from "../typechain-types";

async function main() {
  console.log("💰 Getting USDC Balance\n");

  const currentContract = await getCurrentContract();
  console.log(`📋 Contract: ${currentContract.contractAddress}`);
  console.log(`🌐 Network: ${currentContract.network}\n`);

  const nftContract = await ethers.getContractAt("SecretOfTheDeepNFT", currentContract.contractAddress) as SecretOfTheDeepNFT;
  
  // Get USDC address
  const usdcAddress = await nftContract.usdcAddress();
  console.log(`💵 USDC Address: ${usdcAddress}\n`);

  // Get USDC balance
  const usdcBalance = await nftContract.getUSDCBalance();
  const usdcBalanceFormatted = ethers.formatUnits(usdcBalance, 6);
  
  console.log("💰 Contract USDC Balance");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Raw balance: ${usdcBalance}`);
  console.log(`Formatted balance: ${usdcBalanceFormatted} USDC`);
  
  if (usdcBalance === BigInt(0)) {
    console.log("\n⚠️  Contract has no USDC");
    console.log("   Owner needs to add USDC for payback functionality");
  } else {
    console.log("\n✅ Contract has USDC available for payback");
  }

  // Show available payback functions
  console.log("\n🎯 Available Payback Functions");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📤 payback(address from, uint256 tokenId, uint256 tokenAmount, uint256 usdcAmount)");
  console.log("   - Buy back specific tokens for specified USDC amount");
  console.log("");
  console.log("💸 withdrawUSDC(uint256 amount, address to)");
  console.log("   - Emergency USDC withdrawal (owner only)");
  console.log("");
  console.log("💰 getUSDCBalance()");
  console.log("   - Get current USDC balance (this function)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
