class SRTParser {
  static parse(srtContent) {
    const subtitles = [];
    const normalized = srtContent.replace(/\r\n/g, '\n').trim();
    if (!normalized) {
      return subtitles;
    }

    const blocks = normalized.split(/\n{2,}/);
    
    for (const block of blocks) {
      const lines = block.trim().split('\n');
      if (lines.length < 3) continue;
      
      const index = parseInt(lines[0]);
      const timeRange = lines[1];
      const text = lines.slice(2).join('\n');
      
      const timeMatch = timeRange.match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);
      if (!timeMatch) continue;
      
      const startTime = this.parseTime(timeMatch[1]);
      const endTime = this.parseTime(timeMatch[2]);
      
      subtitles.push({
        index,
        startTime,
        endTime,
        text: text.trim()
      });
    }
    
    return subtitles;
  }
  
  static parseTime(timeString) {
    const parts = timeString.split(':');
    const hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);
    const secondsAndMs = parts[2].split(',');
    const seconds = parseInt(secondsAndMs[0]);
    const milliseconds = parseInt(secondsAndMs[1]);
    
    return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
  }
  
  static findCurrentSubtitle(subtitles, currentTime) {
    return subtitles.find(subtitle => 
      currentTime >= subtitle.startTime && currentTime <= subtitle.endTime
    );
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SRTParser;
} else if (typeof window !== 'undefined') {
  window.SRTParser = SRTParser;
}
