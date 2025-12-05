import React from 'react';

interface DriverTVProps {
  currentStop: string;
  nextStop: string;
  message: string;
  isAlertActive: boolean;
}

export const DriverTV: React.FC<DriverTVProps> = ({ currentStop, nextStop, message, isAlertActive }) => {
  return (
    <div className="bg-black border-4 border-gray-800 rounded-lg w-full max-w-sm h-32 relative overflow-hidden shadow-black shadow-lg">
      {/* Screen Glare */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none z-10"></div>
      
      <div className={`h-full w-full flex flex-col items-center justify-center p-2 text-center transition-colors duration-500 ${isAlertActive ? 'bg-red-900/50' : 'bg-gray-900'}`}>
        <h3 className="text-yellow-500 text-xs font-mono mb-1 uppercase tracking-widest">Digital Display System</h3>
        
        {isAlertActive ? (
          <div className="animate-pulse">
            <h1 className="text-red-500 font-bold text-2xl font-serif">நிறுத்தம் (STOP)</h1>
            <p className="text-white text-lg font-bold">{nextStop}</p>
          </div>
        ) : (
          <div>
            <div className="text-cyan-400 text-sm mb-1">{currentStop} <span className="text-gray-500">➜</span></div>
            <div className="text-white font-bold text-xl">{nextStop}</div>
            <div className="text-gray-400 text-xs mt-2 italic truncate max-w-[250px]">{message || "Playing: Super Singer Junior..."}</div>
          </div>
        )}
      </div>

      {/* Power LED */}
      <div className="absolute bottom-1 right-2 w-1 h-1 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,1)]"></div>
    </div>
  );
};