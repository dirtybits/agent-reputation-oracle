'use client';

import { Analytics } from '@vercel/analytics/next';

export function VercelAnalytics() {
  return (
    <Analytics
      beforeSend={(event) => {
        try {
          const url = new URL(event.url);
          url.search = '';
          url.hash = '';
          return { ...event, url: url.toString() };
        } catch {
          return event;
        }
      }}
    />
  );
}
