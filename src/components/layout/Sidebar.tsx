'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Activity, LayoutDashboard, Truck, Map as MapIcon, Settings, LogOut, BarChart3, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { StressTestSimulator } from '@/components/dashboard/StressTestSimulator';

const sidebarItems = [
    { icon: LayoutDashboard, label: 'Overview', href: '/dashboard' },
    { icon: Truck, label: 'Fleet Management', href: '/dashboard/vehicles' },
    { icon: MapIcon, label: 'Live Map', href: '/dashboard/map' },
    { icon: Settings, label: 'Settings', href: '/dashboard/settings' },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="w-64 border-r border-white/10 bg-[#0B0E14] flex flex-col h-screen fixed left-0 top-0 z-40">
            <div className="h-16 flex items-center px-6 border-b border-white/10">
                <Activity className="h-6 w-6 text-[--color-primary] mr-2" />
                <span className="font-bold tracking-tight">TRAFFIC<span className="text-[--color-primary]">MAXXERS</span></span>
            </div>

            <nav className="flex-1 p-4 space-y-2">
                {sidebarItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link key={item.href} href={item.href}>
                            <div
                                className={cn(
                                    'flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors relative group',
                                    isActive
                                        ? 'text-white bg-[--color-primary]/10'
                                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                                )}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="sidebar-active"
                                        className="absolute inset-0 bg-[--color-primary]/10 rounded-lg border border-[--color-primary]/20"
                                        initial={false}
                                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                    />
                                )}
                                <item.icon className={cn("h-4 w-4 relative z-10", isActive ? "text-[--color-primary]" : "group-hover:text-white")} />
                                <span className="relative z-10">{item.label}</span>
                            </div>
                        </Link>
                    );
                })}
                <div className="pt-2">
                    <StressTestSimulator />
                </div>
                {/* Analytics Link */}
                <Link href="/dashboard/analytics">
                    <div
                        className={cn(
                            'flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-all relative group mt-2',
                            pathname === '/dashboard/analytics'
                                ? 'text-white bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/20'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                        )}
                    >
                        {pathname === '/dashboard/analytics' && (
                            <motion.div
                                layoutId="sidebar-active"
                                className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 rounded-lg border border-cyan-500/20"
                                initial={false}
                                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            />
                        )}
                        <BarChart3 className={cn("h-4 w-4 relative z-10", pathname === '/dashboard/analytics' ? "text-cyan-400" : "group-hover:text-white")} />
                        <span className="relative z-10">Analytics</span>
                        <span className="ml-auto relative z-10 text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 font-bold">NEW</span>
                    </div>
                </Link>
                {/* Predictive Engine Link */}
                <Link href="/dashboard/predictions">
                    <div
                        className={cn(
                            'flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-all relative group mt-1',
                            pathname === '/dashboard/predictions'
                                ? 'text-white bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 border border-violet-500/20'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                        )}
                    >
                        {pathname === '/dashboard/predictions' && (
                            <motion.div
                                layoutId="sidebar-active"
                                className="absolute inset-0 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 rounded-lg border border-violet-500/20"
                                initial={false}
                                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            />
                        )}
                        <TrendingUp className={cn("h-4 w-4 relative z-10", pathname === '/dashboard/predictions' ? "text-violet-400" : "group-hover:text-white")} />
                        <span className="relative z-10">Predictions</span>
                        <span className="ml-auto relative z-10 text-[9px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400 font-bold">AI</span>
                    </div>
                </Link>
            </nav>

            <div className="p-4 border-t border-white/10 flex flex-col gap-3">
                <Button variant="ghost" className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-2">
                    <LogOut className="h-4 w-4" />
                    Disconnect
                </Button>
            </div>
        </aside>
    );
}
