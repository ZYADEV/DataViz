import React from 'react';

interface Props {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'left' | 'right';
  onOpenChange?: (open: boolean) => void;
}

const Popover: React.FC<Props> = ({ trigger, children, align = 'left', onOpenChange }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) {
        setOpen(false);
        onOpenChange?.(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onOpenChange]);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        className="bg-white/10 hover:bg-white/15 text-white px-3 py-2 rounded-md border border-white/10"
        onClick={() => {
          const next = !open;
          setOpen(next);
          onOpenChange?.(next);
        }}
      >
        {trigger}
      </button>
      {open && (
        <div
          className={`absolute mt-2 z-50 min-w-[16rem] rounded-lg border border-white/10 glass p-3 shadow-xl ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {children}
        </div>
      )}
    </div>
  );
};

export default Popover;


