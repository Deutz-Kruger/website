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
  private hlsPlayer: HlsPlayer | null = null;
  private hasPlayed = false;
  private hoverContainer: HTMLElement | null = null;
  private isMobile = false;
  private parentLink: HTMLElement | null = null;
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
    this.hasPlayed = false;
    this.videoElement.loop = false;
    this.updateMobileState();
    this.updatePoster();

    window.addEventListener("resize", this.updateMobileState);
    this.setupHoverInteraction();
    this.setupIntersectionObservers();
  }

  disconnectedCallback() {
    window.removeEventListener("resize", this.updateMobileState);

    this.parentLink?.removeEventListener(
      "mouseenter",
      this.handleInitialMouseEnter,
    );
    this.hoverContainer?.removeEventListener(
      "mouseenter",
      this.handleRepeatMouseEnter,
    );
    this.hoverContainer?.removeEventListener(
      "mouseleave",
      this.handleMouseLeave,
    );
    this.videoElement.removeEventListener("canplay", this.handleCanPlay);

    this.preloadObserver?.disconnect();
    this.visibilityObserver?.disconnect();
    this.hlsPlayer?.destroy();

    this.hlsPlayer = null;
    this.hoverContainer = null;
    this.parentLink = null;
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
    this.isMobile = window.innerWidth <= 1024;
  };

  private readonly handleInitialMouseEnter = () => {
    if (!this.isMobile && !this.hasPlayed) {
      this.playVideo();
    }
  };

  private readonly handleRepeatMouseEnter = () => {
    if (!this.isMobile && this.hasPlayed) {
      this.videoElement.loop = true;
      this.playVideoElement();
    }
  };

  private readonly handleMouseLeave = () => {
    if (!this.isMobile) {
      this.videoElement.loop = false;
    }
  };

  private readonly handleCanPlay = () => {
    this.playVideoElement();
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

      this.hlsPlayer = new HlsPlayer(this.videoElement, manifestUrl);
    }

    return this.hlsPlayer.start();
  }

  private playVideo() {
    if (this.hasPlayed) return;

    this.hasPlayed = true;
    void this.startPlayback();
  }

  private async startPlayback() {
    await this.ensurePlayer();

    if (!this.isConnected || !this.hasPlayed) return;

    if (this.videoElement.readyState >= 3) {
      this.playVideoElement();
      return;
    }

    this.videoElement.addEventListener("canplay", this.handleCanPlay, {
      once: true,
    });
  }

  private playVideoElement() {
    void this.videoElement.play().catch(() => undefined);
  }

  private setupHoverInteraction() {
    this.parentLink = this.closest("a");
    this.hoverContainer = this.parentElement;

    this.parentLink?.addEventListener(
      "mouseenter",
      this.handleInitialMouseEnter,
    );
    this.hoverContainer?.addEventListener(
      "mouseenter",
      this.handleRepeatMouseEnter,
    );
    this.hoverContainer?.addEventListener("mouseleave", this.handleMouseLeave);
  }

  private setupIntersectionObservers() {
    if (!("IntersectionObserver" in window)) {
      void this.ensurePlayer();
      return;
    }

    this.preloadObserver = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;

        void this.ensurePlayer();
        this.preloadObserver?.disconnect();
        this.preloadObserver = null;
      },
      { rootMargin: PRELOAD_MARGIN },
    );

    this.visibilityObserver = new IntersectionObserver(
      (entries) => {
        const isFullyVisible = entries.some(
          (entry) => entry.isIntersecting && entry.intersectionRatio >= 1,
        );

        if (this.isMobile && isFullyVisible && !this.hasPlayed) {
          this.playVideo();
          this.visibilityObserver?.disconnect();
          this.visibilityObserver = null;
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
