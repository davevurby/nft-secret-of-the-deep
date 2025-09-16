import { ethers } from "hardhat";
import { getCurrentContract } from "./utils/get-current-contract";
import { getTokenEvents, getTokenEventsSummary, type TokenTransferEvent } from "./domain/get-token-events";

async function main() {
    const currentContract = await getCurrentContract();
  
    console.log("🔍 Getting token events from contract...");
    console.log(`Contract: ${currentContract.contractAddress}`);
    console.log(`Network: ${currentContract.network}`);

    // Get deployment block (approximately)
    const deployedAt = new Date(currentContract.deployedAt);
    const currentBlock = await ethers.provider.getBlockNumber();
    
    // Estimate block number from deployment timestamp
    // Polygon has ~2 second block time
    const avgBlockTime = 2; // seconds
    const blocksAgo = Math.floor((Date.now() - deployedAt.getTime()) / 1000 / avgBlockTime);
    const estimatedDeployBlock = Math.max(0, currentBlock - blocksAgo);
    
    console.log(`📅 Estimated deploy block: ${estimatedDeployBlock}`);
    console.log(`📅 Current block: ${currentBlock}`);
    
    try {
        // Get all events using domain function
        const eventsResult = await getTokenEvents(currentContract.contractAddress, estimatedDeployBlock);
        
        if (!eventsResult.success) {
            console.error("❌ Failed to get events:", eventsResult.error);
            return;
        }
        
        const { totalEvents, singleTransfers, batchTransfers, events } = eventsResult.data!;
        
        console.log(`\n🎉 Total events found: ${totalEvents}`);
        console.log(`  📤 Single transfers: ${singleTransfers}`);
        console.log(`  📦 Batch transfers: ${batchTransfers}`);
        
        // Show all events
        if (events.length > 0) {
            console.log(`\n📋 All events (${events.length} total):`);
            
            for (const event of events) {
                if (event.eventType === 'single') {
                    console.log(`  📤 Block ${event.blockNumber} | ${event.dateTime}: ${event.from} → ${event.to} (Token ${event.tokenId}: ${event.amount})`);
                } else if (event.eventType === 'batch') {
                    const tokenDetails = event.tokenIds?.map((id, index) => 
                        `Token ${id}: ${event.amounts?.[index]}`
                    ).join(', ');
                    console.log(`  📦 Block ${event.blockNumber} | ${event.dateTime}: ${event.from} → ${event.to} (${tokenDetails})`);
                }
            }
        }
        
        // Get and display summary
        const summaryResult = await getTokenEventsSummary(currentContract.contractAddress, estimatedDeployBlock);
        if (summaryResult.success && summaryResult.data) {
            console.log(`\n📊 Summary Statistics:`);
            console.log(`  👥 Unique addresses: ${summaryResult.data.uniqueAddresses}`);
            console.log(`  🪙 Total tokens transferred: ${summaryResult.data.totalTokensTransferred}`);
            if (summaryResult.data.dateRange.earliest) {
                console.log(`  📅 Date range: ${summaryResult.data.dateRange.earliest} to ${summaryResult.data.dateRange.latest}`);
            }
        }
        
    } catch (error) {
        console.error("❌ Error getting events:", error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
    });