class SimpleSubtitleDisplay {
  constructor() {
    this.textBox = null;
    this.currentVideo = null;
    this.lastLoggedWindow = null;
    this.subtitles = [];
    this.subtitlesEnabled = true;
    this.currentSubtitle = null;
    this.currentSite = this.detectSite();
    this.init();
  }

  async init() {
    this.createTextBox();
    this.setupMessageListener();
    await this.loadStoredSubtitles();
    this.detectVideos();

    // 兼容延迟初始化和站点内部替换 video 节点
    setTimeout(() => this.detectVideos(), 1000);
    setTimeout(() => this.detectVideos(), 3000);
    setTimeout(() => this.detectVideos(), 5000);
    setTimeout(() => this.detectVideos(), 8000);
    setTimeout(() => this.detectVideos(), 12000);

    this.setupVideoObserver();
    this.setupClickObserver();
  }

  detectSite() {
    const hostname = window.location.hostname.toLowerCase();
    if (hostname.includes('pornhub')) return 'pornhub';
    if (hostname.includes('youtube')) return 'youtube';
    if (hostname.includes('bilibili')) return 'bilibili';
    return 'general';
  }

  createTextBox() {
    const existing = document.getElementById('srt-text-box');
    if (existing) {
      this.textBox = existing;
      return;
    }

    this.textBox = document.createElement('div');
    this.textBox.id = 'srt-text-box';
    this.textBox.style.cssText = `
      position: fixed !important;
      left: 50% !important;
      bottom: 56px !important;
      transform: translateX(-50%) !important;
      background: rgba(0, 0, 0, 0.72) !important;
      color: #ffffff !important;
      padding: 10px 18px !important;
      border-radius: 8px !important;
      font-size: 22px !important;
      line-height: 1.4 !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif !important;
      font-weight: 600 !important;
      text-align: center !important;
      white-space: pre-wrap !important;
      max-width: min(80vw, 960px) !important;
      width: max-content !important;
      z-index: 2147483647 !important;
      display: none !important;
      pointer-events: none !important;
      box-sizing: border-box !important;
      text-shadow:
        -1px -1px 0 #000,
        1px -1px 0 #000,
        -1px 1px 0 #000,
        1px 1px 0 #000,
        0 2px 4px rgba(0, 0, 0, 0.95) !important;
    `;

    (document.body || document.documentElement).appendChild(this.textBox);
  }

  getVideoSelectors() {
    const selectors = [
      'video',
      'video[src]',
      '[class*="video"] video',
      '[id*="video"] video',
      '[class*="player"] video',
      '[id*="player"] video'
    ];

    if (this.currentSite === 'pornhub') {
      selectors.push(
        '[class*="mgp_videoWrapper"] video',
        '[class*="player-wrapper"] video',
        '[class*="videoWrapper"] video',
        '[class*="video-wrapper"] video',
        '[data-video-id] video',
        '.mgp_videoWrapper video',
        '.player-wrapper video',
        '.videoWrapper video',
        '#mgp_videoWrapper video',
        '#player video',
        '.mgp video',
        '[class*="mgp"] video',
        'div[class*="video"] video',
        'div[id*="video"] video'
      );
    }

    return selectors;
  }

  getVisibleArea(video) {
    const rect = video.getBoundingClientRect();
    return rect.width * rect.height;
  }

  isCandidateVideo(video) {
    if (!(video instanceof HTMLVideoElement) || !video.isConnected) {
      return false;
    }

    const rect = video.getBoundingClientRect();
    const visible = rect.width > 0 && rect.height > 0;
    const hasSource = Boolean(video.src || video.currentSrc || video.querySelector('source'));
    const hasData = video.readyState > 0 || Number.isFinite(video.duration);
    return visible || hasSource || hasData;
  }

  detectVideos() {
    const candidates = [];

    for (const selector of this.getVideoSelectors()) {
      try {
        const videos = document.querySelectorAll(selector);
        for (const video of videos) {
          if (this.isCandidateVideo(video) && !candidates.includes(video)) {
            candidates.push(video);
          }
        }
      } catch (_error) {
      }
    }

    this.detectInShadowDOM(candidates);

    const bestVideo = candidates.sort((a, b) => this.getVisibleArea(b) - this.getVisibleArea(a))[0];
    if (bestVideo) {
      this.setupVideoHandlers(bestVideo);
      return;
    }

    if (this.textBox && !this.currentVideo) {
      this.textBox.style.display = 'none';
    }
  }

