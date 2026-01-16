'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Send, User, Bot, Loader2, Sparkles, Mic, Volume2, CheckCircle2 } from 'lucide-react';
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
}

export default function PhoneCallUI({ initialPrompt, onCallStart }: PhoneCallUIProps = {}) {
    // State
    const [callState, setCallState] = useState<CallState>('idle');
    const [agentState, setAgentState] = useState<AgentState>('idle');
    const [sessionId, setSessionId] = useState<string>('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [qualification, setQualification] = useState<any>({});
    const [qualificationComplete, setQualificationComplete] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const roomRef = useRef<Room | null>(null);
    const audioRElementRef = useRef<HTMLAudioElement | null>(null);

    // Auto-scroll to bottom of transcript
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, agentState]);

    // Start call logic
    const startCall = async () => {
        setCallState('ringing');
        try {
            if (onCallStart) onCallStart();

            // 1. Create a session to get a unique ID (used as room name)
            console.log("DEBUG: Creating session at http://localhost:4000/api/session/new");
            const { session_id } = await apiClient.createSession(initialPrompt);
            setSessionId(session_id);
            console.log("DEBUG: Session created:", session_id);

            // 2. Fetch LiveKit token
            console.log("DEBUG: Fetching token for room:", session_id);
            const { token, serverUrl } = await apiClient.getLiveKitToken(session_id);
            console.log("DEBUG: Token received. serverUrl:", serverUrl);

            // 3. Connect to LiveKit Room
            console.log("DEBUG: Connecting to room...");
            const room = new Room({
                adaptiveStream: true,
                dynacast: true,
            });
            roomRef.current = room;

            // Handle track subscriptions
            room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
                console.log("DEBUG: Track discovered:", track.kind, "from:", participant.identity);
                if (track.kind === Track.Kind.Audio) {
                    const element = track.attach();
                    document.body.appendChild(element);
                    setAgentState('speaking');
                }
            });

            room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
                const isAgentSpeaking = speakers.some(p => p.identity.includes('agent') || (p as any).isAgent);
                if (isAgentSpeaking) setAgentState('speaking');
                else setAgentState('listening');
            });

            room.on(RoomEvent.DataReceived, (payload: Uint8Array, participant?: RemoteParticipant) => {
                const decoder = new TextDecoder();
                const str = decoder.decode(payload);
                console.log("DEBUG: Data packet received:", str);
                try {
                    const data = JSON.parse(str);
                    if (data.type === 'transcript' || data.type === 'text') {
                        const newMsg: Message = {
                            id: uuidv4(),
                            role: data.role || 'assistant',
                            content: data.content || data.text,
                            timestamp: new Date(),
                        };
                        setMessages(prev => [...prev, newMsg]);
                    }
                    if (data.qualification) setQualification(data.qualification);
                    if (data.qualification_complete !== undefined) setQualificationComplete(data.qualification_complete);
                } catch (e) {
                    console.error('DEBUG: Failed to parse data message:', str);
                }
            });

            room.on(RoomEvent.Disconnected, (reason) => {
                console.log("DEBUG: Room disconnected. Reason:", reason);
                setCallState('ended');
                cleanup();
            });

            await room.connect(serverUrl, token);
            console.log("DEBUG: Successfully joined LiveKit room!");
            await room.localParticipant.setMicrophoneEnabled(true);
            console.log("DEBUG: Microphone access granted and enabled.");

            setCallState('connected');
            setAgentState('listening');

        } catch (error) {
            console.error('DEBUG CRITICAL: LiveKit startCall failed:', error);
            alert(`Call failed: ${error instanceof Error ? error.message : String(error)}`);
            setCallState('idle');
        }
    };

    const cleanup = () => {
        if (roomRef.current) {
            roomRef.current.disconnect();
            roomRef.current = null;
        }
    };

    const endCall = () => {
        cleanup();
        setCallState('ended');
        setTimeout(() => {
            setCallState('idle');
            setMessages([]);
            setQualification({});
            setQualificationComplete(false);
            setAgentState('idle');
        }, 2000);
    };

    // Keep memory of cleanup on unmount
    useEffect(() => {
        return () => cleanup();
    }, []);

    const sendMessage = async () => {
        if (!inputText.trim() || !roomRef.current) return;

        const userMessage: Message = {
            id: uuidv4(),
            role: 'user',
            content: inputText,
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);

        // Send via Data Channel for text-backup/chat-history support
        const encoder = new TextEncoder();
        const data = encoder.encode(JSON.stringify({
            type: 'chat',
            content: inputText,
            role: 'user'
        }));

        try {
            await roomRef.current.localParticipant.publishData(data, {
                reliable: true
            });
        } catch (err) {
            console.error("Failed to send data message:", err);
        }

        setInputText('');
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <div className="w-full h-full flex flex-col md:flex-row gap-6 p-1">

            {/* PHONE INTERFACE */}
            <div className="flex-1 relative group">
                {/* Phone Bezel/Frame */}
                <div className="absolute -inset-1 bg-gradient-to-b from-slate-700 to-slate-900 rounded-[2.5rem] opacity-50 blur-sm pointer-events-none" />

                <div className="relative h-full bg-slate-950 rounded-[2rem] border-[6px] border-slate-800 shadow-2xl overflow-hidden flex flex-col">

                    {/* Dynamic Status Bar (Notch) */}
                    <div className="h-14 bg-slate-900 flex items-center justify-center relative z-20 border-b border-white/5">
                        <motion.div
                            animate={{
                                width: agentState === 'speaking' ? '180px' : '120px',
                                backgroundColor: agentState === 'speaking' ? '#22c55e' :
                                    agentState === 'thinking' ? '#a855f7' : '#334155'
                            }}
                            className="h-8 rounded-full flex items-center justify-center gap-2 overflow-hidden transition-colors duration-500"
                        >
                            {callState === 'connected' ? (
                                <>
                                    {agentState === 'speaking' && <Volume2 size={14} className="text-black animate-pulse" />}
                                    {agentState === 'thinking' && <Sparkles size={14} className="text-white animate-spin" />}
                                    {agentState === 'listening' && <Mic size={14} className="text-white" />}

                                    <span className={`text-xs font-bold ${agentState === 'speaking' ? 'text-black' : 'text-white'}`}>
                                        {agentState === 'speaking' ? 'Emma Speaking' :
                                            agentState === 'thinking' ? 'AI Thinking' : 'Listening'}
                                    </span>
                                </>
                            ) : (
                                <span className="text-xs font-medium text-slate-300">ConvergsAI Agent</span>
                            )}
                        </motion.div>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 relative flex flex-col bg-gradient-to-b from-slate-900 to-slate-950">
                        <AnimatePresence mode="wait">
                            {callState === 'idle' && (
                                <motion.div
                                    className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6"
                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                >
                                    <div className="relative">
                                        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                                            <Bot size={64} className="text-white" />
                                        </div>
                                        <div className="absolute -bottom-2 -right-2 bg-green-500 text-xs font-bold text-black px-3 py-1 rounded-full border-2 border-slate-900">
                                            ONLINE
                                        </div>
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-white mb-2">Emma</h2>
                                        <p className="text-slate-300 font-medium">Top-performing AI Sales Agent</p>
                                    </div>
                                    <button
                                        onClick={startCall}
                                        className="btn-primary w-full max-w-xs py-4 text-lg flex items-center justify-center gap-3 group"
                                        aria-label="Start demo call with Emma"
                                    >
                                        <Phone size={24} className="group-hover:rotate-12 transition-transform" />
                                        <span>Start Demo Call</span>
                                    </button>
                                </motion.div>
                            )}

                            {callState === 'ringing' && (
                                <motion.div
                                    className="flex-1 flex flex-col items-center justify-center space-y-8"
                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                >
                                    <div className="relative">
                                        {[1, 2, 3].map((i) => (
                                            <motion.div
                                                key={i}
                                                className="absolute inset-0 rounded-full border border-blue-500"
                                                initial={{ scale: 1, opacity: 0.5 }}
                                                animate={{ scale: 2, opacity: 0 }}
                                                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.4 }}
                                            />
                                        ))}
                                        <div className="w-24 h-24 rounded-full bg-blue-600 flex items-center justify-center relative z-10">
                                            <Phone size={40} className="text-white fill-white" />
                                        </div>
                                    </div>
                                    <p className="text-lg text-slate-200 animate-pulse font-medium">Connecting to Emma...</p>
                                </motion.div>
                            )}

                            {callState === 'connected' && (
                                <motion.div
                                    className="flex-1 flex flex-col h-full"
                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                >
                                    {/* Live Transcript Area */}
                                    <div
                                        ref={scrollRef}
                                        className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar scroll-smooth"
                                    >
                                        {messages.map((msg) => (
                                            <motion.div
                                                key={msg.id}
                                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                            >
                                                <div className={`
                                                    max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm
                                                    ${msg.role === 'user'
                                                        ? 'bg-blue-600 text-white rounded-br-none'
                                                        : 'bg-slate-800 text-slate-100 rounded-bl-none border border-white/5'}
                                                `}>
                                                    {msg.content}
                                                </div>
                                            </motion.div>
                                        ))}
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
                                    <div className="p-4 bg-slate-900 border-t border-white/5">
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={inputText}
                                                onChange={(e) => setInputText(e.target.value)}
                                                onKeyPress={handleKeyPress}
                                                placeholder="Type your reply..."
                                                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-500"
                                            />
                                            <button
                                                onClick={sendMessage}
                                                disabled={!inputText.trim() || isLoading}
                                                className="p-3 bg-blue-600 rounded-xl text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                aria-label="Send message"
                                            >
                                                <Send size={20} />
                                            </button>
                                            <button
                                                onClick={endCall}
                                                className="p-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl hover:bg-red-500/20 transition-colors"
                                                aria-label="End call"
                                            >
                                                <PhoneOff size={20} />
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
                                        <p className="text-slate-300 font-medium">Emma has qualified this lead.</p>
                                    </div>
                                    <button onClick={() => setCallState('idle')} className="btn-secondary w-full">
                                        Start New Call
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* STATS & CONTEXT SIDEBAR */}
            <div className="hidden md:flex w-80 flex-col gap-4">
                {/* Agent Card */}
                <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400 font-bold border border-blue-500/30">
                            AI
                        </div>
                        <div>
                            <h2 className="font-bold text-sm text-white">Qualification Agent</h2>
                            <p className="text-xs text-slate-300 font-medium">Running on Llama 3 70B</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-center text-xs">
                        <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                            <div className="text-slate-300 mb-1">Latency</div>
                            <div className="text-green-400 font-mono">120ms</div>
                        </div>
                        <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                            <div className="text-slate-300 mb-1">Sentiment</div>
                            <div className="text-blue-400 font-mono">Positive</div>
                        </div>
                    </div>
                </div>

                {/* Qualification Tracker */}
                <div className="flex-1 bg-slate-900/50 border border-white/10 rounded-2xl p-5 backdrop-blur-sm flex flex-col overflow-hidden">
                    <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Live Context Extraction</h2>

                    <div className="space-y-4 flex-1">
                        {[
                            { key: 'business_type', label: 'Business Type', icon: '🏢' },
                            { key: 'goal', label: 'Primary Goal', icon: '🎯' },
                            { key: 'urgency', label: 'Timeline', icon: '⏱️' },
                            { key: 'budget_readiness', label: 'Budget Status', icon: '💰' },
                        ].map((item) => {
                            const val = qualification[item.key];
                            const isDone = !!val;
                            return (
                                <motion.div
                                    key={item.key}
                                    initial={false}
                                    animate={{ backgroundColor: isDone ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 255, 255, 0.03)' }}
                                    className={`p-3 rounded-lg border transition-colors duration-300 ${isDone ? 'border-green-500/30' : 'border-dashed border-slate-700'}`}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
                                            <span>{item.icon}</span> {item.label}
                                        </div>
                                        {isDone && <CheckCircle2 size={14} className="text-green-500" />}
                                    </div>
                                    <div className="text-xs pl-6 h-4">
                                        {isDone ? (
                                            <span className="text-green-400 font-medium capitalize">{val}</span>
                                        ) : (
                                            <span className="text-slate-600 italic">Analyzing intent...</span>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>

                    {qualificationComplete && (
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="mt-4 p-3 bg-green-500/20 border border-green-500/50 rounded-xl flex items-center gap-3"
                        >
                            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/30">
                                <CheckCircle2 size={16} className="text-black" />
                            </div>
                            <div>
                                <div className="text-sm font-bold text-green-400">Lead Qualified</div>
                                <div className="text-xs text-green-300/70">Ready for handoff</div>
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>
        </div>
    );
}


