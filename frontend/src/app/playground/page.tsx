'use client';

import React, { useState } from 'react';
import PhoneCallUI from '@/components/PhoneCallUI';
import { ArrowLeft, Wand2, RefreshCw, Zap, Play, User } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/components/AuthContext';
import { motion } from 'framer-motion';

const MODES = [
    { id: 'sales', name: 'Sales Agent', icon: <Zap size={18} className="text-green-400" />, color: 'green' },
    { id: 'support', name: 'Support Agent', icon: <User size={18} className="text-blue-400" />, color: 'blue' }
];

const PRESETS = [
    {
        mode: 'sales',
        name: "Standard Sales",
        icon: <Zap size={16} />,
        prompt: "You are Emma, a professional AI sales agent. Qualify leads, ask one question at a time, and try to book a demo."
    },
    {
        mode: 'sales',
        name: "Aggressive Hunter",
        icon: <span className="text-orange-400">🏹</span>,
        prompt: "You are a high-energy sales hunter. You are calling a busy executive. Get to the point fast. Be assertive. Pitch value immediately. Don't take no for an answer easily."
    },
    {
        mode: 'sales',
        name: "Technical Engineer",
        icon: <span className="text-blue-400">🤓</span>,
        prompt: "You are a senior solutions engineer. The user is asking technical questions about APIs and webhooks. Give detailed, technical answers but keep them concise. Use jargon correctly."
    },
    {
        mode: 'support',
        name: "Calm Support",
        icon: <span className="text-blue-400">🤝</span>,
        prompt: "You are a professional customer support agent. Be extremely empathetic, patient, and helpful. Focus on resolving the user's issue and rebuilding trust."
    },
    {
        mode: 'support',
        name: "Angry De-escalation",
        icon: <span className="text-red-400">😡</span>,
        prompt: "You are a specialist in de-escalation. The user is VERY ANGRY because they were double charged. Be extremely empathetic, apologize profusely, and try to calm them down. Do not be defensive."
    },
    {
        mode: 'support',
        name: "Support Engineer",
        icon: <span className="text-indigo-400">🛠️</span>,
        prompt: "You are a technical support engineer. You help developers troubleshoot API integrations. Be precise, helpful, and technical where necessary."
    }
];

const BackgroundAmbience = React.memo(() => (
    <>
        <div className="fixed inset-0 animate-aurora pointer-events-none z-0 opacity-50 will-change-transform" />
        <div className="fixed inset-0 stars pointer-events-none z-0" />
    </>
));
BackgroundAmbience.displayName = 'BackgroundAmbience';