  detectInShadowDOM(candidates) {
    const elements = document.querySelectorAll('*');
    for (const element of elements) {
      if (!element.shadowRoot) continue;
      const shadowVideos = element.shadowRoot.querySelectorAll('video');
      for (const video of shadowVideos) {
        if (this.isCandidateVideo(video) && !candidates.includes(video)) {
          candidates.push(video);
        }
      }
    }
  }

  setupVideoHandlers(video) {
    if (this.currentVideo === video && video.dataset.srtProcessed === 'true') {
      return;
    }

    this.currentVideo = video;

    if (video.dataset.srtProcessed === 'true') {
      return;
    }
    video.dataset.srtProcessed = 'true';

    const update = () => this.updateSubtitleDisplay(video.currentTime);

    video.addEventListener('timeupdate', update);
    video.addEventListener('seeked', update);
    video.addEventListener('play', update);
    video.addEventListener('pause', update);
    video.addEventListener('loadedmetadata', update);
  }

  setupVideoObserver() {
    const observer = new MutationObserver((mutations) => {
      let shouldDetect = false;

      for (const mutation of mutations) {
        if (mutation.type !== 'childList') continue;
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          if (
            node.tagName === 'VIDEO' ||
            (node.querySelector && node.querySelector('video')) ||
            (typeof node.className === 'string' &&
              (node.className.includes('video') ||
                node.className.includes('player') ||
                node.className.includes('mgp')))
          ) {
            shouldDetect = true;
            break;
          }
        }
        if (shouldDetect) break;
      }

      if (shouldDetect) {
        setTimeout(() => this.detectVideos(), 100);
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  setupClickObserver() {
    document.addEventListener('click', () => {
      if (!this.currentVideo) {
        setTimeout(() => this.detectVideos(), 500);
        setTimeout(() => this.detectVideos(), 2000);
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && !this.currentVideo) {
        setTimeout(() => this.detectVideos(), 1000);
      }
    });
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      switch (message.action) {
        case 'getVideoInfo':
          sendResponse(this.getVideoInfo());
          return true;
        case 'loadSubtitles':
          this.loadStoredSubtitles()
            .then(() => {
              this.detectVideos();
              this.updateSubtitleDisplay(this.currentVideo?.currentTime || 0);
              sendResponse({ success: true });
            })
            .catch((error) => sendResponse({ success: false, error: error.message }));
          return true;
        case 'toggleSubtitles':
          this.subtitlesEnabled = message.enabled !== false;
          this.updateTextBoxVisibility();
          sendResponse({ success: true });
          return true;
        default:
          return false;
      }
    });
  }

  getVideoInfo() {
    const visibleVideos = Array.from(document.querySelectorAll('video')).filter((video) => {
      const rect = video.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });

    return {
      hasVideo: this.currentVideo !== null || visibleVideos.length > 0,
      videoCount: Math.max(visibleVideos.length, this.currentVideo ? 1 : 0),
      currentVideo: Boolean(this.currentVideo)
    };
  }

  async loadStoredSubtitles() {
    const result = await chrome.storage.local.get(['subtitles', 'subtitlesEnabled']);
    this.subtitles = result.subtitles ? window.SRTParser.parse(result.subtitles) : [];
    this.subtitlesEnabled = result.subtitlesEnabled !== false;
    this.updateTextBoxVisibility();
  }

  updateSubtitleDisplay(currentTime) {
    if (!this.textBox) {
      return;
    }

    if (!this.subtitlesEnabled || this.subtitles.length === 0) {
      this.textBox.textContent = '';
      this.textBox.style.display = 'none';
      this.currentSubtitle = null;
      return;
    }

    const currentSubtitle = window.SRTParser.findCurrentSubtitle(this.subtitles, currentTime);
    if (!currentSubtitle) {
      this.textBox.textContent = '';
      this.textBox.style.display = 'none';
      this.currentSubtitle = null;
      return;
    }

    if (this.currentSubtitle !== currentSubtitle) {
      this.currentSubtitle = currentSubtitle;
      this.textBox.textContent = currentSubtitle.text;
    }

    this.textBox.style.display = 'block';
  }

  updateTextBoxVisibility() {
    if (!this.textBox) {
      return;
    }

    if (!this.subtitlesEnabled) {
      this.textBox.style.display = 'none';
      return;
    }

    if (this.currentSubtitle) {
      this.textBox.style.display = 'block';
    }
  }
}

new SimpleSubtitleDisplay();
