import { ethers } from "hardhat";
import { getCurrentContract } from "./utils/get-current-contract";
import type { SecretOfTheDeepNFT } from "../typechain-types";
import * as readline from 'readline';

async function main() {
  console.log("💸 Withdrawing USDC from Contract\n");

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
  const walletBalance = await usdcContract.balanceOf(signer.address);
  const contractBalance = await nftContract.getUSDCBalance();
  
  console.log("💰 Current Balances");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`👤 Wallet USDC: ${ethers.formatUnits(walletBalance, 6)} USDC`);
  console.log(`📋 Contract USDC: ${ethers.formatUnits(contractBalance, 6)} USDC\n`);

  if (contractBalance === BigInt(0)) {
    console.log("❌ Error: Contract has no USDC to withdraw");
    return;
  }

  // Calculate withdrawal options
  const halfAmount = contractBalance / BigInt(2);
  const maxWithdraw = ethers.parseUnits("100", 6); // 100 USDC max per withdrawal
  const suggestedAmount = contractBalance > maxWithdraw ? maxWithdraw : contractBalance;
  
  console.log("💡 Withdrawal Options:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`1. All available: ${ethers.formatUnits(contractBalance, 6)} USDC`);
  console.log(`2. Half balance: ${ethers.formatUnits(halfAmount, 6)} USDC`);
  console.log(`3. Suggested (max 100): ${ethers.formatUnits(suggestedAmount, 6)} USDC`);
  console.log(`4. Custom amount: Enter manually\n`);

  // Interactive amount selection
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (query: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(query, resolve);
    });
  };

  let amountToWithdraw: bigint;
  
  try {
    const choice = await question("Select option (1-4) or enter custom amount in USDC: ");
    
    switch (choice.trim()) {
      case "1":
        amountToWithdraw = contractBalance;
        console.log(`✅ Selected: All available (${ethers.formatUnits(contractBalance, 6)} USDC)`);
        break;
      case "2":
        amountToWithdraw = halfAmount;
        console.log(`✅ Selected: Half balance (${ethers.formatUnits(halfAmount, 6)} USDC)`);
        break;
      case "3":
        amountToWithdraw = suggestedAmount;
        console.log(`✅ Selected: Suggested amount (${ethers.formatUnits(suggestedAmount, 6)} USDC)`);
        break;
      case "4":
      default:
        // Try to parse as custom amount
        const customAmountStr = choice.trim();
        const customAmount = parseFloat(customAmountStr);
        
        if (isNaN(customAmount) || customAmount <= 0) {
          console.log("❌ Invalid amount. Using suggested amount instead.");
          amountToWithdraw = suggestedAmount;
        } else {
          amountToWithdraw = ethers.parseUnits(customAmountStr, 6);
          console.log(`✅ Selected: Custom amount (${ethers.formatUnits(amountToWithdraw, 6)} USDC)`);
        }
        break;
    }
  } finally {
    rl.close();
  }

  // Validate amount
  if (amountToWithdraw > contractBalance) {
    console.log(`❌ Error: Selected amount (${ethers.formatUnits(amountToWithdraw, 6)} USDC) exceeds contract balance (${ethers.formatUnits(contractBalance, 6)} USDC)`);
    return;
  }

  if (amountToWithdraw === BigInt(0)) {
    console.log("❌ Error: Amount must be greater than 0");
    return;
  }
  
  console.log(`🔄 Withdrawing ${ethers.formatUnits(amountToWithdraw, 6)} USDC from contract...`);
  console.log(`   From: ${currentContract.contractAddress}`);
  console.log(`   To: ${signer.address} (owner)\n`);

  // Withdraw USDC from contract
  console.log("📝 Withdrawing USDC...");
  const tx = await nftContract.withdrawUSDC(amountToWithdraw);
  
  console.log(`🔗 Transaction hash: ${tx.hash}`);
  console.log("⏳ Waiting for confirmation...");
  
  const receipt = await tx.wait();
  console.log(`✅ Transaction confirmed in block ${receipt?.blockNumber}`);

  // Check new balances
  const newWalletBalance = await usdcContract.balanceOf(signer.address);
  const newContractBalance = await nftContract.getUSDCBalance();
  
  console.log("\n💰 Updated Balances");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`👤 Wallet USDC: ${ethers.formatUnits(newWalletBalance, 6)} USDC`);
  console.log(`📋 Contract USDC: ${ethers.formatUnits(newContractBalance, 6)} USDC`);
  console.log(`📊 Withdrawn: ${ethers.formatUnits(amountToWithdraw, 6)} USDC`);

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
  console.log("   - Buy back tokens for USDC");
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
