'use client';
import { Card } from '@/components/ui/Card';
import { useEffect, useRef, useState } from 'react';
import { MapPin, Activity, AlertTriangle } from 'lucide-react';
import type maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTraffic } from '@/lib/TrafficContext';

import trafficPatternsRaw from '@/lib/data/trafficPatterns.json';

const trafficPatterns = trafficPatternsRaw as Record<string, Record<string, { volume: number, congestion: string, lat: number, lng: number }>>;

interface RealTrafficMapProps {
    vehicleFilter?: 'all' | 'truck' | 'car' | 'van';
    showIncidents?: boolean;
}

// Linear interpolation helper
const lerp = (start: number, end: number, factor: number) => start + (end - start) * factor;

export function RealTrafficMap({ vehicleFilter = 'all', showIncidents = true }: RealTrafficMapProps) {
    const { stressTestResult } = useTraffic();
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<maplibregl.Map | null>(null);
    const mapLibRef = useRef<typeof maplibregl | null>(null);
    const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
    const incidentMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());

    const [isMapReady, setIsMapReady] = useState(false);
    
    // Default live state
    const [liveVehicles, setLiveVehicles] = useState<any[]>([]);
    const [liveIncidents, setLiveIncidents] = useState<any[]>([]);
    const [liveZones, setLiveZones] = useState<any[]>([]);
    const [liveFuelStations, setLiveFuelStations] = useState<any[]>([]);
    const [liveTrafficData, setLiveTrafficData] = useState<any>(null);

    // Context-switched state
    const vehicles = stressTestResult?.vehicles || liveVehicles;
    const incidents = stressTestResult?.incidents || liveIncidents;
    const zones = stressTestResult?.zones || liveZones;
    const fuelStations = stressTestResult ? [] : liveFuelStations;
    const trafficData = stressTestResult?.trafficData || liveTrafficData;

    const animationFrameRef = useRef<number>(0);
    const vehiclePositions = useRef<Map<string, { lat: number; lng: number }>>(new Map());
    const fuelMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
    const warehouseMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());

    const START_LNG = 77.5946;
    const START_LAT = 12.9716;
    const START_ZOOM = 12;

    // 1. Fetch Loop (Increased frequency)
    useEffect(() => {
        if (stressTestResult) return; // Pause live updates during simulation

        const fetchData = async () => {
            try {
                const [vehRes, trafRes] = await Promise.all([
                    fetch('/api/vehicles'),
                    fetch('/api/traffic')
                ]);
                
                const vehData = await vehRes.json();
                const trafData = await trafRes.json();

                if (vehData.success) {
                    setLiveVehicles(vehData.vehicles || []);
                }
                if (trafData.success) {
                    setLiveIncidents(trafData.incidents || []);
                    setLiveZones(trafData.zones || []);
                    setLiveFuelStations(trafData.fuelStations || []);
                    setLiveTrafficData(trafData);
                }
            } catch (error) {
                console.error('Failed to fetch data:', error);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 2000); 
        return () => clearInterval(interval);
    }, [stressTestResult]);

    // 2. Initialize MapLibre
    useEffect(() => {
        if (mapInstance.current || !mapContainer.current) return;

        const initMap = async () => {
            try {
                const maplibreglModule = await import('maplibre-gl');
                const maplibregl = maplibreglModule.default;
                mapLibRef.current = maplibregl;

                console.log('🗺️ Initializing MapLibre...');

                // Ensure container still exists after async load
                if (!mapContainer.current) return;

                const map = new maplibregl.Map({
                    container: mapContainer.current,
                    style: {
                        version: 8,
                        sources: {
                            // Use free CDN tiles as default - much faster and no setup required
                            'osm-raster': {
                                type: 'raster',
                                tiles: [
                                    'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
                                    'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
                                    'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
                                ],
                                tileSize: 256,
                                attribution: '© OpenStreetMap contributors',
                                minzoom: 0,
                                maxzoom: 19
                            },
                            // Traffic Flow Lines (Google Maps Style)
                            'traffic-flow': {
                                type: 'geojson',
                                data: { type: 'FeatureCollection', features: [] }
                            },
                            'vehicle-routes': {
                                type: 'geojson',
                                data: { type: 'FeatureCollection', features: [] }
                            }
                        },
                        layers: [
                            // Base map layer (raster tiles from OSM)
                            {
                                id: 'osm-tiles',
                                type: 'raster',
                                source: 'osm-raster',
                                minzoom: 0,
                                maxzoom: 22
                            },
                            // Tiny Moving Dots (Representing Real Traffic/People)
                            {
                                id: 'traffic-flow-dots',
                                type: 'circle',
                                source: 'traffic-flow',
                                filter: ['==', ['get', 'isDot'], true],
                                paint: {
                                    'circle-color': ['get', 'color'],
                                    'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 1, 12, 1.5, 16, 2],
                                    'circle-opacity': 0.8
                                }
                            },
                            // Active Vehicle Routes (Brighter)
                            {
                                id: 'route-lines',
                                type: 'line',
                                source: 'vehicle-routes',
                                paint: {
                                    'line-color': ['get', 'color'],
                                    'line-width': 4,
                                    'line-opacity': 0.9
                                },
                                layout: { 'line-cap': 'round', 'line-join': 'round' }
                            }
                        ]
                    },
                    center: [START_LNG, START_LAT],
                    zoom: START_ZOOM,
                    attributionControl: false
                });

                map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

                map.on('load', () => {
                    console.log('✅ Map Loaded');
                    
                    // Initial empty traffic network - will be populated on first zones update
                    setIsMapReady(true);
                });

                mapInstance.current = map;
            } catch (err) {
                console.error('Map init failed:', err);
            }
        };

        if (typeof window !== 'undefined') {
            initMap();
        }

        return () => {
             if(animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
             if (mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
            }
        };
    }, []);

    // 2.1 Render Fuel Stations
    useEffect(() => {
        if (!isMapReady || !mapInstance.current || !mapLibRef.current) return;

        fuelStations.forEach(station => {
             if (fuelMarkersRef.current.has(station.id)) return;

             const el = document.createElement('div');
             el.className = 'fuel-marker';
             // Yellow Fuel Icon
             el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#fbbf24" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 22v-8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8"/><path d="M8 22V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v16"/><circle cx="12" cy="11" r="1"/><path d="M10 6h4"/><path d="M3 22h18"/></svg>`;
             
             // Create Popup
             const popup = new mapLibRef.current!.Popup({ offset: 25 })
                .setHTML(`
                    <div style="color: #000; padding: 5px;">
                        <h3 style="font-weight: bold; margin-bottom: 5px;">${station.name}</h3>
                        <div style="font-size: 0.9em;">
                            <p>⛽ Price: <b>₹${station.price}</b></p>
                            <p>🏎️ Capacity: ${station.capacity} cars</p>
                        </div>
                    </div>
                `);

             const marker = new mapLibRef.current!.Marker({ element: el })
                .setLngLat([station.location.lng, station.location.lat])
                .setPopup(popup)
                .addTo(mapInstance.current!);

             fuelMarkersRef.current.set(station.id, marker);
        });

    }, [isMapReady, fuelStations]);

    // 2.1.5 Render Warehouses (Fleet Bases)
    useEffect(() => {
        if (!isMapReady || !mapInstance.current || !mapLibRef.current) return;

        const WAREHOUSES = [
           { id: 'wh-1', name: "Peenya Industrial Hub", lat: 13.0285, lng: 77.5197, capacity: 500 },
           { id: 'wh-2', name: "Whitefield Logistics", lat: 12.9698, lng: 77.7499, capacity: 1200 },
           { id: 'wh-3', name: "Bommasandra Hub", lat: 12.8160, lng: 77.6811, capacity: 800 },
           { id: 'wh-4', name: "Hoskote Cargo Terminal", lat: 13.0722, lng: 77.7896, capacity: 2000 }
        ];

        WAREHOUSES.forEach(warehouse => {
             if (warehouseMarkersRef.current.has(warehouse.id)) return;

             const el = document.createElement('div');
             el.className = 'warehouse-marker';
             // Custom Warehouse Icon (Box/Home style)
             el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="#3b82f6" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>`;
             
             // Create Popup
             const popup = new mapLibRef.current!.Popup({ offset: 25 })
                .setHTML(`
                    <div style="color: #000; padding: 5px;">
                        <h3 style="font-weight: bold; margin-bottom: 5px; color: #1e3a8a;">${warehouse.name}</h3>
                        <div style="font-size: 0.9em;">
                            <p>🏭 Base: <b>Idle & Maintenance Hub</b></p>
                            <p>📦 Cargo Capacity: ${warehouse.capacity} units</p>
                            <p style="font-size: 0.8em; color: #666; margin-top: 4px;">Vehicles route here when idle or needing repairs.</p>
                        </div>
                    </div>
                `);

             const marker = new mapLibRef.current!.Marker({ element: el })
                .setLngLat([warehouse.lng, warehouse.lat])
                .setPopup(popup)
                .addTo(mapInstance.current!);

             warehouseMarkersRef.current.set(warehouse.id, marker);
        });

    }, [isMapReady]);

    // 2.2 Dynamic Traffic Dots based on Historical CSV Data
    // Updated Animation Effect
    useEffect(() => {
        if (!isMapReady || !mapInstance.current) return;
        
        const animate = () => {
             // Determine Time Block based on real time
            const hour = new Date().getHours();
            let timeBlock = 'Midnight';
            if (hour >= 6 && hour < 11) timeBlock = 'Morning';
            else if (hour >= 11 && hour < 15) timeBlock = 'Noon';
            else if (hour >= 15 && hour < 21) timeBlock = 'Daytime';
            
            // Get data for this block
            // Use safe access as imports might be async or undefined in some envs
            const activePattern = (trafficPatterns as any)[timeBlock] || (trafficPatterns as any)['Daytime'];
            if (!activePattern) {
                 animationFrameRef.current = requestAnimationFrame(animate);
                 return;
            };

            const features: any[] = [];
            
            // Iterate over the real dataset areas
            Object.values(activePattern).forEach((areaData: any, idx: number) => {
                const { lat, lng, volume, congestion } = areaData;
                
                // Map congestion string to density/color
                let numDots = 20;
                let baseColor = '#22c55e'; // Green
                let radius = 0.012; // ~1.2km
                
                if (congestion === 'High' || volume > 4000) {
                    numDots = 60; // Reduced from 100 for performace
                    baseColor = '#ef4444'; // Red
                    radius = 0.018;
                } else if (congestion === 'Medium' || volume > 2000) {
                    numDots = 40;
                    baseColor = '#fbbf24'; // Yellow
                    radius = 0.015;
                }
                
                // Animate dots
                const time = Date.now() / 1000;
                
                for (let d = 0; d < numDots; d++) {
                    const offset = d * 132.4 + idx * 7.7; // random-ish seed unique per dot
                    const speed = 0.15 + (d % 3) * 0.05;
                    
                    // Complex motion: Orbit + Noise to look like bustling city
                    const angle = (time * speed) + offset;
                    // Jitter radius to create a cloud, not a perfect ring
                    const r = radius * (0.3 + (Math.sin(offset * 3.1) * 0.5 + 0.5) * 0.7); 
                    
                    const dotLat = lat + Math.sin(angle) * r * 0.8;
                    const dotLng = lng + Math.cos(angle) * r;
                    
                    features.push({
                        type: 'Feature',
                        properties: {
                            isDot: true,
                            color: baseColor
                        },
                        geometry: {
                            type: 'Point',
                            coordinates: [dotLng, dotLat]
                        }
                    });
                }
            });
            
            const source = mapInstance.current?.getSource('traffic-flow') as maplibregl.GeoJSONSource;
            if (source) {
                source.setData({
                    type: 'FeatureCollection',
                    features: features
                });
            }
            
            animationFrameRef.current = requestAnimationFrame(animate);
        };
        
        animate();
        return () => cancelAnimationFrame(animationFrameRef.current);
    }, [isMapReady]);

    // Function to get congested areas for route avoidance
    const getCongestedAreas = (): { lat: number; lng: number; severity: string }[] => {
        // Determine Time Block based on real time
        const hour = new Date().getHours();
        let timeBlock = 'Midnight';
        if (hour >= 6 && hour < 11) timeBlock = 'Morning';
        else if (hour >= 11 && hour < 15) timeBlock = 'Noon';
        else if (hour >= 15 && hour < 21) timeBlock = 'Daytime';
        
        const activePattern = (trafficPatterns as any)[timeBlock] || (trafficPatterns as any)['Daytime'];
        if (!activePattern) return [];
        
        const congestedZones: { lat: number; lng: number; severity: string }[] = [];
        
        Object.values(activePattern).forEach((areaData: any) => {
            const { lat, lng, congestion } = areaData;
            if (congestion === 'High') {
                congestedZones.push({ lat, lng, severity: 'high' });
            } else if (congestion === 'Medium') {
                congestedZones.push({ lat, lng, severity: 'medium' });
            }
        });
        
        // Expose globally for simulation engine
        (window as any).__trafficHotspots = congestedZones;
        (globalThis as any).__trafficHotspots = congestedZones;
        
        return congestedZones;
    };
    
    // Update congested areas periodically
    useEffect(() => {
        getCongestedAreas();
        const interval = setInterval(getCongestedAreas, 30000); // Every 30s
        return () => clearInterval(interval);
    }, []);

    // 3. OLD STATIC Generate (REMOVED - Now using dynamic zones above)
    const generateTrafficNetwork = (map: maplibregl.Map) => {
        const features: any[] = [];
        const bounds = map.getBounds();
        const north = bounds.getNorth() + 0.05;
        const south = bounds.getSouth() - 0.05;
        const east = bounds.getEast() + 0.05;
        const west = bounds.getWest() - 0.05;

        // Generate ~100 random traffic segments
        for (let i = 0; i < 150; i++) {
            // Random start point
            const lat1 = south + Math.random() * (north - south);
            const lng1 = west + Math.random() * (east - west);
            
            // Random length and direction to simulate road segments
            const len = 0.005 + Math.random() * 0.02; // ~500m to 2km
            const angle = Math.random() * 2 * Math.PI;
            
            // Using slightly curved lines for realism
            const lat2 = lat1 + len * Math.cos(angle);
            const lng2 = lng1 + len * Math.sin(angle);
            
            // Random Traffic Status
            const rand = Math.random();
            let color = '#22c55e'; // Green (Free)
            if (rand > 0.7) color = '#ef4444'; // Red (Heavy)
            else if (rand > 0.4) color = '#f97316'; // Orange (Moderate)

            features.push({
                type: 'Feature',
                properties: { color },
                geometry: {
                    type: 'LineString',
                    coordinates: [
                        [lng1, lat1],
                        [lng1 + (lng2-lng1)*0.5 + (Math.random()*0.001), lat1 + (lat2-lat1)*0.5 + (Math.random()*0.001)], // Midpoint jitter
                        [lng2, lat2]
                    ]
                }
            });
        }

        const source = map.getSource('traffic-flow') as maplibregl.GeoJSONSource;
        if (source) {
            source.setData({
                type: 'FeatureCollection',
                features: features
            });
        }
    };

    // 4. Sync Markers (Create/Delete Only)
    useEffect(() => {
        const map = mapInstance.current;
        const lib = mapLibRef.current;
        if (!map || !lib || !isMapReady) return;

        const currentMarkers = markersRef.current;
        const validIds = new Set<string>();

        vehicles.forEach((vehicle: any) => {
            if (vehicleFilter !== 'all' && vehicle.type !== vehicleFilter) return;
            if (isNaN(vehicle.location.lng) || isNaN(vehicle.location.lat)) return;
            
            validIds.add(vehicle.id);
            const lngLat: [number, number] = [vehicle.location.lng, vehicle.location.lat];
            const color = vehicle.type === 'truck' ? '#f97316' :
                          vehicle.type === 'car' ? '#22d3ee' : '#a855f7';

            if (!vehiclePositions.current.has(vehicle.id)) {
                vehiclePositions.current.set(vehicle.id, { lng: vehicle.location.lng, lat: vehicle.location.lat });
            }

            if (!currentMarkers.has(vehicle.id)) {
                // Custom Marker Container
                const containerEl = document.createElement('div');
                containerEl.className = 'vehicle-marker-container';
                containerEl.style.display = 'flex';
                containerEl.style.flexDirection = 'column';
                containerEl.style.alignItems = 'center';
                containerEl.style.transform = 'translateY(-50%)'; // Center bottom
                
                // Vehicle Dot
                const dotEl = document.createElement('div');
                dotEl.className = 'vehicle-marker-gl';
                dotEl.style.width = '14px'; 
                dotEl.style.height = '14px';
                dotEl.style.backgroundColor = color;
                dotEl.style.border = '2px solid white';
                dotEl.style.borderRadius = '50%';
                dotEl.style.boxShadow = `0 0 10px ${color}`;
                dotEl.style.cursor = 'pointer';
                
                // Name Label
                const labelEl = document.createElement('div');
                labelEl.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                labelEl.style.color = '#fff';
                labelEl.style.padding = '2px 6px';
                labelEl.style.borderRadius = '4px';
                labelEl.style.fontSize = '10px';
                labelEl.style.fontWeight = 'bold';
                labelEl.style.marginTop = '4px';
                labelEl.style.whiteSpace = 'nowrap';
                labelEl.style.fontFamily = 'monospace';
                labelEl.style.border = `1px solid ${color}`;
                labelEl.innerText = vehicle.name;

                containerEl.appendChild(dotEl);
                containerEl.appendChild(labelEl);
                
                // Pure CSS Pulse
                if(vehicle.status === 'in-transit') {
                     dotEl.style.animation = 'pulse-gl 1.5s infinite';
                }

                const marker = new lib.Marker({ element: containerEl })
                    .setLngLat(lngLat)
                    .setPopup(new lib.Popup({ offset: 15, closeButton: false }))
                    .addTo(map);

                currentMarkers.set(vehicle.id, marker);
            }
            
            const marker = currentMarkers.get(vehicle.id);
            if(marker && marker.getPopup().isOpen()){
                const speedKmh = Math.round(vehicle.speed || 0);
                marker.getPopup().setHTML(getPopupContent(vehicle, speedKmh));
            }
        });

        currentMarkers.forEach((marker, id) => {
            if (!validIds.has(id)) {
                marker.remove();
                currentMarkers.delete(id);
                vehiclePositions.current.delete(id);
            }
        });

    }, [vehicles, vehicleFilter, isMapReady]);

    // 5. ANIMATION LOOP (Smooth Sliding)
    useEffect(() => {
        if (!isMapReady) return;

        const animate = () => {
            const markers = markersRef.current;
            const positions = vehiclePositions.current;
            const factor = 0.05; // Smoothing factor

            vehicles.forEach((vehicle: any) => {
                if (!markers.has(vehicle.id)) return;
                
                let target = vehicle.location;

                // Fake movement during simulation so they appear to be driving the new route
                if (stressTestResult && vehicle.status === 'in-transit' && vehicle.currentRoute?.waypoints?.length > 0) {
                     if (vehicle._simIndex === undefined) vehicle._simIndex = 0;
                     // Speed depends on vehicle type, trucks slower than cars
                     const speedFactor = vehicle.type === 'car' ? 0.15 : vehicle.type === 'van' ? 0.1 : 0.06;
                     
                     vehicle._simIndex = Math.min(vehicle._simIndex + speedFactor, vehicle.currentRoute.waypoints.length - 1);
                     const wp = vehicle.currentRoute.waypoints[Math.floor(vehicle._simIndex)];
                     if (wp) {
                         target = { lat: wp.lat, lng: wp.lng };
                     }
                }

                const current = positions.get(vehicle.id) || target;

                if (!target || isNaN(target.lat) || isNaN(target.lng)) return;

                const newLat = lerp(current.lat, target.lat, factor);
                const newLng = lerp(current.lng, target.lng, factor);

                positions.set(vehicle.id, { lat: newLat, lng: newLng });

                const marker = markers.get(vehicle.id);
                if (marker) {
                    marker.setLngLat([newLng, newLat]);
                }
            });

            animationFrameRef.current = requestAnimationFrame(animate);
        };

        animationFrameRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [vehicles, isMapReady]);

    // 6. Update Routes (Colored Lines)
    useEffect(() => {
        const map = mapInstance.current;
        if (!map || !isMapReady) return;
        
        if(!map.getSource('vehicle-routes')) return;

        const routeFeatures: any[] = [];
        vehicles.forEach(vehicle => {
             if (vehicleFilter !== 'all' && vehicle.type !== vehicleFilter) return;
             // Draw route for all moving vehicles
             if (vehicle.status !== 'in-transit' || !vehicle.currentRoute) return;

             const coords = vehicle.currentRoute.waypoints?.map((wp: any) => [wp.lng, wp.lat]) || [];
             if (coords.length < 2) return;

             // Color based on vehicle speed? Or general status?
             // Use Green/Orange/Red based on speed
             let color = '#22c55e';
             if (vehicle.speed < 20) color = '#ef4444';
             else if (vehicle.speed < 40) color = '#f97316';

             routeFeatures.push({
                type: 'Feature',
                properties: { color },
                geometry: { type: 'LineString', coordinates: coords }
             });
        });

        (map.getSource('vehicle-routes') as maplibregl.GeoJSONSource).setData({
            type: 'FeatureCollection',
            features: routeFeatures
        });

        // We removed traffic-particles update logic here as we replaced it with static network generation
        // for better "Google Maps" look, unless we want dynamic updates on that too.
        // For now, static generation on load covering the city is better for "Circulate everywhere" look.

    }, [vehicles, vehicleFilter, isMapReady]);

    // 7. Incidents
    useEffect(() => {
        const map = mapInstance.current;
        const lib = mapLibRef.current;
        if (!map || !lib || !showIncidents || !isMapReady) return;

        const currentIncidents = incidentMarkersRef.current;
        const validIds = new Set<string>();

        incidents.forEach(incident => {
            if (isNaN(incident.lng) || isNaN(incident.lat)) return;
            validIds.add(incident.id);
            
            if (!currentIncidents.has(incident.id)) {
                 const color = incident.severity === 'critical' ? '#dc2626' :    
                             incident.severity === 'high' ? '#f97316' : '#fbbf24';
                
                 const el = document.createElement('div');
                 el.className = 'incident-marker-gl';
                 el.innerHTML = `<div style="width:12px;height:12px;background:${color};border:2px solid white;border-radius:50%;box-shadow:0 0 15px ${color}"></div>`;
                 
                 const marker = new lib.Marker({ element: el })
                    .setLngLat([incident.lng, incident.lat])
                    .setPopup(new lib.Popup().setHTML(`
                        <div style="font-family: monospace; font-size: 11px; color:black"> 
                            <b>⚠️ ${incident.type?.toUpperCase()}</b><br>    
                            Severity: ${incident.severity}
                        </div>
                    `))
                    .addTo(map);
                
                currentIncidents.set(incident.id, marker);
            }
        });

         currentIncidents.forEach((marker, id) => {
            if (!validIds.has(id)) {
                marker.remove();
                currentIncidents.delete(id);
            }
        });
    }, [incidents, showIncidents, isMapReady]);

    return (
        <Card className="col-span-1 lg:col-span-2 relative h-full w-full overflow-hidden bg-[#0c1018] border-white/10 p-0! shadow-2xl group">
             {stressTestResult && (
                 <div className="absolute inset-0 pointer-events-none z-[100] border-4 border-orange-500/50 shadow-[inset_0_0_100px_rgba(249,115,22,0.3)]">
                     <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-orange-500/90 text-black px-6 py-2 rounded-full font-black tracking-widest text-lg shadow-[0_0_30px_rgba(249,115,22,0.8)] backdrop-blur-md flex items-center gap-2 animate-pulse">
                        <AlertTriangle className="w-6 h-6" /> SIMULATED
                     </div>
                 </div>
             )}
             <style jsx global>{`
                @keyframes pulse-gl {
                    0% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.4); }
                    70% { box-shadow: 0 0 0 8px rgba(255, 255, 255, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0); }
                }
                .maplibregl-popup-content {
                    background: rgba(0, 0, 0, 0.8) !important;
                    color: white !important;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(4px);
                    border-radius: 6px;
                    padding: 8px;
                }
                .maplibregl-popup-tip {
                    border-top-color: rgba(0, 0, 0, 0.8) !important;
                }
            `}</style>
            
            <div ref={mapContainer} className="absolute inset-0 z-0 w-full h-full" style={{background: '#0B0E14'}} />
            
             <div className="absolute top-4 left-4 z-10 pointer-events-none">    
                <h3 className="text-xl font-bold tracking-tight text-white flex items-center gap-2 drop-shadow-md">
                    <MapPin className="text-[--color-primary]" />
                    BANGALORE_OP_CNTR
                </h3>
                <div className="text-xs text-white/80 font-mono pl-8 drop-shadow-md flex items-center gap-2">
                    LIVE FEED | LAT: {START_LAT} N
                    <Activity className={`h-3 w-3 ${vehicles.length > 0 ? 'text-green-400 animate-pulse' : 'text-gray-400'}`} />
                    {vehicles.filter(v => v.status === 'in-transit').length} ACTIVE
                </div>
            </div>

            {trafficData && (
                <div className="absolute bottom-6 left-4 z-10 pointer-events-none flex flex-col gap-2">
                     <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-lg px-3 py-2 text-xs">
                        <div className="text-white/60 mb-1">Traffic Status</div>
                        <div className="text-white font-mono font-bold">        
                            {trafficData.incidents?.length || 0} Active Incidents
                        </div>
                    </div>
                </div>
            )}
        </Card>
    );
}

function getPopupContent(vehicle: any, speed: number) {
    const statusEmoji = vehicle.status === 'in-transit' ? '🚀' : vehicle.status === 'idle' ? '⏸️' : '⚠️';
    return `
        <div style="font-family: monospace; font-size: 12px; line-height: 1.4;">     
            <b style="color: #60a5fa">${vehicle.name}</b><br>
            ${statusEmoji} <span style="color: #9ca3af">${vehicle.status}</span><br>
            ⚡ ${speed} km/h<br>
            ⛽ ${Math.round(vehicle.fuel || 0)}% fuel
        </div>
    `;
}
