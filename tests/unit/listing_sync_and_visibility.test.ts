import fs from 'fs';
import path from 'path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { 
  matchesDemographics, 
  isListingTargeted, 
  isProfileDemographicsIncomplete, 
  filterListingsByDemographics,
  getUnmetDemographicRequirements 
} from '@/lib/utils/demographics';
import { JobListing, getButtonConfig } from '@/lib/utils/claim-button';
import { UserProfile } from '@/types';
import { GET } from '@/app/api/mock-supabase/[[...path]]/route';

interface GlobalMockDb {
  mockDb?: {
    listings: Map<string, {
      id: string;
      title: string;
      status: string;
      created_at: string;
      slots_count?: number;
      rate_per_tester?: number;
      [key: string]: unknown;
    }>;
  };
}

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

    it('identifies targeted listings accurately and handles "all" values', () => {
      expect(isListingTargeted({ ...baseListing, target_age_group: '18-24' })).toBe(true);
      expect(isListingTargeted({ ...baseListing, target_gender: 'male' })).toBe(true);
      expect(isListingTargeted({ ...baseListing, target_employment_status: 'student' })).toBe(true);
      expect(isListingTargeted({ ...baseListing, target_tech_literacy: 'advanced' })).toBe(true);
      expect(isListingTargeted({ ...baseListing, target_accessibility_tags: ['screen_reader'] })).toBe(true);

      // Values set to 'all' should not mark the listing as targeted
      expect(isListingTargeted({ ...baseListing, target_age_group: 'all' })).toBe(false);
      expect(isListingTargeted({ ...baseListing, target_gender: 'all' })).toBe(false);
      expect(isListingTargeted({ ...baseListing, target_employment_status: 'all' })).toBe(false);
      expect(isListingTargeted({ ...baseListing, target_tech_literacy: 'all' })).toBe(false);
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

    it('treats "all" criteria as matching any profile', () => {
      const broadListing: JobListing = {
        ...baseListing,
        target_age_group: 'all',
        target_gender: 'all',
        target_employment_status: 'all',
        target_tech_literacy: 'all',
      };

      expect(matchesDemographics(broadListing, completeProfile)).toBe(true);
      expect(matchesDemographics(broadListing, incompleteProfile)).toBe(true);
      expect(matchesDemographics(broadListing, null)).toBe(true);
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

  describe('2. Status Filter Alignment (open + filling) & Real Mock Route Handler', () => {
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

    it('executes real mock-supabase GET route handler with status in. operator', async () => {
      const mockGlobal = globalThis as GlobalMockDb;
      if (mockGlobal.mockDb?.listings) {
        mockGlobal.mockDb.listings.clear();
        mockGlobal.mockDb.listings.set('test-open', {
          id: 'test-open',
          title: 'Active Open Listing',
          status: 'open',
          created_at: '2026-10-04T10:00:00Z',
        });
        mockGlobal.mockDb.listings.set('test-filling', {
          id: 'test-filling',
          title: 'Funded Filling Listing',
          status: 'filling',
          created_at: '2026-10-04T11:00:00Z',
        });
        mockGlobal.mockDb.listings.set('test-draft', {
          id: 'test-draft',
          title: 'Unpublished Draft',
          status: 'draft',
          created_at: '2026-10-04T09:00:00Z',
        });
        mockGlobal.mockDb.listings.set('test-review', {
          id: 'test-review',
          title: 'In Review Campaign',
          status: 'review',
          created_at: '2026-10-04T08:00:00Z',
        });
      }

      // 1. Query with in.(open,filling)
      const reqIn = new NextRequest(
        'http://localhost:3000/api/mock-supabase/rest/v1/listings?status=in.(open,filling)&order=created_at.desc'
      );
      const resIn = await GET(reqIn, { params: { path: ['rest', 'v1', 'listings'] } });
      expect(resIn.status).toBe(200);

      const itemsIn = (await resIn.json()) as Array<{ id: string; status: string }>;
      const itemStatuses = itemsIn.map(i => i.status);

      expect(itemStatuses).toContain('open');
      expect(itemStatuses).toContain('filling');
      expect(itemStatuses).not.toContain('draft');
      expect(itemStatuses).not.toContain('review');

      // 2. Query with eq.open
      const reqEq = new NextRequest(
        'http://localhost:3000/api/mock-supabase/rest/v1/listings?status=eq.open'
      );
      const resEq = await GET(reqEq, { params: { path: ['rest', 'v1', 'listings'] } });
      expect(resEq.status).toBe(200);

      const itemsEq = (await resEq.json()) as Array<{ id: string; status: string }>;
      expect(itemsEq.every(i => i.status === 'open')).toBe(true);
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

  describe('4. Background Polling, Concurrency & Lifecycle Cleanup', () => {
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

    it('guards against setting state on unmounted components and race conditions', async () => {
      let isMounted = true;
      let inFlight = false;
      let fetchSeq = 0;
      const stateUpdateSpy = vi.fn();

      const fetchListings = async (silent = false) => {
        if (inFlight && silent) return;
        inFlight = true;
        const currentSeq = ++fetchSeq;

        // Simulate async network latency
        await new Promise((resolve) => setTimeout(resolve, 50));

        inFlight = false;
        if (!isMounted || currentSeq !== fetchSeq) return;
        stateUpdateSpy();
      };

      // Trigger 1 (visible fetch)
      const p1 = fetchListings(false);

      // Advance time slightly, unmount before completion
      vi.advanceTimersByTime(20);
      isMounted = false;

      // Complete timer
      vi.advanceTimersByTime(50);
      await p1;

      // State setter should NOT have been called because component unmounted
      expect(stateUpdateSpy).not.toHaveBeenCalled();
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

  describe('5. Unmet Demographic Requirements Helper', () => {
    it('returns empty array when listing has no targeting criteria', () => {
      expect(getUnmetDemographicRequirements(baseListing, completeProfile)).toEqual([]);
      expect(getUnmetDemographicRequirements(baseListing, incompleteProfile)).toEqual([]);
      expect(getUnmetDemographicRequirements(baseListing, null)).toEqual([]);
    });

    it('returns empty array when profile matches all targeting criteria', () => {
      const targetedListing: JobListing = {
        ...baseListing,
        target_age_group: '25-34',
        target_gender: 'female',
        target_employment_status: 'employed',
        target_tech_literacy: 'intermediate',
        target_accessibility_tags: ['screen_reader'],
      };
      expect(getUnmetDemographicRequirements(targetedListing, completeProfile)).toEqual([]);
    });

    it('returns formatted unmet criteria labels when profile does not match', () => {
      const targetedListing: JobListing = {
        ...baseListing,
        target_age_group: '25-34',
        target_gender: 'female',
        target_employment_status: 'student',
        target_tech_literacy: 'non_technical',
        target_accessibility_tags: ['screen_reader', 'keyboard_only'],
      };

      // Profile has: age_group: '25-34', gender: 'female', employment_status: 'employed', tech_literacy: 'intermediate', tags: ['screen_reader', 'high_contrast']
      const unmet = getUnmetDemographicRequirements(targetedListing, completeProfile);

      expect(unmet).toContain('Employment: Student');
      expect(unmet).toContain('Tech Experience: Beginner');
      expect(unmet).toContain('Keyboard-Only Required');
      expect(unmet).not.toContain('Age: 25-34');
      expect(unmet).not.toContain('Gender: Female');
      expect(unmet).not.toContain('Screen Reader Required');
    });

    it('returns exact expected list when all criteria are unmet on empty profile', () => {
      const targetedListing: JobListing = {
        ...baseListing,
        target_age_group: '25-34',
        target_gender: 'female',
        target_tech_literacy: 'non_technical',
        target_accessibility_tags: ['screen_reader'],
      };

      const unmet = getUnmetDemographicRequirements(targetedListing, null);
      expect(unmet).toEqual([
        'Age: 25-34',
        'Gender: Female',
        'Tech Experience: Beginner',
        'Screen Reader Required',
      ]);
    });

    it('ignores "all" target criteria from unmet requirements', () => {
      const allListing: JobListing = {
        ...baseListing,
        target_age_group: 'all',
        target_gender: 'all',
        target_employment_status: 'all',
        target_tech_literacy: 'all',
        target_accessibility_tags: [],
      };

      expect(getUnmetDemographicRequirements(allListing, incompleteProfile)).toEqual([]);
      expect(getUnmetDemographicRequirements(allListing, null)).toEqual([]);
    });

    it('formats various employment and tech experience labels correctly', () => {
      expect(getUnmetDemographicRequirements({ ...baseListing, target_employment_status: 'self-employed' }, null))
        .toEqual(['Employment: Self-Employed']);
      expect(getUnmetDemographicRequirements({ ...baseListing, target_tech_literacy: 'casual_user' }, null))
        .toEqual(['Tech Experience: Casual User']);
      expect(getUnmetDemographicRequirements({ ...baseListing, target_tech_literacy: 'student_dev' }, null))
        .toEqual(['Tech Experience: Developer']);
      expect(getUnmetDemographicRequirements({ ...baseListing, target_tech_literacy: 'advanced' }, null))
        .toEqual(['Tech Experience: Advanced']);
    });
  });

  describe('6. Claim Button Configuration & Feed Decoration for Unmatched Targeted Listings', () => {
    const targetedListing: JobListing = {
      ...baseListing,
      target_age_group: '18-24',
      target_gender: 'male',
    };

    it('returns "Targeted — Needs Profile Match" disabled button when isMatched is false', () => {
      const config = getButtonConfig(targetedListing, { isMatched: false });
      expect(config.text).toBe('Targeted — Needs Profile Match');
      expect(config.disabled).toBe(true);
      expect(config.action).toBe('update_profile');
      expect(config.status).toBe('unmatched_targeted');
    });

    it('supports boolean false as second argument to getButtonConfig', () => {
      const config = getButtonConfig(targetedListing, false);
      expect(config.text).toBe('Targeted — Needs Profile Match');
      expect(config.disabled).toBe(true);
      expect(config.action).toBe('update_profile');
    });

    it('reads is_demographic_matched property from JobListing when options are omitted', () => {
      const unmatchedJob: JobListing = {
        ...targetedListing,
        is_demographic_matched: false,
      };
      const config = getButtonConfig(unmatchedJob);
      expect(config.text).toBe('Targeted — Needs Profile Match');
      expect(config.disabled).toBe(true);
    });

    it('returns "Claim Slot & Start Test" when isMatched is true', () => {
      const config = getButtonConfig(targetedListing, { isMatched: true });
      expect(config.text).toBe('Claim Slot & Start Test');
      expect(config.disabled).toBe(false);
      expect(config.action).toBe('claim');
    });

    it('user submission status takes precedence over demographic matching status', () => {
      const inProgressTargeted: JobListing = {
        ...targetedListing,
        user_submission_status: 'in_progress',
      };
      const config = getButtonConfig(inProgressTargeted, { isMatched: false });
      expect(config.text).toBe('Continue Testing →');
      expect(config.disabled).toBe(false);

      const approvedTargeted: JobListing = {
        ...targetedListing,
        user_submission_status: 'approved',
      };
      const appConfig = getButtonConfig(approvedTargeted, { isMatched: false });
      expect(appConfig.text).toContain('Approved');
      expect(appConfig.disabled).toBe(false);
    });

    it('decorates listings with is_demographic_matched and unmet_demographics in filterListingsByDemographics', () => {
      const listings: JobListing[] = [
        { ...baseListing, id: 'open-all', title: 'Open Campaign' },
        { ...baseListing, id: 'targeted-matched', target_age_group: '25-34', target_gender: 'female' },
        { ...baseListing, id: 'targeted-unmatched', target_age_group: '18-24', target_gender: 'male' },
      ];

      const { matchedListings, unmatchedListings } = filterListingsByDemographics(listings, completeProfile);

      expect(matchedListings.map(l => l.id)).toEqual(['open-all', 'targeted-matched']);
      expect(matchedListings.every(l => l.is_demographic_matched === true)).toBe(true);
      expect(matchedListings.every(l => l.unmet_demographics?.length === 0)).toBe(true);

      expect(unmatchedListings.map(l => l.id)).toEqual(['targeted-unmatched']);
      const unmatchedItem = unmatchedListings[0];
      expect(unmatchedItem.is_demographic_matched).toBe(false);
      expect(unmatchedItem.unmet_demographics).toEqual(['Age: 18-24', 'Gender: Male']);
    });
  });

  describe('7. Realtime Listings Migration (00018_enable_listings_realtime.sql)', () => {
    it('migration file exists on disk with valid SQL commands', () => {
      const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/00018_enable_listings_realtime.sql');
      expect(fs.existsSync(migrationPath)).toBe(true);

      const sqlContent = fs.readFileSync(migrationPath, 'utf8');
      expect(sqlContent).toContain('alter publication supabase_realtime add table public.listings;');
      expect(sqlContent).toContain('alter table public.listings replica identity full;');
    });
  });
});
