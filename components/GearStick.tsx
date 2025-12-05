import React from 'react';
import { Gear } from '../types';

interface GearStickProps {
  currentGear: Gear;
  onShift: (gear: Gear) => void;
  clutchPressed: boolean;
}

export const GearStick: React.FC<GearStickProps> = ({ currentGear, onShift, clutchPressed }) => {
  const gears = [
    { label: '1', val: Gear.FIRST, col: 1, row: 1 },
    { label: '3', val: Gear.THIRD, col: 2, row: 1 },
    { label: '5', val: Gear.FIFTH, col: 3, row: 1 },
    { label: 'N', val: Gear.NEUTRAL, col: 2, row: 2, wide: true },
    { label: '2', val: Gear.SECOND, col: 1, row: 3 },
    { label: '4', val: Gear.FOURTH, col: 2, row: 3 },
    { label: 'R', val: Gear.REVERSE, col: 3, row: 3 },
  ];

  return (
    <div className="bg-gray-900 border border-gray-700 p-4 rounded-xl shadow-2xl w-48 h-56 relative no-select">
      <div className="absolute top-2 left-2 text-xs text-gray-500">GEARBOX</div>
      <div className="grid grid-cols-3 grid-rows-3 gap-2 h-full mt-2">
        {gears.map((g) => (
          <button
            key={g.label}
            className={`
              flex items-center justify-center font-bold text-xl rounded shadow-inner
              transition-all duration-100
              ${g.val === currentGear 
                ? 'bg-blue-600 text-white border-2 border-blue-300 scale-105' 
                : 'bg-gray-800 text-gray-400 border border-gray-600 hover:bg-gray-700'
              }
              ${g.wide ? 'col-span-1 border-dashed' : ''}
            `}
            style={{ gridColumn: g.col, gridRow: g.row }}
            onClick={() => onShift(g.val)}
          >
            {g.label}
          </button>
        ))}
      </div>
      {!clutchPressed && (
        <div className="absolute inset-0 bg-red-900/10 pointer-events-none rounded-xl flex items-center justify-center">
          {/* Visual tint if clutch not pressed (logic handled in parent) */}
        </div>
      )}
    </div>
  );
};