'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import PhoneCallUI from '@/components/PhoneCallUI';
import Background3D from '@/components/Background3D';
import CinematicIntro from '@/components/CinematicIntro';
import { motion, AnimatePresence, useScroll, useTransform, useSpring, useMotionValue } from 'framer-motion';
import {
    CheckCircle2, Zap, Globe, Shield, BarChart3, Clock, ArrowRight, Menu,
    Phone, Settings, Link as LinkIcon, Mic, ChevronDown, ChevronUp, Star,
    Headphones, MessageCircle, Heart, Users
} from 'lucide-react';

// Pricing Data
const pricingPlans = [
    {
        name: "Starter",
        price: "$0",
        period: "/mo",
        desc: "For individuals and small tests.",
        features: ["50 AI calls/month", "Sales & Support Modes", "Email support", "1 Agent"],
        cta: "Start Free",
        highlight: false
    },
    {
        name: "Pro",
        price: "$199",
        period: "/mo",
        desc: "For growing support & sales teams.",
        features: ["2,000 AI calls/month", "HubSpot & Zendesk Sync", "Priority support", "5 Agents", "Custom Voice"],
        cta: "Get Pro",
        highlight: true
    },
    {
        name: "Enterprise",
        price: "Custom",
        period: "",
        desc: "Full automation scale.",
        features: ["Unlimited calls", "Salesforce & ServiceNow", "Dedicated Success Manager", "API Access", "SSO"],
        cta: "Contact Sales",
        highlight: false
    }
];

// FAQ Data
const faqs = [
    {
        q: "Can it handle customer support?",
        a: "Yes! You can switch the agent to 'Support Mode' where it focuses on empathy, issue resolution, and answering FAQ based on your knowledge base."
    },
    {
        q: "Is the voice realistic?",
        a: "We use the latest Llama-3 and GPT-4o voice models with ultra-low latency. It handles interruptions and pauses naturally."
    },
    {
        q: "How do I see the data?",
        a: "Sales leads go to your CRM (Salesforce/HubSpot). Support tickets are synced to your desk software (Zendesk/Intercom)."
    },
    {
        q: "Can I customize the script?",
        a: "Absolutely. Provide a system prompt, objection handling rules, and support docs in plain English."
    }
];

