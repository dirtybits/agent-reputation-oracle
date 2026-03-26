"use client";

import { useEffect, useState, useRef } from "react";
import { useWalletConnection } from "@solana/react-hooks";
import {
  ConnectButton,
  usePhantom,
  useAccounts,
  useDisconnect,
} from "@phantom/react-sdk";
import { usePhantomConfigured } from "./WalletContextProvider";
import {
  navButtonInlineClass,
  navButtonPrimaryInlineClass,
  navButtonSecondaryInlineClass,
} from "@/lib/buttonStyles";

const PHANTOM_ICON = "https://phantom.com/_web_platform_assets/favicon.svg";
const walletTriggerClass = navButtonPrimaryInlineClass;
const walletMenuButtonClass = `w-full ${navButtonSecondaryInlineClass} justify-start`;

function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

// Wallet dropdown shared between both variants
function WalletDropdown({
  connectors,
  connect,
  showMenu,
  setShowMenu,
  menuRef,
  socialSection,
}: {
  connectors: readonly any[];
  connect: (id: string) => void;
  showMenu: boolean;
  setShowMenu: (v: boolean) => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
  socialSection?: React.ReactNode;
}) {
  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setShowMenu(!showMenu)}
        className={walletTriggerClass}
      >
        <span>Connect</span>
      </button>
      {showMenu && (
        <div className="absolute right-0 mt-2 w-72 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg z-50 py-1">
          {socialSection}
          {!socialSection && (
            <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Connect a wallet extension or install one below.
              </p>
            </div>
          )}

          {connectors.length > 0 && (
            <div className="px-4 py-2.5">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
                Browser Extension
              </p>
              {connectors.map((connector) => (
                <button
                  key={connector.id}
                  onClick={() => {
                    connect(connector.id);
                    setShowMenu(false);
                  }}
                  className={`${walletMenuButtonClass} flex items-center gap-3`}
                >
                  {connector.icon && (
                    <img
                      src={connector.icon}
                      alt=""
                      className="w-5 h-5 rounded"
                    />
                  )}
                  {connector.name}
                </button>
              ))}
            </div>
          )}

          {connectors.length === 0 && (
            <div className="px-4 py-2.5">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                {isMobile()
                  ? "Or open this page in Phantom:"
                  : "Install a wallet extension to get started:"}
              </p>
              <div className="flex flex-col gap-1.5">
                {isMobile() && (
                  <a
                    href={`https://phantom.app/ul/browse/${encodeURIComponent(
                      typeof window !== "undefined" ? window.location.href : ""
                    )}`}
                    onClick={() => setShowMenu(false)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition text-sm font-semibold text-purple-700 dark:text-purple-300"
                  >
                    <img
                      src={PHANTOM_ICON}
                      alt="Phantom"
                      className="w-4 h-4 rounded"
                    />
                    Open in Phantom
                  </a>
                )}
                <a
                  href="https://phantom.app/download"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowMenu(false)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  <img
                    src={PHANTOM_ICON}
                    alt="Phantom"
                    className="w-4 h-4 rounded"
                  />
                  Get Phantom
                </a>
                <a
                  href="https://www.backpack.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowMenu(false)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  <img
                    src="https://www.backpack.app/favicon.ico"
                    alt="Backpack"
                    className="w-4 h-4 rounded"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  Get Backpack
                </a>
                <a
                  href="https://solflare.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowMenu(false)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  <img
                    src="https://solflare.com/favicon.ico"
                    alt="Solflare"
                    className="w-4 h-4 rounded"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  Get Solflare
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ClientWalletButtonWithPhantom() {
  const [mounted, setMounted] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { connectors, connect, disconnect, wallet, status } =
    useWalletConnection();
  const phantom = usePhantom();
  const phantomAccounts: any[] | null = useAccounts();
  const phantomDisconnect = useDisconnect();

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setShowMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!mounted) {
    return (
      <div
        className={`${navButtonPrimaryInlineClass} opacity-60 pointer-events-none`}
      >
        Loading...
      </div>
    );
  }

  // Extension wallet connected
  if (status === "connected" && wallet) {
    const addr = wallet.account.address;
    const short = `${addr.slice(0, 4)}...${addr.slice(-4)}`;
    return (
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className={`${walletTriggerClass} font-mono`}
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
              className={walletMenuButtonClass}
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  // Phantom embedded wallet connected
  const solanaAccount = phantomAccounts?.find((a: any) => a.chain === "solana");
  if (phantom.isConnected && solanaAccount) {
    const addr = solanaAccount.address as string;
    const short = `${addr.slice(0, 4)}...${addr.slice(-4)}`;
    return (
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className={`${walletTriggerClass} font-mono`}
        >
          {short}
        </button>
        {showMenu && (
          <div className="absolute right-0 mt-2 w-48 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg z-50">
            <div className="px-4 py-2 text-xs text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800">
              Phantom Embedded
            </div>
            <button
              onClick={() => {
                phantomDisconnect.disconnect();
                setShowMenu(false);
              }}
              className={walletMenuButtonClass}
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  const socialSection = (
    <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
        Sign in with
      </p>
      <div className="phantom-connect-wrapper">
        <ConnectButton />
      </div>
    </div>
  );

  return (
    <WalletDropdown
      connectors={connectors}
      connect={connect}
      showMenu={showMenu}
      setShowMenu={setShowMenu}
      menuRef={menuRef}
      socialSection={socialSection}
    />
  );
}

// Version without Phantom SDK hooks — used when PhantomProvider is not mounted
function ClientWalletButtonBasic() {
  const [mounted, setMounted] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { connectors, connect, disconnect, wallet, status } =
    useWalletConnection();

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setShowMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!mounted) {
    return (
      <div
        className={`${navButtonPrimaryInlineClass} opacity-60 pointer-events-none`}
      >
        Loading...
      </div>
    );
  }

  if (status === "connected" && wallet) {
    const addr = wallet.account.address;
    const short = `${addr.slice(0, 4)}...${addr.slice(-4)}`;
    return (
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className={`${walletTriggerClass} font-mono`}
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
              className={walletMenuButtonClass}
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <WalletDropdown
      connectors={connectors}
      connect={connect}
      showMenu={showMenu}
      setShowMenu={setShowMenu}
      menuRef={menuRef}
    />
  );
}

export function ClientWalletButton() {
  const phantomConfigured = usePhantomConfigured();
  if (phantomConfigured) {
    return <ClientWalletButtonWithPhantom />;
  }
  return <ClientWalletButtonBasic />;
}
