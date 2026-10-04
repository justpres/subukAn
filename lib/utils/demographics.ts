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
  if (
    listing.target_gender &&
    listing.target_gender !== 'all' &&
    listing.target_gender.toLowerCase() !== profile?.gender?.toLowerCase()
  ) {
    return false;
  }
  if (
    listing.target_employment_status &&
    listing.target_employment_status !== 'all' &&
    listing.target_employment_status.replace(/_/g, '-') !== profile?.employment_status?.replace(/_/g, '-')
  ) {
    return false;
  }
  if (listing.target_tech_literacy && listing.target_tech_literacy !== 'all' && listing.target_tech_literacy !== profile?.tech_literacy) {
    return false;
  }
  if (listing.target_accessibility_tags && listing.target_accessibility_tags.length > 0) {
    const testerTags = Array.isArray(profile?.accessibility_tags) ? profile.accessibility_tags : [];
    const matchesAll = listing.target_accessibility_tags.every(tag => testerTags.includes(tag));
    if (!matchesAll) {
      return false;
    }
  }
  return true;
}

/**
 * Returns a list of human-readable labels for demographic criteria required by the listing
 * that are not met by the tester's profile.
 *
 * Example outputs:
 * ["Age: 25-34", "Gender: Female", "Tech Experience: Beginner", "Screen Reader Required"]
 */
export function getUnmetDemographicRequirements(
  listing: DemographicTargetFields,
  profile: Partial<UserProfile> | null | undefined
): string[] {
  const unmet: string[] = [];

  // 1. Age Group
  if (
    listing.target_age_group &&
    listing.target_age_group !== 'all' &&
    listing.target_age_group !== profile?.age_group
  ) {
    unmet.push(`Age: ${listing.target_age_group}`);
  }

  // 2. Gender
  if (
    listing.target_gender &&
    listing.target_gender !== 'all' &&
    listing.target_gender.toLowerCase() !== profile?.gender?.toLowerCase()
  ) {
    const genderLabel = listing.target_gender.charAt(0).toUpperCase() + listing.target_gender.slice(1).toLowerCase();
    unmet.push(`Gender: ${genderLabel}`);
  }

  // 3. Employment Status
  if (
    listing.target_employment_status &&
    listing.target_employment_status !== 'all' &&
    listing.target_employment_status.replace(/_/g, '-') !== profile?.employment_status?.replace(/_/g, '-')
  ) {
    let empLabel = listing.target_employment_status;
    if (empLabel === 'self-employed' || empLabel === 'self_employed') {
      empLabel = 'Self-Employed';
    } else {
      empLabel = empLabel.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }
    unmet.push(`Employment: ${empLabel}`);
  }

  // 4. Tech Literacy / Experience
  if (
    listing.target_tech_literacy &&
    listing.target_tech_literacy !== 'all' &&
    listing.target_tech_literacy !== profile?.tech_literacy
  ) {
    let techLabel: string;
    switch (listing.target_tech_literacy) {
      case 'non_technical':
      case 'beginner':
        techLabel = 'Beginner';
        break;
      case 'casual_user':
        techLabel = 'Casual User';
        break;
      case 'intermediate':
        techLabel = 'Intermediate';
        break;
      case 'student_dev':
        techLabel = 'Developer';
        break;
      case 'advanced':
        techLabel = 'Advanced';
        break;
      default:
        techLabel = listing.target_tech_literacy.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        break;
    }
    unmet.push(`Tech Experience: ${techLabel}`);
  }

  // 5. Accessibility Tags
  if (listing.target_accessibility_tags && listing.target_accessibility_tags.length > 0) {
    const testerTags = Array.isArray(profile?.accessibility_tags) ? profile.accessibility_tags : [];
    for (const tag of listing.target_accessibility_tags) {
      if (tag && !testerTags.includes(tag)) {
        let tagLabel: string;
        switch (tag) {
          case 'screen_reader':
            tagLabel = 'Screen Reader Required';
            break;
          case 'keyboard_only':
            tagLabel = 'Keyboard-Only Required';
            break;
          case 'high_contrast':
            tagLabel = 'High Contrast Required';
            break;
          case 'color_blind':
            tagLabel = 'Color Blind Required';
            break;
          default:
            tagLabel = `${tag.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} Required`;
            break;
        }
        unmet.push(tagLabel);
      }
    }
  }

  return unmet;
}

export type DemographicFieldKey = 'age_group' | 'gender' | 'employment_status' | 'tech_literacy' | 'accessibility';

/**
 * Returns the key of the first unmet demographic field for a listing, or null if all criteria match.
 * Useful for pre-focusing the relevant input when opening ProfileModal.
 */
export function getFirstUnmetDemographicField(
  listing: DemographicTargetFields,
  profile: Partial<UserProfile> | null | undefined
): DemographicFieldKey | null {
  if (
    listing.target_age_group &&
    listing.target_age_group !== 'all' &&
    listing.target_age_group !== profile?.age_group
  ) {
    return 'age_group';
  }

  if (
    listing.target_gender &&
    listing.target_gender !== 'all' &&
    listing.target_gender.toLowerCase() !== profile?.gender?.toLowerCase()
  ) {
    return 'gender';
  }

  if (
    listing.target_employment_status &&
    listing.target_employment_status !== 'all' &&
    listing.target_employment_status.replace(/_/g, '-') !== profile?.employment_status?.replace(/_/g, '-')
  ) {
    return 'employment_status';
  }

  if (
    listing.target_tech_literacy &&
    listing.target_tech_literacy !== 'all' &&
    listing.target_tech_literacy !== profile?.tech_literacy
  ) {
    return 'tech_literacy';
  }

  if (Array.isArray(listing.target_accessibility_tags) && listing.target_accessibility_tags.length > 0) {
    const testerTags = Array.isArray(profile?.accessibility_tags) ? profile.accessibility_tags : [];
    const hasUnmetTag = listing.target_accessibility_tags.some(tag => Boolean(tag) && !testerTags.includes(tag));
    if (hasUnmetTag) {
      return 'accessibility';
    }
  }

  return null;
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
 * Listings are decorated with is_demographic_matched and unmet_demographics.
 * Active user submissions take precedence over demographic restrictions.
 */
export function filterListingsByDemographics(
  listings: JobListing[],
  profile: Partial<UserProfile> | null | undefined
): DemographicFilterResult {
  const matchedListings: JobListing[] = [];
  const unmatchedListings: JobListing[] = [];

  for (const listing of listings) {
    const hasActiveSubmission = Boolean(
      listing.user_submission_status && listing.user_submission_status !== 'expired'
    );
    const matchesProfile = matchesDemographics(listing, profile);
    const isMatched = hasActiveSubmission || matchesProfile;
    const unmet = isMatched ? [] : getUnmetDemographicRequirements(listing, profile);
    const decoratedListing: JobListing = {
      ...listing,
      is_demographic_matched: isMatched,
      unmet_demographics: unmet,
    };

    if (isMatched) {
      matchedListings.push(decoratedListing);
    } else if (isListingTargeted(listing)) {
      unmatchedListings.push(decoratedListing);
    }
  }

  return {
    matchedListings,
    unmatchedListings,
    unmatchedCount: unmatchedListings.length,
  };
}
