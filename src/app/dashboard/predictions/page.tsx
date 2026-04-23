'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';

interface Forecast {
  area: string; predictedVolume: number; predictedSpeed: number; predictedCapacity: number;
  predictedTTI: number; congestionProbability: number; risk: string;
  incidentProbability: number; confidence: number; sampleSize: number;
}
interface Prediction {
  timeBlock: string; hours: string; isCurrent: boolean;
  areas: Forecast[];
  summary: { criticalZones: number; highRiskZones: number; avgCongestionProb: number; avgPredictedSpeed: number };
}
interface Alert {
  area: string; currentRisk: string; predictedRisk: string;
  timeBlock: string; hours: string; congestionProb: number;
  predictedSpeed: number; message: string;
}
interface TimelineEntry {
  area: string;
  blocks: { block: string; hours: string; congestionProb: number; avgSpeed: number; volume: number }[];
}
interface PredictionData {
  currentBlock: string; datasetSize: number; totalAreas: number;
  predictions: Prediction[]; alerts: Alert[]; timeline: TimelineEntry[];
  timeBlocks: { name: string; hours: string }[];
}

function N({ value, dp = 0, suffix = '' }: { value: number; dp?: number; suffix?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const s = n, e = value, d = 600, t0 = Date.now();
    const id = setInterval(() => { const p = Math.min((Date.now() - t0) / d, 1); setN(s + (e - s) * (1 - Math.pow(1 - p, 3))); if (p >= 1) clearInterval(id); }, 16);
    return () => clearInterval(id);
  }, [value]);
  return <>{n.toFixed(dp)}{suffix}</>;
}

