'use client';

import { useEffect, useState } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export function ClientWalletButton() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="wallet-adapter-button wallet-adapter-button-trigger" style={{ pointerEvents: 'none', opacity: 0.6 }}>
        <span>Loading...</span>
      </div>
    );
  }

  return <WalletMultiButton />;
}
