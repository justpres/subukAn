import { uuidToBytes32, BASE_MAINNET, BASE_SEPOLIA } from './client';

export const SUBUKAN_ESCROW_ABI = [
  {
    type: 'function',
    name: 'createCampaign',
    inputs: [
      { name: 'listingId', type: 'bytes32' },
      { name: 'grossBudget', type: 'uint256' },
      { name: 'slotRate', type: 'uint256' },
      { name: 'slots', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'releaseSlotPayout',
    inputs: [
      { name: 'listingId', type: 'bytes32' },
      { name: 'submissionId', type: 'bytes32' },
      { name: 'tester', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'refundRemaining',
    inputs: [{ name: 'listingId', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'campaigns',
    inputs: [{ name: 'listingId', type: 'bytes32' }],
    outputs: [
      { name: 'poster', type: 'address' },
      { name: 'totalEscrow', type: 'uint256' },
      { name: 'slotRate', type: 'uint256' },
      { name: 'slotsTotal', type: 'uint256' },
      { name: 'slotsApproved', type: 'uint256' },
      { name: 'isCancelled', type: 'bool' },
    ],
    stateMutability: 'view',
  },
] as const;

/**
 * Encodes campaign creation parameters for web3 wallets.
 */
export function formatCampaignParams(
  listingId: string,
  grossAmountUsdc: number,
  slotRateUsdc: number,
  slotsCount: number
) {
  // USDC uses 6 decimals (1 USDC = 1_000_000 units)
  const grossUnits = BigInt(Math.round(grossAmountUsdc * 1_000_000));
  const slotUnits = BigInt(Math.round(slotRateUsdc * 1_000_000));
  const bytes32ListingId = uuidToBytes32(listingId);

  return {
    listingId: bytes32ListingId,
    grossUnits,
    slotUnits,
    slots: BigInt(slotsCount),
  };
}
