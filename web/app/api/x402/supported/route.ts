import { NextResponse } from 'next/server';

const SOL_NATIVE_MINT = 'So11111111111111111111111111111111111111112';

export async function GET() {
  return NextResponse.json({
    schemes: ['exact'],
    networks: ['solana'],
    mints: [
      {
        address: SOL_NATIVE_MINT,
        symbol: 'SOL',
        decimals: 9,
        name: 'Wrapped SOL',
      },
    ],
    facilitator_endpoints: {
      verify: '/api/x402/verify',
      settle: '/api/x402/settle',
      supported: '/api/x402/supported',
    },
    version: '2.0.0',
  });
}
