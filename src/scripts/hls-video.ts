import {
  shouldLoadMotionVideo,
  subscribeToReducedMotion,
} from "@/utils/motion";

import { HlsPlayer } from "./hls-player";
import { onNextPresentedVideoFrame } from "./video-frame";

const PRELOAD_MARGIN = "100px 0px";

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host { display: block; }
  video {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  :host([has-background="true"]) video {
    border-radius: 0.625rem;
  }
`);

class HlsVideoElement extends HTMLElement {
  private cancelPendingReveal: (() => void) | null = null;
  private connectionVersion = 0;
  private hlsPlayer: HlsPlayer | null = null;
  private isVisible = false;
  private motionPreferenceInitialized = false;
  private preloadObserver: IntersectionObserver | null = null;
  private prefersReducedMotion = false;
  private unsubscribeFromReducedMotion: (() => void) | null = null;
  private visibilityObserver: IntersectionObserver | null = null;
  private readonly videoElement: HTMLVideoElement;

  constructor() {
    super();

    const shadow = this.attachShadow({ mode: "open" });
    this.videoElement = document.createElement("video");
    this.videoElement.setAttribute("aria-hidden", "true");
    this.videoElement.controls = false;
    this.videoElement.preload = "none";

    shadow.appendChild(this.videoElement);
    shadow.adoptedStyleSheets = [sheet];
  }

  connectedCallback() {
    this.connectionVersion += 1;
    this.updatePlaybackAttributes();
    this.videoElement.addEventListener("canplay", this.handleCanPlay);
    this.videoElement.addEventListener("playing", this.handlePlaying);
    this.unsubscribeFromReducedMotion = subscribeToReducedMotion(
      this.handleMotionPreferenceChange,
    );
  }

  disconnectedCallback() {
    this.connectionVersion += 1;
    this.unsubscribeFromReducedMotion?.();
    this.videoElement.removeEventListener("canplay", this.handleCanPlay);
    this.videoElement.removeEventListener("playing", this.handlePlaying);
    this.teardownIntersectionObservers();
    this.destroyPlayer();

    this.isVisible = false;
    this.motionPreferenceInitialized = false;
    this.unsubscribeFromReducedMotion = null;
  }

  private readonly handleCanPlay = () => {
    if (
      !this.prefersReducedMotion &&
      this.isVisible &&
      this.hasAttribute("autoplay")
    ) {
      this.playVideo();
    }
  };

  private readonly handlePlaying = () => {
    if (this.hasAttribute("data-playing")) return;

    this.cancelPendingReveal?.();
    const connectionVersion = this.connectionVersion;
    this.cancelPendingReveal = onNextPresentedVideoFrame(
      this.videoElement,
      () => {
        this.cancelPendingReveal = null;
        if (
          this.connectionVersion === connectionVersion &&
          this.isConnected &&
          !this.prefersReducedMotion
        ) {
          this.setAttribute("data-playing", "");
        }
      },
    );
  };

  private readonly handleMotionPreferenceChange = (
    prefersReducedMotion: boolean,
  ) => {
    if (
      this.motionPreferenceInitialized &&
      this.prefersReducedMotion === prefersReducedMotion
    ) {
      return;
    }

    if (this.motionPreferenceInitialized) {
      this.connectionVersion += 1;
    }

    this.motionPreferenceInitialized = true;
    this.prefersReducedMotion = prefersReducedMotion;
    this.updatePlaybackAttributes();
    this.teardownIntersectionObservers();

    if (prefersReducedMotion) {
      this.isVisible = false;
      this.destroyPlayer();
      return;
    }

    this.setupIntersectionObservers();
  };

  private readonly handlePlayerError = (error: unknown) => {
    this.cancelPendingReveal?.();
    this.cancelPendingReveal = null;
    this.removeAttribute("data-playing");
    if (this.isConnected) {
      console.warn("Unable to start HLS video.", error);
    }
  };

  private updatePlaybackAttributes() {
    this.videoElement.loop =
      !this.prefersReducedMotion && this.hasAttribute("loop");
    this.videoElement.muted = this.hasAttribute("muted");
    this.videoElement.playsInline = this.hasAttribute("playsinline");
  }

  private ensurePlayer(): Promise<void> {
    if (!shouldLoadMotionVideo(this.prefersReducedMotion)) {
      return Promise.resolve();
    }

    if (!this.hlsPlayer) {
      const manifestUrl = this.getAttribute("src");
      if (!manifestUrl) return Promise.resolve();

      const connectionVersion = this.connectionVersion;
      const player = new HlsPlayer(this.videoElement, manifestUrl, {
        onFatalError: (error) => {
          if (
            this.connectionVersion === connectionVersion &&
            this.hlsPlayer === player
          ) {
            this.hlsPlayer = null;
          }
          if (this.connectionVersion === connectionVersion) {
            this.handlePlayerError(error);
          }
        },
      });
      this.hlsPlayer = player;
    }

    return this.hlsPlayer.start();
  }

  private playVideo() {
    if (this.prefersReducedMotion) return;
    void this.videoElement.play().catch(() => undefined);
  }

  private prepareAndPlay() {
    if (this.prefersReducedMotion) return;

    const connectionVersion = this.connectionVersion;
    void this.ensurePlayer()
      .then(() => {
        if (
          this.connectionVersion === connectionVersion &&
          this.isConnected &&
          !this.prefersReducedMotion &&
          this.isVisible &&
          this.videoElement.readyState >= 3
        ) {
          this.playVideo();
        }
      })
      .catch((error: unknown) => {
        if (this.connectionVersion === connectionVersion) {
          this.handlePlayerError(error);
        }
      });
  }

  private setupIntersectionObservers() {
    if (this.prefersReducedMotion) return;

    const connectionVersion = this.connectionVersion;

    if (!("IntersectionObserver" in window)) {
      this.isVisible = true;
      this.prepareAndPlay();
      return;
    }

    this.preloadObserver = new IntersectionObserver(
      (entries) => {
        if (this.prefersReducedMotion) return;
        if (!entries.some((entry) => entry.isIntersecting)) return;

        void this.ensurePlayer()
          .then(() => {
            if (
              this.connectionVersion !== connectionVersion ||
              !this.isConnected ||
              this.prefersReducedMotion
            ) {
              return;
            }

            this.preloadObserver?.disconnect();
            this.preloadObserver = null;
          })
          .catch((error: unknown) => {
            if (this.connectionVersion === connectionVersion) {
              this.handlePlayerError(error);
            }
          });
      },
      { rootMargin: PRELOAD_MARGIN },
    );

    this.visibilityObserver = new IntersectionObserver((entries) => {
      if (
        this.connectionVersion !== connectionVersion ||
        this.prefersReducedMotion
      ) {
        return;
      }

      this.isVisible = entries.some((entry) => entry.isIntersecting);

      if (this.isVisible) {
        this.prepareAndPlay();
      } else {
        this.videoElement.pause();
      }
    });

    this.preloadObserver.observe(this);
    this.visibilityObserver.observe(this);
  }

  private teardownIntersectionObservers() {
    this.preloadObserver?.disconnect();
    this.visibilityObserver?.disconnect();
    this.preloadObserver = null;
    this.visibilityObserver = null;
  }

  private destroyPlayer() {
    this.cancelPendingReveal?.();
    this.cancelPendingReveal = null;
    this.videoElement.pause();
    this.hlsPlayer?.destroy();
    this.hlsPlayer = null;
    this.removeAttribute("data-playing");
  }
}

if (!customElements.get("hls-video")) {
  customElements.define("hls-video", HlsVideoElement);
}
