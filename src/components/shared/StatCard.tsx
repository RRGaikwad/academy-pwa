import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  subtitle?: string;
  trend?: { value: number; label: string };
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title, value, icon, color, bgColor, subtitle, trend, onClick
}) => (
  <div
    onClick={onClick}
    className={`bg-white rounded-2xl p-4 shadow-sm border border-slate-100 ${onClick ? 'cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5' : ''}`}
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">{title}</p>
        <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
        {subtitle && <p className="text-slate-400 text-xs mt-0.5">{subtitle}</p>}
        {trend && (
          <p className={`text-xs font-medium mt-1 ${trend.value >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
          </p>
        )}
      </div>
      <div className={`${bgColor} p-2.5 rounded-xl`}>
        {icon}
      </div>
    </div>
  </div>
);
