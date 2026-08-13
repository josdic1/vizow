import { ArrowLeftRight } from "lucide-react";
import { useState } from "react";

type ConvertCategory =
  | "length"
  | "feetinches"
  | "area"
  | "volume"
  | "weight"
  | "temp"
  | "slope";

type UnitOption = {
  label: string;
  factor: number;
};

const categories: Array<{
  id: ConvertCategory;
  label: string;
}> = [
  { id: "length", label: "Length" },
  { id: "feetinches", label: "Ft & in" },
  { id: "area", label: "Area" },
  { id: "volume", label: "Volume" },
  { id: "weight", label: "Weight" },
  { id: "temp", label: "Temp" },
  { id: "slope", label: "Slope" },
];

const lengthUnits: UnitOption[] = [
  { label: "in", factor: 1 },
  { label: "ft", factor: 12 },
  { label: "yd", factor: 36 },
  { label: "mm", factor: 0.0393701 },
  { label: "cm", factor: 0.393701 },
  { label: "m", factor: 39.3701 },
];

const areaUnits: UnitOption[] = [
  { label: "sq ft", factor: 1 },
  { label: "sq yd", factor: 9 },
  { label: "sq m", factor: 10.7639 },
  { label: "acre", factor: 43560 },
];

const volumeUnits: UnitOption[] = [
  { label: "cu ft", factor: 1 },
  { label: "cu yd", factor: 27 },
  { label: "gal", factor: 0.133681 },
  { label: "L", factor: 0.0353147 },
];

const weightUnits: UnitOption[] = [
  { label: "lb", factor: 1 },
  { label: "kg", factor: 2.20462 },
];

function formatNumber(value: number, digits = 4) {
  if (!Number.isFinite(value)) {
    return "0";
  }

  return Number(value.toFixed(digits)).toString();
}

