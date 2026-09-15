// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IERC20
 * @dev Interface for ERC20 tokens (e.g., USDC on Base L2)
 */
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title SubukanEscrow
 * @dev Decentralized QA testing escrow for the SubukAn Platform on Base L2.
 * Holds locked USDC bounties and auto-splits the 20% platform fee on creation.
 */
contract SubukanEscrow {
    address public platformOwner;
    address public platformArbiter;
    IERC20 public immutable usdcToken;

    uint256 public constant PLATFORM_FEE_BPS = 2000; // 20.00% (Basis points: 10000 = 100%)

    struct Campaign {
        address poster;
        uint256 totalEscrow;       // 80% remaining net bounty pool
        uint256 slotRate;          // Rate per tester in USDC (6 decimals)
        uint256 slotsTotal;
        uint256 slotsApproved;
        bool isCancelled;
    }

    // Mapping of listingId (hashed UUID) => Campaign details
    mapping(bytes32 => Campaign) public campaigns;
    
    // Mapping of submissionId => bool to prevent double-spending
    mapping(bytes32 => bool) public processedSubmissions;

    event CampaignCreated(bytes32 indexed listingId, address indexed poster, uint256 totalBudget, uint256 platformFee, uint256 slotRate, uint256 slots);
    event SlotPayoutReleased(bytes32 indexed listingId, bytes32 indexed submissionId, address indexed tester, uint256 amount);
    event CampaignRefunded(bytes32 indexed listingId, address indexed poster, uint256 refundedAmount);
    event DisputeResolved(bytes32 indexed listingId, bytes32 indexed submissionId, address recipient, uint256 amount);

    modifier onlyPoster(bytes32 listingId) {
        require(campaigns[listingId].poster == msg.sender, SubukanEscrow: Caller is not the campaign poster);
        _;
    }

    modifier onlyArbiterOrOwner() {
        require(msg.sender == platformArbiter || msg.sender == platformOwner, SubukanEscrow: Caller is not authorized arbiter);
        _;
    }

    constructor(address _usdcToken, address _platformArbiter) {
        require(_usdcToken != address(0), Invalid USDC address);
        require(_platformArbiter != address(0), Invalid Arbiter address);
        platformOwner = msg.sender;
        platformArbiter = _platformArbiter;
        usdcToken = IERC20(_usdcToken);
    }

    /**
     * @notice Creates an on-chain escrow campaign.
     * @param listingId Unique bytes32 identifier of the listing (from Supabase UUID).
     * @param grossBudget Total budget in USDC (e.g. 10 USDC = 10_000_000 for 6-decimal USDC).
     * @param slotRate Net USDC amount per tester slot.
     * @param slots Number of verified tester slots.
     */
    function createCampaign(
        bytes32 listingId,
        uint256 grossBudget,
        uint256 slotRate,
        uint256 slots
    ) external {
        require(campaigns[listingId].poster == address(0), SubukanEscrow: Campaign already exists);
        require(grossBudget > 0 && slots > 0, SubukanEscrow: Invalid budget or slots);

        uint256 platformFee = (grossBudget * PLATFORM_FEE_BPS) / 10000; // 20%
        uint256 netEscrowPool = grossBudget - platformFee;               // 80%

        require(netEscrowPool >= slotRate * slots, SubukanEscrow: Insufficient escrow for slots);

        // 1. Transfer full gross budget from poster to this contract
        require(usdcToken.transferFrom(msg.sender, address(this), grossBudget), SubukanEscrow: Transfer failed);

        // 2. Immediately disburse 20% platform fee to platform owner wallet
        require(usdcToken.transfer(platformOwner, platformFee), SubukanEscrow: Fee disbursal failed);

        // 3. Lock the net 80% in the campaign state
        campaigns[listingId] = Campaign({
            poster: msg.sender,
            totalEscrow: netEscrowPool,
            slotRate: slotRate,
            slotsTotal: slots,
            slotsApproved: 0,
            isCancelled: false
        });

        emit CampaignCreated(listingId, msg.sender, grossBudget, platformFee, slotRate, slots);
    }

    /**
     * @notice Releases payment to a tester upon poster approval.
     */
    function releaseSlotPayout(
        bytes32 listingId,
        bytes32 submissionId,
        address tester
    ) external onlyPoster(listingId) {
        _executePayout(listingId, submissionId, tester);
    }

    /**
     * @notice Releases payment via arbiter in case of poster inactivity / dispute.
     */
    function releaseSlotPayoutArbiter(
        bytes32 listingId,
        bytes32 submissionId,
        address tester
    ) external onlyArbiterOrOwner {
        _executePayout(listingId, submissionId, tester);
    }

    function _executePayout(bytes32 listingId, bytes32 submissionId, address tester) internal {
        Campaign storage c = campaigns[listingId];
        require(!c.isCancelled, SubukanEscrow: Campaign cancelled);
        require(!processedSubmissions[submissionId], SubukanEscrow: Submission already paid);
        require(c.slotsApproved < c.slotsTotal, SubukanEscrow: All slots filled);
        require(c.totalEscrow >= c.slotRate, SubukanEscrow: Insufficient escrow balance);
        require(tester != address(0), SubukanEscrow: Invalid tester address);

        processedSubmissions[submissionId] = true;
        c.slotsApproved += 1;
        c.totalEscrow -= c.slotRate;

        require(usdcToken.transfer(tester, c.slotRate), SubukanEscrow: Tester payout failed);

        emit SlotPayoutReleased(listingId, submissionId, tester, c.slotRate);
    }

    /**
     * @notice Refunds remaining unfilled slots to poster.
     */
    function refundRemaining(bytes32 listingId) external onlyPoster(listingId) {
        Campaign storage c = campaigns[listingId];
        require(!c.isCancelled, SubukanEscrow: Already cancelled);
        require(c.totalEscrow > 0, SubukanEscrow: No funds left to refund);

        uint256 refundAmount = c.totalEscrow;
        c.totalEscrow = 0;
        c.isCancelled = true;

        require(usdcToken.transfer(c.poster, refundAmount), SubukanEscrow: Refund transfer failed);

        emit CampaignRefunded(listingId, c.poster, refundAmount);
    }

    /**
     * @notice Emergency administrative dispute resolution.
     */
    function resolveDispute(
        bytes32 listingId,
        bytes32 submissionId,
        address recipient,
        uint256 amount
    ) external onlyArbiterOrOwner {
        Campaign storage c = campaigns[listingId];
        require(!processedSubmissions[submissionId], SubukanEscrow: Submission already resolved);
        require(c.totalEscrow >= amount, SubukanEscrow: Amount exceeds remaining escrow);

        processedSubmissions[submissionId] = true;
        c.totalEscrow -= amount;

        require(usdcToken.transfer(recipient, amount), SubukanEscrow: Dispute transfer failed);

        emit DisputeResolved(listingId, submissionId, recipient, amount);
    }
}
