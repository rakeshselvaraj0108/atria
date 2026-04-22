'use client';
import { useState } from 'react';
import { useTraffic } from '@/lib/TrafficContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { motion, AnimatePresence } from 'framer-motion';
import { Beaker, CloudRain, AlertTriangle, Fuel, X } from 'lucide-react';

export function StressTestSimulator() {
  const { stressTestResult, setStressTestResult, addNotification } = useTraffic();
  const [isOpen, setIsOpen] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  const runSimulation = async (scenario: string) => {
    setIsSimulating(true);
    try {
      const res = await fetch('/api/simulation/stress-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario })
      });
      const data = await res.json();
      if (data.success) {
        setStressTestResult(data);
        addNotification(`Stress Test "${scenario}" completed.`, 'success');
        setIsOpen(false);
      } else {
        addNotification(`Stress Test failed: ${data.error}`, 'danger');
      }
    } catch (e) {
        console.error(e);
      addNotification('Stress test failed to run', 'danger');
    }
    setIsSimulating(false);
  };

  const clearSimulation = () => {
    setStressTestResult(null);
  };

  return (
    <>
      {/* Sidebar Button Replacement */}
      <div className="w-full">
        {stressTestResult ? (
          <Button 
            variant="danger"
            onClick={clearSimulation}
            className="w-full justify-start flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white"
          >
            <X className="w-4 h-4" /> Exit Simulation
          </Button>
        ) : (
          <Button 
            variant="outline"
            onClick={() => setIsOpen(true)}
            className="w-full justify-start flex items-center gap-2 border-purple-500/50 hover:border-purple-500 text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.2)]"
          >
            <Beaker className="w-4 h-4" /> 🧪 Stress Test
          </Button>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0c1018] border border-white/10 rounded-2xl p-6 w-full max-w-4xl shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-3">
                  <Beaker className="text-purple-400" />
                  Simulation Scenarios
                </h2>
                <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Scenario 1 */}
                <Card className="p-6 border-blue-500/30 hover:border-blue-500/60 flex flex-col gap-4 cursor-pointer transition-all hover:bg-blue-500/5" onClick={() => runSimulation('monsoon')}>
                  <div className="h-12 w-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <CloudRain className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Monsoon Rush Hour</h3>
                    <p className="text-sm text-gray-400 mt-2">Heavy rain + rush hour multipliers + 3 random critical incidents across the city.</p>
                  </div>
                  <Button disabled={isSimulating} className="w-full mt-auto" variant="outline">
                    {isSimulating ? 'Simulating...' : 'Run Simulation'}
                  </Button>
                </Card>

                {/* Scenario 2 */}
                <Card className="p-6 border-red-500/30 hover:border-red-500/60 flex flex-col gap-4 cursor-pointer transition-all hover:bg-red-500/5" onClick={() => runSimulation('silkboard')}>
                  <div className="h-12 w-12 rounded-full bg-red-500/20 flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Silk Board Collapse</h3>
                    <p className="text-sm text-gray-400 mt-2">Critical incident at Silk Board zone, 100% congestion cascades to adjacent zones.</p>
                  </div>
                  <Button disabled={isSimulating} className="w-full mt-auto border-red-500 text-red-400" variant="outline">
                    {isSimulating ? 'Simulating...' : 'Run Simulation'}
                  </Button>
                </Card>

                {/* Scenario 3 */}
                <Card className="p-6 border-orange-500/30 hover:border-orange-500/60 flex flex-col gap-4 cursor-pointer transition-all hover:bg-orange-500/5" onClick={() => runSimulation('fuel')}>
                  <div className="h-12 w-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                    <Fuel className="w-6 h-6 text-orange-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Fuel Crisis</h3>
                    <p className="text-sm text-gray-400 mt-2">All fuel stations unavailable, testing routing for fuel-constrained units.</p>
                  </div>
                  <Button disabled={isSimulating} className="w-full mt-auto border-orange-500 text-orange-400" variant="outline">
                    {isSimulating ? 'Simulating...' : 'Run Simulation'}
                  </Button>
                </Card>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Results Panel */}
      <AnimatePresence>
        {stressTestResult && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-4 right-4 z-50 w-96 bg-black/80 backdrop-blur-xl border border-orange-500/50 rounded-xl p-6 shadow-[0_0_30px_rgba(249,115,22,0.2)]"
          >
            <div className="flex items-center gap-3 mb-4 text-orange-500">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold">SIMULATED RESULTS</h3>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg">
                <span className="text-gray-400">Vehicles Rerouted</span>
                <span className="text-xl font-bold">{stressTestResult.stats.rerouted}</span>
              </div>
              <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg">
                <span className="text-gray-400">At SLA Risk</span>
                <span className="text-xl font-bold text-red-400">{stressTestResult.stats.slaRisk}</span>
              </div>
              <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg">
                <span className="text-gray-400">Zones Affected</span>
                <span className="text-xl font-bold text-orange-400">{stressTestResult.stats.cascadeImpact}</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-4 text-center">Live fleet state is preserved.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
