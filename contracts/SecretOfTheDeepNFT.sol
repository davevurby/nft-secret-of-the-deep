// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @dev ERC-4906 Metadata Update Extension for ERC-1155
 * Based on the official ERC-4906 standard: https://eips.ethereum.org/EIPS/eip-4906
 */
interface IERC4906 {
    event MetadataUpdate(uint256 _tokenId);
    event BatchMetadataUpdate(uint256 _fromTokenId, uint256 _toTokenId);
}

/**
 * @dev USDC Token Interface
 */
interface IUSDC is IERC20 {
    function decimals() external view returns (uint8);
}

/**
 * @title SecretOfTheDeepNFT
 * @dev ERC-1155 contract for "Secret of the Deep" NFT collection
 * This contract allows for multiple token types with different metadata
 */
contract SecretOfTheDeepNFT is ERC1155, Ownable, IERC4906 {
    using Strings for uint256;
    
    // Contract metadata
    string public name = "Esantirion: Secret of the Deep";
    string public symbol = "ESOTD";
    
    // Token metadata
    struct TokenInfo {
        string name;
        string description;
        uint256 maxSupply;
        uint256 currentSupply;
        bool isActive;
    }
    
    // Mapping from token ID to token info
    mapping(uint256 => TokenInfo) public tokenInfo;
    
    // Events
    event TokenCreated(uint256 indexed tokenId, string name, uint256 maxSupply);
    event TokenMinted(uint256 indexed tokenId, address indexed to, uint256 amount);
    event TokenBurned(uint256 indexed tokenId, address indexed from, uint256 amount);
    event TokenInfoUpdated(uint256 indexed tokenId, string name, string description);
    event TokenPayback(uint256 indexed tokenId, address indexed from, uint256 tokenAmount, uint256 usdcAmount);
    
    // Base URI for metadata
    string private _baseURI;
    
    // Contract URI for collection metadata
    string private _contractURI = "https://raw.githubusercontent.com/davevurby/nft-secret-of-the-deep/refs/heads/main/metadata/contract.json";
    
    // USDC token address (Polygon Native USDC)
    address public usdcAddress = 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359;
    
    event USDCAddressSet(address indexed oldAddress, address indexed newAddress);
    event USDCAdded(uint256 indexed amount, address indexed from);
    event USDCWithdrawn(uint256 indexed amount, address indexed to);
    event DividendPaid(address indexed to, uint256 indexed amount);
    
    constructor() ERC1155("") Ownable(msg.sender) {
        _baseURI = "https://raw.githubusercontent.com/davevurby/nft-secret-of-the-deep/refs/heads/main/metadata/{id}.json";
        
        // Initialize some sample tokens
        _createToken(1, "GOLD", "Gold", 25);
        _createToken(2, "SILVER", "Silver", 20);
        _createToken(3, "BRONZE", "Bronze", 50);
    }
    
    /**
     * @dev Creates a new token type
     * @param tokenId The ID of the token
     * @param name The name of the token
     * @param description The description of the token
     * @param maxSupply The maximum supply of this token type
     */
    function createToken(
        uint256 tokenId,
        string memory name,
        string memory description,
        uint256 maxSupply
    ) external onlyOwner {
        require(!tokenInfo[tokenId].isActive, "Token already exists");
        require(maxSupply > 0, "Max supply must be greater than 0");
        
        _createToken(tokenId, name, description, maxSupply);
    }
    
    /**
     * @dev Mints tokens to a specific address
     * @param to The address to mint to
     * @param tokenId The ID of the token to mint
     * @param amount The amount to mint
     */
    function mint(address to, uint256 tokenId, uint256 amount) external onlyOwner {
        require(tokenInfo[tokenId].isActive, "Token does not exist");
        require(
            tokenInfo[tokenId].currentSupply + amount <= tokenInfo[tokenId].maxSupply,
            "Exceeds max supply"
        );
        
        tokenInfo[tokenId].currentSupply += amount;
        _mint(to, tokenId, amount, "");
        
        emit TokenMinted(tokenId, to, amount);
    }
    
    /**
     * @dev Batch mints multiple tokens
     * @param to The address to mint to
     * @param tokenIds Array of token IDs
     * @param amounts Array of amounts to mint
     */
    function mintBatch(
        address to,
        uint256[] memory tokenIds,
        uint256[] memory amounts
    ) external onlyOwner {
        require(tokenIds.length == amounts.length, "Arrays length mismatch");
        
        for (uint256 i = 0; i < tokenIds.length; i++) {
            require(tokenInfo[tokenIds[i]].isActive, "Token does not exist");
            require(
                tokenInfo[tokenIds[i]].currentSupply + amounts[i] <= tokenInfo[tokenIds[i]].maxSupply,
                "Exceeds max supply"
            );
            
            tokenInfo[tokenIds[i]].currentSupply += amounts[i];
        }
        
        _mintBatch(to, tokenIds, amounts, "");
        
        for (uint256 i = 0; i < tokenIds.length; i++) {
            emit TokenMinted(tokenIds[i], to, amounts[i]);
        }
    }
    
    /**
     * @dev Burns tokens from a specific address
     * @param from The address to burn from
     * @param tokenId The ID of the token to burn
     * @param amount The amount to burn
     */
    function burn(address from, uint256 tokenId, uint256 amount) external {
        require(
            msg.sender == from || msg.sender == owner(),
            "Not authorized to burn"
        );
        
        tokenInfo[tokenId].currentSupply -= amount;
        _burn(from, tokenId, amount);
        
        emit TokenBurned(tokenId, from, amount);
    }
    
    /**
     * @dev Payback function - owner buys back tokens for specified USDC amount
     * @param from The address to buy back from
     * @param tokenId The ID of the token to buy back
     * @param tokenAmount The amount of tokens to buy back
     * @param usdcAmount The USDC amount to pay (with 6 decimals)
     */
    function payback(address from, uint256 tokenId, uint256 tokenAmount, uint256 usdcAmount) external onlyOwner {
        require(tokenInfo[tokenId].isActive, "Token does not exist");
        require(tokenAmount > 0, "Token amount must be greater than 0");
        require(balanceOf(from, tokenId) >= tokenAmount, "Insufficient token balance");
        require(usdcAmount > 0, "USDC amount must be greater than 0");
        
        // Check if contract has enough USDC
        IUSDC usdc = IUSDC(usdcAddress);
        require(usdc.balanceOf(address(this)) >= usdcAmount, "Insufficient USDC balance");
        
        // Burn tokens
        tokenInfo[tokenId].currentSupply -= tokenAmount;
        _burn(from, tokenId, tokenAmount);
        
        // Transfer USDC to the token holder
        require(usdc.transfer(from, usdcAmount), "USDC transfer failed");
        
        emit TokenBurned(tokenId, from, tokenAmount);
        emit TokenPayback(tokenId, from, tokenAmount, usdcAmount);
    }

    /**
     * @dev Dividend payout function - owner sends USDC to specified address
     * @param to The address to send USDC to
     * @param usdcAmount The USDC amount to send (with 6 decimals)
     */
    function payDividend(address to, uint256 usdcAmount) external onlyOwner {
        require(to != address(0), "Invalid recipient address");
        require(usdcAmount > 0, "USDC amount must be greater than 0");
        
        // Check if contract has enough USDC
        IUSDC usdc = IUSDC(usdcAddress);
        require(usdc.balanceOf(address(this)) >= usdcAmount, "Insufficient USDC balance");
        
        // Transfer USDC to the recipient
        require(usdc.transfer(to, usdcAmount), "USDC transfer failed");
        
        emit DividendPaid(to, usdcAmount);
    }
    
    /**
     * @dev Get current USDC balance of the contract
     * @return The current USDC balance (with 6 decimals)
     */
    function getUSDCBalance() external view returns (uint256) {
        IUSDC usdc = IUSDC(usdcAddress);
        return usdc.balanceOf(address(this));
    }
    
    /**
     * @dev Emergency function to withdraw USDC from contract to owner (owner only)
     * @param amount The amount of USDC to withdraw
     */
    function withdrawUSDC(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        
        IUSDC usdc = IUSDC(usdcAddress);
        require(usdc.balanceOf(address(this)) >= amount, "Insufficient USDC balance");
        
        require(usdc.transfer(owner(), amount), "USDC transfer failed");
        
        emit USDCWithdrawn(amount, owner());
    }

    /**
     * @dev Add USDC to contract for payback functionality (owner only)
     * @param amount The amount of USDC to add to contract
     */
    function addUSDC(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        
        IUSDC usdc = IUSDC(usdcAddress);
        require(usdc.balanceOf(msg.sender) >= amount, "Insufficient USDC balance in wallet");
        
        // Transfer USDC from owner to contract
        require(usdc.transferFrom(msg.sender, address(this), amount), "USDC transfer failed");
        
        emit USDCAdded(amount, msg.sender);
    }
    
    /**
     * @dev Updates token metadata
     * @param tokenId The ID of the token
     * @param name The new name
     * @param description The new description
     */
    function updateTokenInfo(
        uint256 tokenId,
        string memory name,
        string memory description
    ) external onlyOwner {
        require(tokenInfo[tokenId].isActive, "Token does not exist");
        
        tokenInfo[tokenId].name = name;
        tokenInfo[tokenId].description = description;
        
        emit TokenInfoUpdated(tokenId, name, description);
        emit MetadataUpdate(tokenId);
    }
    
    /**
     * @dev Sets the base URI for metadata
     * @param newBaseURI The new base URI
     */
    function setBaseURI(string memory newBaseURI) external onlyOwner {
        _baseURI = newBaseURI;
        emit BatchMetadataUpdate(0, type(uint256).max);
    }
    
    /**
     * @dev Converts uint256 to 64-character hex string with leading zeros
     * @param value The uint256 value to convert
     * @return The 64-character hex string
     */
    function _toHexString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0000000000000000000000000000000000000000000000000000000000000000";
        }
        
        uint256 temp = value;
        uint256 digits = 0;
        while (temp != 0) {
            digits++;
            temp >>= 4;
        }
        
        bytes memory buffer = new bytes(64);
        for (uint256 i = 64; i > 0; i--) {
            buffer[i - 1] = _HEX_SYMBOLS[value & 0xf];
            value >>= 4;
        }
        
        return string(buffer);
    }
    
    // Hex symbols for conversion
    bytes16 private constant _HEX_SYMBOLS = "0123456789abcdef";

    /**
     * @dev Returns the URI for a token ID
     * @param tokenId The ID of the token
     * @return The URI of the token
     */
    function uri(uint256 tokenId) public view virtual override returns (string memory) {
        require(tokenInfo[tokenId].isActive, "Token does not exist");
        
        // Replace {id} placeholder with actual tokenId in 64-char hex format
        string memory template = _baseURI;
        bytes memory templateBytes = bytes(template);
        bytes memory result = new bytes(templateBytes.length + 64); // 64 chars for hex
        
        uint256 resultIndex = 0;
        for (uint256 i = 0; i < templateBytes.length; i++) {
            if (i < templateBytes.length - 3) {
                // Check for {id} pattern
                if (templateBytes[i] == 0x7b && // '{'
                    templateBytes[i + 1] == 0x69 && // 'i'
                    templateBytes[i + 2] == 0x64 && // 'd'
                    templateBytes[i + 3] == 0x7d) { // '}'
                    
                    // Replace {id} with tokenId in 64-char hex format
                    string memory tokenIdStr = _toHexString(tokenId);
                    bytes memory tokenIdBytes = bytes(tokenIdStr);
                    for (uint256 j = 0; j < tokenIdBytes.length; j++) {
                        result[resultIndex] = tokenIdBytes[j];
                        resultIndex++;
                    }
                    i += 3; // Skip the rest of {id}
                } else {
                    result[resultIndex] = templateBytes[i];
                    resultIndex++;
                }
            } else {
                result[resultIndex] = templateBytes[i];
                resultIndex++;
            }
        }
        
        // Trim the result to actual length
        bytes memory finalResult = new bytes(resultIndex);
        for (uint256 i = 0; i < resultIndex; i++) {
            finalResult[i] = result[i];
        }
        
        return string(finalResult);
    }
    
    /**
     * @dev Returns token information
     * @param tokenId The ID of the token
     * @return name The name of the token
     * @return description The description of the token
     * @return maxSupply The maximum supply
     * @return currentSupply The current supply
     * @return isActive Whether the token is active
     */
    function getTokenInfo(uint256 tokenId) external view returns (
        string memory name,
        string memory description,
        uint256 maxSupply,
        uint256 currentSupply,
        bool isActive
    ) {
        TokenInfo memory info = tokenInfo[tokenId];
        return (
            info.name,
            info.description,
            info.maxSupply,
            info.currentSupply,
            info.isActive
        );
    }
    
    /**
     * @dev Internal function to create a token
     */
    function _createToken(
        uint256 tokenId,
        string memory name,
        string memory description,
        uint256 maxSupply
    ) internal {
        tokenInfo[tokenId] = TokenInfo({
            name: name,
            description: description,
            maxSupply: maxSupply,
            currentSupply: 0,
            isActive: true
        });
        
        emit TokenCreated(tokenId, name, maxSupply);
    }
    
    /**
     * @dev Sets the contract URI for collection metadata
     * @param newContractURI The new contract URI
     */
    function setContractURI(string memory newContractURI) external onlyOwner {
        _contractURI = newContractURI;
        emit BatchMetadataUpdate(0, type(uint256).max);
    }
    
    /**
     * @dev Returns the contract URI for collection metadata
     * @return The contract URI
     */
    function contractURI() external view returns (string memory) {
        return _contractURI;
    }

    /**
     * @dev Sets the collection name (owner only)
     * @param newName The new name for the collection
     */
    function setName(string memory newName) external onlyOwner {
        name = newName;
        emit BatchMetadataUpdate(0, type(uint256).max);
    }

    /**
     * @dev Sets the collection symbol (owner only)
     * @param newSymbol The new symbol for the collection
     */
    function setSymbol(string memory newSymbol) external onlyOwner {
        symbol = newSymbol;
        emit BatchMetadataUpdate(0, type(uint256).max);
    }

    /**
     * @dev Sets the USDC token address (owner only)
     * @param newUSDCAddress The new USDC token address
     */
    function setUSDCAddress(address newUSDCAddress) external onlyOwner {
        require(newUSDCAddress != address(0), "USDC address cannot be zero");
        
        address oldAddress = usdcAddress;
        usdcAddress = newUSDCAddress;
        
        emit USDCAddressSet(oldAddress, newUSDCAddress);
    }
}
