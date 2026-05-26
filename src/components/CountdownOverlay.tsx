"use client";

type Props = {
  seconds: number;
};

export function CountdownOverlay({ seconds }: Props) {
  const label = seconds > 0 ? String(seconds) : "GO";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        key={label}
        className="animate-pulse text-[12rem] font-black text-white drop-shadow-2xl"
      >
        {label}
      </div>
    </div>
  );
}
