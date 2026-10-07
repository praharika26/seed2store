// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title AgriTrustSimple
 * @dev Simplified agricultural marketplace without token complexity
 * Focus on core functionality: crop registration, auctions, direct sales
 */
contract AgriTrustSimple is ReentrancyGuard, Ownable {
    using Counters for Counters.Counter;
    
    Counters.Counter private _cropIds;
    Counters.Counter private _auctionIds;
    Counters.Counter private _orderIds;
    
    // Platform fee (in basis points, 250 = 2.5%)
    uint256 public platformFee = 250;
    uint256 public constant MAX_PLATFORM_FEE = 1000; // 10% max
    
    struct Crop {
        uint256 id;
        address farmer;
        string title;
        string description;
        string cropType;
        uint256 quantity;
        string unit;
        uint256 minimumPrice;
        uint256 buyoutPrice;
        string ipfsHash;
        bool isActive;
        bool isOrganic;
        uint256 createdAt;
    }
    
    struct Auction {
        uint256 id;
        uint256 cropId;
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
    
    struct Order {
        uint256 id;
        uint256 cropId;
        address buyer;
        address farmer;
        uint256 quantity;
        uint256 totalAmount;
        bool isPaid;
        bool isDelivered;
        uint256 createdAt;
    }
    
    // Mappings
    mapping(uint256 => Crop) public crops;
    mapping(uint256 => Auction) public auctions;
    mapping(uint256 => Order) public orders;
    mapping(uint256 => Bid[]) public auctionBids;
    mapping(address => uint256[]) public farmerCrops;
    mapping(address => uint256[]) public buyerOrders;
    mapping(uint256 => uint256) public cropToAuction;
    
    // Events
    event CropRegistered(uint256 indexed cropId, address indexed farmer, string title);
    event AuctionCreated(uint256 indexed auctionId, uint256 indexed cropId, uint256 startingPrice);
    event BidPlaced(uint256 indexed auctionId, address indexed bidder, uint256 amount);
    event AuctionFinalized(uint256 indexed auctionId, address indexed winner, uint256 finalPrice);
    event DirectPurchase(uint256 indexed cropId, address indexed buyer, uint256 amount);
    event OrderCreated(uint256 indexed orderId, uint256 indexed cropId, address indexed buyer);
    event OrderDelivered(uint256 indexed orderId);
    event PlatformFeeUpdated(uint256 newFee);
    event FundsWithdrawn(address indexed recipient, uint256 amount);
    
    constructor() {}
    
    /**
     * @dev Register a new crop
     */
    function registerCrop(
        string memory _title,
        string memory _description,
        string memory _cropType,
        uint256 _quantity,
        string memory _unit,
        uint256 _minimumPrice,
        uint256 _buyoutPrice,
        string memory _ipfsHash,
        bool _isOrganic
    ) external returns (uint256) {
        require(bytes(_title).length > 0, "Title cannot be empty");
        require(_quantity > 0, "Quantity must be greater than 0");
        require(_minimumPrice > 0, "Minimum price must be greater than 0");
        
        _cropIds.increment();
        uint256 newCropId = _cropIds.current();
        
        crops[newCropId] = Crop({
            id: newCropId,
            farmer: msg.sender,
            title: _title,
            description: _description,
            cropType: _cropType,
            quantity: _quantity,
            unit: _unit,
            minimumPrice: _minimumPrice,
            buyoutPrice: _buyoutPrice,
            ipfsHash: _ipfsHash,
            isActive: true,
            isOrganic: _isOrganic,
            createdAt: block.timestamp
        });
        
        farmerCrops[msg.sender].push(newCropId);
        
        emit CropRegistered(newCropId, msg.sender, _title);
        return newCropId;
    }
    
    /**
     * @dev Create an auction for a crop
     */
    function createAuction(
        uint256 _cropId,
        uint256 _startingPrice,
        uint256 _reservePrice,
        uint256 _bidIncrement,
        uint256 _duration
    ) external returns (uint256) {
        Crop storage crop = crops[_cropId];
        require(crop.farmer == msg.sender, "Only crop owner can create auction");
        require(crop.isActive, "Crop is not active");
        require(_startingPrice >= crop.minimumPrice, "Starting price below minimum");
        require(_duration >= 1 hours && _duration <= 7 days, "Invalid auction duration");
        require(cropToAuction[_cropId] == 0, "Auction already exists for this crop");
        
        _auctionIds.increment();
        uint256 newAuctionId = _auctionIds.current();
        
        auctions[newAuctionId] = Auction({
            id: newAuctionId,
            cropId: _cropId,
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
        
        cropToAuction[_cropId] = newAuctionId;
        
        emit AuctionCreated(newAuctionId, _cropId, _startingPrice);
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
            
            // Create order
            _createOrder(auction.cropId, auction.currentBidder, crops[auction.cropId].quantity, auction.currentBid);
            
            // Transfer funds to farmer
            payable(auction.farmer).transfer(farmerAmount);
            
            // Deactivate crop
            crops[auction.cropId].isActive = false;
            
            emit AuctionFinalized(_auctionId, auction.currentBidder, auction.currentBid);
        } else {
            // Failed auction - refund highest bidder
            if (auction.currentBidder != address(0)) {
                payable(auction.currentBidder).transfer(auction.currentBid);
            }
            emit AuctionFinalized(_auctionId, address(0), 0);
        }
    }
    
    /**
     * @dev Direct purchase of a crop
     */
    function directPurchase(uint256 _cropId, uint256 _quantity) external payable nonReentrant {
        Crop storage crop = crops[_cropId];
        require(crop.isActive, "Crop is not active");
        require(crop.buyoutPrice > 0, "Direct purchase not available");
        require(_quantity > 0 && _quantity <= crop.quantity, "Invalid quantity");
        require(msg.sender != crop.farmer, "Farmer cannot buy own crop");
        
        uint256 totalCost = (crop.buyoutPrice * _quantity) / crop.quantity;
        require(msg.value >= totalCost, "Insufficient payment");
        
        uint256 platformFeeAmount = (totalCost * platformFee) / 10000;
        uint256 farmerAmount = totalCost - platformFeeAmount;
        
        // Create order
        _createOrder(_cropId, msg.sender, _quantity, totalCost);
        
        // Transfer funds to farmer
        payable(crop.farmer).transfer(farmerAmount);
        
        // Update crop quantity or deactivate
        if (_quantity == crop.quantity) {
            crop.isActive = false;
        } else {
            crop.quantity -= _quantity;
        }
        
        // Refund excess payment
        if (msg.value > totalCost) {
            payable(msg.sender).transfer(msg.value - totalCost);
        }
        
        emit DirectPurchase(_cropId, msg.sender, totalCost);
    }
    
    /**
     * @dev Internal function to create an order
     */
    function _createOrder(uint256 _cropId, address _buyer, uint256 _quantity, uint256 _totalAmount) internal {
        _orderIds.increment();
        uint256 newOrderId = _orderIds.current();
        
        orders[newOrderId] = Order({
            id: newOrderId,
            cropId: _cropId,
            buyer: _buyer,
            farmer: crops[_cropId].farmer,
            quantity: _quantity,
            totalAmount: _totalAmount,
            isPaid: true,
            isDelivered: false,
            createdAt: block.timestamp
        });
        
        buyerOrders[_buyer].push(newOrderId);
        
        emit OrderCreated(newOrderId, _cropId, _buyer);
    }
    
    /**
     * @dev Mark an order as delivered
     */
    function markOrderDelivered(uint256 _orderId) external {
        Order storage order = orders[_orderId];
        require(order.farmer == msg.sender, "Only farmer can mark as delivered");
        require(order.isPaid, "Order is not paid");
        require(!order.isDelivered, "Order already delivered");
        
        order.isDelivered = true;
        
        emit OrderDelivered(_orderId);
    }
    
    // View functions
    function getCrop(uint256 _cropId) external view returns (Crop memory) {
        return crops[_cropId];
    }
    
    function getAuction(uint256 _auctionId) external view returns (Auction memory) {
        return auctions[_auctionId];
    }
    
    function getAuctionBids(uint256 _auctionId) external view returns (Bid[] memory) {
        return auctionBids[_auctionId];
    }
    
    function getFarmerCrops(address _farmer) external view returns (uint256[] memory) {
        return farmerCrops[_farmer];
    }
    
    function getBuyerOrders(address _buyer) external view returns (uint256[] memory) {
        return buyerOrders[_buyer];
    }
    
    // Admin functions
    function updatePlatformFee(uint256 _newFee) external onlyOwner {
        require(_newFee <= MAX_PLATFORM_FEE, "Fee too high");
        platformFee = _newFee;
        emit PlatformFeeUpdated(_newFee);
    }
    
    function withdrawFees() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        
        payable(owner()).transfer(balance);
        emit FundsWithdrawn(owner(), balance);
    }
    
    function emergencyDeactivateCrop(uint256 _cropId) external onlyOwner {
        crops[_cropId].isActive = false;
    }
    
    // Counters
    function getCurrentCropId() external view returns (uint256) {
        return _cropIds.current();
    }
    
    function getCurrentAuctionId() external view returns (uint256) {
        return _auctionIds.current();
    }
    
    function getCurrentOrderId() external view returns (uint256) {
        return _orderIds.current();
    }
}