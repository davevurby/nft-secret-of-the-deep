import * as fs from "fs";
import * as path from "path";

export interface CurrentContract {
    /**
     * The address of the current contract.
     */
    contractAddress: string;

    /**
     * The network of the current contract.
     */
    network: string;

    /**
     * The chain ID of the current contract.
     */
    chainId: string;

    /**
     * The deployer address of the current contract.
     */
    deployer: string;

    /**
     * The deployment timestamp of the current contract.
     */
    deployedAt: string;
}

/**
 * Get the current contract info from the .current.json file.
 * 
 * This function is used to get the current contract info from the .current.json file.
 * 
 * @example ```ts 
 * const currentContract = await getCurrentContract();
 * console.log(`Contract address: ${currentContract.contractAddress}`);
 * console.log(`Network: ${currentContract.network}`);
 * ```
 * 
 * @returns The current contract address and network
 */
export async function getCurrentContract(): Promise<CurrentContract> {
    const currentFilePath = path.join(__dirname, "..", "..", ".current.json");
    if (!fs.existsSync(currentFilePath)) {
        throw new Error(".current.json file not found. Please deploy the contract first.");
    }

    const currentData = JSON.parse(fs.readFileSync(currentFilePath, "utf8"));
    return currentData;
}