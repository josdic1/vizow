import {
  ArrowLeft,
  Calculator,
  RotateCcw,
} from "lucide-react";
import { useState } from "react";

type CalculatorId =
  | "boardfeet"
  | "concrete"
  | "studs"
  | "roofing"
  | "paint"
  | "drywall"
  | "stairs"
  | "rafter"
  | "markup"
  | "fraction";

const calculators: Array<{
  id: CalculatorId;
  name: string;
}> = [
  { id: "boardfeet", name: "Board feet" },
  { id: "concrete", name: "Concrete volume" },
  { id: "studs", name: "Stud count" },
  { id: "roofing", name: "Roofing squares" },
  { id: "paint", name: "Paint coverage" },
  { id: "drywall", name: "Drywall sheets" },
  { id: "stairs", name: "Stair risers" },
  { id: "rafter", name: "Rafter length" },
  { id: "markup", name: "Markup / margin" },
  { id: "fraction", name: "Tape fraction" },
];

function number(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: number, digits = 2) {
  if (!Number.isFinite(value)) {
    return "0";
  }

  return Number(value.toFixed(digits)).toLocaleString();
}

function DetailHeader({
  title,
  description,
  onReset,
}: {
  title: string;
  description: string;
  onReset: () => void;
}) {
  return (
    <>
      <div className="nailed-it-detail-actions">
        <button type="button" onClick={onReset}>
          <RotateCcw aria-hidden="true" />
          Clear
        </button>
      </div>

      <header className="nailed-it-calc-detail-header">
        <strong>{title}</strong>
        <span>{description}</span>
      </header>
    </>
  );
}

function UnitInput({
  value,
  unit,
  step,
  onChange,
}: {
  value: string;
  unit: string;
  step?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="nailed-it-input-unit">
      <input
        type="number"
        inputMode="decimal"
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <b>{unit}</b>
    </div>
  );
}

function BoardFeetCalculator() {
  const [thickness, setThickness] = useState("1.5");
  const [width, setWidth] = useState("5.5");
  const [length, setLength] = useState("8");
  const [quantity, setQuantity] = useState("1");

  const each =
    (number(thickness) * number(width) * number(length)) / 12;

  const total = each * number(quantity);

  function reset() {
    setThickness("1.5");
    setWidth("5.5");
    setLength("8");
    setQuantity("1");
  }

  return (
    <>
      <DetailHeader
        title="Board feet"
        description="BF = (thickness × width × length) ÷ 12, per piece."
        onReset={reset}
      />

      <div className="nailed-it-field-grid">
        <label>
          <span>Thickness</span>
          <UnitInput
            value={thickness}
            unit="in"
            step="0.25"
            onChange={setThickness}
          />
        </label>

        <label>
          <span>Width</span>
          <UnitInput
            value={width}
            unit="in"
            step="0.25"
            onChange={setWidth}
          />
        </label>

        <label>
          <span>Length</span>
          <UnitInput
            value={length}
            unit="ft"
            step="0.5"
            onChange={setLength}
          />
        </label>

        <label>
          <span>Quantity</span>
          <input
            type="number"
            inputMode="numeric"
            value={quantity}
            onChange={(event) =>
              setQuantity(event.target.value)
            }
          />
        </label>
      </div>

      <div className="nailed-it-readout">
        <span>Total board feet</span>
        <strong>{formatNumber(total)} BF</strong>
        <small>Per piece: {formatNumber(each)} BF</small>
      </div>
    </>
  );
}

