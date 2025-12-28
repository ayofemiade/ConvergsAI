'use client';

import React, { useState } from 'react';
import PhoneCallUI from '@/components/PhoneCallUI';
import { ArrowLeft, Wand2, RefreshCw, Zap, Play } from 'lucide-react';
import Link from 'next/link';

const PRESETS = [
    {
        name: "Standard Sales",
        icon: <Zap size={16} />,
        prompt: "You are Emma, a professional AI sales agent. Qualify leads, ask one question at a time, and try to book a demo."
    },
    {
        name: "Angry Customer Support",
        icon: <span className="text-red-400">😡</span>,
        prompt: "You are a support agent. The user is VERY ANGRY because they were double charged. Be extremely empathetic, apologize profusely, and try to calm them down. Do not be defensive."
    },
    {
        name: "Aggressive Hunter",
        icon: <span className="text-orange-400">🏹</span>,
        prompt: "You are a high-energy sales hunter. You are calling a busy executive. Get to the point fast. Be assertive. Pitch value immediately. Don't take no for an answer easily."
    },
    {
        name: "Technical Engineer",
        icon: <span className="text-blue-400">🤓</span>,
        prompt: "You are a senior solutions engineer. The user is asking technical questions about APIs and webhooks. Give detailed, technical answers but keep them concise. Use jargon correctly."
    }
];

export default function PlaygroundPage() {
    const [systemPrompt, setSystemPrompt] = useState(PRESETS[0].prompt);
    const [activePreset, setActivePreset] = useState(0);
    const [phoneKey, setPhoneKey] = useState(0); // Used to reset the phone component

    const handlePresetSelect = (index: number) => {
        setActivePreset(index);
        setSystemPrompt(PRESETS[index].prompt);
    };

    const handleRestart = () => {
        setPhoneKey(prev => prev + 1);
    };

    return (
        <div className="min-h-screen bg-[#020617] text-white font-sans selection:bg-blue-500/30">
            {/* Background Ambience */}
            <div className="fixed inset-0 animate-aurora pointer-events-none z-0 opacity-50" />
            <div className="fixed inset-0 stars pointer-events-none z-0" />

            <div className="relative z-10 max-w-7xl mx-auto px-6 py-12">
                {/* Header */}
                <header className="flex items-center justify-between mb-12">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors border border-white/5">
                            <ArrowLeft size={20} />
                        </Link>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Live Playground</h1>
                            <p className="text-slate-400">Test the AI with custom personalities</p>
                        </div>
                    </div>
                </header>

                <div className="grid lg:grid-cols-12 gap-8">
                    {/* Controls Column */}
                    <div className="lg:col-span-4 space-y-6">
                        {/* Presets Grid */}
                        <div className="glass-premium p-6 rounded-3xl space-y-4">
                            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                <Wand2 size={16} /> Quick Presets
                            </h2>
                            <div className="grid grid-cols-1 gap-2">
                                {PRESETS.map((preset, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handlePresetSelect(i)}
                                        className={`p-4 rounded-xl text-left border transition-all duration-200 flex items-center gap-3 ${activePreset === i
                                                ? 'bg-blue-600 border-blue-500 shadow-lg shadow-blue-900/20'
                                                : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
                                            }`}
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-black/20 flex items-center justify-center">
                                            {preset.icon}
                                        </div>
                                        <span className="font-medium text-sm">{preset.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Custom Prompt Editor */}
                        <div className="glass-premium p-6 rounded-3xl space-y-4">
                            <label className="text-sm font-bold text-slate-500 uppercase tracking-wider block">
                                System Instruction
                            </label>
                            <textarea
                                value={systemPrompt}
                                onChange={(e) => {
                                    setSystemPrompt(e.target.value);
                                    setActivePreset(-1); // Deselect preset if modified
                                }}
                                className="w-full h-48 bg-slate-950/50 border border-white/10 rounded-xl p-4 text-sm leading-relaxed text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono"
                                placeholder="Describe how the AI should behave..."
                            />
                            <div className="text-xs text-slate-500">
                                This prompt resets the AI's personality. Click "Restart Session" to apply.
                            </div>
                        </div>
                    </div>

                    {/* Preview Column */}
                    <div className="lg:col-span-8">
                        <div className="relative">
                            {/* Toolbar */}
                            <div className="absolute top-0 right-0 z-20 p-4">
                                <button
                                    onClick={handleRestart}
                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold rounded-lg border border-white/10 flex items-center gap-2 transition-all shadow-lg active:scale-95"
                                >
                                    <RefreshCw size={14} /> Restart Session
                                </button>
                            </div>

                            {/* Phone Rendering */}
                            <div className="glass-premium p-1 rounded-[2.5rem] bg-slate-900/80 backdrop-blur-xl ring-1 ring-white/10 shadow-2xl">
                                <div className="rounded-[2rem] overflow-hidden bg-[#020617] border border-white/5 min-h-[600px] relative">
                                    <PhoneCallUI
                                        key={phoneKey}
                                        initialPrompt={systemPrompt}
                                    />
                                </div>
                            </div>

                            <div className="mt-6 text-center text-slate-500 text-sm">
                                Changes to the prompt apply when you start a new call.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
