import { UserProfile, NotificationSettings } from '@/types';

export const DEFAULT_DEVICE_TYPES: string[] = ['Android Mobile', 'Windows PC'];

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  email_payouts: true,
  email_submissions: true,
  email_listings: true,
  email_disputes: true,
};

/**
 * Maps an array of device types (e.g. ['Android Mobile', 'Windows PC']) to the
 * legacy high-level device_type enum ('mobile' | 'desktop' | 'both' | null).
 */
export function mapDeviceTypesToDeviceType(
  deviceTypes: string[]
): 'mobile' | 'desktop' | 'both' | null {
  if (!Array.isArray(deviceTypes) || deviceTypes.length === 0) {
    return null;
  }

  const hasMobile = deviceTypes.some(d => {
    const lower = d.toLowerCase();
    return (
      lower.includes('mobile') ||
      lower.includes('android') ||
      lower.includes('ios') ||
      lower.includes('phone')
    );
  });

  const hasDesktop = deviceTypes.some(d => {
    const lower = d.toLowerCase();
    return (
      lower.includes('desktop') ||
      lower.includes('pc') ||
      lower.includes('mac') ||
      lower.includes('windows') ||
      lower.includes('laptop')
    );
  });

  if (hasMobile && hasDesktop) return 'both';
  if (hasMobile) return 'mobile';
  if (hasDesktop) return 'desktop';
  return null;
}

/**
 * Resolves initial device types for form state.
 * Strictly respects empty arrays ([]), without falling back to defaults.
 */
export function resolveInitialDeviceTypes(
  profile: Partial<UserProfile> | null | undefined
): string[] {
  if (!profile) {
    return DEFAULT_DEVICE_TYPES;
  }

  // If device_types is an array (even if empty []), respect it!
  if (Array.isArray(profile.device_types)) {
    return profile.device_types;
  }

  // If single string
  if (typeof profile.device_types === 'string') {
    return [profile.device_types];
  }

  // If explicitly null, treat as empty selection
  if (profile.device_types === null) {
    return [];
  }

  // If device_types is undefined, inspect device_type (singular)
  if (profile.device_type === 'mobile') {
    return ['Android Mobile'];
  }
  if (profile.device_type === 'desktop') {
    return ['Windows PC'];
  }
  if (profile.device_type === 'both') {
    return DEFAULT_DEVICE_TYPES;
  }

  return DEFAULT_DEVICE_TYPES;
}

/**
 * Resolves initial notification settings for form state.
 * Preserves false boolean values without reverting them to true defaults.
 */
export function resolveInitialNotificationSettings(
  profile: Partial<UserProfile> | null | undefined
): NotificationSettings {
  if (!profile?.notification_settings) {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }

  const s = profile.notification_settings;
  return {
    email_payouts: s.email_payouts !== undefined ? Boolean(s.email_payouts) : true,
    email_submissions: s.email_submissions !== undefined ? Boolean(s.email_submissions) : true,
    email_listings: s.email_listings !== undefined ? Boolean(s.email_listings) : true,
    email_disputes: s.email_disputes !== undefined ? Boolean(s.email_disputes) : true,
  };
}
