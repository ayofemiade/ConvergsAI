'use client';

import React, { useEffect, useRef } from 'react';

export default function Background3D() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    // Mouse state
    const mouse = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Auto-resize
        let width = canvas.width = canvas.parentElement?.offsetWidth || window.innerWidth;
        let height = canvas.height = canvas.parentElement?.offsetHeight || window.innerHeight;

        // --- GLOBE CONFIG ---
        const GLOBE_RADIUS = 350;
        const DOT_COUNT = 1000;
        const DOT_SIZE = 1.5;
        const ARC_COUNT = 15;

        // State
        let rotation = 0;
        let rotationSpeed = 0.001;

        // --- DATA STRUCTURES ---
        interface Point3D {
            x: number;
            y: number;
            z: number;
            lat: number;
            lon: number;
            // Original pos for returning after noise
            baseX: number;
            baseY: number;
            baseZ: number;
        }

        interface Arc {
            startLat: number;
            startLon: number;
            endLat: number;
            endLon: number;
            progress: number; // 0 to 1
            speed: number;
            color: string;
        }

        const particles: Point3D[] = [];
        const arcs: Arc[] = [];

        // --- INIT PARTICLES (Fibonacci Sphere for even distribution) ---
        const phi = Math.PI * (3 - Math.sqrt(5)); // Golden angle

        for (let i = 0; i < DOT_COUNT; i++) {
            const y = 1 - (i / (DOT_COUNT - 1)) * 2; // y is -1 to 1
            const radiusAtY = Math.sqrt(1 - y * y);
            const theta = phi * i;

            const x = Math.cos(theta) * radiusAtY;
            const z = Math.sin(theta) * radiusAtY;

            particles.push({
                x: x * GLOBE_RADIUS,
                y: y * GLOBE_RADIUS,
                z: z * GLOBE_RADIUS,
                lat: Math.asin(y), // Approximate lat/lon for arc mapping later
                lon: Math.atan2(z, x),
                baseX: x * GLOBE_RADIUS,
                baseY: y * GLOBE_RADIUS,
                baseZ: z * GLOBE_RADIUS
            });
        }

        // --- HELPER: 3D ROTATION ---
        function rotate(p: { x: number, y: number, z: number }, rotX: number, rotY: number) {
            // Rotate Y
            let x = p.x * Math.cos(rotY) - p.z * Math.sin(rotY);
            let z = p.z * Math.cos(rotY) + p.x * Math.sin(rotY);
            let y = p.y;

            // Rotate X
            let yNew = y * Math.cos(rotX) - z * Math.sin(rotX);
            let zNew = z * Math.cos(rotX) + y * Math.sin(rotX);

            return { x, y: yNew, z: zNew };
        }

        // --- INIT ARCS ---
        function createArc(): Arc {
            return {
                startLat: (Math.random() - 0.5) * Math.PI,
                startLon: Math.random() * Math.PI * 2,
                endLat: (Math.random() - 0.5) * Math.PI,
                endLon: Math.random() * Math.PI * 2,
                progress: 0,
                speed: 0.005 + Math.random() * 0.01,
                color: Math.random() > 0.5 ? '#60a5fa' : '#818cf8' // Blue or Indigo
            };
        }

        for (let i = 0; i < ARC_COUNT; i++) arcs.push(createArc());

        // --- DRAW CURVED LINE ON SPHERE ---
        // Helper to get 3D point from spherical coords
        function getSpherePoint(lat: number, lon: number, r: number) {
            const y = Math.sin(lat) * r;
            const rAtY = Math.cos(lat) * r;
            const x = Math.cos(lon) * rAtY;
            const z = Math.sin(lon) * rAtY;
            return { x, y, z };
        }

        // --- ANIMATION LOOP ---
        const animate = () => {
            ctx.clearRect(0, 0, width, height);

            const cx = width / 2;
            const cy = height * 0.25; // Shifted further up

            // Target rotation based on mouse (Parallax)
            const targetRotX = mouse.current.y * 0.2;
            const targetRotY = mouse.current.x * 0.2 + rotation;

            rotation += rotationSpeed;

            // Draw Particles
            particles.forEach(p => {
                // Apply rotation
                const rotated = rotate(p, targetRotX, targetRotY);

                // Perspective
                const scale = 1000 / (1000 - rotated.z);
                const x2d = cx + rotated.x * scale;
                const y2d = cy + rotated.y * scale;

                // Visibility check (Backface culling ish)
                // We draw back dots very faint
                const alpha = rotated.z > 0
                    ? (rotated.z / GLOBE_RADIUS) * 0.8 + 0.2
                    : 0.1;

                if (scale > 0) {
                    ctx.beginPath();
                    ctx.arc(x2d, y2d, DOT_SIZE * scale, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(147, 197, 253, ${alpha})`; // Blue-300
                    ctx.fill();
                }
            });

            // Draw Arcs (Bezier curves lifting off surface)
            arcs.forEach((arc, i) => {
                arc.progress += arc.speed;
                if (arc.progress >= 1) {
                    arcs[i] = createArc();
                    return;
                }

                // Interpolate Start/End
                // A true great circle is hard, we'll just lerp lat/lon (Mercator style) but mapped to sphere 
                // and lift the "radius" in the middle for a 'jump' effect

                const currLat = arc.startLat + (arc.endLat - arc.startLat) * arc.progress;
                let currLon = arc.startLon + (arc.endLon - arc.startLon) * arc.progress;

                // Add rotation to the arc points themselves so they turn with the globe
                // Actually simpler: The arc points are fixed on the globe surface, we rotate the calculated 3D point

                // We draw a trail
                const trailLength = 0.2;
                for (let t = 0; t < trailLength; t += 0.02) {
                    const p = arc.progress - t;
                    if (p < 0) continue;

                    const lLat = arc.startLat + (arc.endLat - arc.startLat) * p;
                    const lLon = arc.startLon + (arc.endLon - arc.startLon) * p;
                    // Jump height (sine wave)
                    const lift = Math.sin(p * Math.PI) * 100;

                    let rawPt = getSpherePoint(lLat, lLon, GLOBE_RADIUS + lift);
                    let rotPt = rotate(rawPt, targetRotX, targetRotY);

                    const scale = 1000 / (1000 - rotPt.z);
                    const x2d = cx + rotPt.x * scale;
                    const y2d = cy + rotPt.y * scale;

                    if (rotPt.z > -100) { // Only front-ish
                        ctx.beginPath();
                        ctx.arc(x2d, y2d, 1 * scale, 0, Math.PI * 2);
                        // Fading tail
                        const alpha = (1 - (t / trailLength)) * (rotPt.z > 0 ? 1 : 0.3);
                        ctx.fillStyle = arc.color === '#60a5fa'
                            ? `rgba(96, 165, 250, ${alpha})`
                            : `rgba(129, 140, 248, ${alpha})`;
                        ctx.fill();
                    }
                }
            });

            requestAnimationFrame(animate);
        };

        const animationId = requestAnimationFrame(animate);

        // --- EVENT LAYERS ---
        const handleResize = () => {
            width = canvas.width = canvas.parentElement?.offsetWidth || window.innerWidth;
            height = canvas.height = canvas.parentElement?.offsetHeight || window.innerHeight;
        };

        const handleMouseMove = (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            // Normalize -1 to 1
            mouse.current.x = ((e.clientX - rect.left) / width) * 2 - 1;
            mouse.current.y = ((e.clientY - rect.top) / height) * 2 - 1;
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('mousemove', handleMouseMove);

        return () => {
            cancelAnimationFrame(animationId);
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-40 mix-blend-screen"
            style={{
                width: '100%',
                height: '120%', // Slightly larger to cover tilt
                zIndex: 0
            }}
        />
    );
}
