import { ethers } from "hardhat";

async function main() {
  console.log("Deploying SecretOfTheDeepNFT...");

  const SecretOfTheDeepNFT = await ethers.getContractFactory("SecretOfTheDeepNFT");
  const nftContract = await SecretOfTheDeepNFT.deploy();

  await nftContract.waitForDeployment();

  const address = await nftContract.getAddress();
  console.log(`SecretOfTheDeepNFT deployed to: ${address}`);

  // Verify the deployment by checking the owner
  const owner = await nftContract.owner();
  const [deployer] = await ethers.getSigners();
  console.log(`Contract owner: ${owner}`);
  console.log(`Deployer address: ${deployer.address}`);

  // Check initial tokens
  console.log("\nInitial tokens:");
  for (let i = 1; i <= 3; i++) {
    const tokenInfo = await nftContract.getTokenInfo(i);
    console.log(`Token ${i}: ${tokenInfo.name} (Max Supply: ${tokenInfo.maxSupply})`);
  }

  console.log("\nDeployment completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
