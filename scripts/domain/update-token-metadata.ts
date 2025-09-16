import { ethers } from "hardhat";
import type { SecretOfTheDeepNFT } from "../../typechain-types";

/**
 * Result of updating token metadata
 */
export interface UpdateMetadataResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
  oldBaseURI?: string;
  newBaseURI?: string;
  testUris?: string[];
}

/**
 * Options for updating token metadata
 */
export interface UpdateMetadataOptions {
  /** New base URI to set */
  newBaseURI: string;
  /** Whether to test URIs after update (default: true) */
  testUris?: boolean;
  /** Number of token IDs to test (default: 3) */
  testTokenCount?: number;
  /** Whether to validate URI format (default: true) */
  validateUri?: boolean;
}

/**
 * Validate URI format
 * 
 * @param uri The URI to validate
 * @returns True if URI is valid
 */
function validateUriFormat(uri: string): boolean {
  try {
    new URL(uri);
    return true;
  } catch {
    return false;
  }
}

/**
 * Test URIs for given token IDs
 * 
 * @param nftContract The NFT contract instance
 * @param tokenIds Array of token IDs to test
 * @returns Array of URIs
 */
async function testUris(nftContract: SecretOfTheDeepNFT, tokenIds: number[]): Promise<string[]> {
  const uris: string[] = [];
  
  for (const tokenId of tokenIds) {
    try {
      const uri = await nftContract.uri(tokenId);
      uris.push(uri);
    } catch (error) {
      uris.push(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
  
  return uris;
}

/**
 * Update the base URI for token metadata
 * 
 * @param nftContract The NFT contract instance
 * @param options Configuration options
 * @param signer The signer to use for the transaction
 * @returns UpdateMetadataResult with operation details
 */
export async function updateTokenMetadata(
  nftContract: SecretOfTheDeepNFT,
  options: UpdateMetadataOptions,
  signer?: any
): Promise<UpdateMetadataResult> {
  try {
    const {
      newBaseURI,
      testUris: shouldTestUris = true,
      testTokenCount = 3,
      validateUri = true
    } = options;

    // Validate inputs
    if (!newBaseURI || newBaseURI.trim() === "") {
      return {
        success: false,
        error: "New base URI cannot be empty"
      };
    }

    if (validateUri && !validateUriFormat(newBaseURI)) {
      return {
        success: false,
        error: "Invalid URI format"
      };
    }

    // Get signer if not provided
    const [defaultSigner] = await ethers.getSigners();
    const updateSigner = signer || defaultSigner;

    // Check if we're the contract owner
    const contractOwner = await nftContract.owner();
    if (contractOwner !== updateSigner.address) {
      return {
        success: false,
        error: "You are not the contract owner. Only the owner can update metadata URI."
      };
    }

    // Get current base URI for comparison
    let oldBaseURI: string | undefined;
    try {
      // Test current URI for token 1 to get current base URI
      const currentUri = await nftContract.uri(1);
      oldBaseURI = currentUri.replace("1", "{id}"); // Simple replacement for comparison
    } catch (error) {
      // Current URI might not be accessible, continue anyway
    }

    // Update the base URI
    const updateTx = await nftContract.setBaseURI(newBaseURI);
    const receipt = await updateTx.wait();

    // Test new URIs if requested
    let testUris: string[] = [];
    if (shouldTestUris) {
      const tokenIds = Array.from({ length: testTokenCount }, (_, i) => i + 1);
      testUris = await testUris(nftContract, tokenIds);
    }

    return {
      success: true,
      transactionHash: updateTx.hash,
      oldBaseURI,
      newBaseURI,
      testUris
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred"
    };
  }
}

/**
 * Update base URI with a simple string
 * 
 * @param nftContract The NFT contract instance
 * @param newBaseURI The new base URI
 * @param signer The signer to use for the transaction
 * @returns UpdateMetadataResult
 */
export async function updateBaseURI(
  nftContract: SecretOfTheDeepNFT,
  newBaseURI: string,
  signer?: any
): Promise<UpdateMetadataResult> {
  return updateTokenMetadata(nftContract, { newBaseURI }, signer);
}

/**
 * Update base URI and test the result
 * 
 * @param nftContract The NFT contract instance
 * @param newBaseURI The new base URI
 * @param testTokenCount Number of tokens to test
 * @param signer The signer to use for the transaction
 * @returns UpdateMetadataResult with test results
 */
export async function updateBaseURIAndTest(
  nftContract: SecretOfTheDeepNFT,
  newBaseURI: string,
  testTokenCount: number = 3,
  signer?: any
): Promise<UpdateMetadataResult> {
  return updateTokenMetadata(nftContract, {
    newBaseURI,
    testUris: true,
    testTokenCount
  }, signer);
}

/**
 * Validate if a URI template is properly formatted
 * 
 * @param uriTemplate The URI template to validate
 * @returns Object with validation result and suggestions
 */
export function validateUriTemplate(uriTemplate: string): {
  isValid: boolean;
  hasIdPlaceholder: boolean;
  suggestions: string[];
} {
  const suggestions: string[] = [];
  let isValid = true;
  let hasIdPlaceholder = false;

  // Check if URI is valid
  if (!validateUriFormat(uriTemplate)) {
    isValid = false;
    suggestions.push("URI format is invalid");
  }

  // Check for {id} placeholder
  if (uriTemplate.includes("{id}")) {
    hasIdPlaceholder = true;
  } else {
    suggestions.push("Consider adding {id} placeholder for dynamic token IDs");
  }

  // Check for common patterns
  if (!uriTemplate.endsWith("/") && !uriTemplate.includes("?")) {
    suggestions.push("URI should end with '/' or include query parameters");
  }

  // Check for HTTPS
  if (!uriTemplate.startsWith("https://")) {
    suggestions.push("Consider using HTTPS for security");
  }

  return {
    isValid,
    hasIdPlaceholder,
    suggestions
  };
}

/**
 * Get current base URI from contract
 * 
 * @param nftContract The NFT contract instance
 * @returns Current base URI or error message
 */
export async function getCurrentBaseURI(nftContract: SecretOfTheDeepNFT): Promise<string> {
  try {
    const uri = await nftContract.uri(1);
    // Try to extract base URI by replacing token ID
    return uri.replace("1", "{id}");
  } catch (error) {
    throw new Error(`Failed to get current base URI: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
