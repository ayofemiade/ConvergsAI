'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, Lock, ArrowRight, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useAuth } from './AuthContext';

export default function AuthModal() {
    const { isAuthModalOpen, closeAuthModal, loginWithGoogle } = useAuth();
    const [isConnecting, setIsConnecting] = useState(false);

    // Disable scroll when modal is open
    useEffect(() => {
        if (isAuthModalOpen) {
            // Lock scrolling on both body and html for total mobile compatibility
            document.documentElement.style.overflow = 'hidden';
            document.body.style.overflow = 'hidden';
            // Prevent touch scrolling on mobile
            document.body.style.touchAction = 'none';
        } else {
            document.documentElement.style.overflow = 'unset';
            document.body.style.overflow = 'unset';
            document.body.style.touchAction = 'unset';
        }

        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeAuthModal();
        };
        window.addEventListener('keydown', handleEsc);

        return () => {
            document.documentElement.style.overflow = 'unset';
            document.body.style.overflow = 'unset';
            document.body.style.touchAction = 'unset';
            window.removeEventListener('keydown', handleEsc);
        };
    }, [isAuthModalOpen, closeAuthModal]);

    const handleGoogleLogin = async () => {
        setIsConnecting(true);
        await loginWithGoogle();
        // The redirect happens, so we don't necessarily need to set isConnecting(false) 
        // unless there's an error, but loginWithGoogle redirects.
    };

    return (
        <AnimatePresence>
            {isAuthModalOpen && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={closeAuthModal}
                        className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="relative w-full max-w-md glass-premium rounded-[2.5rem] overflow-hidden border-white/10 shadow-2xl flex flex-col bg-[#0B1120]/90"
                    >
                        {/* Static Particles Background for Modal */}
                        <div className="absolute inset-0 pointer-events-none opacity-20 overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.3)_0%,transparent_70%)]" />
                            <div className="stars absolute inset-0" />
                        </div>

                        {/* Close Button */}
                        <button
                            onClick={(e) => { e.stopPropagation(); closeAuthModal(); }}
                            className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 text-slate-400 hover:text-white transition-all z-[60] backdrop-blur-md border border-white/10 shadow-lg"
                        >
                            <X size={20} />
                        </button>

                        <div className="relative z-10 p-8 md:p-12 flex flex-col items-center text-center">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.2, type: "spring" }}
                                className="w-64 h-16 sm:w-72 sm:h-18 relative mb-12"
                            >
                                <Image
                                    src="/convergsai logo nb.png"
                                    alt="ConvergsAI Logo"
                                    fill
                                    sizes="288px"
                                    className="object-contain"
                                />
                            </motion.div>

                            <h2 className="text-3xl font-bold tracking-tight text-white mb-3">
                                Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">ConvergsAI</span>
                            </h2>
                            <p className="text-slate-400 text-sm md:text-base leading-relaxed mb-10 max-w-[280px]">
                                Start scaling your sales pipeline in minutes.
                            </p>

                            {/* Main Google Button */}
                            <button
                                onClick={handleGoogleLogin}
                                disabled={isConnecting}
                                className="w-full relative group"
                            >
                                <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full blur opacity-30 group-hover:opacity-60 transition duration-500" />
                                <div className="relative flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-black py-4 px-6 rounded-full font-bold transition-all w-full shadow-xl">
                                    {isConnecting ? (
                                        <Loader2 className="animate-spin" size={20} />
                                    ) : (
                                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                                            <path
                                                fill="currentColor"
                                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                            />
                                            <path
                                                fill="currentColor"
                                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                            />
                                            <path
                                                fill="currentColor"
                                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                                            />
                                            <path
                                                fill="currentColor"
                                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                            />
                                        </svg>
                                    )}
                                    <span>{isConnecting ? 'Opening Secure Portal...' : 'Continue with Google'}</span>
                                </div>
                            </button>

                            {/* Microcopy */}
                            <div className="mt-6 flex flex-col gap-2">
                                <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">
                                    No passwords required • Secure OAuth sign-in
                                </span>
                            </div>

                            {/* Trust Signals Footer */}
                            <div className="mt-12 pt-8 border-t border-white/5 w-full space-y-4">
                                <div className="flex items-center justify-center gap-2 text-slate-500">
                                    <Shield size={12} />
                                    <span className="text-[10px] font-medium uppercase tracking-wider">
                                        Secure authentication powered by industry-standard OAuth
                                    </span>
                                </div>
                                <div className="flex justify-center gap-6 text-[10px] font-bold text-slate-400">
                                    <a href="#" className="hover:text-blue-400 transition-colors uppercase tracking-widest">Privacy Policy</a>
                                    <a href="#" className="hover:text-blue-400 transition-colors uppercase tracking-widest">Terms of Service</a>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
