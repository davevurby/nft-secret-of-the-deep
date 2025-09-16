import { ethers } from "hardhat";
import type { SecretOfTheDeepNFT } from "../../typechain-types";

// Helper function to check if address is zero address
function isZeroAddress(address: string): boolean {
  return address === "0x0000000000000000000000000000000000000000";
}

// Helper function to get all events in chunks to avoid "range too large" errors
async function getAllEventsInChunks(
  contract: SecretOfTheDeepNFT,
  fromBlock?: number,
  chunkSize: number = 100
): Promise<any[]> {
  const provider = contract.runner?.provider;
  if (!provider) throw new Error("No provider found");

  const currentBlock = await provider.getBlockNumber();
  
  // If no fromBlock specified, start from 0 or try to estimate deployment block
  let startFrom = fromBlock;
  if (!startFrom) {
    // For mainnet, try to start from a reasonable recent block to avoid scanning too far back
    const blocksToScanBack = 100000; // Scan last ~55 hours on Polygon (2 sec blocks)
    startFrom = Math.max(0, currentBlock - blocksToScanBack);
  }
  
  const allEvents = [];

  for (let startBlock = startFrom; startBlock <= currentBlock; startBlock += chunkSize) {
    const endBlock = Math.min(startBlock + chunkSize - 1, currentBlock);
    
    // Skip if startBlock > endBlock (safety check)
    if (startBlock > endBlock) break;
    
    try {
      // Get TransferSingle events
      const singleEvents = await contract.queryFilter(
        contract.filters.TransferSingle(),
        startBlock,
        endBlock
      );
      
      // Get TransferBatch events
      const batchEvents = await contract.queryFilter(
        contract.filters.TransferBatch(),
        startBlock,
        endBlock
      );
      
      allEvents.push(...singleEvents, ...batchEvents);
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      // If chunk is still too large, try much smaller chunks
      if (error instanceof Error && error.message.includes("range is too large")) {
        const smallerChunkSize = Math.max(10, Math.floor(chunkSize / 10));
        
        try {
          const smallerEvents = await getAllEventsInChunks(contract, startBlock, smallerChunkSize);
          allEvents.push(...smallerEvents);
          startBlock = endBlock; // Skip the range we just processed
        } catch (nestedError) {
          // Continue with next chunk instead of failing completely
          continue;
        }
      } else {
        // For other errors, log and continue
        continue;
      }
    }
  }

  return allEvents;
}

export interface TokenTransferEvent {
  eventType: 'single' | 'batch';
  blockNumber: number;
  timestamp: number;
  dateTime: string;
  from: string;
  to: string;
  tokenId?: number;
  amount?: bigint;
  tokenIds?: number[];
  amounts?: bigint[];
  transactionHash: string;
}

export interface TokenEventsInfo {
  success: boolean;
  error?: string;
  data?: {
    totalEvents: number;
    singleTransfers: number;
    batchTransfers: number;
    events: TokenTransferEvent[];
  };
}

export interface TokenEventsSummary {
  success: boolean;
  error?: string;
  data?: {
    totalEvents: number;
    singleTransfers: number;
    batchTransfers: number;
    uniqueAddresses: number;
    totalTokensTransferred: bigint;
    dateRange: {
      earliest: string;
      latest: string;
    };
  };
}

/**
 * Get all token transfer events for the contract
 */
