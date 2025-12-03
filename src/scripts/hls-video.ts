import Hls from "hls.js";

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host { display: block; }
  video { width: 100%; height: 100%; }
  :host([has-background="true"]) video {
    border-radius: 0.625rem;
  }
  `);

class HlsVideo extends HTMLElement {
  private hls: Hls;
  private videoElement: HTMLVideoElement;

  static get observedAttributes() {
    return ["width", "height"];
  }

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: "open" });

    this.hls = new Hls({
      maxBufferSize: 10 * 1000 * 1000,
      maxBufferLength: 30,
      maxMaxBufferLength: 60,
      enableWorker: true,
      lowLatencyMode: false,
    });
    this.videoElement = document.createElement("video");

    shadow.appendChild(this.videoElement);
    shadow.adoptedStyleSheets = [sheet];

    this.videoElement.autoplay = this.hasAttribute("autoplay");
    this.videoElement.loop = this.hasAttribute("loop");
    this.videoElement.muted = this.hasAttribute("muted");
    this.videoElement.playsInline = this.hasAttribute("playsinline");
  }

  private updateAspectRatio() {
    const width = this.getAttribute("width");
    const height = this.getAttribute("height");

    if (width && height) {
      this.style.aspectRatio = `${width} / ${height}`;
    }
  }

  connectedCallback() {
    const manifestUrl = this.getAttribute("src");

    this.updateAspectRatio();

    if (manifestUrl && Hls.isSupported()) {
      this.hls.loadSource(manifestUrl);
      this.hls.attachMedia(this.videoElement);
    }
  }

  disconnectedCallback() {
    this.hls.destroy();
  }

  attributeChangedCallback(name: string) {
    if (name === "width" || name === "height") {
      this.updateAspectRatio();
    }
  }
}

if (!customElements.get("hls-video")) {
  customElements.define("hls-video", HlsVideo);
}
