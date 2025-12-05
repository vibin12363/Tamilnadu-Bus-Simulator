import React from 'react';

interface PedalsProps {
  onClutchChange: (pressed: boolean) => void;
  onBrakeChange: (pressed: boolean) => void;
  onAccelChange: (pressed: boolean) => void;
  isClutchPressed: boolean;
  isBrakePressed: boolean;
  isAccelPressed: boolean;
}

export const Pedals: React.FC<PedalsProps> = ({
  onClutchChange,
  onBrakeChange,
  onAccelChange,
  isClutchPressed,
  isBrakePressed,
  isAccelPressed
}) => {
  return (
    <div className="flex justify-between items-end gap-4 w-full h-full px-4 pb-4">
      {/* Clutch */}
      <div 
        className={`relative w-24 h-40 bg-gray-800 rounded-t-lg border-2 ${isClutchPressed ? 'border-blue-500 bg-gray-700 transform scale-y-95 translate-y-2' : 'border-gray-600'} transition-all duration-100 flex flex-col items-center justify-end pb-4 cursor-pointer select-none`}
        onMouseDown={() => onClutchChange(true)}
        onMouseUp={() => onClutchChange(false)}
        onTouchStart={() => onClutchChange(true)}
        onTouchEnd={() => onClutchChange(false)}
        onMouseLeave={() => onClutchChange(false)}
      >
        <div className="w-20 h-28 bg-black opacity-50 patterned-metal rounded-sm"></div>
        <span className="font-bold text-gray-400 mt-2">CLUTCH</span>
      </div>

      {/* Brake */}
      <div 
        className={`relative w-20 h-32 bg-gray-800 rounded-t-lg border-2 ${isBrakePressed ? 'border-red-500 bg-gray-700 transform scale-y-95 translate-y-2' : 'border-gray-600'} transition-all duration-100 flex flex-col items-center justify-end pb-4 cursor-pointer select-none`}
        onMouseDown={() => onBrakeChange(true)}
        onMouseUp={() => onBrakeChange(false)}
        onTouchStart={() => onBrakeChange(true)}
        onTouchEnd={() => onBrakeChange(false)}
        onMouseLeave={() => onBrakeChange(false)}
      >
        <div className="w-16 h-20 bg-black opacity-50 patterned-metal rounded-sm"></div>
        <span className="font-bold text-gray-400 mt-2">BRAKE</span>
      </div>

      {/* Accelerator */}
      <div 
        className={`relative w-16 h-48 bg-gray-800 rounded-t-lg border-2 ${isAccelPressed ? 'border-green-500 bg-gray-700 transform scale-y-95 translate-y-2' : 'border-gray-600'} transition-all duration-100 flex flex-col items-center justify-end pb-4 cursor-pointer select-none`}
        onMouseDown={() => onAccelChange(true)}
        onMouseUp={() => onAccelChange(false)}
        onTouchStart={() => onAccelChange(true)}
        onTouchEnd={() => onAccelChange(false)}
        onMouseLeave={() => onAccelChange(false)}
      >
        <div className="w-12 h-36 bg-black opacity-50 patterned-metal rounded-sm"></div>
        <span className="font-bold text-gray-400 mt-2">ACCEL</span>
      </div>
    </div>
  );
};