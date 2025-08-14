import React from 'react';
import { TrendingUp, TrendingDown, Activity, Target } from 'lucide-react';
import { Theme } from '../../types';

interface KPICardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: 'increase' | 'decrease' | 'neutral';
  };
  icon?: 'trending-up' | 'trending-down' | 'activity' | 'target';
  theme: Theme;
  size?: 'small' | 'medium' | 'large';
}

const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  change,
  icon = 'activity',
  theme,
  size = 'medium'
}) => {
  const sizeClasses = {
    small: 'p-4',
    medium: 'p-6',
    large: 'p-8'
  };

  const iconSizes = {
    small: 'w-4 h-4',
    medium: 'w-5 h-5',
    large: 'w-6 h-6'
  };

  const getIcon = () => {
    const iconClass = iconSizes[size];
    switch (icon) {
      case 'trending-up':
        return <TrendingUp className={iconClass} />;
      case 'trending-down':
        return <TrendingDown className={iconClass} />;
      case 'target':
        return <Target className={iconClass} />;
      default:
        return <Activity className={iconClass} />;
    }
  };

  const getChangeColor = () => {
    if (!change) return '';
    switch (change.type) {
      case 'increase':
        return 'text-green-400';
      case 'decrease':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const formatValue = (val: string | number) => {
    if (typeof val === 'number') {
      if (val >= 1000000) {
        return (val / 1000000).toFixed(1) + 'M';
      } else if (val >= 1000) {
        return (val / 1000).toFixed(1) + 'K';
      }
      return val.toLocaleString();
    }
    return val;
  };

  return (
    <div className={`glass glass-hover animate-fade-in ${sizeClasses[size]} min-w-0`} style={{ overflow: 'hidden' }}>
      <div className="flex items-center justify-between overflow-hidden">
        <div className="flex items-center space-x-3">
          <div
            className="p-2 rounded-lg"
            style={{ backgroundColor: `${theme.colors.primary}20` }}
          >
            <div style={{ color: theme.colors.primary }}>
              {getIcon()}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-gray-300 leading-snug break-words">
              {title}
            </p>
            <p className="text-2xl font-bold text-white truncate">
              {formatValue(value)}
            </p>
          </div>
        </div>

        {change && (
          <div className={`text-sm font-medium ${getChangeColor()}`}>
            <div className="flex items-center space-x-1">
              {change.type === 'increase' ? (
                <TrendingUp className="w-3 h-3" />
              ) : change.type === 'decrease' ? (
                <TrendingDown className="w-3 h-3" />
              ) : null}
              <span>{Math.abs(change.value)}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default KPICard;
