'use client';

import React from 'react';
import { IntroProvider, useIntro } from './IntroContext';
import { AuthProvider } from './AuthContext';
import dynamic from 'next/dynamic';
import { AnimatePresence } from 'framer-motion';

const CinematicIntro = dynamic(() => import('./CinematicIntro'), { ssr: false });

function IntroContainer() {
    const { showIntro, setShowIntro } = useIntro();

    return (
        <AnimatePresence>
            {showIntro && (
                <CinematicIntro onComplete={() => {
                    setShowIntro(false);
                    window.scrollTo(0, 0);
                }} />
            )}
        </AnimatePresence>
    );
}

function MainContent({ children }: { children: React.ReactNode }) {
    const { showIntro, isChecking } = useIntro();

    // Hide content if we're still checking session or if the intro is actually playing
    const hideContent = isChecking || showIntro;

    return (
        <>
            <div
                className="transition-opacity duration-1000"
                style={{
                    opacity: hideContent ? 0 : 1,
                    visibility: hideContent ? 'hidden' : 'visible'
                }}
            >
                {children}
            </div>
            {hideContent && <div className="fixed inset-0 bg-black z-[-1]" />}
        </>
    );
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <IntroProvider>
                <IntroContainer />
                <MainContent>
                    {children}
                </MainContent>
            </IntroProvider>
        </AuthProvider>
    );
}
