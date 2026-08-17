'use client';

import { useEffect } from 'react';
import Clarity from '@microsoft/clarity';

const projectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID || 'YOUR_PROJECT_ID';

export default function ClarityAnalytics() {
    useEffect(() => {
        if (projectId && process.env.NODE_ENV === 'production') {
            Clarity.init(projectId);
        }
    }, []);

    return null;
}