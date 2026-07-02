import { useEffect, useState } from 'react';

export default function PackagePriceInput({ pkg, onSave, isSaving }) {
  const [price, setPrice] = useState(String(pkg.price));
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setPrice(String(pkg.price));
    setDirty(false);
  }, [pkg._id, pkg.price]);

  const save = () => {
    const next = Number(price);
    if (Number.isNaN(next) || next < 0) return;
    if (next === pkg.price) {
      setDirty(false);
      return;
    }
    onSave(next);
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min="0"
        step="0.01"
        value={price}
        className="input-field !w-28 !py-2"
        onChange={(e) => {
          setPrice(e.target.value);
          setDirty(true);
        }}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            save();
          }
        }}
      />
      {dirty && (
        <button
          type="button"
          disabled={isSaving}
          onClick={save}
          className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isSaving ? '...' : 'Save'}
        </button>
      )}
    </div>
  );
}
