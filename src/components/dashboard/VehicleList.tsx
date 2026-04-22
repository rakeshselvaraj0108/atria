'use client';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useTraffic } from '@/lib/TrafficContext';
import { Edit2, MapPin, Trash2, Truck, Plus, Fuel, Zap, Car, Box, Activity, Wrench, Play, Square } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
};

export function VehicleList() {
    const { vehicles, addVehicle, removeVehicle, updateVehicleStatus, syncData } = useTraffic();
    const [filter, setFilter] = useState('all');
    const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
    const [isDeployingSwarm, setIsDeployingSwarm] = useState(false);

    const handleAction = async (id: string, action: string) => {
        setLoadingIds(prev => new Set(prev).add(id));
        try {
            const res = await fetch('/api/vehicles', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vehicleId: id, action })
            });
            const data = await res.json();
            if (data.success) {
                syncData(); // Refresh data to show new status
            } else {
                console.error('Action failed:', data.error);
                alert('Action failed: ' + data.error);
            }
        } catch (e) {
            console.error('Network error', e);
        } finally {
            setLoadingIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    };

    const handleDeploySwarm = async () => {
        setIsDeployingSwarm(true);
        const demoAgents = [
            { name: "Alpha Hauler", type: "truck", aiPersonality: "aggressive", sourceLat: 12.9172, sourceLng: 77.6229, destLat: 12.9698, destLng: 77.7499 }, // Silk Board to Whitefield
            { name: "Beta Courier", type: "van", aiPersonality: "efficient", sourceLat: 12.9279, sourceLng: 77.6271, destLat: 12.9750, destLng: 77.6060 }, // Koramangala to MG Road
            { name: "Gamma Swift", type: "car", aiPersonality: "balanced", sourceLat: 12.9719, sourceLng: 77.6412, destLat: 13.0358, destLng: 77.5970 } // Indiranagar to Hebbal
        ];
        
        try {
            for (const agent of demoAgents) {
                const response = await fetch('/api/vehicles', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(agent)
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        // Instantly deploy it
                        await fetch('/api/vehicles', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ vehicleId: data.vehicle.id, action: 'deploy' })
                        });
                    }
                }
            }
            syncData();
        } catch (err) {
            console.error("Swarm deploy failed", err);
        } finally {
            setIsDeployingSwarm(false);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'car': return <Car className="h-6 w-6" />;
            case 'van': return <Box className="h-6 w-6" />;
            default: return <Truck className="h-6 w-6" />;
        }
    };

    const getPersonalityColor = (personality?: string) => {
        switch(personality) {
             case 'aggressive': return 'bg-red-500/20 text-red-400 border border-red-500/50 glow-red';
             case 'cautious': return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 glow-yellow';
             case 'efficient': return 'bg-purple-500/20 text-purple-400 border border-purple-500/50 glow-purple';
             default: return 'bg-blue-500/20 text-blue-400 border border-blue-500/50 glow-blue';
        }
    };

    const filteredVehicles = filter === 'all' ? vehicles : vehicles.filter(v => v.type === filter || v.status === filter);

    return (
        <div className="space-y-6">
            {/* Swarm Command Filters */}
            <div className="flex items-center justify-between overflow-x-auto pb-4 border-b border-white/10">
                <div className="flex gap-3">
                    {['all', 'active', 'idle', 'in-transit', 'refueling', 'maintenance', 'truck', 'car'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-[0.15em] border transition-all duration-300 ${filter === f ? 'bg-[--color-primary] text-white border-transparent shadow-[0_0_15px_var(--color-primary)]' : 'bg-white/5 text-[--foreground]/60 border-white/10 hover:border-white/30 hover:bg-white/10'}`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
                <Badge variant="default" className="hidden lg:flex text-xs opacity-50 px-3 py-1 font-mono uppercase tracking-widest bg-black/50">
                    Live Nodes: {vehicles.length}
                </Badge>
            </div>

            {/* Empty State Action */}
            {vehicles.length === 0 && (
                <motion.div 
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} 
                    className="p-12 mt-12 bg-linear-to-br from-[--color-primary]/20 to-purple-500/20 rounded-3xl border border-white/20 text-center shadow-[0_0_50px_rgba(30,136,229,0.3)] backdrop-blur-xl relative overflow-hidden group"
                >
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                    <Activity className="h-20 w-20 mx-auto text-white mb-6 opacity-80 animate-pulse drop-shadow-2xl" />
                    <h2 className="text-4xl font-extrabold text-white mb-4 tracking-tight drop-shadow-md">Swarm Intelligence Engine is Offline</h2>
                    <p className="text-lg text-white/70 max-w-xl mx-auto mb-10 font-medium">To demonstrate the Autonomous Fleet Routing and LLM Agent simulations, deploy a mock fleet into the Bangalore grid.</p>
                    
                    <div className="flex items-center justify-center gap-6 relative z-10">
                        <Button 
                            onClick={handleDeploySwarm} 
                            disabled={isDeployingSwarm}
                            className="bg-white text-black hover:bg-gray-100 font-bold px-8 py-6 rounded-full text-lg shadow-[0_0_30px_white] hover:shadow-[0_0_50px_white] transition-all transform hover:scale-105"
                        >
                            {isDeployingSwarm ? 'Initializing AI Core...' : 'Deploy Autonomous Swarm (3 Agents)'}
                        </Button>
                        <a href="/dashboard/vehicles/create">
                            <Button variant="outline" className="border-white/30 text-white hover:bg-white/10 hover:border-white font-bold px-8 py-6 rounded-full text-lg backdrop-blur-md">
                                Standard Creation
                            </Button>
                        </a>
                    </div>
                </motion.div>
            )}

            <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            >
                <AnimatePresence mode="popLayout">
                    {filteredVehicles.map((vehicle) => (
                        <motion.div
                            key={vehicle.id}
                            variants={item}
                            layout
                            exit={{ opacity: 0, scale: 0.9 }}
                            whileHover={{ y: -10, scale: 1.02 }}
                            transition={{ type: "spring", stiffness: 400, damping: 25 }}
                            className="relative group h-full"
                        >
                            <Card className="h-full flex flex-col justify-between bg-[--color-surface-100] border-white/10 hover:border-[--color-primary]/60 relative overflow-hidden glass-panel-hover rounded-2xl shadow-xl hover:shadow-[0_15px_35px_rgba(0,0,0,0.5)] transition-all">
                                {/* Ambient Background Glow Based on Personality */}
                                <div className={`absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl opacity-20 transition-all pointer-events-none ${
                                     vehicle.aiPersonality === 'aggressive' ? 'bg-red-500' :
                                     vehicle.aiPersonality === 'cautious' ? 'bg-yellow-500' :
                                     vehicle.aiPersonality === 'efficient' ? 'bg-purple-500' : 'bg-blue-500'
                                } translate-x-10 -translate-y-10 group-hover:opacity-40 group-hover:scale-110`} />

                                <div className="p-5 border-b border-white/5 flex items-start justify-between relative z-10 backdrop-blur-xs">
                                    <div className="flex gap-4 items-center">
                                        <div className={`h-12 w-12 rounded-xl flex items-center justify-center transition-all duration-300 shadow-lg ${getPersonalityColor(vehicle.aiPersonality)}`}>
                                            {getIcon(vehicle.type)}
                                        </div>
                                        <div>
                                            <h3 className="font-extrabold text-lg tracking-wide group-hover:text-white text-gray-200 transition-colors drop-shadow-sm">{vehicle.name}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs font-mono text-white/50 uppercase tracing-wider bg-white/5 px-2 py-0.5 rounded-md border border-white/5">{vehicle.type}</span>
                                                <span className="text-[10px] text-white/40 uppercase">LLM: {vehicle.aiPersonality}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <Badge variant={
                                            vehicle.status === 'active' || vehicle.status === 'in-transit' ? 'success' : 
                                            vehicle.status === 'idle' ? 'warning' : 
                                            vehicle.status === 'refueling' ? 'danger' : 'default'
                                        } className="px-3 py-1 font-bold shadow-sm backdrop-blur-md">
                                            {vehicle.status}
                                        </Badge>
                                    </div>
                                </div>

                                <div className="p-6 space-y-6 flex-1 relative z-10 backdrop-blur-xs">
                                    <div className="grid grid-cols-2 gap-6 text-sm">
                                        <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                                            <span className="text-white/50 block text-[10px] uppercase font-bold tracking-widest mb-2 flex items-center gap-1.5"><Fuel className="w-3.5 h-3.5" /> Fuel Tank</span>
                                            <div className="flex items-center gap-3">
                                                <div className="h-1.5 flex-1 bg-white/10 rounded-full overflow-hidden">
                                                    <motion.div
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${vehicle.fuel || 100}%` }}
                                                        transition={{ duration: 1, type: "spring" }}
                                                        className={`h-full rounded-full ${(vehicle.fuel || 100) > 20 ? 'bg-green-500' : 'bg-red-500 shadow-[0_0_10px_red]'}`}
                                                    />
                                                </div>
                                                <span className="font-mono font-bold text-white/80">{Math.round(vehicle.fuel || 100)}%</span>
                                            </div>
                                        </div>
                                        <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                                            <span className="text-white/50 block text-[10px] uppercase font-bold tracking-widest mb-2 flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Route Efficiency</span>
                                            <div className="text-xl font-bold font-mono text-[--color-primary] drop-shadow-sm">{Math.round(vehicle.efficiency || 100)}%</div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 text-xs text-white/70 bg-gradient-to-r from-white/10 to-transparent p-3 rounded-xl font-mono border border-white/10 shadow-inner">
                                        <MapPin className={`h-4 w-4 ${vehicle.status === 'in-transit' ? 'text-[--color-primary] animate-bounce' : 'text-gray-500'}`} />
                                        <span className="truncate">Lat: {vehicle.location.lat.toFixed(4)}, Lng: {vehicle.location.lng.toFixed(4)}</span>
                                    </div>
                                </div>

                                <div className="p-4 flex flex-wrap items-center gap-2 mt-auto relative z-10 bg-black/30 border-t border-white/5 backdrop-blur-md">
                                    <Button
                                        onClick={() => handleAction(vehicle.id, (vehicle.status === 'in-transit' || vehicle.status === 'active') ? 'stop' : 'deploy')}
                                        disabled={loadingIds.has(vehicle.id) || vehicle.status === 'maintenance' || vehicle.status === 'refueling'}
                                        className={`flex-1 font-bold tracking-widest uppercase h-9 text-[10px] transition-all shadow-md ${
                                            loadingIds.has(vehicle.id) ? 'opacity-50 cursor-wait' : 
                                            (vehicle.status === 'active' || vehicle.status === 'in-transit') 
                                            ? 'bg-red-500/20 border border-red-500/50 text-red-100 hover:bg-red-600 hover:text-white' 
                                            : 'bg-[--color-primary] border border-[--color-primary]/50 text-white hover:bg-[--color-primary]/80 hover:shadow-[0_0_15px_var(--color-primary)]'
                                        }`}
                                    >
                                        {(vehicle.status === 'active' || vehicle.status === 'in-transit') ? <><Square className="w-3 h-3 mr-1.5" /> Halt</> : <><Play className="w-3 h-3 mr-1.5" /> Deploy</>}
                                    </Button>

                                    <Button
                                        onClick={() => handleAction(vehicle.id, 'maintenance')}
                                        disabled={loadingIds.has(vehicle.id) || vehicle.status === 'maintenance'}
                                        className={`font-bold tracking-widest uppercase h-9 text-[10px] flex-1 transition-all shadow-md ${vehicle.status === 'maintenance' ? 'bg-gray-600 text-white border-transparent' : 'bg-gray-800 border border-gray-600 hover:bg-gray-700 text-gray-300 hover:text-white'}`}
                                    >
                                        <Wrench className="w-3 h-3 mr-1.5" /> Maint
                                    </Button>

                                    <Button
                                        onClick={() => handleAction(vehicle.id, 'refuel')}
                                        disabled={loadingIds.has(vehicle.id) || vehicle.status === 'refueling'}
                                        className={`font-bold tracking-widest uppercase h-9 text-[10px] flex-1 transition-all shadow-md ${(vehicle.fuel || 0) < 20 && vehicle.status !== 'refueling' ? 'bg-yellow-600 border-yellow-500 text-white animate-pulse shadow-[0_0_15px_rgba(202,138,4,0.4)]' : vehicle.status === 'refueling' ? 'bg-yellow-500 text-black border-transparent shadow-[0_0_10px_yellow]' : 'bg-yellow-900/40 text-yellow-500 border border-yellow-700/50 hover:bg-yellow-600 hover:text-white'}`}
                                    >
                                        <Fuel className="w-3 h-3 mr-1.5" /> Refuel
                                    </Button>
                                </div>
                                <div className="absolute top-4 right-4 z-20">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => removeVehicle(vehicle.id)}
                                        className="h-7 w-7 rounded-md bg-black/40 text-white/40 border-white/10 hover:text-white hover:bg-red-500 hover:border-red-500 transition-colors backdrop-blur-md shadow-lg"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                            </Card>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {/* Add New Card (Only shown if Swarm holds vehicles) */}
                {vehicles.length > 0 && (
                    <a href="/dashboard/vehicles/create" className="block h-full">
                        <motion.div
                            whileHover={{ scale: 1.02, y: -10 }}
                            whileTap={{ scale: 0.98 }}
                            className="h-full min-h-[300px] w-full rounded-2xl border-2 border-dashed border-[--color-primary]/30 flex flex-col items-center justify-center gap-5 group bg-[--color-surface-100]/30 hover:bg-[--color-primary]/10 transition-all cursor-pointer backdrop-blur-sm shadow-inner overflow-hidden relative"
                        >
                            <div className="absolute inset-0 bg-linear-to-b from-transparent to-[--color-primary]/5 group-hover:to-[--color-primary]/10 transition-colors" />
                            <div className="h-20 w-20 rounded-2xl bg-[--color-primary]/10 border border-[--color-primary]/20 flex items-center justify-center group-hover:bg-[--color-primary] group-hover:text-white transition-all duration-300 shadow-xl group-hover:shadow-[0_0_30px_var(--color-primary)] rotate-45 group-hover:rotate-0 relative z-10">
                                <Plus className="h-10 w-10 text-[--color-primary] group-hover:text-white transition-colors duration-300 -rotate-45 group-hover:rotate-0" />
                            </div>
                            <div className="text-center relative z-10">
                                <h3 className="font-black text-xl text-white tracking-wide mb-1 drop-shadow-md">Deploy Custom Unit</h3>
                                <p className="text-sm font-medium text-[--color-primary]/80 group-hover:text-white/80 transition-colors max-w-[200px] mx-auto leading-relaxed">Instantiate a sovereign AI agent with manual GPS inputs</p>
                            </div>
                        </motion.div>
                    </a>
                )}
            </motion.div>
        </div>
    );
}
