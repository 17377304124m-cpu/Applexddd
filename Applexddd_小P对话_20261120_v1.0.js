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
    const apiKeys = new Map();
    const pending = new Set();
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
            <button type="button" class="p-model-link" data-open-config>
              <span></span><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#mj-icon-next"></use></svg>
            </button>
          </div>
          <button type="button" class="p-icon-btn" id="p-new-chat" aria-label="新对话" title="新对话"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#mj-icon-new-chat"></use></svg></button>
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
          <label class="p-message-label" for="p-message">发给小P</label>
          <form id="p-message-form" class="p-message-form">
            <textarea id="p-message" rows="1" maxlength="${messageLimit}" placeholder="输入消息…" enterkeyhint="send" required></textarea>
            <button type="submit" class="p-icon-btn p-send" aria-label="发送消息" title="发送消息"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#mj-icon-up"></use></svg></button>
          </form>
        </footer>
      </section>
      <dialog class="p-history" id="p-chat-history" aria-labelledby="p-history-title">
        <div class="p-history-inner">
          <header>
            <h2 id="p-history-title">对话历史</h2>
            <button type="button" class="p-icon-btn" id="p-close-history" aria-label="关闭对话历史"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#mj-icon-close"></use></svg></button>
          </header>
          <button type="button" class="p-primary p-history-new">新对话</button>
          <div class="p-history-list"></div>
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
    const historyList = task.querySelector('.p-history-list');
    const title = task.querySelector('#p-chat-title');
    const modelLink = task.querySelector('.p-model-link');
    const modelLabel = modelLink.querySelector('span');
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
    }

    function updateScroller() {
      latest.hidden = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 120;
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
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'p-history-item';
        button.dataset.chatId = chat.id;
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
        historyList.append(button);
      }
    }

    function selectedProfile() {
      return profiles.find(profile => profile.id === selectedId);
    }

    function updateSend() {
      send.disabled = messageInput.disabled || !messageInput.value.trim();
      messageInput.style.height = 'auto';
      messageInput.style.height = `${Math.min(132, messageInput.scrollHeight)}px`;
    }

    function renderChat(scrollToLatest = false) {
      const chat = readHistory().find(item => item.id === activeId);
      const chatMessages = chat?.messages || [];
      const profile = selectedProfile();
      const ready = apiKeys.has(profile?.id);
      title.textContent = chat?.title || 'MingJun';
      modelLabel.textContent = ready ? profile.name : '配置模型';
      modelLink.classList.toggle('is-connected', ready);
      welcome.hidden = chatMessages.length > 0;
      messages.replaceChildren();
      for (const entry of chatMessages) {
        if (!entry || typeof entry.content !== 'string') continue;
        const assistant = entry.role === 'assistant';
        const article = document.createElement('article');
        article.className = assistant ? 'p-message p-assistant' : 'p-message p-user';
        article.setAttribute('aria-label', assistant ? '小P' : '你');
        if (assistant) {
          const label = document.createElement('div');
          label.className = 'p-message-author';
          label.textContent = '小P';
          article.append(label);
        }
        const content = document.createElement('p');
        content.className = 'p-message-text';
        content.textContent = entry.content;
        article.append(content);
        if (assistant && navigator.clipboard) {
          const copy = document.createElement('button');
          copy.type = 'button';
          copy.className = 'p-text-btn p-copy';
          copy.textContent = '复制';
          copy.addEventListener('click', async () => {
            try {
              await navigator.clipboard.writeText(entry.content);
              status(composerStatus, '已复制');
            } catch {
              status(composerStatus, '复制失败，请选中内容后复制。', true);
            }
          });
          article.append(copy);
        }
        messages.append(article);
      }

      const awaiting = chatMessages.at(-1)?.role === 'user';
      const loading = pending.has(activeId);
      const failure = failures.get(activeId);
      turn.hidden = !awaiting;
      retry.hidden = !awaiting || loading || !ready;
      turnConfig.hidden = !awaiting || loading || ready;
      status(turnStatus, loading ? '小P 正在回复…' : (
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
      if (history.open) history.close();
      renderChat(true);
    }

    async function requestDeepSeek(body, apiKey) {
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
          signal: AbortSignal.timeout(100000)
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
      const data = await response.json().catch(() => null);
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) throw new Error('DeepSeek 未返回文本，请重试。');
      return content;
    }

    async function requestReply(chat) {
      const profile = selectedProfile();
      const apiKey = apiKeys.get(profile?.id);
      if (!apiKey || pending.has(chat.id)) return;
      pending.add(chat.id);
      failures.delete(chat.id);
      renderChat(true);
      try {
        const memoryText = readMemory();
        if (memoryText.length > memoryLimit) throw new Error('记忆超过长度限制，请在记忆库中调整后重试。');
        const recent = chat.messages.slice(-79)
          .filter(entry => entry && ['user', 'assistant'].includes(entry.role) && typeof entry.content === 'string')
          .map(({ role, content }) => ({ role, content: content.slice(0, messageLimit) }));
        const identity = '默认身份：你是小P，明军的个人助手。';
        const instructions = memoryText.trim()
          ? `以下是用户保存的记忆和指令，在本应用内优先于默认身份及后续对话。\n\n${memoryText}\n\n${identity}`
          : identity;
        const body = {
          model: profile.model,
          thinking: { type: 'disabled' },
          stream: false,
          messages: [{ role: 'system', content: instructions }, ...recent]
        };
        while (body.messages.length > 2 && (
          body.messages[1].role !== 'user' || encoder.encode(JSON.stringify(body)).length > requestLimit
        )) {
          body.messages.splice(1, 1);
        }
        const content = await requestDeepSeek(body, apiKey);
        const chats = readHistory();
        const latestChat = chats.find(item => item.id === chat.id);
        if (latestChat && JSON.stringify(latestChat.messages) === JSON.stringify(chat.messages)) {
          latestChat.messages.push({ role: 'assistant', content });
          saveHistory(latestChat, chats);
        }
      } catch (error) {
        failures.set(chat.id, error.message);
      } finally {
        pending.delete(chat.id);
        if (activeId === chat.id) renderChat(true);
      }
    }

    function setProfile(id) {
      rememberPreference(profileKey, id);
      selectedId = id;
      renderProfiles();
      renderChat();
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
      profileModel.value = profile?.model || 'deepseek-flash';
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

    task.querySelector('#p-open-history').addEventListener('click', () => {
      renderHistory();
      history.showModal();
    });
    task.querySelector('#p-close-history').addEventListener('click', () => history.close());
    history.addEventListener('click', event => {
      if (event.target === history) history.close();
    });
    historyList.addEventListener('click', event => {
      const target = event.target.closest('button[data-chat-id]');
      if (target) selectChat(target.dataset.chatId);
    });
    task.querySelector('#p-new-chat').addEventListener('click', () => selectChat(null));
    task.querySelector('.p-history-new').addEventListener('click', () => selectChat(null));
    task.querySelector('.p-starters').addEventListener('click', event => {
      if (!event.target.dataset.pPrompt) return;
      messageInput.value = event.target.dataset.pPrompt;
      updateSend();
      messageInput.focus();
    });
    latest.addEventListener('click', showLatest);
    scroller.addEventListener('scroll', updateScroller, { passive: true });
    messageInput.addEventListener('input', updateSend);
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
        localStorage.setItem(profilesKey, JSON.stringify(next));
      } catch {
        status(profileStatus, '模型方案保存失败，请检查浏览器存储权限。', true);
        return;
      }
      if (key) apiKeys.set(profile.id, key);
      profiles = next;
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
