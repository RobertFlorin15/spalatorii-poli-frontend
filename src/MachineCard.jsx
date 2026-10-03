import React from 'react';

const MachineCard = ({ machine }) => {
  const isAvailable = machine.status === 'available';
  const isWasher = machine.type === 'washer';

  return (
    <div className={`p-5 border rounded-xl shadow-sm transition-all ${
      isAvailable ? 'border-green-500 bg-white' : 'border-orange-500 bg-orange-50'
    }`}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-lg text-gray-800">{machine.name}</h3>
        <span className="text-2xl" title={isWasher ? 'Mașină de spălat' : 'Uscător'}>
          {isWasher ? '🌊' : '💨'}
        </span>
      </div>

      <div className="text-sm mb-1 text-gray-700">
        Status: <span className={`font-semibold ${isAvailable ? 'text-green-600' : 'text-orange-600'}`}>
          {isAvailable ? 'Disponibil' : 'În utilizare'}
        </span>
      </div>

      {!isAvailable && (
        <div className="text-sm text-gray-600">
          Timp estimat rămas: <span className="font-medium">{machine.timeRemaining} min</span>
        </div>
      )}

      <button
        disabled={!isAvailable}
        className={`mt-4 w-full py-2 rounded-lg font-medium transition-colors ${
          isAvailable
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
      >
        {isAvailable ? 'Rezervă aparatul' : 'Indisponibil'}
      </button>
    </div>
  );
};

export default MachineCard;