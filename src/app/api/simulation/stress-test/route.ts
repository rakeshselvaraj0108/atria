import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/database';
import { VehicleAgent, DecisionContext } from '@/lib/ai/vehicleAgent';
import { EnvironmentEngine } from '@/lib/simulation/environmentEngine';
import { findOptimalRoute } from '@/lib/routing/routeOptimization';
import type { Vehicle, TrafficZone, Incident } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const { scenario } = await request.json();

    // 1. Clone state
    const originalVehicles = (db as any).getAllVehicles ? (db as any).getAllVehicles() : (db as any).getVehicles() || [];
    const originalZones = (db as any).getZones() || [];
    const originalIncidents = (db as any).getIncidents ? (db as any).getIncidents() : (db as any).getActiveIncidents() || [];
    const originalFuelStations = (db as any).getFuelStations ? (db as any).getFuelStations() : [];

    // Deep copy state for simulation and map structure for frontend
    const vehicles = JSON.parse(JSON.stringify(originalVehicles)).map((v: any) => ({
      ...v,
      location: { lat: v.location_lat, lng: v.location_lng },
      destination: v.destination_lat && v.destination_lng ? { lat: v.destination_lat, lng: v.destination_lng } : null,
      currentRoute: v.current_route_json ? JSON.parse(v.current_route_json) : null,
      alternativeRoute: v.alternative_route_json ? JSON.parse(v.alternative_route_json) : null
    }));
    const zones = JSON.parse(JSON.stringify(originalZones));
    const incidents = JSON.parse(JSON.stringify(originalIncidents));
    let fuelStations = JSON.parse(JSON.stringify(originalFuelStations)).map((f: any) => ({
      name: f.name,
      lat: f.location_lat,
      lng: f.location_lng,
      price: f.fuel_price,
      distance: 5 // mock distance
    }));
    const environmentEngine = new EnvironmentEngine(false);
    const environment = environmentEngine.update();

    // 2. Apply scenario parameters
    if (scenario === 'monsoon') {
      environment.condition = 'heavy_rain';
      environment.weatherSpeedFactor = 0.4;
      environment.rushHour = true;
      zones.forEach((z: any) => {
        z.congestionLevel = Math.min(100, z.congestionLevel * 1.5);
      });
      // Add 3 random critical incidents
      for (let i = 0; i < 3; i++) {
        const targetZone = zones[Math.floor(Math.random() * zones.length)];
        if (targetZone) {
          incidents.push({
            id: `INC-SIM-MONSOON-${i}`,
            type: 'accident',
            severity: 'critical',
            location: targetZone.location,
            description: 'Monsoon-related critical incident',
            status: 'active',
            reportedAt: new Date().toISOString(),
            impactRadius: 2000
          });
        }
      }
    } else if (scenario === 'silkboard') {
      const sbZone = zones.find((z: any) => 
        z.name?.toLowerCase().includes('silk') || 
        z.id?.toLowerCase().includes('silk_board')
      ) || zones[0];

      if (sbZone) {
        sbZone.congestionLevel = 100;
        incidents.push({
          id: `INC-SIM-SILKBOARD`,
          type: 'roadwork',
          severity: 'critical',
          location: sbZone.location,
          description: 'Silk Board Complete Collapse',
          status: 'active',
          reportedAt: new Date().toISOString(),
          impactRadius: 5000
        });

        // Cascade to adjacent zones
        zones.forEach((z: any) => {
          if (z.id !== sbZone.id) {
            z.congestionLevel = Math.min(100, z.congestionLevel + 30);
          }
        });
      }
    } else if (scenario === 'fuel') {
      // Simulate fuel crisis by adjusting vehicle stats or setting unavailability
      vehicles.forEach((v: any) => {
        v.fuel = Math.max(0, v.fuel - 20); // Everyone is lower on fuel
      });
      // All fuel stations set to unavailable
      fuelStations = [];
    }

    let reroutes = 0;
    let slaRisks = 0;

    // 3. Run decision loop against cloned state
    const results = await Promise.all(
      vehicles.map(async (v: any) => {
        const agent = new VehicleAgent(v.id, v.ai_personality || 'balanced');
        // Reset cooldown so it always decides in simulation
        (agent as any).decisionCooldown = 0;
        
        const decisionContext: DecisionContext = {
          vehicle: v,
          destination: v.destination ? { lat: v.destination.lat, lng: v.destination.lng } : undefined,
          nearbyZones: zones,
          nearbyIncidents: incidents,
          environment: {
            weather: environment.condition,
            congestion: environment.globalCongestionLevel,
            rushHour: environment.rushHour,
            weatherSpeedFactor: environment.weatherSpeedFactor
          },
          fuelStations
        };

        try {
          // MATHEMATICALLY CALCULATE NEW ROUTE FOR SIMULATION
          if (v.status === 'in-transit' && v.destination) {
             try {
                 const newOptimizedRoute = await findOptimalRoute(
                     v.location,
                     v.destination,
                     zones,
                     incidents,
                     environment.weatherSpeedFactor,
                     v.type as 'truck' | 'van' | 'car'
                 );
                 decisionContext.currentRoute = newOptimizedRoute as any;
             } catch (e) {
                 console.log(`Simulation routing failed for ${v.id}, using fallback`);
             }
          }

          const decision = await agent.makeDecision(decisionContext);
          
          let isRerouted = false;
          if (v.currentRoute && decisionContext.currentRoute) {
              const oldTime = v.currentRoute.estimatedTime || 0;
              const newTime = decisionContext.currentRoute.estimatedTime || 0;
              // If the route timing changed by more than 2 minutes due to the stress test conditions, it's a real reroute
              if (Math.abs(oldTime - newTime) > 120) {
                  isRerouted = true;
              }
          } else if (!v.currentRoute && decisionContext.currentRoute && v.status === 'in-transit') {
              isRerouted = true;
          }

          if (isRerouted || decision?.action === 'reroute') {
             reroutes++;
             v.currentRoute = decisionContext.currentRoute || v.currentRoute;
             if (decision) decision.action = 'reroute';
          }

          if (decision?.action === 'speed_up' || decision?.priority === 'critical' || decision?.priority === 'high') slaRisks++;
          return { ...v, simulationDecision: decision };
        } catch (err) {
          console.error(`AI Decision failed for ${v.id}:`, err);
          const act = v.status === 'in-transit' ? 'reroute' : 'continue';
          if (act === 'reroute') {
             reroutes++;
             v.currentRoute = decisionContext.currentRoute;
          }
          return { ...v, simulationDecision: { action: act, priority: 'medium', reason: 'Fallback route due to error' } };
        }
      })
    );

    const cascadeImpact = zones.filter((z: any) => z.congestionLevel >= 80).length;

    return NextResponse.json({
      success: true,
      vehicles: results,
      zones,
      incidents,
      environment,
      stats: {
        rerouted: reroutes,
        slaRisk: slaRisks,
        cascadeImpact: cascadeImpact
      }
    });
  } catch (error: any) {
    console.error('Stress test API failed:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
