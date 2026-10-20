import { BiSolidWasher, BiSolidDryer, BiHelpCircle } from 'react-icons/bi';

/**
 * Iconițe pentru mașini folosind react-icons.
 * Folosesc culoarea textului din jur (currentColor), deci se adaptează temei.
 *
 * type: 'washer' | 'dryer' | orice altceva (iconiță generică)
 */
const MachineIcon = ({ type, size = 24, className = '', style }) => {
  const commonProps = {
    size,
    className,
    style,
    'aria-hidden': true,
    focusable: 'false',
  };

  if (type === 'washer') {
    return <BiSolidWasher {...commonProps} />;
  }

  if (type === 'dryer') {
    return <BiSolidDryer {...commonProps} />;
  }

  // generică / mașină ștearsă
  return <BiHelpCircle {...commonProps} />;
};

export default MachineIcon;
