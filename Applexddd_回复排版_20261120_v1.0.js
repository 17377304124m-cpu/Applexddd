(() => {
  'use strict';

  const fence = /^ {0,3}(`{3,}|~{3,})(.*)$/;
  const rule = /^ {0,3}(?:(?:-[ \t]*){3,}|(?:\*[ \t]*){3,}|(?:_[ \t]*){3,})$/;
  const heading = /^ {0,3}(#{1,6})(?:[ \t]+|$)(.*)$/;
  const item = /^([ \t]*)(?:[-+*]|(\d{1,9})[.)])[ \t]+(\S.*)$/;

  function blocks(text) {
    const result = [];
    const lines = text.split(/\r\n?|[\n\u2028\u2029]/u);
    let lists = [];

    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      const match = rule.test(line) ? null : line.match(item);
      if (match) {
        const [, indent, number, content] = match;
        const width = indent.replaceAll('\t', '    ').length;
        const ordered = number !== undefined;
        while (lists.length && lists.at(-1).width > width) lists.pop();
        let list = lists.at(-1);
        if (!list || list.width !== width || list.ordered !== ordered) {
          if (list?.width === width) lists.pop();
          const parent = lists.at(-1)?.items.at(-1);
          list = { tag: ordered ? 'ol' : 'ul', ordered, width, start: Number(number ?? 1), items: [] };
          (parent ? parent.lists : result).push(list);
          lists.push(list);
        }
        list.items.push({ content, lists: [] });
        continue;
      }

      lists = [];
      if (!line.trim()) continue;

      const opening = line.match(fence);
      if (opening && (opening[1][0] === '~' || !opening[2].includes('`'))) {
        const marker = opening[1];
        const closing = new RegExp(`^ {0,3}${marker[0]}{${marker.length},}[ \\t]*$`);
        const code = [];
        while (++index < lines.length && !closing.test(lines[index])) code.push(lines[index]);
        result.push({ tag: 'pre', content: code.join('\n') });
        continue;
      }

      if (rule.test(line)) {
        result.push({ tag: 'hr' });
        continue;
      }

      const title = line.match(heading);
      if (title) {
        result.push({ tag: `h${title[1].length}`, content: title[2].replace(/[ \t]+#+[ \t]*$/, '') });
        continue;
      }

      const previous = result.at(-1);
      if (previous?.tag === 'p' && lines[index - 1]?.trim()) {
        previous.content += `\n${line}`;
      } else {
        result.push({ tag: 'p', content: line });
      }
    }

    return result;
  }

  const inlinePattern = new RegExp([
    /\\(?<escaped>[\\`*_[\]{}()#+.!<>-])/.source,
    /(?<!`)(?<ticks>`+)(?<code>.+?)\k<ticks>(?!`)/.source,
    /(?<image>!)?\[(?<label>[^\[\]\n]+)\]\((?<url><[^\s<>]+>|[^()\s]*(?:\([^()\s]*\)[^()\s]*)*)(?:[ \t]+(?:"[^"\n]*"|'[^'\n]*'))?\)/.source,
    /<(?<autolink>https?:\/\/[^\s<>]+)>/.source,
    /(?<html><\/?[a-z][^<>\n]*>)/.source,
    /(?<marker>(?<!\*)\*{1,3}|(?<![\p{L}\p{N}_])_{1,3})(?<emphasis>[^\s*_](?:(?!\k<marker>).)*?)(?<!\s)\k<marker>(?![*_])/u.source
  ].join('|'), 'giu');

  function inline(text, doc, allowLink = true) {
    const parts = [];
    let position = 0;
    for (const match of text.matchAll(inlinePattern)) {
      parts.push(text.slice(position, match.index));
      const { escaped, code, image, label, url, autolink, html, marker, emphasis } = match.groups;
      if (marker) {
        let children = inline(emphasis, doc, allowLink);
        if (marker.length % 2) children = [node('em', children)];
        if (marker.length > 1) children = [node('strong', children)];
        parts.push(...children);
      } else if (code !== undefined) {
        const literal = /^ .+ $/.test(code) && code.trim() ? code.slice(1, -1) : code;
        parts.push(node('code', [literal]));
      } else if (label !== undefined || autolink) {
        const children = autolink ? [autolink] : inline(label, doc, false);
        const destination = autolink || url.replace(/^<|>$/g, '');
        let href;
        if (allowLink && !image && /^https?:\/\//i.test(destination)) {
          try {
            href = new URL(destination).href;
          } catch {
            // Leave invalid URLs as text.
          }
        }
        if (href && doc) {
          const link = node('a', children);
          link.href = href;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          parts.push(link);
        } else {
          parts.push(...children);
          if (href && !autolink && destination !== children.join('')) parts.push(` (${destination})`);
        }
      } else {
        parts.push(escaped ?? html);
      }
      position = match.index + match[0].length;
    }
    parts.push(text.slice(position));
    return parts;

    function node(tag, children) {
      if (!doc) return children.join('');
      const element = doc.createElement(tag);
      element.append(...children);
      return element;
    }
  }

  function render(element, text) {
    const doc = element.ownerDocument;
    const fragment = doc.createDocumentFragment();
    for (const block of blocks(text)) fragment.append(renderBlock(block, doc));
    element.replaceChildren(fragment);
  }

  function renderBlock(block, doc) {
    const element = doc.createElement(block.tag);
    if (block.items) {
      if (block.ordered && block.start !== 1) element.start = block.start;
      for (const { content, lists } of block.items) {
        const li = doc.createElement('li');
        li.append(...inline(content, doc));
        for (const list of lists) li.append(renderBlock(list, doc));
        element.append(li);
      }
    } else if (block.tag === 'pre') {
      const code = doc.createElement('code');
      code.textContent = block.content;
      element.append(code);
    } else if (block.tag !== 'hr') {
      element.append(...inline(block.content, doc));
    }
    return element;
  }

  function plainBlock(block, indent = '') {
    if (block.items) {
      return block.items.map(({ content, lists }, index) => {
        const marker = block.ordered ? `${block.start + index}.` : '•';
        const line = `${indent}${marker} ${inline(content).join('')}`;
        return [line, ...lists.map(list => plainBlock(list, indent + '  '))].join('\n');
      }).join('\n');
    }
    return block.tag === 'pre' ? block.content : inline(block.content).join('');
  }

  function plainText(text) {
    return blocks(text).filter(block => block.tag !== 'hr').map(block => plainBlock(block)).join('\n\n');
  }

  window.ChatMarkup = { render, plainText };
})();
