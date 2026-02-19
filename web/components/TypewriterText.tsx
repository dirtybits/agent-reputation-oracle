'use client';

import { ElementType } from 'react';

interface TypewriterTextProps {
  text: string;
  className?: string;
  as?: ElementType;
}

export default function TypewriterText({
  text,
  className = '',
  as: Tag = 'span',
}: TypewriterTextProps) {
  return (
    <Tag className={`typewriter ${className}`}>
      {text}
    </Tag>
  );
}
