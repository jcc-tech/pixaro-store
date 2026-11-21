"use client";
import * as Slider from "@radix-ui/react-slider";

export function BudgetFilter({ highest, limit, onChange }: {
  highest: number;
  limit: number | null;
  onChange: (value: number | null) => void;
}) {
  const display = limit === null ? "不限" : `NT$${limit.toLocaleString("zh-TW")} 以內`;
  return <fieldset className="pxBudget">
    <legend>台幣預算</legend>
    <div className="pxBudgetLine"><span>價格上限</span><output>{display}</output></div>
    <Slider.Root className="pxSlider" min={0} max={highest} step={1}
      value={[limit ?? highest]} onValueChange={([value]) => onChange(value === highest ? null : value)}>
      <Slider.Track className="pxTrack"><Slider.Range className="pxRange"/></Slider.Track>
      <Slider.Thumb className="pxThumb" aria-label="價格上限" aria-valuetext={display}/>
    </Slider.Root>
    <div className="pxPresets">{[100, 500, 1000].filter(n => n < highest).map(n =>
      <button key={n} aria-pressed={limit === n} onClick={() => onChange(n)}>NT${n.toLocaleString("zh-TW")}</button>
    )}<button aria-pressed={limit === null} onClick={() => onChange(null)}>不限</button></div>
  </fieldset>;
}
