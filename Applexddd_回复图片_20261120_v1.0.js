(() => {
  'use strict';

  const font = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Segoe UI", "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  const bodyFont = `24px ${font}`;
  const words = new Intl.Segmenter('zh-CN', { granularity: 'word' });
  const graphemes = new Intl.Segmenter('zh-CN', { granularity: 'grapheme' });

  async function create(text, dark) {
    const width = 688;
    const inset = 44;
    const lineWidth = width - inset * 2;
    const firstLine = 135;
    const lineHeight = 38;
    const colors = dark
      ? { bg: '#111111', paper: '#1c1c1c', ink: '#f2f2f2', muted: '#b5b5b5', line: '#3b3b3b' }
      : { bg: '#f7f7f7', paper: '#ffffff', ink: '#191919', muted: '#5e5e5e', line: '#dedede' };

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = bodyFont;
    const lines = [];
    for (const paragraph of text.replaceAll('\t', '    ').split(/\r\n?|[\n\u2028\u2029]/u)) {
      let line = '';
      for (const { segment } of words.segment(paragraph)) {
        if (context.measureText(line + segment).width <= lineWidth) {
          line += segment;
          continue;
        }
        if (line) lines.push(line);
        line = segment;
        if (context.measureText(segment).width <= lineWidth) continue;

        line = '';
        for (const { segment: character } of graphemes.segment(segment)) {
          if (line && context.measureText(line + character).width > lineWidth) {
            lines.push(line);
            line = '';
          }
          line += character;
        }
      }
      lines.push(line);
    }

    const height = firstLine + lines.length * lineHeight + 16;
    // Scale the complete reply within a conservative iOS canvas size.
    const scale = Math.min(2, 4096 / height);
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.round(height * scale);
    context.fillStyle = colors.bg;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.scale(canvas.width / width, canvas.height / height);

    context.beginPath();
    context.roundRect(14, 14, width - 28, height - 28, 22);
    context.fillStyle = colors.paper;
    context.fill();
    context.strokeStyle = colors.line;
    context.stroke();

    context.beginPath();
    context.roundRect(inset, 34, 42, 42, 11);
    context.fillStyle = colors.ink;
    context.fill();
    context.save();
    context.translate(inset + 5, 39);
    context.scale(2 / 3, 2 / 3);
    context.strokeStyle = colors.paper;
    context.lineWidth = 2.85;
    context.lineCap = context.lineJoin = 'round';
    for (const path of document.querySelectorAll('#mj-icon-assistant path')) {
      context.stroke(new Path2D(path.getAttribute('d')));
    }
    context.restore();

    context.textBaseline = 'middle';
    context.fillStyle = colors.ink;
    context.font = `700 24px ${font}`;
    const labelX = inset + 54;
    context.fillText('小P', labelX, 55);
    const labelWidth = context.measureText('小P').width;
    context.fillStyle = colors.muted;
    context.font = `500 17px ${font}`;
    context.fillText('MingJun', labelX + labelWidth + 13, 55);

    context.fillStyle = colors.line;
    context.fillRect(inset, 98, lineWidth, 1);
    context.fillStyle = colors.ink;
    context.font = bodyFont;
    lines.forEach((line, index) => {
      context.fillText(line, inset, firstLine + index * lineHeight, lineWidth);
    });

    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        canvas.width = canvas.height = 0;
        if (blob) resolve(blob);
        else reject(new Error('无法生成 PNG 图片。'));
      }, 'image/png');
    });
  }

  window.ReplyImage = { create };
})();
