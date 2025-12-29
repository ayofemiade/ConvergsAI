'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { account } from '@/lib/appwrite';

export default function AuthCallback() {
    const router = useRouter();

    useEffect(() => {
        // Appwrite handles the token and session automatically via URL params/cookies
        // We just need to verify the user is now logged in and redirect
        const checkSession = async () => {
            try {
                await account.get();
                router.push('/');
            } catch (error) {
                console.error('Failed to verify session:', error);
                router.push('/');
            }
        };

        checkSession();
    }, [router]);

    return (
        <div className="min-h-screen bg-black flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-blue-400 font-mono text-sm tracking-widest uppercase animate-pulse">
                    Authenticating...
                </p>
            </div>
        </div>
    );
}
