import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-inter',
})

export const metadata: Metadata = {
    title: 'ConvergsAI - Voice Intelligence for Sales & Support',
    description: 'Enterprise-grade AI voice agents that handle inbound sales qualification and customer support 24/7.',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en" className="scroll-smooth">
            <head>
                <link rel="preconnect" href="https://api.fontshare.com" />
                <link href="https://api.fontshare.com/v2/css?f[]=satoshi@900,1,700,500,300,400&display=swap" rel="stylesheet" />
            </head>
            <body className={`${inter.variable} font-sans antialiased`}>{children}</body>
        </html>
    )
}
