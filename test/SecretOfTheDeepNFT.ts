import { expect } from "chai";
import hre from "hardhat";
import { SecretOfTheDeepNFT } from "../typechain-types";

describe("SecretOfTheDeepNFT", function () {
  let nftContract: SecretOfTheDeepNFT;
  let owner: any;
  let user1: any;
  let user2: any;

  beforeEach(async function () {
    [owner, user1, user2] = await hre.ethers.getSigners();
    
    const SecretOfTheDeepNFT = await hre.ethers.getContractFactory("SecretOfTheDeepNFT");
    nftContract = await SecretOfTheDeepNFT.deploy();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await nftContract.owner()).to.equal(owner.address);
    });

    it("Should initialize with sample tokens", async function () {
      // Check if sample tokens were created
      const token1Info = await nftContract.getTokenInfo(1);
      expect(token1Info.name).to.equal("GOLD");
      expect(token1Info.maxSupply).to.equal(50);
      expect(token1Info.isActive).to.be.true;

      const token2Info = await nftContract.getTokenInfo(2);
      expect(token2Info.name).to.equal("SILVER");
      expect(token2Info.maxSupply).to.equal(40);
      expect(token2Info.isActive).to.be.true;

      const token3Info = await nftContract.getTokenInfo(3);
      expect(token3Info.name).to.equal("BRONZE");
      expect(token3Info.maxSupply).to.equal(20);
      expect(token3Info.isActive).to.be.true;
    });
  });

  describe("Token Creation", function () {
    it("Should allow owner to create new tokens", async function () {
      await expect(
        nftContract.createToken(
          4,
          "Deep Sea Crystal",
          "A rare crystal from the ocean depths",
          100
        )
      ).to.emit(nftContract, "TokenCreated")
        .withArgs(4, "Deep Sea Crystal", 100);

      const tokenInfo = await nftContract.getTokenInfo(4);
      expect(tokenInfo.name).to.equal("Deep Sea Crystal");
      expect(tokenInfo.maxSupply).to.equal(100);
      expect(tokenInfo.currentSupply).to.equal(0);
    });

    it("Should not allow non-owner to create tokens", async function () {
      await expect(
        nftContract.connect(user1).createToken(
          4,
          "Deep Sea Crystal",
          "A rare crystal from the ocean depths",
          100
        )
      ).to.be.revertedWithCustomError(nftContract, "OwnableUnauthorizedAccount");
    });

    it("Should not allow creating token with existing ID", async function () {
      await expect(
        nftContract.createToken(
          1,
          "Duplicate Token",
          "This should fail",
          100
        )
      ).to.be.revertedWith("Token already exists");
    });
  });

  describe("Minting", function () {
    it("Should allow owner to mint tokens", async function () {
      await expect(
        nftContract.mint(user1.address, 1, 10)
      ).to.emit(nftContract, "TokenMinted")
        .withArgs(1, user1.address, 10);

      expect(await nftContract.balanceOf(user1.address, 1)).to.equal(10);
      
      const tokenInfo = await nftContract.getTokenInfo(1);
      expect(tokenInfo.currentSupply).to.equal(10);
    });

    it("Should not allow non-owner to mint", async function () {
      await expect(
        nftContract.connect(user1).mint(user1.address, 1, 10)
      ).to.be.revertedWithCustomError(nftContract, "OwnableUnauthorizedAccount");
    });

    it("Should not allow minting more than max supply", async function () {
      await expect(
        nftContract.mint(user1.address, 3, 21) // Max supply is 20
      ).to.be.revertedWith("Exceeds max supply");
    });

    it("Should not allow minting non-existent token", async function () {
      await expect(
        nftContract.mint(user1.address, 999, 10)
      ).to.be.revertedWith("Token does not exist");
    });
  });

  describe("Batch Minting", function () {
    it("Should allow owner to batch mint tokens", async function () {
      const tokenIds = [1, 2, 3];
      const amounts = [5, 10, 15];

      await expect(
        nftContract.mintBatch(user1.address, tokenIds, amounts)
      ).to.emit(nftContract, "TokenMinted");

      expect(await nftContract.balanceOf(user1.address, 1)).to.equal(5);
      expect(await nftContract.balanceOf(user1.address, 2)).to.equal(10);
      expect(await nftContract.balanceOf(user1.address, 3)).to.equal(15);
    });

    it("Should not allow batch minting with mismatched arrays", async function () {
      const tokenIds = [1, 2];
      const amounts = [5, 10, 15]; // Different length

      await expect(
        nftContract.mintBatch(user1.address, tokenIds, amounts)
      ).to.be.revertedWith("Arrays length mismatch");
    });
  });

  describe("Burning", function () {
    beforeEach(async function () {
      await nftContract.mint(user1.address, 1, 20);
    });

    it("Should allow token owner to burn their tokens", async function () {
      await expect(
        nftContract.connect(user1).burn(user1.address, 1, 5)
      ).to.emit(nftContract, "TokenBurned")
        .withArgs(1, user1.address, 5);

      expect(await nftContract.balanceOf(user1.address, 1)).to.equal(15);
      
      const tokenInfo = await nftContract.getTokenInfo(1);
      expect(tokenInfo.currentSupply).to.equal(15);
    });

    it("Should allow contract owner to burn tokens", async function () {
      await expect(
        nftContract.burn(user1.address, 1, 5)
      ).to.emit(nftContract, "TokenBurned")
        .withArgs(1, user1.address, 5);

      expect(await nftContract.balanceOf(user1.address, 1)).to.equal(15);
    });

    it("Should not allow unauthorized burning", async function () {
      await expect(
        nftContract.connect(user2).burn(user1.address, 1, 5)
      ).to.be.revertedWith("Not authorized to burn");
    });
  });

  describe("Token Information", function () {
    it("Should return correct token information", async function () {
      const tokenInfo = await nftContract.getTokenInfo(1);
      
              expect(tokenInfo.name).to.equal("GOLD");
              expect(tokenInfo.description).to.equal("Precious gold from the depths of the ocean");
      expect(tokenInfo.maxSupply).to.equal(50);
      expect(tokenInfo.currentSupply).to.equal(0);
      expect(tokenInfo.isActive).to.be.true;
    });

    it("Should allow owner to update token information", async function () {
      await expect(
        nftContract.updateTokenInfo(
          1,
          "Updated Pearl",
          "Updated description"
        )
      ).to.emit(nftContract, "TokenInfoUpdated")
        .withArgs(1, "Updated Pearl", "Updated description");

      const tokenInfo = await nftContract.getTokenInfo(1);
      expect(tokenInfo.name).to.equal("Updated Pearl");
      expect(tokenInfo.description).to.equal("Updated description");
    });

    it("Should not allow non-owner to update token information", async function () {
      await expect(
        nftContract.connect(user1).updateTokenInfo(
          1,
          "Updated Pearl",
          "Updated description"
        )
      ).to.be.revertedWithCustomError(nftContract, "OwnableUnauthorizedAccount");
    });
  });

  describe("URI", function () {
    it("Should return correct URI for token", async function () {
      const uri = await nftContract.uri(1);
              expect(uri).to.equal("https://api.copilot.cyrkl.com/tokens/1");
    });

    it("Should allow owner to update base URI", async function () {
      await nftContract.setBaseURI("https://newapi.example.com/metadata/");
      
      const uri = await nftContract.uri(1);
              expect(uri).to.equal("https://newapi.example.com/metadata/");
    });

          it("Should not allow non-owner to update base URI", async function () {
        await expect(
          nftContract.connect(user1).setBaseURI("https://newapi.example.com/metadata/")
        ).to.be.revertedWithCustomError(nftContract, "OwnableUnauthorizedAccount");
      });
    });

    describe("Collection Metadata", function () {
      it("Should allow owner to set collection name", async function () {
        const newName = "New Collection Name";
        await nftContract.setName(newName);
        expect(await nftContract.name()).to.equal(newName);
      });

      it("Should not allow non-owner to set collection name", async function () {
        await expect(
          nftContract.connect(user1).setName("New Name")
        ).to.be.revertedWithCustomError(nftContract, "OwnableUnauthorizedAccount");
      });

      it("Should allow owner to set collection symbol", async function () {
        const newSymbol = "NEW";
        await nftContract.setSymbol(newSymbol);
        expect(await nftContract.symbol()).to.equal(newSymbol);
      });

      it("Should not allow non-owner to set collection symbol", async function () {
        await expect(
          nftContract.connect(user1).setSymbol("NEW")
        ).to.be.revertedWithCustomError(nftContract, "OwnableUnauthorizedAccount");
      });
    });

  describe("ERC-1155 Standard Functions", function () {
    beforeEach(async function () {
      await nftContract.mint(user1.address, 1, 10);
      await nftContract.mint(user1.address, 2, 5);
    });

    it("Should support safeTransferFrom", async function () {
      await nftContract.connect(user1).safeTransferFrom(user1.address, user2.address, 1, 3, "0x");
      
      expect(await nftContract.balanceOf(user1.address, 1)).to.equal(7);
      expect(await nftContract.balanceOf(user2.address, 1)).to.equal(3);
    });

    it("Should support safeBatchTransferFrom", async function () {
      const tokenIds = [1, 2];
      const amounts = [2, 1];
      
      await nftContract.connect(user1).safeBatchTransferFrom(
        user1.address,
        user2.address,
        tokenIds,
        amounts,
        "0x"
      );
      
      expect(await nftContract.balanceOf(user1.address, 1)).to.equal(8);
      expect(await nftContract.balanceOf(user1.address, 2)).to.equal(4);
      expect(await nftContract.balanceOf(user2.address, 1)).to.equal(2);
      expect(await nftContract.balanceOf(user2.address, 2)).to.equal(1);
    });

    it("Should support approval", async function () {
      await nftContract.connect(user1).setApprovalForAll(user2.address, true);
      
      expect(await nftContract.isApprovedForAll(user1.address, user2.address)).to.be.true;
    });
  });
});
