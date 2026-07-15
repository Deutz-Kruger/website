import type Hls from "hls.js";

const HLS_MIME_TYPE = "application/vnd.apple.mpegurl";

const canPlayNativeHls = (videoElement: HTMLVideoElement) =>
  Boolean(videoElement.canPlayType(HLS_MIME_TYPE));

const shouldUseNativeIosHls = (videoElement: HTMLVideoElement) => {
  if (!canPlayNativeHls(videoElement)) return false;

  const userAgent = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(userAgent) ||
    (userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1)
  );
};

interface HlsPlayerOptions {
  onFatalError?: (error: unknown) => void;
}

/**
 * Lazily attaches a native or HLS.js-backed stream to a video element.
 */
export class HlsPlayer {
  private readonly abortController = new AbortController();
  private hls: Hls | null = null;
  private startPromise: Promise<void> | null = null;

  constructor(
    private readonly videoElement: HTMLVideoElement,
    private readonly manifestUrl: string,
    private readonly options: HlsPlayerOptions = {},
  ) {}

  start(): Promise<void> {
    if (!this.startPromise) {
      const startPromise = this.attachStream().catch((error: unknown) => {
        this.hls?.destroy();
        this.hls = null;
        this.clearMedia();

        if (this.startPromise === startPromise) {
          this.startPromise = null;
        }

        throw error;
      });

      this.startPromise = startPromise;
    }

    return this.startPromise;
  }

  destroy(): void {
    this.abortController.abort();
    this.hls?.destroy();
    this.hls = null;
    this.startPromise = null;

    this.clearMedia();
  }

  private clearMedia(): void {
    this.videoElement.pause();
    this.videoElement.removeAttribute("src");
    this.videoElement.load();
  }

  private async attachStream(): Promise<void> {
    const { signal } = this.abortController;

    if (signal.aborted) return;

    if (shouldUseNativeIosHls(this.videoElement)) {
      this.videoElement.src = this.manifestUrl;
      return;
    }

    const { default: HlsConstructor } = await import("hls.js/light");

    if (signal.aborted) return;

    if (!HlsConstructor.isSupported()) {
      if (canPlayNativeHls(this.videoElement)) {
        this.videoElement.src = this.manifestUrl;
        return;
      }

      throw new Error("HLS playback is not supported by this browser");
    }

    const hls = new HlsConstructor({
      maxBufferSize: 4 * 1000 * 1000,
      maxBufferLength: 4,
      maxMaxBufferLength: 8,
      enableWorker: false,
    });

    if (signal.aborted) {
      hls.destroy();
      return;
    }

    this.hls = hls;
    hls.on(HlsConstructor.Events.ERROR, (_event, data) => {
      if (!data.fatal) return;

      hls.stopLoad();
      hls.destroy();

      if (this.hls === hls) {
        this.hls = null;
        this.startPromise = null;
      }

      this.clearMedia();
      this.options.onFatalError?.(data);
    });
    hls.loadSource(this.manifestUrl);
    hls.attachMedia(this.videoElement);
  }
}
