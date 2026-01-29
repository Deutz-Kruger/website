import type HlsType from "hls.js";

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

class HlsVideo extends HTMLElement {
  private hls: HlsType | null = null;
  private videoElement: HTMLVideoElement;

  static get observedAttributes() {
    return ["width", "height", "poster"];
  }

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: "open" });

    this.videoElement = document.createElement("video");

    shadow.appendChild(this.videoElement);
    shadow.adoptedStyleSheets = [sheet];

    this.videoElement.autoplay = this.hasAttribute("autoplay");
    this.videoElement.loop = this.hasAttribute("loop");
    this.videoElement.muted = this.hasAttribute("muted");
    this.videoElement.playsInline = this.hasAttribute("playsinline");
    this.updatePoster();
  }

  private updateAspectRatio() {
    const width = this.getAttribute("width");
    const height = this.getAttribute("height");

    if (width && height) {
      this.style.aspectRatio = `${width} / ${height}`;
    }
  }

  private updatePoster() {
    const poster = this.getAttribute("poster");
    if (poster) {
      this.videoElement.poster = poster;
    }
  }

  async connectedCallback() {
    const manifestUrl = this.getAttribute("src");

    this.updateAspectRatio();
    this.updatePoster();

    if (!manifestUrl) return;

    if (this.videoElement.canPlayType("application/vnd.apple.mpegurl")) {
      this.videoElement.src = manifestUrl;
      this.videoElement.addEventListener(
        "canplay",
        () => {
          this.videoElement.play();
        },
        { once: true },
      );
    } else {
      const { default: Hls } = await import("hls.js");
      if (Hls.isSupported()) {
        this.hls = new Hls({
          maxBufferSize: 1 * 1000 * 1000,
          maxBufferLength: 1,
          maxMaxBufferLength: 2,
          enableWorker: false,
          lowLatencyMode: true,
        });
        this.hls.loadSource(manifestUrl);
        this.hls.attachMedia(this.videoElement);
        this.videoElement.addEventListener(
          "canplay",
          () => {
            this.videoElement.play();
          },
          { once: true },
        );
      }
    }
  }
  disconnectedCallback() {
    this.hls?.destroy();
  }

  attributeChangedCallback(name: string) {
    if (name === "width" || name === "height") {
      this.updateAspectRatio();
    }
    if (name === "poster") {
      this.updatePoster();
    }
  }
}

if (!customElements.get("hls-video")) {
  customElements.define("hls-video", HlsVideo);
}
