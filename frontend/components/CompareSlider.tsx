"use client";

import { useId, useState } from "react";

// Before-after comparison slider. Native range input: keyboard operable,
// visible focus, no looping animation. Only shown for files the user
// actually selected.
export default function CompareSlider({ beforeUrl, afterUrl }: { beforeUrl: string; afterUrl: string }) {
  const [pos, setPos] = useState(50);
  const labelId = useId();

  return (
    <div className="mt-4">
      <p id={labelId} className="font-semibold">
        Compare the photos: drag to contrast before and after
      </p>
      <div className="relative mt-2 aspect-[4/3] overflow-hidden rounded-md border border-line bg-ink">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={afterUrl}
          alt="After photo"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
          aria-hidden="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={beforeUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        </div>
        <div
          className="absolute inset-y-0 w-1 bg-brand"
          style={{ left: `${pos}%` }}
          aria-hidden="true"
        />
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        aria-labelledby={labelId}
        onChange={(e) => setPos(Number(e.target.value))}
        className="mt-2 min-h-[44px] w-full"
      />
      <div className="flex justify-between text-sm text-muted" aria-hidden="true">
        <span>Before</span>
        <span>After</span>
      </div>
    </div>
  );
}
