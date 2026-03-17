'use client';

import { useState } from 'react';
import { FiCheck, FiCopy } from 'react-icons/fi';

interface CopyCodeBlockProps {
  value: string;
  copyValue?: string;
  copyLabel?: string;
  className?: string;
}

export function CopyCodeBlock({
  value,
  copyValue,
  copyLabel = 'Copy code',
  className = '',
}: CopyCodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const isMultiline = value.includes('\n');

  const handleCopy = () => {
    navigator.clipboard.writeText(copyValue ?? value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2 flex gap-2 ${
        isMultiline ? 'items-start' : 'items-center'
      } ${className}`}
    >
      {isMultiline ? (
        <pre className="m-0 min-w-0 flex-1 overflow-x-auto">
          <code className="font-mono text-xs text-gray-700 dark:text-gray-300">{value}</code>
        </pre>
      ) : (
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-xs text-gray-700 dark:text-gray-300">
          {value}
        </code>
      )}
      <button
        type="button"
        onClick={handleCopy}
        className="shrink-0 p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
        title={copyLabel}
        aria-label={copyLabel}
      >
        {copied ? <FiCheck className="w-3.5 h-3.5 text-green-500" /> : <FiCopy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}
