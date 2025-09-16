import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("SecretOfTheDeepNFT", (m) => {
  const secretOfTheDeepNFT = m.contract("SecretOfTheDeepNFT");

  return { secretOfTheDeepNFT };
});
