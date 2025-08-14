import React from 'react';
import { Theme } from '../../types';

interface Props {
  theme: Theme;
  predefined: Theme[];
  onApply: (theme: Theme) => void;
  onClose: () => void;
}

const SettingsModal: React.FC<Props> = ({ theme, predefined, onApply, onClose }) => {
  const [selected, setSelected] = React.useState<Theme>(theme);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass p-6 rounded-2xl w-full max-w-xl">
        <h2 className="text-xl font-semibold text-white mb-4">Settings</h2>
        <div>
          <h3 className="text-sm text-gray-400 mb-2">Theme</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {predefined.map((t) => (
              <button
                key={t.name}
                onClick={() => setSelected(t)}
                className={`glass p-3 rounded-lg text-left border ${selected.name === t.name ? 'border-white/40' : 'border-white/10'}`}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 rounded" style={{ backgroundColor: t.colors.primary }} />
                  <div>
                    <p className="text-white text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-gray-400">{t.domain}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end space-x-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
          <button
            onClick={() => onApply(selected)}
            className="px-4 py-2 rounded-lg text-white"
            style={{ backgroundColor: selected.colors.primary }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
