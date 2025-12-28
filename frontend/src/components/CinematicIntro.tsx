'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence, useSpring, useMotionValue, useTransform } from 'framer-motion';
import { Phone, Zap, Waves } from 'lucide-react';

interface Particle {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    opacity: number;
    hue: number;
}

interface CinematicIntroProps {
    onComplete: () => void;
}

export default function CinematicIntro({ onComplete }: CinematicIntroProps) {
    const [phase, setPhase] = useState<'void' | 'signal' | 'interface' | 'answering'>('void');
    const [holdProgress, setHoldProgress] = useState(0);
    const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
    const [isHolding, setIsHolding] = useState(false);

    const holdInterval = useRef<NodeJS.Timeout | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const particlesRef = useRef<Particle[]>([]);
    const animationFrameRef = useRef<number>();

    // Advanced physics springs
    const buttonScale = useSpring(1, { stiffness: 400, damping: 25 });
    const buttonRotate = useSpring(0, { stiffness: 300, damping: 30 });
    const cursorGlowScale = useSpring(1, { stiffness: 200, damping: 20 });

    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    // Parallax effects - reduced intensity for stability
    const parallaxX = useTransform(mouseX, [-500, 500], [-5, 5]);
    const parallaxY = useTransform(mouseY, [-500, 500], [-5, 5]);

    // Lock scroll
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

    // Cursor tracking with smooth interpolation
    useEffect(() => {
        let rafId: number;
        let targetX = 0;
        let targetY = 0;
        let currentX = 0;
        let currentY = 0;

        const handleMouseMove = (e: MouseEvent) => {
            targetX = e.clientX - window.innerWidth / 2;
            targetY = e.clientY - window.innerHeight / 2;
            setCursorPos({ x: e.clientX, y: e.clientY });
        };

        const smoothUpdate = () => {
            // Smooth interpolation with reduced parallax intensity
            currentX += (targetX - currentX) * 0.05;
            currentY += (targetY - currentY) * 0.05;

            mouseX.set(currentX);
            mouseY.set(currentY);

            rafId = requestAnimationFrame(smoothUpdate);
        };

        smoothUpdate();
        window.addEventListener('mousemove', handleMouseMove);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            cancelAnimationFrame(rafId);
        };
    }, [mouseX, mouseY]);

    // Particle system initialization
    useEffect(() => {
        const particleCount = 150;
        particlesRef.current = Array.from({ length: particleCount }, (_, i) => ({
            id: i,
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            size: Math.random() * 2 + 0.5,
            opacity: Math.random() * 0.5 + 0.2,
            hue: Math.random() * 60 + 200, // Blue spectrum
        }));
    }, []);

    // Advanced particle animation with neural network effect
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const animate = () => {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const particles = particlesRef.current;
            const connectionDistance = phase === 'signal' ? 150 : 100;

            // Update and draw particles
            particles.forEach((particle, i) => {
                // Update position
                particle.x += particle.vx;
                particle.y += particle.vy;

                // Wrap around edges
                if (particle.x < 0) particle.x = canvas.width;
                if (particle.x > canvas.width) particle.x = 0;
                if (particle.y < 0) particle.y = canvas.height;
                if (particle.y > canvas.height) particle.y = 0;

                // Attract to cursor during interface phase - reduced intensity
                if (phase === 'interface') {
                    const dx = cursorPos.x - particle.x;
                    const dy = cursorPos.y - particle.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 200) {
                        particle.vx += dx * 0.00002; // Reduced from 0.00005
                        particle.vy += dy * 0.00002;
                    }
                }

                // Draw particle
                ctx.beginPath();
                ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${particle.hue}, 70%, 60%, ${particle.opacity})`;
                ctx.fill();

                // Draw connections (neural network effect)
                if (phase === 'signal' || phase === 'interface') {
                    particles.slice(i + 1).forEach(otherParticle => {
                        const dx = particle.x - otherParticle.x;
                        const dy = particle.y - otherParticle.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);

                        if (distance < connectionDistance) {
                            ctx.beginPath();
                            ctx.moveTo(particle.x, particle.y);
                            ctx.lineTo(otherParticle.x, otherParticle.y);
                            const opacity = (1 - distance / connectionDistance) * 0.3;
                            ctx.strokeStyle = `rgba(59, 130, 246, ${opacity})`;
                            ctx.lineWidth = 0.5;
                            ctx.stroke();
                        }
                    });
                }
            });

            animationFrameRef.current = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [phase, cursorPos]);

    // Phase progression with perfect timing
    useEffect(() => {
        if (phase === 'void') {
            const timer = setTimeout(() => setPhase('signal'), 3000);
            return () => clearTimeout(timer);
        }
        if (phase === 'signal') {
            const timer = setTimeout(() => setPhase('interface'), 3500);
            return () => clearTimeout(timer);
        }
    }, [phase]);

    // Hold interaction
    const startHold = () => {
        setIsHolding(true);
        buttonScale.set(0.85);
        buttonRotate.set(180);
        cursorGlowScale.set(2);

        if (holdInterval.current) clearInterval(holdInterval.current);

        holdInterval.current = setInterval(() => {
            setHoldProgress(prev => {
                if (prev >= 100) {
                    completeAccess();
                    return 100;
                }
                return prev + 1.5;
            });
        }, 20);
    };

    const stopHold = () => {
        setIsHolding(false);
        buttonScale.set(1);
        buttonRotate.set(0);
        cursorGlowScale.set(1);
        if (holdInterval.current) clearInterval(holdInterval.current);
        setHoldProgress(0);
    };

    const completeAccess = () => {
        if (holdInterval.current) clearInterval(holdInterval.current);
        setPhase('answering');
        setTimeout(onComplete, 1200);
    };

    return (
        <motion.div
            className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center overflow-hidden"
            initial={{ opacity: 1 }}
            exit={{
                opacity: 0,
                scale: 1.2,
                filter: "blur(20px)",
                transition: { duration: 1.2, ease: [0.45, 0, 0.55, 1] }
            }}
        >
            {/* Particle Canvas */}
            <canvas
                ref={canvasRef}
                className="fixed inset-0 pointer-events-none"
                style={{ mixBlendMode: 'screen' }}
            />

            {/* Cursor Glow */}
            <motion.div
                className="fixed w-96 h-96 rounded-full pointer-events-none z-0"
                style={{
                    left: cursorPos.x - 192,
                    top: cursorPos.y - 192,
                    scale: cursorGlowScale,
                    background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)',
                    filter: 'blur(40px)',
                }}
            />

            {/* Gradient Overlays */}
            <div className="fixed inset-0 bg-gradient-to-br from-blue-950/20 via-transparent to-purple-950/20 pointer-events-none" />
            <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)] pointer-events-none" />

            <AnimatePresence mode="wait">

                {/* PHASE 1: THE VOID - Cosmic Awakening */}
                {phase === 'void' && (
                    <motion.div
                        key="void"
                        className="relative flex flex-col items-center z-10"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{
                            scale: 0.3,
                            opacity: 0,
                            filter: "blur(20px)",
                            transition: { duration: 1, ease: "easeInOut" }
                        }}
                    >
                        <motion.div
                            className="relative w-32 h-32 flex items-center justify-center"
                            style={{ x: parallaxX, y: parallaxY }}
                        >
                            {/* Cosmic Rings */}
                            {[1, 2, 3, 4].map(i => (
                                <motion.div
                                    key={i}
                                    className="absolute inset-0 rounded-full border border-blue-500/20"
                                    animate={{
                                        scale: [1, 3 + i * 0.5],
                                        opacity: [0.6, 0],
                                        rotate: [0, 180]
                                    }}
                                    transition={{
                                        duration: 3,
                                        repeat: Infinity,
                                        delay: i * 0.5,
                                        ease: "easeOut"
                                    }}
                                />
                            ))}

                            {/* Core Pulse */}
                            <motion.div
                                className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600"
                                animate={{
                                    scale: [1, 1.2, 1],
                                    boxShadow: [
                                        '0 0 20px rgba(59,130,246,0.5)',
                                        '0 0 60px rgba(59,130,246,0.8)',
                                        '0 0 20px rgba(59,130,246,0.5)'
                                    ]
                                }}
                                transition={{ duration: 2, repeat: Infinity }}
                            />
                        </motion.div>

                        <motion.div
                            className="absolute top-48 text-center space-y-3"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.8 }}
                        >
                            <p className="text-blue-300 font-mono text-[10px] tracking-[0.6em] uppercase">
                                Neural Link
                            </p>
                            <motion.div className="flex gap-1 justify-center">
                                {[0, 1, 2].map(i => (
                                    <motion.div
                                        key={i}
                                        className="w-1.5 h-1.5 rounded-full bg-blue-500"
                                        animate={{ opacity: [0.3, 1, 0.3] }}
                                        transition={{
                                            duration: 1.5,
                                            repeat: Infinity,
                                            delay: i * 0.3
                                        }}
                                    />
                                ))}
                            </motion.div>
                        </motion.div>
                    </motion.div>
                )}

                {/* PHASE 2: SIGNAL DETECTED - Neural Formation */}
                {phase === 'signal' && (
                    <motion.div
                        key="signal"
                        className="relative flex flex-col items-center z-10"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, y: -50, transition: { duration: 0.8 } }}
                    >
                        {/* Waveform Visualization */}
                        <div className="relative w-full max-w-2xl h-32 flex items-center justify-center gap-1 mb-16">
                            {Array.from({ length: 60 }).map((_, i) => {
                                const height = Math.sin(i * 0.3) * 30 + 40;
                                return (
                                    <motion.div
                                        key={i}
                                        className="w-1 bg-gradient-to-t from-blue-600 to-blue-400 rounded-full"
                                        initial={{ height: 0 }}
                                        animate={{
                                            height: [height * 0.3, height, height * 0.5, height],
                                            opacity: [0.3, 1, 0.6, 1]
                                        }}
                                        transition={{
                                            duration: 2,
                                            repeat: Infinity,
                                            delay: i * 0.02,
                                            ease: "easeInOut"
                                        }}
                                    />
                                );
                            })}
                        </div>

                        <motion.div
                            className="text-center space-y-6"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                        >
                            <motion.div
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-green-500/30 bg-green-500/10 backdrop-blur-xl"
                                animate={{
                                    boxShadow: [
                                        '0 0 20px rgba(34,197,94,0.2)',
                                        '0 0 40px rgba(34,197,94,0.4)',
                                        '0 0 20px rgba(34,197,94,0.2)'
                                    ]
                                }}
                                transition={{ duration: 2, repeat: Infinity }}
                            >
                                <motion.div
                                    className="w-2 h-2 bg-green-500 rounded-full"
                                    animate={{ scale: [1, 1.5, 1] }}
                                    transition={{ duration: 1, repeat: Infinity }}
                                />
                                <span className="text-[11px] uppercase tracking-[0.3em] text-green-400 font-semibold">
                                    Signal Detected
                                </span>
                            </motion.div>

                            <h2 className="text-4xl md:text-6xl font-light tracking-tight text-white">
                                Incoming <span className="font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Intelligence</span>
                            </h2>

                            <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
                                A moment that could redefine how your business operates is requesting connection.
                            </p>
                        </motion.div>
                    </motion.div>
                )}

                {/* PHASE 3: INTERFACE - The Call */}
                {phase === 'interface' && (
                    <motion.div
                        key="interface"
                        className="relative z-10 flex flex-col items-center"
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ type: "spring", damping: 30, stiffness: 200 }}
                    >
                        {/* Logo & Brand */}
                        <motion.div
                            className="mb-20 text-center space-y-6"
                        >
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.3 }}
                                className="inline-flex items-center gap-3 px-4 py-2 rounded-full border border-blue-500/20 bg-blue-900/10 backdrop-blur-2xl mb-6"
                            >
                                <motion.div
                                    className="w-2 h-2 bg-green-500 rounded-full"
                                    animate={{
                                        scale: [1, 1.3, 1],
                                        opacity: [1, 0.5, 1]
                                    }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                />
                                <span className="text-[10px] uppercase tracking-[0.4em] text-blue-300 font-medium">
                                    Secure Neural Channel
                                </span>
                            </motion.div>

                            <motion.h1
                                className="text-6xl md:text-8xl font-bold tracking-tighter"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.5 }}
                            >
                                <span className="text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-100 to-slate-400">
                                    Sales
                                </span>
                                <span className="text-transparent bg-clip-text bg-gradient-to-br from-blue-400 to-blue-600">
                                    AI
                                </span>
                                <motion.span
                                    className="text-blue-500"
                                    animate={{ opacity: [1, 0.5, 1] }}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                >
                                    .
                                </motion.span>
                            </motion.h1>

                            <motion.p
                                className="text-slate-400 max-w-md mx-auto text-sm leading-relaxed"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.7 }}
                            >
                                The world's first multi-modal voice intelligence system
                                <br />
                                <span className="text-blue-400">is calling you.</span>
                            </motion.p>
                        </motion.div>

                        {/* The Sacred Button */}
                        <div className="relative">
                            {/* Outer Glow Ring */}
                            <motion.div
                                className="absolute -inset-8 rounded-full"
                                animate={{
                                    background: [
                                        'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)',
                                        'radial-gradient(circle, rgba(59,130,246,0.2) 0%, transparent 70%)',
                                        'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)'
                                    ]
                                }}
                                transition={{ duration: 3, repeat: Infinity }}
                            />

                            {/* Progress Ring SVG */}
                            <svg className="w-56 h-56 -rotate-90 transform absolute -inset-4" viewBox="0 0 100 100">
                                <defs>
                                    <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="#3b82f6" />
                                        <stop offset="100%" stopColor="#8b5cf6" />
                                    </linearGradient>
                                </defs>
                                <circle
                                    cx="50" cy="50" r="48"
                                    stroke="rgba(255,255,255,0.05)"
                                    strokeWidth="1"
                                    fill="none"
                                />
                                <motion.circle
                                    cx="50" cy="50" r="48"
                                    stroke="url(#progressGradient)"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    fill="none"
                                    style={{
                                        pathLength: holdProgress / 100,
                                        filter: 'drop-shadow(0 0 8px rgba(59,130,246,0.6))'
                                    }}
                                    transition={{ duration: 0.05 }}
                                />
                            </svg>

                            {/* The Button Itself */}
                            <motion.button
                                style={{
                                    scale: buttonScale,
                                    rotateZ: buttonRotate
                                }}
                                onMouseDown={startHold}
                                onMouseUp={stopHold}
                                onMouseLeave={stopHold}
                                onTouchStart={startHold}
                                onTouchEnd={stopHold}
                                className="relative w-48 h-48 rounded-full bg-gradient-to-br from-slate-900 via-slate-800 to-black border border-white/10 shadow-2xl flex flex-col items-center justify-center gap-3 group cursor-pointer overflow-hidden transition-shadow duration-500"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                {/* Inner Animated Gradient */}
                                <motion.div
                                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                    animate={{
                                        background: [
                                            'radial-gradient(circle at 50% 50%, rgba(59,130,246,0.2) 0%, transparent 50%)',
                                            'radial-gradient(circle at 50% 50%, rgba(139,92,246,0.2) 0%, transparent 50%)',
                                            'radial-gradient(circle at 50% 50%, rgba(59,130,246,0.2) 0%, transparent 50%)'
                                        ]
                                    }}
                                    transition={{ duration: 3, repeat: Infinity }}
                                />

                                {/* Icon */}
                                <motion.div
                                    animate={isHolding ? {
                                        scale: [1, 1.2, 1],
                                        rotate: [0, 180, 360]
                                    } : {}}
                                    transition={{ duration: 0.6 }}
                                >
                                    <Zap
                                        size={48}
                                        className={`${isHolding ? 'text-blue-400' : 'text-white/70'} transition-colors fill-current drop-shadow-lg`}
                                    />
                                </motion.div>

                                {/* Label */}
                                <span className={`text-[11px] font-bold tracking-[0.3em] uppercase transition-all duration-300 ${isHolding ? 'text-blue-300' : 'text-slate-500'}`}>
                                    {isHolding ? 'Connecting' : 'Hold to Answer'}
                                </span>

                                {/* Progress Percentage */}
                                {isHolding && (
                                    <motion.span
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="absolute bottom-6 text-blue-400 text-xs font-mono"
                                    >
                                        {Math.round(holdProgress)}%
                                    </motion.span>
                                )}
                            </motion.button>
                        </div>

                        {/* Audio Visualizer Bars */}
                        <div className="mt-16 flex gap-2">
                            {Array.from({ length: 7 }).map((_, i) => (
                                <motion.div
                                    key={i}
                                    className="w-1 bg-gradient-to-t from-blue-600 to-blue-400 rounded-full"
                                    animate={{
                                        height: [20, 40 + Math.random() * 20, 20],
                                        opacity: [0.3, 1, 0.3]
                                    }}
                                    transition={{
                                        duration: 1 + Math.random(),
                                        repeat: Infinity,
                                        delay: i * 0.1
                                    }}
                                />
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* PHASE 4: ANSWERING - Reality Dissolves */}
                {phase === 'answering' && (
                    <motion.div
                        key="answering"
                        className="flex flex-col items-center z-10"
                        initial={{ opacity: 0, scale: 1.2 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                    >
                        <motion.div
                            className="text-center"
                            animate={{
                                filter: ['blur(0px)', 'blur(10px)'],
                                opacity: [1, 0]
                            }}
                            transition={{ duration: 1 }}
                        >
                            <Waves size={64} className="text-blue-500 mx-auto mb-6" />
                            <h2 className="text-4xl font-light text-white tracking-tight">
                                Connection <span className="font-bold">Established</span>
                            </h2>
                        </motion.div>
                    </motion.div>
                )}

            </AnimatePresence>

            {/* Vignette */}
            <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.7)_100%)] z-0" />
        </motion.div>
    );
}