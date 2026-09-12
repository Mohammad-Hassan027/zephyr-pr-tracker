/**
 * useQrScanner
 *
 * A React-safe QR camera scanner.
 *
 * Why not html5-qrcode?
 * ---------------------
 * html5-qrcode imperatively mutates a DOM node (appending/removing <video>,
 * <canvas>, and overlay elements directly). When React unmounts the host
 * component it removes those nodes from the tree, and then html5-qrcode's
 * own cleanup callbacks fire and try to removeChild nodes that are no longer
 * children of anything — crashing React's error recovery loop with a
 * "NotFoundError: removeChild" that propagates all the way up the fiber tree.
 *
 * This hook owns its own <video> and <canvas> via React refs.  All DOM
 * interactions go through those refs, so React is always the owner of the
 * underlying nodes.  QR decoding is delegated to jsQR — a pure function that
 * receives raw pixel data and returns a result; it never touches the DOM.
 *
 * Lifecycle:
 *   start()  → getUserMedia → attach stream to videoRef → begin rAF loop
 *   stop()   → cancel rAF → stop all tracks → nullify srcObject
 *   unmount  → stop() (safe to call even when already stopped)
 */

import { useRef, useState, useCallback, useEffect } from "react";
import jsQR from "jsqr";

interface UseQrScannerOptions {
  /** Called once per successfully decoded frame. The scanner loop pauses after
   *  firing; call start() again to resume scanning. */
  onScan: (text: string) => void;
  fps?: number;
}

interface UseQrScannerReturn {
  /** Ref to attach to the <video> element. */
  videoRef: React.RefObject<HTMLVideoElement>;
  /** Ref to attach to the hidden <canvas> element used for frame capture. */
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isScanning: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

export function useQrScanner({
  onScan,
  fps = 10,
}: UseQrScannerOptions): UseQrScannerReturn {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isRunningRef = useRef(false);
  // Keep a stable ref to the latest onScan so the rAF loop doesn't go stale.
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const frameIntervalMs = 1000 / fps;
  const lastFrameTimeRef = useRef(0);

  const tick = useCallback(
    (timestamp: number) => {
      if (!isRunningRef.current) return;

      // Throttle to the requested fps.
      if (timestamp - lastFrameTimeRef.current < frameIntervalMs) {
        animFrameRef.current = requestAnimationFrame(tick);
        return;
      }
      lastFrameTimeRef.current = timestamp;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < video.HAVE_ENOUGH_DATA) {
        animFrameRef.current = requestAnimationFrame(tick);
        return;
      }

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        animFrameRef.current = requestAnimationFrame(tick);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });

      if (code?.data) {
        // Pause the loop before firing the callback so we don't scan the same
        // QR multiple times while the caller is processing the result.
        isRunningRef.current = false;
        setIsScanning(false);
        onScanRef.current(code.data);
        return;
      }

      animFrameRef.current = requestAnimationFrame(tick);
    },
    [frameIntervalMs],
  );

  const stop = useCallback(() => {
    isRunningRef.current = false;
    if (animFrameRef.current != null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  }, []);

  const start = useCallback(async () => {
    // Idempotent — if already running, do nothing.
    if (isRunningRef.current) return;
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) {
        // Component was unmounted between the async call and here.
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      video.srcObject = stream;
      await video.play();

      isRunningRef.current = true;
      setIsScanning(true);
      lastFrameTimeRef.current = 0;
      animFrameRef.current = requestAnimationFrame(tick);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Could not access camera. Check permissions or use manual input.";
      setError(msg);
      setIsScanning(false);
    }
  }, [tick]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      // Inline cleanup to avoid stale closure — we read refs, not state.
      isRunningRef.current = false;
      if (animFrameRef.current != null) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      // Do NOT set videoRef.current.srcObject = null here — the <video>
      // element is already being unmounted by React and touching it would
      // trigger the exact removeChild issue we are replacing html5-qrcode to
      // avoid.
    };
  }, []); // intentionally empty — runs once on mount/unmount only

  return { videoRef, canvasRef, isScanning, error, start, stop };
}
