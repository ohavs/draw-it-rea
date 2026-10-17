(function () {
  const AVATARS = ['🎨', '🦊', '🐼', '🦁', '🐸', '🦄', '🐙', '🐵', '🐯', '🐨', '🐲', '👽'];

  const PROMPTS = [
    { he: 'חתול חלל עם קסדה', en: 'Space Cat with Helmet', category: 'חיות 🐾', icon: '🐱' },
    { he: 'פינגווין גולש על גלשן', en: 'Surfing Penguin', category: 'חיות 🐾', icon: '🐧' },
    { he: 'תמנון מנגן בתופים', en: 'Octopus Playing Drums', category: 'חיות 🐾', icon: '🐙' },
    { he: 'דרקון יורק מרשמלו', en: 'Marshmallow Dragon', category: 'פנטזיה ✨', icon: '🐉' },
    { he: 'כלב רוכב על סקייטבורד', en: 'Skateboarding Dog', category: 'חיות 🐾', icon: '🐶' },
    { he: "ג'ירפה עם צעיף ארוך", en: 'Giraffe with Long Scarf', category: 'חיות 🐾', icon: '🦒' },
    { he: 'כריש עם משקפי שמש', en: 'Shark with Sunglasses', category: 'חיות 🐾', icon: '🦈' },
    { he: 'חד-קרן אוכל גלידה', en: 'Unicorn Eating Ice Cream', category: 'פנטזיה ✨', icon: '🦄' },
    { he: 'פיצה מעופפת עם כנפיים', en: 'Flying Pizza with Wings', category: 'אוכל 🍕', icon: '🍕' },
    { he: 'המבורגר מפלצתי ענק', en: 'Monster Burger', category: 'אוכל 🍕', icon: '🍔' },
    { he: 'אננס בחופשה בים', en: 'Pineapple on Beach Vacation', category: 'אוכל 🍕', icon: '🍍' },
    { he: 'רובוט שמכין פנקייקים', en: 'Pancake Chef Robot', category: 'טכנולוגיה 🤖', icon: '🥞' },
    { he: 'אבוקדו מרים משקולות', en: 'Weightlifting Avocado', category: 'אוכל 🍕', icon: '🥑' },
    { he: 'סושי רוקד על במה', en: 'Dancing Sushi', category: 'אוכל 🍕', icon: '🍣' },
    { he: 'טירה מרחפת על ענן', en: 'Castle Floating on a Cloud', category: 'פנטזיה ✨', icon: '🏰' },
    { he: 'חללית חוטפת פרה', en: 'UFO Abducting a Cow', category: 'חלל 🚀', icon: '🛸' },
    { he: 'אי בודד עם תיבת אוצר', en: 'Treasure Island', category: 'הרפתקאות 🗺️', icon: '🏝️' },
    { he: 'מכונת זמן משוגעת', en: 'Crazy Time Machine', category: 'טכנולוגיה 🤖', icon: '⏳' },
    { he: 'שעון מעורר עצבני', en: 'Angry Alarm Clock', category: 'חפצים 💡', icon: '⏰' },
    { he: 'קקטוס שמחבק בלון', en: 'Cactus Hugging a Balloon', category: 'מצחיק 😂', icon: '🌵' },
    { he: 'איש שלג בחוף הים', en: 'Snowman at the Beach', category: 'מצחיק 😂', icon: '⛄' },
    { he: 'קוסם שולף ארנב מכובע', en: 'Magician Pulling a Rabbit', category: 'פנטזיה ✨', icon: '🎩' },
    { he: 'פיראט מחפש Wi-Fi', en: 'Pirate Looking for Wi-Fi', category: 'מצחיק 😂', icon: '🏴‍☠️' },
    { he: 'דינוזאור מצלם סלפי', en: 'Dinosaur Taking a Selfie', category: 'מצחיק 😂', icon: '🦖' },
  ];

  const BOT_PROFILES = [
    { name: 'פיקאסו בוט 🤖', avatar: '🤖', style: 'geometric' },
    { name: 'דאלי הקטן 🎨', avatar: '🎨', style: 'artistic' },
    { name: 'שרבוטון ⚡', avatar: '⚡', style: 'sketchy' },
  ];

  // Firebase Configuration for draw-it-rea
  const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyBH_NzvYTPg6FuUc0dbrFFki-eL-Asz4Yc',
    authDomain: 'draw-it-rea.firebaseapp.com',
    projectId: 'draw-it-rea',
    storageBucket: 'draw-it-rea.firebasestorage.app',
    messagingSenderId: '734899696587',
    appId: '1:734899696587:web:6c28f4b8fbf9af34e1fc4e',
  };

  let db = null;
  let unsubscribeRoom = null;
  let activeRoomCode = null;
  let liveStrokeTimer = null;
  let isTransitioning = false;

  let myPlayerId =
    sessionStorage.getItem('drawit_player_id') ||
    'p_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  sessionStorage.setItem('drawit_player_id', myPlayerId);

  let myName = localStorage.getItem('drawit_name') || '';
  let myAvatar = localStorage.getItem('drawit_avatar') || AVATARS[0];
  let currentRoom = null;
  let lastKnownState = null;
  let lastRenderedRound = 0;
  let lastReactionCount = 0;

  let selectedPromptChoice = null; // null = random
  let countdownInterval = null;
  let myRatingsThisRound = {}; // targetPlayerId -> stars

  const screens = {
    JOIN: document.getElementById('screenJoin'),
    LOBBY: document.getElementById('screenLobby'),
    DRAWING: document.getElementById('screenDrawing'),
    VOTING: document.getElementById('screenVoting'),
    RESULTS: document.getElementById('screenResults'),
  };

  function initApp() {
    if (window.firebase) {
      firebase.initializeApp(FIREBASE_CONFIG);
      db = firebase.firestore();
    }
    setupJoinScreen();
    setupLobbyScreen();
    setupDrawingToolbar();
    setupVotingAndResults();
    checkUrlRoomParam();
    fetchActiveRooms();
  }

  function getPromptChoices(count = 3, excludeList = []) {
    const excludeSet = new Set(excludeList || []);
    const available = PROMPTS.filter((p) => !excludeSet.has(p.he));
    const pool = [...(available.length >= count ? available : PROMPTS)];
    const choices = [];
    while (choices.length < count && pool.length > 0) {
      const idx = Math.floor(Math.random() * pool.length);
      choices.push(pool.splice(idx, 1)[0]);
    }
    return choices;
  }

  function getRandomPrompt(excludeList = []) {
    return getPromptChoices(1, excludeList)[0];
  }

  function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  function checkUrlRoomParam() {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      document.getElementById('roomCodeInput').value = roomParam.toUpperCase();
    }
  }

  async function fetchActiveRooms() {
    if (!db) return;
    try {
      const snap = await db.collection('rooms').limit(8).get();
      const container = document.getElementById('activeRoomsList');
      if (snap.empty) {
        container.innerHTML = '<span class="muted-text">אין חדרים פעילים כרגע — לחצו על כניסה ללובי כדי לפתוח!</span>';
        return;
      }
      container.innerHTML = '';
      snap.forEach((doc) => {
        const r = doc.data();
        const playerCount = Object.keys(r.playersMap || {}).length;
        const chip = document.createElement('button');
        chip.className = 'room-chip';
        const stateLabel =
          r.state === 'LOBBY' ? '🟢 בלובי' : r.state === 'DRAWING' ? '🎨 מציירים' : '⭐ מדרגים';
        chip.innerHTML = `<strong>${r.code}</strong> <span>(${playerCount} שחקנים • ${stateLabel})</span>`;
        chip.addEventListener('click', () => {
          document.getElementById('roomCodeInput').value = r.code;
          joinOrCreateRoom(r.code);
        });
        container.appendChild(chip);
      });
    } catch (err) {
      console.warn('Could not list rooms:', err);
    }
  }

  // ==================== 1. JOIN SCREEN ====================
  function setupJoinScreen() {
    const nameInput = document.getElementById('playerNameInput');
    if (myName) nameInput.value = myName;

    const picker = document.getElementById('avatarPicker');
    AVATARS.forEach((av) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'avatar-option' + (av === myAvatar ? ' selected' : '');
      btn.textContent = av;
      btn.addEventListener('click', () => {
        myAvatar = av;
        localStorage.setItem('drawit_avatar', av);
        picker.querySelectorAll('.avatar-option').forEach((el) => el.classList.remove('selected'));
        btn.classList.add('selected');
      });
      picker.appendChild(btn);
    });

    document.getElementById('joinRoomBtn').addEventListener('click', () => {
      const code = document.getElementById('roomCodeInput').value.trim().toUpperCase() || 'DRAW';
      joinOrCreateRoom(code);
    });

    document.getElementById('createRoomBtn').addEventListener('click', () => {
      joinOrCreateRoom(generateRoomCode());
    });

    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const code = document.getElementById('roomCodeInput').value.trim().toUpperCase() || 'DRAW';
        joinOrCreateRoom(code);
      }
    });
  }

  async function joinOrCreateRoom(roomCode) {
    if (!db) {
      showToast('שגיאה בחיבור ל-Firebase', 'error');
      return;
    }
    const nameInput = document.getElementById('playerNameInput');
    const enteredName = nameInput.value.trim() || `אמן_${Math.floor(Math.random() * 90 + 10)}`;
    myName = enteredName;
    localStorage.setItem('drawit_name', myName);

    const code = (roomCode || generateRoomCode()).toUpperCase();
    const roomRef = db.collection('rooms').doc(code);

    try {
      const doc = await roomRef.get();
      const playerObj = {
        id: myPlayerId,
        name: myName,
        avatar: myAvatar,
        isBot: false,
        totalScore: 0,
        roundsWon: 0,
        lastRoundPoints: 0,
        joinedAt: Date.now(),
      };

      if (!doc.exists) {
        await roomRef.set({
          code,
          state: 'LOBBY',
          hostId: myPlayerId,
          settings: {
            drawDurationSec: 45,
            totalRounds: 3,
          },
          currentRound: 0,
          currentPrompt: null,
          usedPrompts: [],
          promptChoices: getPromptChoices(3, []),
          roundEndsAt: null,
          playersMap: {
            [myPlayerId]: playerObj,
          },
          drawingsMap: {},
          ratingsMap: {},
          reactionsList: [],
          updatedAt: Date.now(),
        });
      } else {
        const existing = doc.data();
        const existingPlayer = (existing.playersMap || {})[myPlayerId];
        const mergedPlayer = existingPlayer
          ? { ...existingPlayer, name: myName, avatar: myAvatar }
          : playerObj;

        const updates = {
          [`playersMap.${myPlayerId}`]: mergedPlayer,
          updatedAt: Date.now(),
        };
        if (!existing.hostId || !(existing.playersMap || {})[existing.hostId]) {
          updates.hostId = myPlayerId;
        }
        await roomRef.update(updates);
      }

      activeRoomCode = code;
      const url = new URL(window.location.href);
      url.searchParams.set('room', code);
      window.history.replaceState({}, '', url);

      subscribeToRoom(code);
      showToast(`הצטרפת לחדר ${code}!`, 'success');
    } catch (err) {
      console.error('Join room error:', err);
      showToast('שגיאה בכניסה לחדר: ' + err.message, 'error');
    }
  }

  function subscribeToRoom(code) {
    if (unsubscribeRoom) unsubscribeRoom();
    unsubscribeRoom = db
      .collection('rooms')
      .doc(code)
      .onSnapshot((doc) => {
        if (!doc.exists) return;
        const raw = doc.data();
        const normalized = normalizeRoomSnapshot(raw);
        applyRoomState(normalized);
      });
  }

  function normalizeRoomSnapshot(raw) {
    const playersMap = raw.playersMap || {};
    const drawingsMap = raw.drawingsMap || {};
    const ratingsMap = raw.ratingsMap || {};
    const reactionsList = raw.reactionsList || [];

    const playersList = Object.values(playersMap).sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));

    function getRatingStats(targetId) {
      const voterObj = ratingsMap[targetId] || {};
      const scores = Object.values(voterObj).map(Number).filter((n) => n >= 1 && n <= 5);
      if (scores.length === 0) {
        return { average: 0, count: 0, totalStars: 0, breakdown: voterObj };
      }
      const sum = scores.reduce((acc, v) => acc + v, 0);
      return {
        average: Number((sum / scores.length).toFixed(1)),
        count: scores.length,
        totalStars: sum,
        breakdown: voterObj,
      };
    }

    const players = playersList.map((p) => {
      const d = drawingsMap[p.id];
      const ratingStats = getRatingStats(p.id);
      return {
        ...p,
        hasSubmitted: Boolean(d && d.isSubmitted),
        strokeCount: d && d.strokes ? d.strokes.length : 0,
        ratingStats,
      };
    });

    const gallery = playersList.map((p) => {
      const d = drawingsMap[p.id] || { strokes: [], dataUrl: null };
      const ratingStats = getRatingStats(p.id);
      return {
        playerId: p.id,
        playerName: p.name,
        playerAvatar: p.avatar,
        isBot: p.isBot,
        strokes: d.strokes || [],
        dataUrl: d.dataUrl || null,
        ratingStats,
      };
    });

    return {
      code: raw.code,
      state: raw.state || 'LOBBY',
      hostId: raw.hostId,
      settings: raw.settings || { drawDurationSec: 45 },
      currentRound: raw.currentRound || 0,
      currentPrompt: raw.currentPrompt || null,
      usedPrompts: raw.usedPrompts || [],
      promptChoices: raw.promptChoices || [],
      roundEndsAt: raw.roundEndsAt || null,
      players,
      gallery,
      reactionsList,
      raw,
    };
  }

  // ==================== STATE SYNCHRONIZATION ====================
  function applyRoomState(room) {
    const prevState = lastKnownState;
    currentRoom = room;
    lastKnownState = room.state;

    // Update top header
    const headerBadge = document.getElementById('headerRoomBadge');
    headerBadge.hidden = false;
    document.getElementById('headerRoomCode').textContent = room.code;

    const roundBadge = document.getElementById('headerRoundBadge');
    if (room.currentRound > 0) {
      roundBadge.hidden = false;
      document.getElementById('headerRoundNum').textContent = room.currentRound;
    } else {
      roundBadge.hidden = true;
    }

    // Switch active screen
    Object.entries(screens).forEach(([key, el]) => {
      const isMatch = key === room.state;
      el.hidden = !isMatch;
      el.classList.toggle('active', isMatch);
    });

    if (room.state === 'LOBBY') {
      stopCountdown();
      renderLobby(room);
    } else if (room.state === 'DRAWING') {
      if (prevState !== 'DRAWING' || lastRenderedRound !== room.currentRound) {
        lastRenderedRound = room.currentRound;
        myRatingsThisRound = {};
        isTransitioning = false;
        document.getElementById('submittedOverlay').hidden = true;
        window.DrawEngine.resetForNewRound();
      }
      renderDrawingScreen(room);
      startCountdown(room.roundEndsAt);
      checkIfAllSubmitted(room);
    } else if (room.state === 'VOTING') {
      stopCountdown();
      renderVotingScreen(room, prevState !== 'VOTING');
    } else if (room.state === 'RESULTS') {
      stopCountdown();
      renderResultsScreen(room, prevState !== 'RESULTS');
    }
  }

  // ==================== 2. LOBBY SCREEN ====================
  function setupLobbyScreen() {
    const slider = document.getElementById('durationSlider');
    const durationLabel = document.getElementById('durationLabel');

    slider.addEventListener('input', () => {
      durationLabel.textContent = slider.value;
    });

    slider.addEventListener('change', async () => {
      if (!activeRoomCode) return;
      await db.collection('rooms').doc(activeRoomCode).update({
        'settings.drawDurationSec': Number(slider.value),
      });
    });

    document.getElementById('addBotBtn').addEventListener('click', async () => {
      if (!activeRoomCode || !currentRoom) return;
      const bots = currentRoom.players.filter((p) => p.isBot);
      if (bots.length >= 4) {
        showToast('ניתן להוסיף עד 4 שחקני AI לחדר', 'warn');
        return;
      }
      const profile = BOT_PROFILES[bots.length % BOT_PROFILES.length];
      const botId = `bot_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
      await db
        .collection('rooms')
        .doc(activeRoomCode)
        .update({
          [`playersMap.${botId}`]: {
            id: botId,
            name: profile.name,
            avatar: profile.avatar,
            isBot: true,
            botStyle: profile.style,
            totalScore: 0,
            roundsWon: 0,
            lastRoundPoints: 0,
            joinedAt: Date.now(),
          },
        });
      showToast(`${profile.name} הצטרף ללובי!`, 'info');
    });

    document.getElementById('startGameBtn').addEventListener('click', () => {
      const customText = document.getElementById('customPromptInput').value.trim();
      const chosenPrompt = customText || selectedPromptChoice || null;
      startNewDrawingRound(chosenPrompt);
      document.getElementById('customPromptInput').value = '';
    });

    document.getElementById('copyInviteBtn').addEventListener('click', () => {
      navigator.clipboard.writeText(window.location.href).then(() => {
        showToast('📋 קישור ההזמנה לחדר הועתק!', 'success');
      });
    });

    document.getElementById('openSecondTabBtn').addEventListener('click', () => {
      window.open(window.location.href, '_blank');
    });
  }

  async function startNewDrawingRound(chosenPromptText = null) {
    if (!activeRoomCode || !currentRoom) return;
    const nextRound = (currentRoom.currentRound || 0) + 1;
    const durationSec = (currentRoom.settings && currentRoom.settings.drawDurationSec) || 45;

    let promptObj;
    if (chosenPromptText) {
      const found = PROMPTS.find((p) => p.he === chosenPromptText);
      promptObj = found || {
        he: chosenPromptText,
        en: 'Custom Topic',
        category: 'בחירה מיוחדת 🌟',
        icon: '✨',
      };
    } else {
      promptObj = getRandomPrompt(currentRoom.usedPrompts || []);
    }

    const drawingsMap = {};
    const ratingsMap = {};

    for (const p of currentRoom.players) {
      ratingsMap[p.id] = {};
      if (p.isBot) {
        drawingsMap[p.id] = {
          playerId: p.id,
          strokes: generateBotDrawing(promptObj.he, p.botStyle || 'artistic'),
          dataUrl: null,
          isSubmitted: true,
          submittedAt: Date.now(),
        };
      } else {
        drawingsMap[p.id] = {
          playerId: p.id,
          strokes: [],
          dataUrl: null,
          isSubmitted: false,
          submittedAt: null,
        };
      }
    }

    const usedPrompts = [...(currentRoom.usedPrompts || []), promptObj.he];

    await db.collection('rooms').doc(activeRoomCode).update({
      state: 'DRAWING',
      currentRound: nextRound,
      currentPrompt: promptObj,
      usedPrompts,
      roundEndsAt: Date.now() + durationSec * 1000,
      drawingsMap,
      ratingsMap,
      reactionsList: [],
      updatedAt: Date.now(),
    });
  }

  function renderLobby(room) {
    const isHost = room.hostId === myPlayerId;
    document.getElementById('lobbyPlayerCount').textContent = room.players.length;
    document.getElementById('lobbyBannerCode').textContent = room.code;

    const grid = document.getElementById('lobbyPlayersGrid');
    grid.innerHTML = '';
    room.players.forEach((p) => {
      const card = document.createElement('div');
      card.className = 'player-card' + (p.id === myPlayerId ? ' is-me' : '');
      const hostCrown = p.id === room.hostId ? '<span class="crown-badge" title="מנהל החדר">👑</span>' : '';
      const meTag = p.id === myPlayerId ? '<span class="me-tag">(אני)</span>' : '';
      const removeBotBtn =
        isHost && p.isBot
          ? `<button class="btn-remove-bot" data-bot-id="${p.id}" title="הסר בוט">✖</button>`
          : '';

      card.innerHTML = `
        ${removeBotBtn}
        <div class="player-avatar">${p.avatar}</div>
        <div class="player-info">
          <div class="player-name">${escapeHtml(p.name)} ${meTag} ${hostCrown}</div>
          <div class="player-sub">${p.isBot ? 'שחקן AI אוטומטי 🤖' : 'מוכן לצייר 🖌️'}</div>
        </div>
      `;
      grid.appendChild(card);
    });

    grid.querySelectorAll('.btn-remove-bot').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const botId = btn.dataset.botId;
        await db
          .collection('rooms')
          .doc(activeRoomCode)
          .update({
            [`playersMap.${botId}`]: firebase.firestore.FieldValue.delete(),
          });
      });
    });

    const slider = document.getElementById('durationSlider');
    slider.value = room.settings.drawDurationSec;
    slider.disabled = !isHost;
    document.getElementById('durationLabel').textContent = room.settings.drawDurationSec;

    const choicesBox = document.getElementById('promptChoicesContainer');
    choicesBox.innerHTML = '';

    const randomBtn = document.createElement('button');
    randomBtn.type = 'button';
    randomBtn.className = 'prompt-choice-chip' + (selectedPromptChoice === null ? ' active' : '');
    randomBtn.innerHTML = '🎲 <strong>נושא בהפתעה (אקראי)</strong>';
    randomBtn.disabled = !isHost;
    randomBtn.addEventListener('click', () => {
      selectedPromptChoice = null;
      renderLobby(currentRoom);
    });
    choicesBox.appendChild(randomBtn);

    (room.promptChoices || []).forEach((item) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'prompt-choice-chip' + (selectedPromptChoice === item.he ? ' active' : '');
      btn.innerHTML = `${item.icon} <span>${escapeHtml(item.he)}</span>`;
      btn.disabled = !isHost;
      btn.addEventListener('click', () => {
        selectedPromptChoice = item.he;
        renderLobby(currentRoom);
      });
      choicesBox.appendChild(btn);
    });

    document.getElementById('customPromptInput').disabled = !isHost;
    document.getElementById('startGameBtn').hidden = !isHost;
    document.getElementById('hostWaitNotice').hidden = isHost;
  }

  // ==================== 3. DRAWING SCREEN ====================
  function setupDrawingToolbar() {
    const canvasEl = document.getElementById('drawingCanvas');
    window.DrawEngine.init(canvasEl, (strokes) => {
      // Debounced save to Firestore so live strokes are preserved if timer hits 0
      if (liveStrokeTimer) clearTimeout(liveStrokeTimer);
      liveStrokeTimer = setTimeout(() => {
        if (!activeRoomCode || !currentRoom || currentRoom.state !== 'DRAWING') return;
        db.collection('rooms')
          .doc(activeRoomCode)
          .update({
            [`drawingsMap.${myPlayerId}.strokes`]: strokes,
            [`drawingsMap.${myPlayerId}.playerId`]: myPlayerId,
          })
          .catch(() => {});
      }, 450);
    });

    const paletteEl = document.getElementById('colorPalette');
    window.DrawEngine.PALETTE.forEach((hex, idx) => {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = 'color-swatch' + (idx === 0 ? ' active' : '');
      swatch.style.backgroundColor = hex;
      if (hex.toLowerCase() === '#ffffff') swatch.classList.add('white-swatch');
      swatch.addEventListener('click', () => {
        window.DrawEngine.setColor(hex);
        if (window.DrawEngine.getTool() === 'eraser') setActiveTool('pen');
        paletteEl.querySelectorAll('.color-swatch').forEach((s) => s.classList.remove('active'));
        swatch.classList.add('active');
      });
      paletteEl.appendChild(swatch);
    });

    const sizeEl = document.getElementById('sizeSelector');
    window.DrawEngine.SIZES.forEach((item, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'size-btn' + (idx === 1 ? ' active' : '');
      btn.innerHTML = `<span class="size-dot" style="width:${Math.min(18, item.size)}px;height:${Math.min(18, item.size)}px"></span> <span>${item.label}</span>`;
      btn.addEventListener('click', () => {
        window.DrawEngine.setSize(item.size);
        sizeEl.querySelectorAll('.size-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      });
      sizeEl.appendChild(btn);
    });

    document.querySelectorAll('.tool-btn').forEach((btn) => {
      btn.addEventListener('click', () => setActiveTool(btn.dataset.tool));
    });

    function setActiveTool(toolName) {
      window.DrawEngine.setTool(toolName);
      document.querySelectorAll('.tool-btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.tool === toolName);
      });
    }

    document.getElementById('undoBtn').addEventListener('click', () => window.DrawEngine.undo());
    document.getElementById('clearCanvasBtn').addEventListener('click', () => window.DrawEngine.clearAll());
    document.getElementById('submitDrawingBtn').addEventListener('click', () => submitMyDrawing());

    document.getElementById('editDrawingAgainBtn').addEventListener('click', async () => {
      document.getElementById('submittedOverlay').hidden = true;
      window.DrawEngine.setEnabled(true);
      if (activeRoomCode) {
        await db.collection('rooms').doc(activeRoomCode).update({
          [`drawingsMap.${myPlayerId}.isSubmitted`]: false,
        });
      }
    });
  }

  function renderDrawingScreen(room) {
    if (room.currentPrompt) {
      document.getElementById('drawPromptCategory').textContent = room.currentPrompt.category || 'נושא לציור';
      document.getElementById('drawPromptIcon').textContent = room.currentPrompt.icon || '🎨';
      document.getElementById('drawPromptText').textContent = room.currentPrompt.he;
    }

    const doneCount = room.players.filter((p) => p.hasSubmitted).length;
    document.getElementById('submittedCounter').textContent = `${doneCount}/${room.players.length} סיימו`;
  }

  async function submitMyDrawing() {
    if (!activeRoomCode) return;
    const strokes = window.DrawEngine.getStrokes();
    window.DrawEngine.setEnabled(false);
    document.getElementById('submittedOverlay').hidden = false;

    await db.collection('rooms').doc(activeRoomCode).update({
      [`drawingsMap.${myPlayerId}`]: {
        playerId: myPlayerId,
        strokes,
        dataUrl: null,
        isSubmitted: true,
        submittedAt: Date.now(),
      },
    });
  }

  async function checkIfAllSubmitted(room) {
    if (room.state !== 'DRAWING' || isTransitioning) return;
    const allSubmitted = room.players.length > 0 && room.players.every((p) => p.hasSubmitted);
    if (allSubmitted) {
      await transitionToVotingPhase(room);
    }
  }

  async function transitionToVotingPhase(room) {
    if (!activeRoomCode || isTransitioning || room.state !== 'DRAWING') return;
    isTransitioning = true;

    // Save current local canvas strokes first if not yet submitted
    const myLocalStrokes = window.DrawEngine.getStrokes();
    const updates = {
      state: 'VOTING',
      roundEndsAt: null,
      [`drawingsMap.${myPlayerId}.strokes`]: myLocalStrokes,
      [`drawingsMap.${myPlayerId}.isSubmitted`]: true,
    };

    // Have bots cast ratings automatically
    for (const bot of room.players) {
      if (!bot.isBot) continue;
      for (const target of room.players) {
        if (target.id === bot.id) continue;
        const stars = Math.floor(Math.random() * 2) + 4; // 4 or 5 stars
        updates[`ratingsMap.${target.id}.${bot.id}`] = stars;
      }
    }

    try {
      await db.collection('rooms').doc(activeRoomCode).update(updates);
    } catch (e) {
      isTransitioning = false;
    }
  }

  function startCountdown(roundEndsAt) {
    stopCountdown();
    if (!roundEndsAt) return;

    const totalSec = (currentRoom && currentRoom.settings.drawDurationSec) || 45;
    const circle = document.getElementById('timerCircle');
    const textEl = document.getElementById('timerSeconds');
    const widget = document.getElementById('timerWidget');
    const circumference = 2 * Math.PI * 26;
    circle.style.strokeDasharray = `${circumference}`;

    function tick() {
      const remainingMs = Math.max(0, roundEndsAt - Date.now());
      const remainingSec = Math.ceil(remainingMs / 1000);

      textEl.textContent = remainingSec;
      const ratio = Math.max(0, Math.min(1, remainingMs / (totalSec * 1000)));
      circle.style.strokeDashoffset = `${circumference * (1 - ratio)}`;

      widget.classList.toggle('urgent', remainingSec <= 10);

      if (remainingMs <= 0 && currentRoom && currentRoom.state === 'DRAWING') {
        stopCountdown();
        transitionToVotingPhase(currentRoom);
      }
    }

    tick();
    countdownInterval = setInterval(tick, 250);
  }

  function stopCountdown() {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
  }

  // ==================== 4. VOTING & GALLERY REVEAL SCREEN ====================
  function setupVotingAndResults() {
    document.getElementById('finishVotingBtn').addEventListener('click', async () => {
      if (!activeRoomCode || !currentRoom) return;

      // Compute scores and update playersMap
      const updates = {
        state: 'RESULTS',
        promptChoices: getPromptChoices(3, currentRoom.usedPrompts || []),
      };

      let highestAvg = -1;
      let winners = [];

      for (const p of currentRoom.players) {
        const stats = p.ratingStats || { average: 0, totalStars: 0, count: 0 };
        const roundPoints = Math.round(stats.average * 20) + stats.totalStars * 5;
        updates[`playersMap.${p.id}.lastRoundPoints`] = roundPoints;
        updates[`playersMap.${p.id}.totalScore`] = (p.totalScore || 0) + roundPoints;

        if (stats.count > 0 && stats.average > highestAvg) {
          highestAvg = stats.average;
          winners = [p.id];
        } else if (stats.count > 0 && stats.average === highestAvg) {
          winners.push(p.id);
        }
      }

      for (const winId of winners) {
        const winPlayer = currentRoom.players.find((pl) => pl.id === winId);
        if (winPlayer) {
          updates[`playersMap.${winId}.roundsWon`] = (winPlayer.roundsWon || 0) + 1;
        }
      }

      await db.collection('rooms').doc(activeRoomCode).update(updates);
    });

    document.getElementById('nextRoundBtn').addEventListener('click', () => {
      startNewDrawingRound(null);
    });

    document.getElementById('backToLobbyBtn').addEventListener('click', async () => {
      if (!activeRoomCode) return;
      await db.collection('rooms').doc(activeRoomCode).update({
        state: 'LOBBY',
      });
    });
  }

  function renderVotingScreen(room, isInitialEnter) {
    const isHost = room.hostId === myPlayerId;
    document.getElementById('votingPromptTitle').textContent = room.currentPrompt
      ? `${room.currentPrompt.icon} ${room.currentPrompt.he}`
      : '';

    document.getElementById('finishVotingBtn').hidden = !isHost;

    const grid = document.getElementById('galleryGrid');

    if (isInitialEnter || grid.children.length !== room.gallery.length) {
      grid.innerHTML = '';
      lastReactionCount = (room.reactionsList || []).length;

      room.gallery.forEach((item) => {
        const isMine = item.playerId === myPlayerId && room.players.length > 1;
        const card = document.createElement('div');
        card.className = 'gallery-card card';
        card.dataset.playerId = item.playerId;

        card.innerHTML = `
          <div class="gallery-card-header">
            <div class="artist-badge">
              <span class="artist-avatar">${item.playerAvatar}</span>
              <div>
                <strong class="artist-name">${escapeHtml(item.playerName)}</strong>
                ${item.playerId === myPlayerId ? '<span class="me-tag">(הציור שלך)</span>' : ''}
              </div>
            </div>
            <div class="live-score-pill" id="scorePill_${item.playerId}">
              ⭐ <strong class="avg-val">${item.ratingStats.average || '—'}</strong>
              <span class="vote-count">(${item.ratingStats.count} דירוגים)</span>
            </div>
          </div>

          <div class="gallery-canvas-wrap">
            <canvas class="gallery-canvas" id="galCanvas_${item.playerId}"></canvas>
            <div class="floating-reactions" id="reactions_${item.playerId}"></div>
            <button class="btn-replay-mini" data-replay-id="${item.playerId}" title="נגן הילוך חוזר של הציור">▶️ הילוך חוזר</button>
          </div>

          <div class="gallery-card-footer">
            ${
              isMine
                ? `<div class="own-drawing-note">זה הציור שלך! שחקנים אחרים מדרגים אותו כעת 🎨</div>`
                : `
                  <div class="star-rating-row" data-target-id="${item.playerId}">
                    <span class="rate-label">תן ציון:</span>
                    <div class="stars-group">
                      ${[1, 2, 3, 4, 5]
                        .map(
                          (num) => `
                        <button type="button" class="star-btn ${
                          myRatingsThisRound[item.playerId] >= num ? 'active' : ''
                        }" data-stars="${num}" title="${num} כוכבים">★</button>
                      `
                        )
                        .join('')}
                    </div>
                  </div>
                `
            }
            <div class="emoji-bar" data-target-id="${item.playerId}">
              ${['🔥', '😍', '😂', '👏', '🎨'].map((em) => `<button type="button" class="emoji-btn" data-emoji="${em}">${em}</button>`).join('')}
            </div>
          </div>
        `;

        grid.appendChild(card);

        const targetCanvas = card.querySelector(`#galCanvas_${item.playerId}`);
        setTimeout(() => {
          window.DrawEngine.renderToGalleryCanvas(targetCanvas, item.strokes, item.dataUrl, true);
        }, 60);

        card.querySelector('.btn-replay-mini').addEventListener('click', () => {
          window.DrawEngine.renderToGalleryCanvas(targetCanvas, item.strokes, item.dataUrl, true);
        });

        const starRow = card.querySelector('.star-rating-row');
        if (starRow) {
          const starBtns = starRow.querySelectorAll('.star-btn');
          starBtns.forEach((btn) => {
            btn.addEventListener('click', async () => {
              const stars = Number(btn.dataset.stars);
              myRatingsThisRound[item.playerId] = stars;
              starBtns.forEach((b) => {
                b.classList.toggle('active', Number(b.dataset.stars) <= stars);
              });
              await db
                .collection('rooms')
                .doc(activeRoomCode)
                .update({
                  [`ratingsMap.${item.playerId}.${myPlayerId}`]: stars,
                });
            });
          });
        }

        card.querySelectorAll('.emoji-btn').forEach((eb) => {
          eb.addEventListener('click', async () => {
            const emoji = eb.dataset.emoji;
            spawnFloatingEmoji(item.playerId, emoji);
            await db
              .collection('rooms')
              .doc(activeRoomCode)
              .update({
                reactionsList: firebase.firestore.FieldValue.arrayUnion({
                  targetPlayerId: item.playerId,
                  emoji,
                  ts: Date.now() + Math.random(),
                }),
              });
          });
        });
      });
    } else {
      room.gallery.forEach((item) => {
        const pill = document.getElementById(`scorePill_${item.playerId}`);
        if (pill) {
          pill.querySelector('.avg-val').textContent = item.ratingStats.average || '—';
          pill.querySelector('.vote-count').textContent = `(${item.ratingStats.count} דירוגים)`;
        }
      });

      const list = room.reactionsList || [];
      if (list.length > lastReactionCount) {
        const newest = list.slice(lastReactionCount);
        newest.forEach((r) => spawnFloatingEmoji(r.targetPlayerId, r.emoji));
        lastReactionCount = list.length;
      }
    }
  }

  function spawnFloatingEmoji(targetPlayerId, emoji) {
    const container = document.getElementById(`reactions_${targetPlayerId}`);
    if (!container) return;
    const span = document.createElement('span');
    span.className = 'floating-emoji';
    span.textContent = emoji;
    span.style.left = `${20 + Math.random() * 60}%`;
    container.appendChild(span);
    setTimeout(() => span.remove(), 1800);
  }

  // ==================== 5. RESULTS & PODIUM SCREEN ====================
  function renderResultsScreen(room, isInitialEnter) {
    const isHost = room.hostId === myPlayerId;
    document.getElementById('resultsRoundNum').textContent = room.currentRound;
    document.getElementById('resultsPromptTitle').textContent = room.currentPrompt
      ? `${room.currentPrompt.icon} ${room.currentPrompt.he}`
      : '';

    document.getElementById('hostNextRoundControls').hidden = !isHost;
    document.getElementById('resultsGuestWait').hidden = isHost;

    const sortedGallery = [...room.gallery].sort(
      (a, b) => b.ratingStats.average - a.ratingStats.average || b.ratingStats.totalStars - a.ratingStats.totalStars
    );

    const podiumGrid = document.getElementById('resultsPodiumGrid');
    if (isInitialEnter || podiumGrid.children.length !== sortedGallery.length) {
      podiumGrid.innerHTML = '';
      sortedGallery.forEach((item, index) => {
        const medal =
          index === 0 ? '🥇 מקום 1' : index === 1 ? '🥈 מקום 2' : index === 2 ? '🥉 מקום 3' : `#${index + 1}`;
        const card = document.createElement('div');
        card.className = `podium-card card rank-${index + 1}`;
        card.innerHTML = `
          <div class="podium-medal">${medal}</div>
          <div class="podium-artist">
            <span class="artist-avatar">${item.playerAvatar}</span>
            <strong>${escapeHtml(item.playerName)}</strong>
          </div>
          <div class="podium-canvas-box">
            <canvas id="resCanvas_${item.playerId}"></canvas>
          </div>
          <div class="podium-score">
            <span class="big-stars">⭐ ${item.ratingStats.average || 0}</span>
            <span class="sub-stars">(${item.ratingStats.totalStars} כוכבים סה"כ)</span>
          </div>
        `;
        podiumGrid.appendChild(card);

        const cEl = card.querySelector(`#resCanvas_${item.playerId}`);
        setTimeout(() => {
          window.DrawEngine.renderToGalleryCanvas(cEl, item.strokes, item.dataUrl, false);
        }, 50);
      });
    }

    const sbList = document.getElementById('scoreboardList');
    sbList.innerHTML = '';
    const sortedPlayers = [...room.players].sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
    sortedPlayers.forEach((p, idx) => {
      const row = document.createElement('div');
      row.className = 'scoreboard-row' + (p.id === myPlayerId ? ' is-me' : '');
      row.innerHTML = `
        <div class="sb-rank">${idx + 1}</div>
        <div class="sb-player">
          <span class="sb-avatar">${p.avatar}</span>
          <strong>${escapeHtml(p.name)}</strong>
          ${p.roundsWon > 0 ? `<span class="sb-wins">🏆 ${p.roundsWon} ניצחונות</span>` : ''}
        </div>
        <div class="sb-points">
          <strong>${p.totalScore || 0}</strong> נק׳
          ${p.lastRoundPoints ? `<span class="sb-delta">(+${p.lastRoundPoints})</span>` : ''}
        </div>
      `;
      sbList.appendChild(row);
    });
  }

  // ==================== PROCEDURAL BOT DRAWINGS ====================
  function generateBotDrawing(promptHe = '', style = 'artistic') {
    const strokes = [];
    const colors = ['#1e293b', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

    const makeCircle = (cx, cy, rx, ry, color, size = 5, steps = 26) => {
      const points = [];
      const jitter = style === 'sketchy' ? 0.008 : 0.002;
      for (let i = 0; i <= steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        points.push({
          x: Number(Math.max(0.05, Math.min(0.95, cx + Math.cos(angle) * rx + (Math.random() - 0.5) * jitter)).toFixed(3)),
          y: Number(Math.max(0.05, Math.min(0.95, cy + Math.sin(angle) * ry + (Math.random() - 0.5) * jitter)).toFixed(3)),
        });
      }
      return { tool: 'pen', color, size, points };
    };

    const makeLine = (pts, color, size = 5) => ({
      tool: 'pen',
      color,
      size,
      points: pts.map(([x, y]) => ({ x, y })),
    });

    if (promptHe.includes('חתול') || promptHe.includes('כלב') || promptHe.includes('חי')) {
      strokes.push(makeCircle(0.5, 0.55, 0.22, 0.2, '#3b82f6', 4));
      strokes.push(makeCircle(0.5, 0.56, 0.14, 0.13, '#f59e0b', 6));
      strokes.push(makeLine([[0.39, 0.46], [0.35, 0.34], [0.45, 0.43]], '#f59e0b', 6));
      strokes.push(makeLine([[0.61, 0.46], [0.65, 0.34], [0.55, 0.43]], '#f59e0b', 6));
      strokes.push(makeCircle(0.45, 0.53, 0.015, 0.015, '#1e293b', 5, 10));
      strokes.push(makeCircle(0.55, 0.53, 0.015, 0.015, '#1e293b', 5, 10));
      strokes.push(makeLine([[0.46, 0.6], [0.5, 0.63], [0.54, 0.6]], '#ef4444', 4));
    } else if (promptHe.includes('פיצה') || promptHe.includes('המבורגר') || promptHe.includes('אוכל')) {
      strokes.push(makeLine([[0.5, 0.25], [0.28, 0.75], [0.72, 0.75], [0.5, 0.25]], '#f59e0b', 8));
      strokes.push(makeLine([[0.26, 0.75], [0.5, 0.8], [0.74, 0.75]], '#d97706', 12));
      strokes.push(makeCircle(0.45, 0.55, 0.035, 0.035, '#ef4444', 8, 12));
      strokes.push(makeCircle(0.55, 0.62, 0.035, 0.035, '#ef4444', 8, 12));
      strokes.push(makeCircle(0.5, 0.44, 0.03, 0.03, '#ef4444', 8, 12));
      strokes.push(makeLine([[0.35, 0.5], [0.15, 0.38], [0.22, 0.52], [0.14, 0.58], [0.32, 0.6]], '#3b82f6', 5));
      strokes.push(makeLine([[0.65, 0.5], [0.85, 0.38], [0.78, 0.52], [0.86, 0.58], [0.68, 0.6]], '#3b82f6', 5));
    } else {
      const mainColor = colors[Math.floor(Math.random() * colors.length)];
      strokes.push(makeCircle(0.82, 0.2, 0.07, 0.07, '#f59e0b', 6, 18));
      strokes.push(makeCircle(0.5, 0.4, 0.11, 0.11, mainColor, 6, 22));
      strokes.push(makeCircle(0.46, 0.38, 0.012, 0.012, '#1e293b', 5, 8));
      strokes.push(makeCircle(0.54, 0.38, 0.012, 0.012, '#1e293b', 5, 8));
      strokes.push(makeLine([[0.45, 0.44], [0.5, 0.47], [0.55, 0.44]], '#1e293b', 4));
      strokes.push(makeLine([[0.5, 0.51], [0.5, 0.72]], mainColor, 7));
      strokes.push(makeLine([[0.34, 0.56], [0.5, 0.58], [0.66, 0.52]], mainColor, 6));
      strokes.push(makeLine([[0.4, 0.86], [0.5, 0.72], [0.6, 0.86]], mainColor, 6));
      strokes.push(makeLine([[0.1, 0.88], [0.3, 0.85], [0.5, 0.89], [0.7, 0.85], [0.9, 0.88]], '#10b981', 8));
    }
    return strokes;
  }

  function showToast(message, kind = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${kind}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  window.addEventListener('DOMContentLoaded', initApp);
})();
