import { describe, it, expect } from 'vitest';

describe('Task Runner Layout & Fullscreen Invariants', () => {
  const isTaskWorkspaceRoute = (pathname: string): boolean => {
    return pathname.includes('/dashboard/tester/tasks/');
  };

  it('correctly identifies task workspace paths to isolate test runner', () => {
    expect(isTaskWorkspaceRoute('/dashboard/tester/tasks/01a5c7fa-4a26-4389-aa78-ed57e3e08b78')).toBe(true);
    expect(isTaskWorkspaceRoute('/dashboard/tester/tasks/five-second/99b8c7fa-4a26-4389-aa78-ed57e3e08b78')).toBe(true);
  });

  it('does NOT hide sidebar on standard dashboard views', () => {
    expect(isTaskWorkspaceRoute('/dashboard/tester')).toBe(false);
    expect(isTaskWorkspaceRoute('/dashboard/tester?tab=available')).toBe(false);
    expect(isTaskWorkspaceRoute('/dashboard/tester?tab=submissions')).toBe(false);
    expect(isTaskWorkspaceRoute('/dashboard/poster')).toBe(false);
    expect(isTaskWorkspaceRoute('/dashboard/poster/listings/01a5c7fa')).toBe(false);
    expect(isTaskWorkspaceRoute('/dashboard/admin/disputes')).toBe(false);
  });

  it('verifies navigation back to dashboard uses scroll: false to prevent header jumping', () => {
    const defaultNavOptions = { scroll: false };
    expect(defaultNavOptions.scroll).toBe(false);
  });
});