export default function LandingPage() {
    const [activeFaq, setActiveFaq] = useState<number | null>(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [showIntro, setShowIntro] = useState(true);

    // 3D Tilt Logic
    const heroRef = useRef<HTMLDivElement>(null);
    const mouseX = useMotionValue(0.5);
    const mouseY = useMotionValue(0.5);

    // Smoother spring physics for tilt
    const rotateX = useSpring(useTransform(mouseY, [0, 1], [12, -12]), { stiffness: 100, damping: 20 });
    const rotateY = useSpring(useTransform(mouseX, [0, 1], [-12, 12]), { stiffness: 100, damping: 20 });

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!heroRef.current) return;
        const rect = heroRef.current.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        const mouseXRelative = (e.clientX - rect.left) / width;
        const mouseYRelative = (e.clientY - rect.top) / height;

        mouseX.set(mouseXRelative);
        mouseY.set(mouseYRelative);
    };

    const handleMouseLeave = () => {
        mouseX.set(0.5);
        mouseY.set(0.5);
    }

    return (
        <div className="min-h-screen bg-[#020617] text-white selection:bg-blue-500/30 font-sans overflow-x-hidden">
            <AnimatePresence>
                {showIntro && <CinematicIntro onComplete={() => setShowIntro(false)} />}
            </AnimatePresence>

            {/* Ambient Backgrounds */}
            <div className="fixed inset-0 animate-aurora pointer-events-none z-0" />
            <div className="fixed inset-0 stars pointer-events-none z-0" />

            {/* Navbar */}
            <nav className="fixed w-full z-50 transition-all duration-300 top-0 pt-4 px-4">
                <div className="max-w-7xl mx-auto glass-premium rounded-2xl h-16 flex items-center justify-between px-6">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <Zap size={16} className="text-white fill-white" />
                        </div>
                        <span className="text-lg font-bold tracking-tight">SalesAI</span>
                    </div>

                    <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
                        <Link href="/playground" className="hover:text-blue-400 text-blue-300 transition-colors flex items-center gap-1">
                            <Zap size={14} /> Playground
                        </Link>
                        <a href="#features" className="hover:text-white transition-colors">Features</a>
                        <a href="#how-it-works" className="hover:text-white transition-colors">How it Works</a>
                        <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
                        <button className="text-white hover:text-blue-400 transition-colors">Log In</button>
                        <button className="bg-white text-black hover:bg-slate-200 py-2 px-4 rounded-full font-bold transition-all transform hover:scale-105">Get Started</button>
                    </div>

                    <div className="md:hidden">
                        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-slate-300 hover:text-white">
                            <Menu />
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section
                ref={heroRef}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                className="relative pt-32 pb-20 lg:pt-48 lg:pb-40 overflow-visible px-4 sm:px-6 perspective-1000"
            >
                {/* 3D Moving Background */}
                <Background3D />

                {/* Spotlights */}
                <div className="absolute top-[10%] left-[20%] w-[500px] h-[500px] bg-blue-600/20 blur-[120px] rounded-full pointer-events-none -z-10 mix-blend-screen animate-pulse" />
                <div className="absolute top-[20%] right-[20%] w-[400px] h-[400px] bg-purple-600/20 blur-[100px] rounded-full pointer-events-none -z-10 mix-blend-screen delay-1000 animate-pulse" />

                <div className="max-w-6xl mx-auto text-center relative z-10">

                    {/* Hero Text Content */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                        className="space-y-8 flex flex-col items-center"
                    >
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300 text-xs font-bold tracking-wide backdrop-blur-md hover:bg-blue-500/20 transition-colors cursor-default uppercase">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                            </span>
                            New: Multi-Mode Voice Engine
                        </div>

                        <h1 className="text-5xl sm:text-6xl lg:text-8xl font-extrabold leading-[1.1] tracking-tight max-w-5xl">
                            The AI Voice Agent for <br className="hidden md:block" />
                            <span className="text-gradient-brand">Sales & Support</span>
                        </h1>

                        <p className="text-lg sm:text-xl text-slate-400 leading-relaxed max-w-2xl mx-auto font-medium">
                            Qualify inbound leads, resolve support tickets, and book meetings over realistic voice calls. One agent, dual capability.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full pt-4">
                            <button className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-lg font-bold py-4 px-8 rounded-full shadow-[0_0_40px_-10px_rgba(79,70,229,0.5)] hover:shadow-[0_0_60px_-10px_rgba(79,70,229,0.6)] hover:scale-105 transition-all duration-300 group flex items-center gap-2">
                                Start Free Trial
                                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                            <button className="glass px-8 py-4 rounded-full text-lg font-medium hover:bg-white/10 transition-all border border-white/10">
                                View Demo
                            </button>
                        </div>
                    </motion.div>

                    {/* 3D Dashboard Demo */}
                    <motion.div
                        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
                        initial={{ opacity: 0, y: 60, rotateX: 20 }}
                        animate={{ opacity: 1, y: 0, rotateX: 0 }}
                        transition={{ duration: 1, delay: 0.2, type: "spring" }}
                        className="relative z-10 w-full mt-24 perspective-1000"
                    >
                        {/* 3D Floating Elements - Notifications */}
                        <motion.div
                            className="absolute -top-12 -right-12 z-20 hidden lg:block translate-z-20 transform transition-transform hover:scale-110"
                            animate={{ y: [0, -15, 0] }}
                            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                        >
                            <div className="glass-premium px-5 py-3 rounded-2xl flex items-center gap-3 backdrop-blur-xl border-green-500/20 shadow-xl shadow-green-900/10">
                                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                                    <CheckCircle2 size={16} className="text-green-400" />
                                </div>
                                <div>
                                    <div className="font-bold text-sm text-white">Lead Qualified</div>
                                    <div className="text-xs text-green-300">Revenue potential: $50k</div>
                                </div>
                            </div>
                        </motion.div>

                        <motion.div
                            className="absolute -bottom-10 -left-10 z-20 hidden lg:block translate-z-20"
                            animate={{ y: [0, 15, 0] }}
                            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                        >
                            <div className="glass-premium px-5 py-3 rounded-2xl flex items-center gap-3 backdrop-blur-xl border-blue-500/20 shadow-xl shadow-blue-900/10">
                                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                                    <Headphones size={16} className="text-blue-400" />
                                </div>
                                <div>
                                    <div className="font-bold text-sm text-white">Ticket Resolved</div>
                                    <div className="text-xs text-blue-300">Support Case #4928</div>
                                </div>
                            </div>
                        </motion.div>

                        <div className="max-w-5xl mx-auto relative px-0 sm:px-4 preserve-3d">
                            {/* Inner Glow/Shadow */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-blue-600/10 blur-[90px] rounded-full pointer-events-none" />

                            {/* Dashboard Container with depth */}
                            <div className="glass-premium rounded-[2.5rem] p-2 ring-1 ring-white/10 shadow-2xl relative bg-[#0B1120]/80 backdrop-blur-2xl translate-z-10">
                                <div className="rounded-[2rem] overflow-hidden border border-white/5 bg-[#020617] relative">
                                    {/* Reflection overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent opacity-20 pointer-events-none z-20" />
                                    <PhoneCallUI />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Social Proof - Infinite Scroll */}
            <section className="py-12 border-y border-white/5 bg-slate-950/50 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto px-6 text-center">
                    <p className="text-xs font-bold text-slate-500 mb-8 uppercase tracking-[0.2em]">Trusted by support & sales teams</p>
                    <div className="relative w-full overflow-hidden mask-gradient">
                        <div className="absolute inset-y-0 left-0 w-40 bg-gradient-to-r from-[#020617] to-transparent z-10" />
                        <div className="absolute inset-y-0 right-0 w-40 bg-gradient-to-l from-[#020617] to-transparent z-10" />

                        <div className="flex w-max gap-20 animate-marquee hover:[animation-play-state:paused] opacity-60 items-center">
                            {[...Array(4)].map((_, groupIndex) => (
                                <div key={groupIndex} className="flex gap-20 shrink-0">
                                    {['Zendesk', 'Salesforce', 'HubSpot', 'Intercom', 'Shopify', 'Freshdesk'].map((brand, i) => (
                                        <span key={i} className="text-3xl font-bold font-serif text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-500 hover:to-white transition-colors cursor-default tracking-tight">
                                            {brand}
                                        </span>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* How It Works - Connected Steps */}
            <section id="how-it-works" className="py-32 relative">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center max-w-3xl mx-auto mb-24">
                        <h2 className="text-4xl lg:text-5xl font-bold mb-6 tracking-tight">One brain. <br /><span className="text-gradient-brand">Two modes.</span></h2>
                        <p className="text-lg text-slate-400">Instantly switch your agent between aggressive sales hunting and empathetic customer support.</p>
                    </div>

                    <div className="relative grid md:grid-cols-3 gap-8">
                        {/* Connecting Line */}
                        <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-blue-500/0 via-blue-500/30 to-blue-500/0 dashed" />

                        {[
                            {
                                step: "01",
                                title: "Connect",
                                desc: "Sync your CRM (Sales) and Knowledge Base (Support).",
                                icon: <LinkIcon className="text-blue-400" size={24} />
                            },
                            {
                                step: "02",
                                title: "Train",
                                desc: "Define two personas: 'Hunter' for sales, 'Helper' for support.",
                                icon: <Settings className="text-indigo-400" size={24} />
                            },
                            {
                                step: "03",
                                title: "Deploy",
                                desc: "Route inbound calls based on intent detection.",
                                icon: <Zap className="text-purple-400" size={24} />
                            }
                        ].map((step, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.2 }}
                                className="relative z-10 flex flex-col items-center text-center"
                            >
                                <div className="w-24 h-24 rounded-3xl glass-premium flex items-center justify-center mb-8 relative group cursor-pointer hover:scale-105 transition-transform duration-300 ring-1 ring-white/10 hover:ring-blue-500/50">
                                    <div className="absolute inset-0 bg-blue-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                                    {step.icon}
                                    <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-xs font-bold font-mono">
                                        {step.step}
                                    </div>
                                </div>
                                <h3 className="text-2xl font-bold mb-4 tracking-tight">{step.title}</h3>
                                <p className="text-slate-400 leading-relaxed max-w-xs font-medium">{step.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features Bgrid */}
            <section id="features" className="py-24 relative">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 md:grid-rows-2 gap-6 h-auto md:h-[800px]">

                        {/* Support & Empathy Feature */}
                        <motion.div
                            whileHover={{ y: -5 }}
                            className="md:col-span-2 md:row-span-2 glass-premium rounded-[2.5rem] p-10 flex flex-col justify-between overflow-hidden relative group"
                        >
                            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/10 blur-[100px] rounded-full pointer-events-none transition-opacity opacity-50 group-hover:opacity-100" />
                            <div className="relative z-10">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center mb-6">
                                    <Heart className="text-indigo-400" />
                                </div>
                                <h3 className="text-3xl font-bold mb-4 tracking-tight">Empathy Engine™</h3>
                                <p className="text-slate-400 text-lg max-w-lg mb-8 font-medium">
                                    Customer support requires patience. Our agents detect frustration and adjust tone instantly, escalating only when absolutely necessary.
                                </p>
                                <div className="w-full h-48 bg-slate-900/50 rounded-2xl border border-white/5 flex items-center justify-center relative overflow-hidden">
                                    {/* Fake Sentiment Visualizer */}
                                    <div className="flex flex-col gap-2 items-center">
                                        <div className="flex items-center gap-1">
                                            {[...Array(20)].map((_, i) => (
                                                <motion.div
                                                    key={i}
                                                    className="w-2 bg-indigo-500 rounded-full"
                                                    animate={{ height: [15, 40 + Math.random() * 40, 15] }}
                                                    transition={{ duration: 0.8 + Math.random() * 0.5, repeat: Infinity }}
                                                />
                                            ))}
                                        </div>
                                        <div className="text-xs font-mono text-indigo-300">SENTIMENT: POSITIVE (98%)</div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        {/* CRM Sync */}
                        <motion.div whileHover={{ y: -5 }} className="glass-premium rounded-[2.5rem] p-8 relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <BarChart3 className="w-10 h-10 text-purple-400 mb-4" />
                            <h3 className="text-xl font-bold mb-2 tracking-tight">Unified Data</h3>
                            <p className="text-slate-400 text-sm font-medium">Sales go to HubSpot. Tickets go to Zendesk. All automatically routed by intent.</p>
                        </motion.div>

                        {/* Languages */}
                        <motion.div whileHover={{ y: -5 }} className="glass-premium rounded-[2.5rem] p-8 relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <Globe className="w-10 h-10 text-green-400 mb-4" />
                            <h3 className="text-xl font-bold mb-2 tracking-tight">Local Presence</h3>
                            <p className="text-slate-400 text-sm font-medium">Support customers in their native language with 30+ dialects and local accents.</p>
                        </motion.div>

                    </div>
                </div>
            </section>

            {/* Testimonials */}
            <section className="py-24 relative border-t border-white/5">
                <div className="max-w-7xl mx-auto px-6">
                    <h2 className="text-3xl lg:text-5xl font-bold text-center mb-16 tracking-tight">Loved by Support & Sales VPs</h2>
                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            { name: "Sarah Jenkins", role: "VP of Sales, TechFlow", text: "We replaced our entire tier-1 SDR team with SalesAI. Connection rates up 40%." },
                            { name: "David Chen", role: "Head of Support, CloudScale", text: "It resolved 60% of tickets without human intervention. Our CSAT score actually went UP." },
                            { name: "Jessica Lee", role: "Director of Ops, ScaleUp", text: "Finally, an AI that handles both sales booking and support triage in one phone number." }
                        ].map((t, i) => (
                            <div key={i} className="glass-premium p-8 rounded-3xl relative hover:bg-white/5 transition-colors">
                                <div className="absolute -top-4 -left-4 text-6xl font-serif text-white/10">"</div>
                                <div className="flex gap-1 text-yellow-500 mb-6 relative z-10">
                                    {[...Array(5)].map((_, j) => <Star key={j} size={16} fill="currentColor" />)}
                                </div>
                                <p className="text-lg text-slate-300 mb-6 leading-relaxed relative z-10 font-medium">{t.text}</p>
                                <div className="flex items-center gap-3 border-t border-white/5 pt-4">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center font-bold text-white text-sm">
                                        {t.name[0]}
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm">{t.name}</div>
                                        <div className="text-xs text-slate-500">{t.role}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Pricing */}
            <section id="pricing" className="py-32 relative">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-900/10 to-transparent pointer-events-none" />
                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <div className="text-center max-w-3xl mx-auto mb-20">
                        <h2 className="text-4xl lg:text-5xl font-bold mb-6 tracking-tight">Transparent <span className="text-gradient-brand">pricing</span></h2>
                        <p className="text-slate-400 text-lg">One subscription for both sales and support agents.</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                        {pricingPlans.map((plan, i) => (
                            <div key={i} className={`relative p-10 rounded-[2rem] border transition-all duration-300 hover:scale-[1.02] ${plan.highlight ? 'bg-slate-900/80 border-blue-500/50 shadow-2xl shadow-blue-900/20' : 'glass-premium border-white/5'}`}>
                                {plan.highlight && (
                                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider shadow-lg shadow-blue-500/40">
                                        Best Value
                                    </div>
                                )}
                                <h3 className="text-xl font-bold mb-2 tracking-tight">{plan.name}</h3>
                                <div className="flex items-baseline gap-1 mb-6">
                                    <span className="text-4xl font-bold">{plan.price}</span>
                                    <span className="text-slate-500">{plan.period}</span>
                                </div>
                                <p className="text-sm text-slate-400 mb-8 font-medium">{plan.desc}</p>
                                <button className={`w-full py-4 rounded-xl font-bold mb-8 transition-all ${plan.highlight ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25' : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'}`}>
                                    {plan.cta}
                                </button>
                                <ul className="space-y-4">
                                    {plan.features.map((f, j) => (
                                        <li key={j} className="flex items-center gap-3 text-sm text-slate-300 font-medium">
                                            <CheckCircle2 size={16} className={plan.highlight ? 'text-blue-400' : 'text-slate-500'} />
                                            {f}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <section className="py-24">
                <div className="max-w-3xl mx-auto px-6">
                    <h2 className="text-3xl font-bold text-center mb-12 tracking-tight">Frequently asked questions</h2>
                    <div className="space-y-4">
                        {faqs.map((faq, i) => (
                            <div key={i} className="glass-premium rounded-2xl overflow-hidden hover:bg-white/5 transition-colors border border-white/5">
                                <button
                                    onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                                    className="w-full flex items-center justify-between p-6 text-left"
                                >
                                    <span className="font-medium text-lg">{faq.q}</span>
                                    {activeFaq === i ? <ChevronUp size={20} className="text-blue-400" /> : <ChevronDown size={20} className="text-slate-500" />}
                                </button>
                                <AnimatePresence>
                                    {activeFaq === i && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="p-6 pt-0 text-slate-400 leading-relaxed border-t border-white/5 mt-2 font-medium">
                                                {faq.a}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Big CTA */}
            <section className="py-32 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-blue-900/20 to-slate-950 pointer-events-none" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/10 blur-[150px] rounded-full pointer-events-none" />

                <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
                    <h2 className="text-5xl lg:text-7xl font-bold mb-8 tracking-tight">Ready to <span className="text-gradient-brand">transform support?</span></h2>
                    <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto font-medium">
                        Join 2,000+ companies using SalesAI for Sales & Customer Success.
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <button className="bg-white text-black text-lg font-bold px-10 py-5 rounded-full hover:scale-105 transition-transform shadow-2xl">Start Free Trial</button>
                        <button className="glass px-10 py-5 rounded-full text-lg font-medium hover:bg-white/10 transition-colors border border-white/10">Talk to Sales</button>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-white/5 bg-slate-950 py-16 relative z-10">
                <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-4 gap-12 text-sm text-slate-400">
                    <div>
                        <div className="flex items-center gap-2 mb-6">
                            <Zap size={18} className="text-blue-500" />
                            <span className="text-lg font-bold text-white">SalesAI</span>
                        </div>
                        <p className="mb-6 leading-relaxed font-medium">Automating the future of sales conversations & support tickets with human-like AI.</p>
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 cursor-pointer transition-colors border border-white/5" />
                            <div className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 cursor-pointer transition-colors border border-white/5" />
                        </div>
                    </div>
                    <div>
                        <h4 className="font-bold text-white mb-6">Product</h4>
                        <ul className="space-y-3 font-medium">
                            <li><a href="#" className="hover:text-blue-400 transition-colors">Sales Agent</a></li>
                            <li><a href="#" className="hover:text-blue-400 transition-colors">Support Agent</a></li>
                            <li><a href="#" className="hover:text-blue-400 transition-colors">Pricing</a></li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-bold text-white mb-6">Company</h4>
                        <ul className="space-y-3 font-medium">
                            <li><a href="#" className="hover:text-blue-400 transition-colors">About</a></li>
                            <li><a href="#" className="hover:text-blue-400 transition-colors">Careers</a></li>
                            <li><a href="#" className="hover:text-blue-400 transition-colors">Contact</a></li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-bold text-white mb-6">Legal</h4>
                        <ul className="space-y-3 font-medium">
                            <li><a href="#" className="hover:text-blue-400 transition-colors">Privacy</a></li>
                            <li><a href="#" className="hover:text-blue-400 transition-colors">Terms</a></li>
                        </ul>
                    </div>
                </div>
                <div className="max-w-7xl mx-auto px-6 pt-12 mt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-600 font-medium">
                    <div className="flex flex-col md:flex-row items-center gap-4">
                        <span>© 2024 SalesAI Inc. All rights reserved.</span>
                        <span className="hidden md:block w-1 h-1 bg-slate-700 rounded-full"></span>
                        <span className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-full border border-white/5">
                            <span className="text-slate-500">Incubated by</span>
                            <span className="text-slate-300 font-bold tracking-wide">DETOVA LABS</span>
                        </span>
                    </div>
                    <div className="flex gap-8">
                        <span>San Francisco • London • Tokyo</span>
                    </div>
                </div>
            </footer>
        </div>
    );
}
