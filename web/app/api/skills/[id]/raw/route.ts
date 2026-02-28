import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const rows = await sql()`
      SELECT sv.content
      FROM skill_versions sv
      JOIN skills s ON s.id = sv.skill_id
      WHERE s.id = ${id}::uuid
      ORDER BY sv.version DESC
      LIMIT 1
    `;

    if (rows.length === 0) {
      return new NextResponse('Skill not found', { status: 404 });
    }

    await sql()`
      UPDATE skills SET total_installs = total_installs + 1 WHERE id = ${id}::uuid
    `;

    return new NextResponse(rows[0].content, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': 'attachment; filename="SKILL.md"',
      },
    });
  } catch (error: any) {
    console.error('GET /api/skills/[id]/raw error:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
