import { type FormEvent, useState } from "react";
import type { Place, PlanRequest } from "../api";
import { fieldClass, labelClass } from "../ui";
import PlaceInput from "./PlaceInput";

const INTERVALS = [10, 25, 50];

// datetime-local wants local wall time without a zone: "2026-10-30T14:00".
function localInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function nextHour(): Date {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return d;
}

type Props = { loading: boolean; onSubmit: (req: PlanRequest) => void };

export default function TripForm({ loading, onSubmit }: Props) {
  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [departure, setDeparture] = useState(localInputValue(nextHour()));
  const [weight, setWeight] = useState("40000");
  const [intervalMi, setIntervalMi] = useState(25);

  const weightLb = Number(weight);
  const valid = origin && destination && departure && weightLb > 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    onSubmit({
      origin,
      destination,
      // The browser reads the input as local time; send it with its offset.
      departure: new Date(departure).toISOString(),
      weight_lb: weightLb,
      interval_mi: intervalMi,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <PlaceInput
        label="Origin"
        value={origin}
        onChange={setOrigin}
        placeholder="e.g. Denver, CO"
      />
      <PlaceInput
        label="Destination"
        value={destination}
        onChange={setDestination}
        placeholder="e.g. Salt Lake City, UT"
      />
      <div className="grid grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] gap-3">
        <div>
          <label htmlFor="departure" className={labelClass}>
            Departure
          </label>
          <input
            id="departure"
            type="datetime-local"
            required
            value={departure}
            min={localInputValue(new Date())}
            onChange={(e) => setDeparture(e.target.value)}
            className={`${fieldClass} px-2`}
          />
        </div>
        <div>
          <label htmlFor="weight" className={labelClass}>
            Load weight (lb)
          </label>
          <input
            id="weight"
            type="number"
            inputMode="numeric"
            required
            min={1}
            max={200000}
            step="any"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className={fieldClass}
          />
        </div>
      </div>
      <fieldset>
        <legend className={labelClass}>Weather checkpoint every</legend>
        <div className="border-rule grid grid-cols-3 overflow-hidden rounded-md border bg-white text-[14px]">
          {INTERVALS.map((mi) => (
            <label
              key={mi}
              className={`has-focus-visible:ring-shield/40 border-rule cursor-pointer border-l py-2 text-center transition-colors first:border-l-0 has-focus-visible:ring-2 has-focus-visible:ring-inset ${
                intervalMi === mi ? "bg-ink font-bold text-white" : "text-ink-2 hover:bg-rule-2"
              }`}
            >
              <input
                type="radio"
                name="interval"
                value={mi}
                checked={intervalMi === mi}
                onChange={() => setIntervalMi(mi)}
                className="sr-only"
              />
              {mi} mi
            </label>
          ))}
        </div>
      </fieldset>
      <button
        type="submit"
        disabled={!valid || loading}
        className="bg-shield hover:bg-shield-dark disabled:bg-rule disabled:text-ink-3 w-full rounded-md py-2.5 text-[15px] font-bold text-white transition-colors disabled:cursor-not-allowed"
      >
        {loading ? "Checking routes and forecasts…" : "Find the safest route"}
      </button>
    </form>
  );
}
