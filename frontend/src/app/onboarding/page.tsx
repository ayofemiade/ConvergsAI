'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronRight,
    ChevronLeft,
    Zap,
    User,
    ShieldCheck,
    Globe,
    Settings2,
    Database,
    CheckCircle2,
    ArrowRight,
    Wand2,
    Building2,
    Link2,
    Bot,
    Sparkles
} from 'lucide-react';
import Link from 'next/link';

// --- TYPES ---
type Step = 'welcome' | 'use-case' | 'business' | 'crm' | 'agent' | 'knowledge' | 'go-live';

const STEPS: Step[] = ['welcome', 'use-case', 'business', 'crm', 'agent', 'knowledge', 'go-live'];

const STEP_LABELS = {
    'welcome': 'Welcome',
    'use-case': 'Use Case',
    'business': 'Business',
    'crm': 'CRM',
    'agent': 'Agent',
    'knowledge': 'Knowledge',
    'go-live': 'Go Live'
};

// --- COMPONENTS ---

const ProgressIndicator = ({ currentStep }: { currentStep: Step }) => {
    const currentIndex = STEPS.indexOf(currentStep);

    return (
        <div className="fixed top-0 left-0 right-0 z-[100] px-6 py-4 bg-slate-950/50 backdrop-blur-xl border-b border-white/5">
            <div className="max-w-4xl mx-auto flex items-center justify-between">
                {STEPS.map((step, idx) => {
                    const isActive = idx <= currentIndex;
                    const isCurrent = step === currentStep;

                    return (
                        <div key={step} className="flex items-center gap-2">
                            <div className={`
                                w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500
                                ${isCurrent ? 'bg-blue-600 text-white ring-4 ring-blue-500/20' :
                                    isActive ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' :
                                        'bg-white/5 text-slate-600 border border-white/5'}
                            `}>
                                {isActive && !isCurrent ? <CheckCircle2 size={14} /> : idx + 1}
                            </div>
                            <span className={`
                                hidden md:block text-[10px] font-black uppercase tracking-widest transition-colors duration-500
                                ${isCurrent ? 'text-white' : isActive ? 'text-blue-400/70' : 'text-slate-700'}
                            `}>
                                {STEP_LABELS[step]}
                            </span>
                            {idx < STEPS.length - 1 && (
                                <div className={`hidden lg:block w-8 h-[1px] mx-2 ${idx < currentIndex ? 'bg-blue-600/30' : 'bg-white/5'}`} />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default function OnboardingPage() {
    const [currentStep, setCurrentStep] = useState<Step>('welcome');
    const [formData, setFormData] = useState({
        useCase: 'sales', // sales, support, both
        businessName: '',
        industry: '',
        crm: null,
        tone: 'professional',
        style: 50, // 0-100
        knowledgeUrl: '',
    });

    const nextStep = () => {
        const idx = STEPS.indexOf(currentStep);
        if (idx < STEPS.length - 1) setCurrentStep(STEPS[idx + 1]);
    };

    const prevStep = () => {
        const idx = STEPS.indexOf(currentStep);
        if (idx > 0) setCurrentStep(STEPS[idx - 1]);
    };

    const skipStep = () => nextStep();

    // --- STEP RENDERS ---

    const renderUseCase = () => (
        <motion.div
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="space-y-12 max-w-3xl mx-auto"
        >
            <div className="text-center space-y-4">
                <h2 className="text-4xl font-bold text-white tracking-tight">What do you want ConvergsAI to handle first?</h2>
                <p className="text-slate-400">You can add more capabilities or change this anytime.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                {[
                    { id: 'sales', title: 'Sales Calls', icon: <Zap className="text-green-400" />, desc: ['Qualify leads', 'Answer product questions', 'Book meetings'] },
                    { id: 'support', title: 'Customer Support', icon: <User className="text-blue-400" />, desc: ['Handle FAQs', 'Calm frustrated customers', 'Resolve issues'] },
                    { id: 'both', title: 'Both (Recommended)', icon: <Bot className="text-indigo-400" />, desc: ['One agent, multiple modes', 'Automatically adapts per call', 'Maximum efficiency'] },
                ].map((item) => (
                    <button
                        key={item.id}
                        onClick={() => setFormData({ ...formData, useCase: item.id })}
                        className={`
                            p-8 rounded-[32px] border text-left transition-all duration-300 relative overflow-hidden group
                            ${formData.useCase === item.id
                                ? 'bg-blue-600/10 border-blue-500/50 ring-2 ring-blue-500/20'
                                : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'}
                        `}
                    >
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 ${formData.useCase === item.id ? 'bg-blue-600/20' : 'bg-white/5'}`}>
                            {item.icon}
                        </div>
                        <h3 className="text-xl font-bold text-white mb-4">{item.title}</h3>
                        <ul className="space-y-2">
                            {item.desc.map((d, i) => (
                                <li key={i} className="text-xs text-slate-500 flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-slate-700" /> {d}
                                </li>
                            ))}
                        </ul>
                        {formData.useCase === item.id && (
                            <motion.div layoutId="activeUseCase" className="absolute top-4 right-4">
                                <CheckCircle2 className="text-blue-500" size={24} />
                            </motion.div>
                        )}
                    </button>
                ))}
            </div>
        </motion.div>
    );

    const renderBusiness = () => (
        <motion.div
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="space-y-12 max-w-xl mx-auto"
        >
            <div className="text-center space-y-4">
                <h2 className="text-4xl font-bold text-white tracking-tight">Business Basics</h2>
                <p className="text-slate-400">Tell us a bit about your company to help the AI sound natural.</p>
            </div>

            <div className="space-y-6">
                <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-500">Business Name</label>
                    <input
                        type="text"
                        value={formData.businessName}
                        onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                        placeholder="e.g. Acme Corp"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                </div>
                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-500">Industry</label>
                        <select
                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none"
                            value={formData.industry}
                            onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                        >
                            <option value="">Select...</option>
                            <option value="SaaS">SaaS</option>
                            <option value="Real Estate">Real Estate</option>
                            <option value="Healthcare">Healthcare</option>
                            <option value="Retail">Retail</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div className="space-y-2 text-left">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-500">Work Hours</label>
                        <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-lg font-medium text-slate-500 flex items-center justify-between">
                            Mon - Fri, 9-5
                            <Settings2 size={18} />
                        </div>
                    </div>
                </div>

                <div className="bg-blue-600/5 border border-blue-500/20 rounded-2xl p-4 flex gap-4 items-start">
                    <Sparkles className="text-blue-400 shrink-0 mt-1" size={18} />
                    <p className="text-xs text-blue-300/70 leading-relaxed">
                        This context helps ConvergsAI handle nuances, respect your working hours, and greet customers properly.
                    </p>
                </div>
            </div>
        </motion.div>
    );

    const renderCRM = () => (
        <motion.div
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="space-y-12 max-w-3xl mx-auto"
        >
            <div className="text-center space-y-4">
                <h2 className="text-4xl font-bold text-white tracking-tight">Connect Your CRM (Optional)</h2>
                <p className="text-slate-400">ConvergsAI works perfectly without a CRM, but connecting one unlocks deeper automation.</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {['HubSpot', 'Salesforce', 'Zendesk', 'Freshdesk', 'Zoho'].map((crm) => (
                    <button
                        key={crm}
                        onClick={() => setFormData({ ...formData, crm: crm as any })}
                        className={`
                            p-6 rounded-[24px] border text-center transition-all duration-300 flex flex-col items-center gap-4
                            ${formData.crm === crm
                                ? 'bg-blue-600/10 border-blue-500/50 ring-2 ring-blue-500/20'
                                : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'}
                        `}
                    >
                        <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center font-bold text-xs uppercase text-slate-500">
                            {crm[0]}
                        </div>
                        <span className="font-bold text-sm tracking-tight">{crm}</span>
                        {formData.crm === crm && <CheckCircle2 className="text-blue-500" size={18} />}
                    </button>
                ))}
            </div>

            <div className="text-center">
                <p className="text-xs text-slate-500 flex items-center justify-center gap-2">
                    <ShieldCheck size={14} /> Agent still works perfectly using session memory and internal lead tracking.
                </p>
            </div>
        </motion.div>
    );

    const renderAgentBehavior = () => (
        <motion.div
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="space-y-12 max-w-2xl mx-auto"
        >
            <div className="text-center space-y-4">
                <h2 className="text-4xl font-bold text-white tracking-tight">Shape how your AI speaks</h2>
                <p className="text-slate-400">Sliding these values instantly tunes the agent's prompt architecture.</p>
            </div>

            <div className="space-y-10">
                <div className="space-y-4">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-500">Agent Tone</label>
                    <div className="grid grid-cols-3 gap-4">
                        {['Friendly', 'Professional', 'Assertive'].map((tone) => (
                            <button
                                key={tone}
                                onClick={() => setFormData({ ...formData, tone: tone.toLowerCase() })}
                                className={`
                                    py-4 rounded-xl border font-bold transition-all
                                    ${formData.tone === tone.toLowerCase()
                                        ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20'
                                        : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'}
                                `}
                            >
                                {tone}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-8">
                    <div className="space-y-4">
                        <div className="flex justify-between items-end">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-500">Speech Style</label>
                            <span className="text-sm font-bold text-blue-400">
                                {formData.style < 40 ? 'Soft Discovery' : formData.style > 60 ? 'Direct Closer' : 'Balanced'}
                            </span>
                        </div>
                        <input
                            type="range"
                            min="0" max="100"
                            value={formData.style}
                            onChange={(e) => setFormData({ ...formData, style: parseInt(e.target.value) })}
                            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                        <div className="flex justify-between text-[10px] font-bold text-slate-600 uppercase tracking-tighter">
                            <span>Discovery Mode</span>
                            <span>Conversion Mode</span>
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-white/[0.02] border border-white/5 rounded-[24px] flex gap-4 items-center">
                    <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center">
                        <Wand2 size={20} className="text-blue-500" />
                    </div>
                    <div>
                        <div className="text-sm font-bold text-white">Dynamic Adaptation</div>
                        <p className="text-xs text-slate-500">Your agent will automatically adjust its vocabulary based on these settings.</p>
                    </div>
                </div>
            </div>
        </motion.div>
    );

    const renderKnowledge = () => (
        <motion.div
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="space-y-12 max-w-xl mx-auto"
        >
            <div className="text-center space-y-4">
                <h2 className="text-4xl font-bold text-white tracking-tight">What should your agent know?</h2>
                <p className="text-slate-400">Provide a source, and we'll train the agent's knowledge brain instantly.</p>
            </div>

            <div className="space-y-8">
                <div className="space-y-4">
                    <div className="flex items-center gap-3 p-5 bg-white/5 border border-white/10 rounded-2xl focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                        <Link2 className="text-slate-500" size={20} />
                        <input
                            type="text"
                            placeholder="https://yourwebsite.com"
                            value={formData.knowledgeUrl}
                            onChange={(e) => setFormData({ ...formData, knowledgeUrl: e.target.value })}
                            className="bg-transparent border-none text-white text-lg font-medium focus:outline-none w-full"
                        />
                    </div>
                    <div className="flex items-center justify-center gap-4">
                        <div className="h-[1px] flex-1 bg-white/5" />
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">OR</span>
                        <div className="h-[1px] flex-1 bg-white/5" />
                    </div>
                    <button className="w-full py-4 bg-white/5 border border-dashed border-white/10 rounded-2xl flex items-center justify-center gap-3 text-slate-400 hover:bg-white/10 transition-all font-bold">
                        <Database size={18} /> Upload FAQs or Document
                    </button>
                </div>

                <div className="text-center italic text-slate-500 text-xs text-slate-600">
                    "Don't worry, we'll use ConvergsAI industry defaults if you skip this."
                </div>
            </div>
        </motion.div>
    );

    const renderGoLive = () => (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col items-center text-center space-y-10 max-w-2xl mx-auto"
        >
            <div className="relative">
                <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
                    transition={{ duration: 4, repeat: Infinity }}
                    className="absolute inset-0 bg-green-500/30 blur-[100px] rounded-full"
                />
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center shadow-2xl relative z-10 border-4 border-white/20">
                    <Sparkles size={64} className="text-white" />
                </div>
            </div>

            <div className="space-y-4">
                <h2 className="text-5xl font-black text-white tracking-tight">Your Agent is Ready</h2>
                <div className="flex items-center justify-center gap-3">
                    <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-widest border border-blue-500/30">
                        {formData.useCase} Mode
                    </span>
                    <span className="px-3 py-1 rounded-full bg-white/5 text-slate-400 text-[10px] font-black uppercase tracking-widest border border-white/5">
                        {formData.tone} Tone
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                <Link
                    href="/playground"
                    className="p-6 bg-white text-black rounded-[24px] font-bold text-xl flex flex-col items-center gap-3 hover:scale-[1.03] transition-all shadow-xl"
                >
                    <ArrowRight size={24} />
                    Try In Playground
                </Link>
                <div className="p-6 bg-white/5 border border-white/10 rounded-[24px] flex flex-col items-center justify-center gap-2 group cursor-pointer hover:bg-white/10 transition-all">
                    <div className="text-slate-400 font-bold">Go to Dashboard</div>
                    <div className="text-[10px] text-slate-600 font-black uppercase tracking-widest">Manage Production Calls</div>
                </div>
            </div>

            <p className="text-slate-500 text-sm">
                Ready to deploy to real calls? You'll need to link a phone number in the dashboard.
            </p>
        </motion.div>
    );

    const renderWelcome = () => (
        <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center text-center space-y-8 max-w-2xl mx-auto"
        >
            <div className="relative">
                <div className="absolute inset-0 bg-blue-500/20 blur-[100px] rounded-full animate-pulse" />
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-2xl relative z-10 border border-white/20">
                    <ShieldCheck size={48} className="text-white" />
                </div>
            </div>

            <div className="space-y-4">
                <h1 className="text-5xl md:text-6xl font-black text-white tracking-tight">
                    Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">ConvergsAI</span>
                </h1>
                <p className="text-xl text-slate-400 font-medium leading-relaxed">
                    In the next few minutes, your AI agent will be ready to handle real sales and support calls — no technical setup required.
                </p>
            </div>

            <div className="flex flex-col items-center gap-4 w-full pt-8">
                <button
                    onClick={nextStep}
                    className="w-full max-w-[320px] py-5 bg-white text-black rounded-2xl font-bold text-lg flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_20px_40px_rgba(255,255,255,0.1)] group"
                >
                    Let's set it up
                    <ArrowRight className="group-hover:translate-x-1 transition-transform" />
                </button>
                <button
                    onClick={() => window.location.href = '/playground'}
                    className="text-slate-500 hover:text-white transition-colors text-sm font-bold uppercase tracking-widest"
                >
                    Skip and explore demo
                </button>
            </div>

            <div className="pt-12 flex items-center gap-8 opacity-40 grayscale hover:grayscale-0 transition-all">
                <div className="flex items-center gap-2">
                    <Globe size={16} /> <span className="text-xs font-bold uppercase tracking-widest">Global Reach</span>
                </div>
                <div className="flex items-center gap-2">
                    <Zap size={16} /> <span className="text-xs font-bold uppercase tracking-widest">Instant Setup</span>
                </div>
                <div className="flex items-center gap-2">
                    <Database size={16} /> <span className="text-xs font-bold uppercase tracking-widest">Secure Data</span>
                </div>
            </div>
        </motion.div>
    );

    return (
        <main className="min-h-screen bg-[#020617] text-white flex flex-col items-center justify-center px-6 relative overflow-hidden">
            {/* Background Ambience */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[120px] rounded-full" />
            </div>

            <ProgressIndicator currentStep={currentStep} />

            <div className="w-full max-w-4xl relative z-10 pt-20">
                <AnimatePresence mode="wait">
                    {currentStep === 'welcome' && renderWelcome()}
                    {currentStep === 'use-case' && renderUseCase()}
                    {currentStep === 'business' && renderBusiness()}
                    {currentStep === 'crm' && renderCRM()}
                    {currentStep === 'agent' && renderAgentBehavior()}
                    {currentStep === 'knowledge' && renderKnowledge()}
                    {currentStep === 'go-live' && renderGoLive()}
                </AnimatePresence>
            </div>

            {/* Global Footer Navigation (Except for Welcome) */}
            {currentStep !== 'welcome' && currentStep !== 'go-live' && (
                <div className="fixed bottom-0 left-0 right-0 p-8 flex justify-center z-50">
                    <div className="max-w-4xl w-full flex items-center justify-between">
                        <button
                            onClick={prevStep}
                            className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors font-bold uppercase tracking-widest text-xs relative z-10"
                        >
                            <ChevronLeft size={16} /> Back
                        </button>
                        <div className="flex items-center gap-4 relative z-10">
                            <button
                                onClick={skipStep}
                                className="text-slate-500 hover:text-white transition-colors font-bold uppercase tracking-widest text-xs"
                            >
                                Skip for now
                            </button>
                            <button
                                onClick={nextStep}
                                className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20"
                            >
                                Continue <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
