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
    listing.target_gender !== profile?.gender
  ) {
    const genderLabel = listing.target_gender.charAt(0).toUpperCase() + listing.target_gender.slice(1);
    unmet.push(`Gender: ${genderLabel}`);
  }

  // 3. Employment Status
  if (
    listing.target_employment_status &&
    listing.target_employment_status !== 'all' &&
    listing.target_employment_status !== profile?.employment_status
  ) {
    let empLabel = listing.target_employment_status;
    if (empLabel === 'self-employed') {
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
    const testerTags = profile?.accessibility_tags || [];
    for (const tag of listing.target_accessibility_tags) {
      if (!testerTags.includes(tag)) {
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
 */
export function filterListingsByDemographics(
  listings: JobListing[],
  profile: Partial<UserProfile> | null | undefined
): DemographicFilterResult {
  const matchedListings: JobListing[] = [];
  const unmatchedListings: JobListing[] = [];

  for (const listing of listings) {
    const isMatched = matchesDemographics(listing, profile);
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
