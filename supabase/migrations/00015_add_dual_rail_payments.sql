-- Migration 00015: Add Dual-Rail Payment Support (Fiat PayMongo + Crypto Web3 Escrow)

-- 1. Update listings table with payment rail and crypto metadata
alter table public.listings 
  add column if not exists payment_rail text not null default 'fiat_paymongo' check (payment_rail in ('fiat_paymongo', 'crypto_web3')),
  add column if not exists crypto_chain text check (crypto_chain in ('base', 'polygon', 'solana')),
  add column if not exists crypto_token text default 'USDC',
  add column if not exists escrow_contract_address text,
  add column if not exists escrow_tx_hash text,
  add column if not exists platform_fee_percent numeric not null default 20.00,
  add column if not exists platform_fee_amount numeric,
  add column if not exists bounty_pool_amount numeric;

-- 2. Update profiles table with crypto wallet and payout preference
alter table public.profiles
  add column if not exists crypto_wallet_address text,
  add column if not exists preferred_payout_rail text not null default 'gcash' check (preferred_payout_rail in ('gcash', 'maya', 'crypto_wallet'));

-- 3. Update submissions table with payout transaction reference
alter table public.submissions
  add column if not exists payout_tx_hash text,
  add column if not exists payout_rail text not null default 'fiat_paymongo' check (payout_rail in ('fiat_paymongo', 'crypto_web3'));

-- Index for querying listings by payment rail
create index if not exists idx_listings_payment_rail on public.listings(payment_rail);
