(() => {
  'use strict';

  const incomplete = 'DeepSeek 回复中断，请重试。';
  const invalid = 'DeepSeek 返回的响应格式异常，请重试。';

  function getChoices(data) {
    if (data?.error) throw new Error('DeepSeek 生成回复失败，请重试。');
    if (!Array.isArray(data?.choices)) throw new Error(invalid);
    return data.choices;
  }

  function hasFinished(reason) {
    switch (reason) {
      case undefined:
      case null:
        return false;
      case 'stop':
        return true;
      case 'length':
        throw new Error('DeepSeek 回复达到长度上限，请缩短问题后重试。');
      case 'content_filter':
        throw new Error('DeepSeek 无法回复这条消息，请调整问题后重试。');
      case 'tool_calls':
        throw new Error('DeepSeek 请求调用工具，未生成完整回复。');
      case 'aborted':
      case 'insufficient_system_resource':
        throw new Error(incomplete);
      default:
        throw new Error(invalid);
    }
  }

  function requireAnswer(answer) {
    if (typeof answer !== 'string' || !answer.trim()) throw new Error('DeepSeek 未返回文本，请重试。');
    return answer;
  }

  async function read(response, onDelta) {
    const type = response.headers?.get('content-type')?.split(';')[0].trim().toLowerCase();
    if (type !== 'text/event-stream') {
      const choices = getChoices(await response.json().catch(() => null));
      const choice = choices.find(item => item?.index === 0) || choices.find(item => item && item.index === undefined);
      hasFinished(choice?.finish_reason);
      const { content, reasoning_content: reasoning } = choice?.message || {};
      const answer = requireAnswer(content);
      if (typeof reasoning === 'string' && reasoning) onDelta({ content: '', reasoning });
      onDelta({ content: answer, reasoning: '' });
      return answer;
    }

    if (!response.body) throw new Error(incomplete);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const newline = /\r\n|[\r\n]/g;
    const data = [];
    let buffer = '';
    let answer = '';

    function consume(text, done) {
      buffer += text;
      newline.lastIndex = 0;
      let start = 0;
      let ending;
      while ((ending = newline.exec(buffer))) {
        // Keep a trailing carriage return until we know whether a line feed follows it.
        if (!done && ending[0] === '\r' && newline.lastIndex === buffer.length) break;
        const line = buffer.slice(start, ending.index);
        start = newline.lastIndex;

        if (line === '') {
          const payload = data.join('\n');
          data.length = 0;
          if (!payload.trim()) continue;
          if (payload.trim() === '[DONE]') return true;
          let parsed;
          try {
            parsed = JSON.parse(payload);
          } catch {
            throw new Error(invalid);
          }
          const choice = getChoices(parsed).find(item => item?.index === 0);
          const finished = hasFinished(choice?.finish_reason);
          const content = typeof choice?.delta?.content === 'string' ? choice.delta.content : '';
          const reasoning = typeof choice?.delta?.reasoning_content === 'string' ? choice.delta.reasoning_content : '';
          if (content || reasoning) {
            answer += content;
            onDelta({ content, reasoning });
          }
          if (finished) return true;
        } else if (line.startsWith('data:')) {
          data.push(line.slice(5).replace(/^ /, ''));
        } else if (line === 'data') {
          data.push('');
        }
      }
      buffer = buffer.slice(start);
      return false;
    }

    try {
      for (;;) {
        const { value, done } = await reader.read().catch(error => {
          throw new Error(error?.name === 'TimeoutError' ? 'DeepSeek 响应超时，请重试。' : incomplete);
        });
        if (consume(decoder.decode(value, { stream: !done }), done)) return requireAnswer(answer);
        if (done) throw new Error(incomplete);
      }
    } finally {
      void reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }

  globalThis.DeepSeekStream = { read };
})();
