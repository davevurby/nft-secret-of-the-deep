import { ethers } from "hardhat";
import { SecretOfTheDeepNFT } from "../typechain-types";
import { getCurrentContract } from "./utils/get-current-contract";
import { getUserInput } from "./utils/get-user-input";
import { 
  getTokenMetadata, 
  TokenMetadata, 
  MetadataResult,
  GetMetadataOptions 
} from "./domain/get-token-metadata";



/**
 * Display token metadata in a formatted way
 * 
 * @param tokens Array of token metadata to display
 */
function displayTokenMetadata(tokens: TokenMetadata[]): void {
  console.log("\n📋 Token Metadata:");
  console.log("=".repeat(80));

  for (const token of tokens) {
    console.log(`\n🪙 Token ID: ${token.id}`);
    console.log(`   Name: ${token.name}`);
    console.log(`   Description: ${token.description}`);
    console.log(`   Supply: ${token.currentSupply}/${token.maxSupply}`);
    console.log(`   Active: ${token.isActive ? "✅" : "❌"}`);
    console.log(`   URI: ${token.uri}`);
    
    if (token.accessible) {
      console.log(`   Status: ✅ Accessible (${token.statusCode})`);
      
      if (token.metadata) {
        console.log(`   Metadata:`);
        console.log(`     - Name: ${token.metadata.name || "N/A"}`);
        console.log(`     - Image: ${token.metadata.image || "N/A"}`);
        console.log(`     - Collection: ${token.metadata.collection?.name || token.metadata.collection_name || "N/A"}`);
        console.log(`     - Animation URL: ${token.metadata.animation_url || "N/A"}`);
      }
    } else {
      console.log(`   Status: ❌ Not accessible${token.statusCode ? ` (${token.statusCode})` : ""}`);
    }
  }

  console.log("\n" + "=".repeat(80));
}

/**
 * Ask user for specific token ID to check
 * 
 * @param tokens Available tokens
 * @returns Selected token ID or null for all
 */
async function askForTokenSelection(tokens: TokenMetadata[]): Promise<number | null> {
  console.log("\n🪙 Available tokens:");
  tokens.forEach(token => {
    console.log(`   ${token.id}: ${token.name}`);
  });

  const input = await getUserInput("\nEnter token ID to check (or press Enter for all): ");
  
  if (!input.trim()) {
    return null; // Check all tokens
  }

  const tokenId = parseInt(input);
  if (isNaN(tokenId) || tokenId < 1 || tokenId > tokens.length) {
    throw new Error(`Invalid token ID. Please enter a number between 1 and ${tokens.length}.`);
  }

  return tokenId;
}

async function main() {
  const currentContract = await getCurrentContract();
  
  console.log("🔍 Getting token metadata from contract...");
  console.log(`Contract: ${currentContract.contractAddress}`);
  console.log(`Network: ${currentContract.network}`);

  const SecretOfTheDeepNFT = await ethers.getContractFactory("SecretOfTheDeepNFT");
  const nftContract = SecretOfTheDeepNFT.attach(currentContract.contractAddress) as SecretOfTheDeepNFT;

  // First get basic token info without URI checking for selection
  const basicResult = await getTokenMetadata(nftContract, { 
    checkAccessibility: false, 
    fetchMetadata: false 
  });
  
  if (!basicResult.success) {
    console.error(`❌ Error: ${basicResult.error}`);
    return;
  }

  if (basicResult.tokens.length === 0) {
    console.log("❌ No tokens found in contract");
    return;
  }

  // Ask user for token selection
  const selectedTokenId = await askForTokenSelection(basicResult.tokens);
  
  // Now get full metadata for selected tokens
  let options: GetMetadataOptions = {
    checkAccessibility: true,
    fetchMetadata: true
  };
  
  if (selectedTokenId !== null) {
    options.tokenId = selectedTokenId;
  }
  
  console.log("\n🔄 Checking token metadata and URI accessibility...");
  const result = await getTokenMetadata(nftContract, options);
  
  if (!result.success) {
    console.error(`❌ Error: ${result.error}`);
    return;
  }

  const tokensToDisplay = result.tokens;

  // Display metadata
  displayTokenMetadata(tokensToDisplay);

  // Summary
  console.log(`\n📊 Summary:`);
  console.log(`   Total tokens: ${result.totalTokens}`);
  console.log(`   Accessible: ${result.accessibleTokens}`);
  console.log(`   Inaccessible: ${result.inaccessibleTokens}`);
  
  if (result.inaccessibleTokens === 0) {
    console.log("🎉 All token metadata is accessible!");
  } else {
    console.log("⚠️  Some token metadata is not accessible");
  }
}

// Only run if called directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ Script failed:", error);
      process.exit(1);
    });
}