export async function getTokenEvents(
  contractAddress: string,
  fromBlock?: number
): Promise<TokenEventsInfo> {
  try {
    const nftContract = await ethers.getContractAt("SecretOfTheDeepNFT", contractAddress) as SecretOfTheDeepNFT;
    
    // Get all transfer events using chunked approach
    const allEvents = await getAllEventsInChunks(nftContract, fromBlock);
    
    // Get block info for all events and sort by timestamp
    const eventsWithTimestamps = await Promise.all(
      allEvents.map(async (event) => {
        const block = await event.getBlock();
        return {
          event,
          timestamp: block.timestamp,
          blockNumber: block.number
        };
      })
    );
    
    // Sort by timestamp (oldest first)
    eventsWithTimestamps.sort((a, b) => a.timestamp - b.timestamp);
    
    // Convert to our interface format
    const events: TokenTransferEvent[] = [];
    
    for (const { event, timestamp, blockNumber } of eventsWithTimestamps) {
      const dateTime = new Date(timestamp * 1000).toISOString();
      
      if (event.eventName === 'TransferSingle') {
        const args = event.args as any;
        events.push({
          eventType: 'single',
          blockNumber,
          timestamp,
          dateTime,
          from: args.from,
          to: args.to,
          tokenId: Number(args.id),
          amount: args.value,
          transactionHash: event.transactionHash
        });
      } else if (event.eventName === 'TransferBatch') {
        const args = event.args as any;
        events.push({
          eventType: 'batch',
          blockNumber,
          timestamp,
          dateTime,
          from: args.from,
          to: args.to,
          tokenIds: args.ids.map((id: any) => Number(id)),
          amounts: args.values,
          transactionHash: event.transactionHash
        });
      }
    }
    
    const singleTransfers = events.filter(e => e.eventType === 'single').length;
    const batchTransfers = events.filter(e => e.eventType === 'batch').length;
    
    return {
      success: true,
      data: {
        totalEvents: events.length,
        singleTransfers,
        batchTransfers,
        events
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Get summary statistics for token events
 */
export async function getTokenEventsSummary(
  contractAddress: string,
  fromBlock?: number
): Promise<TokenEventsSummary> {
  try {
    const eventsResult = await getTokenEvents(contractAddress, fromBlock);
    
    if (!eventsResult.success || !eventsResult.data) {
      return {
        success: false,
        error: eventsResult.error
      };
    }
    
    const { events } = eventsResult.data;
    
    // Calculate unique addresses
    const uniqueAddresses = new Set<string>();
    let totalTokensTransferred = BigInt(0);
    
    for (const event of events) {
      if (!isZeroAddress(event.from)) uniqueAddresses.add(event.from);
      if (!isZeroAddress(event.to)) uniqueAddresses.add(event.to);
      
      if (event.eventType === 'single' && event.amount) {
        totalTokensTransferred += event.amount;
      } else if (event.eventType === 'batch' && event.amounts) {
        for (const amount of event.amounts) {
          totalTokensTransferred += amount;
        }
      }
    }
    
    const dateRange = events.length > 0 ? {
      earliest: events[0].dateTime,
      latest: events[events.length - 1].dateTime
    } : {
      earliest: '',
      latest: ''
    };
    
    return {
      success: true,
      data: {
        totalEvents: events.length,
        singleTransfers: eventsResult.data.singleTransfers,
        batchTransfers: eventsResult.data.batchTransfers,
        uniqueAddresses: uniqueAddresses.size,
        totalTokensTransferred,
        dateRange
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Get events filtered by specific token ID
 */
export async function getTokenEventsForToken(
  contractAddress: string,
  tokenId: number,
  fromBlock?: number
): Promise<TokenEventsInfo> {
  try {
    const eventsResult = await getTokenEvents(contractAddress, fromBlock);
    
    if (!eventsResult.success || !eventsResult.data) {
      return {
        success: false,
        error: eventsResult.error
      };
    }
    
    // Filter events for specific token ID
    const filteredEvents = eventsResult.data.events.filter(event => {
      if (event.eventType === 'single') {
        return event.tokenId === tokenId;
      } else if (event.eventType === 'batch') {
        return event.tokenIds?.includes(tokenId);
      }
      return false;
    });
    
    const singleTransfers = filteredEvents.filter(e => e.eventType === 'single').length;
    const batchTransfers = filteredEvents.filter(e => e.eventType === 'batch').length;
    
    return {
      success: true,
      data: {
        totalEvents: filteredEvents.length,
        singleTransfers,
        batchTransfers,
        events: filteredEvents
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Get events filtered by specific address (as sender or receiver)
 */
export async function getTokenEventsForAddress(
  contractAddress: string,
  address: string,
  fromBlock?: number
): Promise<TokenEventsInfo> {
  try {
    const eventsResult = await getTokenEvents(contractAddress, fromBlock);
    
    if (!eventsResult.success || !eventsResult.data) {
      return {
        success: false,
        error: eventsResult.error
      };
    }
    
    // Filter events involving the specific address
    const filteredEvents = eventsResult.data.events.filter(event => 
      event.from.toLowerCase() === address.toLowerCase() || 
      event.to.toLowerCase() === address.toLowerCase()
    );
    
    const singleTransfers = filteredEvents.filter(e => e.eventType === 'single').length;
    const batchTransfers = filteredEvents.filter(e => e.eventType === 'batch').length;
    
    return {
      success: true,
      data: {
        totalEvents: filteredEvents.length,
        singleTransfers,
        batchTransfers,
        events: filteredEvents
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}
