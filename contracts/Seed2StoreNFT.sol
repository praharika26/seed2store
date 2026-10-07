// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title Seed2StoreNFT
 * @dev ERC721 NFT contract for verifiable crop certificates
 * Each crop registration creates a unique NFT with authenticity proof
 */
contract Seed2StoreNFT is ERC721, ERC721URIStorage, ERC721Burnable, Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;
    
    Counters.Counter private _tokenIds;
    Counters.Counter private _auctionIds;
    
    // Platform fee (in basis points, 250 = 2.5%)
    uint256 public platformFee = 250;
    uint256 public constant MAX_PLATFORM_FEE = 1000; // 10% max
    
    struct CropCertificate {
        uint256 tokenId;
        address farmer;
        string title;
        string description;
        string cropType;
        string variety;
        uint256 quantity;
        string unit;
        string location;
        bool isOrganic;
        string qualityGrade;
        uint256 harvestDate;
        uint256 minimumPrice;
        uint256 buyoutPrice;
        string ipfsMetadata; // Complete metadata on IPFS
        uint256 createdAt;
        bool isActive;
        bool isSold;
    }
    
    struct Auction {
        uint256 id;
        uint256 tokenId;
        address farmer;
        uint256 startingPrice;
        uint256 reservePrice;
        uint256 currentBid;
        address currentBidder;
        uint256 bidIncrement;
        uint256 startTime;
        uint256 endTime;
        bool isActive;
        bool isFinalized;
        uint256 totalBids;
    }
    
    struct Bid {
        address bidder;
        uint256 amount;
        uint256 timestamp;
    }
    
    // Mappings
    mapping(uint256 => CropCertificate) public cropCertificates;
    mapping(uint256 => Auction) public auctions;
    mapping(uint256 => Bid[]) public auctionBids;
    mapping(address => uint256[]) public farmerCrops;
    mapping(uint256 => uint256) public tokenToAuction; // tokenId => auctionId
    mapping(address => bool) public verifiedFarmers;
    mapping(string => bool) public usedIPFSHashes; // Prevent duplicate metadata
    
    // Events
    event CropCertificateCreated(uint256 indexed tokenId, address indexed farmer, string title);
    event FarmerVerified(address indexed farmer, address indexed verifier);
    event FarmerUnverified(address indexed farmer, address indexed verifier);
    event AuctionCreated(uint256 indexed auctionId, uint256 indexed tokenId, uint256 startingPrice);
    event BidPlaced(uint256 indexed auctionId, address indexed bidder, uint256 amount);
    event AuctionFinalized(uint256 indexed auctionId, address indexed winner, uint256 finalPrice);
    event DirectPurchase(uint256 indexed tokenId, address indexed buyer, uint256 amount);
    event CropSold(uint256 indexed tokenId, address indexed buyer, uint256 amount);
    
    constructor() ERC721("Seed2Store Certificate", "S2SC") {}
    
    /**
     * @dev Create a verifiable crop certificate (NFT)
     */
    function createCropCertificate(
        string memory _title,
        string memory _description,
        string memory _cropType,
        string memory _variety,
        uint256 _quantity,
        string memory _unit,
        string memory _location,
        bool _isOrganic,
        string memory _qualityGrade,
        uint256 _harvestDate,
        uint256 _minimumPrice,
        uint256 _buyoutPrice,
        string memory _ipfsMetadata
    ) external returns (uint256) {
        require(bytes(_title).length > 0, "Title cannot be empty");
        require(_quantity > 0, "Quantity must be greater than 0");
        require(_minimumPrice > 0, "Minimum price must be greater than 0");
        require(bytes(_ipfsMetadata).length > 0, "IPFS metadata required");
        require(!usedIPFSHashes[_ipfsMetadata], "IPFS hash already used");
        
        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();
        
        // Mint NFT to farmer
        _safeMint(msg.sender, newTokenId);
        _setTokenURI(newTokenId, _ipfsMetadata);
        
        // Mark IPFS hash as used
        usedIPFSHashes[_ipfsMetadata] = true;
        
        // Create crop certificate
        cropCertificates[newTokenId] = CropCertificate({
            tokenId: newTokenId,
            farmer: msg.sender,
            title: _title,
            description: _description,
            cropType: _cropType,
            variety: _variety,
            quantity: _quantity,
            unit: _unit,
            location: _location,
            isOrganic: _isOrganic,
            qualityGrade: _qualityGrade,
            harvestDate: _harvestDate,
            minimumPrice: _minimumPrice,
            buyoutPrice: _buyoutPrice,
            ipfsMetadata: _ipfsMetadata,
            createdAt: block.timestamp,
            isActive: true,
            isSold: false
        });
        
        farmerCrops[msg.sender].push(newTokenId);
        
        emit CropCertificateCreated(newTokenId, msg.sender, _title);
        return newTokenId;
    }
    
    /**
     * @dev Create an auction for a crop NFT
     */
    function createAuction(
        uint256 _tokenId,
        uint256 _startingPrice,
        uint256 _reservePrice,
        uint256 _bidIncrement,
        uint256 _duration
    ) external returns (uint256) {
        require(ownerOf(_tokenId) == msg.sender, "Only NFT owner can create auction");
        require(cropCertificates[_tokenId].isActive, "Crop is not active");
        require(!cropCertificates[_tokenId].isSold, "Crop already sold");
        require(_startingPrice >= cropCertificates[_tokenId].minimumPrice, "Starting price below minimum");
        require(tokenToAuction[_tokenId] == 0, "Auction already exists for this NFT");
        require(_duration >= 1 hours && _duration <= 30 days, "Invalid auction duration");
        
        _auctionIds.increment();
        uint256 newAuctionId = _auctionIds.current();
        
        auctions[newAuctionId] = Auction({
            id: newAuctionId,
            tokenId: _tokenId,
            farmer: msg.sender,
            startingPrice: _startingPrice,
            reservePrice: _reservePrice,
            currentBid: 0,
            currentBidder: address(0),
            bidIncrement: _bidIncrement,
            startTime: block.timestamp,
            endTime: block.timestamp + _duration,
            isActive: true,
            isFinalized: false,
            totalBids: 0
        });
        
        tokenToAuction[_tokenId] = newAuctionId;
        
        emit AuctionCreated(newAuctionId, _tokenId, _startingPrice);
        return newAuctionId;
    }
    
    /**
     * @dev Place a bid on an auction
     */
    function placeBid(uint256 _auctionId) external payable nonReentrant {
        Auction storage auction = auctions[_auctionId];
        require(auction.isActive, "Auction is not active");
        require(block.timestamp < auction.endTime, "Auction has ended");
        require(msg.sender != auction.farmer, "Farmer cannot bid on own auction");
        
        uint256 minBid = auction.currentBid == 0 
            ? auction.startingPrice 
            : auction.currentBid + auction.bidIncrement;
        
        require(msg.value >= minBid, "Bid too low");
        
        // Refund previous bidder
        if (auction.currentBidder != address(0)) {
            payable(auction.currentBidder).transfer(auction.currentBid);
        }
        
        auction.currentBid = msg.value;
        auction.currentBidder = msg.sender;
        auction.totalBids++;
        
        auctionBids[_auctionId].push(Bid({
            bidder: msg.sender,
            amount: msg.value,
            timestamp: block.timestamp
        }));
        
        // Extend auction if bid placed in last 10 minutes
        if (auction.endTime - block.timestamp < 10 minutes) {
            auction.endTime = block.timestamp + 10 minutes;
        }
        
        emit BidPlaced(_auctionId, msg.sender, msg.value);
    }
    
    /**
     * @dev Finalize an auction
     */
    function finalizeAuction(uint256 _auctionId) external nonReentrant {
        Auction storage auction = auctions[_auctionId];
        require(auction.isActive, "Auction is not active");
        require(block.timestamp >= auction.endTime, "Auction has not ended");
        require(!auction.isFinalized, "Auction already finalized");
        
        auction.isActive = false;
        auction.isFinalized = true;
        
        if (auction.currentBidder != address(0) && auction.currentBid >= auction.reservePrice) {
            // Successful auction
            uint256 platformFeeAmount = (auction.currentBid * platformFee) / 10000;
            uint256 farmerAmount = auction.currentBid - platformFeeAmount;
            
            // Transfer NFT to winner
            _transfer(auction.farmer, auction.currentBidder, auction.tokenId);
            
            // Mark crop as sold
            cropCertificates[auction.tokenId].isSold = true;
            cropCertificates[auction.tokenId].isActive = false;
            
            // Transfer funds to farmer
            payable(auction.farmer).transfer(farmerAmount);
            
            emit AuctionFinalized(_auctionId, auction.currentBidder, auction.currentBid);
            emit CropSold(auction.tokenId, auction.currentBidder, auction.currentBid);
        } else {
            // Failed auction - refund highest bidder and free the lot so it can be relisted
            if (auction.currentBidder != address(0)) {
                payable(auction.currentBidder).transfer(auction.currentBid);
            }
            tokenToAuction[auction.tokenId] = 0;
            emit AuctionFinalized(_auctionId, address(0), 0);
        }
    }
    
    /**
     * @dev Direct purchase of a crop NFT
     */
    function directPurchase(uint256 _tokenId) external payable nonReentrant {
        CropCertificate storage crop = cropCertificates[_tokenId];
        require(crop.isActive, "Crop is not active");
        require(!crop.isSold, "Crop already sold");
        require(crop.buyoutPrice > 0, "Direct purchase not available");
        require(msg.sender != crop.farmer, "Farmer cannot buy own crop");
        require(ownerOf(_tokenId) == crop.farmer, "Farmer no longer owns NFT");
        require(tokenToAuction[_tokenId] == 0, "Crop is in an active auction");
        
        uint256 totalCost = crop.buyoutPrice;
        require(msg.value >= totalCost, "Insufficient payment");
        
        uint256 platformFeeAmount = (totalCost * platformFee) / 10000;
        uint256 farmerAmount = totalCost - platformFeeAmount;
        
        // Transfer NFT to buyer
        _transfer(crop.farmer, msg.sender, _tokenId);
        
        // Mark crop as sold
        crop.isSold = true;
        crop.isActive = false;
        
        // Transfer funds to farmer
        payable(crop.farmer).transfer(farmerAmount);
        
        // Refund excess payment
        if (msg.value > totalCost) {
            payable(msg.sender).transfer(msg.value - totalCost);
        }
        
        emit DirectPurchase(_tokenId, msg.sender, totalCost);
        emit CropSold(_tokenId, msg.sender, totalCost);
    }
    
    /**
     * @dev Verify a farmer (only owner)
     */
    function verifyFarmer(address _farmer) external onlyOwner {
        verifiedFarmers[_farmer] = true;
        emit FarmerVerified(_farmer, msg.sender);
    }
    
    /**
     * @dev Unverify a farmer (only owner)
     */
    function unverifyFarmer(address _farmer) external onlyOwner {
        verifiedFarmers[_farmer] = false;
        emit FarmerUnverified(_farmer, msg.sender);
    }
    
    /**
     * @dev Check if farmer is verified
     */
    function isFarmerVerified(address _farmer) external view returns (bool) {
        return verifiedFarmers[_farmer];
    }
    
    /**
     * @dev Get crop certificate details
     */
    function getCropCertificate(uint256 _tokenId) external view returns (CropCertificate memory) {
        require(_exists(_tokenId), "Token does not exist");
        return cropCertificates[_tokenId];
    }
    
    /**
     * @dev Get auction details
     */
    function getAuction(uint256 _auctionId) external view returns (Auction memory) {
        return auctions[_auctionId];
    }
    
    /**
     * @dev Get auction bids
     */
    function getAuctionBids(uint256 _auctionId) external view returns (Bid[] memory) {
        return auctionBids[_auctionId];
    }
    
    /**
     * @dev Get farmer's crops
     */
    function getFarmerCrops(address _farmer) external view returns (uint256[] memory) {
        return farmerCrops[_farmer];
    }
    
    /**
     * @dev Get all active crops
     */
    function getActiveCrops() external view returns (uint256[] memory) {
        uint256 totalSupply = _tokenIds.current();
        uint256[] memory activeCrops = new uint256[](totalSupply);
        uint256 activeCount = 0;
        
        for (uint256 i = 1; i <= totalSupply; i++) {
            if (cropCertificates[i].isActive && !cropCertificates[i].isSold) {
                activeCrops[activeCount] = i;
                activeCount++;
            }
        }
        
        // Resize array to actual count
        uint256[] memory result = new uint256[](activeCount);
        for (uint256 i = 0; i < activeCount; i++) {
            result[i] = activeCrops[i];
        }
        
        return result;
    }
    
    /**
     * @dev Update platform fee (only owner)
     */
    function updatePlatformFee(uint256 _newFee) external onlyOwner {
        require(_newFee <= MAX_PLATFORM_FEE, "Fee too high");
        platformFee = _newFee;
    }
    
    /**
     * @dev Withdraw platform fees (only owner)
     */
    function withdrawFees() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        payable(owner()).transfer(balance);
    }
    
    /**
     * @dev Emergency deactivate crop (only owner)
     */
    function emergencyDeactivateCrop(uint256 _tokenId) external onlyOwner {
        cropCertificates[_tokenId].isActive = false;
    }
    
    // Counters
    function getCurrentTokenId() external view returns (uint256) {
        return _tokenIds.current();
    }
    
    function getCurrentAuctionId() external view returns (uint256) {
        return _auctionIds.current();
    }
    
    // Override required functions
    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }
    
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}