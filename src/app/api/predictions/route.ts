import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Cache parsed CSV
let csvCache: any[] | null = null;
function loadCSV(): any[] {
  if (csvCache) return csvCache;
  const csvPath = path.join(process.cwd(), 'bangalore_traffic_timely_data.csv');
  const raw = fs.readFileSync(csvPath, 'utf-8');
  const lines = raw.split('\n').filter(l => l.trim());
  csvCache = lines.slice(1).map(line => {
    const c = line.split(',');
    return {
      area: c[1], road: c[2],
      volume: parseInt(c[3]) || 0,
      avgSpeed: parseFloat(c[4]) || 0,
      travelTimeIndex: parseFloat(c[5]) || 1,
      congestion: c[6], // High/Medium/Low
      capacityUtil: parseFloat(c[7]) || 0,
      incidents: parseInt(c[8]) || 0,
      envImpact: parseFloat(c[9]) || 0,
      weather: c[14],
      timeBlock: c[16],
      situation: c[17]?.trim(),
    };
  });
  return csvCache;
}

const TIME_BLOCKS = ['Midnight', 'Morning', 'Noon', 'Daytime', 'Evening', 'Night'];
const BLOCK_HOURS: Record<string, string> = {
  'Midnight': '12 AM – 6 AM',
  'Morning': '6 AM – 11 AM',
  'Noon': '11 AM – 2 PM',
  'Daytime': '2 PM – 6 PM',
  'Evening': '6 PM – 10 PM',
  'Night': '10 PM – 12 AM',
};

function getCurrentBlock(): string {
  const h = new Date().getHours();
  if (h >= 6 && h < 11) return 'Morning';
  if (h >= 11 && h < 14) return 'Noon';
  if (h >= 14 && h < 18) return 'Daytime';
  if (h >= 18 && h < 22) return 'Evening';
  if (h >= 22 || h < 2) return 'Night';
  return 'Midnight';
}

function getNextBlocks(current: string, count: number): string[] {
  const idx = TIME_BLOCKS.indexOf(current);
  const result: string[] = [];
  for (let i = 1; i <= count; i++) {
    result.push(TIME_BLOCKS[(idx + i) % TIME_BLOCKS.length]);
  }
  return result;
}

