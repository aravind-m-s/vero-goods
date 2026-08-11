'use client';

import React, { useState } from 'react';
import { Link2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CopyTrackingUrlProps {
  token: string;
}

export function CopyTrackingUrl({ token }: CopyTrackingUrlProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const url = `${window.location.origin}/order/track/${token}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className="flex items-center gap-2 text-xs"
      id="copy-tracking-url-btn"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-500" />
          Copied!
        </>
      ) : (
        <>
          <Link2 className="h-3.5 w-3.5" />
          Copy Tracking Link
        </>
      )}
    </Button>
  );
}
