(() => {
  'use strict';

  function start() {
    const task = document.getElementById('page-task');
    const config = document.getElementById('mingjun-config');
    const memory = document.getElementById('mingjun-memory');
    if (!task || !config || !memory) return;

    const memoryLimit = 20000;
    const messageLimit = 32768;
    const requestLimit = 512 * 1024;
    const encoder = new TextEncoder();
    const endpoint = 'https://api.deepseek.com/chat/completions';
    const profilesKey = 'mingjunDeepSeekProfiles';
    const profileKey = 'mingjunDeepSeekSelectedProfile';
    const models = [
      { id: 'deepseek-flash', label: 'Flash' },
      { id: 'deepseek-v4-pro', label: 'V4 Pro' }
    ];
    const apiKeys = new Map();
    const pending = new Map();
    const replyThoughts = new Map();
    const failures = new Map();
    let activeId = null;
    let selectedId = readPreference(profileKey);
    let profiles = readProfiles();
    let editingId = null;

    task.innerHTML = `
      <section class="p-workspace" aria-labelledby="p-chat-title">
        <header class="p-chat-header">
          <button type="button" class="p-icon-btn" id="p-open-history" aria-label="打开对话历史" aria-haspopup="dialog" aria-controls="p-chat-history" title="对话历史"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#mj-icon-sidebar"></use></svg></button>
          <div class="p-chat-heading">
            <h1 id="p-chat-title">MingJun</h1>
          </div>
        </header>
        <div class="p-chat-scroll">
          <section class="p-welcome" aria-labelledby="p-welcome-title">
            <div class="p-mark" aria-hidden="true"><svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><use href="#mj-icon-assistant"></use></svg></div>
            <h2 id="p-welcome-title">今天想做什么？</h2>
            <p>聊聊手头的事，从一个问题开始。</p>
            <div class="p-starters" aria-label="对话示例">
              <button type="button" data-p-prompt="帮我把今天要做的事排个先后。">安排今天</button>
              <button type="button" data-p-prompt="帮我梳理一下这段想法：">梳理想法</button>
            </div>
          </section>
          <div class="p-messages" role="log" aria-label="对话消息" aria-relevant="additions"></div>
          <div class="p-turn" hidden>
            <p class="p-turn-status" role="status"></p>
            <button type="button" class="p-text-btn" id="p-retry" hidden>重试</button>
            <button type="button" class="p-text-btn" id="p-turn-config" data-open-config hidden>配置模型</button>
          </div>
        </div>
        <footer class="p-composer">
          <button type="button" class="p-icon-btn p-latest" aria-label="跳到最新消息" title="跳到最新消息" hidden><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#mj-icon-down"></use></svg></button>
          <p class="p-composer-status" role="status"></p>
          <div class="p-model-controls">
            <div class="p-model-picker" hidden>
              <button type="button" id="p-active-model" aria-label="切换模型" aria-haspopup="menu" aria-expanded="false" aria-controls="p-model-menu">
                <span class="p-model-chip"><span class="p-model-current"></span><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6"/></svg></span>
              </button>
              <div id="p-model-menu" class="p-model-menu" role="menu" aria-label="选择模型" hidden></div>
            </div>
            <button type="button" class="p-model-link" data-open-config aria-label="配置模型" title="配置模型">
              <span>配置模型</span>
              <svg class="p-model-arrow" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#mj-icon-next"></use></svg>
              <svg class="p-model-settings" viewBox="0 0 24 24" aria-hidden="true" focusable="false" hidden><use href="#mj-icon-settings"></use></svg>
            </button>
          </div>
          <form id="p-message-form" class="p-message-form">
            <textarea id="p-message" aria-label="输入消息" rows="1" maxlength="${messageLimit}" placeholder="输入消息…" enterkeyhint="send" required></textarea>
            <button type="submit" class="p-icon-btn p-send" aria-label="发送消息" title="发送消息"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#mj-icon-up"></use></svg></button>
          </form>
        </footer>
      </section>
      <dialog class="p-history" id="p-chat-history" aria-labelledby="p-history-title">
        <div class="p-history-inner">
          <header>
            <h2 id="p-history-title" tabindex="-1" autofocus>对话历史</h2>
          </header>
          <button type="button" class="p-secondary p-history-new">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#mj-icon-new-chat"></use></svg>新对话
          </button>
          <div class="p-history-list"></div>
          <p class="p-history-status life-feedback" role="status"></p>
        </div>
        <div class="p-history-edge" aria-hidden="true"></div>
      </dialog>
      <dialog class="life-dialog p-image-preview" id="p-image-preview" aria-labelledby="p-image-title">
        <div class="life-dialog-body">
          <header class="life-dialog-header">
            <h2 id="p-image-title" tabindex="-1" autofocus>回复图片</h2>
            <button type="button" class="p-icon-btn" id="p-close-image" aria-label="关闭图片预览"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#mj-icon-close"></use></svg></button>
          </header>
          <img alt="小P 回复图片">
          <div class="backup-actions">
            <a class="btn primary" download="MingJun-小P回复.png">保存图片</a>
          </div>
          <p class="life-hint">也可以长按图片复制或分享。</p>
        </div>
      </dialog>
    `;

    config.innerHTML = `
      <section class="p-panel" aria-labelledby="p-profiles-title">
        <div class="p-panel-header">
          <h2 id="p-profiles-title">DeepSeek 模型</h2>
          <button type="button" class="p-secondary" id="p-add-profile">添加方案</button>
        </div>
        <p class="p-hint">消息和记忆会直接发送到 DeepSeek。API Key 仅在当前页面使用，刷新后需重新填写。</p>
        <p class="p-hint" id="p-profiles-hint"></p>
        <div id="p-profiles" class="p-profile-list"></div>
        <form class="p-panel-form p-profile-form" id="p-profile-form" hidden>
          <h3 id="p-profile-title"></h3>
          <label for="p-profile-name">方案名称</label>
          <input type="text" id="p-profile-name" maxlength="80" required>
          <label for="p-profile-model">模型 ID</label>
          <input type="text" id="p-profile-model" maxlength="200" autocapitalize="off" spellcheck="false" required>
          <label for="p-profile-key">DeepSeek API Key</label>
          <input type="password" id="p-profile-key" maxlength="4096" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="p-profile-key-hint">
          <p class="p-hint" id="p-profile-key-hint"></p>
          <div class="p-form-actions">
            <button type="submit" class="p-primary">保存方案</button>
            <button type="button" class="p-secondary" id="p-cancel-profile">取消</button>
          </div>
        </form>
        <p id="p-profile-status" class="p-form-status" role="status"></p>
      </section>
    `;

    memory.innerHTML = `
      <section class="p-panel" aria-labelledby="p-memory-title">
        <h2 id="p-memory-title">对话记忆</h2>
        <p class="p-hint" id="p-memory-hint">记忆保存在此设备。发送消息时，小P 会使用最新保存的内容。</p>
        <form class="p-panel-form" id="p-memory-form">
          <label for="p-memory">记忆内容</label>
          <textarea id="p-memory" rows="10" maxlength="${memoryLimit}" spellcheck="false" aria-describedby="p-memory-hint" placeholder="例如：请用中文回答，称呼我为明军。"></textarea>
          <div class="p-memory-actions">
            <button type="submit" class="p-primary">保存记忆</button>
            <span class="p-hint" id="p-memory-size"></span>
          </div>
          <p id="p-memory-status" class="p-form-status" role="status"></p>
        </form>
      </section>
    `;

    const history = task.querySelector('.p-history');
    const historyButton = task.querySelector('#p-open-history');
    const historyList = task.querySelector('.p-history-list');
    const historyStatus = task.querySelector('.p-history-status');
    const newChat = task.querySelector('.p-history-new');
    const imagePreview = task.querySelector('#p-image-preview');
    const previewImage = imagePreview.querySelector('img');
    const saveImage = imagePreview.querySelector('a');
    const title = task.querySelector('#p-chat-title');
    const modelLink = task.querySelector('.p-model-link');
    const modelLabel = modelLink.querySelector('span');
    const modelArrow = modelLink.querySelector('.p-model-arrow');
    const modelSettings = modelLink.querySelector('.p-model-settings');
    const modelPicker = task.querySelector('.p-model-picker');
    const modelButton = task.querySelector('#p-active-model');
    const modelCurrent = task.querySelector('.p-model-current');
    const modelMenu = task.querySelector('#p-model-menu');
    const scroller = task.querySelector('.p-chat-scroll');
    const welcome = task.querySelector('.p-welcome');
    const messages = task.querySelector('.p-messages');
    const latest = task.querySelector('.p-latest');
    const turn = task.querySelector('.p-turn');
    const turnStatus = task.querySelector('.p-turn-status');
    const retry = task.querySelector('#p-retry');
    const turnConfig = task.querySelector('#p-turn-config');
    const composerStatus = task.querySelector('.p-composer-status');
    const messageForm = task.querySelector('#p-message-form');
    const messageInput = task.querySelector('#p-message');
    const send = task.querySelector('.p-send');
    const addProfile = config.querySelector('#p-add-profile');
    const profileHint = config.querySelector('#p-profiles-hint');
    const profileList = config.querySelector('#p-profiles');
    const profileForm = config.querySelector('#p-profile-form');
    const profileTitle = config.querySelector('#p-profile-title');
    const profileName = config.querySelector('#p-profile-name');
    const profileModel = config.querySelector('#p-profile-model');
    const profileSecret = config.querySelector('#p-profile-key');
    const profileKeyHint = config.querySelector('#p-profile-key-hint');
    const profileStatus = config.querySelector('#p-profile-status');
    const memoryInput = memory.querySelector('#p-memory');
    const memorySize = memory.querySelector('#p-memory-size');
    const memoryStatus = memory.querySelector('#p-memory-status');
    const dateFormat = new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' });
    const viewport = window.visualViewport;
    let restingHeight = viewport?.height || window.innerHeight;
    let restingWidth = window.innerWidth;
    let viewportFrame = 0;
    let followLatest = true;
    let previewUrl = '';

    function readPreference(key) {
      try {
        return localStorage.getItem(key) || '';
      } catch {
        return '';
      }
    }

    function readProfiles() {
      try {
        const stored = JSON.parse(readPreference(profilesKey));
        return Array.isArray(stored) ? stored
          .filter(item => typeof item?.id === 'string' && typeof item.name === 'string' && typeof item.model === 'string')
          .map(({ id, name, model }) => ({ id, name, model })) : [];
      } catch {
        return [];
      }
    }

    function rememberPreference(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch {
        // The connected session can still use the preference in memory.
      }
    }

    function readHistory() {
      try {
        const stored = JSON.parse(localStorage.getItem('chatHistory') || '[]');
        if (Array.isArray(stored)) {
          return stored.filter(chat => chat && typeof chat.id === 'string' &&
            typeof chat.title === 'string' && Array.isArray(chat.messages));
        }
      } catch {
        return [];
      }
      return [];
    }

    function readMemory() {
      try {
        const stored = JSON.parse(localStorage.getItem('memory'));
        return typeof stored === 'string' ? stored : '';
      } catch {
        return '';
      }
    }

    function saveHistory(chat, chats) {
      chat.updatedAt = new Date().toISOString();
      localStorage.setItem('chatHistory', JSON.stringify([
        chat, ...chats.filter(item => item.id !== chat.id)
      ]));
      if (history.open) renderHistory();
    }

    function status(node, value, error = false) {
      node.textContent = value;
      node.classList.toggle('p-error', error);
    }

    function showLatest() {
      scroller.scrollTop = scroller.scrollHeight;
      followLatest = true;
    }

    function updateScroller() {
      const distance = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
      latest.hidden = distance < 120;
      followLatest = distance < 24;
    }

    function syncKeyboardViewport() {
      viewportFrame = 0;
      const height = viewport?.height || window.innerHeight;
      const focused = document.activeElement === messageInput;
      const wasOpen = task.classList.contains('p-keyboard-open');
      if (restingWidth !== window.innerWidth) {
        restingWidth = window.innerWidth;
        restingHeight = Math.max(window.innerHeight, height);
      }
      const touchScreen = window.matchMedia('(any-pointer: coarse)').matches;
      const availableHeight = touchScreen ? Math.max(restingHeight, window.innerHeight) : window.innerHeight;
      const keyboardOpen = touchScreen && task.classList.contains('active') && (focused || wasOpen) &&
        Math.abs((viewport?.scale || 1) - 1) < 0.02 && availableHeight - height > 100;
      const shouldFollow = followLatest;
      task.classList.toggle('p-keyboard-open', keyboardOpen);
      if (keyboardOpen) {
        task.style.setProperty('--p-viewport-height', `${height}px`);
        task.style.setProperty('--p-viewport-top', `${viewport?.offsetTop || 0}px`);
      } else if (!focused) {
        restingHeight = height;
      }
      if (keyboardOpen || wasOpen) {
        if (shouldFollow) showLatest();
        updateScroller();
      }
    }

    function queueViewportSync() {
      if (!viewportFrame) viewportFrame = requestAnimationFrame(syncKeyboardViewport);
    }

    async function copyReplyImage(content, button) {
      const dark = document.documentElement.dataset.theme === 'dark';
      const png = Promise.resolve().then(() => ReplyImage.create(content, dark));
      try {
        if (navigator.clipboard?.write && window.ClipboardItem) {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
          status(composerStatus, '已复制回复图片');
          return;
        }
      } catch {
        // Safari can restrict clipboard writes in some embedded views.
      }
      try {
        const image = await png;
        if (!button.isConnected || !task.classList.contains('active')) return;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = URL.createObjectURL(image);
        previewImage.src = previewUrl;
        saveImage.href = previewUrl;
        button.focus({ preventScroll: true });
        if (!imagePreview.open) imagePreview.showModal();
      } catch {
        status(composerStatus, '无法生成回复图片，请重试。', true);
      }
    }

    function renderHistory() {
      const chats = readHistory();
      historyList.replaceChildren();
      if (!chats.length) {
        const empty = document.createElement('p');
        empty.className = 'p-hint';
        empty.textContent = '开始对话后，会在这里看到记录。';
        historyList.append(empty);
        return;
      }
      for (const chat of chats) {
        const row = document.createElement('div');
        row.className = 'p-history-row';
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'p-history-delete';
        remove.dataset.chatDelete = chat.id;
        remove.setAttribute('aria-label', `删除对话「${chat.title}」`);
        remove.textContent = '删除';
        remove.hidden = true;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'p-history-item';
        button.dataset.chatId = chat.id;
        button.setAttribute('aria-keyshortcuts', 'ArrowRight Delete');
        if (chat.id === activeId) button.setAttribute('aria-current', 'true');
        const name = document.createElement('span');
        name.textContent = chat.title;
        button.append(name);
        const date = new Date(chat.updatedAt);
        if (Number.isFinite(date.getTime())) {
          const time = document.createElement('time');
          time.dateTime = date.toISOString();
          time.textContent = dateFormat.format(date);
          button.append(time);
        }
        row.append(remove, button);
        historyList.append(row);
      }
    }

    function revealHistoryRow(row, opened) {
      const previous = historyList.querySelector('.p-history-row.is-revealed');
      if (previous && previous !== row) {
        previous.classList.remove('is-revealed');
        previous.querySelector('.p-history-delete').hidden = true;
      }
      row.classList.toggle('is-revealed', opened);
      row.querySelector('.p-history-delete').hidden = !opened;
    }

    function deleteHistoryChat(id) {
      const chat = readHistory().find(item => item.id === id);
      if (!chat || !window.confirm(`删除对话「${chat.title}」？`)) return;
      const chats = readHistory();
      const index = chats.findIndex(chat => chat.id === id);
      try {
        localStorage.setItem('chatHistory', JSON.stringify(chats.filter(chat => chat.id !== id)));
      } catch {
        status(historyStatus, '删除失败，请检查浏览器存储权限后重试。', true);
        return;
      }
      failures.delete(id);
      replyThoughts.delete(id);
      if (activeId === id) {
        activeId = null;
        messageInput.value = '';
        status(composerStatus, '');
        renderChat();
      }
      renderHistory();
      const buttons = historyList.querySelectorAll('.p-history-item');
      (buttons[Math.min(index, buttons.length - 1)] || newChat).focus({ preventScroll: true });
      status(historyStatus, '已删除对话。');
    }

    function selectedProfile() {
      return profiles.find(profile => profile.id === selectedId);
    }

    function renderModel(profile) {
      modelPicker.hidden = !profile;
      modelPicker.classList.toggle('is-connected', apiKeys.has(profile?.id));
      const label = models.find(model => model.id === profile?.model)?.label || profile?.model || '';
      modelCurrent.textContent = label;
      modelButton.setAttribute('aria-label', label ? `切换模型，当前为 ${label}` : '切换模型');
      if (!profile) closeModelMenu();
      modelLabel.hidden = Boolean(profile);
      modelArrow.toggleAttribute('hidden', Boolean(profile));
      modelSettings.toggleAttribute('hidden', !profile);
      modelLink.classList.toggle('is-settings', Boolean(profile));
    }

    function closeModelMenu(restoreFocus = false) {
      modelMenu.hidden = true;
      modelButton.setAttribute('aria-expanded', 'false');
      if (restoreFocus) modelButton.focus({ preventScroll: true });
    }

    function openModelMenu(direction = 0) {
      const profile = selectedProfile();
      if (!profile) return;
      const options = models.some(model => model.id === profile.model)
        ? models : [...models, { id: profile.model, label: profile.model }];
      modelMenu.replaceChildren(...options.map(({ id, label }) => {
        const option = document.createElement('button');
        option.type = 'button';
        option.tabIndex = -1;
        option.setAttribute('role', 'menuitemradio');
        option.setAttribute('aria-checked', String(profile.model === id));
        option.dataset.model = id;
        option.textContent = label;
        return option;
      }));
      modelMenu.hidden = false;
      modelButton.setAttribute('aria-expanded', 'true');
      const selected = direction < 0 ? modelMenu.lastElementChild
        : direction > 0 ? modelMenu.firstElementChild : modelMenu.querySelector('[aria-checked="true"]');
      selected?.focus({ preventScroll: true });
    }

    function updateSend() {
      const shouldFollow = followLatest;
      send.disabled = messageInput.disabled || !messageInput.value.trim();
      messageInput.style.height = 'auto';
      messageInput.style.height = `${Math.min(132, messageInput.scrollHeight)}px`;
      if (shouldFollow) showLatest();
    }

    function renderAssistant(content, reasoning = '', isStreaming = false) {
      const article = document.createElement('article');
      article.className = 'p-message p-assistant';
      article.setAttribute('aria-label', '小P');
      article.innerHTML = `
        <span class="p-response-avatar" aria-hidden="true"><svg viewBox="0 0 48 48" focusable="false"><use href="#mj-icon-assistant"></use></svg></span>
        <div class="p-response-bubble">
          <details class="p-reasoning" hidden>
            <summary>思考过程</summary>
            <div class="p-reasoning-text"></div>
          </details>
          <div class="p-message-text p-formatted" hidden></div>
        </div>`;
      const bubble = article.querySelector('.p-response-bubble');
      const thought = article.querySelector('.p-reasoning');
      const summary = thought.querySelector('summary');
      const thoughtText = article.querySelector('.p-reasoning-text');
      const answer = article.querySelector('.p-formatted');
      const update = (nextContent, nextReasoning) => {
        if (nextReasoning.trim()) {
          if (thought.hidden && isStreaming) thought.open = true;
          thought.hidden = false;
          summary.textContent = isStreaming && !nextContent.trim() ? '正在思考' : '思考过程';
          if (thoughtText.textContent !== nextReasoning) thoughtText.textContent = nextReasoning;
        }
        if (nextContent !== content || answer.hidden) {
          answer.hidden = !nextContent.trim();
          if (!answer.hidden) ChatMarkup.render(answer, nextContent);
          content = nextContent;
        }
      };
      update(content, reasoning);
      if (!isStreaming) {
        const actions = document.createElement('div');
        actions.className = 'p-message-actions';
        actions.innerHTML = `
          <button type="button" class="p-icon-btn p-copy" aria-label="复制回复文本" title="复制回复文本"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#mj-icon-copy"></use></svg></button>
          <button type="button" class="p-icon-btn p-share" aria-label="复制回复图片" title="复制回复图片"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#mj-icon-share"></use></svg></button>`;
        const [copy, share] = actions.querySelectorAll('button');
        copy.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(ChatMarkup.plainText(content));
            status(composerStatus, '已复制回复文本');
          } catch {
            status(composerStatus, '复制失败，请选中内容后复制。', true);
          }
        });
        share.addEventListener('click', () => void copyReplyImage(ChatMarkup.plainText(content), share));
        bubble.append(actions);
      }
      return { article, update };
    }

    function renderChat(scrollToLatest = false) {
      const chat = readHistory().find(item => item.id === activeId);
      const chatMessages = chat?.messages || [];
      const profile = selectedProfile();
      const ready = apiKeys.has(profile?.id);
      title.textContent = chat?.title || 'MingJun';
      renderModel(profile);
      welcome.hidden = chatMessages.length > 0;
      messages.replaceChildren();
      const thoughts = replyThoughts.get(activeId);
      for (const [index, entry] of chatMessages.entries()) {
        if (!entry || typeof entry.content !== 'string') continue;
        if (entry.role === 'assistant') {
          messages.append(renderAssistant(entry.content, thoughts?.get(index)).article);
          continue;
        }
        const article = document.createElement('article');
        article.className = 'p-message p-user';
        article.setAttribute('aria-label', '你');
        const content = document.createElement('p');
        content.className = 'p-message-text';
        content.textContent = entry.content;
        article.append(content);
        messages.append(article);
      }

      const awaiting = chatMessages.at(-1)?.role === 'user';
      const loading = awaiting && pending.get(activeId);
      if (loading) {
        loading.view = renderAssistant(loading.content, loading.reasoning, true);
        loading.view.article.hidden = !loading.content.trim() && !loading.reasoning.trim();
        messages.append(loading.view.article);
      }
      const failure = failures.get(activeId);
      turn.hidden = !awaiting;
      retry.hidden = !awaiting || loading || !ready;
      turnConfig.hidden = !awaiting || loading || ready;
      status(turnStatus, loading ? '小P 正在思考…' : (
        failure || (awaiting ? '这条消息还没有收到回复。' : '')
      ), Boolean(failure));
      messageInput.disabled = awaiting;
      updateSend();
      if (scrollToLatest) requestAnimationFrame(showLatest);
      requestAnimationFrame(updateScroller);
    }

    function selectChat(id) {
      activeId = id;
      messageInput.value = '';
      status(composerStatus, '');
      closeModelMenu();
      if (history.open) history.close();
      renderChat(true);
    }

    async function requestDeepSeek(body, apiKey, onDelta) {
      let response;
      try {
        response = await fetch(endpoint, {
          method: 'POST',
          body: JSON.stringify(body),
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          credentials: 'omit',
          cache: 'no-store',
          redirect: 'error',
          signal: AbortSignal.timeout(180000)
        });
      } catch (error) {
        throw new Error(error.name === 'TimeoutError'
          ? 'DeepSeek 响应超时，请重试。' : '无法连接 DeepSeek，请检查网络后重试。');
      }
      if (!response.ok) {
        await response.body?.cancel();
        const errors = {
          401: 'DeepSeek API Key 无效，请在配置中更新。',
          402: 'DeepSeek 账户余额不足。',
          403: 'DeepSeek 拒绝了请求，请检查 API Key 权限。',
          429: 'DeepSeek 请求过于频繁，请稍后重试。'
        };
        throw new Error(errors[response.status] || `DeepSeek 请求失败（HTTP ${response.status}）。`);
      }
      return DeepSeekStream.read(response, onDelta);
    }

    async function requestReply(chat) {
      const profile = selectedProfile();
      const apiKey = apiKeys.get(profile?.id);
      if (!apiKey || pending.has(chat.id)) return;
      const stream = { content: '', reasoning: '', view: null, frame: 0 };
      pending.set(chat.id, stream);
      failures.delete(chat.id);
      renderChat(true);
      try {
        const memoryText = readMemory();
        if (memoryText.length > memoryLimit) throw new Error('记忆超过长度限制，请在记忆库中调整后重试。');
        const recent = chat.messages.slice(-79)
          .filter(entry => entry && ['user', 'assistant'].includes(entry.role) && typeof entry.content === 'string')
          .map(({ role, content }) => ({ role, content: content.slice(0, messageLimit) }));
        const identity = '默认身份：你是小P，明军的个人助手。日常对话先直接回应问题，使用自然简洁的段落。需要分项时再用短清单，避免装饰性分隔线和重复自我介绍。';
        const instructions = memoryText.trim()
          ? `以下是用户保存的记忆和指令，在本应用内优先于默认身份及后续对话。\n\n${memoryText}\n\n${identity}`
          : identity;
        const body = {
          model: profile.model,
          thinking: { type: 'enabled' },
          stream: true,
          messages: [{ role: 'system', content: instructions }, ...recent]
        };
        while (body.messages.length > 2 && (
          body.messages[1].role !== 'user' || encoder.encode(JSON.stringify(body)).length > requestLimit
        )) {
          body.messages.splice(1, 1);
        }
        const content = await requestDeepSeek(body, apiKey, ({ content: delta, reasoning }) => {
          stream.content += delta;
          stream.reasoning += reasoning;
          if (stream.frame) return;
          stream.frame = requestAnimationFrame(() => {
            stream.frame = 0;
            if (activeId !== chat.id || !stream.view?.article.isConnected) return;
            const atLatest = followLatest;
            stream.view.update(stream.content, stream.reasoning);
            stream.view.article.hidden = !stream.content.trim() && !stream.reasoning.trim();
            const progress = stream.content.trim() ? '小P 正在回复…' : '小P 正在思考…';
            if (turnStatus.textContent !== progress) status(turnStatus, progress);
            if (atLatest) showLatest();
            updateScroller();
          });
        });
        const chats = readHistory();
        const latestChat = chats.find(item => item.id === chat.id);
        if (latestChat && JSON.stringify(latestChat.messages) === JSON.stringify(chat.messages)) {
          latestChat.messages.push({ role: 'assistant', content });
          saveHistory(latestChat, chats);
          if (stream.reasoning.trim()) {
            const thoughts = replyThoughts.get(chat.id) || new Map();
            thoughts.set(latestChat.messages.length - 1, stream.reasoning);
            replyThoughts.set(chat.id, thoughts);
          }
        }
      } catch (error) {
        failures.set(chat.id, error.message);
      } finally {
        cancelAnimationFrame(stream.frame);
        pending.delete(chat.id);
        if (activeId === chat.id) renderChat(followLatest);
      }
    }

    function setProfile(id) {
      rememberPreference(profileKey, id);
      selectedId = id;
      renderProfiles();
      renderChat();
    }

    function saveProfiles(next) {
      localStorage.setItem(profilesKey, JSON.stringify(next));
      profiles = next;
    }

    function renderProfiles() {
      profileList.replaceChildren();
      profileHint.textContent = profiles.length ? '' : '添加一个方案，即可开始使用小P。';
      for (const profile of profiles) {
        const hasKey = apiKeys.has(profile.id);
        const row = document.createElement('article');
        row.className = 'p-profile-row';
        const description = document.createElement('div');
        const name = document.createElement('h3');
        name.textContent = profile.name;
        const detail = document.createElement('p');
        detail.className = 'p-hint';
        detail.textContent = hasKey ? profile.model : `${profile.model} · 待填写 API Key`;
        description.append(name, detail);
        const actions = document.createElement('div');
        actions.className = 'p-profile-actions';
        const select = document.createElement('button');
        select.type = 'button';
        select.className = 'p-secondary';
        select.dataset.useProfile = profile.id;
        select.textContent = profile.id === selectedId && hasKey ? '正在使用' : '使用';
        select.disabled = profile.id === selectedId || !hasKey;
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'p-secondary';
        edit.dataset.editProfile = profile.id;
        edit.textContent = '编辑';
        actions.append(select, edit);
        row.append(description, actions);
        profileList.append(row);
      }
    }

    function showProfileForm(profile) {
      const hasKey = apiKeys.has(profile?.id);
      editingId = profile?.id || null;
      profileTitle.textContent = profile ? '编辑方案' : '添加方案';
      profileName.value = profile?.name || 'DeepSeek';
      profileModel.value = profile?.model || models[0].id;
      profileSecret.value = '';
      profileSecret.required = !hasKey;
      profileKeyHint.textContent = hasKey ? '留空会继续使用本次已填写的 Key。' : '请输入你在 DeepSeek 开放平台创建的 API Key。';
      status(profileStatus, '');
      profileForm.hidden = false;
      profileName.focus();
    }

    function hideProfileForm() {
      profileForm.reset();
      profileForm.hidden = true;
      editingId = null;
    }

    function updateMemorySize() {
      memorySize.textContent = `${memoryInput.value.length} / ${memoryLimit}`;
    }

    memoryInput.value = readMemory();
    updateMemorySize();
    renderChat();
    renderProfiles();

    historyButton.addEventListener('click', () => {
      status(historyStatus, '');
      renderHistory();
      historyButton.focus({ preventScroll: true });
      history.showModal();
      history.querySelector('#p-history-title').focus({ preventScroll: true });
    });
    history.addEventListener('close', () => {
      if (task.classList.contains('active')) historyButton.focus({ preventScroll: true });
    });
    MobileSwipes.bindHistory(history, {
      reveal: revealHistoryRow,
      close: () => history.close()
    });
    historyList.addEventListener('click', event => {
      const remove = event.target.closest('button[data-chat-delete]');
      if (remove) {
        deleteHistoryChat(remove.dataset.chatDelete);
        return;
      }
      const target = event.target.closest('button[data-chat-id]');
      if (!target) return;
      const row = target.closest('.p-history-row');
      if (row.classList.contains('is-revealed')) revealHistoryRow(row, false);
      else selectChat(target.dataset.chatId);
    });
    historyList.addEventListener('keydown', event => {
      const item = event.target.closest('.p-history-item');
      if (event.key === 'Delete' && item) {
        event.preventDefault();
        deleteHistoryChat(item.dataset.chatId);
      } else if (event.key === 'ArrowRight' && item) {
        event.preventDefault();
        const row = item.closest('.p-history-row');
        revealHistoryRow(row, true);
        row.querySelector('.p-history-delete').focus();
      } else if (event.key === 'ArrowLeft' && event.target.closest('.p-history-delete')) {
        event.preventDefault();
        const row = event.target.closest('.p-history-row');
        revealHistoryRow(row, false);
        row.querySelector('.p-history-item').focus();
      }
    });
    newChat.addEventListener('click', () => selectChat(null));
    task.querySelector('.p-starters').addEventListener('click', event => {
      if (!event.target.dataset.pPrompt) return;
      messageInput.value = event.target.dataset.pPrompt;
      updateSend();
      messageInput.focus();
    });
    latest.addEventListener('click', showLatest);
    scroller.addEventListener('scroll', updateScroller, { passive: true });
    messageInput.addEventListener('input', updateSend);
    messageInput.addEventListener('focus', queueViewportSync);
    messageInput.addEventListener('blur', queueViewportSync);
    viewport?.addEventListener('resize', queueViewportSync);
    viewport?.addEventListener('scroll', queueViewportSync);
    window.addEventListener('resize', queueViewportSync);
    task.querySelector('#p-close-image').addEventListener('click', () => imagePreview.close());
    imagePreview.addEventListener('close', () => {
      previewImage.removeAttribute('src');
      saveImage.removeAttribute('href');
      URL.revokeObjectURL(previewUrl);
      previewUrl = '';
    });
    messageInput.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
        event.preventDefault();
        if (!send.disabled) messageForm.requestSubmit();
      }
    });

    messageForm.addEventListener('submit', event => {
      event.preventDefault();
      const content = messageInput.value.trim();
      if (!content || messageInput.disabled) return;
      if (!apiKeys.has(selectedProfile()?.id)) {
        status(composerStatus, '请先在配置中填写 DeepSeek API Key。', true);
        modelLink.focus();
        return;
      }
      const chats = readHistory();
      let chat = chats.find(item => item.id === activeId);
      if (chat?.messages.at(-1)?.role === 'user') {
        renderChat(true);
        return;
      }
      if (!chat) {
        const id = crypto.randomUUID();
        const shortTitle = content.replace(/\s+/g, ' ');
        chat = {
          id,
          title: shortTitle.length > 36 ? `${shortTitle.slice(0, 36)}…` : shortTitle,
          messages: []
        };
      }
      chat.messages.push({ role: 'user', content });
      try {
        saveHistory(chat, chats);
      } catch {
        status(composerStatus, '设备存储已满，无法保存对话。', true);
        return;
      }
      activeId = chat.id;
      messageInput.value = '';
      status(composerStatus, '');
      void requestReply(chat);
    });

    retry.addEventListener('click', () => {
      const chat = readHistory().find(item => item.id === activeId);
      if (chat?.messages.at(-1)?.role === 'user') void requestReply(chat);
    });

    modelButton.addEventListener('click', () => {
      if (modelMenu.hidden) openModelMenu();
      else closeModelMenu(true);
    });
    modelButton.addEventListener('keydown', event => {
      if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
      event.preventDefault();
      openModelMenu(event.key === 'ArrowDown' ? 1 : -1);
    });
    modelMenu.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeModelMenu(true);
        return;
      }
      const next = {
        ArrowDown: event.target.nextElementSibling || modelMenu.firstElementChild,
        ArrowUp: event.target.previousElementSibling || modelMenu.lastElementChild,
        Home: modelMenu.firstElementChild,
        End: modelMenu.lastElementChild
      }[event.key];
      if (!next) return;
      event.preventDefault();
      next.focus({ preventScroll: true });
    });
    for (const eventName of ['pointerdown', 'focusin']) {
      document.addEventListener(eventName, event => {
        if (!modelMenu.hidden && !modelPicker.contains(event.target)) closeModelMenu();
      });
    }
    modelMenu.addEventListener('click', event => {
      const model = event.target.closest('button')?.dataset.model;
      const profile = selectedProfile();
      closeModelMenu(true);
      if (!model || !profile || profile.model === model) return;
      try {
        const saved = readProfiles();
        if (!saved.some(item => item.id === profile.id)) throw new Error();
        saveProfiles(saved.map(item => item.id === profile.id ? { ...item, model } : item));
      } catch {
        status(composerStatus, '模型切换未保存，请检查浏览器存储权限。', true);
        return;
      }
      renderModel(selectedProfile());
      renderProfiles();
      status(composerStatus, '');
    });

    addProfile.addEventListener('click', () => showProfileForm());
    config.querySelector('#p-cancel-profile').addEventListener('click', () => {
      hideProfileForm();
      status(profileStatus, '');
    });
    profileList.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (button?.dataset.editProfile) {
        showProfileForm(profiles.find(profile => profile.id === button.dataset.editProfile));
      }
      if (button?.dataset.useProfile) {
        setProfile(button.dataset.useProfile);
        status(profileStatus, '已切换模型方案。');
        status(composerStatus, '');
      }
    });

    profileForm.addEventListener('submit', event => {
      event.preventDefault();
      const key = profileSecret.value.trim();
      const name = profileName.value.trim();
      const model = profileModel.value.trim();
      if (!name || !model) {
        status(profileStatus, '请填写方案名称和模型 ID。', true);
        return;
      }
      if ((key && !/^[\x21-\x7e]{1,4096}$/.test(key)) || (!key && !apiKeys.has(editingId))) {
        status(profileStatus, '请输入有效的 DeepSeek API Key。', true);
        return;
      }

      const profile = { id: editingId || crypto.randomUUID(), name, model };
      const saved = readProfiles();
      const next = editingId ? saved.map(item => item.id === editingId ? profile : item) : [...saved, profile];
      try {
        saveProfiles(next);
      } catch {
        status(profileStatus, '模型方案保存失败，请检查浏览器存储权限。', true);
        return;
      }
      if (key) apiKeys.set(profile.id, key);
      setProfile(editingId && apiKeys.has(selectedId) ? selectedId : profile.id);
      hideProfileForm();
      status(profileStatus, '已保存方案，可以回到任务页对话。');
      status(composerStatus, '');
    });

    memoryInput.addEventListener('input', () => {
      updateMemorySize();
      status(memoryStatus, '');
    });
    memory.querySelector('#p-memory-form').addEventListener('submit', event => {
      event.preventDefault();
      const value = memoryInput.value;
      try {
        if (value.length > memoryLimit) throw new Error('记忆不能超过 20000 个字符。');
        localStorage.setItem('memory', JSON.stringify(value));
        status(memoryStatus, '已保存记忆。');
      } catch (error) {
        status(memoryStatus, error.message, true);
      }
    });

    window.addEventListener('storage', event => {
      if (event.key === 'memory' && document.activeElement !== memoryInput) {
        memoryInput.value = readMemory();
        updateMemorySize();
      }
      if (event.key === 'chatHistory') {
        if (history.open) renderHistory();
        renderChat();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
