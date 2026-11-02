import { useEffect, useId, useState } from "react";
import { api, type Place } from "../api";
import { fieldClass, labelClass } from "../ui";

type Props = {
  label: string;
  value: Place | null;
  onChange: (place: Place | null) => void;
  placeholder?: string;
};

// Free text alone can't be routed; the user picks one of the geocoder's matches.
export default function PlaceInput({ label, value, onChange, placeholder }: Props) {
  const id = useId();
  const [text, setText] = useState(value?.label ?? "");
  const [options, setOptions] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (value && text === value.label) return;
    if (text.trim().length < 3) {
      setOptions([]);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      api
        .geocode(text.trim(), ctrl.signal)
        .then((places) => {
          setOptions(places);
          setActive(0);
          setOpen(true);
        })
        .catch(() => {});
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [text, value]);

  const choose = (p: Place) => {
    onChange(p);
    setText(p.label);
    setOpen(false);
  };

  return (
    <div className="relative">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
        value={text}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        className={fieldClass}
        onChange={(e) => {
          setText(e.target.value);
          if (value) onChange(null);
        }}
        onFocus={() => options.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!open || !options.length) return;
          if (e.key === "ArrowDown") setActive((a) => (a + 1) % options.length);
          else if (e.key === "ArrowUp") setActive((a) => (a - 1 + options.length) % options.length);
          else if (e.key === "Enter") choose(options[active]);
          else if (e.key === "Escape") setOpen(false);
          else return;
          e.preventDefault();
        }}
      />
      {open && options.length > 0 && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="border-rule absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-white py-1 text-[14px] shadow-lg"
        >
          {options.map((p, i) => (
            <li
              key={`${p.lat},${p.lon},${i}`}
              role="option"
              aria-selected={i === active}
              className={`text-ink cursor-pointer px-3 py-1.5 ${i === active ? "bg-[#edf2fa]" : ""}`}
              onMouseDown={() => choose(p)}
              onMouseEnter={() => setActive(i)}
            >
              {p.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