function ConcreteCalculator() {
  const [mode, setMode] = useState<"slab" | "footing">(
    "slab",
  );
  const [length, setLength] = useState("20");
  const [width, setWidth] = useState("10");
  const [thickness, setThickness] = useState("4");
  const [depth, setDepth] = useState("12");

  const cubicFeet =
    mode === "slab"
      ? number(length) *
        number(width) *
        (number(thickness) / 12)
      : number(length) *
        (number(width) / 12) *
        (number(depth) / 12);

  const cubicYards = cubicFeet / 27;
  const bags = Math.ceil(cubicYards * 45);

  function reset() {
    setMode("slab");
    setLength("20");
    setWidth("10");
    setThickness("4");
    setDepth("12");
  }

  return (
    <>
      <DetailHeader
        title="Concrete volume"
        description="Slab or footing, straight to cubic yards."
        onReset={reset}
      />

      <div className="nailed-it-segment">
        <button
          className={mode === "slab" ? "active" : undefined}
          type="button"
          onClick={() => setMode("slab")}
        >
          Slab
        </button>
        <button
          className={
            mode === "footing" ? "active" : undefined
          }
          type="button"
          onClick={() => setMode("footing")}
        >
          Footing
        </button>
      </div>

      <div className="nailed-it-field-grid">
        <label>
          <span>Length</span>
          <UnitInput
            value={length}
            unit="ft"
            onChange={setLength}
          />
        </label>

        <label>
          <span>Width</span>
          <UnitInput
            value={width}
            unit={mode === "slab" ? "ft" : "in"}
            onChange={setWidth}
          />
        </label>

        <label>
          <span>
            {mode === "slab" ? "Thickness" : "Depth"}
          </span>
          <UnitInput
            value={mode === "slab" ? thickness : depth}
            unit="in"
            onChange={
              mode === "slab" ? setThickness : setDepth
            }
          />
        </label>
      </div>

      <div className="nailed-it-readout">
        <span>Concrete needed</span>
        <strong>{formatNumber(cubicYards)} cu yd</strong>
        <small>
          {formatNumber(cubicFeet, 1)} cu ft · ~{bags} 80lb
          bags
        </small>
      </div>
    </>
  );
}

function StudCalculator() {
  const [length, setLength] = useState("24");
  const [spacing, setSpacing] = useState<16 | 24>(16);
  const [corners, setCorners] = useState("2");
  const [openings, setOpenings] = useState("1");

  const base =
    Math.floor((number(length) * 12) / spacing) + 1;
  const extra = number(corners) * 2 + number(openings) * 3;

  function reset() {
    setLength("24");
    setSpacing(16);
    setCorners("2");
    setOpenings("1");
  }

  return (
    <>
      <DetailHeader
        title="Stud count"
        description="Rough count for a straight wall run."
        onReset={reset}
      />

      <label className="nailed-it-single-field">
        <span>Wall length</span>
        <UnitInput
          value={length}
          unit="ft"
          onChange={setLength}
        />
      </label>

      <div className="nailed-it-segment">
        <button
          className={spacing === 16 ? "active" : undefined}
          type="button"
          onClick={() => setSpacing(16)}
        >
          16&quot; OC
        </button>
        <button
          className={spacing === 24 ? "active" : undefined}
          type="button"
          onClick={() => setSpacing(24)}
        >
          24&quot; OC
        </button>
      </div>

      <div className="nailed-it-field-grid">
        <label>
          <span>Corners</span>
          <input
            type="number"
            value={corners}
            onChange={(event) =>
              setCorners(event.target.value)
            }
          />
        </label>

        <label>
          <span>Openings</span>
          <input
            type="number"
            value={openings}
            onChange={(event) =>
              setOpenings(event.target.value)
            }
          />
        </label>
      </div>

      <div className="nailed-it-readout">
        <span>Studs to order</span>
        <strong>{base + extra} studs</strong>
        <small>
          Field studs: {base} · Corners/openings: {extra}
        </small>
      </div>
    </>
  );
}

function RoofingCalculator() {
  const [area, setArea] = useState("1800");
  const [pitch, setPitch] = useState("6");
  const [waste, setWaste] = useState("10");

  const multiplier = Math.sqrt(
    1 + Math.pow(number(pitch) / 12, 2),
  );
  const actual = number(area) * multiplier;
  const squares =
    (actual * (1 + number(waste) / 100)) / 100;

  function reset() {
    setArea("1800");
    setPitch("6");
    setWaste("10");
  }

  return (
    <>
      <DetailHeader
        title="Roofing squares"
        description="1 square = 100 sq ft of roof surface."
        onReset={reset}
      />

      <div className="nailed-it-field-grid">
        <label>
          <span>Roof footprint</span>
          <UnitInput
            value={area}
            unit="sq ft"
            onChange={setArea}
          />
        </label>

        <label>
          <span>Pitch</span>
          <UnitInput
            value={pitch}
            unit="/12"
            onChange={setPitch}
          />
        </label>

        <label>
          <span>Waste / overlap</span>
          <UnitInput
            value={waste}
            unit="%"
            onChange={setWaste}
          />
        </label>
      </div>

      <div className="nailed-it-readout">
        <span>Squares to order</span>
        <strong>{formatNumber(squares, 1)} squares</strong>
        <small>
          Actual sloped area: {formatNumber(actual, 0)} sq ft
        </small>
      </div>
    </>
  );
}

