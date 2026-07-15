import {
  shouldLoadMotionVideo,
  subscribeToReducedMotion,
} from "@/utils/motion";

import { HlsPlayer } from "./hls-player";

const PRELOAD_MARGIN = "300px 0px";

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
  private connectionVersion = 0;
  private hlsPlayer: HlsPlayer | null = null;
  private isVisible = false;
  private motionPreferenceInitialized = false;
  private preloadObserver: IntersectionObserver | null = null;
  private prefersReducedMotion = false;
  private unsubscribeFromReducedMotion: (() => void) | null = null;
  private visibilityObserver: IntersectionObserver | null = null;
  private readonly videoElement: HTMLVideoElement;

  static get observedAttributes() {
    return ["width", "height", "poster"];
  }

  constructor() {
    super();

    const shadow = this.attachShadow({ mode: "open" });
    this.videoElement = document.createElement("video");

    shadow.appendChild(this.videoElement);
    shadow.adoptedStyleSheets = [sheet];
    this.updatePoster();
  }

  connectedCallback() {
    this.connectionVersion += 1;
    this.updateAspectRatio();
    this.updatePlaybackAttributes();
    this.updatePoster();
    this.videoElement.addEventListener("canplay", this.handleCanPlay);
    this.unsubscribeFromReducedMotion = subscribeToReducedMotion(
      this.handleMotionPreferenceChange,
    );
  }

  disconnectedCallback() {
    this.connectionVersion += 1;
    this.unsubscribeFromReducedMotion?.();
    this.videoElement.removeEventListener("canplay", this.handleCanPlay);
    this.teardownIntersectionObservers();
    this.destroyPlayer();

    this.isVisible = false;
    this.motionPreferenceInitialized = false;
    this.unsubscribeFromReducedMotion = null;
  }

  attributeChangedCallback(name: string) {
    if (name === "width" || name === "height") {
      this.updateAspectRatio();
    }
    if (name === "poster") {
      this.updatePoster();
    }
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
    if (this.isConnected) {
      console.warn("Unable to start HLS video.", error);
    }
  };

  private updateAspectRatio() {
    const width = this.getAttribute("width");
    const height = this.getAttribute("height");

    if (width && height) {
      this.style.aspectRatio = `${width} / ${height}`;
    }
  }

  private updatePlaybackAttributes() {
    this.videoElement.loop =
      !this.prefersReducedMotion && this.hasAttribute("loop");
    this.videoElement.muted = this.hasAttribute("muted");
    this.videoElement.playsInline = this.hasAttribute("playsinline");
  }

  private updatePoster() {
    const poster = this.getAttribute("poster");
    if (poster) {
      this.videoElement.poster = poster;
    }
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
    this.videoElement.pause();
    this.hlsPlayer?.destroy();
    this.hlsPlayer = null;
  }
}

if (!customElements.get("hls-video")) {
  customElements.define("hls-video", HlsVideoElement);
}
