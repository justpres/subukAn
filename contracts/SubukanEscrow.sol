// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IERC20
 * @dev Interface of the ERC20 standard as defined in the EIP.
 */
interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/**
 * @title SafeERC20
 * @dev Wrappers around ERC20 operations that throw on failure (when the token
 * contract returns false). Tokens that return no value (and instead revert or
 * throw on failure) are also supported.
 */
library SafeERC20 {
    function safeTransfer(IERC20 token, address to, uint256 value) internal {
        _callOptionalReturn(token, abi.encodeWithSelector(token.transfer.selector, to, value));
    }

    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
        _callOptionalReturn(token, abi.encodeWithSelector(token.transferFrom.selector, from, to, value));
    }

    function _callOptionalReturn(IERC20 token, bytes memory data) private {
        (bool success, bytes memory returndata) = address(token).call(data);
        require(success, "SafeERC20: low-level call failed");
        if (returndata.length > 0) {
            require(abi.decode(returndata, (bool)), "SafeERC20: ERC20 operation did not succeed");
        }
    }
}

/**
 * @title ReentrancyGuard
 * @dev Contract module that helps prevent reentrant calls to a function.
 */
abstract contract ReentrancyGuard {
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;
    uint256 private _status;

    error ReentrancyGuardReentrantCall();

    constructor() {
        _status = NOT_ENTERED;
    }

    modifier nonReentrant() {
        if (_status == ENTERED) {
            revert ReentrancyGuardReentrantCall();
        }
        _status = ENTERED;
        _;
        _status = NOT_ENTERED;
    }
}

/**
 * @title Ownable2Step
 * @dev Contract module which provides access control with a 2-step ownership transfer mechanism.
 */
