import { describe, expect, it } from 'vitest';

import {
  getAuthorDisputeReasonLabel,
  getAuthorDisputeRulingLabel,
  getAuthorDisputeStatusLabel,
} from '@/lib/authorDisputes';
import {
  AuthorDisputeReason,
  AuthorDisputeRuling,
  AuthorDisputeStatus,
} from '@/generated/reputation-oracle/src/generated';

describe('author dispute helpers', () => {
  it('formats author dispute reasons for UI', () => {
    expect(getAuthorDisputeReasonLabel(AuthorDisputeReason.MaliciousSkill)).toBe('Malicious skill');
    expect(getAuthorDisputeReasonLabel(AuthorDisputeReason.FraudulentClaims)).toBe('Fraudulent claims');
    expect(getAuthorDisputeReasonLabel(AuthorDisputeReason.FailedDelivery)).toBe('Failed delivery');
    expect(getAuthorDisputeReasonLabel(AuthorDisputeReason.Other)).toBe('Other');
  });

  it('formats author dispute statuses and rulings', () => {
    expect(getAuthorDisputeStatusLabel(AuthorDisputeStatus.Open)).toBe('Open');
    expect(getAuthorDisputeStatusLabel(AuthorDisputeStatus.Resolved)).toBe('Resolved');
    expect(getAuthorDisputeRulingLabel(AuthorDisputeRuling.Upheld)).toBe('Upheld');
    expect(getAuthorDisputeRulingLabel(AuthorDisputeRuling.Dismissed)).toBe('Dismissed');
    expect(getAuthorDisputeRulingLabel(null)).toBeNull();
  });
});