function PaintCalculator() {
  const [area, setArea] = useState("480");
  const [coats, setCoats] = useState<1 | 2 | 3>(2);
  const [coverage, setCoverage] = useState("350");

  const exact =
    (number(area) * coats) / (number(coverage) || 1);

  function reset() {
    setArea("480");
    setCoats(2);
    setCoverage("350");
  }

  return (
    <>
      <DetailHeader
        title="Paint coverage"
        description="Area to gallons, by coat count."
        onReset={reset}
      />

      <label className="nailed-it-single-field">
        <span>Area to paint</span>
        <UnitInput
          value={area}
          unit="sq ft"
          onChange={setArea}
        />
      </label>

      <div className="nailed-it-segment">
        {[1, 2, 3].map((value) => (
          <button
            key={value}
            className={
              coats === value ? "active" : undefined
            }
            type="button"
            onClick={() => setCoats(value as 1 | 2 | 3)}
          >
            {value} coat{value === 1 ? "" : "s"}
          </button>
        ))}
      </div>

      <label className="nailed-it-single-field">
        <span>Coverage per gallon</span>
        <UnitInput
          value={coverage}
          unit="sq ft"
          onChange={setCoverage}
        />
      </label>

      <div className="nailed-it-readout">
        <span>Buy</span>
        <strong>{Math.ceil(exact)} gal</strong>
        <small>Exact: {formatNumber(exact)} gal</small>
      </div>
    </>
  );
}

function DrywallCalculator() {
  const [area, setArea] = useState("960");
  const [sheetSize, setSheetSize] = useState<32 | 48>(32);
  const [waste, setWaste] = useState("10");

  const sheets = Math.ceil(
    (number(area) * (1 + number(waste) / 100)) /
      sheetSize,
  );

  function reset() {
    setArea("960");
    setSheetSize(32);
    setWaste("10");
  }

  return (
    <>
      <DetailHeader
        title="Drywall sheets"
        description="Area to sheet count, with waste."
        onReset={reset}
      />

      <label className="nailed-it-single-field">
        <span>Area to cover</span>
        <UnitInput
          value={area}
          unit="sq ft"
          onChange={setArea}
        />
      </label>

      <div className="nailed-it-segment">
        <button
          className={
            sheetSize === 32 ? "active" : undefined
          }
          type="button"
          onClick={() => setSheetSize(32)}
        >
          4×8
        </button>
        <button
          className={
            sheetSize === 48 ? "active" : undefined
          }
          type="button"
          onClick={() => setSheetSize(48)}
        >
          4×12
        </button>
      </div>

      <label className="nailed-it-single-field">
        <span>Waste</span>
        <UnitInput
          value={waste}
          unit="%"
          onChange={setWaste}
        />
      </label>

      <div className="nailed-it-readout">
        <span>Sheets to order</span>
        <strong>{sheets} sheets</strong>
      </div>
    </>
  );
}

function StairsCalculator() {
  const [rise, setRise] = useState("105");
  const [target, setTarget] = useState("7.5");
  const [tread, setTread] = useState("10");

  const risers = Math.max(
    1,
    Math.round(number(rise) / (number(target) || 7.5)),
  );
  const actual = number(rise) / risers;
  const treads = risers - 1;
  const totalRun = treads * number(tread);

  function reset() {
    setRise("105");
    setTarget("7.5");
    setTread("10");
  }

  return (
    <>
      <DetailHeader
        title="Stair risers"
        description="Total rise split into even steps."
        onReset={reset}
      />

      <div className="nailed-it-field-grid">
        <label>
          <span>Total rise</span>
          <UnitInput
            value={rise}
            unit="in"
            onChange={setRise}
          />
        </label>

        <label>
          <span>Target riser</span>
          <UnitInput
            value={target}
            unit="in"
            onChange={setTarget}
          />
        </label>

        <label>
          <span>Tread depth</span>
          <UnitInput
            value={tread}
            unit="in"
            onChange={setTread}
          />
        </label>
      </div>

      <div className="nailed-it-readout">
        <span>Riser count</span>
        <strong>{risers} risers</strong>
        <small>
          Actual: {formatNumber(actual, 3)} in · Treads:{" "}
          {treads} · Run: {formatNumber(totalRun, 1)} in
        </small>
      </div>
    </>
  );
}

