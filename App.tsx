
import React, { useState, useEffect, useRef } from 'react';
import { GameMode, BusMode, Gear, BusState, Route, TN_DISTRICTS, LOCAL_STOPS } from './types';
import { Pedals } from './components/Pedals';
import { GearStick } from './components/GearStick';
import { DriverTV } from './components/DriverTV';
import { generateStopAnnouncement, generateRandomEvent } from './services/geminiService';
import { Play, MapPin, Users, Info, Settings, AlertTriangle, Power, ArrowRight, RotateCcw } from 'lucide-react';

// --- Assets ---
const SOUND_CRANK = 'https://cdn.freesound.org/previews/316/316933_5583501-lq.mp3';
const SOUND_START = 'https://cdn.freesound.org/previews/155/155563_2634458-lq.mp3'; // Idling
const SOUND_GRIND = 'https://assets.mixkit.co/active_storage/sfx/2653/2653-preview.mp3'; 
const SOUND_SPUTTER = 'https://cdn.freesound.org/previews/173/173930_3126296-lq.mp3'; // Engine stop puff

const App: React.FC = () => {
  // --- Game State ---
  const [mode, setMode] = useState<GameMode>(GameMode.MENU);
  const [busMode, setBusMode] = useState<BusMode>(BusMode.LOCAL);
  const [selectionStep, setSelectionStep] = useState<'ROUTE' | 'DRIVER' | 'READY'>('ROUTE');
  
  // --- Omni Route Selection State ---
  const [omniFrom, setOmniFrom] = useState(TN_DISTRICTS[0]);
  const [omniTo, setOmniTo] = useState(TN_DISTRICTS[5]);
  
  // --- Simulation State ---
  const [busState, setBusState] = useState<BusState>({
    speed: 0,
    rpm: 0,
    gear: Gear.NEUTRAL,
    isEngineOn: false,
    isCranking: false,
    isSputtering: false,
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
    steering: 0 // -120 to 120
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
  const crankAudio = useRef<HTMLAudioElement>(new Audio(SOUND_CRANK));
  const idleAudio = useRef<HTMLAudioElement>(new Audio(SOUND_START));
  const grindAudio = useRef<HTMLAudioElement>(new Audio(SOUND_GRIND));
  const sputterAudio = useRef<HTMLAudioElement>(new Audio(SOUND_SPUTTER));

  useEffect(() => {
    idleAudio.current.loop = true;
    idleAudio.current.volume = 0.5;
  }, []);

  // --- Engine Audio Logic ---
  useEffect(() => {
    if (busState.isEngineOn) {
      if (idleAudio.current.paused) idleAudio.current.play().catch(() => {});
      // Pitch modulation based on RPM
      idleAudio.current.playbackRate = 0.8 + (busState.rpm / 6000);
    } else {
      idleAudio.current.pause();
    }
  }, [busState.isEngineOn, busState.rpm]);

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

        // Cranking Animation (Shake RPM)
        if (prev.isCranking) {
           return { ...prev, rpm: Math.random() * 300 + 100 };
        }

        // Sputtering Animation (Shake RPM on stop)
        if (prev.isSputtering) {
           return { ...prev, rpm: Math.random() * 400 };
        }

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
             if (controls.accel) newRpm += 150;
             else newRpm -= 80;
          }
        }

        // Deceleration
        newSpeed -= (brakeFactor * 0.5 + friction);
        if (newSpeed < 0) newSpeed = 0;
        
        // RPM Simulation based on speed and gear
        if (prev.isEngineOn) {
          if (!controls.clutch && prev.gear !== Gear.NEUTRAL) {
              newRpm = (newSpeed * 30) + 800; // Idle roughly 800
          } else if (!controls.accel) {
              // Return to idle
              if (newRpm > 850) newRpm -= 50;
              else newRpm = 800 + Math.random() * 20; // Idle shake
          }
        } else {
          newRpm = 0;
        }

        // Cap RPM
        if (newRpm > 6000) newRpm = 6000;
        if (newRpm < 0) newRpm = 0;

        // Odometer
        const distanceTraveled = (newSpeed / 3600) / 10; // km per tick
        
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
      addNotification("WARNING: Press Clutch to Shift!", "red");
      try { grindAudio.current.currentTime = 0; grindAudio.current.play(); } catch(e){}
      return;
    }
    setBusState(prev => ({ ...prev, gear: newGear }));
  };

  const handleToggleEngine = () => {
    if (busState.isEngineOn) {
      // STOP SEQUENCE
      setBusState(prev => ({ ...prev, isEngineOn: false, isSputtering: true }));
      sputterAudio.current.currentTime = 0;
      sputterAudio.current.play();
      addNotification("Engine Stopping...", "red");
      
      // Sputter for 800ms then die
      setTimeout(() => {
         setBusState(prev => ({ ...prev, isSputtering: false, rpm: 0 }));
      }, 800);

    } else {
      // START SEQUENCE
      if (busState.gear !== Gear.NEUTRAL && !controls.clutch) {
         addNotification("Shift to Neutral or Press Clutch to Start!", "yellow");
         return;
      }
      
      setBusState(prev => ({ ...prev, isCranking: true }));
      crankAudio.current.currentTime = 0;
      crankAudio.current.play();
      
      setTimeout(() => {
        // Successful start
        setBusState(prev => ({ ...prev, isCranking: false, isEngineOn: true, rpm: 1500 }));
        addNotification("Engine Started", "green");
        
        // RPM Flare settle
        setTimeout(() => {
           setBusState(prev => ({ ...prev, rpm: 800 }));
        }, 500);

      }, 1500); // 1.5s crank time
    }
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
    
    const isLastStop = currentStopIndex === route.stops.length - 1;
    
    if (busMode === BusMode.OMNI && isLastStop) {
        setConductorMessage(`End of Trip. Last Stop: ${route.stops[currentStopIndex]}`);
        setTimeout(() => {
           setMode(GameMode.SUMMARY);
        }, 4000);
        return;
    }

    // Determine next stop
    let nextIndex = 0;
    if (busMode === BusMode.LOCAL) {
        nextIndex = (currentStopIndex + 1) % route.stops.length; // Loop
    } else {
        nextIndex = currentStopIndex + 1; // Linear
    }

    const nextCity = route.stops[nextIndex];
    const announcement = await generateStopAnnouncement(route.stops[currentStopIndex], nextCity);
    setConductorMessage(announcement);
    
    setTimeout(() => {
       setBusState(prev => ({ ...prev, doorsOpen: false }));
       setCurrentStopIndex(nextIndex);
       setDistToNextStop(Math.random() * 15 + 10); // Longer distance for omni
       
       setTimeout(async () => {
          const evt = await generateRandomEvent();
          addNotification(`EVENT: ${evt.event}`, "blue");
       }, 5000);

    }, 3000);
  };

  const confirmOmniRoute = () => {
    if (omniFrom === omniTo) {
      alert("Start and End locations cannot be the same.");
      return;
    }

    // Generate intermediate stops
    const intermediateStops = [];
    const numStops = 3; // Pick 3 random districts
    for(let i=0; i<numStops; i++) {
        const r = TN_DISTRICTS[Math.floor(Math.random() * TN_DISTRICTS.length)];
        if (r !== omniFrom && r !== omniTo && !intermediateStops.includes(r)) {
            intermediateStops.push(r);
        }
    }

    const fullStops = [omniFrom, ...intermediateStops, omniTo];

    setRoute({
      id: 'omni-custom',
      name: `OMNI: ${omniFrom} to ${omniTo}`,
      start: omniFrom,
      end: omniTo,
      stops: fullStops,
      distanceKm: 350
    });
    setSelectionStep('DRIVER');
  };

  const handleRestart = () => {
    setMode(GameMode.MENU);
    setBusState(prev => ({ ...prev, isEngineOn: false, speed: 0, rpm: 0 }));
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
              onClick={() => { setBusMode(BusMode.OMNI); setMode(GameMode.SELECTION); setSelectionStep('ROUTE'); }}
              className="group p-6 bg-slate-800 hover:bg-yellow-900 border border-slate-600 hover:border-yellow-500 rounded-xl transition-all duration-300 transform hover:-translate-y-1"
            >
              <div className="text-4xl mb-3">🚍</div>
              <h3 className="text-xl font-bold text-white mb-1">Omni Mode</h3>
              <p className="text-xs text-gray-400">Inter-District. Point-to-Point.</p>
            </button>
            <button 
              onClick={() => { setBusMode(BusMode.LOCAL); setMode(GameMode.SELECTION); setSelectionStep('ROUTE'); }}
              className="group p-6 bg-slate-800 hover:bg-green-900 border border-slate-600 hover:border-green-500 rounded-xl transition-all duration-300 transform hover:-translate-y-1"
            >
              <div className="text-4xl mb-3">🚌</div>
              <h3 className="text-xl font-bold text-white mb-1">Local Mode</h3>
              <p className="text-xs text-gray-400">Town Bus. Circular Loop.</p>
            </button>
          </div>
          
          <div className="text-xs text-gray-500 font-mono">Ver 2.1 | Omni Updates | Touch Optimized</div>
        </div>
      </div>
    );
  }

  if (mode === GameMode.SUMMARY) {
     return (
        <div className="w-full h-screen bg-black flex flex-col items-center justify-center text-white">
           <h1 className="text-4xl text-yellow-500 font-bold mb-4">Trip Completed!</h1>
           <div className="bg-gray-800 p-8 rounded-lg text-center">
              <p className="text-xl mb-2">Route: {route.start} ➝ {route.end}</p>
              <p className="text-gray-400 mb-6">Total Distance: {route.distanceKm} km</p>
              <button onClick={handleRestart} className="bg-blue-600 px-6 py-2 rounded font-bold">Main Menu</button>
           </div>
        </div>
     )
  }

  if (mode === GameMode.SELECTION) {
    return (
      <div className="w-full h-screen bg-slate-900 flex flex-col p-4 md:p-8 overflow-y-auto">
        <h2 className="text-3xl text-white font-bold mb-8 flex items-center gap-2">
          <Settings className="text-yellow-500"/> Trip Configuration: {busMode} Mode
        </h2>
        
        <div className="flex gap-4 mb-8">
           <div className={`h-2 flex-1 rounded ${selectionStep === 'ROUTE' || selectionStep === 'DRIVER' || selectionStep === 'READY' ? 'bg-yellow-500' : 'bg-gray-700'}`}></div>
           <div className={`h-2 flex-1 rounded ${selectionStep === 'DRIVER' || selectionStep === 'READY' ? 'bg-yellow-500' : 'bg-gray-700'}`}></div>
           <div className={`h-2 flex-1 rounded ${selectionStep === 'READY' ? 'bg-green-500' : 'bg-gray-700'}`}></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 h-full">
          
          {/* STEP 1: ROUTE */}
          <div className={`bg-gray-800 p-6 rounded-xl border ${selectionStep === 'ROUTE' ? 'border-yellow-500' : 'border-gray-700'} transition-all`}>
             <h3 className="text-xl text-yellow-500 mb-4 font-bold flex items-center gap-2"><MapPin/> Route Selection</h3>
             
             {busMode === BusMode.OMNI ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-400 uppercase">From District</label>
                    <select value={omniFrom} onChange={(e) => setOmniFrom(e.target.value)} className="w-full p-3 bg-gray-900 border border-gray-600 rounded text-white mt-1">
                       {TN_DISTRICTS.map(city => <option key={city} value={city}>{city}</option>)}
                    </select>
                  </div>
                  <div className="flex justify-center text-gray-500"><ArrowRight /></div>
                  <div>
                    <label className="text-xs text-gray-400 uppercase">To District</label>
                    <select value={omniTo} onChange={(e) => setOmniTo(e.target.value)} className="w-full p-3 bg-gray-900 border border-gray-600 rounded text-white mt-1">
                       {TN_DISTRICTS.map(city => <option key={city} value={city}>{city}</option>)}
                    </select>
                  </div>
                  <button onClick={confirmOmniRoute} className="w-full py-2 bg-blue-600 rounded font-bold hover:bg-blue-500 mt-4">Generate Route</button>
                </div>
             ) : (
                <div className="space-y-2">
                   {LOCAL_STOPS.map((stop, i) => (
                      <button key={i} onClick={() => { setRoute({...route, stops: LOCAL_STOPS}); setSelectionStep('DRIVER'); }} className="w-full p-3 bg-gray-700 rounded text-gray-300 flex justify-between items-center hover:bg-gray-600 text-left">
                         <span>Route {i+1}: {stop} Circular</span>
                         <MapPin size={16} />
                      </button>
                   ))}
                </div>
             )}
          </div>

          {/* STEP 2: DRIVER */}
          <div className={`bg-gray-800 p-6 rounded-xl border ${selectionStep === 'DRIVER' ? 'border-yellow-500' : 'border-gray-700'} transition-all opacity-${selectionStep === 'ROUTE' ? '50 pointer-events-none' : '100'}`}>
             <h3 className="text-xl text-yellow-500 mb-4 font-bold flex items-center gap-2"><Users/> Crew</h3>
             <div className="w-32 h-32 rounded-full bg-gray-600 mb-4 mx-auto overflow-hidden border-4 border-yellow-600">
               <img src="https://picsum.photos/seed/driver/200" alt="Driver" className="w-full h-full object-cover" />
             </div>
             <input type="text" defaultValue={busMode === BusMode.OMNI ? "Murugan" : "Raja"} className="bg-gray-900 text-white p-2 rounded mb-2 w-full text-center" />
             <div className="text-xs text-gray-400 mb-6 text-center">{busMode === BusMode.OMNI ? "Heavy Vehicle Driver (Omni)" : "TNSTC Driver"}</div>
             <button onClick={() => setSelectionStep('READY')} className="w-full py-2 bg-blue-600 rounded font-bold hover:bg-blue-500">Confirm Crew</button>
          </div>
          
          {/* STEP 3: START */}
          <div className={`bg-gray-800 p-6 rounded-xl border ${selectionStep === 'READY' ? 'border-green-500' : 'border-gray-700'} transition-all opacity-${selectionStep !== 'READY' ? '50 pointer-events-none' : '100'} flex flex-col justify-between`}>
            <div>
              <h3 className="text-xl text-yellow-500 mb-4 font-bold"><Info/> Manifest</h3>
              <div className="space-y-4 text-sm">
                <div className="flex justify-between text-gray-300 border-b border-gray-700 pb-2">
                  <span>Route</span>
                  <span className="font-mono text-white text-right">{route.start} ➝ {route.end}</span>
                </div>
                <div className="flex justify-between text-gray-300 border-b border-gray-700 pb-2">
                  <span>Stops</span>
                  <span className="font-mono text-white text-right">{route.stops.length}</span>
                </div>
              </div>
            </div>
            
            <button 
               onClick={() => setMode(GameMode.DRIVING)}
               className="w-full py-6 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg text-xl shadow-lg transition-colors flex items-center justify-center gap-2 animate-bounce mt-4"
             >
               <Play size={24} /> START JOURNEY
             </button>
          </div>
        </div>
      </div>
    );
  }

  // --- DRIVING MODE (HUD) ---
  return (
    <div className="w-full h-screen bg-black relative flex flex-col font-sans select-none overflow-hidden">
      
      {/* --- TOP HUD --- */}
      <div className="h-[15%] w-full bg-gradient-to-b from-black/90 to-transparent flex justify-between px-2 md:px-6 py-2 z-20 pointer-events-none absolute top-0 left-0">
        
        {/* Left Top: Nav */}
        <div className="w-1/4 pointer-events-auto">
          <div className="flex items-center gap-2 text-yellow-500 font-bold uppercase tracking-wider text-[10px] md:text-sm mb-1">
            <MapPin size={14} /> GPS
          </div>
          <div className="bg-gray-900/80 p-2 rounded border-l-4 border-yellow-500 backdrop-blur-sm">
             <div className="text-white font-bold text-sm md:text-lg leading-tight truncate">{route.stops[currentStopIndex]}</div>
             <div className="text-gray-400 text-[10px] md:text-xs mt-1 truncate">Next: {route.stops[(currentStopIndex + 1) % route.stops.length]}</div>
             <div className="text-yellow-400 text-[10px] font-mono">{distToNextStop.toFixed(1)} KM</div>
          </div>
        </div>

        {/* Top Middle: TV */}
        <div className="w-1/3 flex flex-col items-center pointer-events-auto mt-2">
          <DriverTV 
            currentStop={route.stops[currentStopIndex]} 
            nextStop={route.stops[(currentStopIndex + 1) % route.stops.length]}
            message={conductorMessage}
            isAlertActive={stopRequestActive || distToNextStop < 0.2} 
          />
        </div>

        {/* Right Top: Speed & Gauges */}
        <div className="w-1/4 flex flex-col items-end pointer-events-auto">
           <div className="flex items-baseline gap-1">
             <span className="text-4xl md:text-6xl font-black text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
               {Math.floor(busState.speed)}
             </span>
             <span className="text-sm md:text-xl text-gray-400 font-bold">KM/H</span>
           </div>
           <div className="flex gap-4 mt-2">
             <div className="text-right">
               <div className="text-[10px] text-gray-500">GEAR</div>
               <div className="text-xl md:text-2xl font-bold text-blue-400 font-mono">
                 {busState.gear === 0 ? 'N' : busState.gear === -1 ? 'R' : busState.gear}
               </div>
             </div>
             <div className="text-right">
               <div className="text-[10px] text-gray-500">RPM</div>
               <div className={`text-xl md:text-2xl font-bold font-mono ${busState.rpm > 2500 ? 'text-red-500' : 'text-white'} ${busState.isCranking || busState.isSputtering ? 'animate-pulse text-yellow-500' : ''}`}>
                 {Math.floor(busState.rpm)}
               </div>
             </div>
           </div>
           {/* Notifications */}
           <div className="mt-4 flex flex-col items-end gap-1 w-full">
             {notifications.map((n, i) => (
               <div key={i} className="bg-black/70 text-white text-[10px] px-2 py-1 rounded border-r-2 border-yellow-500 animate-in slide-in-from-right fade-in duration-300">
                 {n}
               </div>
             ))}
           </div>
        </div>
      </div>

      {/* --- MIDDLE WINDSHIELD (SCENE) --- */}
      <div className="flex-1 w-full relative overflow-hidden bg-gradient-to-b from-blue-400 to-blue-200 z-0">
         {/* Sky */}
         <div className="absolute top-0 w-full h-1/2 bg-gradient-to-b from-indigo-900 to-blue-500"></div>
         {/* Distant Mountains */}
         <div className="absolute top-[40%] w-full h-[15%] bg-indigo-900/50 rounded-[50%] blur-sm"></div>

         {/* Ground */}
         <div className="absolute bottom-0 w-full h-1/2 bg-[#3b6e3b] overflow-hidden">
            {/* Road Perspective */}
            <div 
              className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[200%] h-[100%] bg-gray-600 origin-bottom transform-gpu"
              style={{ 
                transform: 'perspective(200px) rotateX(40deg)',
              }}
            >
               {/* Moving Texture */}
               <div className="w-full h-full"
                 style={{
                   background: `repeating-linear-gradient(to bottom, transparent 0, transparent 40px, rgba(255,255,255,0.1) 40px, rgba(255,255,255,0.1) 80px)`,
                   backgroundPosition: `0 ${busState.odometer * 800}px`
                 }}
               ></div>
               
               {/* Center Line */}
               <div className="absolute left-1/2 -translate-x-1/2 h-full w-[2%] bg-transparent flex flex-col items-center">
                  <div className="w-full h-full" 
                    style={{
                       background: `repeating-linear-gradient(to bottom, #facc15 0, #facc15 20%, transparent 20%, transparent 40%)`,
                       backgroundPosition: `0 ${busState.odometer * 1200}px`
                    }}
                  ></div>
               </div>
               
               {/* Side Lines */}
               <div className="absolute left-[10%] h-full w-[2%] bg-white"></div>
               <div className="absolute right-[10%] h-full w-[2%] bg-white"></div>
            </div>

            {/* Moving Trees (Simple Parallax) */}
            {busState.speed > 5 && (
               <>
                 <div className="absolute bottom-[20%] left-[10%] text-6xl animate-pulse transform -translate-x-1/2 transition-transform duration-75" style={{ transform: `scale(${1 + Math.sin(Date.now()/100)})`}}>🌴</div>
                 <div className="absolute bottom-[20%] right-[10%] text-6xl animate-pulse">🌳</div>
               </>
            )}
         </div>
         
         {/* Dashboard Top Lip */}
         <div className="absolute bottom-0 w-full h-8 bg-black z-10 shadow-[0_-10px_20px_rgba(0,0,0,0.8)]"></div>
         
         {/* Windshield Reflection */}
         <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-blue-500/10 pointer-events-none z-10"></div>
      </div>

      {/* --- BOTTOM CONTROLS --- */}
      <div className="h-[45%] w-full bg-[#1a1a1a] flex relative z-30 shadow-[0_-10px_30px_black] border-t-4 border-gray-800">
        
        {/* Left: Gear Stick */}
        <div className="w-1/4 p-2 md:p-4 flex items-center justify-center border-r border-gray-800 bg-[#111]">
          <GearStick 
            currentGear={busState.gear} 
            onShift={handleShift} 
            clutchPressed={controls.clutch} 
          />
        </div>

        {/* Center: Wheel & Buttons */}
        <div className="flex-1 p-2 flex flex-col justify-between relative bg-gradient-to-b from-[#222] to-[#111]">
           {/* Dashboard Buttons */}
           <div className="flex justify-center gap-4 md:gap-8 mb-2 pt-2">
              <button 
                onClick={handleToggleEngine}
                className={`w-14 h-14 md:w-16 md:h-16 rounded-full border-4 shadow-[0_4px_10px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center font-bold text-[8px] md:text-[10px] uppercase transition-all duration-200 active:scale-95 ${busState.isEngineOn ? 'border-green-600 bg-green-900 text-green-100 shadow-[0_0_15px_rgba(34,197,94,0.4)]' : busState.isCranking || busState.isSputtering ? 'border-yellow-500 bg-yellow-900 text-yellow-100 animate-pulse' : 'border-red-600 bg-red-900 text-red-100'}`}
              >
                <Power size={18} className="mb-1" />
                {busState.isCranking ? '...' : busState.isSputtering ? '~' : busState.isEngineOn ? 'STOP' : 'START'}
              </button>
              
              <button 
                onClick={confirmStop}
                disabled={busState.speed > 5}
                className={`w-16 h-12 md:w-20 md:h-14 rounded border-b-4 font-bold uppercase transition-all flex flex-col items-center justify-center shadow-lg active:scale-95 active:border-b-0 active:translate-y-1 ${busState.doorsOpen ? 'bg-red-600 border-red-800 text-white' : 'bg-gray-600 border-gray-800 text-gray-300'}`}
              >
                <Users size={20} />
                <span className="text-[10px] mt-1">Door</span>
              </button>
              
              <button 
                 onClick={() => setStopRequestActive(true)}
                 className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-yellow-600 border-4 border-yellow-800 flex items-center justify-center hover:bg-yellow-500 text-yellow-100 shadow-lg active:scale-95 active:bg-yellow-400"
              >
                <AlertTriangle size={20} fill="currentColor" />
              </button>
           </div>

           {/* Realistic Steering Wheel (SVG) */}
           <div className="flex justify-center items-end relative -mb-20 md:-mb-24">
              <div 
                className="w-[280px] h-[280px] md:w-[350px] md:h-[350px] rounded-full shadow-[0_20px_40px_rgba(0,0,0,0.8)] flex items-center justify-center relative transform transition-transform duration-75 ease-out cursor-grab active:cursor-grabbing z-40 touch-none"
                style={{ transform: `rotate(${controls.steering}deg)` }}
                onMouseMove={(e) => {
                   if (e.buttons === 1) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = e.clientX - (rect.left + rect.width/2);
                      setControls(p => ({...p, steering: Math.max(-120, Math.min(120, x))}));
                   }
                }}
                onTouchMove={(e) => {
                   const rect = e.currentTarget.getBoundingClientRect();
                   const x = e.touches[0].clientX - (rect.left + rect.width/2);
                   setControls(p => ({...p, steering: Math.max(-120, Math.min(120, x))}));
                }}
                onMouseUp={() => setControls(p => ({...p, steering: 0}))}
                onMouseLeave={() => setControls(p => ({...p, steering: 0}))}
                onTouchEnd={() => setControls(p => ({...p, steering: 0}))}
              >
                 {/* Outer Rim */}
                 <div className="absolute inset-0 rounded-full border-[20px] border-[#1a1a1a] bg-transparent shadow-[inset_0_5px_10px_rgba(255,255,255,0.1),inset_0_-5px_10px_black]"></div>
                 
                 {/* Spokes (T-Shape) */}
                 <div className="absolute top-[50%] w-full h-16 bg-[#1a1a1a] flex justify-between items-center px-4 shadow-[0_5px_10px_black]">
                    <div className="w-full h-2 bg-gray-800 rounded-full"></div>
                 </div>
                 <div className="absolute top-[50%] h-[50%] w-20 bg-[#1a1a1a] shadow-[5px_0_10px_black] flex justify-center">
                    <div className="h-full w-2 bg-gray-800"></div>
                 </div>

                 {/* Center Hub */}
                 <div className="w-24 h-24 md:w-32 md:h-32 bg-[#222] rounded-full z-10 border-8 border-[#111] flex items-center justify-center shadow-[0_5px_15px_black]">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-700 to-yellow-900 border border-yellow-600 flex items-center justify-center shadow-inner">
                       <span className="text-[10px] md:text-xs font-bold text-yellow-500 tracking-widest font-serif drop-shadow-md">LEYLAND</span>
                    </div>
                 </div>
                 
                 {/* Horn Button Hitbox */}
                 <button 
                    className="absolute inset-0 rounded-full z-20" 
                    onMouseDown={() => addNotification("🔊 Horn!", "yellow")}
                    onTouchStart={() => addNotification("🔊 Horn!", "yellow")}
                 ></button>
              </div>
              
              {/* Steering Column */}
              <div className="absolute bottom-0 w-20 h-40 bg-[#0f0f0f] z-30 -mb-4 border-x border-gray-800"></div>
           </div>
        </div>

        {/* Right: Pedals */}
        <div className="w-1/3 border-l border-gray-800 bg-[#111] shadow-[inset_10px_0_20px_rgba(0,0,0,0.5)]">
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

      {/* Restart Button (Hidden unless needed) */}
      <button onClick={handleRestart} className="absolute top-2 right-2 z-50 p-2 bg-gray-800 rounded text-gray-400 hover:text-white">
         <RotateCcw size={16}/>
      </button>

      {/* Orientation Warning */}
      <div className="md:hidden absolute inset-0 bg-black/95 z-[60] flex flex-col items-center justify-center text-center p-8 pointer-events-none opacity-0 landscape:opacity-0 portrait:opacity-100 transition-opacity duration-500">
        <RotateCcw className="text-yellow-500 mb-4 animate-spin-slow" size={48} />
        <h1 className="text-2xl text-yellow-500 font-bold">Rotate Device</h1>
        <p className="text-gray-400 mt-2">Landscape mode required for driving controls.</p>
      </div>
    </div>
  );
};

export default App;
