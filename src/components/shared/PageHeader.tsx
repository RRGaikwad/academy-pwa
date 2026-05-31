import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: {
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    color?: 'blue' | 'green' | 'orange' | 'purple' | 'indigo';
  };
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, action }) => {
  const colorClasses = {
    blue: 'bg-blue-600 hover:bg-blue-700 shadow-blue-200',
    green: 'bg-green-600 hover:bg-green-700 shadow-green-200',
    orange: 'bg-orange-500 hover:bg-orange-600 shadow-orange-200',
    purple: 'bg-purple-600 hover:bg-purple-700 shadow-purple-200',
    indigo: 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200',
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">{title}</h2>
        {subtitle && <p className="text-slate-500 text-sm mt-1 font-medium">{subtitle}</p>}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className={`flex items-center justify-center gap-2 ${colorClasses[action.color || 'blue']} text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg active:scale-95`}
        >
          {action.icon}
          {action.label}
        </button>
      )}
    </div>
  );
};
