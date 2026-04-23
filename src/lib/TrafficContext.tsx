'use client';
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Vehicle, TrafficZone, Incident } from './types';
import { vehicles as initialVehicles, trafficZones as initialZones, incidents as initialIncidents } from './mockData';

// ---- Settings Interface ----
interface AppSettings {
    notifications: boolean;
    congestionAlerts: boolean;
    incidentAlerts: boolean;
    alertThreshold: number; // Congestion % to trigger alert
    darkMode: boolean;
    autoRefresh: boolean;
    refreshInterval: number; // seconds
    mapStyle: 'dark' | 'satellite' | 'street';
}

// ---- Context Interface ----
interface TrafficContextType {
    // Vehicles
    vehicles: Vehicle[];
    addVehicle: (vehicle: Omit<Vehicle, 'id' | 'number'>) => void;
    removeVehicle: (id: string) => void;
    updateVehicleStatus: (id: string, status: Vehicle['status']) => void;
    updateVehicleFuel: (id: string, fuel: number) => void;

    // Traffic Zones
    zones: TrafficZone[];
    updateZoneCongestion: (id: string, level: number) => void;

    // Incidents
    incidents: Incident[];
    addIncident: (incident: Omit<Incident, 'id'>) => void;
    removeIncident: (id: string) => void;

    // Stats (computed)
    stats: {
        totalVehicles: number;
        activeVehicles: number;
        avgEfficiency: number;
        fuelSaved: string;
        totalIncidents: number;
        avgCongestion: number;
    };

    // Settings
    settings: AppSettings;
    updateSettings: (updates: Partial<AppSettings>) => void;

    // Simulation
    isSimulating: boolean;
    toggleSimulation: () => void;
    lastSyncTime: Date;
    syncData: () => void;

    // Stress Test Simulation
    stressTestResult: any | null;
    setStressTestResult: (result: any | null) => void;

    // Notifications
    notifications: AppNotification[];
    addNotification: (message: string, type: 'info' | 'warning' | 'danger' | 'success') => void;
    clearNotifications: () => void;
    dismissNotification: (id: string) => void;
}

export interface AppNotification {
    id: string;
    message: string;
    type: 'info' | 'warning' | 'danger' | 'success';
    timestamp: Date;
}

const TrafficContext = createContext<TrafficContextType | undefined>(undefined);

