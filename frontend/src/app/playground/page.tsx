'use client';

import React, { useState } from 'react';
import PhoneCallUI from '@/components/PhoneCallUI';
import { ArrowLeft, Wand2, RefreshCw, Zap, User } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/components/AuthContext';
import { motion } from 'framer-motion';

// ─── Static Data ──────────────────────────────────────────────────────────────

const MODES = [
    { id: 'sales', name: 'Sales Agent', icon: <Zap size={17} className="text-green-400" /> },
    { id: 'support', name: 'Support Agent', icon: <User size={17} className="text-blue-400" /> },
];

const PRESETS = [
    { mode: 'sales', name: 'Standard Sales', icon: <Zap size={15} />, prompt: "You are Emma, a professional AI sales agent. Qualify leads, ask one question at a time, and try to book a demo." },
    { mode: 'sales', name: 'Aggressive Hunter', icon: <span>🏹</span>, prompt: "You are a high-energy sales hunter. You are calling a busy executive. Get to the point fast. Be assertive. Pitch value immediately. Don't take no for an answer easily." },
    { mode: 'sales', name: 'Technical Engineer', icon: <span>🤓</span>, prompt: "You are a senior solutions engineer. The user is asking technical questions about APIs and webhooks. Give detailed, technical answers but keep them concise." },
    { mode: 'support', name: 'Calm Support', icon: <span>🤝</span>, prompt: "You are a professional customer support agent. Be extremely empathetic, patient, and helpful. Focus on resolving the user's issue and rebuilding trust." },
    { mode: 'support', name: 'Angry De-escalation', icon: <span>😡</span>, prompt: "You are a specialist in de-escalation. The user is VERY ANGRY because they were double charged. Be extremely empathetic, apologize profusely, and try to calm them down." },
    { mode: 'support', name: 'Support Engineer', icon: <span>🛠️</span>, prompt: "You are a technical support engineer. You help developers troubleshoot API integrations. Be precise, helpful, and technical where necessary." },
];

const METADATA_ITEMS = {
    sales: [
        { label: 'Business Type', icon: '🏢' },
        { label: 'Primary Goal', icon: '🎯' },
        { label: 'Timeline', icon: '⏱️' },
        { label: 'Budget Status', icon: '💰' },
    ],
    support: [
        { label: 'Issue Type', icon: '⚠️' },
        { label: 'Account Status', icon: '👤' },
        { label: 'Emotion', icon: '🔥' },
        { label: 'Resolution', icon: '✅' },
    ],
};

// ─── Background ───────────────────────────────────────────────────────────────

const BackgroundAmbience = React.memo(() => (
    <>
        <div className="fixed inset-0 animate-aurora pointer-events-none z-0 opacity-50 will-change-transform" />
        <div className="fixed inset-0 stars pointer-events-none z-0" />
    </>
));
BackgroundAmbience.displayName = 'BackgroundAmbience';

// ─── Phone Hardware Mockup ────────────────────────────────────────────────────
// Extracted as a standalone component so it can be reused in both
// mobile and desktop layouts without code duplication.

interface PhoneMockupProps {
    phoneKey: number;
    systemPrompt: string;
    activeMode: 'sales' | 'support';
    activePreset: number;
    filteredPresets: typeof PRESETS;
    /** inline style height/width for desktop; on mobile we let CSS control sizing */
    style?: React.CSSProperties;
}

