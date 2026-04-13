'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Phone, PhoneOff, Send, Bot, Sparkles,
    CheckCircle2, Wifi, SignalHigh, Globe
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { v4 as uuidv4 } from 'uuid';
import {
    Room,
    RoomEvent,
    Track,
    RemoteTrack,
    Participant,
} from 'livekit-client';
import '@livekit/components-styles';

// ─── Types ────────────────────────────────────────────────────────────────────

type CallState = 'idle' | 'ringing' | 'connected' | 'ended';
type AgentState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

interface PhoneCallUIProps {
    initialPrompt?: string;
    onCallStart?: () => void;
    mode?: 'sales' | 'support';
    persona?: string;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** iOS-style status bar */
const StatusBar = React.memo(() => (
    <div className="shrink-0 h-12 flex items-center justify-between px-6 text-white/90 relative z-30">
        <span className="text-[11px] font-black tracking-tighter flex items-center gap-1.5">
            9:41
            <motion.span
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block"
            />
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-2 opacity-60">
            <SignalHigh size={13} strokeWidth={2.5} />
            <Wifi size={13} strokeWidth={2.5} />
            <div className="flex items-center gap-0.5">
                <div className="w-[18px] h-[9px] rounded-[3px] border border-white/40 p-[1.5px] flex items-center">
                    <div className="h-full w-[85%] bg-white rounded-[1px]" />
                </div>
                <div className="w-[2px] h-[4px] bg-white/40 rounded-r-full" />
            </div>
        </div>
    </div>
));
StatusBar.displayName = 'StatusBar';

/** Dynamic Island pill */
const DynamicIsland = React.memo(({ callState, agentState }: { callState: CallState; agentState: AgentState }) => (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50">
        <motion.div
            layout
            animate={{
                width: agentState === 'speaking' ? 200 : agentState === 'thinking' ? 160 : callState === 'connected' ? 110 : 140,
                height: 34,
            }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="bg-black border border-white/15 shadow-2xl rounded-full flex items-center justify-center gap-2.5 px-4 overflow-hidden"
        >
            <AnimatePresence mode="wait">
                {callState === 'connected' ? (
                    <motion.div
                        key={agentState}
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.85 }}
                        className="flex items-center gap-2 whitespace-nowrap"
                    >
                        {agentState === 'speaking' && (
                            <>
                                <div className="flex gap-[2px] h-3 items-center">
                                    {[0.1, 0.35, 0.2, 0.45, 0.25].map((d, i) => (
                                        <motion.div
                                            key={i}
                                            animate={{ height: [2, 12, 2] }}
                                            transition={{ duration: 0.55, repeat: Infinity, delay: d }}
                                            className="w-[2px] bg-green-400 rounded-full"
                                        />
                                    ))}
                                </div>
                                <span className="text-[9px] font-black text-white uppercase tracking-widest">Emma Speaking</span>
                            </>
                        )}
                        {agentState === 'thinking' && (
                            <>
                                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}>
                                    <Sparkles size={11} className="text-purple-400" />
                                </motion.div>
                                <span className="text-[9px] font-black text-slate-300 uppercase tracking-wider">Analyzing</span>
                            </>
                        )}
                        {agentState === 'listening' && (
                            <>
                                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse shadow-[0_0_10px_rgba(96,165,250,0.8)]" />
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Live Agent</span>
                            </>
                        )}
                    </motion.div>
                ) : (
                    <motion.div key="idle" className="flex items-center gap-2 opacity-70">
                        <Globe size={10} className="text-white" />
                        <span className="text-[9px] font-black text-white uppercase tracking-[0.4em]">ConvergsAI</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    </div>
));
DynamicIsland.displayName = 'DynamicIsland';

/** Single message bubble */
const MessageBubble = React.memo(({ msg }: { msg: Message }) => (
    <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2 }}
        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
    >
        <div className={`
            max-w-[82%] px-4 py-3 rounded-[18px] text-[13px] font-medium leading-[1.45] shadow-sm
            ${msg.role === 'user'
                ? 'bg-blue-600 text-white rounded-br-[4px]'
                : 'bg-white/8 text-slate-100 rounded-bl-[4px] border border-white/10 backdrop-blur-sm'
            }
        `}>
            {msg.content}
        </div>
    </motion.div>
));
MessageBubble.displayName = 'MessageBubble';

