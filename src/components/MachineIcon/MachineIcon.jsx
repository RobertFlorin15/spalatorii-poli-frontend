import React from 'react';

/**
 * Iconițe SVG pentru mașini.
 * Folosesc culoarea textului din jur (currentColor), deci se adaptează temei.
 *
 * type: 'washer' | 'dryer' | orice altceva (iconiță generică)
 */
const MachineIcon = ({ type, size = 24, className = '', style }) => {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className,
    style,
    'aria-hidden': true,
    focusable: 'false',
  };

  if (type === 'washer' || type === 'dryer') {
    return (
      <svg {...common}>
        {/* corpul aparatului */}
        <rect x="4" y="2.5" width="16" height="19" rx="2.5" />
        {/* panoul de sus */}
        <path d="M4 7.5h16" />
        <circle cx="7.5" cy="5" r="0.6" fill="currentColor" stroke="none" />
        <circle cx="10.5" cy="5" r="0.6" fill="currentColor" stroke="none" />
        {/* tamburul */}
        <circle cx="12" cy="14.5" r="4.6" />
        {type === 'washer' ? (
          /* apă: val în tambur */
          <path d="M9.4 14.6c.8-.9 1.7-.9 2.6 0s1.8.9 2.6 0" />
        ) : (
          /* aer cald: două linii ondulate în tambur */
          <>
            <path d="M10.5 12.3c.6.6-.6 1.2 0 1.8s-.6 1.2 0 1.8" />
            <path d="M13.5 12.3c.6.6-.6 1.2 0 1.8s-.6 1.2 0 1.8" />
          </>
        )}
      </svg>
    );
  }

  // generică / mașină ștearsă
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.6a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1.1.8-1.1 1.5" />
      <path d="M12 17h.01" />
    </svg>
  );
};

export default MachineIcon;
