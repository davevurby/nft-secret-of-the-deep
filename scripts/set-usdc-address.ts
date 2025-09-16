import { ethers } from "hardhat";
import { getCurrentContract } from "./utils/get-current-contract";
import type { SecretOfTheDeepNFT } from "../typechain-types";

async function main() {
  console.log("💵 Setting USDC Address\n");

  const currentContract = await getCurrentContract();
  console.log(`📋 Contract: ${currentContract.contractAddress}`);
  console.log(`🌐 Network: ${currentContract.network}\n`);

  const nftContract = await ethers.getContractAt("SecretOfTheDeepNFT", currentContract.contractAddress) as SecretOfTheDeepNFT;
  
  // Get current USDC address
  const currentUSDCAddress = await nftContract.usdcAddress();
  console.log(`💵 Current USDC Address: ${currentUSDCAddress}\n`);

  // Common USDC addresses for different networks
  const usdcAddresses = {
    "Polygon Native USDC": "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    "Polygon Bridged USDC": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    "Polygon Mumbai": "0xe6b8a5CF854791412c1f6EFC7CAf629f5Df1c747",
    "Ethereum Mainnet": "0xA0b86a33E6441b8C4C8C8C8C8C8C8C8C8C8C8C8C8",
    "Arbitrum": "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
    "Optimism": "0x7F5c764cBc14f9669B88837ca1490cCa17c31607",
    "Custom": "Enter custom address"
  };

  console.log("🌐 Available USDC Addresses:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  let index = 1;
  for (const [network, address] of Object.entries(usdcAddresses)) {
    if (address === "Enter custom address") {
      console.log(`${index}. ${network}`);
    } else {
      console.log(`${index}. ${network}: ${address}`);
    }
    index++;
  }

  // Use Polygon Native USDC (the one you have)
  const newUSDCAddress = usdcAddresses["Polygon Native USDC"];
  
  console.log(`\n🔄 Setting USDC address to: ${newUSDCAddress}`);
  console.log(`   From: ${currentUSDCAddress}`);
  console.log(`   To: ${newUSDCAddress}\n`);

  if (currentUSDCAddress.toLowerCase() === newUSDCAddress.toLowerCase()) {
    console.log("✅ USDC address is already set to the target address");
    return;
  }

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

  // Set USDC address
  console.log("📝 Setting USDC address...");
  const tx = await nftContract.setUSDCAddress(newUSDCAddress);
  
  console.log(`🔗 Transaction hash: ${tx.hash}`);
  console.log("⏳ Waiting for confirmation...");
  
  const receipt = await tx.wait();
  console.log(`✅ Transaction confirmed in block ${receipt?.blockNumber}`);

  // Verify the change
  const updatedUSDCAddress = await nftContract.usdcAddress();
  console.log(`\n✅ USDC address updated successfully!`);
  console.log(`   New address: ${updatedUSDCAddress}`);

  // Show available functions
  console.log("\n🎯 Available USDC Functions");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("💵 setUSDCAddress(address newUSDCAddress)");
  console.log("   - Set USDC token address (owner only)");
  console.log("");
  console.log("💰 getUSDCBalance()");
  console.log("   - Get current USDC balance");
  console.log("");
  console.log("📤 payback(address from, uint256 tokenId, uint256 tokenAmount, uint256 usdcAmount)");
  console.log("   - Buy back tokens for USDC");
  console.log("");
  console.log("💸 withdrawUSDC(uint256 amount, address to)");
  console.log("   - Emergency USDC withdrawal (owner only)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
