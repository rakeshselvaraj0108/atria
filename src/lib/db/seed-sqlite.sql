-- Seed data for Trafficmaxxers Bangalore simulation (SQLite)
-- Run this after schema-sqlite.sql

-- Initialize environment
INSERT OR IGNORE INTO environment (sim_time, condition, temperature, global_congestion_level, rush_hour)
VALUES (strftime('%s', 'now'), 'clear', 28.5, 30, 0);

-- Fuel stations in key Bangalore locations
INSERT OR IGNORE INTO fuel_stations (id, name, location_lat, location_lng, fuel_price, capacity) VALUES
('FS-001', 'Silk Board Fuel Station', 12.9172, 77.6229, 105.50, 4),
('FS-002', 'Electronic City Petrol Pump', 12.8456, 77.6603, 103.20, 6),
('FS-003', 'Whitefield Highway Fuel', 12.9698, 77.7499, 106.80, 5),
('FS-004', 'Bannerghatta Road Station', 12.8930, 77.5960, 104.50, 3),
('FS-005', 'Hebbal Flyover Fuel', 13.0358, 77.5970, 107.20, 4),
('FS-006', 'Airport Road Petrol', 13.1986, 77.7066, 108.90, 5),
('FS-007', 'Koramangala 80ft Road', 12.9352, 77.6245, 106.20, 4),
('FS-008', 'Indiranagar Metro Station Pump', 12.9784, 77.6408, 107.50, 4),
('FS-009', 'Majestic Bus Stand Fuel', 12.9767, 77.5713, 104.80, 8),
('FS-010', 'Malleshwaram Cross Pump', 13.0055, 77.5692, 105.90, 3),
('FS-011', 'Yeshwanthpur Industrial Fuel', 13.0238, 77.5458, 103.50, 10),
('FS-012', 'Marathahalli Bridge Fuel', 12.9554, 77.6989, 106.50, 6),
('FS-013', 'Bellandur EcoSpace Pump', 12.9257, 77.6761, 105.80, 5),
('FS-014', 'HSR Layout Sector 2', 12.9121, 77.6446, 106.10, 4),
('FS-015', 'Banashankari BDA Complex', 12.9255, 77.5468, 104.90, 4),
('FS-016', 'Mysore Road Satellite Station', 12.9436, 77.5190, 103.80, 10),
('FS-017', 'Old Madras Road HP', 12.9922, 77.6631, 105.20, 5),
('FS-018', 'Sarjapur Road Wipro Gate', 12.9168, 77.6811, 106.80, 6),
('FS-019', 'JP Nagar 24th Main', 12.9090, 77.5855, 105.50, 3),
('FS-020', 'RT Nagar Main Road', 13.0189, 77.5947, 106.30, 4);

-- Traffic zones (major areas in Bangalore)
INSERT OR IGNORE INTO zones (id, name, center_lat, center_lng, radius_meters, congestion_level, avg_speed, zone_type) VALUES
('ZONE-SILK', 'Silk Board Junction', 12.9172, 77.6229, 1500, 75, 18, 'urban'),
('ZONE-ECITY', 'Electronic City', 12.8456, 77.6603, 2000, 45, 35, 'industrial'),
('ZONE-WHITE', 'Whitefield', 12.9698, 77.7499, 2500, 50, 32, 'commercial'),
('ZONE-KORAM', 'Koramangala', 12.9279, 77.6271, 1200, 65, 22, 'commercial'),
('ZONE-INDIRA', 'Indiranagar', 12.9719, 77.6412, 1300, 60, 25, 'residential'),
('ZONE-JAYNR', 'Jayanagar', 12.9250, 77.5838, 1800, 55, 28, 'residential'),
('ZONE-MGRD', 'MG Road', 12.9750, 77.6060, 1000, 70, 20, 'commercial'),
('ZONE-MALYA', 'Malleshwaram', 13.0030, 77.5710, 1500, 50, 30, 'residential'),
('ZONE-HEBBL', 'Hebbal', 13.0358, 77.5970, 1600, 60, 26, 'urban'),
('ZONE-YSHPT', 'Yeshwanthpur', 13.0280, 77.5385, 1400, 55, 28, 'industrial'),
('ZONE-BTMLY', 'BTM Layout', 12.9165, 77.6101, 1300, 65, 23, 'residential'),
('ZONE-AIRPT', 'Kempegowda Airport', 13.1986, 77.7066, 3000, 25, 60, 'highway');

-- Initial vehicle fleet removed for hackathon (User requested clean slate)

-- Initial incidents (realistic Bangalore traffic scenarios)
INSERT OR IGNORE INTO incidents (id, type, severity, location_lat, location_lng, affected_radius_meters, status, description, speed_reduction_factor) VALUES
('INC-001', 'accident', 'high', 12.9172, 77.6229, 800, 'active', 'Multi-vehicle collision at Silk Board Junction, 2 lanes blocked', 0.3),
('INC-002', 'construction', 'medium', 12.9750, 77.6060, 500, 'active', 'Metro construction work on MG Road, single lane traffic', 0.6),
('INC-003', 'congestion', 'low', 13.0358, 77.5970, 600, 'active', 'Heavy traffic near Hebbal Flyover during evening hours', 0.7);
