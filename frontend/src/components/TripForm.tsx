import { type FormEvent, useState } from "react";
import type { Place, PlanRequest } from "../api";
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
      <PlaceInput label="Origin" value={origin} onChange={setOrigin} placeholder="e.g. Denver, CO" />
      <PlaceInput
        label="Destination"
        value={destination}
        onChange={setDestination}
        placeholder="e.g. Salt Lake City, UT"
      />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="departure" className="mb-1 block text-xs font-medium text-slate-600">
            Departure
          </label>
          <input
            id="departure"
            type="datetime-local"
            required
            value={departure}
            min={localInputValue(new Date())}
            onChange={(e) => setDeparture(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
          />
        </div>
        <div>
          <label htmlFor="weight" className="mb-1 block text-xs font-medium text-slate-600">
            Load weight (lb)
          </label>
          <input
            id="weight"
            type="number"
            required
            min={1}
            max={200000}
            step="any"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
          />
        </div>
      </div>
      <fieldset>
        <legend className="mb-1 block text-xs font-medium text-slate-600">
          Weather checkpoint every
        </legend>
        <div className="grid grid-cols-3 rounded-md border border-slate-300 bg-white p-0.5 text-sm">
          {INTERVALS.map((mi) => (
            <label
              key={mi}
              className={`cursor-pointer rounded py-1.5 text-center ${
                intervalMi === mi ? "bg-slate-900 font-medium text-white" : "text-slate-700"
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
        className="w-full rounded-md bg-blue-700 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {loading ? "Checking routes and forecasts…" : "Find the safest route"}
      </button>
    </form>
  );
}