const PhoneMockup = React.memo(({
    phoneKey, systemPrompt, activeMode, activePreset, filteredPresets, style
}: PhoneMockupProps) => (
    <div className="relative" style={style}>

        {/* ── HARDWARE FRAME ── */}
        <div
            className="absolute inset-0 rounded-[3.2rem] bg-gradient-to-b from-[#2c2c30] via-[#1c1c20] to-[#111115]"
            style={{ boxShadow: '0 50px 130px -20px rgba(0,0,0,0.95), 0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.13), inset 0 -1px 0 rgba(0,0,0,0.5)' }}
        />
        {/* Frame edge catch lights */}
        <div className="absolute inset-0 rounded-[3.2rem] overflow-hidden pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.04] to-white/[0.09]" />
            <div className="absolute top-0 inset-x-6 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            <div className="absolute bottom-0 inset-x-6 h-[1px] bg-gradient-to-r from-transparent via-black/60 to-transparent" />
        </div>

        {/* ── SIDE BUTTONS ── */}
        {[
            { side: 'left', top: '13%', h: 'h-6', style: { boxShadow: '-1px 0 3px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12)' } },
            { side: 'left', top: '22%', h: 'h-10', style: { boxShadow: '-1px 0 3px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12)' } },
            { side: 'left', top: '32%', h: 'h-10', style: { boxShadow: '-1px 0 3px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12)' } },
            { side: 'right', top: '24%', h: 'h-14', style: { boxShadow: '1px 0 3px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12)' } },
        ].map((btn, i) => (
            <div
                key={i}
                className={`absolute ${btn.side}-0 w-[3px] ${btn.h} bg-gradient-to-b from-[#333338] to-[#222226] ${btn.side === 'left' ? 'rounded-r-sm -translate-x-[3px]' : 'rounded-l-sm translate-x-[3px]'}`}
                style={{ top: btn.top, ...btn.style }}
            />
        ))}

        {/* ── SCREEN BEZEL (8px inset creates the real bezel gap) ── */}
        <div
            className="absolute inset-[8px] rounded-[2.6rem] bg-black overflow-hidden flex flex-col"
            style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05), inset 0 2px 8px rgba(0,0,0,0.8)' }}
        >
            {/* Glass reflections */}
            <div className="absolute inset-0 z-50 pointer-events-none rounded-[2.6rem] overflow-hidden">
                <div className="absolute -top-20 -left-10 w-48 h-48 bg-white/[0.025] rotate-12 blur-sm rounded-full" />
                <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-white/[0.04] to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.012] via-transparent to-transparent" />
            </div>

            {/* Camera pill */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40">
                <div className="h-7 px-4 bg-black rounded-full flex items-center gap-2"
                    style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.06)' }}>
                    <div className="w-2 h-2 rounded-full bg-[#1a1a1a] border border-[#111] flex items-center justify-center">
                        <div className="w-0.5 h-0.5 rounded-full bg-[#2a2a3a]/80" />
                    </div>
                </div>
            </div>

            {/* Ear speaker dots */}
            <div className="absolute top-3.5 z-40 flex gap-[2px] opacity-20" style={{ left: 'calc(50% + 24px)' }}>
                {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="w-[1.5px] h-2.5 bg-white/60 rounded-full" />
                ))}
            </div>

            {/* Home indicator */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-40 w-32 h-[5px] bg-white/25 rounded-full" />

            {/* The actual phone UI */}
            <PhoneCallUI
                key={phoneKey}
                initialPrompt={systemPrompt}
                mode={activeMode}
                persona={activePreset === -1 ? 'Custom' : filteredPresets[activePreset]?.name ?? 'Emma'}
            />
        </div>

        {/* Bottom chin hardware */}
        <div className="absolute bottom-[13px] left-1/2 -translate-x-1/2 flex gap-1 items-center z-10">
            <div className="flex gap-[2.5px]">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="w-[2px] h-[6px] bg-white/15 rounded-full" />
                ))}
            </div>
            <div className="w-10 h-[6px] rounded-full bg-[#111] border border-white/5 mx-2" />
            <div className="flex gap-[2.5px]">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="w-[2px] h-[6px] bg-white/15 rounded-full" />
                ))}
            </div>
        </div>

        {/* Ambient glow beneath phone */}
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-16 bg-blue-600/20 blur-2xl rounded-full pointer-events-none" />
    </div>
));
PhoneMockup.displayName = 'PhoneMockup';

// ─── Shared Sidebar Card Components ──────────────────────────────────────────