export async function GET(request: NextRequest) {
  try {
    const data = loadCSV();
    const currentBlock = getCurrentBlock();
    const upcomingBlocks = getNextBlocks(currentBlock, 4); // Next 4 time blocks
    const allPredictionBlocks = [currentBlock, ...upcomingBlocks];

    // Get unique areas
    const areas = [...new Set(data.map(r => r.area))];

    // ═══ BUILD PREDICTION MODEL PER AREA PER TIME BLOCK ═══
    // For each area + timeBlock, compute: avg volume, avg speed, congestion probability, avg capacity
    const model: Record<string, Record<string, {
      avgVolume: number; avgSpeed: number; avgCapacity: number;
      avgTTI: number; highPct: number; medPct: number; lowPct: number;
      incidentRate: number; sampleSize: number;
      speeds: number[]; volumes: number[];
    }>> = {};

    for (const row of data) {
      if (!model[row.area]) model[row.area] = {};
      if (!model[row.area][row.timeBlock]) {
        model[row.area][row.timeBlock] = {
          avgVolume: 0, avgSpeed: 0, avgCapacity: 0, avgTTI: 0,
          highPct: 0, medPct: 0, lowPct: 0,
          incidentRate: 0, sampleSize: 0, speeds: [], volumes: [],
        };
      }
      const m = model[row.area][row.timeBlock];
      m.avgVolume += row.volume;
      m.avgSpeed += row.avgSpeed;
      m.avgCapacity += row.capacityUtil;
      m.avgTTI += row.travelTimeIndex;
      m.incidentRate += row.incidents;
      m.sampleSize++;
      m.speeds.push(row.avgSpeed);
      m.volumes.push(row.volume);
      if (row.congestion === 'High') m.highPct++;
      else if (row.congestion === 'Medium') m.medPct++;
      else m.lowPct++;
    }

    // Normalize
    for (const area of Object.keys(model)) {
      for (const block of Object.keys(model[area])) {
        const m = model[area][block];
        const n = m.sampleSize;
        if (n > 0) {
          m.avgVolume = Math.round(m.avgVolume / n);
          m.avgSpeed = Math.round((m.avgSpeed / n) * 10) / 10;
          m.avgCapacity = Math.round((m.avgCapacity / n) * 10) / 10;
          m.avgTTI = Math.round((m.avgTTI / n) * 100) / 100;
          m.incidentRate = Math.round((m.incidentRate / n) * 100) / 100;
          m.highPct = Math.round((m.highPct / n) * 100);
          m.medPct = Math.round((m.medPct / n) * 100);
          m.lowPct = Math.round((m.lowPct / n) * 100);
        }
      }
    }

    // ═══ PREDICTIONS FOR EACH UPCOMING BLOCK ═══
    const predictions = allPredictionBlocks.map(block => {
      const areaForecasts = areas.map(area => {
        const m = model[area]?.[block];
        if (!m) return null;

        // Confidence: based on sample size and variance
        const speedVariance = m.speeds.length > 1
          ? m.speeds.reduce((s, v) => s + Math.pow(v - m.avgSpeed, 2), 0) / m.speeds.length
          : 0;
        const confidence = Math.min(95, Math.round(60 + (m.sampleSize / 50) * 20 - (speedVariance / 100) * 5));

        // Risk level
        let risk: 'critical' | 'high' | 'moderate' | 'low' = 'low';
        if (m.highPct >= 80) risk = 'critical';
        else if (m.highPct >= 60) risk = 'high';
        else if (m.highPct >= 30 || m.medPct >= 50) risk = 'moderate';

        return {
          area,
          predictedVolume: m.avgVolume,
          predictedSpeed: m.avgSpeed,
          predictedCapacity: m.avgCapacity,
          predictedTTI: m.avgTTI,
          congestionProbability: m.highPct,
          risk,
          incidentProbability: Math.min(100, Math.round(m.incidentRate * 100)),
          confidence,
          sampleSize: m.sampleSize,
        };
      }).filter(Boolean);

      // Sort by congestion probability (worst first)
      areaForecasts.sort((a: any, b: any) => b.congestionProbability - a.congestionProbability);

      return {
        timeBlock: block,
        hours: BLOCK_HOURS[block],
        isCurrent: block === currentBlock,
        areas: areaForecasts,
        summary: {
          criticalZones: areaForecasts.filter((a: any) => a.risk === 'critical').length,
          highRiskZones: areaForecasts.filter((a: any) => a.risk === 'high').length,
          avgCongestionProb: areaForecasts.length > 0
            ? Math.round(areaForecasts.reduce((s: number, a: any) => s + a.congestionProbability, 0) / areaForecasts.length)
            : 0,
          avgPredictedSpeed: areaForecasts.length > 0
            ? Math.round(areaForecasts.reduce((s: number, a: any) => s + a.predictedSpeed, 0) / areaForecasts.length * 10) / 10
            : 0,
        },
      };
    });

    // ═══ TOP ALERTS: Zones that WILL become critical in upcoming blocks ═══
    const alerts: any[] = [];
    const currentAreas = predictions[0]?.areas || [];
    for (const upcoming of predictions.slice(1)) {
      for (const forecast of (upcoming.areas as any[])) {
        const current = currentAreas.find((a: any) => a.area === forecast.area) as any;
        if (current && forecast.risk === 'critical' && current.risk !== 'critical') {
          alerts.push({
            area: forecast.area,
            currentRisk: current.risk,
            predictedRisk: 'critical',
            timeBlock: upcoming.timeBlock,
            hours: upcoming.hours,
            congestionProb: forecast.congestionProbability,
            predictedSpeed: forecast.predictedSpeed,
            message: `${forecast.area} will reach critical congestion during ${upcoming.timeBlock} (${upcoming.hours})`,
          });
        } else if (current && forecast.risk === 'high' && current.risk === 'low') {
          alerts.push({
            area: forecast.area,
            currentRisk: current.risk,
            predictedRisk: 'high',
            timeBlock: upcoming.timeBlock,
            hours: upcoming.hours,
            congestionProb: forecast.congestionProbability,
            predictedSpeed: forecast.predictedSpeed,
            message: `${forecast.area} expected to see high congestion during ${upcoming.timeBlock} (${upcoming.hours})`,
          });
        }
      }
    }

    // ═══ DAY TIMELINE: Full day congestion heatmap per area ═══
    const timeline = areas.map(area => ({
      area,
      blocks: TIME_BLOCKS.map(block => ({
        block,
        hours: BLOCK_HOURS[block],
        congestionProb: model[area]?.[block]?.highPct || 0,
        avgSpeed: model[area]?.[block]?.avgSpeed || 0,
        volume: model[area]?.[block]?.avgVolume || 0,
      })),
    }));

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      currentBlock,
      datasetSize: data.length,
      totalAreas: areas.length,
      predictions,
      alerts: alerts.slice(0, 10),
      timeline,
      timeBlocks: TIME_BLOCKS.map(b => ({ name: b, hours: BLOCK_HOURS[b] })),
    });
  } catch (error: any) {
    console.error('Predictions API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