function RafterCalculator() {
  const [run, setRun] = useState("12");
  const [pitch, setPitch] = useState("6");

  const rise = number(run) * (number(pitch) / 12);
  const length = Math.sqrt(
    Math.pow(number(run), 2) + Math.pow(rise, 2),
  );
  const angle =
    Math.atan(number(pitch) / 12) * (180 / Math.PI);

  function reset() {
    setRun("12");
    setPitch("6");
  }

  return (
    <>
      <DetailHeader
        title="Rafter length"
        description="Run + pitch to rafter length and angle."
        onReset={reset}
      />

      <div className="nailed-it-field-grid">
        <label>
          <span>Run</span>
          <UnitInput
            value={run}
            unit="ft"
            onChange={setRun}
          />
        </label>

        <label>
          <span>Pitch</span>
          <UnitInput
            value={pitch}
            unit="/12"
            onChange={setPitch}
          />
        </label>
      </div>

      <div className="nailed-it-readout">
        <span>Rafter length</span>
        <strong>{formatNumber(length)} ft</strong>
        <small>
          Rise: {formatNumber(rise)} ft · Angle:{" "}
          {formatNumber(angle, 1)}°
        </small>
      </div>
    </>
  );
}

function MarkupCalculator() {
  const [mode, setMode] = useState<"markup" | "margin">(
    "markup",
  );
  const [cost, setCost] = useState("1200");
  const [percent, setPercent] = useState("30");

  let price = number(cost);

  if (mode === "markup") {
    price = number(cost) * (1 + number(percent) / 100);
  } else {
    const margin = Math.min(number(percent), 99.9) / 100;
    price =
      margin < 1 ? number(cost) / (1 - margin) : number(cost);
  }

  const profit = price - number(cost);
  const margin =
    price > 0 ? (profit / price) * 100 : 0;
  const markup =
    number(cost) > 0 ? (profit / number(cost)) * 100 : 0;

  function reset() {
    setMode("markup");
    setCost("1200");
    setPercent("30");
  }

  return (
    <>
      <DetailHeader
        title="Markup / margin"
        description="Cost to sell price, either direction."
        onReset={reset}
      />

      <div className="nailed-it-segment">
        <button
          className={
            mode === "markup" ? "active" : undefined
          }
          type="button"
          onClick={() => setMode("markup")}
        >
          Markup %
        </button>
        <button
          className={
            mode === "margin" ? "active" : undefined
          }
          type="button"
          onClick={() => setMode("margin")}
        >
          Margin %
        </button>
      </div>

      <div className="nailed-it-field-grid">
        <label>
          <span>Cost</span>
          <UnitInput
            value={cost}
            unit="$"
            onChange={setCost}
          />
        </label>

        <label>
          <span>
            {mode === "markup" ? "Markup" : "Margin"}
          </span>
          <UnitInput
            value={percent}
            unit="%"
            onChange={setPercent}
          />
        </label>
      </div>

      <div className="nailed-it-readout">
        <span>Sell price</span>
        <strong>${formatNumber(price)}</strong>
        <small>
          Profit: ${formatNumber(profit)} · Margin:{" "}
          {formatNumber(margin, 1)}% · Markup:{" "}
          {formatNumber(markup, 1)}%
        </small>
      </div>
    </>
  );
}

function fractionString(
  whole: number,
  sixteenths: number,
) {
  if (sixteenths === 0) {
    return `${whole}"`;
  }

  let numerator = sixteenths;
  let denominator = 16;

  while (numerator % 2 === 0 && numerator !== 0) {
    numerator /= 2;
    denominator /= 2;
  }

  return `${whole} ${numerator}/${denominator}"`;
}