function Bar({ pct, color = '#3b82f6' }: { pct: number; color?: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-white/[0.04] overflow-hidden">
      <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(pct, 100)}%` }} transition={{ duration: 0.6 }}
        className="h-full rounded-full" style={{ backgroundColor: color }} />
    </div>
  );
}

function Card({ children, className = '', d = 0 }: { children: React.ReactNode; className?: string; d?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: d }}
      className={`rounded-xl border border-white/[0.06] bg-[#0d1117] p-5 ${className}`}>{children}</motion.div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[11px] font-semibold text-white/40 uppercase tracking-[0.12em] mb-4">{children}</h3>;
}

const riskColor = (r: string) => r === 'critical' ? '#ef4444' : r === 'high' ? '#f59e0b' : r === 'moderate' ? '#3b82f6' : '#22c55e';
const riskBg = (r: string) => r === 'critical' ? 'bg-red-500/[0.08] border-red-500/15 text-red-400' : r === 'high' ? 'bg-amber-500/[0.08] border-amber-500/15 text-amber-400' : r === 'moderate' ? 'bg-blue-500/[0.08] border-blue-500/15 text-blue-400' : 'bg-emerald-500/[0.08] border-emerald-500/15 text-emerald-400';

/* ═══════════════ HEATMAP CELL ═══════════════ */
function HeatCell({ value, max = 100 }: { value: number; max?: number }) {
  const intensity = Math.min(value / max, 1);
  const r = Math.round(34 + intensity * 200);
  const g = Math.round(197 - intensity * 160);
  const b = Math.round(94 - intensity * 50);
  const bg = intensity > 0.6 ? `rgba(239, 68, 68, ${0.15 + intensity * 0.3})` : intensity > 0.3 ? `rgba(245, 158, 11, ${0.1 + intensity * 0.2})` : `rgba(34, 197, 94, ${0.08 + intensity * 0.12})`;
  return (
    <div className="w-full h-8 rounded flex items-center justify-center text-[10px] font-medium transition-all"
      style={{ backgroundColor: bg, color: intensity > 0.6 ? '#fca5a5' : intensity > 0.3 ? '#fcd34d' : '#86efac' }}>
      {value}%
    </div>
  );
}

export default function PredictionsPage() {
  const [data, setData] = useState<PredictionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBlock, setSelectedBlock] = useState(0);
  const [ts, setTs] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/predictions');
      const j = await r.json();
      if (j.success) { setData(j); setTs(new Date().toLocaleTimeString()); }
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading || !data) return (
    <div className="min-h-screen bg-[#0a0e17] flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-violet-500/40 border-t-violet-500 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-white/30">Analyzing {'>'}33,000 data points...</p>
      </div>
    </div>
  );

  const activePrediction = data.predictions[selectedBlock];

  return (
    <div className="min-h-screen bg-[#0a0e17] text-white/90 p-6 pb-16 overflow-y-auto">

      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Predictive Engine</h1>
          <p className="text-xs text-white/30 mt-1">
            Statistical forecasting from <span className="text-violet-400">{data.datasetSize.toLocaleString()}</span> historical observations · {data.totalAreas} zones
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-white/30">
          <span className="px-2 py-0.5 rounded bg-violet-500/10 border border-violet-500/15 text-violet-400 text-[10px] font-medium">
            Now: {data.currentBlock}
          </span>
          {ts}
        </div>
      </div>

      {/* ── Proactive Alerts ── */}
      {data.alerts.length > 0 && (
        <Card d={0.05} className="mb-5 border-amber-500/10">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <Label>Preemptive Disruption Alerts</Label>
          </div>
          <div className="space-y-2">
            {data.alerts.map((alert, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                className={`flex items-center gap-3 p-3 rounded-lg border ${riskBg(alert.predictedRisk)}`}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                  style={{ backgroundColor: `${riskColor(alert.predictedRisk)}15` }}>
                  {alert.predictedRisk === 'critical' ? '🔴' : '🟡'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white/70">{alert.message}</p>
                  <p className="text-[10px] text-white/30 mt-0.5">
                    Predicted speed: {alert.predictedSpeed} km/h · Congestion probability: {alert.congestionProb}%
                  </p>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded border ${riskBg(alert.predictedRisk)}`}>
                    {alert.predictedRisk}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Time Block Selector ── */}
      <div className="flex gap-1.5 mb-5 bg-[#0d1117] rounded-xl p-1.5 border border-white/[0.04] w-fit">
        {data.predictions.map((pred, i) => (
          <button key={i} onClick={() => setSelectedBlock(i)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              selectedBlock === i
                ? 'bg-violet-500/15 text-violet-300 border border-violet-500/20'
                : 'text-white/30 hover:text-white/50 hover:bg-white/[0.03] border border-transparent'
            }`}>
            <span className={pred.isCurrent ? 'text-emerald-400' : ''}>{pred.isCurrent ? '● ' : ''}</span>
            {pred.timeBlock}
            <span className="block text-[9px] text-white/20 mt-0.5">{pred.hours}</span>
          </button>
        ))}
      </div>

      {/* ── Selected Block Summary ── */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { l: 'Critical Zones', v: activePrediction.summary.criticalZones, c: 'text-red-400' },
          { l: 'High Risk Zones', v: activePrediction.summary.highRiskZones, c: 'text-amber-400' },
          { l: 'Avg Congestion Prob.', v: activePrediction.summary.avgCongestionProb, c: 'text-white/70', s: '%' },
          { l: 'Predicted Avg Speed', v: activePrediction.summary.avgPredictedSpeed, c: 'text-white/70', s: ' km/h' },
        ].map((k, i) => (
          <Card key={i} d={0.1 + i * 0.04}>
            <p className="text-[10px] text-white/25 uppercase tracking-wider">{k.l}</p>
            <p className={`text-2xl font-semibold mt-1 ${k.c}`}><N value={k.v} dp={k.s === ' km/h' ? 1 : 0} suffix={k.s || ''} /></p>
            <p className="text-[10px] text-white/15 mt-0.5">{activePrediction.timeBlock} · {activePrediction.hours}</p>
          </Card>
        ))}
      </div>

      {/* ── Area Forecasts Table ── */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <Card d={0.3} className="col-span-2">
          <Label>{activePrediction.isCurrent ? 'Current' : 'Predicted'} Zone Status — {activePrediction.timeBlock}</Label>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  {['Zone', 'Risk', 'Congestion %', 'Speed', 'Volume', 'TTI', 'Confidence'].map(h => (
                    <th key={h} className="text-left py-2 px-2.5 text-white/20 font-medium uppercase tracking-wider text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activePrediction.areas.map((a: any, i: number) => (
                  <tr key={i} className="border-b border-white/[0.02] hover:bg-white/[0.01] transition-colors">
                    <td className="py-2 px-2.5 text-white/60 font-medium">{a.area}</td>
                    <td className="py-2 px-2.5">
                      <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${riskBg(a.risk)}`}>{a.risk}</span>
                    </td>
                    <td className="py-2 px-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-12"><Bar pct={a.congestionProbability} color={riskColor(a.risk)} /></div>
                        <span className="text-white/40">{a.congestionProbability}%</span>
                      </div>
                    </td>
                    <td className={`py-2 px-2.5 font-medium ${a.predictedSpeed < 25 ? 'text-red-400' : a.predictedSpeed < 40 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {a.predictedSpeed} km/h
                    </td>
                    <td className="py-2 px-2.5 text-white/40">{a.predictedVolume.toLocaleString()}</td>
                    <td className="py-2 px-2.5 text-white/40">{a.predictedTTI}x</td>
                    <td className="py-2 px-2.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-10"><Bar pct={a.confidence} color="#8b5cf6" /></div>
                        <span className="text-white/30 text-[10px]">{a.confidence}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Risk Distribution */}
        <Card d={0.35}>
          <Label>Risk Distribution</Label>
          <div className="space-y-3 mb-5">
            {[
              { l: 'Critical', n: activePrediction.areas.filter((a: any) => a.risk === 'critical').length, c: '#ef4444' },
              { l: 'High', n: activePrediction.areas.filter((a: any) => a.risk === 'high').length, c: '#f59e0b' },
              { l: 'Moderate', n: activePrediction.areas.filter((a: any) => a.risk === 'moderate').length, c: '#3b82f6' },
              { l: 'Low', n: activePrediction.areas.filter((a: any) => a.risk === 'low').length, c: '#22c55e' },
            ].map((r, i) => (
              <div key={i}>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-white/35">{r.l}</span>
                  <span className="font-medium" style={{ color: r.c }}>{r.n} zones</span>
                </div>
                <Bar pct={activePrediction.areas.length > 0 ? (r.n / activePrediction.areas.length) * 100 : 0} color={r.c} />
              </div>
            ))}
          </div>

          <Label>Incident Probability</Label>
          <div className="space-y-2">
            {activePrediction.areas
              .filter((a: any) => a.incidentProbability > 30)
              .sort((a: any, b: any) => b.incidentProbability - a.incidentProbability)
              .slice(0, 5)
              .map((a: any, i: number) => (
                <div key={i} className="flex justify-between text-[11px]">
                  <span className="text-white/35 truncate max-w-[120px]">{a.area}</span>
                  <span className={`font-medium ${a.incidentProbability > 60 ? 'text-red-400' : 'text-amber-400'}`}>{a.incidentProbability}%</span>
                </div>
              ))}
          </div>
        </Card>
      </div>

      {/* ── Congestion Heatmap Timeline ── */}
      <Card d={0.4} className="mb-5">
        <Label>24-Hour Congestion Forecast Heatmap</Label>
        <p className="text-[10px] text-white/20 -mt-2 mb-4">Each cell shows the predicted probability of high congestion based on historical patterns</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.04]">
                <th className="text-left py-2 px-2 text-white/20 font-medium uppercase tracking-wider text-[10px] w-32 sticky left-0 bg-[#0d1117]">Zone</th>
                {data.timeBlocks.map(b => (
                  <th key={b.name} className={`text-center py-2 px-1 text-[10px] font-medium uppercase tracking-wider min-w-[70px] ${b.name === data.currentBlock ? 'text-violet-400' : 'text-white/20'}`}>
                    {b.name}
                    <span className="block text-[8px] text-white/15 font-normal">{b.hours}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.timeline
                .sort((a, b) => {
                  const aMax = Math.max(...a.blocks.map(bl => bl.congestionProb));
                  const bMax = Math.max(...b.blocks.map(bl => bl.congestionProb));
                  return bMax - aMax;
                })
                .map((row, i) => (
                  <tr key={i} className="border-b border-white/[0.02]">
                    <td className="py-1.5 px-2 text-white/50 font-medium sticky left-0 bg-[#0d1117] text-[11px]">{row.area}</td>
                    {row.blocks.map((b, j) => (
                      <td key={j} className={`py-1.5 px-1 ${b.block === data.currentBlock ? 'bg-violet-500/[0.03]' : ''}`}>
                        <HeatCell value={b.congestionProb} />
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-white/[0.04]">
          <span className="text-[10px] text-white/20">Legend:</span>
          {[
            { l: '< 30% Low', c: 'rgba(34, 197, 94, 0.15)' },
            { l: '30-60% Moderate', c: 'rgba(245, 158, 11, 0.2)' },
            { l: '> 60% High', c: 'rgba(239, 68, 68, 0.3)' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: item.c }} />
              <span className="text-[10px] text-white/25">{item.l}</span>
            </div>
          ))}
        </div>
      </Card>

      <p className="text-center text-[10px] text-white/10 mt-6">
        Predictions based on statistical analysis of {data.datasetSize.toLocaleString()} historical observations across {data.totalAreas} Bangalore zones
      </p>
    </div>
  );
}