export default function PlaygroundPage() {
    const [activeMode, setActiveMode] = useState<'sales' | 'support'>('sales');
    const filteredPresets = React.useMemo(() => PRESETS.filter(p => p.mode === activeMode), [activeMode]);

    const [systemPrompt, setSystemPrompt] = useState(filteredPresets[0].prompt);
    const [activePreset, setActivePreset] = useState(0);
    const [phoneKey, setPhoneKey] = useState(0);
    const { user, userName, openAuthModal } = useAuth();

    const handleModeSelect = React.useCallback((mode: 'sales' | 'support') => {
        setActiveMode(mode);
        const firstOfMode = PRESETS.find(p => p.mode === mode);
        if (firstOfMode) {
            setSystemPrompt(firstOfMode.prompt);
            setActivePreset(0);
        }
    }, []);

    const handlePresetSelect = React.useCallback((presetName: string) => {
        const index = filteredPresets.findIndex(p => p.name === presetName);
        const preset = filteredPresets[index];
        if (preset) {
            setActivePreset(index);
            setSystemPrompt(preset.prompt);
        }
    }, [filteredPresets]);

    const handleRestart = React.useCallback(() => {
        setPhoneKey(prev => prev + 1);
    }, []);

    return (
        <div className="min-h-screen bg-[#020617] text-white font-sans selection:bg-blue-500/30">
            <BackgroundAmbience />

            <div className="relative z-10 max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-12">
                {/* Header */}
                <header className="flex items-center justify-between gap-3 sm:gap-6 mb-8 sm:mb-12">
                    <div className="flex items-center gap-3 sm:gap-6">
                        <div className="flex items-center gap-2 sm:gap-4">
                            <Link href="/" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors border border-white/5">
                                <ArrowLeft size={16} />
                            </Link>
                            <Link href="/">
                                <div className="w-48 h-12 sm:w-64 sm:h-16 md:w-80 md:h-20 relative transition-transform hover:scale-105">
                                    <Image
                                        src="/convergsai logo nb.png"
                                        alt="ConvergsAI Logo"
                                        fill
                                        sizes="(max-width: 640px) 192px, (max-width: 1024px) 256px, 320px"
                                        className="object-contain"
                                    />
                                </div>
                            </Link>
                        </div>
                        <div className="hidden lg:block h-8 w-px bg-white/10" />
                        <div className="hidden sm:block">
                            <h1 className="text-lg sm:text-xl font-bold tracking-tight">Live Playground</h1>
                            <p className="text-[9px] sm:text-[10px] text-slate-500 uppercase tracking-widest font-bold">Agent Configuration</p>
                        </div>
                    </div>

                    {user ? (
                        <div className="flex items-center gap-3 bg-white/5 border border-white/10 py-1.5 px-3 sm:py-2 sm:px-4 rounded-2xl">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold shadow-lg text-xs sm:text-base">
                                {userName?.[0] || <User size={14} />}
                            </div>
                            <div className="block">
                                <div className="text-[8px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none mb-0.5 sm:mb-1">Authenticated</div>
                                <div className="text-xs sm:text-sm font-bold text-white leading-none">{userName}</div>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={openAuthModal}
                            className="bg-white text-black py-2 sm:py-2.5 px-5 sm:px-6 rounded-full font-bold shadow-xl hover:scale-105 transition-transform active:scale-95 flex items-center gap-2 text-sm sm:text-base"
                        >
                            Sign In
                        </button>
                    )}
                </header>

                <div className="grid lg:grid-cols-12 gap-6 sm:gap-8">
                    {/* Controls Column */}
                    <div className="lg:col-span-4 space-y-6">
                        {/* Mode Selector */}
                        <div className="glass-premium p-6 rounded-3xl space-y-4">
                            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500" /> Demo Mode
                            </h2>
                            <div className="grid grid-cols-2 gap-3">
                                {MODES.map((mode) => (
                                    <button
                                        key={mode.id}
                                        onClick={() => handleModeSelect(mode.id as any)}
                                        className={`p-4 rounded-2xl border transition-all duration-300 flex flex-col items-center gap-3 relative overflow-hidden ${activeMode === mode.id
                                            ? 'bg-blue-600/10 border-blue-500/50 text-white ring-1 ring-blue-500/50'
                                            : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10 hover:border-white/10'
                                            }`}
                                    >
                                        <div className={`p-2 rounded-xl ${activeMode === mode.id ? 'bg-blue-600/20' : 'bg-white/5'}`}>
                                            {mode.icon}
                                        </div>
                                        <span className="font-bold text-xs uppercase tracking-tight">{mode.name}</span>
                                        {activeMode === mode.id && (
                                            <motion.div layoutId="modeHighlight" className="absolute inset-0 bg-blue-500/5" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Presets Grid */}
                        <div className="glass-premium p-6 rounded-3xl space-y-4">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                    <Wand2 size={16} /> Persona Configuration
                                </h2>
                                <button
                                    onClick={handleRestart}
                                    className="p-2 text-slate-400 hover:text-white transition-colors bg-white/5 rounded-lg border border-white/5"
                                    title="Restart Session"
                                >
                                    <RefreshCw size={14} />
                                </button>
                            </div>
                            <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
                                {filteredPresets.map((preset, i) => (
                                    <button
                                        key={preset.name}
                                        onClick={() => handlePresetSelect(preset.name)}
                                        className={`p-3 sm:p-4 rounded-xl text-left border transition-all duration-200 flex flex-col sm:flex-row items-center sm:items-center gap-2 sm:gap-3 ${activePreset === i
                                            ? 'bg-white/10 border-white/20 shadow-lg'
                                            : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
                                            }`}
                                    >
                                        <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-black/20 flex items-center justify-center shrink-0">
                                            {preset.icon}
                                        </div>
                                        <span className="font-medium text-[10px] sm:text-sm text-center sm:text-left truncate w-full">{preset.name}</span>
                                        {activePreset === i && <Zap size={12} className="hidden sm:block ml-auto text-blue-400 fill-blue-400/20" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Custom Prompt Editor - Foldable or Simplified */}
                        <div className="glass-premium p-6 rounded-3xl space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-bold text-slate-500 uppercase tracking-wider block">
                                    System Core
                                </label>
                                <span className="text-[10px] bg-white/5 px-2 py-1 rounded text-slate-500 font-mono">v3.1</span>
                            </div>
                            <textarea
                                value={systemPrompt}
                                onChange={(e) => {
                                    setSystemPrompt(e.target.value);
                                    setActivePreset(-1);
                                }}
                                className="w-full h-40 bg-slate-950/50 border border-white/10 rounded-xl p-4 text-sm leading-relaxed text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono"
                                placeholder="Edit persona behavior..."
                            />
                        </div>
                    </div>

                    {/* Preview Column */}
                    <div className="lg:col-span-8">
                        <div className="relative">

                            {/* Phone Rendering */}
                            <div className="glass-premium p-0.5 sm:p-1 rounded-[2rem] sm:rounded-[2.5rem] bg-slate-900/80 backdrop-blur-xl ring-1 ring-white/10 shadow-2xl">
                                <div className="rounded-[1.8rem] sm:rounded-[2rem] overflow-hidden bg-black border border-white/5 min-h-[500px] sm:min-h-[600px] relative">
                                    <PhoneCallUI
                                        key={phoneKey}
                                        initialPrompt={systemPrompt}
                                        mode={activeMode}
                                        persona={activePreset === -1 ? 'Custom' : filteredPresets[activePreset].name}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
