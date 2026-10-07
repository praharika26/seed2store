// Human-readable ABI for contracts/Seed2StoreNFT.sol (kept in sync with the struct layouts there).
export const CERTIFICATE_ABI = [
  "function createCropCertificate(string title, string description, string cropType, string variety, uint256 quantity, string unit, string location, bool isOrganic, string qualityGrade, uint256 harvestDate, uint256 minimumPrice, uint256 buyoutPrice, string ipfsMetadata) returns (uint256)",
  "function createAuction(uint256 tokenId, uint256 startingPrice, uint256 reservePrice, uint256 bidIncrement, uint256 duration) returns (uint256)",
  "function placeBid(uint256 auctionId) payable",
  "function finalizeAuction(uint256 auctionId)",
  "function directPurchase(uint256 tokenId) payable",

  "function getCropCertificate(uint256 tokenId) view returns (tuple(uint256 tokenId, address farmer, string title, string description, string cropType, string variety, uint256 quantity, string unit, string location, bool isOrganic, string qualityGrade, uint256 harvestDate, uint256 minimumPrice, uint256 buyoutPrice, string ipfsMetadata, uint256 createdAt, bool isActive, bool isSold))",
  "function getAuction(uint256 auctionId) view returns (tuple(uint256 id, uint256 tokenId, address farmer, uint256 startingPrice, uint256 reservePrice, uint256 currentBid, address currentBidder, uint256 bidIncrement, uint256 startTime, uint256 endTime, bool isActive, bool isFinalized, uint256 totalBids))",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function tokenToAuction(uint256 tokenId) view returns (uint256)",
  "function getCurrentTokenId() view returns (uint256)",

  "event CropCertificateCreated(uint256 indexed tokenId, address indexed farmer, string title)",
  "event AuctionCreated(uint256 indexed auctionId, uint256 indexed tokenId, uint256 startingPrice)",
  "event BidPlaced(uint256 indexed auctionId, address indexed bidder, uint256 amount)",
  "event AuctionFinalized(uint256 indexed auctionId, address indexed winner, uint256 finalPrice)",
  "event CropSold(uint256 indexed tokenId, address indexed buyer, uint256 amount)",
] as const
