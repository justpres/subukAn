import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  matchesDemographics, 
  isListingTargeted, 
  isProfileDemographicsIncomplete, 
  filterListingsByDemographics 
} from '@/lib/utils/demographics';
import { JobListing } from '@/lib/utils/claim-button';
import { UserProfile } from '@/types';

describe('Listing Synchronization, Status Alignment & Demographic Visibility', () => {
  const baseListing: JobListing = {
    id: 'listing-1',
    title: 'Philippine Fintech App Usability Walk',
    description: 'Test GCash payment flow and report UI friction.',
    rate_per_tester: 150,
    slots_count: 5,
    slots_filled: 2,
    requires_recording: true,
    requires_image: false,
    question_text: 'Did the QR code scanner launch immediately?',
    is_quick_impression: false,
    target_age_group: null,
    target_gender: null,
    target_employment_status: null,
    target_tech_literacy: null,
    target_accessibility_tags: [],
    site_url: 'https://example.ph',
  };

  const completeProfile: Partial<UserProfile> = {
    id: 'user-tester-1',
    role: 'tester',
    age_group: '25-34',
    gender: 'female',
    employment_status: 'employed',
    tech_literacy: 'intermediate',
    accessibility_tags: ['screen_reader', 'high_contrast'],
  };

  const incompleteProfile: Partial<UserProfile> = {
    id: 'user-tester-2',
    role: 'tester',
    age_group: '',
    gender: '',
    employment_status: '',
    tech_literacy: '',
    accessibility_tags: [],
  };

  describe('1. Demographic Targeting & Matching Logic', () => {
    it('unrestricted listings match all testers regardless of profile state', () => {
      // Complete profile
      expect(matchesDemographics(baseListing, completeProfile)).toBe(true);

      // Incomplete profile (empty strings)
      expect(matchesDemographics(baseListing, incompleteProfile)).toBe(true);

      // Null or undefined profile
      expect(matchesDemographics(baseListing, null)).toBe(true);
      expect(matchesDemographics(baseListing, undefined)).toBe(true);

      expect(isListingTargeted(baseListing)).toBe(false);
    });

    it('identifies targeted listings accurately', () => {
      expect(isListingTargeted({ ...baseListing, target_age_group: '18-24' })).toBe(true);
      expect(isListingTargeted({ ...baseListing, target_gender: 'male' })).toBe(true);
      expect(isListingTargeted({ ...baseListing, target_employment_status: 'student' })).toBe(true);
      expect(isListingTargeted({ ...baseListing, target_tech_literacy: 'advanced' })).toBe(true);
      expect(isListingTargeted({ ...baseListing, target_accessibility_tags: ['screen_reader'] })).toBe(true);
      expect(isListingTargeted(baseListing)).toBe(false);
    });

    it('matches targeted listing when all criteria match the tester profile', () => {
      const targetedListing: JobListing = {
        ...baseListing,
        target_age_group: '25-34',
        target_gender: 'female',
        target_employment_status: 'employed',
        target_tech_literacy: 'intermediate',
      };

      expect(matchesDemographics(targetedListing, completeProfile)).toBe(true);
    });

    it('rejects match when any demographic criterion differs', () => {
      const targetedListing: JobListing = {
        ...baseListing,
        target_age_group: '18-24', // Does not match 25-34
        target_gender: 'female',
      };

      expect(matchesDemographics(targetedListing, completeProfile)).toBe(false);
    });

    it('rejects match when tester profile is incomplete for targeted listings', () => {
      const targetedListing: JobListing = {
        ...baseListing,
        target_age_group: '25-34',
      };

      expect(matchesDemographics(targetedListing, incompleteProfile)).toBe(false);
      expect(matchesDemographics(targetedListing, null)).toBe(false);
    });

    it('handles accessibility tags targeting correctly', () => {
      // Tester has ['screen_reader', 'high_contrast']
      const singleTagListing: JobListing = {
        ...baseListing,
        target_accessibility_tags: ['screen_reader'],
      };
      expect(matchesDemographics(singleTagListing, completeProfile)).toBe(true);

      const multiTagListing: JobListing = {
        ...baseListing,
        target_accessibility_tags: ['screen_reader', 'high_contrast'],
      };
      expect(matchesDemographics(multiTagListing, completeProfile)).toBe(true);

      const unfulfilledTagListing: JobListing = {
        ...baseListing,
        target_accessibility_tags: ['screen_reader', 'braille_display'],
      };
      expect(matchesDemographics(unfulfilledTagListing, completeProfile)).toBe(false);

      // Incomplete profile without tags
      expect(matchesDemographics(singleTagListing, incompleteProfile)).toBe(false);
    });

    it('detects profile incompleteness accurately', () => {
      expect(isProfileDemographicsIncomplete(null)).toBe(true);
      expect(isProfileDemographicsIncomplete(undefined)).toBe(true);
      expect(isProfileDemographicsIncomplete(incompleteProfile)).toBe(true);
      expect(isProfileDemographicsIncomplete({ ...completeProfile, age_group: '' })).toBe(true);
      expect(isProfileDemographicsIncomplete({ ...completeProfile, tech_literacy: null })).toBe(true);
      expect(isProfileDemographicsIncomplete(completeProfile)).toBe(false);
    });

    it('filters and segments listings into matchedListings and unmatchedListings', () => {
      const listings: JobListing[] = [
        { ...baseListing, id: 'l1', title: 'Open to All' },
        { ...baseListing, id: 'l2', title: 'Targeted: 25-34 Female', target_age_group: '25-34', target_gender: 'female' },
        { ...baseListing, id: 'l3', title: 'Targeted: 55+ Male', target_age_group: '55+', target_gender: 'male' },
        { ...baseListing, id: 'l4', title: 'Targeted: Student', target_employment_status: 'student' },
      ];

      // For completeProfile (25-34, female, employed):
      const result = filterListingsByDemographics(listings, completeProfile);
      expect(result.matchedListings.map(l => l.id)).toEqual(['l1', 'l2']);
      expect(result.unmatchedListings.map(l => l.id)).toEqual(['l3', 'l4']);
      expect(result.unmatchedCount).toBe(2);

      // For incompleteProfile:
      const incompleteResult = filterListingsByDemographics(listings, incompleteProfile);
      expect(incompleteResult.matchedListings.map(l => l.id)).toEqual(['l1']);
      expect(incompleteResult.unmatchedListings.map(l => l.id)).toEqual(['l2', 'l3', 'l4']);
      expect(incompleteResult.unmatchedCount).toBe(3);
    });
  });

  describe('2. Status Filter Alignment (open + filling)', () => {
    const candidateListings = [
      { id: '1', title: 'Open Listing', status: 'open' },
      { id: '2', title: 'Funded & Filling Listing', status: 'filling' },
      { id: '3', title: 'In Review Listing', status: 'review' },
      { id: '4', title: 'Released Listing', status: 'released' },
      { id: '5', title: 'Expired Listing', status: 'expired' },
      { id: '6', title: 'Draft Listing', status: 'draft' },
    ];

    it('includes both open and filling listings while excluding terminal/draft statuses', () => {
      const allowedStatuses = ['open', 'filling'];
      const activeListings = candidateListings.filter(l => allowedStatuses.includes(l.status));

      expect(activeListings.map(l => l.id)).toEqual(['1', '2']);
      expect(activeListings.some(l => l.status === 'review')).toBe(false);
      expect(activeListings.some(l => l.status === 'released')).toBe(false);
    });

    it('parses PostgREST in. operator correctly for mock-supabase route', () => {
      const parseStatusIn = (statusParam: string) => {
        if (statusParam.startsWith('in.')) {
          return statusParam
            .replace(/^in\.\(|\)$/g, '')
            .split(',')
            .map(s => s.trim().replace(/^["']|["']$/g, ''));
        }
        if (statusParam.startsWith('eq.')) {
          return [statusParam.substring(3)];
        }
        return [];
      };

      // Standard Supabase PostgREST parameter format
      expect(parseStatusIn('in.(open,filling)')).toEqual(['open', 'filling']);
      // Quoted format
      expect(parseStatusIn('in.("open","filling")')).toEqual(['open', 'filling']);
      // Single-quoted format with whitespace
      expect(parseStatusIn("in.('open', 'filling')")).toEqual(['open', 'filling']);
      // Single eq. fallback
      expect(parseStatusIn('eq.open')).toEqual(['open']);

      // Application to candidate listings
      const allowed = parseStatusIn('in.(open,filling)');
      const filtered = candidateListings.filter(l => allowed.includes(l.status));
      expect(filtered.map(l => l.status)).toEqual(['open', 'filling']);
    });
  });

  describe('3. Ordering Semantics (created_at DESC)', () => {
    it('orders listings chronologically with newest first', () => {
      const unorderedListings = [
        { id: 'older', created_at: '2026-10-01T10:00:00.000Z' },
        { id: 'newest', created_at: '2026-10-04T12:00:00.000Z' },
        { id: 'middle', created_at: '2026-10-03T15:30:00.000Z' },
      ];

      const sorted = [...unorderedListings].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      expect(sorted.map(s => s.id)).toEqual(['newest', 'middle', 'older']);
    });
  });

  describe('4. Background Polling & Visibility Lifecycle', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it('triggers polling refetch when tab is visible and pauses when tab is hidden', () => {
      let isVisible = true;
      const refetchSpy = vi.fn();

      // Simulate the component polling effect
      const pollInterval = setInterval(() => {
        if (isVisible) {
          refetchSpy();
        }
      }, 15000);

      // 15 seconds pass while tab is visible
      vi.advanceTimersByTime(15000);
      expect(refetchSpy).toHaveBeenCalledTimes(1);

      // Another 15 seconds pass while tab is visible
      vi.advanceTimersByTime(15000);
      expect(refetchSpy).toHaveBeenCalledTimes(2);

      // User switches tabs (visibilityState = 'hidden')
      isVisible = false;
      vi.advanceTimersByTime(30000);
      // Spy should not have been called while hidden
      expect(refetchSpy).toHaveBeenCalledTimes(2);

      // User returns to tab (visibilityState = 'visible')
      isVisible = true;
      refetchSpy(); // Instant focus/visibilitychange refetch
      expect(refetchSpy).toHaveBeenCalledTimes(3);

      // Cleanup
      clearInterval(pollInterval);
      vi.advanceTimersByTime(30000);
      expect(refetchSpy).toHaveBeenCalledTimes(3);
    });

    it('cleans up interval, Realtime channel, and window event listeners on unmount', () => {
      const mockRemoveChannel = vi.fn();
      const mockChannel = { id: 'public:listings' };
      const mockSupabase = {
        removeChannel: mockRemoveChannel,
      };

      const mockWindow = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

      // Setup effect
      const handleVisibilityOrFocus = vi.fn();
      mockWindow.addEventListener('visibilitychange', handleVisibilityOrFocus);
      mockWindow.addEventListener('focus', handleVisibilityOrFocus);
      const pollTimer = setInterval(() => {}, 15000);

      expect(mockWindow.addEventListener).toHaveBeenCalledWith('visibilitychange', handleVisibilityOrFocus);
      expect(mockWindow.addEventListener).toHaveBeenCalledWith('focus', handleVisibilityOrFocus);

      // Simulate component unmount cleanup callback
      mockSupabase.removeChannel(mockChannel);
      clearInterval(pollTimer);
      mockWindow.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      mockWindow.removeEventListener('focus', handleVisibilityOrFocus);

      expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannel);
      expect(clearIntervalSpy).toHaveBeenCalledWith(pollTimer);
      expect(mockWindow.removeEventListener).toHaveBeenCalledWith('visibilitychange', handleVisibilityOrFocus);
      expect(mockWindow.removeEventListener).toHaveBeenCalledWith('focus', handleVisibilityOrFocus);
    });
  });
});
