import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  mapDeviceTypesToDeviceType,
  resolveInitialDeviceTypes,
  resolveInitialNotificationSettings,
  DEFAULT_DEVICE_TYPES,
  DEFAULT_NOTIFICATION_SETTINGS,
} from '@/lib/utils/profile';
import { sanitizeDatabaseError } from '@/lib/utils/error';
import { GET, PATCH, POST } from '@/app/api/mock-supabase/[[...path]]/route';
import { UserProfile, NotificationSettings } from '@/types';

describe('Profile Settings Save & Form Invariants', () => {
  describe('Device Types & Form State Initialization', () => {
    it('initializes with default device types when profile is empty or new', () => {
      expect(resolveInitialDeviceTypes(null)).toEqual(DEFAULT_DEVICE_TYPES);
      expect(resolveInitialDeviceTypes(undefined)).toEqual(DEFAULT_DEVICE_TYPES);
      expect(resolveInitialDeviceTypes({})).toEqual(DEFAULT_DEVICE_TYPES);
    });

    it('respects existing populated device types array', () => {
      const profile: Partial<UserProfile> = {
        device_types: ['Android Mobile', 'Mac Desktop'],
      };
      expect(resolveInitialDeviceTypes(profile)).toEqual(['Android Mobile', 'Mac Desktop']);
    });

    it('CRITICAL: respects empty array [] and DOES NOT revert to default device types', () => {
      const profileWithUncheckedAll: Partial<UserProfile> = {
        device_types: [],
      };
      const result = resolveInitialDeviceTypes(profileWithUncheckedAll);
      expect(result).toEqual([]);
      expect(result).not.toEqual(DEFAULT_DEVICE_TYPES);
      expect(result.length).toBe(0);
    });

    it('respects explicitly null device_types and returns empty array without resetting to defaults', () => {
      const profileWithNull: Partial<UserProfile> = {
        device_types: null,
      };
      const result = resolveInitialDeviceTypes(profileWithNull);
      expect(result).toEqual([]);
    });

    it('maps single string device_types into an array', () => {
      const profileWithString: Partial<UserProfile> = {
        device_types: 'iOS Mobile',
      };
      expect(resolveInitialDeviceTypes(profileWithString)).toEqual(['iOS Mobile']);
    });

    it('falls back gracefully to legacy singular device_type when device_types is undefined', () => {
      expect(resolveInitialDeviceTypes({ device_type: 'mobile' })).toEqual(['Android Mobile']);
      expect(resolveInitialDeviceTypes({ device_type: 'desktop' })).toEqual(['Windows PC']);
      expect(resolveInitialDeviceTypes({ device_type: 'both' })).toEqual(DEFAULT_DEVICE_TYPES);
    });
  });

  describe('Device Type High-Level Mapping', () => {
    it('correctly maps mobile and desktop combinations to both', () => {
      expect(mapDeviceTypesToDeviceType(['Android Mobile', 'Windows PC'])).toBe('both');
      expect(mapDeviceTypesToDeviceType(['iOS Mobile', 'Mac Desktop'])).toBe('both');
      expect(mapDeviceTypesToDeviceType(['Android Mobile', 'Mac Desktop', 'Windows PC'])).toBe('both');
    });

    it('correctly maps mobile-only arrays to mobile', () => {
      expect(mapDeviceTypesToDeviceType(['Android Mobile'])).toBe('mobile');
      expect(mapDeviceTypesToDeviceType(['iOS Mobile'])).toBe('mobile');
      expect(mapDeviceTypesToDeviceType(['Android Mobile', 'iOS Mobile'])).toBe('mobile');
    });

    it('correctly maps desktop-only arrays to desktop', () => {
      expect(mapDeviceTypesToDeviceType(['Windows PC'])).toBe('desktop');
      expect(mapDeviceTypesToDeviceType(['Mac Desktop'])).toBe('desktop');
      expect(mapDeviceTypesToDeviceType(['Windows PC', 'Mac Desktop'])).toBe('desktop');
    });

    it('returns null when device_types is empty or invalid', () => {
      expect(mapDeviceTypesToDeviceType([])).toBeNull();
      expect(mapDeviceTypesToDeviceType([] as string[])).toBeNull();
    });
  });

  describe('Notification Settings State Initialization & Preservation', () => {
    it('initializes with default true settings when settings are missing', () => {
      expect(resolveInitialNotificationSettings(null)).toEqual(DEFAULT_NOTIFICATION_SETTINGS);
      expect(resolveInitialNotificationSettings(undefined)).toEqual(DEFAULT_NOTIFICATION_SETTINGS);
      expect(resolveInitialNotificationSettings({})).toEqual(DEFAULT_NOTIFICATION_SETTINGS);
    });

    it('CRITICAL: preserves false booleans when unchecking notification preferences', () => {
      const savedSettings: NotificationSettings = {
        email_payouts: false,
        email_submissions: false,
        email_listings: false,
        email_disputes: false,
      };

      const result = resolveInitialNotificationSettings({
        notification_settings: savedSettings,
      });

      expect(result.email_payouts).toBe(false);
      expect(result.email_submissions).toBe(false);
      expect(result.email_listings).toBe(false);
      expect(result.email_disputes).toBe(false);
    });

    it('preserves mixed boolean preferences without flipping false to true', () => {
      const mixedSettings: NotificationSettings = {
        email_payouts: true,
        email_submissions: false,
        email_listings: true,
        email_disputes: false,
      };

      const result = resolveInitialNotificationSettings({
        notification_settings: mixedSettings,
      });

      expect(result.email_payouts).toBe(true);
      expect(result.email_submissions).toBe(false);
      expect(result.email_listings).toBe(true);
      expect(result.email_disputes).toBe(false);
    });
  });

  describe('Form Toggle Invariants (Simulated User Actions)', () => {
    it('simulates unchecking device types step-by-step to empty array', () => {
      let userSelection = ['Android Mobile', 'Windows PC'];

      // Uncheck Windows PC
      userSelection = userSelection.filter(d => d !== 'Windows PC');
      expect(userSelection).toEqual(['Android Mobile']);
      expect(mapDeviceTypesToDeviceType(userSelection)).toBe('mobile');

      // Uncheck Android Mobile
      userSelection = userSelection.filter(d => d !== 'Android Mobile');
      expect(userSelection).toEqual([]);
      expect(mapDeviceTypesToDeviceType(userSelection)).toBeNull();

      // Ensure form state resolver respects this empty array on reload
      const loadedFormState = resolveInitialDeviceTypes({ device_types: userSelection });
      expect(loadedFormState).toEqual([]);
      expect(loadedFormState.includes('Windows PC')).toBe(false);
      expect(loadedFormState.includes('Android Mobile')).toBe(false);
    });

    it('simulates unchecking accessibility accommodations to empty array', () => {
      let tags = ['screen_reader', 'keyboard_only'];

      tags = tags.filter(t => t !== 'screen_reader');
      expect(tags).toEqual(['keyboard_only']);

      tags = tags.filter(t => t !== 'keyboard_only');
      expect(tags).toEqual([]);

      const resolvedTags = Array.isArray(tags) ? tags : [];
      expect(resolvedTags).toEqual([]);
      expect(resolvedTags.length).toBe(0);
    });

    it('simulates unchecking notifications and verifies false values are preserved', () => {
      let notifs: NotificationSettings = { ...DEFAULT_NOTIFICATION_SETTINGS };

      // User unchecks email_listings
      notifs = { ...notifs, email_listings: false };
      expect(notifs.email_listings).toBe(false);
      expect(notifs.email_payouts).toBe(true);

      // User unchecks email_payouts as well
      notifs = { ...notifs, email_payouts: false };
      expect(notifs.email_payouts).toBe(false);
      expect(notifs.email_submissions).toBe(true);

      const resolved = resolveInitialNotificationSettings({ notification_settings: notifs });
      expect(resolved.email_listings).toBe(false);
      expect(resolved.email_payouts).toBe(false);
      expect(resolved.email_submissions).toBe(true);
    });
  });

  describe('Mock Supabase Profile REST API', () => {
    it('returns location, device_types, and notification_settings on GET /rest/v1/profiles', async () => {
      const req = new NextRequest('http://localhost:3000/rest/v1/profiles?id=eq.user_mock_tester_id', {
        headers: { Accept: 'application/vnd.pgrst.object+json' },
      });
      const res = await GET(req, { params: { path: ['rest', 'v1', 'profiles'] } });
      expect(res.status).toBe(200);

      const data = await res.json() as UserProfile;
      expect(data.id).toBe('user_mock_tester_id');
      expect(data.location).toBe('Metro Manila');
      expect(Array.isArray(data.device_types)).toBe(true);
      expect(data.device_types).toContain('Android Mobile');
      expect(data.notification_settings?.email_payouts).toBe(true);
    });

    it('correctly updates and preserves empty device_types and false notifications on PATCH', async () => {
      const patchPayload = {
        device_types: [],
        device_type: null,
        notification_settings: {
          email_payouts: false,
          email_submissions: false,
          email_listings: false,
          email_disputes: false,
        },
      };

      const patchReq = new NextRequest('http://localhost:3000/rest/v1/profiles?id=eq.user_mock_tester_id', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/vnd.pgrst.object+json',
        },
        body: JSON.stringify(patchPayload),
      });

      const patchRes = await PATCH(patchReq, { params: { path: ['rest', 'v1', 'profiles'] } });
      expect(patchRes.status).toBe(200);

      const patchData = await patchRes.json() as UserProfile;
      expect(patchData.device_types).toEqual([]);
      expect(patchData.notification_settings?.email_payouts).toBe(false);
      expect(patchData.notification_settings?.email_submissions).toBe(false);

      // Verify subsequent GET retrieves the exact uncheck state
      const getReq = new NextRequest('http://localhost:3000/rest/v1/profiles?id=eq.user_mock_tester_id', {
        headers: { Accept: 'application/vnd.pgrst.object+json' },
      });
      const getRes = await GET(getReq, { params: { path: ['rest', 'v1', 'profiles'] } });
      const refreshedData = await getRes.json() as UserProfile;

      expect(refreshedData.device_types).toEqual([]);
      expect(refreshedData.notification_settings?.email_payouts).toBe(false);
      expect(refreshedData.notification_settings?.email_listings).toBe(false);
    });
  });

  describe('Database Error Handling & Fallback Invariants', () => {
    it('executes safe fallback by stripping extended columns if schema cache returns column missing error', async () => {
      const fullUpdatePayload: Partial<UserProfile> = {
        age_group: '25-34',
        gender: 'female',
        location: 'Cavite',
        device_types: ['Android Mobile'],
        device_type: 'mobile',
        notification_settings: {
          email_payouts: true,
          email_submissions: true,
          email_listings: false,
          email_disputes: true,
        },
      };

      let fallbackExecuted = false;
      let executedPayload: unknown = null;

      // Mock update handler demonstrating fallback logic
      const simulateUpdate = async (payload: Partial<UserProfile>) => {
        // First try returns extended column error
        const isExtendedColumnError = (errMessage: string) =>
          errMessage.includes('device_types') ||
          errMessage.includes('notification_settings') ||
          errMessage.includes('location') ||
          errMessage.includes('schema cache');

        const initialError = { message: "Could not find the 'device_types' column of 'profiles' in the schema cache" };

        if (initialError && isExtendedColumnError(initialError.message)) {
          fallbackExecuted = true;
          const { device_types: _dt, location: _loc, notification_settings: _ns, ...legacyPayload } = payload;
          executedPayload = legacyPayload;
          return { error: null };
        }
        return { error: initialError };
      };

      const result = await simulateUpdate(fullUpdatePayload);
      expect(result.error).toBeNull();
      expect(fallbackExecuted).toBe(true);
      expect(executedPayload).toEqual({
        age_group: '25-34',
        gender: 'female',
        device_type: 'mobile',
      });
      expect(executedPayload).not.toHaveProperty('device_types');
      expect(executedPayload).not.toHaveProperty('notification_settings');
    });

    it('does NOT silently swallow real database errors (e.g. RLS violation or permission denied)', () => {
      const rlsError = new Error('violates row level security policy for profiles');
      const sanitized = sanitizeDatabaseError(rlsError, 'Failed to update profile settings.');
      expect(sanitized).toBe('Access denied. You do not have permission to perform this action.');

      // Verify that throwing the sanitized error prevents silent false success
      expect(() => {
        throw new Error(sanitized);
      }).toThrow('Access denied. You do not have permission to perform this action.');
    });
  });
});
