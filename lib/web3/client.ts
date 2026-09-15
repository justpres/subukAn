import crypto from 'crypto';

export interface ChainConfig {
  id: number;
  name: string;
  rpcUrl: string;
  blockExplorer: string;
  usdcAddress: string;
  escrowContractAddress: string;
}

export const BASE_MAINNET: ChainConfig = {
  id: 8453,
  name: 'Base Mainnet',
  rpcUrl: 'https://mainnet.base.org',
  blockExplorer: 'https://basescan.org',
  usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  escrowContractAddress: process.env.NEXT_PUBLIC_BASE_ESCROW_CONTRACT || '0x0000000000000000000000000000000000000000',
};

export const BASE_SEPOLIA: ChainConfig = {
  id: 84532,
  name: 'Base Sepolia Testnet',
  rpcUrl: 'https://sepolia.base.org',
  blockExplorer: 'https://sepolia.basescan.org',
  usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia Test USDC
  escrowContractAddress: process.env.NEXT_PUBLIC_BASE_SEPOLIA_ESCROW_CONTRACT || '0x0000000000000000000000000000000000000000',
};

/**
 * Converts Philippine Pesos (PHP) to USDC (USD) at a given exchange rate.
 * Rounds to 2 decimal places.
 */
export function convertPhpToUsdc(phpAmount: number, phpPerUsd: number = 58.0): number {
  if (phpAmount <= 0) return 0;
  const rawUsdc = phpAmount / phpPerUsd;
  return Math.round(rawUsdc * 100) / 100;
}

/**
 * Converts a standard UUID string to a bytes32 hex string for smart contracts.
 */
export function uuidToBytes32(uuidString: string): string {
  const cleanUuid = uuidString.replace(/-/g, '').toLowerCase();
  const hex = '0x' + cleanUuid.padEnd(64, '0');
  return hex;
}

/**
 * Validates whether a given string is a valid Ethereum/EVM hex address.
 */
export function isValidEvmAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Calculates the standard 20% platform commission and 80% net bounty split.
 */
export function calculateDualRailSplit(grossAmount: number, feePercent: number = 20) {
  const platformFee = Math.round((grossAmount * (feePercent / 100)) * 100) / 100;
  const netEscrowPool = Math.round((grossAmount - platformFee) * 100) / 100;
  return {
    grossAmount,
    platformFee,
    netEscrowPool,
    feePercent,
  };
}
