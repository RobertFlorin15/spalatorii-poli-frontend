import { useState, useEffect, useRef, useCallback } from 'react';
import { machinesApi } from '../../api';
import { logError } from '../../utils/logger';
import MachineCard from '../../components/MachineCard/MachineCard';
import './MachineList.scss';

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
    if (distance === 0) return 'machine-list__dot--active';
    if (distance === 1) return 'machine-list__dot--near';
    if (distance === 2) return 'machine-list__dot--mid';
    return 'machine-list__dot--far';
  };

  return (
    <>
      <div
        ref={containerRef}
        onScroll={updateActiveIndex}
        className="machine-list__slider"
      >
        {items.map((machine) => (
          <div key={machine.id} className="machine-list__slide">
            <MachineCard machine={machine} onSelect={() => onSelectMachine(machine)} />
          </div>
        ))}
      </div>

      {/* Indicator cercuri — apare doar dacă sunt cel puțin 2 elemente */}
      {items.length > 1 && (
        <div
          className="machine-list__dots"
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
              className={`machine-list__dot ${dotClass(i)}`}
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
    // CE SE CERE DE LA BACKEND:
    // - Lista mașinilor disponibile în timp real (colecția 'machines')
    //   cu proprietățile: id, name, type ('washer' | 'dryer') și enabled (boolean)
    // CE SE TRIMITE CĂTRE BACKEND:
    // - Subscripția onSnapshot pe colecția 'machines'
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

  if (loading) return <div className="machine-list__loading">se incarca.</div>;

  const washers = machines.filter((m) => m.type === 'washer');
  const dryers = machines.filter((m) => m.type === 'dryer');

  return (
    <div className="machine-list">
      {/* Secțiunea Mașini */}
      <section>
        <h2 className="machine-list__heading">Mașini de spălat</h2>
        {washers.length > 0 ? (
          <MachineSlider items={washers} onSelectMachine={onSelectMachine} />
        ) : (
          <p className="machine-list__empty">nu exista</p>
        )}
      </section>

      {/* Secțiunea Uscătoare */}
      <section>
        <h2 className="machine-list__heading">Uscătoare</h2>
        {dryers.length > 0 ? (
          <MachineSlider items={dryers} onSelectMachine={onSelectMachine} />
        ) : (
          <p className="machine-list__empty">nu exista</p>
        )}
      </section>
    </div>
  );
};

export default MachineList;
