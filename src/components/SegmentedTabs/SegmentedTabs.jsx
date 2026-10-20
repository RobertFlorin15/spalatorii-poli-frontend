import React from 'react';

const SegmentedTabs = ({ options, value, onChange, label }) => (
  <div
    role="tablist"
    aria-label={label}
    className="theme-fade flex gap-1 p-1 rounded-2xl bg-[color:var(--toggle-bg)]"
  >
    {options.map((opt) => {
      const active = opt.value === value;
      return (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={active}
          onClick={() => onChange(opt.value)}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition ${
            active
              ? 'bg-[color:var(--tab-active-bg)] text-[color:var(--tab-active-text)] shadow-md'
              : 'text-[color:var(--on-bg-muted)] hover:text-[color:var(--on-bg)]'
          }`}
        >
          {opt.label}
          {opt.badge > 0 && (
            <span
              className={`min-w-[20px] h-5 px-1.5 rounded-full text-xs leading-5 ${
                active
                  ? 'bg-[color:var(--tab-active-text)] text-[color:var(--tab-active-bg)]'
                  : 'bg-[color:var(--toggle-hover)] text-[color:var(--on-bg)]'
              }`}
            >
              {opt.badge}
            </span>
          )}
        </button>
      );
    })}
  </div>
);

export default SegmentedTabs;
