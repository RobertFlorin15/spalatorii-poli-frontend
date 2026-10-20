import './SegmentedTabs.scss';

const SegmentedTabs = ({ options, value, onChange, label }) => (
  <div role="tablist" aria-label={label} className="segmented-tabs">
    {options.map((opt) => {
      const active = opt.value === value;
      return (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={active}
          onClick={() => onChange(opt.value)}
          className={`segmented-tabs__tab ${active ? 'segmented-tabs__tab--active' : ''}`}
        >
          {opt.label}
          {opt.badge > 0 && (
            <span
              className={`segmented-tabs__badge ${active ? 'segmented-tabs__badge--active' : ''}`}
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
