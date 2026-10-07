// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AgriTrustToken (ATT)
 * @dev ERC20 token for the AgriTrust ecosystem
 * Used for governance, rewards, and platform incentives
 */
contract AgriTrustToken is ERC20, ERC20Burnable, Ownable {
    uint256 public constant MAX_SUPPLY = 1000000000 * 10**18; // 1 billion tokens
    uint256 public constant INITIAL_SUPPLY = 100000000 * 10**18; // 100 million tokens
    
    // Reward rates (tokens per action)
    uint256 public cropRegistrationReward = 10 * 10**18; // 10 ATT
    uint256 public auctionParticipationReward = 5 * 10**18; // 5 ATT
    uint256 public successfulSaleReward = 20 * 10**18; // 20 ATT
    
    // Addresses
    address public agriTrustContract;
    address public rewardPool;
    
    // Mappings for tracking rewards
    mapping(address => uint256) public totalRewardsEarned;
    mapping(address => bool) public hasRegisteredCrop;
    
    // Events
    event RewardDistributed(address indexed recipient, uint256 amount, string reason);
    event RewardRatesUpdated(uint256 cropReward, uint256 auctionReward, uint256 saleReward);
    event AgriTrustContractUpdated(address indexed newContract);
    
    constructor() ERC20("AgriTrust Token", "ATT") {
        _mint(msg.sender, INITIAL_SUPPLY);
        rewardPool = msg.sender;
    }
    
    /**
     * @dev Set the AgriTrust main contract address
     */
    function setAgriTrustContract(address _agriTrustContract) external onlyOwner {
        require(_agriTrustContract != address(0), "Invalid contract address");
        agriTrustContract = _agriTrustContract;
        emit AgriTrustContractUpdated(_agriTrustContract);
    }
    
    /**
     * @dev Update reward rates
     */
    function updateRewardRates(
        uint256 _cropReward,
        uint256 _auctionReward,
        uint256 _saleReward
    ) external onlyOwner {
        cropRegistrationReward = _cropReward;
        auctionParticipationReward = _auctionReward;
        successfulSaleReward = _saleReward;
        
        emit RewardRatesUpdated(_cropReward, _auctionReward, _saleReward);
    }
    
    /**
     * @dev Reward user for crop registration
     */
    function rewardCropRegistration(address _farmer) external {
        require(msg.sender == agriTrustContract || msg.sender == owner(), "Unauthorized");
        require(!hasRegisteredCrop[_farmer], "Already rewarded for first crop");
        
        hasRegisteredCrop[_farmer] = true;
        _distributeReward(_farmer, cropRegistrationReward, "First crop registration");
    }
    
    /**
     * @dev Reward user for auction participation
     */
    function rewardAuctionParticipation(address _bidder) external {
        require(msg.sender == agriTrustContract || msg.sender == owner(), "Unauthorized");
        _distributeReward(_bidder, auctionParticipationReward, "Auction participation");
    }
    
    /**
     * @dev Reward user for successful sale
     */
    function rewardSuccessfulSale(address _farmer) external {
        require(msg.sender == agriTrustContract || msg.sender == owner(), "Unauthorized");
        _distributeReward(_farmer, successfulSaleReward, "Successful sale");
    }
    
    /**
     * @dev Internal function to distribute rewards
     */
    function _distributeReward(address _recipient, uint256 _amount, string memory _reason) internal {
        require(_recipient != address(0), "Invalid recipient");
        require(balanceOf(rewardPool) >= _amount, "Insufficient reward pool balance");
        
        _transfer(rewardPool, _recipient, _amount);
        totalRewardsEarned[_recipient] += _amount;
        
        emit RewardDistributed(_recipient, _amount, _reason);
    }
    
    /**
     * @dev Mint new tokens (only owner, respecting max supply)
     */
    function mint(address _to, uint256 _amount) external onlyOwner {
        require(totalSupply() + _amount <= MAX_SUPPLY, "Exceeds max supply");
        _mint(_to, _amount);
    }
    
    /**
     * @dev Set reward pool address
     */
    function setRewardPool(address _rewardPool) external onlyOwner {
        require(_rewardPool != address(0), "Invalid reward pool address");
        rewardPool = _rewardPool;
    }
    
    /**
     * @dev Get user's total rewards earned
     */
    function getUserRewards(address _user) external view returns (uint256) {
        return totalRewardsEarned[_user];
    }
}