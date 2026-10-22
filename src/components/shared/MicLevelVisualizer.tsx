import React, { useEffect, useRef, useState } from "react";

interface MicLevelVisualizerProps {
  analyser: AnalyserNode | null;
  active: boolean;
}

const CANVAS_HEIGHT = 32;
const BAR_WIDTH = 3;
const BAR_GAP = 2;
const BAR_STEP = BAR_WIDTH + BAR_GAP;
// How often a new bar is sampled/pushed in. Lower = faster scroll, more bars
// per second of speech (closer to ChatGPT dictate's pace).
const SAMPLE_INTERVAL_MS = 55;
const MIN_BAR_HEIGHT = 3;

const formatElapsed = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

/** RMS amplitude (0..1) of a time-domain byte buffer centered at 128. */
const computeAmplitude = (data: Uint8Array) => {
  let sumSquares = 0;
  for (const value of data) {
    const normalized = (value - 128) / 128;
    sumSquares += normalized * normalized;
  }
  const rms = Math.sqrt(sumSquares / data.length);
  // Normal speech RMS is small (~0.02-0.15); apply a perceptual curve so
  // quiet-to-moderate speech still produces clearly visible bar height
  // variation instead of everything clustering near MIN_BAR_HEIGHT.
  const boosted = Math.pow(rms * 6, 0.6);
  return Math.min(1, boosted);
};

const MicLevelVisualizer: React.FC<MicLevelVisualizerProps> = ({
  analyser,
  active,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cssSizeRef = useRef({ width: 0, height: CANVAS_HEIGHT });
  const barsRef = useRef<number[]>([]);
  const capacityRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);
  const lastSampleTimeRef = useRef(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Keep the canvas's pixel buffer in sync with its rendered CSS size, and
  // recompute how many bars fit — this is a rolling history buffer, not a
  // spectrum snapshot, so resizing must resize the buffer, not just the view.
  useEffect(() => {
    const containerEl = containerRef.current;
    const canvasEl = canvasRef.current;
    if (!containerEl || !canvasEl || !active) return;

    const applySize = (width: number, height: number) => {
      const dpr = window.devicePixelRatio || 1;
      cssSizeRef.current = { width, height };
      canvasEl.width = Math.max(1, Math.round(width * dpr));
      canvasEl.height = Math.max(1, Math.round(height * dpr));
      canvasEl.style.width = `${width}px`;
      canvasEl.style.height = `${height}px`;
      const ctx = canvasEl.getContext("2d");
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);

      const newCapacity = Math.max(1, Math.floor(width / BAR_STEP));
      const current = barsRef.current;
      if (current.length > newCapacity) {
        barsRef.current = current.slice(current.length - newCapacity);
      } else if (current.length < newCapacity) {
        barsRef.current = new Array(newCapacity - current.length)
          .fill(0)
          .concat(current);
      }
      capacityRef.current = newCapacity;
    };

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) applySize(rect.width, CANVAS_HEIGHT);
    });
    observer.observe(containerEl);
    const rect = containerEl.getBoundingClientRect();
    applySize(rect.width, CANVAS_HEIGHT);

    return () => observer.disconnect();
  }, [active]);

  // Rolling-buffer sampling loop against the analyser passed in from the
  // parent (created inside the click handler, so its AudioContext is
  // reliably "running"). Each tick samples the current volume and appends it
  // as a new bar on the right, shifting older bars left — a scrolling
  // history, unlike a live frequency-spectrum bar chart (which only reacts
  // in its low-frequency bars for speech).
  useEffect(() => {
    if (!active || !analyser) return;

    const dataArray = new Uint8Array(analyser.fftSize);
    barsRef.current = [];
    lastSampleTimeRef.current = 0;

    const draw = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;

      const { width, height } = cssSizeRef.current;
      ctx.clearRect(0, 0, width, height);

      const bars = barsRef.current;
      const midY = height / 2;
      // CanvasRenderingContext2D does not resolve CSS var() values assigned
      // directly to fillStyle. Read the inherited theme token as a real color
      // so the waveform stays visible in both themes and editor surfaces.
      ctx.fillStyle =
        getComputedStyle(canvas).getPropertyValue("--brand").trim() ||
        "#6366f1";
      bars.forEach((amplitude, index) => {
        const x = index * BAR_STEP;
        const barHeight = Math.max(MIN_BAR_HEIGHT, amplitude * height);
        const y = midY - barHeight / 2;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, BAR_WIDTH, barHeight, 2);
        } else {
          ctx.rect(x, y, BAR_WIDTH, barHeight);
        }
        ctx.fill();
      });
    };

    const tick = (timestamp: number) => {
      if (timestamp - lastSampleTimeRef.current >= SAMPLE_INTERVAL_MS) {
        lastSampleTimeRef.current = timestamp;
        analyser.getByteTimeDomainData(dataArray);
        const amplitude = computeAmplitude(dataArray);

        const bars = barsRef.current;
        bars.push(amplitude);
        if (bars.length > capacityRef.current) {
          bars.shift();
        }
      }
      draw();
      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
    };
  }, [active, analyser]);

  useEffect(() => {
    if (!active) {
      setElapsedSeconds(0);
      return;
    }
    setElapsedSeconds(0);
    const intervalId = window.setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [active, analyser]);

  if (!active || !analyser) return null;

  return (
    <div
      className="flex items-center gap-2 px-1"
      style={{ height: CANVAS_HEIGHT }}
      aria-label="Recording — live waveform"
    >
      <span
        className="shrink-0 rounded-full bg-red-500"
        style={{
          width: 8,
          height: 8,
          boxShadow: "0 0 0 4px rgba(239, 68, 68, 0.15)",
          animation: "micDotPulse 1.4s ease-in-out infinite",
        }}
      />
      <style>{`
        @keyframes micDotPulse {
          0%, 100% { opacity: 0.55; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>

      <div
        ref={containerRef}
        className="flex-1 min-w-0 flex items-center overflow-hidden"
        style={{
          height: CANVAS_HEIGHT,
          maskImage:
            "linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.4) 8%, rgba(0,0,0,1) 22%)",
          WebkitMaskImage:
            "linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.4) 8%, rgba(0,0,0,1) 22%)",
        }}
      >
        <canvas ref={canvasRef} style={{ display: "block" }} />
      </div>

      <span className="shrink-0 text-xs font-semibold tabular-nums text-muted min-w-8 text-right">
        {formatElapsed(elapsedSeconds)}
      </span>
    </div>
  );
};

export default MicLevelVisualizer;