export function TrafficProvider({ children }: { children: ReactNode }) {
    // Start with empty state to avoid "Flash of Mock Data" before DB sync
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [zones, setZones] = useState<TrafficZone[]>([]);
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [isSimulating, setIsSimulating] = useState(true);
    const [lastSyncTime, setLastSyncTime] = useState(new Date());
    const [stressTestResult, setStressTestResult] = useState<any | null>(null);
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [settings, setSettings] = useState<AppSettings>({
        notifications: true,
        congestionAlerts: true,
        incidentAlerts: true,
        alertThreshold: 80,
        darkMode: true,
        autoRefresh: true,
        refreshInterval: 5, // 5 seconds - balanced between responsiveness and performance
        mapStyle: 'dark',
    });

    // Load settings from localStorage on mount
    useEffect(() => {
        const savedSettings = localStorage.getItem('trafficmaxxer_settings');
        if (savedSettings) {
            try {
                setSettings(JSON.parse(savedSettings));
            } catch (e) {
                console.error('Failed to load settings:', e);
            }
        }
    }, []);

    // Save settings to localStorage whenever they change
    useEffect(() => {
        localStorage.setItem('trafficmaxxer_settings', JSON.stringify(settings));
    }, [settings]);

    // ---- Notifications ----
    const addNotification = useCallback((message: string, type: 'info' | 'warning' | 'danger' | 'success') => {
        if (!settings.notifications) return;
        const notification: AppNotification = {
            id: `N-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            message,
            type,
            timestamp: new Date()
        };
        setNotifications(prev => [notification, ...prev].slice(0, 50)); // Keep last 50
    }, [settings.notifications]);

    const clearNotifications = useCallback(() => {
        setNotifications([]);
    }, []);

    const dismissNotification = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    // ---- Settings ----
    const updateSettings = useCallback((updates: Partial<AppSettings>) => {
        setSettings(prev => ({ ...prev, ...updates }));
    }, []);

    // ---- Sync ----
    const syncData = useCallback(async () => {
        try {
            const res = await fetch('/api/simulation');
            if (!res.ok) throw new Error('Failed to fetch state');
            const data = await res.json();
            
            // Only update if we have meaningful data
            if (data.vehicles) {
                setVehicles(prev => {
                    data.vehicles.forEach((newV: Vehicle) => {
                        const oldV = prev.find(v => v.id === newV.id);
                        if (oldV && oldV.status === 'in-transit' && newV.status === 'idle') {
                            setTimeout(() => {
                                addNotification(`🏁 Vehicle ${newV.name} has reached its destination!`, 'success');
                            }, 0);
                        }
                    });
                    return data.vehicles;
                });
            }
            if (data.zones) setZones(data.zones);
            if (data.incidents) setIncidents(data.incidents);
            
            setLastSyncTime(new Date(data.lastUpdated));
            // addNotification('Data synchronized with backend', 'info'); 
        } catch (error) {
            console.error('Sync failed:', error);
        }
    }, [addNotification]);

    // ---- Vehicle Operations ----
    const addVehicle = useCallback((vehicleData: Omit<Vehicle, 'id' | 'number'>) => {
        const id = `FLEET-${String(Math.floor(Math.random() * 900) + 100).padStart(3, '0')}`;
        const number = `TM-X-${Math.floor(Math.random() * 900) + 100}`;
        const newVehicle: Vehicle = { ...vehicleData, id, number };
        setVehicles(prev => [...prev, newVehicle]);
        addNotification(`${newVehicle.name} deployed successfully`, 'success');
    }, [addNotification]);

    const removeVehicle = useCallback(async (id: string) => {
        // Optimistic update
        setVehicles(prev => prev.filter(v => v.id !== id));
        
        try {
            const res = await fetch(`/api/vehicles?id=${id}`, {
                method: 'DELETE',
            });
            const data = await res.json();
            
            if (data.success) {
                addNotification(`Vehicle ${id} permanently deleted`, 'success');
            } else {
                throw new Error(data.error || 'Failed to delete');
            }
        } catch (error) {
            console.error('Delete failed:', error);
            addNotification(`Failed to delete vehicle: ${error}`, 'danger');
            // Revert on failure (reload data)
            syncData(); 
        }
    }, [syncData]);

    const updateVehicleStatus = useCallback((id: string, status: Vehicle['status']) => {
        setVehicles(prev => prev.map(v => v.id === id ? { ...v, status } : v));
    }, []);

    const updateVehicleFuel = useCallback((id: string, fuel: number) => {
        setVehicles(prev => prev.map(v => v.id === id ? { ...v, fuel: Math.max(0, Math.min(100, fuel)) } : v));
    }, []);

    // ---- Zone Operations ----
    const updateZoneCongestion = useCallback((id: string, level: number) => {
        setZones(prev => prev.map(z => z.id === id ? { ...z, congestionLevel: Math.max(0, Math.min(100, level)) } : z));
    }, []);

    // ---- Incident Operations ----
    const addIncident = useCallback((incidentData: Omit<Incident, 'id'>) => {
        const id = `INC-${String(Math.floor(Math.random() * 900) + 100).padStart(3, '0')}`;
        setIncidents(prev => [...prev, { ...incidentData, id }]);
        if (settings.incidentAlerts) {
            addNotification(`New ${incidentData.type} incident: ${incidentData.description}`, 'danger');
        }
    }, [settings.incidentAlerts]);

    const removeIncident = useCallback((id: string) => {
        setIncidents(prev => prev.filter(i => i.id !== id));
        addNotification(`Incident ${id} resolved`, 'success');
    }, []);

    // ---- Simulation Engine / Polling ----
    useEffect(() => {
        // Initial sync to load DB data immediately
        syncData();

        // If "Auto Refresh" is on, we poll the server for the latest state
        if (!settings.autoRefresh) return;

        const interval = setInterval(() => {
            syncData();
        }, settings.refreshInterval * 1000);

        return () => clearInterval(interval);
    }, [settings.autoRefresh, settings.refreshInterval, syncData]);

    // ---- Check for congestion alerts every sync ----
    const [lastAlertedZones, setLastAlertedZones] = useState<Set<string>>(new Set());
    useEffect(() => {
        if (!settings.congestionAlerts || zones.length === 0) return;
        
        const congestedZones = zones.filter(z => z.congestionLevel >= settings.alertThreshold);
        const newAlerted = new Set<string>();
        
        congestedZones.forEach(z => {
            newAlerted.add(z.id);
            // Only notify if this zone wasn't already alerted in the previous cycle
            if (!lastAlertedZones.has(z.id)) {
                addNotification(`⚠ ${z.area || z.name} congestion at ${z.congestionLevel}%`, 'warning');
            }
        });
        
        // Also notify if a zone dropped below threshold (resolved)
        lastAlertedZones.forEach(id => {
            if (!newAlerted.has(id)) {
                const zone = zones.find(z => z.id === id);
                if (zone) {
                    addNotification(`✅ ${(zone as any).area || (zone as any).name} congestion eased to ${zone.congestionLevel}%`, 'success');
                }
            }
        });
        
        setLastAlertedZones(newAlerted);
    }, [zones, settings.congestionAlerts, settings.alertThreshold]);

    // ---- Computed Stats ----
    const stats = {
        totalVehicles: vehicles.length,
        activeVehicles: vehicles.filter(v => v.status === 'active').length,
        avgEfficiency: Math.round(vehicles.reduce((sum, v) => sum + v.efficiency, 0) / (vehicles.length || 1)),
        fuelSaved: `${Math.round(vehicles.reduce((sum, v) => sum + (100 - v.fuel), 0))}L`,
        totalIncidents: incidents.length,
        avgCongestion: Math.round(zones.reduce((sum, z) => sum + z.congestionLevel, 0) / (zones.length || 1)),
    };

    const toggleSimulation = useCallback(() => {
        setIsSimulating(prev => !prev);
    }, []);

    return (
        <TrafficContext.Provider value={{
            vehicles, addVehicle, removeVehicle, updateVehicleStatus, updateVehicleFuel,
            zones, updateZoneCongestion,
            incidents, addIncident, removeIncident,
            stats,
            settings, updateSettings,
            isSimulating, toggleSimulation, lastSyncTime, syncData,
            stressTestResult, setStressTestResult,
            notifications, addNotification, clearNotifications, dismissNotification,
        }}>
            {children}
        </TrafficContext.Provider>
    );
}

export function useTraffic() {
    const context = useContext(TrafficContext);
    if (!context) {
        throw new Error('useTraffic must be used within a TrafficProvider');
    }
    return context;
}
