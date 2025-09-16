import { ethers } from "hardhat";
import { SecretOfTheDeepNFT } from "../typechain-types";
import { getCurrentContract } from "./utils/get-current-contract";
import { getUserInput } from "./utils/get-user-input";
import { 
  updateTokenMetadata,
  updateBaseURI,
  updateBaseURIAndTest,
  validateUriTemplate,
  getCurrentBaseURI,
  UpdateMetadataOptions,
  UpdateMetadataResult
} from "./domain/update-token-metadata";

/**
 * Display current base URI
 * 
 * @param nftContract The NFT contract instance
 */
async function displayCurrentBaseURI(nftContract: SecretOfTheDeepNFT): Promise<void> {
  try {
    const currentURI = await getCurrentBaseURI(nftContract);
    console.log(`📋 Current base URI: ${currentURI}`);
  } catch (error) {
    console.log("📋 Current base URI: Unable to retrieve");
  }
}

/**
 * Ask user for new base URI
 * 
 * @returns The new base URI
 */
async function askForNewBaseURI(): Promise<string> {
  console.log("\n🔗 Enter new base URI:");
  console.log("   Examples:");
  console.log("   - https://api.copilot.cyrkl.com/tokens/{id}");
  console.log("   - https://ipfs.io/ipfs/YOUR_HASH/{id}");
  console.log("   - https://yourdomain.com/metadata/{id}");
  
  const newBaseURI = await getUserInput("\nNew base URI: ");
  
  if (!newBaseURI.trim()) {
    throw new Error("Base URI cannot be empty");
  }
  
  return newBaseURI.trim();
}

/**
 * Validate and display URI template suggestions
 * 
 * @param uriTemplate The URI template to validate
 */
function validateAndSuggest(uriTemplate: string): void {
  const validation = validateUriTemplate(uriTemplate);
  
  console.log("\n🔍 URI Template Validation:");
  console.log(`   Valid format: ${validation.isValid ? "✅" : "❌"}`);
  console.log(`   Has {id} placeholder: ${validation.hasIdPlaceholder ? "✅" : "❌"}`);
  
  if (validation.suggestions.length > 0) {
    console.log("\n💡 Suggestions:");
    validation.suggestions.forEach(suggestion => {
      console.log(`   - ${suggestion}`);
    });
  }
  
  if (!validation.isValid) {
    throw new Error("URI format is invalid. Please check the suggestions above.");
  }
}

/**
 * Ask user for update options
 * 
 * @returns UpdateMetadataOptions
 */
async function askForUpdateOptions(): Promise<UpdateMetadataOptions> {
  console.log("\n⚙️  Update Options:");
  
  const testUrisInput = await getUserInput("Test URIs after update? (y/N): ");
  const testUris = testUrisInput.toLowerCase() === 'y' || testUrisInput.toLowerCase() === 'yes';
  
  let testTokenCount = 3;
  if (testUris) {
    const countInput = await getUserInput("Number of tokens to test (default: 3): ");
    if (countInput.trim()) {
      const count = parseInt(countInput);
      if (!isNaN(count) && count > 0) {
        testTokenCount = count;
      }
    }
  }
  
  const validateInput = await getUserInput("Validate URI format? (Y/n): ");
  const validateUri = validateInput.toLowerCase() !== 'n' && validateInput.toLowerCase() !== 'no';
  
  return {
    testUris,
    testTokenCount,
    validateUri
  };
}

/**
 * Display update result
 * 
 * @param result The update result
 */
function displayUpdateResult(result: UpdateMetadataResult): void {
  console.log("\n📊 Update Result:");
  console.log("=".repeat(50));
  
  if (result.success) {
    console.log("✅ Update successful!");
    console.log(`Transaction hash: ${result.transactionHash}`);
    
    if (result.oldBaseURI) {
      console.log(`Old base URI: ${result.oldBaseURI}`);
    }
    console.log(`New base URI: ${result.newBaseURI}`);
    
    if (result.testUris && result.testUris.length > 0) {
      console.log("\n🔗 Test URIs:");
      result.testUris.forEach((uri, index) => {
        console.log(`   Token ${index + 1}: ${uri}`);
      });
    }
    
    console.log("\n📝 Next steps:");
    console.log("1. Upload metadata files to your server/IPFS");
    console.log("2. Test the URIs in browser");
    console.log("3. Refresh MetaMask to see updated metadata");
    
  } else {
    console.log("❌ Update failed!");
    console.log(`Error: ${result.error}`);
  }
  
  console.log("=".repeat(50));
}

async function main() {
  const currentContract = await getCurrentContract();
  
  console.log("🔗 Updating Token Metadata URI...");
  console.log(`Contract: ${currentContract.contractAddress}`);
  console.log(`Network: ${currentContract.network}`);

  const SecretOfTheDeepNFT = await ethers.getContractFactory("SecretOfTheDeepNFT");
  const nftContract = SecretOfTheDeepNFT.attach(currentContract.contractAddress) as SecretOfTheDeepNFT;

  // Display current base URI
  await displayCurrentBaseURI(nftContract);

  // Get new base URI from user
  const newBaseURI = await askForNewBaseURI();
  
  // Validate URI template
  validateAndSuggest(newBaseURI);
  
  // Get update options
  const options = await askForUpdateOptions();
  
  // Confirm update
  console.log(`\n📋 Summary:`);
  console.log(`   New base URI: ${newBaseURI}`);
  console.log(`   Test URIs: ${options.testUris ? "Yes" : "No"}`);
  if (options.testUris) {
    console.log(`   Test token count: ${options.testTokenCount}`);
  }
  console.log(`   Validate URI: ${options.validateUri ? "Yes" : "No"}`);
  
  const confirm = await getUserInput("\n🔄 Proceed with update? (y/N): ");
  if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
    console.log("❌ Update cancelled.");
    return;
  }

  // Perform update
  console.log("\n🔄 Updating base URI...");
  const result = await updateTokenMetadata(nftContract, {
    newBaseURI,
    ...options
  });
  
  // Display result
  displayUpdateResult(result);
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
