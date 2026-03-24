import { VouchStatus } from '@/generated/reputation-oracle/src/generated';

export function isClaimableVouchStatus(
  status: VouchStatus | number | null | undefined,
): boolean {
  return status === VouchStatus.Active;
}

export function getVouchStatusLabel(
  status: VouchStatus | number | null | undefined,
): string {
  switch (status) {
    case VouchStatus.Active:
      return 'Active';
    case VouchStatus.Revoked:
      return 'Revoked';
    case VouchStatus.Disputed:
      return 'In dispute';
    case VouchStatus.Slashed:
      return 'Slashed';
    case VouchStatus.Vindicated:
      return 'Vindicated';
    default:
      return 'Unknown';
  }
}
