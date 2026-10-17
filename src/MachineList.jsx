import React, { useState, useEffect, useRef, useCallback } from 'react';
import { machinesApi } from './data';
import { logError } from './utils/logger';
import MachineCard from './MachineCard';

/**
 * Slider orizontal cu indicator de poziție (cercuri, ca la Instagram).
 * Cercul activ e mai mare și mai opac, cele vecine sunt puțin mai mici,
 * iar cele îndepărtate se micșorează — arată unde ești față de restul.
 */
const MachineSlider = ({ items, onSelectMachine }) => {
  const containerRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Calculează care slide e cel mai aproape de centrul containerului
  const updateActiveIndex = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const center = container.scrollLeft + container.clientWidth / 2;
    let closest = 0;
    let minDistance = Infinity;

    Array.from(container.children).forEach((child, i) => {
      const childCenter = child.offsetLeft + child.offsetWidth / 2;
      const distance = Math.abs(center - childCenter);
      if (distance < minDistance) {
        minDistance = distance;
        closest = i;
      }
    });

    setActiveIndex(closest);
  }, []);

  useEffect(() => {
    updateActiveIndex();
    window.addEventListener('resize', updateActiveIndex);
    return () => window.removeEventListener('resize', updateActiveIndex);
  }, [items.length, updateActiveIndex]);

  // Click pe cerc -> derulează la slide-ul respectiv
  const goTo = (index) => {
    const container = containerRef.current;
    const child = container?.children[index];
    if (!child) return;
    container.scrollTo({
      left: child.offsetLeft - (container.clientWidth - child.offsetWidth) / 2,
      behavior: 'smooth',
    });
  };

  // Stil pentru fiecare cerc, în funcție de distanța față de cel activ
  const dotClass = (i) => {
    const distance = Math.abs(i - activeIndex);
    if (distance === 0) return 'w-2.5 h-2.5 bg-white';
    if (distance === 1) return 'w-2 h-2 bg-white/60';
    if (distance === 2) return 'w-1.5 h-1.5 bg-white/40';
    return 'w-1 h-1 bg-white/25';
  };

  return (
    <>
      <div
        ref={containerRef}
        onScroll={updateActiveIndex}
        className="flex overflow-x-auto gap-4 pb-4 snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] lg:grid lg:grid-cols-3 lg:overflow-visible"
      >
        {items.map((machine) => (
          <div key={machine.id} className="min-w-[100%] sm:min-w-[280px] lg:min-w-0 snap-center shrink-0">
            <MachineCard machine={machine} onSelect={() => onSelectMachine(machine)} />
          </div>
        ))}
      </div>

      {/* Indicator cercuri — apare doar dacă sunt cel puțin 2 elemente */}
      {items.length > 1 && (
        <div
          className="flex lg:hidden justify-center items-center gap-1.5 mt-1"
          role="tablist"
          aria-label="Poziția în listă"
        >
          {items.map((machine, i) => (
            <button
              key={machine.id}
              type="button"
              role="tab"
              aria-selected={i === activeIndex}
              aria-label={`Mergi la elementul ${i + 1} din ${items.length}`}
              onClick={() => goTo(i)}
              className={`rounded-full transition-all duration-300 ease-out ${dotClass(i)}`}
            />
          ))}
        </div>
      )}
    </>
  );
};

const MachineList = ({ onSelectMachine }) => {
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = machinesApi.subscribe(
      (list) => {
        setMachines(list);
        setLoading(false);
      },
      (error) => {
        logError('machines', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  if (loading) return <div className="text-center text-white mt-10 font-bold">se incarca.</div>;

  const washers = machines.filter((m) => m.type === 'washer');
  const dryers = machines.filter((m) => m.type === 'dryer');

  return (
    <div className="w-full flex flex-col gap-8">
      {/* Secțiunea Mașini */}
      <section>
        <h2 className="text-xl font-bold mb-4 text-white drop-shadow-sm px-2">Mașini de spălat</h2>
        {washers.length > 0 ? (
          <MachineSlider items={washers} onSelectMachine={onSelectMachine} />
        ) : (
          <p className="text-blue-100 px-2">nu exista</p>
        )}
      </section>

      {/* Secțiunea Uscătoare */}
      <section>
        <h2 className="text-xl font-bold mb-4 text-white drop-shadow-sm px-2">Uscătoare</h2>
        {dryers.length > 0 ? (
          <MachineSlider items={dryers} onSelectMachine={onSelectMachine} />
        ) : (
          <p className="text-blue-100 px-2">nu exista</p>
        )}
      </section>
    </div>
  );
};

export default MachineList;