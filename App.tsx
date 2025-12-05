import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameMode, BusMode, Gear, BusState, Route, TN_CITIES, LOCAL_STOPS } from './types';
import { Pedals } from './components/Pedals';
import { GearStick } from './components/GearStick';
import { DriverTV } from './components/DriverTV';
import { generateStopAnnouncement, generateRandomEvent } from './services/geminiService';
import { Play, MapPin, Users, Info, Settings, AlertTriangle, Monitor } from 'lucide-react';

// --- Assets ---
// Using placeholder sounds for demo purposes (would normally import audio files)
const SOUND_GRIND = 'https://assets.mixkit.co/active_storage/sfx/2653/2653-preview.mp3'; 
const SOUND_AIR_BRAKE = 'https://assets.mixkit.co/active_storage/sfx/2658/2658-preview.mp3';

const App: React.FC = () => {
  // --- Game State ---
  const [mode, setMode] = useState<GameMode>(GameMode.MENU);
  const [busMode, setBusMode] = useState<BusMode>(BusMode.LOCAL);
  
  // --- Simulation State ---
  const [busState, setBusState] = useState<BusState>({
    speed: 0,
    rpm: 0,
    gear: Gear.NEUTRAL,
    isEngineOn: false,
    fuel: 100,
    temperature: 80,
    odometer: 12543,
    doorsOpen: false,
    wiperOn: false,
    headlightsOn: false
  });

  const [controls, setControls] = useState({
    clutch: false,
    brake: false,
    accel: false,
    steering: 0 // -100 to 100
  });

  // --- Route & AI State ---
  const [route, setRoute] = useState<Route>({
    id: 'local-1',
    name: 'Parvathipuram Circular',
    start: 'Parvathipuram',
    end: 'Nagercoil',
    stops: LOCAL_STOPS,
    distanceKm: 15
  });
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [conductorMessage, setConductorMessage] = useState("");
  const [notifications, setNotifications] = useState<string[]>([]);
  const [stopRequestActive, setStopRequestActive] = useState(false);
  const [distToNextStop, setDistToNextStop] = useState(2.5); // km

  // --- Audio Refs ---
  const grindAudio = useRef<HTMLAudioElement>(new Audio(SOUND_GRIND));

  // --- Game Loop ---
  useEffect(() => {
    if (mode !== GameMode.DRIVING) return;

    const loop = setInterval(() => {
      setBusState(prev => {
        let newSpeed = prev.speed;
        let newRpm = prev.rpm;
        
        // Physics Simulation (Simplified)
        const accelFactor = controls.accel ? 1 : 0;
        const brakeFactor = controls.brake ? 2 : 0;
        const friction = 0.05;

        // Engine Logic
        if (prev.isEngineOn) {
          // Acceleration based on gear
          if (prev.gear !== Gear.NEUTRAL && !controls.clutch) {
            const gearRatio = [0, 0.2, 0.4, 0.6, 0.8, 1.0][Math.abs(prev.gear)] || 0;
            if (accelFactor > 0) {
              newSpeed += (accelFactor * gearRatio * 0.5);
              newRpm += 50;
            }
          }
           // Revving in neutral/clutch
          if (prev.gear === Gear.NEUTRAL || controls.clutch) {
             if (controls.accel) newRpm += 100;
             else newRpm -= 100;
          }
        }

        // Deceleration
        newSpeed -= (brakeFactor * 0.5 + friction);
        if (newSpeed < 0) newSpeed = 0;
        
        // RPM Simulation based on speed and gear
        if (!controls.clutch && prev.gear !== Gear.NEUTRAL) {
             newRpm = (newSpeed * 30) + 800; // Idle roughly 800
        } else if (!controls.accel) {
             newRpm = 800;
        }

        // Cap RPM
        if (newRpm > 6000) newRpm = 6000;
        if (newRpm < 0) newRpm = 0;

        // Odometer
        const distanceTraveled = (newSpeed / 3600) / 10; // km per tick (approx 100ms)
        
        // Distance Logic
        if (newSpeed > 0) {
            setDistToNextStop(d => Math.max(0, d - distanceTraveled));
        }

        return {
          ...prev,
          speed: newSpeed,
          rpm: newRpm,
          odometer: prev.odometer + distanceTraveled
        };
      });
    }, 100);

    return () => clearInterval(loop);
  }, [mode, controls]);

  // --- Event Handling ---
  const handleShift = (newGear: Gear) => {
    if (!controls.clutch && newGear !== Gear.NEUTRAL) {
      // Grind gears!
      addNotification("WARNING: Press Clutch to Shift!", "red");
      try { grindAudio.current.currentTime = 0; grindAudio.current.play(); } catch(e){}
      return;
    }
    setBusState(prev => ({ ...prev, gear: newGear }));
  };

  const toggleEngine = () => {
    setBusState(prev => ({ ...prev, isEngineOn: !prev.isEngineOn }));
    addNotification(busState.isEngineOn ? "Engine Stopped" : "Engine Started", "yellow");
  };

  const addNotification = (msg: string, color: string = "white") => {
    setNotifications(prev => [msg, ...prev].slice(0, 3));
  };

  const confirmStop = async () => {
    if (busState.speed > 5) {
      addNotification("Too fast to open doors!", "red");
      return;
    }
    
    setBusState(prev => ({ ...prev, doorsOpen: true }));
    setStopRequestActive(false);
    
    // AI Announcement
    const nextCity = route.stops[(currentStopIndex + 1) % route.stops.length];
    const announcement = await generateStopAnnouncement(route.stops[currentStopIndex], nextCity);
    setConductorMessage(announcement);
    
    setTimeout(() => {
       setBusState(prev => ({ ...prev, doorsOpen: false }));
       setCurrentStopIndex(prev => (prev + 1) % route.stops.length);
       setDistToNextStop(Math.random() * 5 + 2); // Reset distance to next random stop
       
       // Trigger random event after leaving
       setTimeout(async () => {
          const evt = await generateRandomEvent();
          addNotification(`EVENT: ${evt.event}`, "blue");
       }, 5000);

    }, 3000);
  };

  // --- Render Methods ---
  
  if (mode === GameMode.MENU) {
    return (
      <div className="w-full h-screen bg-gradient-to-br from-slate-900 to-black flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://picsum.photos/1920/1080')] opacity-20 bg-cover bg-center"></div>
        <div className="z-10 text-center p-8 bg-black/60 backdrop-blur-md rounded-2xl border border-yellow-600/30 shadow-2xl max-w-2xl w-full">
          <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-red-600 mb-2 drop-shadow-sm">
            TAMIL NADU 3D
          </h1>
          <h2 className="text-3xl text-white font-serif mb-8 tracking-widest">BUS SIMULATOR</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <button 
              onClick={() => { setBusMode(BusMode.OMNI); setMode(GameMode.SELECTION); }}
              className="group p-6 bg-slate-800 hover:bg-yellow-900 border border-slate-600 hover:border-yellow-500 rounded-xl transition-all duration-300 transform hover:-translate-y-1"
            >
              <div className="text-4xl mb-3">🚍</div>
              <h3 className="text-xl font-bold text-white mb-1">Omni Mode</h3>
              <p className="text-xs text-gray-400">Inter-city sleeper buses. Long routes.</p>
            </button>
            <button 
              onClick={() => { setBusMode(BusMode.LOCAL); setMode(GameMode.SELECTION); }}
              className="group p-6 bg-slate-800 hover:bg-green-900 border border-slate-600 hover:border-green-500 rounded-xl transition-all duration-300 transform hover:-translate-y-1"
            >
              <div className="text-4xl mb-3">🚌</div>
              <h3 className="text-xl font-bold text-white mb-1">Local Mode</h3>
              <p className="text-xs text-gray-400">Town bus. Frequent stops. Kanyakumari.</p>
            </button>
          </div>
          
          <div className="text-xs text-gray-500 font-mono">Ver 1.0 | Offline Ready | React Engine</div>
        </div>
      </div>
    );
  }

  if (mode === GameMode.SELECTION) {
    return (
      <div className="w-full h-screen bg-slate-900 flex flex-col p-8">
        <h2 className="text-3xl text-white font-bold mb-8 flex items-center gap-2">
          <Settings className="text-yellow-500"/> Trip Configuration
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 h-full">
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
             <h3 className="text-xl text-yellow-500 mb-4 font-bold">Select Route</h3>
             <div className="space-y-2">
                {(busMode === BusMode.OMNI ? TN_CITIES : LOCAL_STOPS).map((stop, i) => (
                  <div key={i} className="p-3 bg-gray-700 rounded text-gray-300 flex justify-between items-center cursor-pointer hover:bg-gray-600">
                     <span>Route {i+1}: {stop} Loop</span>
                     <MapPin size={16} />
                  </div>
                ))}
             </div>
          </div>

          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 flex flex-col items-center">
             <h3 className="text-xl text-yellow-500 mb-4 font-bold">Driver & Conductor</h3>
             <div className="w-32 h-32 rounded-full bg-gray-600 mb-4 overflow-hidden border-4 border-yellow-600">
               <img src="https://picsum.photos/200" alt="Driver" className="w-full h-full object-cover" />
             </div>
             <input type="text" defaultValue="Raja" className="bg-gray-900 text-white p-2 rounded mb-2 w-full text-center" />
             <div className="text-xs text-gray-400 mb-6">TNSTC Grade I Driver</div>

             <div className="w-full mt-auto">
               <button 
                 onClick={() => setMode(GameMode.DRIVING)}
                 className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg text-xl shadow-lg transition-colors flex items-center justify-center gap-2"
               >
                 <Play size={24} /> START ENGINE
               </button>
             </div>
          </div>
          
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
            <h3 className="text-xl text-yellow-500 mb-4 font-bold">Vehicle Status</h3>
            <div className="space-y-4">
              <div className="flex justify-between text-gray-300 border-b border-gray-700 pb-2">
                <span>Model</span>
                <span className="font-mono text-white">{busMode === BusMode.OMNI ? "Leyland Sleeper" : "Ashok Leyland Viking"}</span>
              </div>
              <div className="flex justify-between text-gray-300 border-b border-gray-700 pb-2">
                <span>Registration</span>
                <span className="font-mono text-white">TN-74 N-1234</span>
              </div>
              <div className="flex justify-between text-gray-300 border-b border-gray-700 pb-2">
                <span>Engine Health</span>
                <span className="font-mono text-green-400">98%</span>
              </div>
              <div className="mt-8 bg-blue-900/30 p-4 rounded text-sm text-blue-200">
                <Info size={16} className="inline mr-2"/>
                Tip: Remember to check engine oil before long trips.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- DRIVING MODE (HUD) ---
  return (
    <div className="w-full h-screen bg-black relative flex flex-col font-sans select-none overflow-hidden">
      
      {/* --- TOP HUD --- */}
      <div className="h-[15%] w-full bg-gradient-to-b from-black to-transparent flex justify-between px-6 py-2 z-20">
        
        {/* Left Top: Nav */}
        <div className="w-1/4">
          <div className="flex items-center gap-2 text-yellow-500 font-bold uppercase tracking-wider text-sm mb-1">
            <MapPin size={16} /> Live Navigation
          </div>
          <div className="bg-gray-900/80 p-2 rounded border-l-4 border-yellow-500 backdrop-blur-sm">
             <div className="text-white font-bold text-lg leading-tight">{route.stops[currentStopIndex]} Road</div>
             <div className="text-gray-400 text-xs mt-1">Next: {route.stops[(currentStopIndex + 1) % route.stops.length]} ({distToNextStop.toFixed(1)} km)</div>
          </div>
        </div>

        {/* Top Middle: Clock & TV */}
        <div className="w-1/3 flex flex-col items-center">
          <div className="bg-gray-800 px-4 py-1 rounded-full text-green-400 font-mono text-sm border border-gray-700 shadow-lg mb-2">
            10:42 AM | ☀️ Day
          </div>
          <DriverTV 
            currentStop={route.stops[currentStopIndex]} 
            nextStop={route.stops[(currentStopIndex + 1) % route.stops.length]}
            message={conductorMessage}
            isAlertActive={stopRequestActive || distToNextStop < 0.2} 
          />
        </div>

        {/* Right Top: Speed & Gauges */}
        <div className="w-1/4 flex flex-col items-end">
           <div className="flex items-baseline gap-1">
             <span className="text-6xl font-black text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
               {Math.floor(busState.speed)}
             </span>
             <span className="text-xl text-gray-400 font-bold">KM/H</span>
           </div>
           <div className="flex gap-4 mt-2">
             <div className="text-right">
               <div className="text-xs text-gray-500">GEAR</div>
               <div className="text-2xl font-bold text-blue-400 font-mono">
                 {busState.gear === 0 ? 'N' : busState.gear === -1 ? 'R' : busState.gear}
               </div>
             </div>
             <div className="text-right">
               <div className="text-xs text-gray-500">RPM</div>
               <div className={`text-2xl font-bold font-mono ${busState.rpm > 2500 ? 'text-red-500' : 'text-white'}`}>
                 {Math.floor(busState.rpm)}
               </div>
             </div>
           </div>
           {/* Notifications Overlay */}
           <div className="mt-4 flex flex-col items-end gap-1 w-full">
             {notifications.map((n, i) => (
               <div key={i} className="bg-black/70 text-white text-xs px-2 py-1 rounded border-r-2 border-yellow-500 animate-fade-in-down">
                 {n}
               </div>
             ))}
           </div>
        </div>
      </div>

      {/* --- MIDDLE WINDSHIELD (SCENE) --- */}
      <div className="flex-1 w-full relative overflow-hidden bg-gray-800">
         {/* Simple Visual Representation of Road */}
         <div className="absolute inset-0 bg-[url('https://picsum.photos/1920/1080?blur=2')] bg-cover bg-center opacity-50"></div>
         
         {/* Moving road effect (CSS trick) */}
         <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-[200%] h-full bg-gradient-to-t from-gray-900 via-transparent to-transparent ${busState.speed > 1 ? 'animate-pulse' : ''}`}></div>

         {/* Center Dashboard View */}
         <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {busState.speed > 0 && <div className="text-white/20 text-9xl font-black animate-pulse">DRIVING...</div>}
         </div>
      </div>

      {/* --- BOTTOM CONTROLS --- */}
      <div className="h-[40%] w-full bg-gradient-to-t from-gray-900 to-gray-800 border-t-4 border-gray-700 flex z-30">
        
        {/* Left Middle: Gear Stick */}
        <div className="w-1/4 p-4 flex items-center justify-center border-r border-gray-700/50">
          <GearStick 
            currentGear={busState.gear} 
            onShift={handleShift} 
            clutchPressed={controls.clutch} 
          />
        </div>

        {/* Center: Wheel & Buttons */}
        <div className="flex-1 p-4 flex flex-col justify-between">
           {/* Dashboard Buttons */}
           <div className="flex justify-center gap-4 mb-4">
              <button 
                onClick={toggleEngine}
                className={`w-16 h-16 rounded-full border-4 shadow-lg flex items-center justify-center font-bold text-xs uppercase transition-all ${busState.isEngineOn ? 'border-green-600 bg-green-900 text-green-100' : 'border-red-600 bg-red-900 text-red-100'}`}
              >
                {busState.isEngineOn ? 'STOP' : 'START'}
              </button>
              
              <button 
                onClick={confirmStop}
                disabled={busState.speed > 5}
                className={`px-6 py-2 rounded border-2 font-bold uppercase transition-all flex flex-col items-center justify-center ${busState.doorsOpen ? 'bg-red-600 border-red-400 text-white' : 'bg-gray-700 border-gray-500 text-gray-300'}`}
              >
                <Users size={20} />
                <span className="text-[10px] mt-1">Doors / Stop</span>
              </button>

              <button className="w-12 h-12 rounded bg-gray-700 border border-gray-600 flex items-center justify-center hover:bg-gray-600">
                <Monitor size={16} className="text-cyan-400" />
              </button>
              
              <button 
                 onClick={() => setStopRequestActive(true)}
                 className="w-12 h-12 rounded bg-yellow-900/50 border border-yellow-600 flex items-center justify-center hover:bg-yellow-800 text-yellow-500"
                 title="Simulate Passenger Bell"
              >
                <AlertTriangle size={16} />
              </button>
           </div>

           {/* Steering Wheel (Simplified visual) */}
           <div className="flex justify-center items-center relative">
              <div 
                className="w-64 h-64 rounded-full border-[16px] border-black bg-gray-800 shadow-2xl flex items-center justify-center relative transform transition-transform duration-100 ease-linear cursor-grab active:cursor-grabbing"
                style={{ transform: `rotate(${controls.steering}deg)` }}
                onMouseMove={(e) => {
                   if (e.buttons === 1) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = e.clientX - (rect.left + rect.width/2);
                      setControls(p => ({...p, steering: Math.max(-100, Math.min(100, x))}));
                   }
                }}
                onMouseUp={() => setControls(p => ({...p, steering: 0}))}
                onMouseLeave={() => setControls(p => ({...p, steering: 0}))}
              >
                 <div className="w-full h-8 bg-black absolute"></div>
                 <div className="h-full w-8 bg-black absolute"></div>
                 <div className="w-16 h-16 bg-yellow-700 rounded-full z-10 border-4 border-yellow-900 flex items-center justify-center shadow-inner">
                    <span className="text-[8px] font-bold text-yellow-200">LEYLAND</span>
                 </div>
              </div>
           </div>
        </div>

        {/* Right Bottom: Pedals */}
        <div className="w-1/3 border-l border-gray-700/50 bg-black/20">
          <Pedals 
            isClutchPressed={controls.clutch}
            isBrakePressed={controls.brake}
            isAccelPressed={controls.accel}
            onClutchChange={(v) => setControls(p => ({ ...p, clutch: v }))}
            onBrakeChange={(v) => setControls(p => ({ ...p, brake: v }))}
            onAccelChange={(v) => setControls(p => ({ ...p, accel: v }))}
          />
        </div>

      </div>

      {/* Touch Warning for small screens */}
      <div className="md:hidden absolute inset-0 bg-black/90 z-50 flex items-center justify-center text-center p-8">
        <h1 className="text-2xl text-yellow-500 font-bold">Please Rotate Device to Landscape</h1>
      </div>
    </div>
  );
};

export default App;
