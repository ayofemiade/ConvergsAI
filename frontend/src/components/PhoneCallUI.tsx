'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Send, User, Bot, Loader2, Sparkles, Mic, Volume2, CheckCircle2, X, ChevronRight, Wifi, Battery, SignalHigh, Globe } from 'lucide-react';
import { apiClient, MessageResponse } from '@/lib/api';
import { v4 as uuidv4 } from 'uuid';
import {
    Room,
    RoomEvent,
    Track,
    RemoteParticipant,
    RemoteTrack,
    RemoteTrackPublication,
    Participant,
    DataPacket_Kind
} from 'livekit-client';
import '@livekit/components-styles';

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

// --- OPTIMIZED SUB-COMPONENTS ---

const BackgroundAura = React.memo(() => (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
            animate={{
                scale: [1, 1.1, 1],
                opacity: [0.07, 0.12, 0.07],
            }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-blue-500 blur-[80px] rounded-full will-change-transform"
        />
        <motion.div
            animate={{
                scale: [1, 1.2, 1],
                opacity: [0.04, 0.08, 0.04],
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear", delay: 2 }}
            className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-500 blur-[60px] rounded-full will-change-transform"
        />
    </div>
));
BackgroundAura.displayName = 'BackgroundAura';

const StatusStatusBar = React.memo(() => (
    <div className="h-14 flex items-center justify-between px-10 z-40 text-white/95 relative">
        {/* Time - Hidden on small screens */}
        <span className="hidden lg:flex text-[12px] font-black tracking-tighter items-center gap-1.5">
            9:41
            <motion.div
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-1.5 h-1.5 rounded-full bg-blue-500"
            />
        </span>

        {/* Dynamic Island sibling space (centered) */}
        <div className="flex-1" />

        {/* Battery/Signal - Hidden on small screens */}
        <div className="hidden lg:flex items-center gap-2.5 opacity-70">
            <SignalHigh size={14} strokeWidth={2.5} />
            <Wifi size={14} strokeWidth={2.5} />
            <div className="flex items-center gap-1">
                <div className="w-[22px] h-[11px] rounded-[3.5px] border border-white/30 p-[1.5px] flex items-center relative">
                    <div className="h-full w-[88%] bg-white rounded-[1.5px]" />
                </div>
                <div className="w-[2px] h-[4px] bg-white/30 rounded-r-full" />
            </div>
        </div>
    </div>
));
StatusStatusBar.displayName = 'StatusStatusBar';

const MessageBubble = React.memo(({ msg }: { msg: Message }) => (
    <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
        <div className={`
            max-w-[85%] px-5 py-3.5 rounded-[22px] text-[13.5px] font-medium leading-[1.4]
            ${msg.role === 'user'
                ? 'bg-[#1E1E1E] text-white rounded-br-none border border-white/5'
                : 'bg-white/5 text-slate-100 rounded-bl-none border border-white/10 backdrop-blur-md'}
        `}>
            {msg.content}
        </div>
    </div>
));
MessageBubble.displayName = 'MessageBubble';

const QualificationItem = React.memo(({ item, val, isDone }: { item: any; val: any; isDone: boolean }) => (
    <motion.div
        initial={false}
        animate={{ backgroundColor: isDone ? 'rgba(34, 197, 94, 0.05)' : 'transparent' }}
        className={`p-4 rounded-2xl border transition-all duration-500 ${isDone ? 'border-green-500/30' : 'border-white/5 bg-white/[0.02]'} will-change-transform`}
    >
        <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2.5 text-xs font-bold text-slate-300">
                <span className="opacity-50 grayscale">{item.icon}</span> {item.label}
            </div>
            {isDone && (
                <div className="text-green-500">
                    <CheckCircle2 size={14} />
                </div>
            )}
        </div>
        <div className="text-[11px] pl-7">
            {isDone ? (
                <span className="text-white font-medium capitalize">{val}</span>
            ) : (
                <span className="text-slate-600 italic">Listening...</span>
            )}
        </div>
    </motion.div>
));
QualificationItem.displayName = 'QualificationItem';

export default function PhoneCallUI({
    initialPrompt,
    onCallStart,
    mode = 'sales',
    persona = 'Emma'
}: PhoneCallUIProps = {}) {
    // State
    const [callState, setCallState] = useState<CallState>('idle');
    const [agentState, setAgentState] = useState<AgentState>('idle');
    const [sessionId, setSessionId] = useState<string>('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [qualification, setQualification] = useState<any>({});
    const [qualificationComplete, setQualificationComplete] = useState(false);
    const [liveTranscript, setLiveTranscript] = useState<{ text: string; role: 'user' | 'assistant' } | null>(null);
    const [stats, setStats] = useState({ latency: '---', sentiment: 'Neutral' });
    const liveTranscriptTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [showMobileStats, setShowMobileStats] = useState(false);
    const roomRef = useRef<Room | null>(null);
    const audioRElementRef = useRef<HTMLAudioElement | null>(null);

    // Memoized state constants
    const qualificationItems = React.useMemo(() => ({
        sales: [
            { key: 'business_type', label: 'Business Type', icon: '🏢' },
            { key: 'goal', label: 'Primary Goal', icon: '🎯' },
            { key: 'urgency', label: 'Timeline', icon: '⏱️' },
            { key: 'budget_readiness', label: 'Budget Status', icon: '💰' },
        ],
        support: [
            { key: 'issue_type', label: 'Issue Type', icon: '⚠️' },
            { key: 'account_status', label: 'Account Status', icon: '👤' },
            { key: 'frustration_level', label: 'Emotion', icon: '🔥' },
            { key: 'resolution_path', label: 'Resolution', icon: '✅' },
        ]
    }), []);

    // Auto-scroll to bottom of transcript
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, agentState]);

    // Runtime config check
    useEffect(() => {
        console.log("DEBUG: PhoneCallUI Initialized");
        console.log("DEBUG: Target API Gateway:", process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000');
    }, []);

    // Start call logic
    const startCall = React.useCallback(async () => {
        setCallState('ringing');
        try {
            if (onCallStart) onCallStart();

            const { session_id } = await apiClient.createSession(initialPrompt);
            setSessionId(session_id);

            const { token, serverUrl } = await apiClient.getLiveKitToken(session_id);

            const room = new Room({
                adaptiveStream: true,
                dynacast: true,
                publishDefaults: {
                    dtx: true, // Enable DTX for better bandwidth/CPU usage
                }
            });
            roomRef.current = room;

            room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
                if (track.kind === Track.Kind.Audio) {
                    const element = track.attach();
                    document.body.appendChild(element);
                    setAgentState('speaking');
                }
            });

            room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
                const isAgentSpeaking = speakers.some(p => p.identity.includes('agent') || (p as any).isAgent);
                setAgentState(isAgentSpeaking ? 'speaking' : 'listening');
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
                            setLiveTranscript({
                                text: data.content || data.text,
                                role: data.role || 'assistant'
                            });

                            if (liveTranscriptTimeoutRef.current) clearTimeout(liveTranscriptTimeoutRef.current);
                            liveTranscriptTimeoutRef.current = setTimeout(() => {
                                setLiveTranscript(null);
                            }, 3000);
                        }
                    }
                    if (data.qualification) setQualification(data.qualification);
                    if (data.qualification_complete !== undefined) setQualificationComplete(data.qualification_complete);

                    if (data.intelligence) {
                        setStats(prev => ({
                            latency: data.intelligence.latency ? `${data.intelligence.latency}ms` : prev.latency,
                            sentiment: data.intelligence.sentiment || prev.sentiment
                        }));
                    }
                } catch (e) { }
            });

            room.on(RoomEvent.Disconnected, () => {
                setCallState('ended');
                cleanup();
            });

            await room.connect(serverUrl, token);
            await room.localParticipant.setMicrophoneEnabled(true);

            setCallState('connected');
            setAgentState('listening');

            const encoder = new TextEncoder();
            const metaPacket = encoder.encode(JSON.stringify({
                type: 'metadata',
                mode,
                persona,
                prompt: initialPrompt
            }));
            await room.localParticipant.publishData(metaPacket, { reliable: true });

        } catch (error) {
            console.error('LiveKit fail:', error);
            setCallState('idle');
        }
    }, [initialPrompt, mode, persona, onCallStart]);

    const cleanup = React.useCallback(() => {
        if (roomRef.current) {
            roomRef.current.disconnect();
            roomRef.current = null;
        }
    }, []);

    const endCall = React.useCallback(() => {
        cleanup();
        setCallState('ended');
    }, [cleanup]);

    const resetCall = React.useCallback(() => {
        setCallState('idle');
        setMessages([]);
        setQualification({});
        setQualificationComplete(false);
        setAgentState('idle');
        setStats({ latency: '---', sentiment: 'Neutral' });
        setLiveTranscript(null);
        setInputText('');
    }, []);

    // Keep memory of cleanup on unmount
    useEffect(() => {
        return () => cleanup();
    }, []);

    const sendMessage = React.useCallback(async () => {
        if (!inputText.trim() || !roomRef.current) return;

        const content = inputText;
        setInputText('');

        setMessages((prev) => [...prev, {
            id: uuidv4(),
            role: 'user',
            content,
            timestamp: new Date(),
        }]);

        const encoder = new TextEncoder();
        const data = encoder.encode(JSON.stringify({
            type: 'chat',
            content,
            role: 'user'
        }));

        try {
            await roomRef.current.localParticipant.publishData(data, {
                reliable: true
            });
        } catch (err) { }
    }, [inputText]);

    const handleKeyPress = React.useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    }, [sendMessage]);

    return (
        <div className="w-full h-full flex flex-col lg:flex-row gap-4 lg:gap-6 p-1">

            {/* PHONE INTERFACE */}
            <div className="flex-1 relative group max-w-[420px] mx-auto lg:max-w-none w-full">

                {/* Phone Body Shell - Realistic Depth */}
                <div className="relative h-full bg-[#080808] rounded-[3.2rem] p-[10px] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8),inset_0_0_2px_1px_rgba(255,255,255,0.1)] border border-white/5 overflow-hidden flex flex-col ring-8 ring-slate-900/40">

                    {/* Screen Reflection Overlay (Glass Effect) */}
                    <div className="absolute inset-0 z-50 pointer-events-none">
                        <div className="absolute inset-0 bg-gradient-to-tr from-white opacity-[0.02] via-transparent to-transparent" />
                        <div className="absolute top-0 inset-x-0 h-[100px] bg-gradient-to-b from-white/[0.05] to-transparent" />
                    </div>

                    {/* Interior Screen Boundary (The Display) */}
                    <div className="relative flex-1 bg-black rounded-[2.8rem] overflow-hidden flex flex-col ring-1 ring-white/10 shadow-[inset_0_0_80px_rgba(0,0,0,0.9)]">

                        {/* MOCK STATUS BAR (iOS Style) */}
                        <StatusStatusBar />

                        {/* DYNAMIC ISLAND HUB (Interactive) */}
                        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50">
                            <motion.div
                                layout
                                animate={{
                                    width: agentState === 'speaking' ? 240 :
                                        agentState === 'thinking' ? 180 :
                                            callState === 'connected' ? 120 : 160,
                                    height: 36,
                                }}
                                transition={{ type: "spring", stiffness: 450, damping: 28 }}
                                className="bg-black border border-white/20 shadow-2xl rounded-full flex items-center justify-center gap-3 px-5 shrink-0 overflow-hidden will-change-transform"
                            >
                                <AnimatePresence mode="wait">
                                    {callState === 'connected' ? (
                                        <motion.div
                                            key={agentState}
                                            initial={{ opacity: 0, scale: 0.8 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.8 }}
                                            className="flex items-center gap-2 whitespace-nowrap"
                                        >
                                            {agentState === 'speaking' && (
                                                <div className="flex items-center gap-3">
                                                    <div className="flex gap-[2px] h-3.5 items-center">
                                                        {[0.1, 0.4, 0.2, 0.5, 0.3, 0.45, 0.25].map((delay, i) => (
                                                            <motion.div
                                                                key={i}
                                                                animate={{ height: [3, 14, 3] }}
                                                                transition={{ duration: 0.6, repeat: Infinity, delay }}
                                                                className="w-[2px] bg-green-500 rounded-full"
                                                            />
                                                        ))}
                                                    </div>
                                                    <span className="text-[10px] font-black text-white uppercase tracking-[0.15em] glow-text">Emma Speaking</span>
                                                </div>
                                            )}
                                            {agentState === 'thinking' && (
                                                <div className="flex items-center gap-2.5">
                                                    <motion.div
                                                        animate={{ rotate: 360 }}
                                                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                                    >
                                                        <Sparkles size={12} className="text-purple-400" />
                                                    </motion.div>
                                                    <span className="text-[10px] font-black text-slate-200 uppercase tracking-tighter">System Analyzing</span>
                                                </div>
                                            )}
                                            {agentState === 'listening' && (
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_12px_rgba(59,130,246,0.8)]" />
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">LIVE AGENT</span>
                                                </div>
                                            )}
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="idle"
                                            className="flex items-center gap-2.5 opacity-60 hover:opacity-100 transition-opacity"
                                        >
                                            <Globe size={11} className="text-white" />
                                            <span className="text-[10px] font-black text-white uppercase tracking-[0.4em]">ConvergsAI</span>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        </div>

                        {/* Home Indicator (The sleek bar at bottom) */}
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-36 h-[5px] bg-white/25 rounded-full z-40 shadow-sm" />

                        {/* Main Content Area */}
                        <div className="flex-1 relative flex flex-col bg-black">
                            <AnimatePresence mode="wait">
                                {callState === 'idle' && (
                                    <motion.div
                                        className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-12"
                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                    >
                                        <div className="relative group">
                                            <div className="absolute inset-0 bg-blue-500/20 blur-[80px] rounded-full group-hover:bg-blue-400/30 transition-all duration-700" />
                                            <motion.div
                                                whileHover={{ scale: 1.05 }}
                                                className="w-40 h-40 rounded-[3rem] bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-2xl relative z-10 p-1"
                                            >
                                                <div className="w-full h-full bg-slate-900 rounded-[2.8rem] flex items-center justify-center overflow-hidden">
                                                    <Bot size={80} className="text-white" />
                                                </div>
                                            </motion.div>
                                            <div className="absolute -bottom-2 -right-2 bg-green-500 text-[10px] font-black text-black px-4 py-1 rounded-full border-4 border-slate-950 shadow-lg relative z-20">
                                                SECURE LINE
                                            </div>
                                        </div>
                                        <div>
                                            <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Emma</h2>
                                            <p className="text-slate-400 font-medium text-sm max-w-[200px] leading-relaxed">
                                                Secure, high-performance AI voice intelligence.
                                            </p>
                                        </div>
                                        <button
                                            onClick={startCall}
                                            className="w-full max-w-[240px] py-4 bg-white text-black rounded-3xl font-bold flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl"
                                            aria-label="Call Emma"
                                        >
                                            <Phone size={20} fill="black" />
                                            <span>Start Call</span>
                                        </button>
                                    </motion.div>
                                )}

                                {callState === 'ringing' && (
                                    <motion.div
                                        className="flex-1 flex flex-col items-center justify-between py-20 relative overflow-hidden"
                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                    >
                                        <div className="absolute inset-0 z-0 pointer-events-none">
                                            <motion.div
                                                animate={{
                                                    opacity: [0.15, 0.25, 0.15]
                                                }}
                                                transition={{ duration: 8, repeat: Infinity }}
                                                className="absolute inset-0 bg-blue-600/10 blur-[100px]"
                                            />
                                        </div>

                                        <div className="relative z-10 flex flex-col items-center gap-6">
                                            <div className="relative">
                                                <motion.div
                                                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                                                    transition={{ duration: 2, repeat: Infinity }}
                                                    className="absolute -inset-4 rounded-full border border-blue-500/50"
                                                />
                                                <div className="w-28 h-28 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-2xl shadow-blue-500/40 relative z-10 p-1">
                                                    <div className="w-full h-full bg-slate-900 rounded-full flex items-center justify-center overflow-hidden">
                                                        <Bot size={56} className="text-blue-400" />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-center">
                                                <h2 className="text-2xl font-bold text-white mb-1">Emma</h2>
                                                <p className="text-blue-400 text-sm font-bold uppercase tracking-[0.2em] animate-pulse">ConvergsAI Agent</p>
                                            </div>
                                        </div>

                                        <div className="relative z-10 flex flex-col items-center gap-4 w-full px-12">
                                            <p className="text-slate-400 text-xs font-medium mb-8">Calling via ConvergsAI...</p>
                                            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                                <motion.div
                                                    initial={{ width: "0%" }}
                                                    animate={{ width: "100%" }}
                                                    transition={{ duration: 3 }}
                                                    className="h-full bg-blue-500"
                                                />
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {callState === 'connected' && (
                                    <motion.div
                                        className="flex-1 flex flex-col h-full relative"
                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                    >
                                        {/* Real-time Transcription Overlay */}
                                        <AnimatePresence>
                                            {liveTranscript && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0 }}
                                                    className="absolute bottom-24 left-4 right-4 z-30 pointer-events-none"
                                                >
                                                    <div className={`
                                                    p-4 rounded-2xl backdrop-blur-md border shadow-xl max-w-[90%] mx-auto
                                                    ${liveTranscript.role === 'user'
                                                            ? 'bg-blue-600/80 border-blue-400/30'
                                                            : 'bg-slate-800/80 border-white/10'}
                                                `}>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            {liveTranscript.role === 'user' ? <User size={12} /> : <Bot size={12} />}
                                                            <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                                                                {liveTranscript.role === 'user' ? 'You' : 'Emma'} is speaking...
                                                            </span>
                                                        </div>
                                                        <p className="text-sm font-medium leading-relaxed italic">
                                                            "{liveTranscript.text}"
                                                        </p>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                        {/* Phone Screen Background Elements */}
                                        <BackgroundAura />

                                        {/* Live Transcript Area */}
                                        <div
                                            ref={scrollRef}
                                            className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar scroll-smooth pt-16 relative z-10"
                                        >
                                            <AnimatePresence initial={false}>
                                                {messages.map((msg) => (
                                                    <MessageBubble key={msg.id} msg={msg} />
                                                ))}
                                            </AnimatePresence>
                                            {agentState === 'thinking' && (
                                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                                                    <div className="bg-slate-800 px-4 py-3 rounded-2xl rounded-bl-none border border-white/5 flex gap-1">
                                                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                                    </div>
                                                </motion.div>
                                            )}
                                        </div>

                                        {/* Controls */}
                                        <div className="p-6 bg-black/80 backdrop-blur-[30px] border-t border-white/5 relative z-20 pb-10">
                                            <div className="flex gap-2 items-center">
                                                <div className="flex-1 relative">
                                                    <input
                                                        type="text"
                                                        value={inputText}
                                                        onChange={(e) => setInputText(e.target.value)}
                                                        onKeyPress={handleKeyPress}
                                                        placeholder="Message Emma..."
                                                        className="w-full bg-white/[0.03] border border-white/10 rounded-[20px] px-5 py-3.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20 placeholder:text-slate-600 transition-all font-medium"
                                                    />
                                                </div>
                                                <button
                                                    onClick={sendMessage}
                                                    disabled={!inputText.trim() || isLoading}
                                                    className="w-11 h-11 flex items-center justify-center bg-white text-black rounded-full hover:scale-105 disabled:opacity-20 disabled:grayscale transition-all active:scale-95 shadow-xl shrink-0"
                                                    aria-label="Send message"
                                                >
                                                    <Send size={18} />
                                                </button>
                                                <button
                                                    onClick={endCall}
                                                    className="w-11 h-11 flex items-center justify-center bg-[#FF3B30] text-white rounded-full hover:scale-105 transition-all active:scale-95 shadow-xl shrink-0"
                                                    aria-label="End call"
                                                >
                                                    <PhoneOff size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {callState === 'ended' && (
                                    <motion.div
                                        className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-6"
                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                    >
                                        <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center border border-white/10">
                                            <CheckCircle2 size={32} className="text-green-500" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-white mb-2">Demo Completed</h3>
                                            <p className="text-slate-300 font-medium mb-4">
                                                {mode === 'sales'
                                                    ? 'Emma has collected the necessary details. Your agent is ready for a real sales call.'
                                                    : 'Support session resolved. The agent successfully de-escalated and provided a solution.'}
                                            </p>
                                        </div>
                                        <div className="flex flex-col gap-2 w-full">
                                            <button onClick={resetCall} className="btn-primary w-full py-4 rounded-xl">
                                                {mode === 'sales' ? 'Book a Product Strategy Call' : 'Explore Support Automation'}
                                            </button>
                                            <button onClick={resetCall} className="text-slate-400 text-sm hover:text-white transition-colors">
                                                Start New Call
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div> {/* Main Content Area */}
                    </div> {/* Interior Screen Boundary */}
                </div> {/* Phone Body Shell */}
            </div> {/* Phone Interface Wrapper */}

            {/* STATS & CONTEXT SIDEBAR */}
            <div className={`
                ${showMobileStats ? 'flex' : 'hidden'} 
                lg:flex lg:w-80 flex-col gap-4 
                fixed lg:relative inset-0 lg:inset-auto z-[100] lg:z-10
                bg-slate-950/95 lg:bg-transparent backdrop-blur-xl lg:backdrop-blur-none
                p-6 lg:p-0 transition-all duration-300
            `}>
                <div className="flex lg:hidden items-center justify-between mb-6">
                    <h2 className="text-xl font-bold font-display">Session Intelligence</h2>
                    <button onClick={() => setShowMobileStats(false)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
                        <X size={24} className="text-slate-400" />
                    </button>
                </div>

                {/* Agent Card */}
                <div className="bg-slate-900/40 border border-white/10 rounded-3xl p-5 backdrop-blur-xl shadow-2xl">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400 font-bold border border-blue-500/30">
                            AI
                        </div>
                        <div>
                            <h2 className="font-bold text-sm text-white uppercase tracking-widest">
                                {mode === 'sales' ? 'Sales Intelligence' : 'Support Intelligence'}
                            </h2>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white/[0.03] p-3 rounded-2xl border border-white/5">
                            <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Latency</div>
                            <div className="text-green-400 font-mono text-xs">{stats.latency}</div>
                        </div>
                        <div className="bg-white/[0.03] p-3 rounded-2xl border border-white/5">
                            <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Sentiment</div>
                            <div className={`font-mono text-xs ${stats.sentiment.toLowerCase() === 'positive' ? 'text-green-400' :
                                stats.sentiment.toLowerCase() === 'negative' ? 'text-red-400' :
                                    'text-blue-400'
                                }`}>
                                {stats.sentiment}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Qualification Tracker */}
                <div className="flex-1 bg-slate-900/40 border border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden">
                    <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-6">Extracted Metadata</h2>

                    <div className="space-y-4 flex-1">
                        {qualificationItems[mode].map((item: any) => (
                            <QualificationItem
                                key={item.key}
                                item={item}
                                val={qualification[item.key]}
                                isDone={!!qualification[item.key]}
                            />
                        ))}
                    </div>

                    {qualificationComplete && (
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className="mt-6 p-4 bg-green-500/10 border border-green-500/30 rounded-2xl flex items-center gap-4"
                        >
                            <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center shadow-[0_0_20px_rgba(34,197,94,0.4)]">
                                <CheckCircle2 size={18} className="text-black" />
                            </div>
                            <div>
                                <div className="text-xs font-black text-green-400 uppercase tracking-widest">Metadata Sync</div>
                                <div className="text-[11px] text-green-300/50">Qualification Pipeline Complete</div>
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>
        </div>
    );
}


