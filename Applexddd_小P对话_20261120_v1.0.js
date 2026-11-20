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
    const endpointKey = 'mingjunBackendUrl';
    const profileKey = 'mingjunSelectedProfile';
    const pending = new Set();
    const failures = new Map();
    let activeId = null;
    let address = readPreference(endpointKey);
    let selectedId = readPreference(profileKey);
    let token = '';
    let profiles = [];
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
      <section class="p-panel" aria-labelledby="p-connection-title">
        <h2 id="p-connection-title">后端连接</h2>
        <form class="p-panel-form" id="p-connect">
          <label for="p-address">后端地址</label>
          <input type="url" id="p-address" placeholder="https://…" autocapitalize="off" spellcheck="false" required>
          <label for="p-token">后端访问凭证</label>
          <input type="password" id="p-token" autocomplete="off" spellcheck="false">
          <p class="p-hint">刷新页面后需要重新输入访问凭证。</p>
          <div class="p-form-actions">
            <button type="submit" class="p-primary">连接后端</button>
            <button type="button" class="p-secondary" id="p-disconnect" hidden>断开连接</button>
          </div>
          <p id="p-connect-status" class="p-form-status" role="status"></p>
        </form>
      </section>
      <section class="p-panel" aria-labelledby="p-profiles-title">
        <div class="p-panel-header">
          <h2 id="p-profiles-title">模型方案</h2>
          <button type="button" class="p-secondary" id="p-add-profile" disabled>添加方案</button>
        </div>
        <p class="p-hint" id="p-profiles-hint"></p>
        <div id="p-profiles" class="p-profile-list"></div>
        <form class="p-panel-form p-profile-form" id="p-profile-form" hidden>
          <h3 id="p-profile-title"></h3>
          <label for="p-profile-name">方案名称</label>
          <input type="text" id="p-profile-name" maxlength="80" required>
          <label for="p-profile-url">模型 API 地址</label>
          <input type="url" id="p-profile-url" placeholder="https://…/v1" autocapitalize="off" spellcheck="false" required>
          <label for="p-profile-model">模型 ID</label>
          <input type="text" id="p-profile-model" maxlength="200" autocapitalize="off" spellcheck="false" required>
          <label for="p-profile-key">模型 API Key</label>
          <input type="password" id="p-profile-key" autocomplete="off" spellcheck="false">
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
    const connectForm = config.querySelector('#p-connect');
    const addressInput = config.querySelector('#p-address');
    const tokenInput = config.querySelector('#p-token');
    const disconnect = config.querySelector('#p-disconnect');
    const connectStatus = config.querySelector('#p-connect-status');
    const addProfile = config.querySelector('#p-add-profile');
    const profileHint = config.querySelector('#p-profiles-hint');
    const profileList = config.querySelector('#p-profiles');
    const profileForm = config.querySelector('#p-profile-form');
    const profileTitle = config.querySelector('#p-profile-title');
    const profileName = config.querySelector('#p-profile-name');
    const profileUrl = config.querySelector('#p-profile-url');
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
      const ready = Boolean(token && profile?.hasKey);
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

    function normalizedAddress(value) {
      let url;
      try {
        url = new URL(value.trim());
      } catch {
        throw new Error('请输入完整的服务地址。');
      }
      const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
      if (url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) {
        throw new Error('服务地址需要使用 HTTPS，本机开发可使用 HTTP。');
      }
      if (url.username || url.password || url.search || url.hash) {
        throw new Error('服务地址不能包含凭证、查询参数或页面锚点。');
      }
      return url.href.replace(/\/+$/, '');
    }

    async function api(path, method = 'GET', body, session = { address, token }) {
      let response;
      try {
        response = await fetch(`${session.address}${path}`, {
          method,
          body: body === undefined ? undefined : JSON.stringify(body),
          headers: {
            Authorization: `Bearer ${session.token}`,
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
          },
          credentials: 'omit',
          cache: 'no-store',
          redirect: 'error',
          signal: AbortSignal.timeout(100000)
        });
      } catch {
        throw new Error('无法连接后端，请检查地址和网络后重试。');
      }
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) {
        throw new Error(typeof data?.error === 'string' ? data.error : '后端返回异常，请检查连接。');
      }
      return data;
    }

    async function requestReply(chat) {
      const profile = selectedProfile();
      if (!token || !profile?.hasKey || pending.has(chat.id)) return;
      pending.add(chat.id);
      failures.delete(chat.id);
      renderChat(true);
      try {
        const memoryText = readMemory();
        if (memoryText.length > memoryLimit) throw new Error('记忆超过长度限制，请在记忆库中调整后重试。');
        const recent = chat.messages.slice(-79)
          .filter(entry => entry && ['user', 'assistant'].includes(entry.role) && typeof entry.content === 'string')
          .map(({ role, content }) => ({ role, content: content.slice(0, messageLimit) }));
        const body = { profileId: profile.id, memory: memoryText, messages: recent };
        while (recent.length > 1 && (
          recent[0].role !== 'user' || encoder.encode(JSON.stringify(body)).length > requestLimit
        )) recent.shift();
        const result = await api('/chat', 'POST', body);
        if (typeof result.content !== 'string' || !result.content.trim()) {
          throw new Error('模型返回了空回复，请重试。');
        }
        const chats = readHistory();
        const latestChat = chats.find(item => item.id === chat.id);
        if (latestChat && JSON.stringify(latestChat.messages) === JSON.stringify(chat.messages)) {
          latestChat.messages.push({ role: 'assistant', content: result.content });
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
      addProfile.disabled = !token;
      disconnect.hidden = !token;
      profileHint.textContent = !token ? '连接后端后可管理模型方案。' :
        (profiles.length ? '' : '添加一个模型方案，即可开始使用小P。');
      for (const profile of profiles) {
        const row = document.createElement('article');
        row.className = 'p-profile-row';
        const description = document.createElement('div');
        const name = document.createElement('h3');
        name.textContent = profile.name;
        const detail = document.createElement('p');
        detail.className = 'p-hint';
        detail.textContent = profile.hasKey ? profile.model : `${profile.model} · 待填写 API Key`;
        description.append(name, detail);
        const actions = document.createElement('div');
        actions.className = 'p-profile-actions';
        const select = document.createElement('button');
        select.type = 'button';
        select.className = 'p-secondary';
        select.dataset.useProfile = profile.id;
        select.textContent = profile.id === selectedId ? '正在使用' : '使用';
        select.disabled = profile.id === selectedId || !profile.hasKey;
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
      editingId = profile?.id || null;
      profileTitle.textContent = profile ? '编辑方案' : '添加方案';
      profileName.value = profile?.name || '';
      profileUrl.value = profile?.baseUrl || '';
      profileModel.value = profile?.model || '';
      profileSecret.value = '';
      profileSecret.required = !profile?.hasKey;
      profileKeyHint.textContent = profile?.hasKey ? '留空会继续使用已保存的 Key。' : 'Key 保存在后端。';
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

    addressInput.value = address;
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
      if (!token || !selectedProfile()?.hasKey) {
        status(composerStatus, '请先连接后端并选择模型方案。', true);
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

    connectForm.addEventListener('submit', async event => {
      event.preventDefault();
      const button = connectForm.querySelector('[type="submit"]');
      const suppliedToken = tokenInput.value.trim();
      const previousId = selectedId;
      if (!suppliedToken) {
        status(connectStatus, '请输入后端访问凭证。', true);
        tokenInput.focus();
        return;
      }
      try {
        const nextAddress = normalizedAddress(addressInput.value);
        button.disabled = true;
        disconnect.disabled = true;
        tokenInput.value = '';
        status(connectStatus, '正在连接…');
        const data = await api('/profiles', 'GET', undefined, { address: nextAddress, token: suppliedToken });
        if (!Array.isArray(data.profiles)) throw new Error('后端返回的模型方案格式有误。');
        if (address !== nextAddress) selectedId = '';
        address = nextAddress;
        token = suppliedToken;
        profiles = data.profiles;
        rememberPreference(endpointKey, address);
        addressInput.value = address;
        const nextId = selectedProfile()?.id || profiles.find(profile => profile.hasKey)?.id || '';
        setProfile(nextId);
        hideProfileForm();
        status(profileStatus, '');
        status(connectStatus, '已连接');
        status(composerStatus, '');
      } catch (error) {
        selectedId = previousId;
        status(connectStatus, error.message, true);
      } finally {
        button.disabled = false;
        disconnect.disabled = false;
      }
    });

    disconnect.addEventListener('click', () => {
      token = '';
      tokenInput.value = '';
      profiles = [];
      hideProfileForm();
      status(profileStatus, '');
      status(connectStatus, '已断开');
      renderProfiles();
      renderChat();
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

    profileForm.addEventListener('submit', async event => {
      event.preventDefault();
      if (!token) return;
      const button = profileForm.querySelector('[type="submit"]');
      const activeToken = token;
      const activeAddress = address;
      const savingId = editingId;
      try {
        const payload = {
          name: profileName.value.trim(),
          baseUrl: normalizedAddress(profileUrl.value),
          model: profileModel.value.trim()
        };
        if (!payload.name || !payload.model) throw new Error('请填写方案名称和模型 ID。');
        if (profileSecret.value.trim()) payload.apiKey = profileSecret.value.trim();
        profileSecret.value = '';
        button.disabled = true;
        status(profileStatus, '正在保存…');
        const path = savingId ? `/profiles/${encodeURIComponent(savingId)}` : '/profiles';
        const { profile } = await api(path, savingId ? 'PATCH' : 'POST', payload);
        if (activeToken !== token || activeAddress !== address) return;
        if (!profile || typeof profile.id !== 'string') throw new Error('后端返回的模型方案格式有误。');
        profiles = profiles.filter(item => item.id !== profile.id).concat(profile);
        setProfile(savingId && selectedId ? selectedId : profile.id);
        if (editingId === savingId) hideProfileForm();
        status(profileStatus, '已保存方案。');
        status(composerStatus, '');
      } catch (error) {
        if (activeToken === token && activeAddress === address) status(profileStatus, error.message, true);
      } finally {
        button.disabled = false;
      }
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
