import { describe, expect, it } from 'vitest';

import { VouchStatus } from '@/generated/reputation-oracle/src/generated';
import {
  countsTowardAuthorWideReportSnapshot,
  getVouchStatusLabel,
  isClaimableVouchStatus,
} from '@/lib/disputes';

describe('dispute helpers', () => {
  it('only allows claims against active backing vouches', () => {
    expect(isClaimableVouchStatus(VouchStatus.Active)).toBe(true);
    expect(isClaimableVouchStatus(VouchStatus.Revoked)).toBe(false);
    expect(isClaimableVouchStatus(VouchStatus.Disputed)).toBe(false);
    expect(isClaimableVouchStatus(VouchStatus.Slashed)).toBe(false);
    expect(isClaimableVouchStatus(VouchStatus.Vindicated)).toBe(false);
  });

  it('formats vouch statuses for UI display', () => {
    expect(getVouchStatusLabel(VouchStatus.Active)).toBe('Active');
    expect(getVouchStatusLabel(VouchStatus.Revoked)).toBe('Revoked');
    expect(getVouchStatusLabel(VouchStatus.Disputed)).toBe('In dispute');
    expect(getVouchStatusLabel(VouchStatus.Slashed)).toBe('Slashed');
    expect(getVouchStatusLabel(VouchStatus.Vindicated)).toBe('Vindicated');
  });

  it('matches the author-wide report snapshot statuses used on-chain', () => {
    expect(countsTowardAuthorWideReportSnapshot(VouchStatus.Active)).toBe(true);
    expect(countsTowardAuthorWideReportSnapshot(VouchStatus.Disputed)).toBe(true);
    expect(countsTowardAuthorWideReportSnapshot(VouchStatus.Vindicated)).toBe(true);
    expect(countsTowardAuthorWideReportSnapshot(VouchStatus.Revoked)).toBe(false);
    expect(countsTowardAuthorWideReportSnapshot(VouchStatus.Slashed)).toBe(false);
  });
});
