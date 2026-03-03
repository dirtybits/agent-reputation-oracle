'use client';

import { useEffect, useState, useRef } from 'react';
import { useWalletConnection } from '@solana/react-hooks';

export function ClientWalletButton() {
  const [mounted, setMounted] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { connectors, connect, disconnect, wallet, status } = useWalletConnection();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!mounted) {
    return (
      <div
        className="px-5 py-2.5 rounded-lg font-semibold text-sm bg-gray-900 dark:bg-white text-white dark:text-gray-900 opacity-60 pointer-events-none"
      >
        Loading...
      </div>
    );
  }

  const connected = status === 'connected' && wallet;

  if (connected) {
    const addr = wallet.account.address;
    const short = `${addr.slice(0, 4)}...${addr.slice(-4)}`;
    return (
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="px-5 py-2.5 rounded-lg font-semibold text-sm bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition font-mono"
        >
          {short}
        </button>
        {showMenu && (
          <div className="absolute right-0 mt-2 w-48 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg z-50">
            <button
              onClick={() => {
                disconnect();
                setShowMenu(false);
              }}
              className="w-full px-4 py-2.5 text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="px-5 py-2.5 rounded-lg font-semibold text-sm bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition"
      >
        Connect Wallet
      </button>
      {showMenu && connectors.length > 0 && (
        <div className="absolute right-0 mt-2 w-56 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg z-50 py-1">
          {connectors.map((connector) => (
            <button
              key={connector.id}
              onClick={() => {
                connect(connector.id);
                setShowMenu(false);
              }}
              className="w-full px-4 py-2.5 text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition flex items-center gap-3"
            >
              {connector.icon && (
                <img src={connector.icon} alt="" className="w-5 h-5 rounded" />
              )}
              {connector.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
