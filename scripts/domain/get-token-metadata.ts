import { ethers } from "hardhat";
import type { SecretOfTheDeepNFT } from "../../typechain-types";

/**
 * Token metadata information
 */
export interface TokenMetadata {
  id: number;
  name: string;
  description: string;
  maxSupply: bigint;
  currentSupply: bigint;
  isActive: boolean;
  uri: string;
  metadata?: any;
  accessible: boolean;
  statusCode?: number;
}

/**
 * Result of getting token metadata
 */
export interface MetadataResult {
  success: boolean;
  tokens: TokenMetadata[];
  error?: string;
  totalTokens?: number;
  accessibleTokens?: number;
  inaccessibleTokens?: number;
}

/**
 * Options for getting token metadata
 */
export interface GetMetadataOptions {
  /** Maximum number of token IDs to check (default: 20) */
  maxTokenIds?: number;
  /** Whether to check URI accessibility (default: true) */
  checkAccessibility?: boolean;
  /** Whether to fetch metadata content (default: true) */
  fetchMetadata?: boolean;
  /** Specific token ID to check (if provided, only this token will be checked) */
  tokenId?: number;
}

/**
 * Get all available tokens from the contract
 * 
 * @param nftContract The NFT contract instance
 * @param maxTokenIds Maximum number of token IDs to check
 * @returns Array of basic token information
 */
async function getAllTokens(nftContract: SecretOfTheDeepNFT, maxTokenIds: number = 20): Promise<TokenMetadata[]> {
  const tokens: TokenMetadata[] = [];
  
  for (let i = 1; i <= maxTokenIds; i++) {
    try {
      const tokenInfo = await nftContract.getTokenInfo(i);
      if (tokenInfo.isActive) {
        const uri = await nftContract.uri(i);
        tokens.push({
          id: i,
          name: tokenInfo.name,
          description: tokenInfo.description,
          maxSupply: tokenInfo.maxSupply,
          currentSupply: tokenInfo.currentSupply,
          isActive: tokenInfo.isActive,
          uri: uri,
          accessible: false // Will be checked later if needed
        });
      }
    } catch (error) {
      // Token doesn't exist, stop checking
      break;
    }
  }

  return tokens;
}

/**
 * Check if a URI is accessible and fetch metadata
 * 
 * @param uri The URI to check
 * @param fetchContent Whether to fetch the actual metadata content
 * @returns Object with accessibility status and metadata
 */
async function checkUriAccessibility(
  uri: string, 
  fetchContent: boolean = true
): Promise<{ accessible: boolean; statusCode?: number; metadata?: any }> {
  try {
    const response = await fetch(uri);
    const accessible = response.ok;
    const statusCode = response.status;
    
    let metadata: any = undefined;
    if (accessible && fetchContent) {
      try {
        metadata = await response.json();
      } catch (error) {
        // Metadata is not valid JSON, but URI is accessible
      }
    }
    
    return { accessible, statusCode, metadata };
  } catch (error) {
    return { accessible: false };
  }
}

/**
 * Get token metadata for tokens in the contract
 * 
 * @param nftContract The NFT contract instance
 * @param options Configuration options
 * @returns MetadataResult with token information
 */
