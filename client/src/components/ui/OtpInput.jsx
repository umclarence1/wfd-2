import { useEffect, useRef } from 'react';

const OTP_LENGTH = 6;

export default function OtpInput({
  value = '',
  onChange,
  onComplete,
  disabled = false,
  error = false,
  autoFocus = false,
}) {
  const inputsRef = useRef([]);
  const digits = Array.from({ length: OTP_LENGTH }, (_, i) => value[i] || '');

  const focusIndex = (index) => {
    inputsRef.current[index]?.focus();
  };

  const emitChange = (nextDigits) => {
    const code = nextDigits.join('');
    onChange(code);
    if (code.length === OTP_LENGTH && /^\d{6}$/.test(code)) {
      onComplete?.(code);
    }
  };

  const handleChange = (index, raw) => {
    const cleaned = raw.replace(/\D/g, '');
    const next = [...digits];

    if (!cleaned) {
      next[index] = '';
      emitChange(next);
      return;
    }

    let cursor = index;
    for (const char of cleaned) {
      if (cursor >= OTP_LENGTH) break;
      next[cursor] = char;
      cursor += 1;
    }

    emitChange(next);
    focusIndex(Math.min(cursor, OTP_LENGTH - 1));
  };

  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      const next = [...digits];
      next[index - 1] = '';
      emitChange(next);
      focusIndex(index - 1);
      event.preventDefault();
    }
  };

  const handlePaste = (event) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;

    const next = Array.from({ length: OTP_LENGTH }, (_, i) => pasted[i] || '');
    emitChange(next);
    focusIndex(Math.min(pasted.length, OTP_LENGTH - 1));
  };

  useEffect(() => {
    if (autoFocus) focusIndex(0);
  }, [autoFocus]);

  return (
    <div className="flex justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            inputsRef.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={6}
          disabled={disabled}
          value={digit}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onFocus={(event) => event.target.select()}
          aria-label={`Digit ${index + 1} of ${OTP_LENGTH}`}
          className={`h-12 w-10 rounded-xl border-2 bg-white text-center text-xl font-bold text-gray-900 outline-none transition sm:h-14 sm:w-12 ${
            error
              ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-200'
              : 'border-gray-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-200'
          } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
        />
      ))}
    </div>
  );
}