abstract contract Ownable2Step {
    address private _owner;
    address private _pendingOwner;

    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error OwnableUnauthorizedAccount(address account);
    error OwnableInvalidOwner(address owner);

    constructor(address initialOwner) {
        if (initialOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(initialOwner);
    }

    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    function owner() public view virtual returns (address) {
        return _owner;
    }

    function pendingOwner() public view virtual returns (address) {
        return _pendingOwner;
    }

    function _checkOwner() internal view virtual {
        if (owner() != msg.sender) {
            revert OwnableUnauthorizedAccount(msg.sender);
        }
    }

    function transferOwnership(address newOwner) public virtual onlyOwner {
        if (newOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner(), newOwner);
    }

    function acceptOwnership() public virtual {
        if (pendingOwner() != msg.sender) {
            revert OwnableUnauthorizedAccount(msg.sender);
        }
        _transferOwnership(msg.sender);
    }

    function _transferOwnership(address newOwner) internal virtual {
        delete _pendingOwner;
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}

/**
 * @title Pausable
 * @dev Contract module which allows children to implement an emergency stop mechanism.
 */
abstract contract Pausable {
    bool private _paused;

    event Paused(address account);
    event Unpaused(address account);

    error EnforcedPause();
    error ExpectedPause();

    constructor() {
        _paused = false;
    }

    modifier whenNotPaused() {
        _requireNotPaused();
        _;
    }

    modifier whenPaused() {
        _requirePaused();
        _;
    }

    function paused() public view virtual returns (bool) {
        return _paused;
    }

    function _requireNotPaused() internal view virtual {
        if (paused()) {
            revert EnforcedPause();
        }
    }

    function _requirePaused() internal view virtual {
        if (!paused()) {
            revert ExpectedPause();
        }
    }

    function _pause() internal virtual whenNotPaused {
        _paused = true;
        emit Paused(msg.sender);
    }

    function _unpause() internal virtual whenPaused {
        _paused = false;
        emit Unpaused(msg.sender);
    }
}

/**
 * @title SubukanEscrow
 * @dev Enterprise QA testing escrow for the SubukAn Platform on Base L2.
 * Holds locked USDC bounties and auto-splits the 20% platform fee on creation.
 * Fortified with OpenZeppelin patterns: SafeERC20, ReentrancyGuard, Ownable2Step, and Pausable.
 */
contract SubukanEscrow is Ownable2Step, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

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

    // Mapping of submissionId => bool to track registered active submissions idempotently
    mapping(bytes32 => bool) public registeredSubmissions;

    // Mapping of listingId => active submissions count in progress or review
    mapping(bytes32 => uint256) public activeSubmissions;

    event CampaignCreated(bytes32 indexed listingId, address indexed poster, uint256 totalBudget, uint256 platformFee, uint256 slotRate, uint256 slots);
    event SlotPayoutReleased(bytes32 indexed listingId, bytes32 indexed submissionId, address indexed tester, uint256 amount);
    event CampaignRefunded(bytes32 indexed listingId, address indexed poster, uint256 refundedAmount);
    event DisputeResolved(bytes32 indexed listingId, bytes32 indexed submissionId, address recipient, uint256 amount);
    event SubmissionRegistered(bytes32 indexed listingId, bytes32 indexed submissionId);
    event SubmissionDeregistered(bytes32 indexed listingId, bytes32 indexed submissionId);
    event ArbiterUpdated(address indexed previousArbiter, address indexed newArbiter);

    modifier onlyPoster(bytes32 listingId) {
        require(campaigns[listingId].poster == msg.sender, "SubukanEscrow: Caller is not the campaign poster");
        _;
    }

    modifier onlyArbiterOrOwner() {
        require(msg.sender == platformArbiter || msg.sender == owner(), "SubukanEscrow: Caller is not authorized arbiter");
        _;
    }

    constructor(address _usdcToken, address _platformArbiter) 
        Ownable2Step(msg.sender) 
    {
        require(_usdcToken != address(0), "Invalid USDC address");
        require(_platformArbiter != address(0), "Invalid Arbiter address");
        platformArbiter = _platformArbiter;
        usdcToken = IERC20(_usdcToken);
    }

    // ==========================================
    // Emergency & Governance Controls
    // ==========================================

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setPlatformArbiter(address _newArbiter) external onlyOwner {
        require(_newArbiter != address(0), "Invalid Arbiter address");
        address previous = platformArbiter;
        platformArbiter = _newArbiter;
        emit ArbiterUpdated(previous, _newArbiter);
    }

    // ==========================================
    // Campaign Lifecycle
    // ==========================================

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
    ) external whenNotPaused nonReentrant {
        require(campaigns[listingId].poster == address(0), "SubukanEscrow: Campaign already exists");
        require(grossBudget > 0 && slots > 0, "SubukanEscrow: Invalid budget or slots");

        uint256 platformFee = (grossBudget * PLATFORM_FEE_BPS) / 10000; // 20%
        uint256 netEscrowPool = grossBudget - platformFee;               // 80%

        require(netEscrowPool >= slotRate * slots, "SubukanEscrow: Insufficient escrow for slots");

        // 1. Transfer full gross budget from poster to this contract using SafeERC20
        usdcToken.safeTransferFrom(msg.sender, address(this), grossBudget);

        // 2. Immediately disburse 20% platform fee to platform owner wallet
        usdcToken.safeTransfer(owner(), platformFee);

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
     * @notice Registers an active submission in progress to protect tester bounty from poster cancellation.
     */
    function registerSubmission(bytes32 listingId, bytes32 submissionId) external {
        Campaign storage c = campaigns[listingId];
        require(c.poster != address(0), "SubukanEscrow: Campaign does not exist");
        require(!c.isCancelled, "SubukanEscrow: Campaign cancelled");
        require(!processedSubmissions[submissionId], "SubukanEscrow: Submission already processed");
        require(!registeredSubmissions[submissionId], "SubukanEscrow: Submission already registered");
        require(msg.sender == c.poster || msg.sender == platformArbiter || msg.sender == owner(), "SubukanEscrow: Unauthorized");

        registeredSubmissions[submissionId] = true;
        activeSubmissions[listingId] += 1;
        emit SubmissionRegistered(listingId, submissionId);
    }

    /**
     * @notice Deregisters an active submission if rejected or expired, decrementing active count.
     */
    function deregisterSubmission(bytes32 listingId, bytes32 submissionId) external {
        Campaign storage c = campaigns[listingId];
        require(c.poster != address(0), "SubukanEscrow: Campaign does not exist");
        require(registeredSubmissions[submissionId], "SubukanEscrow: Submission not registered");
        require(!processedSubmissions[submissionId], "SubukanEscrow: Submission already processed");
        require(msg.sender == c.poster || msg.sender == platformArbiter || msg.sender == owner(), "SubukanEscrow: Unauthorized");

        registeredSubmissions[submissionId] = false;
        if (activeSubmissions[listingId] > 0) {
            activeSubmissions[listingId] -= 1;
        }
        emit SubmissionDeregistered(listingId, submissionId);
    }

    /**
     * @notice Releases payment to a tester upon poster approval.
     */
    function releaseSlotPayout(
        bytes32 listingId,
        bytes32 submissionId,
        address tester
    ) external onlyPoster(listingId) whenNotPaused nonReentrant {
        _executePayout(listingId, submissionId, tester);
    }

    /**
     * @notice Releases payment via arbiter in case of poster inactivity / dispute.
     */
    function releaseSlotPayoutArbiter(
        bytes32 listingId,
        bytes32 submissionId,
        address tester
    ) external onlyArbiterOrOwner whenNotPaused nonReentrant {
        _executePayout(listingId, submissionId, tester);
    }

    function _executePayout(bytes32 listingId, bytes32 submissionId, address tester) internal {
        Campaign storage c = campaigns[listingId];
        require(!c.isCancelled, "SubukanEscrow: Campaign cancelled");
        require(!processedSubmissions[submissionId], "SubukanEscrow: Submission already paid");
        require(c.slotsApproved < c.slotsTotal, "SubukanEscrow: All slots filled");
        require(c.totalEscrow >= c.slotRate, "SubukanEscrow: Insufficient escrow balance");
        require(tester != address(0), "SubukanEscrow: Invalid tester address");

        processedSubmissions[submissionId] = true;
        if (registeredSubmissions[submissionId]) {
            registeredSubmissions[submissionId] = false;
        }
        c.slotsApproved += 1;
        c.totalEscrow -= c.slotRate;

        if (activeSubmissions[listingId] > 0) {
            activeSubmissions[listingId] -= 1;
        }

        usdcToken.safeTransfer(tester, c.slotRate);

        emit SlotPayoutReleased(listingId, submissionId, tester, c.slotRate);
    }

    /**
     * @notice Refunds remaining unfilled slots to poster.
     * Invariant: Poster cancellation is strictly prohibited if there are active submissions
     * in progress or awaiting review within the review window.
     */
    function refundRemaining(bytes32 listingId) external onlyPoster(listingId) whenNotPaused nonReentrant {
        Campaign storage c = campaigns[listingId];
        require(!c.isCancelled, "SubukanEscrow: Already cancelled");
        require(c.totalEscrow > 0, "SubukanEscrow: No funds left to refund");
        require(activeSubmissions[listingId] == 0, "SubukanEscrow: Active submissions in progress or awaiting review");

        uint256 refundAmount = c.totalEscrow;
        c.totalEscrow = 0;
        c.isCancelled = true;

        usdcToken.safeTransfer(c.poster, refundAmount);

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
    ) external onlyArbiterOrOwner whenNotPaused nonReentrant {
        Campaign storage c = campaigns[listingId];
        require(!processedSubmissions[submissionId], "SubukanEscrow: Submission already resolved");
        require(c.totalEscrow >= amount, "SubukanEscrow: Amount exceeds remaining escrow");
        require(recipient != address(0), "SubukanEscrow: Invalid recipient address");

        processedSubmissions[submissionId] = true;
        if (registeredSubmissions[submissionId]) {
            registeredSubmissions[submissionId] = false;
        }
        c.totalEscrow -= amount;

        if (activeSubmissions[listingId] > 0) {
            activeSubmissions[listingId] -= 1;
        }

        usdcToken.safeTransfer(recipient, amount);

        emit DisputeResolved(listingId, submissionId, recipient, amount);
    }
}