export async function getTokenMetadata(
  nftContract: SecretOfTheDeepNFT, 
  options: GetMetadataOptions = {}
): Promise<MetadataResult> {
  try {
    const {
      maxTokenIds = 20,
      checkAccessibility = true,
      fetchMetadata = true,
      tokenId
    } = options;

    let tokens: TokenMetadata[];

    if (tokenId !== undefined) {
      // Get specific token
      try {
        const tokenInfo = await nftContract.getTokenInfo(tokenId);
        if (!tokenInfo.isActive) {
          return {
            success: false,
            tokens: [],
            error: `Token ID ${tokenId} is not active`
          };
        }

        const uri = await nftContract.uri(tokenId);
        tokens = [{
          id: tokenId,
          name: tokenInfo.name,
          description: tokenInfo.description,
          maxSupply: tokenInfo.maxSupply,
          currentSupply: tokenInfo.currentSupply,
          isActive: tokenInfo.isActive,
          uri: uri,
          accessible: false
        }];
      } catch (error) {
        return {
          success: false,
          tokens: [],
          error: `Token ID ${tokenId} does not exist`
        };
      }
    } else {
      // Get all tokens
      tokens = await getAllTokens(nftContract, maxTokenIds);
    }
    
    if (tokens.length === 0) {
      return {
        success: false,
        tokens: [],
        error: "No active tokens found in contract"
      };
    }

    // Check accessibility and fetch metadata if requested
    if (checkAccessibility) {
      for (const token of tokens) {
        const uriCheck = await checkUriAccessibility(token.uri, fetchMetadata);
        token.accessible = uriCheck.accessible;
        token.statusCode = uriCheck.statusCode;
        if (fetchMetadata) {
          token.metadata = uriCheck.metadata;
        }
      }
    }

    // Calculate statistics
    const accessibleCount = tokens.filter(t => t.accessible).length;
    const inaccessibleCount = tokens.length - accessibleCount;

    return {
      success: true,
      tokens: tokens,
      totalTokens: tokens.length,
      accessibleTokens: accessibleCount,
      inaccessibleTokens: inaccessibleCount
    };
  } catch (error) {
    return {
      success: false,
      tokens: [],
      error: error instanceof Error ? error.message : "Unknown error occurred"
    };
  }
}

/**
 * Get metadata for a specific token
 * 
 * @param nftContract The NFT contract instance
 * @param tokenId The token ID to get metadata for
 * @param checkAccessibility Whether to check URI accessibility
 * @param fetchMetadata Whether to fetch metadata content
 * @returns MetadataResult for the specific token
 */
export async function getTokenMetadataById(
  nftContract: SecretOfTheDeepNFT,
  tokenId: number,
  checkAccessibility: boolean = true,
  fetchMetadata: boolean = true
): Promise<MetadataResult> {
  return getTokenMetadata(nftContract, {
    tokenId,
    checkAccessibility,
    fetchMetadata
  });
}

/**
 * Get only accessible tokens from the contract
 * 
 * @param nftContract The NFT contract instance
 * @param maxTokenIds Maximum number of token IDs to check
 * @returns MetadataResult with only accessible tokens
 */
export async function getAccessibleTokens(
  nftContract: SecretOfTheDeepNFT,
  maxTokenIds: number = 20
): Promise<MetadataResult> {
  const result = await getTokenMetadata(nftContract, { maxTokenIds });
  
  if (result.success) {
    const accessibleTokens = result.tokens.filter(token => token.accessible);
    return {
      ...result,
      tokens: accessibleTokens,
      totalTokens: accessibleTokens.length
    };
  }
  
  return result;
}

/**
 * Check if all token URIs are accessible
 * 
 * @param nftContract The NFT contract instance
 * @param maxTokenIds Maximum number of token IDs to check
 * @returns Boolean indicating if all URIs are accessible
 */
export async function areAllTokenUrisAccessible(
  nftContract: SecretOfTheDeepNFT,
  maxTokenIds: number = 20
): Promise<{ allAccessible: boolean; accessibleCount: number; totalCount: number; inaccessibleTokens: number[] }> {
  const result = await getTokenMetadata(nftContract, { maxTokenIds });
  
  if (!result.success) {
    return {
      allAccessible: false,
      accessibleCount: 0,
      totalCount: 0,
      inaccessibleTokens: []
    };
  }

  const inaccessibleTokens = result.tokens
    .filter(token => !token.accessible)
    .map(token => token.id);

  return {
    allAccessible: result.inaccessibleTokens === 0,
    accessibleCount: result.accessibleTokens || 0,
    totalCount: result.totalTokens || 0,
    inaccessibleTokens
  };
}
