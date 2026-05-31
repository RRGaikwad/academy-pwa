import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  color?: 'green' | 'red' | 'blue' | 'orange' | 'purple' | 'gray' | 'yellow' | 'indigo' | 'cyan';
  size?: 'sm' | 'md';
}

const colorMap = {
  green: 'bg-green-100 text-green-700 border-green-200',
  red: 'bg-red-100 text-red-700 border-red-200',
  blue: 'bg-blue-100 text-blue-700 border-blue-200',
  orange: 'bg-orange-100 text-orange-700 border-orange-200',
  purple: 'bg-purple-100 text-purple-700 border-purple-200',
  gray: 'bg-slate-100 text-slate-600 border-slate-200',
  yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  indigo: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  cyan: 'bg-cyan-100 text-cyan-700 border-cyan-200',
};

export const Badge: React.FC<BadgeProps> = ({ children, color = 'gray', size = 'sm' }) => (
  <span className={`inline-flex items-center border font-medium rounded-full ${colorMap[color]} ${size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'}`}>
    {children}
  </span>
);