const IntelligenceSidebar = ({ activeMode }: { activeMode: 'sales' | 'support' }) => (
    <div className="flex flex-col gap-4">
        <div className="glass-premium p-5 rounded-3xl">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400 font-black text-sm border border-blue-500/30">AI</div>
                <div>
                    <h2 className="font-bold text-xs text-white uppercase tracking-widest">
                        {activeMode === 'sales' ? 'Sales Intelligence' : 'Support Intelligence'}
                    </h2>
                    <p className="text-[10px] text-slate-600 mt-0.5">Live Session Metrics</p>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/[0.03] p-3 rounded-2xl border border-white/5">
                    <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Latency</div>
                    <div className="text-green-400 font-mono text-xs">---</div>
                </div>
                <div className="bg-white/[0.03] p-3 rounded-2xl border border-white/5">
                    <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Sentiment</div>
                    <div className="text-blue-400 font-mono text-xs">Neutral</div>
                </div>
            </div>
        </div>

        <div className="glass-premium p-5 rounded-3xl">
            <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-4">Extracted Metadata</h2>
            <div className="space-y-2.5">
                {METADATA_ITEMS[activeMode].map((item) => (
                    <div key={item.label} className="p-3 rounded-2xl border border-white/5 bg-white/[0.02]">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                            <span>{item.icon}</span> {item.label}
                        </div>
                        <div className="text-[11px] text-slate-600 italic mt-1 pl-5">Listening...</div>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

// ─── Tablet Panel (tabbed right-side panel for md → lg breakpoint) ────────────

interface TabletPanelProps {
    activeMode: 'sales' | 'support';
    activePreset: number;
    filteredPresets: typeof PRESETS;
    systemPrompt: string;
    setSystemPrompt: (v: string) => void;
    setActivePreset: (i: number) => void;
    handleModeSelect: (m: 'sales' | 'support') => void;
    handlePresetSelect: (name: string) => void;
    handleRestart: () => void;
}

const TabletPanel = ({
    activeMode, activePreset, filteredPresets, systemPrompt,
    setSystemPrompt, setActivePreset, handleModeSelect, handlePresetSelect, handleRestart
}: TabletPanelProps) => {
    const [tab, setTab] = useState<'config' | 'intelligence'>('config');

    return (
        <div className="w-[280px] shrink-0 flex flex-col gap-3 overflow-hidden">
            {/* Tab switcher */}
            <div className="flex gap-1 glass-premium p-1 rounded-2xl shrink-0">
                {(['config', 'intelligence'] as const).map(t => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`flex-1 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all duration-200
                            ${tab === t ? 'bg-white/10 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        {t === 'config' ? '⚙ Config' : '📊 Intel'}
                    </button>
                ))}
            </div>

            {/* Tab content — scrollable */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-3">
                {tab === 'config' ? (
                    <>
                        {/* Mode */}
                        <div className="glass-premium p-4 rounded-2xl">
                            <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2 mb-3">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Mode
                            </h2>
                            <div className="grid grid-cols-2 gap-2">
                                {MODES.map(m => (
                                    <button
                                        key={m.id}
                                        onClick={() => handleModeSelect(m.id as any)}
                                        className={`p-3 rounded-xl border transition-all duration-200 flex flex-col items-center gap-2 relative overflow-hidden
                                            ${activeMode === m.id
                                                ? 'bg-blue-600/10 border-blue-500/50 text-white ring-1 ring-blue-500/50'
                                                : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/8'
                                            }`}
                                    >
                                        <div className={`p-1.5 rounded-lg ${activeMode === m.id ? 'bg-blue-600/20' : 'bg-white/5'}`}>{m.icon}</div>
                                        <span className="font-bold text-[10px] uppercase tracking-tight leading-tight text-center">{m.name}</span>
                                        {activeMode === m.id && <motion.div layoutId="tabletModeHL" className="absolute inset-0 bg-blue-500/5" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Persona */}
                        <div className="glass-premium p-4 rounded-2xl">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                    <Wand2 size={11} /> Persona
                                </h2>
                                <button onClick={handleRestart} className="p-1 text-slate-500 hover:text-white transition-colors bg-white/5 rounded-lg border border-white/5">
                                    <RefreshCw size={11} />
                                </button>
                            </div>
                            <div className="space-y-1.5">
                                {filteredPresets.map((p, i) => (
                                    <button
                                        key={p.name}
                                        onClick={() => handlePresetSelect(p.name)}
                                        className={`w-full p-2.5 rounded-xl text-left border flex items-center gap-2.5 transition-all duration-200
                                            ${activePreset === i ? 'bg-white/10 border-white/20' : 'bg-white/5 border-white/5 hover:bg-white/8'}`}
                                    >
                                        <div className="w-6 h-6 rounded-lg bg-black/20 flex items-center justify-center shrink-0 text-sm">{p.icon}</div>
                                        <span className="font-medium text-xs truncate">{p.name}</span>
                                        {activePreset === i && <Zap size={10} className="ml-auto shrink-0 text-blue-400" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* System Prompt */}
                        <div className="glass-premium p-4 rounded-2xl">
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">System Core</label>
                                <span className="text-[9px] bg-white/5 px-2 py-0.5 rounded text-slate-500 font-mono">v3.1</span>
                            </div>
                            <textarea
                                value={systemPrompt}
                                onChange={e => { setSystemPrompt(e.target.value); setActivePreset(-1); }}
                                rows={4}
                                className="w-full bg-slate-950/50 border border-white/10 rounded-xl p-3 text-xs leading-relaxed text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500/50 resize-none font-mono"
                                placeholder="Edit persona behavior..."
                            />
                        </div>
                    </>
                ) : (
                    <IntelligenceSidebar activeMode={activeMode} />
                )}
            </div>
        </div>
    );
};

// ─── Page ─────────────────────────────────────────────────────────────────────


export default function PlaygroundPage() {
    const [activeMode, setActiveMode] = useState<'sales' | 'support'>('sales');
    const filteredPresets = React.useMemo(() => PRESETS.filter(p => p.mode === activeMode), [activeMode]);
    const [systemPrompt, setSystemPrompt] = useState(filteredPresets[0].prompt);
    const [activePreset, setActivePreset] = useState(0);
    const [phoneKey, setPhoneKey] = useState(0);
    const { user, userName, openAuthModal } = useAuth();

    const handleModeSelect = React.useCallback((mode: 'sales' | 'support') => {
        setActiveMode(mode);
        const first = PRESETS.find(p => p.mode === mode);
        if (first) { setSystemPrompt(first.prompt); setActivePreset(0); }
    }, []);

    const handlePresetSelect = React.useCallback((name: string) => {
        const i = filteredPresets.findIndex(p => p.name === name);
        if (i !== -1) { setActivePreset(i); setSystemPrompt(filteredPresets[i].prompt); }
    }, [filteredPresets]);

    const handleRestart = React.useCallback(() => setPhoneKey(k => k + 1), []);

    // CONFIG PANELS — used in both desktop col-1 and mobile accordion
    const ConfigPanels = (
        <>
            {/* Mode Selector */}
            <div className="glass-premium p-5 rounded-3xl">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2 mb-4">
                    <span className="w-2 h-2 rounded-full bg-blue-500" /> Demo Mode
                </h2>
                <div className="grid grid-cols-2 gap-3">
                    {MODES.map(m => (
                        <button
                            key={m.id}
                            onClick={() => handleModeSelect(m.id as any)}
                            className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col items-center gap-2.5 relative overflow-hidden
                                ${activeMode === m.id
                                    ? 'bg-blue-600/10 border-blue-500/50 text-white ring-1 ring-blue-500/50'
                                    : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/8 hover:border-white/10'
                                }`}
                        >
                            <div className={`p-2 rounded-xl ${activeMode === m.id ? 'bg-blue-600/20' : 'bg-white/5'}`}>{m.icon}</div>
                            <span className="font-bold text-xs uppercase tracking-tight">{m.name}</span>
                            {activeMode === m.id && <motion.div layoutId="modeHL" className="absolute inset-0 bg-blue-500/5" />}
                        </button>
                    ))}
                </div>
            </div>

            {/* Presets */}
            <div className="glass-premium p-5 rounded-3xl">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <Wand2 size={13} /> Persona
                    </h2>
                    <button onClick={handleRestart} className="p-1.5 text-slate-400 hover:text-white transition-colors bg-white/5 rounded-lg border border-white/5" title="Restart">
                        <RefreshCw size={13} />
                    </button>
                </div>
                <div className="space-y-2">
                    {filteredPresets.map((p, i) => (
                        <button
                            key={p.name}
                            onClick={() => handlePresetSelect(p.name)}
                            className={`w-full p-3 rounded-xl text-left border flex items-center gap-3 transition-all duration-200
                                ${activePreset === i ? 'bg-white/10 border-white/20 shadow-lg' : 'bg-white/5 border-white/5 hover:bg-white/8'}`}
                        >
                            <div className="w-7 h-7 rounded-lg bg-black/20 flex items-center justify-center shrink-0 text-sm">{p.icon}</div>
                            <span className="font-medium text-sm truncate">{p.name}</span>
                            {activePreset === i && <Zap size={12} className="ml-auto shrink-0 text-blue-400 fill-blue-400/20" />}
                        </button>
                    ))}
                </div>
            </div>

            {/* System Prompt */}
            <div className="glass-premium p-5 rounded-3xl">
                <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">System Core</label>
                    <span className="text-[10px] bg-white/5 px-2 py-1 rounded text-slate-500 font-mono">v3.1</span>
                </div>
                <textarea
                    value={systemPrompt}
                    onChange={e => { setSystemPrompt(e.target.value); setActivePreset(-1); }}
                    rows={5}
                    className="w-full bg-slate-950/50 border border-white/10 rounded-xl p-4 text-sm leading-relaxed text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none font-mono"
                    placeholder="Edit persona behavior..."
                />
            </div>
        </>
    );

    // Shared phone mockup props
    const mockupProps = { phoneKey, systemPrompt, activeMode, activePreset, filteredPresets };

    return (
        <div className="bg-[#020617] text-white font-sans selection:bg-blue-500/30">
            <BackgroundAmbience />

            {/*
            ═══════════════════════════════════════════════
             DESKTOP LAYOUT (lg+)
             Locked viewport, 3-column flex, no page scroll
            ═══════════════════════════════════════════════
            */}
            <div
                className="hidden lg:flex flex-col relative z-10"
                style={{ height: '100dvh' }}
            >
                {/* Header */}
                <header className="shrink-0 flex items-center justify-between gap-6 px-6 pt-4 pb-3">
                    <div className="flex items-center gap-5">
                        <Link href="/" className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors border border-white/5 shrink-0">
                            <ArrowLeft size={16} />
                        </Link>
                        <Link href="/">
                            <div className="w-52 h-14 relative">
                                <Image src="/convergsai logo nb.png" alt="ConvergsAI" fill sizes="208px" className="object-contain" />
                            </div>
                        </Link>
                        <div className="h-7 w-px bg-white/10" />
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">Live Playground</h1>
                            <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Agent Configuration</p>
                        </div>
                    </div>
                    {user ? (
                        <div className="flex items-center gap-3 bg-white/5 border border-white/10 py-2 px-4 rounded-2xl">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-xs shadow-lg">
                                {userName?.[0] || <User size={14} />}
                            </div>
                            <div>
                                <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider leading-none mb-0.5">Authenticated</div>
                                <div className="text-xs font-bold text-white leading-none">{userName}</div>
                            </div>
                        </div>
                    ) : (
                        <button onClick={openAuthModal} className="bg-white text-black py-2.5 px-6 rounded-full font-bold shadow-xl hover:scale-105 transition-transform active:scale-95 text-sm">
                            Sign In
                        </button>
                    )}
                </header>

                {/* 3-Column Body */}
                <div className="flex-1 min-h-0 flex gap-5 px-6 pb-4">
                    {/* Col 1: Config */}
                    <div className="w-[300px] xl:w-[330px] shrink-0 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-1">
                        {ConfigPanels}
                    </div>

                    {/* Col 2: Phone mockup (center, fills remaining space) */}
                    <div className="flex-1 min-w-0 flex items-center justify-center">
                        <PhoneMockup
                            {...mockupProps}
                            style={{
                                height: 'min(calc(100dvh - 100px), 800px)',
                                width: 'min(calc((100dvh - 100px) * 0.488), 390px)',
                                minHeight: '480px',
                                minWidth: '234px',
                            }}
                        />
                    </div>

                    {/* Col 3: Intelligence sidebar */}
                    <div className="w-[270px] xl:w-[310px] shrink-0 overflow-y-auto custom-scrollbar pl-1">
                        <IntelligenceSidebar activeMode={activeMode} />
                    </div>
                </div>
            </div>

            {/*
            ═══════════════════════════════════════════════
             TABLET LAYOUT (md → lg: 768px – 1023px)
             Locked viewport. 2-column: Phone + tabbed panel.
             No page scroll — everything fits within 100dvh.
            ═══════════════════════════════════════════════
            */}
            <div
                className="hidden min-[580px]:flex lg:hidden flex-col relative z-10"
                style={{ height: '100dvh' }}
            >
                {/* Tablet Header */}
                <header className="shrink-0 flex items-center justify-between gap-4 px-5 pt-3 pb-2">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors border border-white/5 shrink-0">
                            <ArrowLeft size={15} />
                        </Link>
                        <Link href="/">
                            <div className="w-40 h-12 relative">
                                <Image src="/convergsai logo nb.png" alt="ConvergsAI" fill sizes="160px" className="object-contain" />
                            </div>
                        </Link>
                        <div className="h-6 w-px bg-white/10" />
                        <div>
                            <h1 className="text-base font-bold tracking-tight">Live Playground</h1>
                            <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Agent Configuration</p>
                        </div>
                    </div>
                    {user ? (
                        <div className="flex items-center gap-2 bg-white/5 border border-white/10 py-1.5 px-3 rounded-2xl">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-xs">
                                {userName?.[0] || <User size={12} />}
                            </div>
                            <span className="text-xs font-semibold text-white">{userName}</span>
                        </div>
                    ) : (
                        <button onClick={openAuthModal} className="bg-white text-black py-2 px-5 rounded-full font-bold text-sm shadow-lg hover:scale-105 transition-transform">
                            Sign In
                        </button>
                    )}
                </header>

                {/* 2-Column Body */}
                <div className="flex-1 min-h-0 flex gap-4 px-5 pb-4">

                    {/* LEFT: Phone mockup — takes ~55% of width */}
                    <div className="flex-1 min-w-0 flex items-center justify-center">
                        <PhoneMockup
                            {...mockupProps}
                            style={{
                                height: 'min(calc(100dvh - 90px), 760px)',
                                width: 'min(calc((100dvh - 90px) * 0.488), 370px)',
                                minHeight: '460px',
                                minWidth: '225px',
                            }}
                        />
                    </div>

                    {/* RIGHT: Tabbed panel — Config or Intelligence, fixed 300px */}
                    <TabletPanel
                        activeMode={activeMode}
                        activePreset={activePreset}
                        filteredPresets={filteredPresets}
                        systemPrompt={systemPrompt}
                        setSystemPrompt={setSystemPrompt}
                        setActivePreset={setActivePreset}
                        handleModeSelect={handleModeSelect}
                        handlePresetSelect={handlePresetSelect}
                        handleRestart={handleRestart}
                    />
                </div>
            </div>

            {/*
            ═══════════════════════════════════════════════
             MOBILE LAYOUT (<md: <768px)
             Normal page scroll. Phone first, then settings.
            ═══════════════════════════════════════════════
            */}
            <div className="min-[580px]:hidden relative z-10 flex flex-col min-h-screen">

                {/* Sticky mobile header */}
                <header className="sticky top-0 z-50 bg-[#020617]/90 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                        <Link href="/" className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/5">
                            <ArrowLeft size={15} />
                        </Link>
                        <div className="w-32 h-10 relative">
                            <Image src="/convergsai logo nb.png" alt="ConvergsAI" fill sizes="128px" className="object-contain" />
                        </div>
                    </div>
                    {user ? (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-xs shadow-lg">
                            {userName?.[0] || <User size={13} />}
                        </div>
                    ) : (
                        <button onClick={openAuthModal} className="bg-white text-black py-2 px-4 rounded-full font-bold text-xs shadow-lg">
                            Sign In
                        </button>
                    )}
                </header>

                {/* 1. PHONE SECTION — fixed height viewport section so it's immediately prominent */}
                <section
                    className="flex items-center justify-center px-8 py-6"
                    style={{ minHeight: 'calc(100svh - 57px)' }}
                >
                    <PhoneMockup
                        {...mockupProps}
                        style={{
                            // On mobile: fill most of the screen height in portrait
                            height: 'min(calc(100svh - 120px), 680px)',
                            width: 'min(calc((100svh - 120px) * 0.488), 320px)',
                            minHeight: '440px',
                            minWidth: '215px',
                        }}
                    />
                </section>

                {/* Scroll cue */}
                <div className="flex flex-col items-center gap-1 pb-6 opacity-40">
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Configure below</span>
                    <div className="w-px h-6 bg-gradient-to-b from-slate-500 to-transparent" />
                </div>

                {/* 2. CONFIGURATION SECTION — scrollable below the phone */}
                <section className="px-4 pb-8 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Agent Configuration</h2>
                        <button onClick={handleRestart} className="ml-auto p-2 text-slate-400 hover:text-white transition-colors bg-white/5 rounded-xl border border-white/5">
                            <RefreshCw size={13} />
                        </button>
                    </div>
                    {ConfigPanels}
                </section>

                {/* 3. INTELLIGENCE SECTION — visible after scrolling past config */}
                <section className="px-4 pb-12 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Session Intelligence</h2>
                    </div>
                    <IntelligenceSidebar activeMode={activeMode} />
                </section>

            </div>
        </div>
    );
}