/** Ambient glow behind chat */
const ChatAura = React.memo(() => (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
            animate={{ scale: [1, 1.1, 1], opacity: [0.05, 0.1, 0.05] }}
            transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
            className="absolute top-[-20%] right-[-10%] w-[55%] h-[55%] bg-blue-500 blur-[70px] rounded-full"
        />
        <motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.03, 0.07, 0.03] }}
            transition={{ duration: 22, repeat: Infinity, ease: 'linear', delay: 3 }}
            className="absolute bottom-[-10%] left-[-15%] w-[50%] h-[50%] bg-indigo-600 blur-[60px] rounded-full"
        />
    </div>
));
ChatAura.displayName = 'ChatAura';

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PhoneCallUI({
    initialPrompt,
    onCallStart,
    mode = 'sales',
    persona = 'Emma',
}: PhoneCallUIProps = {}) {

    const [callState, setCallState] = useState<CallState>('idle');
    const [agentState, setAgentState] = useState<AgentState>('idle');
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [liveTranscript, setLiveTranscript] = useState<{ text: string; role: 'user' | 'assistant' } | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);
    const roomRef = useRef<Room | null>(null);
    const liveTranscriptTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // ── Scroll to bottom whenever messages or transcript change ──────────────
    // With flex-col-reverse, scrollTop=0 IS the bottom. Force it every update.
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = 0;
        }
    }, [messages, liveTranscript]);

    // ── Cleanup on unmount ───────────────────────────────────────────────────
    const cleanup = React.useCallback(() => {
        if (roomRef.current) {
            roomRef.current.disconnect();
            roomRef.current = null;
        }
        if (liveTranscriptTimeoutRef.current) {
            clearTimeout(liveTranscriptTimeoutRef.current);
        }
    }, []);

    useEffect(() => () => cleanup(), [cleanup]);

    // ── Start Call ───────────────────────────────────────────────────────────
    const startCall = React.useCallback(async () => {
        setCallState('ringing');
        try {
            if (onCallStart) onCallStart();

            const { session_id } = await apiClient.createSession(initialPrompt);
            const { token, serverUrl } = await apiClient.getLiveKitToken(session_id);

            const room = new Room({ adaptiveStream: true, dynacast: true });
            roomRef.current = room;

            room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
                if (track.kind === Track.Kind.Audio) {
                    const el = track.attach();
                    document.body.appendChild(el);
                    setAgentState('speaking');
                }
            });

            room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
                const agentSpeaking = speakers.some(p => p.identity.includes('agent') || (p as any).isAgent);
                setAgentState(agentSpeaking ? 'speaking' : 'listening');
            });

            room.on(RoomEvent.DataReceived, (payload: Uint8Array) => {
                const str = new TextDecoder().decode(payload);
                try {
                    const data = JSON.parse(str);
                    if (data.type === 'transcript' || data.type === 'text') {
                        const isFinal = data.is_final !== false;
                        if (isFinal) {
                            setMessages(prev => [...prev, {
                                id: uuidv4(),
                                role: data.role || 'assistant',
                                content: data.content || data.text,
                                timestamp: new Date(),
                            }]);
                            setLiveTranscript(null);
                        } else {
                            setLiveTranscript({ text: data.content || data.text, role: data.role || 'assistant' });
                            if (liveTranscriptTimeoutRef.current) clearTimeout(liveTranscriptTimeoutRef.current);
                            liveTranscriptTimeoutRef.current = setTimeout(() => setLiveTranscript(null), 3000);
                        }
                    }
                } catch (_) { /* ignore parse errors */ }
            });

            room.on(RoomEvent.Disconnected, () => { setCallState('ended'); cleanup(); });

            await room.connect(serverUrl, token);
            await room.localParticipant.setMicrophoneEnabled(true);

            setCallState('connected');
            setAgentState('listening');

            // Send session metadata
            const enc = new TextEncoder();
            await room.localParticipant.publishData(
                enc.encode(JSON.stringify({ type: 'metadata', mode, persona, prompt: initialPrompt })),
                { reliable: true }
            );
        } catch (err) {
            console.error('Call failed:', err);
            setCallState('idle');
        }
    }, [initialPrompt, mode, persona, onCallStart, cleanup]);

    const endCall = React.useCallback(() => { cleanup(); setCallState('ended'); }, [cleanup]);

    const resetCall = React.useCallback(() => {
        setCallState('idle');
        setMessages([]);
        setAgentState('idle');
        setLiveTranscript(null);
        setInputText('');
    }, []);

    const sendMessage = React.useCallback(async () => {
        if (!inputText.trim() || !roomRef.current) return;
        const content = inputText.trim();
        setInputText('');
        setMessages(prev => [...prev, { id: uuidv4(), role: 'user', content, timestamp: new Date() }]);
        try {
            const enc = new TextEncoder();
            await roomRef.current.localParticipant.publishData(
                enc.encode(JSON.stringify({ type: 'chat', content, role: 'user' })),
                { reliable: true }
            );
        } catch (_) { /* ignore */ }
    }, [inputText]);

    const handleKeyPress = React.useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    }, [sendMessage]);

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // The component fills its parent 100%×100% (the phone shell in page.tsx).
    // Layout: StatusBar (shrink-0) → DynamicIsland (absolute) → Content (flex-1)
    // Content area switches between idle / ringing / connected / ended screens.
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div className="w-full h-full bg-[#050510] flex flex-col overflow-hidden">

            {/* ── Status Bar ── */}
            <StatusBar />

            {/* ── Dynamic Island (absolute so it floats over content) ── */}
            <DynamicIsland callState={callState} agentState={agentState} />

            {/* ── Main Screen area ── */}
            <div className="flex-1 min-h-0 relative">
                <AnimatePresence mode="wait">

                    {/* ────── IDLE SCREEN ────── */}
                    {callState === 'idle' && (
                        <motion.div
                            key="idle"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 flex flex-col items-center justify-center gap-8 px-6 text-center"
                        >
                            {/* Ambient glow */}
                            <div className="absolute inset-0 pointer-events-none">
                                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-48 h-48 bg-blue-600/20 blur-[80px] rounded-full" />
                            </div>

                            {/* Avatar */}
                            <div className="relative z-10">
                                <motion.div
                                    whileHover={{ scale: 1.04 }}
                                    className="w-32 h-32 rounded-[2.5rem] bg-gradient-to-br from-blue-500 to-indigo-600 p-1 shadow-2xl shadow-blue-600/40"
                                >
                                    <div className="w-full h-full bg-slate-950 rounded-[2.2rem] flex items-center justify-center">
                                        <Bot size={60} className="text-white" />
                                    </div>
                                </motion.div>
                                <div className="absolute -bottom-1 -right-1 bg-green-400 text-[9px] font-black text-black px-3 py-0.5 rounded-full border-2 border-slate-950 shadow">
                                    SECURE LINE
                                </div>
                            </div>

                            <div className="relative z-10">
                                <h2 className="text-3xl font-black text-white mb-1.5 tracking-tight">Emma</h2>
                                <p className="text-slate-400 text-sm max-w-[200px] leading-relaxed font-medium">
                                    AI voice intelligence. Ready when you are.
                                </p>
                            </div>

                            <button
                                onClick={startCall}
                                className="relative z-10 flex items-center gap-3 bg-white text-black px-8 py-4 rounded-3xl font-bold text-sm hover:scale-[1.03] active:scale-[0.97] transition-all shadow-2xl"
                                aria-label="Start call with Emma"
                            >
                                <Phone size={18} fill="black" />
                                Start Call
                            </button>
                        </motion.div>
                    )}

                    {/* ────── RINGING SCREEN ────── */}
                    {callState === 'ringing' && (
                        <motion.div
                            key="ringing"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-8"
                        >
                            <div className="absolute inset-0 pointer-events-none">
                                <motion.div
                                    animate={{ opacity: [0.1, 0.2, 0.1] }}
                                    transition={{ duration: 6, repeat: Infinity }}
                                    className="absolute inset-0 bg-blue-600/10 blur-[80px]"
                                />
                            </div>

                            <div className="relative z-10">
                                <motion.div
                                    animate={{ scale: [1, 1.18, 1], opacity: [0.4, 0, 0.4] }}
                                    transition={{ duration: 1.8, repeat: Infinity }}
                                    className="absolute -inset-5 rounded-full border border-blue-500/40"
                                />
                                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 p-1 shadow-2xl shadow-blue-500/30">
                                    <div className="w-full h-full bg-slate-950 rounded-full flex items-center justify-center">
                                        <Bot size={46} className="text-blue-300" />
                                    </div>
                                </div>
                            </div>

                            <div className="relative z-10 text-center">
                                <h2 className="text-2xl font-bold text-white mb-1">Emma</h2>
                                <p className="text-blue-400 text-xs font-bold uppercase tracking-[0.2em] animate-pulse">Connecting...</p>
                            </div>

                            <div className="relative z-10 w-full">
                                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: '0%' }} animate={{ width: '100%' }}
                                        transition={{ duration: 3 }}
                                        className="h-full bg-blue-500 rounded-full"
                                    />
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* ────── CONNECTED SCREEN ────── */}
                    {callState === 'connected' && (
                        <motion.div
                            key="connected"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            // This must be a flex column filling the parent:
                            // [message list - flex-1 scrollable] + [controls - pinned at bottom]
                            className="absolute inset-0 flex flex-col"
                        >
                            {/* Ambient aura behind messages */}
                            <ChatAura />

                            {/* ── "Thinking" dots (agent deliberating) ── */}
                            <AnimatePresence>
                                {agentState === 'thinking' && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        className="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex gap-1.5 bg-white/5 border border-white/10 backdrop-blur-md px-4 py-2 rounded-full"
                                    >
                                        {[0, 150, 300].map(delay => (
                                            <span
                                                key={delay}
                                                className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"
                                                style={{ animationDelay: `${delay}ms` }}
                                            />
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/*
                                ── MESSAGE SCROLL AREA ──
                                flex-col-reverse: newest messages render at the bottom.
                                As new messages are added (prepended in the reversed order),
                                old messages naturally push upwards.
                                scrollTop=0 is always the bottom in a reversed container.
                            */}
                            <div
                                ref={scrollRef}
                                className="flex-1 min-h-0 overflow-y-auto flex flex-col-reverse gap-2.5 px-4 pt-4 pb-2 relative z-10 custom-scrollbar"
                            >
                                {/* Live transcript (appears at very bottom of list = top in DOM order) */}
                                <AnimatePresence>
                                    {liveTranscript && (
                                        <motion.div
                                            key="live"
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0 }}
                                            className={`flex ${liveTranscript.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div className={`
                                                max-w-[82%] px-4 py-3 rounded-[18px] text-[13px] font-medium leading-[1.45]
                                                ${liveTranscript.role === 'user'
                                                    ? 'bg-blue-600/80 text-white rounded-br-[4px]'
                                                    : 'bg-white/6 text-slate-200 rounded-bl-[4px] border border-white/10'
                                                }
                                            `}>
                                                {liveTranscript.text}
                                                <motion.span
                                                    animate={{ opacity: [1, 0.3, 1] }}
                                                    transition={{ duration: 0.7, repeat: Infinity }}
                                                    className="inline-block w-0.5 h-3.5 bg-current ml-1 align-middle rounded-full"
                                                />
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Committed messages — newest first in DOM, reversed by CSS */}
                                {[...messages].reverse().map(msg => (
                                    <MessageBubble key={msg.id} msg={msg} />
                                ))}
                            </div>

                            {/*
                                ── CONTROLS (pinned footer) ──
                                shrink-0 ensures it never gets squashed by the message area.
                                z-20 keeps it above scroll content.
                            */}
                            <div className="shrink-0 z-20 bg-black/70 backdrop-blur-2xl border-t border-white/5 px-3 py-3 pb-7">
                                <div className="flex gap-2 items-center">
                                    <input
                                        type="text"
                                        value={inputText}
                                        onChange={e => setInputText(e.target.value)}
                                        onKeyPress={handleKeyPress}
                                        placeholder="Message Emma..."
                                        className="flex-1 min-w-0 bg-white/4 border border-white/10 rounded-2xl px-4 py-3 text-[13px] text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50 placeholder:text-slate-600 font-medium transition-all"
                                    />
                                    <button
                                        onClick={sendMessage}
                                        disabled={!inputText.trim()}
                                        aria-label="Send message"
                                        className="w-11 h-11 shrink-0 flex items-center justify-center bg-white text-black rounded-full hover:scale-105 disabled:opacity-20 transition-all active:scale-95 shadow-lg"
                                    >
                                        <Send size={16} />
                                    </button>
                                    <button
                                        onClick={endCall}
                                        aria-label="End call"
                                        className="w-11 h-11 shrink-0 flex items-center justify-center bg-red-500 text-white rounded-full hover:scale-105 transition-all active:scale-95 shadow-lg"
                                    >
                                        <PhoneOff size={16} />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* ────── ENDED SCREEN ────── */}
                    {callState === 'ended' && (
                        <motion.div
                            key="ended"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="absolute inset-0 flex flex-col items-center justify-center text-center gap-6 px-8"
                        >
                            <div className="w-20 h-20 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center">
                                <CheckCircle2 size={36} className="text-green-400" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white mb-2">Demo Completed</h3>
                                <p className="text-slate-400 text-sm leading-relaxed">
                                    {mode === 'sales'
                                        ? 'Emma has collected the necessary details. Your agent is ready.'
                                        : 'Support session resolved. The agent de-escalated successfully.'}
                                </p>
                            </div>
                            <div className="flex flex-col gap-3 w-full">
                                <button
                                    onClick={resetCall}
                                    className="w-full py-3.5 bg-white text-black rounded-2xl font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl"
                                >
                                    {mode === 'sales' ? 'Book a Strategy Call' : 'Start New Session'}
                                </button>
                                <button onClick={resetCall} className="text-slate-500 text-xs hover:text-white transition-colors py-1">
                                    Try Again
                                </button>
                            </div>
                        </motion.div>
                    )}

                </AnimatePresence>
            </div>
        </div>
    );
}
