import { ethers } from "hardhat";
import type { SecretOfTheDeepNFT } from "../../typechain-types/contracts/SecretOfTheDeepNFT";

/**
 * The result of minting tokens to a wallet.
 */
export interface MintResult {
    success: boolean;
    transactionHash?: string;
    error?: string;
    newBalance?: bigint;
    newSupply?: bigint;
    tokenName?: string;
  }
  
/**
 * Mint tokens to a wallet.
 * 
 * @param nftContract - The NFT contract.
 * @param targetWallet - The wallet address to mint tokens to.
 * @param tokenId - The token ID to mint.
 * @param amount - The amount of tokens to mint.
 * @param signer - The signer to use for the transaction.
 * @returns The result of the minting.
 */
export async function mintToWallet(
    nftContract: SecretOfTheDeepNFT, 
    targetWallet: string, 
    tokenId: number, 
    amount: number,
    signer?: any
): Promise<MintResult> {
    try {
      // Validate inputs
      if (!ethers.isAddress(targetWallet)) {
        return {
          success: false,
          error: "Invalid wallet address format"
        };
      }
  
      if (amount <= 0) {
        return {
          success: false,
          error: "Amount must be greater than 0"
        };
      }
  
      // Get signer if not provided
      const [defaultSigner] = await ethers.getSigners();
      const mintSigner = signer || defaultSigner;
  
      // Check if we're the contract owner
      const contractOwner = await nftContract.owner();
      if (contractOwner !== mintSigner.address) {
        return {
          success: false,
          error: "You are not the contract owner. Only the owner can mint tokens."
        };
      }
  
      // Get token info before minting
      const tokenInfo = await nftContract.getTokenInfo(tokenId);
      
      // Check if we can mint the requested amount
      if (tokenInfo.currentSupply + BigInt(amount) > tokenInfo.maxSupply) {
        return {
          success: false,
          error: `Cannot mint ${amount} tokens. Would exceed max supply of ${tokenInfo.maxSupply}`
        };
      }
  
      // Mint tokens
      const mintTx = await nftContract.mint(targetWallet, tokenId, amount);
      const receipt = await mintTx.wait();
      
      // Get updated balances
      const newBalance = await nftContract.balanceOf(targetWallet, tokenId);
      const newSupply = await nftContract.getTokenInfo(tokenId);
      
      return {
        success: true,
        transactionHash: mintTx.hash,
        newBalance: newBalance,
        newSupply: newSupply.currentSupply,
        tokenName: tokenInfo.name
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred"
      };
    }
  }
  