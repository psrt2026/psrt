class PopupManager {
  constructor() {
    this.setupElements();
    this.setupEventListeners();
    this.initialize();
  }

  setupElements() {
    this.subtitleToggle = document.getElementById('subtitleToggle');
    this.fileInputArea = document.getElementById('fileInputArea');
    this.fileInput = document.getElementById('fileInput');
    this.fileMeta = document.getElementById('fileMeta');
    this.videoInfo = document.getElementById('videoInfo');
    this.status = document.getElementById('status');
  }

  setupEventListeners() {
    this.subtitleToggle.addEventListener('click', () => this.toggleSubtitles());
    this.fileInputArea.addEventListener('click', () => this.fileInput.click());
    this.fileInput.addEventListener('change', (event) => {
      const [file] = event.target.files;
      if (file) {
        this.importSubtitleFile(file);
      }
    });

    this.fileInputArea.addEventListener('dragover', (event) => {
      event.preventDefault();
      this.fileInputArea.classList.add('dragover');
    });

    this.fileInputArea.addEventListener('dragleave', () => {
      this.fileInputArea.classList.remove('dragover');
    });

    this.fileInputArea.addEventListener('drop', (event) => {
      event.preventDefault();
      this.fileInputArea.classList.remove('dragover');
      const [file] = event.dataTransfer.files;
      if (file) {
        this.importSubtitleFile(file);
      }
    });
  }

  async initialize() {
    await Promise.all([
      this.loadSettings(),
      this.refreshVideoInfo()
    ]);
  }

  async loadSettings() {
    const result = await chrome.storage.local.get([
      'subtitlesEnabled',
      'subtitleFileName',
      'subtitles'
    ]);

    const enabled = result.subtitlesEnabled !== false;
    this.subtitleToggle.classList.toggle('active', enabled);

    if (result.subtitleFileName && result.subtitles) {
      this.fileMeta.textContent = `已加载: ${result.subtitleFileName}`;
    }
  }

  async refreshVideoInfo() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        this.videoInfo.textContent = '无法读取当前标签页。';
        return;
      }

      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getVideoInfo' });
      if (response?.hasVideo) {
        this.videoInfo.textContent = `检测到 ${response.videoCount} 个视频元素。`;
      } else {
        this.videoInfo.textContent = '当前页面没有检测到 HTML5 视频。';
      }
    } catch (error) {
      this.videoInfo.textContent = '当前页面暂不可注入脚本或没有可访问的视频。';
    }
  }

  async toggleSubtitles() {
    const enabled = !this.subtitleToggle.classList.contains('active');
    this.subtitleToggle.classList.toggle('active', enabled);
    await chrome.storage.local.set({ subtitlesEnabled: enabled });
    await this.notifyActiveTab({ action: 'toggleSubtitles', enabled });
    this.showStatus(enabled ? '字幕显示已启用' : '字幕显示已关闭', 'success');
  }

  async importSubtitleFile(file) {
    if (!file.name.toLowerCase().endsWith('.srt')) {
      this.showStatus('只支持 .srt 字幕文件', 'error');
      return;
    }

    try {
      const content = await this.readFile(file);
      if (!window.SRTParser) {
        throw new Error('字幕解析器未加载');
      }

      const parsed = window.SRTParser.parse(content);

      if (!parsed.length) {
        throw new Error('未解析到有效字幕条目');
      }

      await chrome.storage.local.set({
        subtitles: content,
        subtitlesEnabled: true,
        subtitleFileName: file.name
      });

      this.subtitleToggle.classList.add('active');
      this.fileMeta.textContent = `已加载: ${file.name}`;
      await this.notifyActiveTab({ action: 'loadSubtitles' });
      this.showStatus(`已加载 ${parsed.length} 条字幕`, 'success');
      this.fileInput.value = '';
    } catch (error) {
      this.showStatus(`导入失败: ${error.message}`, 'error');
    }
  }

  async notifyActiveTab(message) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await chrome.tabs.sendMessage(tab.id, message);
      }
    } catch (error) {
      this.showStatus('字幕已保存，刷新页面后会自动生效。', 'info');
    }
  }

  readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsText(file, 'UTF-8');
    });
  }

  showStatus(message, type) {
    this.status.textContent = message;
    this.status.className = `status ${type}`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});
