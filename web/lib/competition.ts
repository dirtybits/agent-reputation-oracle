export const COMPETITION_TAG = 'competition';

export const COMPETITION_START = new Date('2026-03-11T22:00:00Z'); // Wed 3/11 3:00 PM PDT
export const COMPETITION_END = new Date('2026-03-18T21:59:00Z');   // Wed 3/18 2:59 PM PDT

export const PRIZES = [
  { place: '1st', amount: '1 SOL', color: 'text-yellow-500 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' },
  { place: '2nd', amount: '0.5 SOL', color: 'text-gray-400 dark:text-gray-300', bg: 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700' },
  { place: '3rd', amount: '0.25 SOL', color: 'text-amber-600 dark:text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' },
] as const;

export type CompetitionPhase = 'upcoming' | 'active' | 'ended';

export function getCompetitionPhase(now = new Date()): CompetitionPhase {
  if (now < COMPETITION_START) return 'upcoming';
  if (now <= COMPETITION_END) return 'active';
  return 'ended';
}

export interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

export function getTimeRemaining(target: Date, now = new Date()): TimeRemaining {
  const total = Math.max(0, target.getTime() - now.getTime());
  const seconds = Math.floor((total / 1000) % 60);
  const minutes = Math.floor((total / 1000 / 60) % 60);
  const hours = Math.floor((total / 1000 / 60 / 60) % 24);
  const days = Math.floor(total / 1000 / 60 / 60 / 24);
  return { days, hours, minutes, seconds, total };
}

export function formatDateRange(): string {
  return 'March 11 \u2013 18, 2026';
}