function UnitPicker({
  units,
  value,
  onChange,
}: {
  units: UnitOption[];
  value: number;
  onChange: (value: number) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="nailed-it-unit-picker">
      <button
        className="nailed-it-unit-trigger"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{units[value].label}</span>
        <span aria-hidden="true">⌄</span>
      </button>

      {open ? (
        <div
          className="nailed-it-unit-menu"
          role="listbox"
          aria-label="Choose unit"
        >
          {units.map((unit, index) => (
            <button
              key={unit.label}
              className={
                index === value ? "active" : undefined
              }
              type="button"
              role="option"
              aria-selected={index === value}
              onClick={() => {
                onChange(index);
                setOpen(false);
              }}
            >
              {unit.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FactorConverter({
  units,
  initialFrom,
  initialTo,
  initialValue,
}: {
  units: UnitOption[];
  initialFrom: number;
  initialTo: number;
  initialValue: number;
}) {
  const [fromUnit, setFromUnit] = useState(initialFrom);
  const [toUnit, setToUnit] = useState(initialTo);
  const [fromValue, setFromValue] = useState(
    String(initialValue),
  );
  const [toValue, setToValue] = useState(() =>
    formatNumber(
      (initialValue * units[initialFrom].factor) /
        units[initialTo].factor,
    ),
  );

  function updateFrom(value: string, unit = fromUnit) {
    setFromValue(value);

    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) {
      setToValue("");
      return;
    }

    setToValue(
      formatNumber(
        (parsed * units[unit].factor) /
          units[toUnit].factor,
      ),
    );
  }

  function updateTo(value: string, unit = toUnit) {
    setToValue(value);

    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) {
      setFromValue("");
      return;
    }

    setFromValue(
      formatNumber(
        (parsed * units[unit].factor) /
          units[fromUnit].factor,
      ),
    );
  }

  function swap() {
    setFromUnit(toUnit);
    setToUnit(fromUnit);
    setFromValue(toValue);
    setToValue(fromValue);
  }

  return (
    <div className="nailed-it-convert-io">
      <div className="nailed-it-convert-field">
        <span>From</span>

        <div className="nailed-it-convert-control">
          <input
            inputMode="decimal"
            type="number"
            value={fromValue}
            onChange={(event) =>
              updateFrom(event.target.value)
            }
          />

          <UnitPicker
            units={units}
            value={fromUnit}
            onChange={(next) => {
              setFromUnit(next);
              updateFrom(fromValue, next);
            }}
          />
        </div>
      </div>

      <button
        className="nailed-it-swap"
        type="button"
        aria-label="Swap units"
        onClick={swap}
      >
        <ArrowLeftRight aria-hidden="true" />
      </button>

      <div className="nailed-it-convert-field">
        <span>To</span>

        <div className="nailed-it-convert-control">
          <input
            inputMode="decimal"
            type="number"
            value={toValue}
            onChange={(event) =>
              updateTo(event.target.value)
            }
          />

          <UnitPicker
            units={units}
            value={toUnit}
            onChange={(next) => {
              setToUnit(next);
              updateTo(toValue, next);
            }}
          />
        </div>
      </div>
    </div>
  );
}

function FeetInchesConverter() {
  const [feet, setFeet] = useState("5");
  const [inches, setInches] = useState("7");
  const [sixteenths, setSixteenths] = useState("8");
  const [decimalFeet, setDecimalFeet] = useState("5.64");

  const totalInches =
    (Number.parseFloat(feet) || 0) * 12 +
    (Number.parseFloat(inches) || 0) +
    (Number.parseFloat(sixteenths) || 0) / 16;

  const reverseTotal =
    (Number.parseFloat(decimalFeet) || 0) * 12;
  const reverseFeet = Math.floor(reverseTotal / 12);
  let reverseInches = Math.floor(
    reverseTotal - reverseFeet * 12,
  );
  let reverseSixteenths = Math.round(
    (reverseTotal -
      reverseFeet * 12 -
      reverseInches) *
      16,
  );

  if (reverseSixteenths >= 16) {
    reverseInches += 1;
    reverseSixteenths = 0;
  }

  function fractionLabel(value: number) {
    if (value === 0) {
      return "";
    }

    let numerator = value;
    let denominator = 16;

    while (
      numerator % 2 === 0 &&
      numerator !== 0
    ) {
      numerator /= 2;
      denominator /= 2;
    }

    return ` ${numerator}/${denominator}`;
  }

  return (
    <div className="nailed-it-convert-stack">
      <div className="nailed-it-field-grid">
        <label>
          <span>Feet</span>
          <input
            type="number"
            inputMode="numeric"
            value={feet}
            onChange={(event) =>
              setFeet(event.target.value)
            }
          />
        </label>

        <label>
          <span>Inches</span>
          <input
            type="number"
            inputMode="numeric"
            value={inches}
            onChange={(event) =>
              setInches(event.target.value)
            }
          />
        </label>

        <label>
          <span>16ths</span>
          <input
            type="number"
            inputMode="numeric"
            value={sixteenths}
            onChange={(event) =>
              setSixteenths(event.target.value)
            }
          />
        </label>
      </div>

      <div className="nailed-it-readout">
        <span>Decimal feet</span>
        <strong>{formatNumber(totalInches / 12)}</strong>
        <small>
          Decimal inches: {formatNumber(totalInches)}
        </small>
      </div>

      <label className="nailed-it-single-field">
        <span>Or type decimal feet directly</span>
        <input
          type="number"
          inputMode="decimal"
          value={decimalFeet}
          onChange={(event) =>
            setDecimalFeet(event.target.value)
          }
        />
      </label>

      <div className="nailed-it-readout">
        <span>Reads as</span>
        <strong>
          {reverseFeet}' {reverseInches}
          {fractionLabel(reverseSixteenths)}"
        </strong>
      </div>
    </div>
  );
}

function TemperatureConverter() {
  const [fahrenheit, setFahrenheit] = useState("70");
  const [celsius, setCelsius] = useState(
    formatNumber((70 - 32) * (5 / 9), 1),
  );

  return (
    <div className="nailed-it-convert-io">
      <label>
        <span>Fahrenheit</span>
        <div>
          <input
            type="number"
            inputMode="decimal"
            value={fahrenheit}
            onChange={(event) => {
              const value = event.target.value;
              setFahrenheit(value);
              const number = Number.parseFloat(value);
              setCelsius(
                Number.isFinite(number)
                  ? formatNumber(
                      (number - 32) * (5 / 9),
                      1,
                    )
                  : "",
              );
            }}
          />
          <b>°F</b>
        </div>
      </label>

      <ArrowLeftRight
        className="nailed-it-static-swap"
        aria-hidden="true"
      />

      <label>
        <span>Celsius</span>
        <div>
          <input
            type="number"
            inputMode="decimal"
            value={celsius}
            onChange={(event) => {
              const value = event.target.value;
              setCelsius(value);
              const number = Number.parseFloat(value);
              setFahrenheit(
                Number.isFinite(number)
                  ? formatNumber(
                      number * (9 / 5) + 32,
                      1,
                    )
                  : "",
              );
            }}
          />
          <b>°C</b>
        </div>
      </label>
    </div>
  );
}

function SlopeConverter() {
  const [rise, setRise] = useState("6");
  const [run, setRun] = useState("12");
  const [angle, setAngle] = useState("26.57");

  const riseNumber = Number.parseFloat(rise) || 0;
  const runNumber = Number.parseFloat(run) || 1;
  const degrees =
    Math.atan(riseNumber / runNumber) *
    (180 / Math.PI);
  const grade = (riseNumber / runNumber) * 100;

  const reverseAngle =
    Number.parseFloat(angle) || 0;
  const pitch =
    Math.tan((reverseAngle * Math.PI) / 180) * 12;

  return (
    <div className="nailed-it-convert-stack">
      <div className="nailed-it-field-grid">
        <label>
          <span>Rise</span>
          <input
            type="number"
            inputMode="decimal"
            value={rise}
            onChange={(event) =>
              setRise(event.target.value)
            }
          />
        </label>

        <label>
          <span>Run</span>
          <input
            type="number"
            inputMode="decimal"
            value={run}
            onChange={(event) =>
              setRun(event.target.value)
            }
          />
        </label>
      </div>

      <div className="nailed-it-readout">
        <span>Angle</span>
        <strong>{formatNumber(degrees, 2)}°</strong>
        <small>
          Percent grade: {formatNumber(grade, 1)}%
        </small>
      </div>

      <label className="nailed-it-single-field">
        <span>Or type an angle directly</span>
        <input
          type="number"
          inputMode="decimal"
          value={angle}
          onChange={(event) =>
            setAngle(event.target.value)
          }
        />
      </label>

      <div className="nailed-it-readout">
        <span>Equivalent pitch</span>
        <strong>{formatNumber(pitch, 2)}/12</strong>
      </div>
    </div>
  );
}

export function NailedItConvert() {
  const [category, setCategory] =
    useState<ConvertCategory>("length");

  return (
    <>
      <header className="nailed-it-section-header">
        <strong>Convert</strong>
        <span>Pick a category, type either side.</span>
      </header>

      <div className="nailed-it-chip-row">
        {categories.map((item) => (
          <button
            key={item.id}
            className={
              category === item.id ? "active" : undefined
            }
            type="button"
            onClick={() => setCategory(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="nailed-it-convert-panel">
        {category === "length" ? (
          <FactorConverter
            units={lengthUnits}
            initialFrom={0}
            initialTo={1}
            initialValue={1}
          />
        ) : null}

        {category === "feetinches" ? (
          <FeetInchesConverter />
        ) : null}

        {category === "area" ? (
          <FactorConverter
            units={areaUnits}
            initialFrom={0}
            initialTo={1}
            initialValue={1000}
          />
        ) : null}

        {category === "volume" ? (
          <FactorConverter
            units={volumeUnits}
            initialFrom={0}
            initialTo={1}
            initialValue={27}
          />
        ) : null}

        {category === "weight" ? (
          <FactorConverter
            units={weightUnits}
            initialFrom={0}
            initialTo={1}
            initialValue={80}
          />
        ) : null}

        {category === "temp" ? (
          <TemperatureConverter />
        ) : null}

        {category === "slope" ? (
          <SlopeConverter />
        ) : null}
      </div>
    </>
  );
}
