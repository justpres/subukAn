import { describe, it, expect } from 'vitest';
import {
  convertPhpToUsdc,
  uuidToBytes32,
  isValidEvmAddress,
  calculateDualRailSplit,
  BASE_MAINNET,
  BASE_SEPOLIA,
} from '../../lib/web3/client';
import { formatCampaignParams, SUBUKAN_ESCROW_ABI } from '../../lib/web3/escrow';
import { createListingSchema } from '../../lib/validation/schemas';

describe('Dual-Rail Payment Architecture Unit Tests', () => {
  describe('Web3 Client Currency & Utility Helpers', () => {
    it('should accurately convert PHP to USDC at specified exchange rates', () => {
      expect(convertPhpToUsdc(1000, 58.0)).toBe(17.24);
      expect(convertPhpToUsdc(350, 58.0)).toBe(6.03);
      expect(convertPhpToUsdc(0, 58.0)).toBe(0);
      expect(convertPhpToUsdc(-100, 58.0)).toBe(0);
    });

    it('should convert standard UUIDs to 32-byte hex strings', () => {
      const sampleUuid = '123e4567-e89b-12d3-a456-426614174000';
      const bytes32 = uuidToBytes32(sampleUuid);
      expect(bytes32).toMatch(/^0x[a-f0-9]{64}$/);
      expect(bytes32.startsWith('0x123e4567e89b12d3a456426614174000')).toBe(true);
    });

    it('should validate standard EVM addresses correctly', () => {
      expect(isValidEvmAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913')).toBe(true);
      expect(isValidEvmAddress('0x0000000000000000000000000000000000000000')).toBe(true);
      expect(isValidEvmAddress('invalid-address')).toBe(false);
      expect(isValidEvmAddress('0x123')).toBe(false);
    });

    it('should accurately calculate standard 20% platform take-rate splits', () => {
      const split1000 = calculateDualRailSplit(1000, 20);
      expect(split1000.platformFee).toBe(200);
      expect(split1000.netEscrowPool).toBe(800);
      expect(split1000.grossAmount).toBe(1000);

      const splitUsdc = calculateDualRailSplit(17.24, 20);
      expect(splitUsdc.platformFee).toBe(3.45);
      expect(splitUsdc.netEscrowPool).toBe(13.79);
    });

    it('should have valid Base L2 chain configurations', () => {
      expect(BASE_MAINNET.id).toBe(8453);
      expect(BASE_MAINNET.name).toBe('Base Mainnet');
      expect(BASE_SEPOLIA.id).toBe(84532);
      expect(BASE_SEPOLIA.name).toBe('Base Sepolia Testnet');
    });
  });

  describe('Web3 Escrow Parameter Encoding', () => {
    it('should format BigInt campaign params scaled to 6-decimal USDC', () => {
      const listingId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      const params = formatCampaignParams(listingId, 17.24, 3.45, 5);

      expect(params.listingId).toBe(uuidToBytes32(listingId));
      expect(params.grossUnits).toBe(BigInt(17_240_000));
      expect(params.slotUnits).toBe(BigInt(3_450_000));
      expect(params.slots).toBe(BigInt(5));
    });

    it('should have complete ABI containing all required escrow functions', () => {
      const functionNames = SUBUKAN_ESCROW_ABI.map((item: { name: string }) => item.name);
      expect(functionNames).toContain('createCampaign');
      expect(functionNames).toContain('releaseSlotPayout');
      expect(functionNames).toContain('refundRemaining');
      expect(functionNames).toContain('campaigns');
    });
  });

  describe('createListingSchema Dual-Rail Validation', () => {
    const validBaseListing = {
      title: 'Mobile App Checkout Usability Test',
      description: 'Comprehensive test of GCash checkout flow on mobile phones.',
      rate_per_tester: 200,
      slots_count: 5,
      total_budget: 1000,
      review_window_minutes: 30 as const,
      questions: [
        {
          question_text: 'Did the payment prompt load within 3 seconds?',
          requires_recording: true,
          requires_image: false,
        },
      ],
    };

    it('should validate default fiat_paymongo listing', () => {
      const result = createListingSchema.safeParse({
        ...validBaseListing,
        payment_rail: 'fiat_paymongo',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.payment_rail).toBe('fiat_paymongo');
      }
    });

    it('should validate crypto_web3 listing with Base chain', () => {
      const result = createListingSchema.safeParse({
        ...validBaseListing,
        payment_rail: 'crypto_web3',
        crypto_chain: 'base',
        crypto_token: 'USDC',
        platform_fee_percent: 20.0,
        platform_fee_amount: 200,
        bounty_pool_amount: 800,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.payment_rail).toBe('crypto_web3');
        expect(result.data.crypto_chain).toBe('base');
        expect(result.data.crypto_token).toBe('USDC');
      }
    });
  });
});