function FractionCalculator() {
  const [whole, setWhole] = useState("0");
  const [sixteenths, setSixteenths] = useState("0");
  const [reverse, setReverse] = useState("3.42");

  let wholeNumber = Math.max(0, Math.floor(number(whole)));
  let sixteenthNumber = Math.max(
    0,
    Math.floor(number(sixteenths)),
  );

  if (sixteenthNumber >= 16) {
    wholeNumber += Math.floor(sixteenthNumber / 16);
    sixteenthNumber %= 16;
  }

  const decimalInches =
    wholeNumber + sixteenthNumber / 16;

  const reverseDecimal = Math.max(0, number(reverse));
  let reverseWhole = Math.floor(reverseDecimal);
  let reverseSixteenths = Math.round(
    (reverseDecimal - reverseWhole) * 16,
  );

  if (reverseSixteenths >= 16) {
    reverseWhole += 1;
    reverseSixteenths = 0;
  }

  function addSixteenths(amount: number) {
    const current =
      wholeNumber * 16 + sixteenthNumber + amount;

    setWhole(String(Math.floor(current / 16)));
    setSixteenths(String(current % 16));
  }

  function reset() {
    setWhole("0");
    setSixteenths("0");
    setReverse("3.42");
  }

  return (
    <>
      <DetailHeader
        title="Tape fraction"
        description="Build a measurement in 16ths, read the decimal."
        onReset={reset}
      />

      <div className="nailed-it-field-grid">
        <label>
          <span>Whole inches</span>
          <input
            type="number"
            value={whole}
            onChange={(event) =>
              setWhole(event.target.value)
            }
          />
        </label>

        <label>
          <span>16ths</span>
          <input
            type="number"
            value={sixteenths}
            onChange={(event) =>
              setSixteenths(event.target.value)
            }
          />
        </label>
      </div>

      <div className="nailed-it-fraction-buttons">
        <button type="button" onClick={() => addSixteenths(1)}>
          +1/16
        </button>
        <button type="button" onClick={() => addSixteenths(2)}>
          +1/8
        </button>
        <button type="button" onClick={() => addSixteenths(4)}>
          +1/4
        </button>
        <button type="button" onClick={() => addSixteenths(8)}>
          +1/2
        </button>
      </div>

      <div className="nailed-it-readout">
        <span>Reads as</span>
        <strong>
          {fractionString(wholeNumber, sixteenthNumber)}
        </strong>
        <small>
          Decimal inches: {formatNumber(decimalInches, 4)} ·
          Decimal feet:{" "}
          {formatNumber(decimalInches / 12, 4)}
        </small>
      </div>

      <label className="nailed-it-single-field">
        <span>Or type a decimal</span>
        <UnitInput
          value={reverse}
          unit="in"
          onChange={setReverse}
        />
      </label>

      <div className="nailed-it-readout">
        <span>Reads as</span>
        <strong>
          {fractionString(
            reverseWhole,
            reverseSixteenths,
          )}
        </strong>
      </div>
    </>
  );
}

function CalculatorDetail({
  id,
}: {
  id: CalculatorId;
}) {
  switch (id) {
    case "boardfeet":
      return <BoardFeetCalculator />;
    case "concrete":
      return <ConcreteCalculator />;
    case "studs":
      return <StudCalculator />;
    case "roofing":
      return <RoofingCalculator />;
    case "paint":
      return <PaintCalculator />;
    case "drywall":
      return <DrywallCalculator />;
    case "stairs":
      return <StairsCalculator />;
    case "rafter":
      return <RafterCalculator />;
    case "markup":
      return <MarkupCalculator />;
    case "fraction":
      return <FractionCalculator />;
  }
}

export function NailedItCalculators() {
  const [selected, setSelected] =
    useState<CalculatorId | null>(null);

  if (selected) {
    return (
      <>
        <div className="nailed-it-calc-nav">
          <button
            className="nailed-it-calc-back"
            type="button"
            onClick={() => setSelected(null)}
          >
            <ArrowLeft aria-hidden="true" />
            All calculators
          </button>
        </div>

        <CalculatorDetail id={selected} />
      </>
    );
  }

  return (
    <>
      <header className="nailed-it-section-header">
        <strong>Calculators</strong>
        <span>Tap one to open it.</span>
      </header>

      <div className="nailed-it-calc-grid">
        {calculators.map((item) => (
          <button
            className="nailed-it-calc-card"
            key={item.id}
            type="button"
            onClick={() => setSelected(item.id)}
          >
            <Calculator
              aria-hidden="true"
              strokeWidth={1.4}
            />
            <span>{item.name}</span>
          </button>
        ))}
      </div>
    </>
  );
}
