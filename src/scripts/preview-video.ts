import { HlsPlayer } from "./hls-player";

const PRELOAD_MARGIN = "300px 0px";

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host {
    display: block;
  }
  .frame {
    position: relative;
    width: 100%;
    aspect-ratio: var(--preview-aspect-ratio);
  }
  .baseline-spacer {
    height: 0.4375rem;
  }
  video {
    position: absolute;
    inset: 0 auto auto 0;
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: var(--preview-aspect-ratio);
    object-fit: contain;
  }
`);

class PreviewVideoElement extends HTMLElement {
  private connectionVersion = 0;
  private hlsPlayer: HlsPlayer | null = null;
  private hasPlayed = false;
  private isMobile = false;
  private parentLink: HTMLElement | null = null;
  private playbackPromise: Promise<void> | null = null;
  private preloadObserver: IntersectionObserver | null = null;
  private visibilityObserver: IntersectionObserver | null = null;
  private readonly videoElement: HTMLVideoElement;

  static get observedAttributes() {
    return ["src", "poster"];
  }

  constructor() {
    super();

    const shadow = this.attachShadow({ mode: "open" });
    this.videoElement = document.createElement("video");
    this.videoElement.muted = true;
    this.videoElement.playsInline = true;
    this.videoElement.loop = false;
    this.videoElement.controls = false;
    this.videoElement.preload = "metadata";

    const frame = document.createElement("div");
    const baselineSpacer = document.createElement("div");
    frame.className = "frame";
    baselineSpacer.className = "baseline-spacer";
    frame.appendChild(this.videoElement);
    shadow.append(frame, baselineSpacer);
    shadow.adoptedStyleSheets = [sheet];
    this.updatePoster();
  }

  connectedCallback() {
    this.connectionVersion += 1;
    this.hasPlayed = false;
    this.videoElement.loop = false;
    this.updateMobileState();
    this.updatePoster();

    window.addEventListener("resize", this.updateMobileState);
    this.setupHoverInteraction();
    this.setupIntersectionObservers();
  }

  disconnectedCallback() {
    this.connectionVersion += 1;
    window.removeEventListener("resize", this.updateMobileState);

    this.parentLink?.removeEventListener("mouseenter", this.handleMouseEnter);
    this.parentLink?.removeEventListener("mouseleave", this.handleMouseLeave);

    this.preloadObserver?.disconnect();
    this.visibilityObserver?.disconnect();
    this.hlsPlayer?.destroy();

    this.hlsPlayer = null;
    this.parentLink = null;
    this.playbackPromise = null;
    this.preloadObserver = null;
    this.visibilityObserver = null;
    this.hasPlayed = false;
  }

  attributeChangedCallback(name: string) {
    if (name === "poster") {
      this.updatePoster();
    }
  }

  private readonly updateMobileState = () => {
    this.isMobile = window.matchMedia("(width < 1024px)").matches;
  };

  private readonly handleMouseEnter = () => {
    if (this.isMobile) return;

    this.videoElement.loop = this.hasPlayed;
    void this.playVideo().catch(this.handlePlayerError);
  };

  private readonly handleMouseLeave = () => {
    if (!this.isMobile) {
      this.videoElement.loop = false;
    }
  };

  private readonly handlePlayerError = (error: unknown) => {
    if (this.isConnected) {
      console.warn("Unable to start preview video.", error);
    }
  };

  private updatePoster() {
    const poster = this.getAttribute("poster");
    if (poster) {
      this.videoElement.poster = poster;
    }
  }

  private ensurePlayer(): Promise<void> {
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
    await this.ensurePlayer();

    if (this.connectionVersion !== connectionVersion || !this.isConnected) {
      return;
    }
    await this.videoElement.play();
  }

  private setupHoverInteraction() {
    this.parentLink = this.closest("a");
    this.parentLink?.addEventListener("mouseenter", this.handleMouseEnter);
    this.parentLink?.addEventListener("mouseleave", this.handleMouseLeave);
  }

  private setupIntersectionObservers() {
    const connectionVersion = this.connectionVersion;

    if (!("IntersectionObserver" in window)) {
      if (this.isMobile) {
        void this.playVideo().catch(this.handlePlayerError);
      } else {
        void this.ensurePlayer().catch((error: unknown) => {
          if (this.connectionVersion === connectionVersion) {
            this.handlePlayerError(error);
          }
        });
      }
      return;
    }

    this.preloadObserver = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;

        void this.ensurePlayer()
          .then(() => {
            if (
              this.connectionVersion !== connectionVersion ||
              !this.isConnected
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
        if (this.connectionVersion !== connectionVersion) return;

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
}

if (!customElements.get("preview-video")) {
  customElements.define("preview-video", PreviewVideoElement);
}
