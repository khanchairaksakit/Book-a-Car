import React from 'react';
import { FuelLevel } from '../types';
import { Fuel } from 'lucide-react';

interface FuelGaugeGraphicProps {
  value: FuelLevel;
  onChange: (val: FuelLevel) => void;
  accentColor?: 'amber' | 'emerald';
}

const FUEL_OPTIONS: FuelLevel[] = ['เต็มถัง', '3/4', '1/2', '1/4'];

// Convert polar angle (where 0 deg is straight up 12 o'clock, -90 is left 9 o'clock, +90 is right 3 o'clock)
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

export default function FuelGaugeGraphic({
  value,
  onChange,
  accentColor = 'amber',
}: FuelGaugeGraphicProps) {
  // Angle mapping: E = -90°, 1/4 = -45°, 1/2 = 0°, 3/4 = +45°, F (เต็มถัง) = +90°
  const getNeedleAngle = (level: FuelLevel): number => {
    switch (level) {
      case '1/4':
        return -45;
      case '1/2':
        return 0;
      case '3/4':
        return 45;
      case 'เต็มถัง':
      default:
        return 90;
    }
  };

  const needleAngle = getNeedleAngle(value);
  const cx = 140;
  const cy = 122;
  const radius = 84;

  const majorTicks: Array<{
    angle: number;
    label: string;
    subLabel?: string;
    fuelValue?: FuelLevel;
    color: string;
  }> = [
    { angle: -90, label: 'E', subLabel: 'ว่าง', color: '#EF4444' },
    { angle: -45, label: '1/4', fuelValue: '1/4', color: '#F59E0B' },
    { angle: 0, label: '1/2', fuelValue: '1/2', color: '#FBBF24' },
    { angle: 45, label: '3/4', fuelValue: '3/4', color: '#34D399' },
    { angle: 90, label: 'F', subLabel: 'เต็มถัง', fuelValue: 'เต็มถัง', color: '#10B981' },
  ];

  const minorAngles = [-75, -60, -30, -15, 15, 30, 60, 75];

  const levelBadgeColor =
    value === 'เต็มถัง'
      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
      : value === '3/4'
      ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
      : value === '1/2'
      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
      : 'bg-orange-500/20 text-orange-300 border-orange-500/40';

  return (
    <div className="space-y-3">
      {/* Automotive Fuel Gauge Graphic Card */}
      <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 rounded-2xl p-3.5 border border-slate-700 shadow-inner relative overflow-hidden">
        <div className="flex items-center justify-between text-[11px] text-slate-300 px-1 mb-1">
          <div className="flex items-center gap-1.5 font-semibold">
            <Fuel className="w-3.5 h-3.5 text-amber-400" />
            <span>หน้าปัดระดับน้ำมัน (FUEL GAUGE)</span>
          </div>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${levelBadgeColor}`}
          >
            ระดับที่เลือก: {value === 'เต็มถัง' ? 'เต็มถัง (F)' : `${value} ถัง`}
          </span>
        </div>

        <div className="flex flex-col items-center justify-center">
          <svg
            viewBox="0 0 280 150"
            className="w-full max-w-[280px] h-auto select-none overflow-visible"
          >
            <defs>
              <linearGradient id="needleGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#FF4D4D" />
                <stop offset="65%" stopColor="#F97316" />
                <stop offset="100%" stopColor="#DC2626" />
              </linearGradient>
              <filter id="needleShadow" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#EF4444" floodOpacity="0.55" />
              </filter>
            </defs>

            {/* Outer subtle bezel track */}
            <path
              d={describeArc(cx, cy, radius + 10, -90, 90)}
              fill="none"
              stroke="#334155"
              strokeWidth="2"
              strokeDasharray="3 3"
            />

            {/* Background Base Track (-90 to +90) */}
            <path
              d={describeArc(cx, cy, radius, -90, 90)}
              fill="none"
              stroke="#1E293B"
              strokeWidth="12"
              strokeLinecap="round"
            />

            {/* Colored Gauge Zones */}
            {/* E to 1/4: Red/Orange Warning Zone */}
            <path
              d={describeArc(cx, cy, radius, -90, -45)}
              fill="none"
              stroke="#EF4444"
              strokeWidth="10"
              strokeLinecap="butt"
              opacity={0.85}
            />
            {/* 1/4 to 1/2: Amber Zone */}
            <path
              d={describeArc(cx, cy, radius, -43, -1)}
              fill="none"
              stroke="#F59E0B"
              strokeWidth="10"
              strokeLinecap="butt"
              opacity={0.85}
            />
            {/* 1/2 to 3/4: Lime/Teal Zone */}
            <path
              d={describeArc(cx, cy, radius, 1, 43)}
              fill="none"
              stroke="#10B981"
              strokeWidth="10"
              strokeLinecap="butt"
              opacity={0.75}
            />
            {/* 3/4 to F: Full Emerald Zone */}
            <path
              d={describeArc(cx, cy, radius, 45, 90)}
              fill="none"
              stroke="#059669"
              strokeWidth="10"
              strokeLinecap="butt"
              opacity={0.95}
            />

            {/* Active Fill Highlight Arc from -90 up to current needleAngle */}
            <path
              d={describeArc(cx, cy, radius - 10, -90, needleAngle)}
              fill="none"
              stroke={
                value === 'เต็มถัง' || value === '3/4'
                  ? '#34D399'
                  : value === '1/2'
                  ? '#FBBF24'
                  : '#FB923C'
              }
              strokeWidth="3.5"
              strokeLinecap="round"
              style={{
                transition: 'all 0.45s ease-out',
              }}
            />

            {/* Minor Ticks */}
            {minorAngles.map((ang) => {
              const inner = polarToCartesian(cx, cy, radius - 7, ang);
              const outer = polarToCartesian(cx, cy, radius + 5, ang);
              return (
                <line
                  key={ang}
                  x1={inner.x}
                  y1={inner.y}
                  x2={outer.x}
                  y2={outer.y}
                  stroke="#94A3B8"
                  strokeWidth="1.5"
                  opacity="0.6"
                />
              );
            })}

            {/* Major Ticks & Interactive Labels */}
            {majorTicks.map((tick) => {
              const inner = polarToCartesian(cx, cy, radius - 10, tick.angle);
              const outer = polarToCartesian(cx, cy, radius + 7, tick.angle);
              const labelPos = polarToCartesian(cx, cy, radius + 24, tick.angle);
              const isSelected = tick.fuelValue === value;

              return (
                <g
                  key={tick.angle}
                  onClick={() => {
                    if (tick.fuelValue) onChange(tick.fuelValue);
                  }}
                  className={tick.fuelValue ? 'cursor-pointer' : ''}
                >
                  <line
                    x1={inner.x}
                    y1={inner.y}
                    x2={outer.x}
                    y2={outer.y}
                    stroke={isSelected ? '#FFFFFF' : '#E2E8F0'}
                    strokeWidth={isSelected ? '3.5' : '2.5'}
                    strokeLinecap="round"
                  />
                  {isSelected && (
                    <circle
                      cx={labelPos.x}
                      cy={labelPos.y}
                      r="14"
                      fill={tick.color}
                      opacity="0.25"
                    />
                  )}
                  <text
                    x={labelPos.x}
                    y={labelPos.y + 4}
                    textAnchor="middle"
                    fill={isSelected ? '#FFFFFF' : tick.color}
                    fontSize={tick.label === 'E' || tick.label === 'F' ? '14' : '12'}
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    {tick.label}
                  </text>
                </g>
              );
            })}

            {/* Fuel Icon inside dial */}
            <text
              x={cx}
              y={cy - 26}
              textAnchor="middle"
              fill="#94A3B8"
              fontSize="11"
              fontWeight="bold"
            >
              ⛽ FUEL
            </text>

            {/* Animated Needle Group rotating around (cx, cy) */}
            <g
              style={{
                transform: `rotate(${needleAngle}deg)`,
                transformOrigin: `${cx}px ${cy}px`,
                transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
              filter="url(#needleShadow)"
            >
              {/* Needle pointer triangle pointing straight up at 0 deg */}
              <polygon
                points={`${cx},${cy - (radius - 6)} ${cx - 4.5},${cy} ${cx + 4.5},${cy}`}
                fill="url(#needleGrad)"
              />
              {/* Needle tail counterweight */}
              <polygon
                points={`${cx - 4.5},${cy} ${cx + 4.5},${cy} ${cx + 2.5},${cy + 14} ${cx - 2.5},${cy + 14}`}
                fill="#DC2626"
              />
            </g>

            {/* Center Pivot Cap */}
            <circle cx={cx} cy={cy} r="10" fill="#334155" stroke="#94A3B8" strokeWidth="2" />
            <circle cx={cx} cy={cy} r="4.5" fill="#F8FAFC" />
          </svg>
        </div>

        <p className="text-[10px] text-slate-400 text-center -mt-1">
          คลิกปุ่มตัวเลือกด้านล่าง หรือแตะที่ตัวเลขบนหน้าปัดเพื่อให้เข็มขยับตามระดับน้ำมันจริง
        </p>
      </div>

      {/* Fuel Level Selector Buttons */}
      <div className="grid grid-cols-4 gap-2">
        {FUEL_OPTIONS.map((f) => {
          const isSel = value === f;
          const activeClass =
            accentColor === 'emerald'
              ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs ring-2 ring-emerald-400/30'
              : 'bg-amber-500 text-white border-amber-600 shadow-xs ring-2 ring-amber-300/40';
          return (
            <button
              key={f}
              type="button"
              onClick={() => onChange(f)}
              className={`py-2.5 px-1 text-xs font-bold rounded-xl border text-center transition-all cursor-pointer ${
                isSel
                  ? activeClass
                  : 'bg-slate-50 hover:bg-slate-100 text-gray-700 border-gray-200'
              }`}
            >
              {f}
            </button>
          );
        })}
      </div>
    </div>
  );
}
