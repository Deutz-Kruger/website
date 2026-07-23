import {
  shouldLoadMotionVideo,
  subscribeToReducedMotion,
} from "@/utils/motion";

import { HlsPlayer } from "./hls-player";
import { onNextPresentedVideoFrame } from "./video-frame";

const PRELOAD_MARGIN = "100px 0px";

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host {
    display: block;
  }
  video {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
`);

class PreviewVideoElement extends HTMLElement {
  private cancelPendingReveal: (() => void) | null = null;
  private connectionVersion = 0;
  private hlsPlayer: HlsPlayer | null = null;
  private hasPlayed = false;
  private isMobile = false;
  private motionPreferenceInitialized = false;
  private parentLink: HTMLElement | null = null;
  private playbackPromise: Promise<void> | null = null;
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
    this.videoElement.muted = true;
    this.videoElement.playsInline = true;
    this.videoElement.loop = false;
    this.videoElement.controls = false;
    this.videoElement.preload = "none";

    shadow.appendChild(this.videoElement);
    shadow.adoptedStyleSheets = [sheet];
  }

  connectedCallback() {
    this.connectionVersion += 1;
    this.hasPlayed = false;
    this.videoElement.loop = false;
    this.updateMobileState();
    this.videoElement.addEventListener("playing", this.handlePlaying);

    window.addEventListener("resize", this.updateMobileState);
    this.unsubscribeFromReducedMotion = subscribeToReducedMotion(
      this.handleMotionPreferenceChange,
    );
  }

  disconnectedCallback() {
    this.connectionVersion += 1;
    this.unsubscribeFromReducedMotion?.();
    window.removeEventListener("resize", this.updateMobileState);
    this.videoElement.removeEventListener("playing", this.handlePlaying);
    this.teardownHoverInteraction();
    this.teardownIntersectionObservers();
    this.destroyPlayer();

    this.hasPlayed = false;
    this.motionPreferenceInitialized = false;
    this.unsubscribeFromReducedMotion = null;
  }

  private readonly updateMobileState = () => {
    const isMobile = window.matchMedia("(width < 1024px)").matches;
    if (this.isMobile === isMobile) return;

    this.isMobile = isMobile;
    if (this.motionPreferenceInitialized && !this.prefersReducedMotion) {
      this.teardownIntersectionObservers();
      this.setupIntersectionObservers();
    }
  };

  private readonly handleMouseEnter = () => {
    if (this.isMobile || this.prefersReducedMotion) return;

    this.videoElement.loop = this.hasPlayed;
    void this.playVideo().catch(this.handlePlayerError);
  };

  private readonly handleMouseLeave = () => {
    if (!this.isMobile && !this.prefersReducedMotion) {
      this.videoElement.loop = false;
    }
  };

  private readonly handleFocusIn = () => {
    if (this.isMobile || this.prefersReducedMotion) return;

    this.videoElement.loop = this.hasPlayed;
    void this.playVideo().catch(this.handlePlayerError);
  };

  private readonly handleFocusOut = () => {
    if (!this.isMobile && !this.prefersReducedMotion) {
      this.videoElement.loop = false;
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
    this.teardownHoverInteraction();
    this.teardownIntersectionObservers();

    if (prefersReducedMotion) {
      this.hasPlayed = false;
      this.videoElement.loop = false;
      this.destroyPlayer();
      return;
    }

    this.setupHoverInteraction();
    this.setupIntersectionObservers();
  };

  private readonly handlePlayerError = (error: unknown) => {
    this.cancelPendingReveal?.();
    this.cancelPendingReveal = null;
    this.removeAttribute("data-playing");
    if (this.isConnected) {
      console.warn("Unable to start preview video.", error);
    }
  };

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
            this.hasPlayed = false;
            this.videoElement.loop = false;
            this.handlePlayerError(error);
          }
        },
      });
      this.hlsPlayer = player;
    }

    return this.hlsPlayer.start();
  }

  private playVideo(): Promise<void> {
    if (this.prefersReducedMotion) return Promise.resolve();

    if (!this.playbackPromise) {
      const connectionVersion = this.connectionVersion;
      const playbackPromise = this.startPlayback(connectionVersion)
        .then(() => {
          if (this.connectionVersion === connectionVersion) {
            this.hasPlayed = true;
          }
        })
        .catch((error: unknown) => {
          if (this.connectionVersion !== connectionVersion) return;

          this.hasPlayed = false;
          this.videoElement.loop = false;
          throw error;
        })
        .finally(() => {
          if (this.playbackPromise === playbackPromise) {
            this.playbackPromise = null;
          }
        });

      this.playbackPromise = playbackPromise;
    }

    return this.playbackPromise;
  }

  private async startPlayback(connectionVersion: number): Promise<void> {
    if (this.prefersReducedMotion) return;

    await this.ensurePlayer();

    if (
      this.connectionVersion !== connectionVersion ||
      !this.isConnected ||
      this.prefersReducedMotion
    ) {
      return;
    }
    await this.videoElement.play();
  }

  private setupHoverInteraction() {
    if (this.prefersReducedMotion || this.parentLink) return;

    this.parentLink = this.closest("a");
    this.parentLink?.addEventListener("mouseenter", this.handleMouseEnter);
    this.parentLink?.addEventListener("mouseleave", this.handleMouseLeave);
    this.parentLink?.addEventListener("focusin", this.handleFocusIn);
    this.parentLink?.addEventListener("focusout", this.handleFocusOut);
  }

  private setupIntersectionObservers() {
    if (this.prefersReducedMotion || !this.isMobile) return;

    const connectionVersion = this.connectionVersion;

    if (!("IntersectionObserver" in window)) {
      void this.playVideo().catch(this.handlePlayerError);
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

    this.visibilityObserver = new IntersectionObserver(
      (entries) => {
        if (
          this.connectionVersion !== connectionVersion ||
          this.prefersReducedMotion
        ) {
          return;
        }

        const isFullyVisible = entries.some(
          (entry) => entry.isIntersecting && entry.intersectionRatio >= 1,
        );

        if (this.isMobile && isFullyVisible && !this.hasPlayed) {
          void this.playVideo().catch(this.handlePlayerError);
        }
      },
      { threshold: 1 },
    );

    this.preloadObserver.observe(this);
    this.visibilityObserver.observe(this);
  }

  private teardownHoverInteraction() {
    this.parentLink?.removeEventListener("mouseenter", this.handleMouseEnter);
    this.parentLink?.removeEventListener("mouseleave", this.handleMouseLeave);
    this.parentLink?.removeEventListener("focusin", this.handleFocusIn);
    this.parentLink?.removeEventListener("focusout", this.handleFocusOut);
    this.parentLink = null;
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
    this.playbackPromise = null;
    this.removeAttribute("data-playing");
  }
}

if (!customElements.get("preview-video")) {
  customElements.define("preview-video", PreviewVideoElement);
}
