import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

describe('author page source', () => {
  it('removes manual voucher-selection copy from the report flow', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'app/author/[pubkey]/page.tsx'),
      'utf8',
    );

    expect(source).not.toContain('Link backing vouchers');
    expect(source).not.toContain('Link to report');
    expect(source).toContain('Author-wide backing snapshot');
    expect(source).toContain('full current backing set automatically');
  });
});
