import { UserProfile } from '@/types';
import { JobListing } from '@/lib/utils/claim-button';

export interface DemographicTargetFields {
  target_age_group?: string | null;
  target_gender?: string | null;
  target_employment_status?: string | null;
  target_tech_literacy?: string | null;
  target_accessibility_tags?: string[] | null;
}

export interface DemographicFilterResult {
  matchedListings: JobListing[];
  unmatchedListings: JobListing[];
  unmatchedCount: number;
}

/**
 * Returns true if the listing has any demographic targeting criteria configured.
 */
export function isListingTargeted(listing: DemographicTargetFields): boolean {
  return Boolean(
    (listing.target_age_group && listing.target_age_group !== 'all') ||
    (listing.target_gender && listing.target_gender !== 'all') ||
    (listing.target_employment_status && listing.target_employment_status !== 'all') ||
    (listing.target_tech_literacy && listing.target_tech_literacy !== 'all') ||
    (listing.target_accessibility_tags && listing.target_accessibility_tags.length > 0)
  );
}

/**
 * Checks if a tester's profile matches the targeting requirements of a listing.
 * Unrestricted listings (no targeting criteria set) always match every tester regardless of profile state.
 */
export function matchesDemographics(
  listing: DemographicTargetFields,
  profile: Partial<UserProfile> | null | undefined
): boolean {
  if (listing.target_age_group && listing.target_age_group !== 'all' && listing.target_age_group !== profile?.age_group) {
    return false;
  }
  if (listing.target_gender && listing.target_gender !== 'all' && listing.target_gender !== profile?.gender) {
    return false;
  }
  if (listing.target_employment_status && listing.target_employment_status !== 'all' && listing.target_employment_status !== profile?.employment_status) {
    return false;
  }
  if (listing.target_tech_literacy && listing.target_tech_literacy !== 'all' && listing.target_tech_literacy !== profile?.tech_literacy) {
    return false;
  }
  if (listing.target_accessibility_tags && listing.target_accessibility_tags.length > 0) {
    const testerTags = profile?.accessibility_tags || [];
    const matchesAll = listing.target_accessibility_tags.every(tag => testerTags.includes(tag));
    if (!matchesAll) {
      return false;
    }
  }
  return true;
}

/**
 * Returns true if a tester profile is missing core demographic fields
 * (age_group, gender, employment_status, or tech_literacy).
 */
export function isProfileDemographicsIncomplete(
  profile: Partial<UserProfile> | null | undefined
): boolean {
  if (!profile) return true;
  return (
    !profile.age_group ||
    !profile.gender ||
    !profile.employment_status ||
    !profile.tech_literacy
  );
}

/**
 * Filters a list of job listings into matched listings and unmatched listings based on demographic profile.
 */
export function filterListingsByDemographics(
  listings: JobListing[],
  profile: Partial<UserProfile> | null | undefined
): DemographicFilterResult {
  const matchedListings: JobListing[] = [];
  const unmatchedListings: JobListing[] = [];

  for (const listing of listings) {
    if (matchesDemographics(listing, profile)) {
      matchedListings.push(listing);
    } else if (isListingTargeted(listing)) {
      unmatchedListings.push(listing);
    }
  }

  return {
    matchedListings,
    unmatchedListings,
    unmatchedCount: unmatchedListings.length,
  };
}
