import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  sanitizeSupabaseUrl,
  getSupabaseUrl,
  getSupabaseAnonKey,
  getSupabaseServiceRoleKey,
} from '@/lib/supabase/config';

describe('Supabase Configuration & URL Sanitizer', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('sanitizeSupabaseUrl', () => {
    it('should return empty string for null, undefined, or empty input', () => {
      expect(sanitizeSupabaseUrl(null)).toBe('');
      expect(sanitizeSupabaseUrl(undefined)).toBe('');
      expect(sanitizeSupabaseUrl('')).toBe('');
      expect(sanitizeSupabaseUrl('   ')).toBe('');
    });

    it('should strip /rest/v1 subpath appended from Supabase dashboard', () => {
      expect(sanitizeSupabaseUrl('https://laecyjtfzewxavfzulj.supabase.co/rest/v1')).toBe(
        'https://laecyjtfzewxavfzulj.supabase.co'
      );
      expect(sanitizeSupabaseUrl('https://laecyjtfzewxavfzulj.supabase.co/rest/v1/')).toBe(
        'https://laecyjtfzewxavfzulj.supabase.co'
      );
    });

    it('should strip /auth/v1 subpath if mistakenly appended', () => {
      expect(sanitizeSupabaseUrl('https://laecyjtfzewxavfzulj.supabase.co/auth/v1')).toBe(
        'https://laecyjtfzewxavfzulj.supabase.co'
      );
      expect(sanitizeSupabaseUrl('https://laecyjtfzewxavfzulj.supabase.co/auth/v1/')).toBe(
        'https://laecyjtfzewxavfzulj.supabase.co'
      );
    });

    it('should strip /storage/v1 and /graphql/v1 subpaths', () => {
      expect(sanitizeSupabaseUrl('https://xyz.supabase.co/storage/v1')).toBe('https://xyz.supabase.co');
      expect(sanitizeSupabaseUrl('https://xyz.supabase.co/graphql/v1/')).toBe('https://xyz.supabase.co');
    });

    it('should strip single and multiple trailing slashes', () => {
      expect(sanitizeSupabaseUrl('https://laecyjtfzewxavfzulj.supabase.co/')).toBe(
        'https://laecyjtfzewxavfzulj.supabase.co'
      );
      expect(sanitizeSupabaseUrl('https://laecyjtfzewxavfzulj.supabase.co///')).toBe(
        'https://laecyjtfzewxavfzulj.supabase.co'
      );
    });

    it('should strip surrounding quotes and whitespace', () => {
      expect(sanitizeSupabaseUrl('  "https://laecyjtfzewxavfzulj.supabase.co/rest/v1/"  ')).toBe(
        'https://laecyjtfzewxavfzulj.supabase.co'
      );
      expect(sanitizeSupabaseUrl("  'https://laecyjtfzewxavfzulj.supabase.co/'  ")).toBe(
        'https://laecyjtfzewxavfzulj.supabase.co'
      );
    });

    it('should preserve valid clean base Supabase URL', () => {
      expect(sanitizeSupabaseUrl('https://laecyjtfzewxavfzulj.supabase.co')).toBe(
        'https://laecyjtfzewxavfzulj.supabase.co'
      );
    });

    it('should preserve mock-supabase path while stripping trailing slashes or /rest/v1', () => {
      expect(sanitizeSupabaseUrl('http://localhost:3000/api/mock-supabase')).toBe(
        'http://localhost:3000/api/mock-supabase'
      );
      expect(sanitizeSupabaseUrl('http://localhost:3000/api/mock-supabase/')).toBe(
        'http://localhost:3000/api/mock-supabase'
      );
      expect(sanitizeSupabaseUrl('http://localhost:3000/api/mock-supabase/rest/v1')).toBe(
        'http://localhost:3000/api/mock-supabase'
      );
    });
  });

  describe('getSupabaseUrl', () => {
    it('should read from NEXT_PUBLIC_SUPABASE_URL and return sanitized result', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://my-prod-project.supabase.co/rest/v1';
      expect(getSupabaseUrl()).toBe('https://my-prod-project.supabase.co');
    });

    it('should return empty string if NEXT_PUBLIC_SUPABASE_URL is not set', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      expect(getSupabaseUrl()).toBe('');
    });
  });

  describe('getSupabaseAnonKey & getSupabaseServiceRoleKey', () => {
    it('should read and clean anon key', () => {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = '  "eyJhbGciOiJIUzI1NiIsInR5cCI..."  ';
      expect(getSupabaseAnonKey()).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI...');
    });

    it('should return empty string if anon key is not set', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      expect(getSupabaseAnonKey()).toBe('');
    });

    it('should read and clean service role key', () => {
      process.env.SUPABASE_SERVICE_ROLE_KEY = "  'service-role-secret-token'  ";
      expect(getSupabaseServiceRoleKey()).toBe('service-role-secret-token');
    });

    it('should return empty string if service role key is not set', () => {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      expect(getSupabaseServiceRoleKey()).toBe('');
    });
  });
});
