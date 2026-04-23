'use client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useTraffic } from '@/lib/TrafficContext';
import { Settings, Bell, Shield, Database, Moon, Zap, RefreshCw, Download, Trash, Check, AlertTriangle, Wifi, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';

// ── Functional Toggle ──
function Toggle({ checked, onChange, color = 'bg-green-500' }: { checked: boolean; onChange: (v: boolean) => void; color?: string }) {
    return (
        <button
            onClick={() => onChange(!checked)}
            className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${checked ? color : 'bg-white/10'}`}
        >
            <motion.div
                animate={{ x: checked ? 24 : 2 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-md"
            />
        </button>
    );
}

export default function SettingsPage() {
    const { settings, updateSettings, isSimulating, toggleSimulation, vehicles, zones, incidents, addNotification, notifications, syncData } = useTraffic();
    const [showSave, setShowSave] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isClearing, setIsClearing] = useState(false);
    const [dbStatus, setDbStatus] = useState<{ ok: boolean; vehicleCount: number; zoneCount: number; incidentCount: number; aiDecisions: number; dbSize: string } | null>(null);
    const [testingConnection, setTestingConnection] = useState(false);

    // ── Fetch real DB status ──
    const checkDb = useCallback(async () => {
        try {
            const res = await fetch('/api/analytics');
            const data = await res.json();
            if (data.success) {
                setDbStatus({
                    ok: true,
                    vehicleCount: data.fleet?.total || 0,
                    zoneCount: data.congestion?.zones?.length || 0,
                    incidentCount: data.incidents?.active || 0,
                    aiDecisions: data.ai?.total || 0,
                    dbSize: 'SQLite Local',
                });
            }
        } catch {
            setDbStatus({ ok: false, vehicleCount: 0, zoneCount: 0, incidentCount: 0, aiDecisions: 0, dbSize: 'Disconnected' });
        }
    }, []);

    useEffect(() => { checkDb(); }, [checkDb]);

    const save = (updates: any) => {
        updateSettings(updates);
        setShowSave(true);
        setTimeout(() => setShowSave(false), 2000);
    };

    const handleExportLogs = async () => {
        setIsExporting(true);
        try {
            // Fetch real analytics data for export
            const [analyticsRes, predictionsRes] = await Promise.all([
                fetch('/api/analytics').then(r => r.json()).catch(() => null),
                fetch('/api/predictions').then(r => r.json()).catch(() => null),
            ]);

            const exportData = {
                exportedAt: new Date().toISOString(),
                platform: 'Trafficmaxxers',
                settings,
                fleet: {
                    vehicles: vehicles.map(v => ({
                        id: v.id, name: v.name, type: v.type, status: v.status,
                        fuel: v.fuel, speed: v.speed,
                        location: v.location, destination: v.destination,
                    })),
                },
                zones: zones.map(z => ({ id: z.id, area: z.area, name: z.name, congestionLevel: z.congestionLevel })),
                incidents: incidents.map(i => ({ id: i.id, type: i.type, severity: i.severity, description: i.description })),
                analytics: analyticsRes,
                predictions: predictionsRes,
                notifications: notifications.slice(0, 50),
                summary: {
                    totalVehicles: vehicles.length,
                    activeVehicles: vehicles.filter(v => v.status === 'in-transit').length,
                    totalZones: zones.length,
                    totalIncidents: incidents.length,
                    totalNotifications: notifications.length,
                },
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `trafficmaxxers-export-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            addNotification('📥 Data exported successfully', 'success');
        } catch {
            addNotification('Export failed', 'danger');
        } finally { setIsExporting(false); }
    };

    const handleClearCache = () => {
        if (!confirm('Clear all cached data and reset settings? This will reload the page.')) return;
        setIsClearing(true);
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key?.startsWith('trafficmaxxer_')) localStorage.removeItem(key);
        }
        updateSettings({
            notifications: true, congestionAlerts: true, incidentAlerts: true,
            alertThreshold: 80, darkMode: true, autoRefresh: true, refreshInterval: 5, mapStyle: 'dark',
        });
        addNotification('🗑️ Cache cleared', 'success');
        setTimeout(() => window.location.reload(), 1000);
    };

    const handleResetSettings = () => {
        if (!confirm('Reset all settings to defaults?')) return;
        updateSettings({
            notifications: true, congestionAlerts: true, incidentAlerts: true,
            alertThreshold: 80, darkMode: true, autoRefresh: true, refreshInterval: 5, mapStyle: 'dark',
        });
        setShowSave(true);
        setTimeout(() => setShowSave(false), 2000);
        addNotification('⚙️ Settings reset to defaults', 'info');
    };

    const handleTestConnection = async () => {
        setTestingConnection(true);
        try {
            const start = Date.now();
            const res = await fetch('/api/simulation');
            const elapsed = Date.now() - start;
            if (res.ok) {
                addNotification(`✅ Backend connected (${elapsed}ms latency)`, 'success');
                await checkDb();
            } else {
                addNotification(`❌ Backend error: ${res.status}`, 'danger');
            }
        } catch {
            addNotification('❌ Backend unreachable', 'danger');
        } finally { setTestingConnection(false); }
    };

    const handleForceSync = async () => {
        addNotification('🔄 Forcing data sync...', 'info');
        await syncData();
        await checkDb();
        addNotification('✅ Data synced from backend', 'success');
    };

    return (
        <div className="space-y-6 max-w-4xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">System Configuration</h1>
                    <p className="text-[--foreground]/60">Manage platform preferences and integrations.</p>
                </div>
                <AnimatePresence>
                    {showSave && (
                        <motion.div initial={{ opacity: 0, y: -10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }}
                            className="flex items-center gap-2 bg-green-500/20 border border-green-500/40 rounded-lg px-4 py-2">
                            <Check className="w-4 h-4 text-green-400" />
                            <span className="text-sm font-medium text-green-400">Settings saved</span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ── General Preferences ── */}
            <Card className="p-6 space-y-1 col-span-2">
                <h2 className="text-xl font-bold flex items-center gap-2 mb-5">
                    <Settings className="w-5 h-5 text-[--color-primary]" /> General Preferences
                </h2>

                {[
                    { icon: <RefreshCw className={`h-5 w-5 ${isSimulating ? 'text-green-400 animate-spin' : 'text-gray-400'}`} style={{ animationDuration: '3s' }} />,
                      title: 'Live Simulation', desc: 'Toggle real-time traffic updates and vehicle movements.',
                      checked: isSimulating, onChange: () => toggleSimulation(), color: 'bg-green-500' },
                    { icon: <Bell className="h-5 w-5 text-yellow-400" />,
                      title: 'Notifications', desc: `Enable real-time alerts. ${notifications.length} notifications this session.`,
                      checked: settings.notifications, onChange: (v: boolean) => save({ notifications: v }), color: 'bg-[--color-primary]' },
                    { icon: <Bell className="h-5 w-5 text-orange-400" />,
                      title: 'Congestion Alerts', desc: `Trigger when zone exceeds ${settings.alertThreshold}% congestion.`,
                      checked: settings.congestionAlerts, onChange: (v: boolean) => save({ congestionAlerts: v }), color: 'bg-[--color-primary]' },
                    { icon: <AlertTriangle className="h-5 w-5 text-red-400" />,
                      title: 'Incident Alerts', desc: 'Receive notifications for new traffic incidents.',
                      checked: settings.incidentAlerts, onChange: (v: boolean) => save({ incidentAlerts: v }), color: 'bg-[--color-primary]' },
                    { icon: <Moon className="h-5 w-5 text-purple-400" />,
                      title: 'Auto Refresh', desc: `Sync data every ${settings.refreshInterval}s from backend.`,
                      checked: settings.autoRefresh, onChange: (v: boolean) => save({ autoRefresh: v }), color: 'bg-[--color-primary]' },
                ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-4 border-b border-white/5 last:border-0">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/5 rounded-lg">{item.icon}</div>
                            <div>
                                <h3 className="font-bold">{item.title}</h3>
                                <p className="text-sm text-[--foreground]/60">{item.desc}</p>
                            </div>
                        </div>
                        <Toggle checked={item.checked} onChange={item.onChange} color={item.color} />
                    </div>
                ))}
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* ── Thresholds & Limits ── */}
                <Card className="p-6 space-y-6">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Shield className="w-5 h-5 text-[--color-success]" /> Thresholds & Limits
                    </h2>

                    <div>
                        <div className="flex justify-between mb-2">
                            <label className="text-sm font-medium">Congestion Alert Threshold</label>
                            <span className="text-sm font-mono text-[--color-primary]">{settings.alertThreshold}%</span>
                        </div>
                        <input type="range" min="50" max="100" value={settings.alertThreshold}
                            onChange={(e) => save({ alertThreshold: parseInt(e.target.value) })}
                            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[--color-primary]" />
                        <div className="flex justify-between text-[10px] text-white/20 mt-1">
                            <span>50% (Sensitive)</span><span>100% (Critical only)</span>
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between mb-2">
                            <label className="text-sm font-medium">Refresh Rate</label>
                            <span className="text-sm font-mono text-[--color-primary]">{settings.refreshInterval}s</span>
                        </div>
                        <input type="range" min="2" max="30" value={settings.refreshInterval}
                            onChange={(e) => save({ refreshInterval: parseInt(e.target.value) })}
                            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[--color-primary]" />
                        <div className="flex justify-between text-[10px] text-white/20 mt-1">
                            <span>2s (Fast, more load)</span><span>30s (Light)</span>
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between mb-2">
                            <label className="text-sm font-medium">Map Style</label>
                            <span className="text-sm font-mono text-[--color-primary] capitalize">{settings.mapStyle}</span>
                        </div>
                        <select value={settings.mapStyle}
                            onChange={(e) => save({ mapStyle: e.target.value as 'dark' | 'satellite' | 'street' })}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[--color-primary] cursor-pointer">
                            <option value="dark">Dark Mode</option>
                            <option value="satellite">Satellite View</option>
                            <option value="street">Street Map</option>
                        </select>
                    </div>
                </Card>

                {/* ── Data Management ── */}
                <Card className="p-6 space-y-5">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Database className="w-5 h-5 text-blue-400" /> Data Management
                    </h2>

                    {/* Connection Status */}
                    <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                {dbStatus?.ok ? <Wifi className="w-4 h-4 text-green-400" /> : <WifiOff className="w-4 h-4 text-red-400" />}
                                <span className={`text-sm font-medium ${dbStatus?.ok ? 'text-green-400' : 'text-red-400'}`}>
                                    {dbStatus?.ok ? 'Connected' : 'Disconnected'}
                                </span>
                            </div>
                            <span className="text-[10px] text-white/25 font-mono">{dbStatus?.dbSize || '...'}</span>
                        </div>
                        {dbStatus?.ok && (
                            <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                                <div className="flex justify-between"><span className="text-white/30">Vehicles</span><span className="text-white/60 font-medium">{dbStatus.vehicleCount}</span></div>
                                <div className="flex justify-between"><span className="text-white/30">Zones</span><span className="text-white/60 font-medium">{dbStatus.zoneCount}</span></div>
                                <div className="flex justify-between"><span className="text-white/30">Incidents</span><span className="text-white/60 font-medium">{dbStatus.incidentCount}</span></div>
                                <div className="flex justify-between"><span className="text-white/30">AI Decisions</span><span className="text-white/60 font-medium">{dbStatus.aiDecisions}</span></div>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" className="gap-2 text-xs" onClick={handleTestConnection} disabled={testingConnection}>
                            <Wifi className="w-3.5 h-3.5" />
                            {testingConnection ? 'Testing...' : 'Test Connection'}
                        </Button>
                        <Button variant="outline" className="gap-2 text-xs" onClick={handleForceSync}>
                            <RefreshCw className="w-3.5 h-3.5" />
                            Force Sync
                        </Button>
                    </div>

                    <div className="flex gap-2">
                        <Button variant="outline" className="flex-1 gap-2" onClick={handleExportLogs} disabled={isExporting}>
                            <Download className="w-4 h-4" />
                            {isExporting ? 'Exporting...' : 'Export All Data'}
                        </Button>
                        <Button variant="primary" className="flex-1 gap-2" onClick={handleClearCache} disabled={isClearing}>
                            <Trash className="w-4 h-4" />
                            {isClearing ? 'Clearing...' : 'Clear Cache'}
                        </Button>
                    </div>

                    <Button variant="outline" className="w-full gap-2 border-orange-500/30 hover:border-orange-500 text-orange-400"
                        onClick={handleResetSettings}>
                        <RefreshCw className="w-4 h-4" />
                        Reset Settings to Defaults
                    </Button>
                </Card>
            </div>

            {/* ── Current Config Summary ── */}
            <Card className="p-4">
                <div className="flex items-center gap-3 text-xs text-white/30">
                    <span>Current config:</span>
                    <span className={`px-1.5 py-0.5 rounded ${settings.notifications ? 'bg-green-500/10 text-green-400' : 'bg-white/5 text-white/20'}`}>
                        Notifications {settings.notifications ? 'ON' : 'OFF'}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded ${settings.congestionAlerts ? 'bg-green-500/10 text-green-400' : 'bg-white/5 text-white/20'}`}>
                        Congestion {settings.congestionAlerts ? 'ON' : 'OFF'}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded ${settings.autoRefresh ? 'bg-green-500/10 text-green-400' : 'bg-white/5 text-white/20'}`}>
                        Auto-refresh {settings.autoRefresh ? `${settings.refreshInterval}s` : 'OFF'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-white/5 text-white/20">
                        Threshold {settings.alertThreshold}%
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-white/5 text-white/20 capitalize">
                        Map: {settings.mapStyle}
                    </span>
                </div>
            </Card>
        </div>
    );
}
