const { getRandomPrompt, getPromptChoices } = require('./prompts');

const ROOM_STATES = Object.freeze({
  LOBBY: 'LOBBY',
  DRAWING: 'DRAWING',
  VOTING: 'VOTING',
  RESULTS: 'RESULTS',
});

const AVATARS = ['🎨', '🦊', '🐼', '🦁', '🐸', '🦄', '🐙', '🐵', '🐯', '🐨', '🐲', '👽'];

const BOT_PROFILES = [
  { name: 'פיקאסו בוט 🤖', avatar: '🤖', style: 'geometric' },
  { name: 'דאלי הקטן 🎨', avatar: '🎨', style: 'artistic' },
  { name: 'שרבוטון ⚡', avatar: '⚡', style: 'sketchy' },
];

class Room {
  constructor(code, hostId, hostName, hostAvatar) {
    this.code = code;
    this.state = ROOM_STATES.LOBBY;
    this.hostId = hostId;
    this.players = new Map();

    // Game settings configurable in lobby
    this.settings = {
      drawDurationSec: 45, // 30 to 60 seconds (default 45s)
      totalRounds: 3,
      customPrompt: null,
    };

    this.currentRound = 0;
    this.currentPrompt = null;
    this.usedPrompts = [];
    this.promptChoices = getPromptChoices(3, []);
    this.roundEndsAt = null;

    // Drawings submitted in current round: Map<playerId, { strokes, dataUrl, submittedAt }>
    this.drawings = new Map();

    // Ratings in current round: Map<targetPlayerId, Map<voterId, number (1..5)>>
    this.ratings = new Map();

    // Reactions in current round: Map<targetPlayerId, Array<{ fromName, emoji }>>
    this.reactions = new Map();

    // Players who clicked "Ready for next round" in VOTING/RESULTS
    this.readyNext = new Set();

    if (hostId && hostName) {
      this.addPlayer(hostId, hostName, hostAvatar, false);
    }
  }

  addPlayer(playerId, name, avatar, isBot = false, botStyle = 'artistic') {
    const cleanName = (name || '').trim().slice(0, 20) || `שחקן ${this.players.size + 1}`;
    let finalName = cleanName;
    let suffix = 2;
    const existingNames = new Set(Array.from(this.players.values()).map((p) => p.name));
    while (existingNames.has(finalName)) {
      finalName = `${cleanName} (${suffix++})`;
    }

    const chosenAvatar = avatar || AVATARS[this.players.size % AVATARS.length];
    this.players.set(playerId, {
      id: playerId,
      name: finalName,
      avatar: chosenAvatar,
      isBot: Boolean(isBot),
      botStyle,
      isConnected: true,
      totalScore: 0,
      roundsWon: 0,
      joinedAt: Date.now(),
    });
    return this.players.get(playerId);
  }

