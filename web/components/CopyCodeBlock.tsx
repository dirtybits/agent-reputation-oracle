"use client";

import { useMemo, useState } from "react";
import hljs from "highlight.js";
import { FiCheck, FiCopy } from "react-icons/fi";

interface CopyCodeBlockProps {
  value: string;
  copyValue?: string;
  copyLabel?: string;
  language?: string;
  className?: string;
}

export function CopyCodeBlock({
  value,
  copyValue,
  copyLabel = "Copy code",
  language,
  className = "",
}: CopyCodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const isMultiline = value.includes("\n");
  const normalizedValue = value.replace(/\n$/, "");
  const highlighted = useMemo(() => {
    if (!language || !hljs.getLanguage(language)) {
      return null;
    }

    return hljs.highlight(normalizedValue, {
      language,
      ignoreIllegals: true,
    }).value;
  }, [language, normalizedValue]);

  const handleCopy = () => {
    navigator.clipboard.writeText(copyValue ?? value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`rounded-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2 flex gap-2 ${
        isMultiline ? "items-start" : "items-center"
      } ${className}`}
    >
      {isMultiline ? (
        <pre className="m-0 min-w-0 flex-1 overflow-x-auto">
          <code
            className="code-block-content hljs block bg-transparent p-0 font-mono text-xs text-gray-700 dark:text-gray-300"
            dangerouslySetInnerHTML={
              highlighted ? { __html: highlighted } : undefined
            }
          >
            {!highlighted ? normalizedValue : undefined}
          </code>
        </pre>
      ) : (
        <code
          className="code-block-content hljs min-w-0 flex-1 overflow-x-auto whitespace-pre font-mono text-xs text-gray-700 dark:text-gray-300 bg-transparent p-0"
          dangerouslySetInnerHTML={
            highlighted ? { __html: highlighted } : undefined
          }
        >
          {!highlighted ? normalizedValue : undefined}
        </code>
      )}
      <button
        type="button"
        onClick={handleCopy}
        className="shrink-0 p-1 rounded text-gray-400 hover:text-[var(--sea-accent)] transition"
        title={copyLabel}
        aria-label={copyLabel}
      >
        {copied ? (
          <FiCheck className="w-3.5 h-3.5 text-[var(--sea-accent)]" />
        ) : (
          <FiCopy className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
}
