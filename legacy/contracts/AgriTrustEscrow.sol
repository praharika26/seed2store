// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AgriTrustEscrow
 * @dev Escrow contract for secure transactions between farmers and buyers
 */
contract AgriTrustEscrow is ReentrancyGuard, Ownable {
    
    enum EscrowStatus {
        Created,
        FundsDeposited,
        DeliveryConfirmed,
        Completed,
        Disputed,
        Cancelled,
        Refunded
    }
    
    struct EscrowTransaction {
        uint256 id;
        address buyer;
        address farmer;
        uint256 cropId;
        uint256 amount;
        uint256 quantity;
        EscrowStatus status;
        uint256 createdAt;
        uint256 deliveryDeadline;
        bool buyerConfirmed;
        bool farmerConfirmed;
        string deliveryProof; // IPFS hash of delivery proof
    }
    
    // State variables
    uint256 private _transactionIds;
    uint256 public disputeTimeWindow = 7 days;
    uint256 public platformFee = 250; // 2.5% in basis points
    
    // Mappings
    mapping(uint256 => EscrowTransaction) public escrowTransactions;
    mapping(address => uint256[]) public buyerTransactions;
    mapping(address => uint256[]) public farmerTransactions;
    mapping(uint256 => address) public disputeArbitrator;
    
    // Events
    event EscrowCreated(uint256 indexed transactionId, address indexed buyer, address indexed farmer, uint256 amount);
    event FundsDeposited(uint256 indexed transactionId, uint256 amount);
    event DeliveryConfirmed(uint256 indexed transactionId, string deliveryProof);
    event EscrowCompleted(uint256 indexed transactionId, uint256 farmerAmount, uint256 platformFeeAmount);
    event DisputeRaised(uint256 indexed transactionId, address indexed disputeRaiser);
    event DisputeResolved(uint256 indexed transactionId, address indexed winner);
    event EscrowCancelled(uint256 indexed transactionId);
    event EscrowRefunded(uint256 indexed transactionId, uint256 amount);
    
    /**
     * @dev Create a new escrow transaction
     */
    function createEscrow(
        address _farmer,
        uint256 _cropId,
        uint256 _quantity,
        uint256 _deliveryDays
    ) external payable nonReentrant returns (uint256) {
        require(_farmer != address(0), "Invalid farmer address");
        require(_farmer != msg.sender, "Buyer and farmer cannot be the same");
        require(msg.value > 0, "Amount must be greater than 0");
        require(_quantity > 0, "Quantity must be greater than 0");
        require(_deliveryDays > 0 && _deliveryDays <= 30, "Invalid delivery days");
        
        _transactionIds++;
        uint256 newTransactionId = _transactionIds;
        
        escrowTransactions[newTransactionId] = EscrowTransaction({
            id: newTransactionId,
            buyer: msg.sender,
            farmer: _farmer,
            cropId: _cropId,
            amount: msg.value,
            quantity: _quantity,
            status: EscrowStatus.FundsDeposited,
            createdAt: block.timestamp,
            deliveryDeadline: block.timestamp + (_deliveryDays * 1 days),
            buyerConfirmed: false,
            farmerConfirmed: false,
            deliveryProof: ""
        });
        
        buyerTransactions[msg.sender].push(newTransactionId);
        farmerTransactions[_farmer].push(newTransactionId);
        
        emit EscrowCreated(newTransactionId, msg.sender, _farmer, msg.value);
        emit FundsDeposited(newTransactionId, msg.value);
        
        return newTransactionId;
    }
    
    /**
     * @dev Farmer confirms delivery with proof
     */
    function confirmDelivery(uint256 _transactionId, string memory _deliveryProof) external {
        EscrowTransaction storage transaction = escrowTransactions[_transactionId];
        require(transaction.farmer == msg.sender, "Only farmer can confirm delivery");
        require(transaction.status == EscrowStatus.FundsDeposited, "Invalid transaction status");
        require(block.timestamp <= transaction.deliveryDeadline, "Delivery deadline passed");
        require(bytes(_deliveryProof).length > 0, "Delivery proof required");
        
        transaction.status = EscrowStatus.DeliveryConfirmed;
        transaction.farmerConfirmed = true;
        transaction.deliveryProof = _deliveryProof;
        
        emit DeliveryConfirmed(_transactionId, _deliveryProof);
    }
    
    /**
     * @dev Buyer confirms receipt of goods
     */
    function confirmReceipt(uint256 _transactionId) external nonReentrant {
        EscrowTransaction storage transaction = escrowTransactions[_transactionId];
        require(transaction.buyer == msg.sender, "Only buyer can confirm receipt");
        require(transaction.status == EscrowStatus.DeliveryConfirmed, "Delivery not confirmed by farmer");
        
        transaction.buyerConfirmed = true;
        _completeEscrow(_transactionId);
    }
    
    /**
     * @dev Auto-complete escrow after dispute window
     */
    function autoCompleteEscrow(uint256 _transactionId) external nonReentrant {
        EscrowTransaction storage transaction = escrowTransactions[_transactionId];
        require(transaction.status == EscrowStatus.DeliveryConfirmed, "Delivery not confirmed");
        require(
            block.timestamp >= transaction.createdAt + disputeTimeWindow,
            "Dispute window not passed"
        );
        
        _completeEscrow(_transactionId);
    }
    
    /**
     * @dev Internal function to complete escrow
     */
    function _completeEscrow(uint256 _transactionId) internal {
        EscrowTransaction storage transaction = escrowTransactions[_transactionId];
        require(transaction.status != EscrowStatus.Completed, "Already completed");
        
        transaction.status = EscrowStatus.Completed;
        
        uint256 platformFeeAmount = (transaction.amount * platformFee) / 10000;
        uint256 farmerAmount = transaction.amount - platformFeeAmount;
        
        // Transfer funds to farmer
        payable(transaction.farmer).transfer(farmerAmount);
        
        // Platform fee stays in contract for owner withdrawal
        
        emit EscrowCompleted(_transactionId, farmerAmount, platformFeeAmount);
    }
    
    /**
     * @dev Raise a dispute
     */
    function raiseDispute(uint256 _transactionId) external {
        EscrowTransaction storage transaction = escrowTransactions[_transactionId];
        require(
            transaction.buyer == msg.sender || transaction.farmer == msg.sender,
            "Only transaction parties can raise dispute"
        );
        require(
            transaction.status == EscrowStatus.FundsDeposited || 
            transaction.status == EscrowStatus.DeliveryConfirmed,
            "Invalid status for dispute"
        );
        require(transaction.status != EscrowStatus.Disputed, "Dispute already raised");
        
        transaction.status = EscrowStatus.Disputed;
        disputeArbitrator[_transactionId] = owner(); // Owner acts as arbitrator
        
        emit DisputeRaised(_transactionId, msg.sender);
    }
    
    /**
     * @dev Resolve dispute (only arbitrator/owner)
     */
    function resolveDispute(uint256 _transactionId, bool _favorBuyer) external onlyOwner nonReentrant {
        EscrowTransaction storage transaction = escrowTransactions[_transactionId];
        require(transaction.status == EscrowStatus.Disputed, "No active dispute");
        
        if (_favorBuyer) {
            // Refund to buyer
            transaction.status = EscrowStatus.Refunded;
            payable(transaction.buyer).transfer(transaction.amount);
            emit EscrowRefunded(_transactionId, transaction.amount);
            emit DisputeResolved(_transactionId, transaction.buyer);
        } else {
            // Pay farmer
            _completeEscrow(_transactionId);
            emit DisputeResolved(_transactionId, transaction.farmer);
        }
    }
    
    /**
     * @dev Cancel escrow (only if not yet delivered)
     */
    function cancelEscrow(uint256 _transactionId) external nonReentrant {
        EscrowTransaction storage transaction = escrowTransactions[_transactionId];
        require(
            transaction.buyer == msg.sender || transaction.farmer == msg.sender,
            "Only transaction parties can cancel"
        );
        require(transaction.status == EscrowStatus.FundsDeposited, "Cannot cancel at this stage");
        require(block.timestamp > transaction.deliveryDeadline, "Delivery deadline not passed");
        
        transaction.status = EscrowStatus.Cancelled;
        
        // Refund buyer
        payable(transaction.buyer).transfer(transaction.amount);
        
        emit EscrowCancelled(_transactionId);
        emit EscrowRefunded(_transactionId, transaction.amount);
    }
    
    /**
     * @dev Get transaction details
     */
    function getTransaction(uint256 _transactionId) external view returns (EscrowTransaction memory) {
        return escrowTransactions[_transactionId];
    }
    
    /**
     * @dev Get buyer's transactions
     */
    function getBuyerTransactions(address _buyer) external view returns (uint256[] memory) {
        return buyerTransactions[_buyer];
    }
    
    /**
     * @dev Get farmer's transactions
     */
    function getFarmerTransactions(address _farmer) external view returns (uint256[] memory) {
        return farmerTransactions[_farmer];
    }
    
    /**
     * @dev Update platform fee (only owner)
     */
    function updatePlatformFee(uint256 _newFee) external onlyOwner {
        require(_newFee <= 1000, "Fee cannot exceed 10%");
        platformFee = _newFee;
    }
    
    /**
     * @dev Update dispute time window (only owner)
     */
    function updateDisputeTimeWindow(uint256 _newWindow) external onlyOwner {
        require(_newWindow >= 1 days && _newWindow <= 30 days, "Invalid time window");
        disputeTimeWindow = _newWindow;
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
     * @dev Get current transaction count
     */
    function getCurrentTransactionId() external view returns (uint256) {
        return _transactionIds;
    }
}