  addBot() {
    const existingBots = Array.from(this.players.values()).filter((p) => p.isBot);
    if (existingBots.length >= 4) {
      throw new Error('ניתן להוסיף עד 4 שחקני AI לחדר');
    }
    const profile = BOT_PROFILES[existingBots.length % BOT_PROFILES.length];
    const botId = `bot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    return this.addPlayer(botId, profile.name, profile.avatar, true, profile.style);
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
    this.drawings.delete(playerId);
    this.ratings.delete(playerId);
    this.readyNext.delete(playerId);

    // If host left, assign a new human host
    if (this.hostId === playerId) {
      const nextHuman = Array.from(this.players.values()).find((p) => !p.isBot && p.isConnected);
      if (nextHuman) {
        this.hostId = nextHuman.id;
      }
    }
  }

  updateSettings(callerId, newSettings = {}) {
    if (callerId !== this.hostId) {
      throw new Error('רק מנהל החדר יכול לשנות הגדרות');
    }
    if (this.state !== ROOM_STATES.LOBBY) {
      throw new Error('ניתן לשנות הגדרות רק בלובי');
    }
    if (typeof newSettings.drawDurationSec === 'number') {
      const clamped = Math.max(30, Math.min(60, Math.round(newSettings.drawDurationSec)));
      this.settings.drawDurationSec = clamped;
    }
    if (typeof newSettings.totalRounds === 'number') {
      this.settings.totalRounds = Math.max(1, Math.min(10, Math.round(newSettings.totalRounds)));
    }
    if (typeof newSettings.customPrompt === 'string') {
      const trimmed = newSettings.customPrompt.trim().slice(0, 40);
      this.settings.customPrompt = trimmed || null;
    }
  }

  startRound(callerId, chosenPromptText = null) {
    if (callerId && callerId !== this.hostId) {
      throw new Error('רק מנהל החדר יכול להתחיל את הסיבוב');
    }
    if (this.players.size < 1) {
      throw new Error('נדרש לפחות שחקן אחד');
    }

    this.currentRound += 1;
    this.drawings.clear();
    this.ratings.clear();
    this.reactions.clear();
    this.readyNext.clear();

    // Select prompt
    if (chosenPromptText && chosenPromptText.trim()) {
      this.currentPrompt = {
        he: chosenPromptText.trim(),
        en: 'Custom Topic',
        category: 'בחירה מיוחדת 🌟',
        icon: '✨',
      };
    } else if (this.settings.customPrompt) {
      this.currentPrompt = {
        he: this.settings.customPrompt,
        en: 'Custom Prompt',
        category: 'נושא מותאם אישית 🎯',
        icon: '🎨',
      };
      this.settings.customPrompt = null; // consume custom prompt
    } else {
      this.currentPrompt = getRandomPrompt(this.usedPrompts);
    }

    this.usedPrompts.push(this.currentPrompt.he);
    this.state = ROOM_STATES.DRAWING;
    this.roundEndsAt = Date.now() + this.settings.drawDurationSec * 1000;

    // Initialize empty drawing & rating containers for all players
    for (const player of this.players.values()) {
      this.ratings.set(player.id, new Map());
      this.reactions.set(player.id, []);
      if (player.isBot) {
        // Generate procedural bot drawing for the current prompt
        const botStrokes = generateBotDrawing(this.currentPrompt.he, player.botStyle);
        this.drawings.set(player.id, {
          playerId: player.id,
          strokes: botStrokes,
          dataUrl: null,
          isSubmitted: true,
          submittedAt: Date.now() + Math.floor(Math.random() * 5000),
        });
      } else {
        this.drawings.set(player.id, {
          playerId: player.id,
          strokes: [],
          dataUrl: null,
          isSubmitted: false,
          submittedAt: null,
        });
      }
    }
  }

  updateLiveStrokes(playerId, strokes, dataUrl = null) {
    if (this.state !== ROOM_STATES.DRAWING) return false;
    if (!this.players.has(playerId)) return false;
    const existing = this.drawings.get(playerId) || {
      playerId,
      strokes: [],
      dataUrl: null,
      isSubmitted: false,
    };
    existing.strokes = Array.isArray(strokes) ? strokes : existing.strokes;
    if (dataUrl) existing.dataUrl = dataUrl;
    this.drawings.set(playerId, existing);
    return true;
  }

  submitDrawing(playerId, strokes, dataUrl = null) {
    if (this.state !== ROOM_STATES.DRAWING) return false;
    if (!this.players.has(playerId)) return false;

    this.drawings.set(playerId, {
      playerId,
      strokes: Array.isArray(strokes) ? strokes : [],
      dataUrl: dataUrl || null,
      isSubmitted: true,
      submittedAt: Date.now(),
    });

    // Check if all connected human players have submitted
    const allHumansSubmitted = Array.from(this.players.values())
      .filter((p) => !p.isBot && p.isConnected)
      .every((p) => {
        const d = this.drawings.get(p.id);
        return d && d.isSubmitted;
      });

    if (allHumansSubmitted) {
      this.transitionToVoting();
      return true; // transitioned
    }
    return false;
  }

  transitionToVoting() {
    if (this.state !== ROOM_STATES.DRAWING) return;
    this.state = ROOM_STATES.VOTING;
    this.roundEndsAt = null;
    this.readyNext.clear();

    // Bots automatically cast fair/fun ratings (3 to 5 stars) for all other drawings
    for (const bot of this.players.values()) {
      if (!bot.isBot) continue;
      for (const target of this.players.values()) {
        if (target.id === bot.id) continue;
        const targetDrawing = this.drawings.get(target.id);
        const hasContent =
          targetDrawing &&
          ((targetDrawing.strokes && targetDrawing.strokes.length > 0) || targetDrawing.dataUrl);
        const stars = hasContent ? Math.floor(Math.random() * 2) + 4 : 2; // 4-5 stars if drew something
        const targetRatings = this.ratings.get(target.id) || new Map();
        targetRatings.set(bot.id, stars);
        this.ratings.set(target.id, targetRatings);
      }
    }
  }

  rateDrawing(voterId, targetPlayerId, stars) {
    if (this.state !== ROOM_STATES.VOTING && this.state !== ROOM_STATES.RESULTS) {
      throw new Error('לא ניתן לדרג כעת');
    }
    if (!this.players.has(voterId) || !this.players.has(targetPlayerId)) {
      throw new Error('שחקן לא נמצא');
    }
    if (voterId === targetPlayerId && this.players.size > 1) {
      throw new Error('אי אפשר לדרג את הציור של עצמך כשיש שחקנים נוספים!');
    }
    const cleanStars = Math.max(1, Math.min(5, Math.round(Number(stars) || 1)));
    if (!this.ratings.has(targetPlayerId)) {
      this.ratings.set(targetPlayerId, new Map());
    }
    this.ratings.get(targetPlayerId).set(voterId, cleanStars);

    // Check if all human voters have rated all other players' drawings
    this._checkAllRated();
  }

  addReaction(fromPlayerId, targetPlayerId, emoji) {
    const sender = this.players.get(fromPlayerId);
    if (!sender || !this.players.has(targetPlayerId)) return;
    const allowed = ['🔥', '😂', '😍', '👏', '🎨', '💎'];
    if (!allowed.includes(emoji)) return;
    const list = this.reactions.get(targetPlayerId) || [];
    if (list.length < 30) {
      list.push({ fromId: fromPlayerId, fromName: sender.name, emoji, id: Date.now() + Math.random() });
      this.reactions.set(targetPlayerId, list);
    }
  }

  _checkAllRated() {
    const humans = Array.from(this.players.values()).filter((p) => !p.isBot && p.isConnected);
    const totalPlayers = this.players.size;
    if (humans.length === 0) return;

    const everyoneFinishedVoting = humans.every((voter) => {
      let ratedCount = 0;
      for (const targetId of this.players.keys()) {
        if (targetId === voter.id && totalPlayers > 1) continue;
        const rMap = this.ratings.get(targetId);
        if (rMap && rMap.has(voter.id)) ratedCount++;
      }
      const expectedCount = totalPlayers > 1 ? totalPlayers - 1 : 1;
      return ratedCount >= expectedCount;
    });

    if (everyoneFinishedVoting && this.state === ROOM_STATES.VOTING) {
      // Everyone voted! We keep them in VOTING so they can see the live scores or host can finalize round
    }
  }

  finishVoting(callerId) {
    if (callerId && callerId !== this.hostId) {
      throw new Error('רק מנהל החדר יכול לסיים את שלב הדירוגים');
    }
    if (this.state !== ROOM_STATES.VOTING) return;

    // Calculate round points and add to player totalScore
    let highestAvg = -1;
    let roundWinners = [];

    for (const player of this.players.values()) {
      const stats = this.getPlayerRatingStats(player.id);
      const roundPoints = Math.round(stats.average * 20) + stats.totalStars * 5;
      player.lastRoundAverage = stats.average;
      player.lastRoundPoints = roundPoints;
      player.totalScore += roundPoints;

      if (stats.count > 0 && stats.average > highestAvg) {
        highestAvg = stats.average;
        roundWinners = [player.id];
      } else if (stats.count > 0 && stats.average === highestAvg) {
        roundWinners.push(player.id);
      }
    }

    for (const winId of roundWinners) {
      const p = this.players.get(winId);
      if (p) p.roundsWon += 1;
    }

    this.state = ROOM_STATES.RESULTS;
    this.promptChoices = getPromptChoices(3, this.usedPrompts);
  }

  returnToLobby(callerId) {
    if (callerId && callerId !== this.hostId) {
      throw new Error('רק מנהל החדר יכול להחזיר ללובי');
    }
    this.state = ROOM_STATES.LOBBY;
    this.currentRound = 0;
    this.currentPrompt = null;
    this.usedPrompts = [];
    this.drawings.clear();
    this.ratings.clear();
    this.reactions.clear();
    for (const p of this.players.values()) {
      p.totalScore = 0;
      p.roundsWon = 0;
      p.lastRoundAverage = 0;
      p.lastRoundPoints = 0;
    }
  }

  getPlayerRatingStats(targetPlayerId) {
    const rMap = this.ratings.get(targetPlayerId);
    if (!rMap || rMap.size === 0) {
      return { average: 0, count: 0, totalStars: 0, breakdown: {} };
    }
    let sum = 0;
    const breakdown = {};
    for (const [voterId, stars] of rMap.entries()) {
      sum += stars;
      breakdown[voterId] = stars;
    }
    const average = Number((sum / rMap.size).toFixed(1));
    return {
      average,
      count: rMap.size,
      totalStars: sum,
      breakdown,
    };
  }

  getSnapshot() {
    const playersList = Array.from(this.players.values()).map((p) => {
      const d = this.drawings.get(p.id);
      const ratingStats = this.getPlayerRatingStats(p.id);
      return {
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        isBot: p.isBot,
        isConnected: p.isConnected,
        totalScore: p.totalScore,
        roundsWon: p.roundsWon,
        lastRoundAverage: p.lastRoundAverage || 0,
        lastRoundPoints: p.lastRoundPoints || 0,
        hasSubmitted: Boolean(d && d.isSubmitted),
        strokeCount: d && d.strokes ? d.strokes.length : 0,
        ratingStats,
      };
    });

    // Only include full drawings when in VOTING or RESULTS state (to keep DRAWING phase secret & lightweight)
    const gallery = [];
    if (this.state === ROOM_STATES.VOTING || this.state === ROOM_STATES.RESULTS) {
      for (const p of this.players.values()) {
        const d = this.drawings.get(p.id) || { strokes: [], dataUrl: null };
        const ratingStats = this.getPlayerRatingStats(p.id);
        const reactions = this.reactions.get(p.id) || [];
        gallery.push({
          playerId: p.id,
          playerName: p.name,
          playerAvatar: p.avatar,
          isBot: p.isBot,
          strokes: d.strokes || [],
          dataUrl: d.dataUrl || null,
          ratingStats,
          reactions,
        });
      }
    }

    return {
      code: this.code,
      state: this.state,
      hostId: this.hostId,
      settings: { ...this.settings },
      currentRound: this.currentRound,
      currentPrompt: this.currentPrompt,
      promptChoices: this.promptChoices,
      roundEndsAt: this.roundEndsAt,
      serverNow: Date.now(),
      players: playersList,
      gallery,
    };
  }
}

/**
 * Generates charming procedural vector strokes on normalized [0..1] coordinates
 * so AI bots in the lobby produce fun drawings at the end of the round!
 */
function generateBotDrawing(promptHe = '', style = 'artistic') {
  const strokes = [];
  const colors = ['#1e293b', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

  // Helper to create a circle/oval stroke
  const makeCircle = (cx, cy, rx, ry, color, size = 5, steps = 28) => {
    const points = [];
    const jitter = style === 'sketchy' ? 0.008 : 0.002;
    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      points.push({
        x: Math.max(0.05, Math.min(0.95, cx + Math.cos(angle) * rx + (Math.random() - 0.5) * jitter)),
        y: Math.max(0.05, Math.min(0.95, cy + Math.sin(angle) * ry + (Math.random() - 0.5) * jitter)),
      });
    }
    return { tool: 'pen', color, size, points };
  };

  // Helper to create a polyline stroke
  const makeLine = (pts, color, size = 5) => ({
    tool: 'pen',
    color,
    size,
    points: pts.map(([x, y]) => ({ x, y })),
  });

  // Base decorative elements depending on keywords in the Hebrew prompt
  if (promptHe.includes('חתול') || promptHe.includes('כלב') || promptHe.includes('חי')) {
    // Cute animal face + ears + space helmet
    strokes.push(makeCircle(0.5, 0.55, 0.22, 0.2, '#3b82f6', 4)); // helmet dome
    strokes.push(makeCircle(0.5, 0.56, 0.14, 0.13, '#f59e0b', 6)); // head
    // Ears
    strokes.push(makeLine([[0.39, 0.46], [0.35, 0.34], [0.45, 0.43]], '#f59e0b', 6));
    strokes.push(makeLine([[0.61, 0.46], [0.65, 0.34], [0.55, 0.43]], '#f59e0b', 6));
    // Eyes & smile
    strokes.push(makeCircle(0.45, 0.53, 0.015, 0.015, '#1e293b', 5, 10));
    strokes.push(makeCircle(0.55, 0.53, 0.015, 0.015, '#1e293b', 5, 10));
    strokes.push(makeLine([[0.46, 0.6], [0.5, 0.63], [0.54, 0.6]], '#ef4444', 4));
  } else if (promptHe.includes('פיצה') || promptHe.includes('המבורגר') || promptHe.includes('אוכל')) {
    // Flying pizza / food art
    strokes.push(makeLine([[0.5, 0.25], [0.28, 0.75], [0.72, 0.75], [0.5, 0.25]], '#f59e0b', 8));
    strokes.push(makeLine([[0.26, 0.75], [0.5, 0.8], [0.74, 0.75]], '#d97706', 12)); // crust
    strokes.push(makeCircle(0.45, 0.55, 0.035, 0.035, '#ef4444', 8, 14)); // pepperoni 1
    strokes.push(makeCircle(0.55, 0.62, 0.035, 0.035, '#ef4444', 8, 14)); // pepperoni 2
    strokes.push(makeCircle(0.5, 0.44, 0.03, 0.03, '#ef4444', 8, 14)); // pepperoni 3
    // Wings
    strokes.push(makeLine([[0.35, 0.5], [0.15, 0.38], [0.22, 0.52], [0.14, 0.58], [0.32, 0.6]], '#3b82f6', 5));
    strokes.push(makeLine([[0.65, 0.5], [0.85, 0.38], [0.78, 0.52], [0.86, 0.58], [0.68, 0.6]], '#3b82f6', 5));
  } else {
    // Creative character + scenery
    const mainColor = colors[Math.floor(Math.random() * colors.length)];
    // Sun in corner
    strokes.push(makeCircle(0.82, 0.2, 0.07, 0.07, '#f59e0b', 6, 20));
    // Character body & head
    strokes.push(makeCircle(0.5, 0.4, 0.11, 0.11, mainColor, 6, 24));
    strokes.push(makeCircle(0.46, 0.38, 0.012, 0.012, '#1e293b', 5, 8));
    strokes.push(makeCircle(0.54, 0.38, 0.012, 0.012, '#1e293b', 5, 8));
    strokes.push(makeLine([[0.45, 0.44], [0.5, 0.47], [0.55, 0.44]], '#1e293b', 4));
    // Body & limbs
    strokes.push(makeLine([[0.5, 0.51], [0.5, 0.72]], mainColor, 7));
    strokes.push(makeLine([[0.34, 0.56], [0.5, 0.58], [0.66, 0.52]], mainColor, 6));
    strokes.push(makeLine([[0.4, 0.86], [0.5, 0.72], [0.6, 0.86]], mainColor, 6));
    // Ground / wave
    strokes.push(makeLine([[0.1, 0.88], [0.3, 0.85], [0.5, 0.89], [0.7, 0.85], [0.9, 0.88]], '#10b981', 8));
  }

  return strokes;
}

module.exports = { Room, ROOM_STATES, AVATARS };
