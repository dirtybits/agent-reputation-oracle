export const navButtonSizeClass = 'px-3 py-1.5 text-sm rounded-lg';

export const navButtonInlineClass = `inline-flex items-center justify-center gap-2 ${navButtonSizeClass}`;

export const navButtonFlexClass = `flex items-center justify-center gap-2 ${navButtonSizeClass}`;

const lobsterButtonBaseClass =
  'transition disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed';

export const navButtonPrimaryInlineClass = `${navButtonInlineClass} font-semibold bg-[var(--lobster-accent)] text-white hover:bg-[var(--lobster-accent-strong)] ${lobsterButtonBaseClass}`;

export const navButtonPrimaryFlexClass = `${navButtonFlexClass} font-semibold bg-[var(--lobster-accent)] text-white hover:bg-[var(--lobster-accent-strong)] ${lobsterButtonBaseClass}`;

export const navButtonSecondaryInlineClass = `${navButtonInlineClass} font-semibold bg-[var(--lobster-accent-soft)] text-[var(--lobster-accent-strong)] border border-[var(--lobster-accent-border)] hover:bg-[var(--lobster-accent-soft-hover)] transition`;

export const navButtonSecondaryFlexClass = `${navButtonFlexClass} font-semibold bg-[var(--lobster-accent-soft)] text-[var(--lobster-accent-strong)] border border-[var(--lobster-accent-border)] hover:bg-[var(--lobster-accent-soft-hover)] transition`;

export const navPillActiveClass =
  'bg-[var(--lobster-accent-soft)] text-[var(--lobster-accent-strong)] border border-[var(--lobster-accent-border)]';

export const navPillIdleClass =
  'text-gray-600 dark:text-gray-400 hover:text-[var(--lobster-accent)] hover:bg-[var(--lobster-accent-soft)]';
