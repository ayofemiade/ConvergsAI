import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'

// Professional, modern typeface used by high-growth startups
const jakarta = Plus_Jakarta_Sans({
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-jakarta',
})

export const metadata: Metadata = {
    title: 'SalesAI - Voice Intelligence for Sales & Support',
    description: 'Enterprise-grade AI voice agents that handle inbound sales qualification and customer support 24/7.',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en" className="scroll-smooth">
            <body className={`${jakarta.className} antialiased`}>{children}</body>
        </html>
    )
}
