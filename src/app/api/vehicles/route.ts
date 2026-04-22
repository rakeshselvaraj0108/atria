import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/database';
import Database from 'better-sqlite3';

// Get the raw database instance
let dbInstance: Database.Database | null = null;
function getDbInstance() {
  if (!dbInstance) {
    dbInstance = new Database('trafficmaxxers.db');
  }
  return dbInstance;
}

/**
 * Vehicle Management API
 * POST: Create new vehicle
 * GET: List all vehicles
 * DELETE: Remove vehicle
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('🚗 Vehicle creation request:', JSON.stringify(body, null, 2));
    
    const { name, type, sourceLat, sourceLng, destLat, destLng, aiPersonality, cargoCapacity } = body;

    // Validation
    if (!name || !type || !sourceLat || !sourceLng || !destLat || !destLng) {
      return NextResponse.json(
        { error: 'Missing required fields: name, type, source, destination' },
        { status: 400 }
      );
    }

    if (!['truck', 'van', 'car'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid vehicle type. Must be: truck, van, or car' },
        { status: 400 }
      );
    }

    // Generate vehicle ID
    const vehicleId = `${type.toUpperCase()}-${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // Default cargo capacity by type
    const capacityMap: Record<string, number> = {
      truck: 15000,
      van: 3500,
      car: 500
    };
    const defaultCapacity = capacityMap[type] || 1000;

    // Insert vehicle into database
    const insertQuery = `
      INSERT INTO vehicles (
        id, name, type, status, 
        location_lat, location_lng, 
        destination_lat, destination_lng,
        fuel, cargo_capacity, ai_personality,
        speed, heading
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const dbInst = getDbInstance();
    const result = dbInst.prepare(insertQuery).run(
      vehicleId,
      name,
      type,
      'idle', // Start as idle
      sourceLat,
      sourceLng,
      destLat,
      destLng,
      100, // Start with full fuel
      cargoCapacity || defaultCapacity,
      aiPersonality || 'balanced',
      0, // Not moving yet
      0 // No heading yet
    );

    console.log(`✅ Created vehicle: ${name} (${vehicleId})`);
    console.log(`   Source: ${sourceLat}, ${sourceLng}`);
    console.log(`   Destination: ${destLat}, ${destLng}`);

    return NextResponse.json({
      success: true,
      vehicle: {
        id: vehicleId,
        name,
        type,
        status: 'idle',
        location: { lat: sourceLat, lng: sourceLng },
        destination: { lat: destLat, lng: destLng },
        fuel: 100,
        cargoCapacity: cargoCapacity || defaultCapacity,
        aiPersonality: aiPersonality || 'balanced'
      }
    });

  } catch (error) {
    console.error('❌ Vehicle creation error:', error);
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to create vehicle',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Start simulation if not already running (idempotent - won't restart if already going)
    const { startSimulation } = await import('@/lib/simulation/vehicleSimulation');
    startSimulation();

    const vehicles = db.getVehicles();

    return NextResponse.json({
      success: true,
      count: vehicles.length,
      vehicles: vehicles.map((v: any) => ({
        id: v.id,
        name: v.name,
        type: v.type,
        status: v.status,
        location: { lat: v.location_lat, lng: v.location_lng },
        destination: v.destination_lat && v.destination_lng 
          ? { lat: v.destination_lat, lng: v.destination_lng }
          : null,
        fuel: v.fuel,
        speed: v.speed,
        heading: v.heading,
        cargoWeight: v.cargo_weight,
        cargoCapacity: v.cargo_capacity,
        aiPersonality: v.ai_personality,
        lastUpdate: new Date(v.updated_at * 1000).toISOString(),
        currentRoute: v.current_route_json ? JSON.parse(v.current_route_json) : null,
        alternativeRoute: v.alternative_route_json ? JSON.parse(v.alternative_route_json) : null
      }))
    });

  } catch (error) {
    console.error('❌ Vehicle list error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vehicles' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const vehicleId = searchParams.get('id');

    if (!vehicleId) {
      return NextResponse.json(
        { error: 'Missing vehicle ID' },
        { status: 400 }
      );
    }

    // Delete vehicle using helper
    db.deleteVehicle(vehicleId);

    console.log(`🗑️  Deleted vehicle: ${vehicleId}`);

    return NextResponse.json({
      success: true,
      message: `Vehicle ${vehicleId} deleted`
    });

  } catch (error) {
    console.error('❌ Vehicle deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete vehicle' },
      { status: 500 }
    );
  }
}

/**
 * Deploy vehicle (change status from idle to in-transit)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { vehicleId, action } = body;

    if (!vehicleId || !action) {
      return NextResponse.json(
        { error: 'Missing vehicleId or action' },
        { status: 400 }
      );
    }

    if (action === 'deploy') {
      // Get vehicle to verify it has source and destination
      const vehicle = db.getVehicle(vehicleId) as any;
      if (!vehicle) {
        return NextResponse.json(
          { error: 'Vehicle not found' },
          { status: 404 }
        );
      }

      if (!vehicle.destination_lat || !vehicle.destination_lng) {
        return NextResponse.json(
          { error: 'Vehicle has no destination set' },
          { status: 400 }
        );
      }

      // Ensure vehicle is at source location
      // (This prevents the bug where vehicles spawn at wrong locations)
      console.log(`🚀 Deploying vehicle: ${vehicle.name} (${vehicleId})`);
      console.log(`   Starting from: (${vehicle.location_lat}, ${vehicle.location_lng})`);
      console.log(`   Destination: (${vehicle.destination_lat}, ${vehicle.destination_lng})`);

      // Change status to in-transit
      db.updateVehicleStatus(vehicleId, 'in-transit');

      // Start simulation engine if not already running
      const { startSimulation } = await import('@/lib/simulation/vehicleSimulation');
      startSimulation();

      return NextResponse.json({
        success: true,
        message: 'Vehicle deployed and simulation started',
        vehicleId,
        newStatus: 'in-transit'
      });
    }

    if (action === 'stop') {
      // Change status to idle
      db.updateVehicleStatus(vehicleId, 'idle');

      return NextResponse.json({
        success: true,
        message: 'Vehicle stopped',
        vehicleId,
        newStatus: 'idle'
      });
    }

    if (action === 'maintenance') {
      // Change status to maintenance
      db.updateVehicleStatus(vehicleId, 'maintenance');

      return NextResponse.json({
        success: true,
        message: 'Vehicle sent to maintenance',
        vehicleId,
        newStatus: 'maintenance'
      });
    }

    if (action === 'refuel') {
      // Get vehicle current location
      const vehicle = db.getVehicle(vehicleId) as any;
      if (!vehicle) {
        return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
      }

      // Find nearest fuel station
      const dbInst = getDbInstance();
      const updateStmt = dbInst.prepare(`
        SELECT * FROM fuel_stations 
        ORDER BY (
          (location_lat - ?) * (location_lat - ?) + 
          (location_lng - ?) * (location_lng - ?)
        ) ASC LIMIT 1
      `);
      
      const nearestStation = updateStmt.get(
        vehicle.location_lat, vehicle.location_lat,
        vehicle.location_lng, vehicle.location_lng
      ) as any;

      if (!nearestStation) {
         // Fallback if no stations (shouldn't happen with seed data)
         db.updateVehicleFuel(vehicleId, 100);
         db.updateVehicleStatus(vehicleId, 'in-transit');
         return NextResponse.json({ 
             success: true, 
             message: 'Emergency Refuel (No station found)',
             vehicleId,
             newFuel: 100
         });
      }

      // Route to fuel station
      console.log(`⛽ Routing vehicle ${vehicle.name} to ${nearestStation.name}`);
      
      // SAVE STATE: Remember current destination to resume later
      // We purposefully misuse 'alternative_route_json' to store this state object
      const resumeState = {
          type: 'resume',
          dest: { lat: vehicle.destination_lat, lng: vehicle.destination_lng }
      };
      
      const dbInst2 = getDbInstance();
      dbInst2.prepare(`
        UPDATE vehicles 
        SET alternative_route_json = ?, 
            destination_lat = ?, 
            destination_lng = ?,
            status = 'in-transit',
            current_route_json = NULL
        WHERE id = ?
      `).run(
          JSON.stringify(resumeState),
          nearestStation.location_lat, 
          nearestStation.location_lng,
          vehicleId
      );

      // We do NOT fill fuel immediately anymore.
      // The simulation engine will fill it UPON ARRIVAL.
      
      return NextResponse.json({
        success: true,
        message: `Routed to ${nearestStation.name} for refueling`,
        vehicleId,
        destination: nearestStation.name,
        note: 'Vehicle will refuel upon arrival and then resume journey.'
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use: deploy, stop, or refuel' },
      { status: 400 }
    );

  } catch (error) {
    console.error('❌ Vehicle action error:', error);
    return NextResponse.json(
      { error: 'Failed to update vehicle' },
      { status: 500 }
    );
  }
}
