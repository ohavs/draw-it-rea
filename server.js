const http = require('http');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { WebSocketServer } = require('ws');
const { Room, ROOM_STATES } = require('./room');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Active rooms map: Map<roomCode, Room>
const rooms = new Map();

// Map<roomCode, Timeout> for round timers
const roomTimers = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

// Create a default public lobby "DRAW" so anyone can jump right in if they want
const defaultRoom = new Room('DRAW', null, null);
rooms.set('DRAW', defaultRoom);

// REST endpoint to list active lobbies
app.get('/api/rooms', (req, res) => {
  const list = Array.from(rooms.values()).map((r) => ({
    code: r.code,
    state: r.state,
    playerCount: r.players.size,
    drawDurationSec: r.settings.drawDurationSec,
  }));
  res.json({ rooms: list });
});

function broadcastRoom(roomCode, extraEvent = null) {
  const room = rooms.get(roomCode);
  if (!room) return;
  const snapshot = room.getSnapshot();
  const payload = JSON.stringify({
    type: 'ROOM_STATE',
    room: snapshot,
    event: extraEvent,
  });

  for (const client of wss.clients) {
    if (client.readyState === 1 && client.roomCode === roomCode) {
      client.send(payload);
    }
  }
}

function scheduleRoundTimer(room) {
  clearRoundTimer(room.code);
  const durationMs = Math.max(1000, room.roundEndsAt - Date.now());
  const timer = setTimeout(() => {
    if (room.state === ROOM_STATES.DRAWING) {
      room.transitionToVoting();
      broadcastRoom(room.code, {
        kind: 'TIME_UP',
        message: '⏰ הזמן נגמר! עוברים לתערוכת הציורים ולדירוגים!',
      });
    }
  }, durationMs);
  roomTimers.set(room.code, timer);
}

function clearRoundTimer(roomCode) {
  const existing = roomTimers.get(roomCode);
  if (existing) {
    clearTimeout(existing);
    roomTimers.delete(roomCode);
  }
}

wss.on('connection', (ws) => {
  ws.playerId = null;
  ws.roomCode = null;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    try {
      handleMessage(ws, msg);
    } catch (err) {
      ws.send(
        JSON.stringify({
          type: 'ERROR',
          message: err.message || 'שגיאה בביצוע הפעולה',
        })
      );
    }
  });

  ws.on('close', () => {
    if (ws.roomCode && ws.playerId) {
      const room = rooms.get(ws.roomCode);
      if (room) {
        const p = room.players.get(ws.playerId);
        if (p) {
          p.isConnected = false;
          // If in lobby, remove disconnected player cleanly
          if (room.state === ROOM_STATES.LOBBY) {
            room.removePlayer(ws.playerId);
          }
          broadcastRoom(room.code);
        }
      }
    }
  });
});

function handleMessage(ws, msg) {
  const { type } = msg;

  if (type === 'CREATE_OR_JOIN') {
    const playerName = (msg.name || 'אמן אנונימי').trim().slice(0, 20);
    const avatar = msg.avatar || '🎨';
    let code = (msg.roomCode || '').trim().toUpperCase();
    const playerId = msg.playerId || `p_${crypto.randomBytes(6).toString('hex')}`;

    let room;
    if (!code) {
      code = generateRoomCode();
      room = new Room(code, playerId, playerName, avatar);
      rooms.set(code, room);
    } else {
      room = rooms.get(code);
      if (!room) {
        room = new Room(code, playerId, playerName, avatar);
        rooms.set(code, room);
      } else {
        // Reconnect or add new player
        if (room.players.has(playerId)) {
          const existing = room.players.get(playerId);
          existing.isConnected = true;
          existing.name = playerName || existing.name;
          existing.avatar = avatar || existing.avatar;
        } else {
          room.addPlayer(playerId, playerName, avatar, false);
        }
        if (!room.hostId || !room.players.has(room.hostId)) {
          room.hostId = playerId;
        }
      }
    }

    ws.playerId = playerId;
    ws.roomCode = code;

    ws.send(
      JSON.stringify({
        type: 'JOINED',
        playerId,
        roomCode: code,
        room: room.getSnapshot(),
      })
    );

    broadcastRoom(code, {
      kind: 'PLAYER_JOINED',
      message: `${playerName} הצטרף ללובי!`,
    });
    return;
  }

  const room = rooms.get(ws.roomCode);
  if (!room) throw new Error('החדר לא נמצא');

  switch (type) {
    case 'UPDATE_SETTINGS': {
      room.updateSettings(ws.playerId, msg.settings || {});
      broadcastRoom(room.code);
      break;
    }

    case 'ADD_BOT': {
      const bot = room.addBot();
      broadcastRoom(room.code, {
        kind: 'BOT_ADDED',
        message: `${bot.name} הצטרף למשחק!`,
      });
      break;
    }

    case 'REMOVE_BOT': {
      const botId = msg.botId;
      const target = room.players.get(botId);
      if (target && target.isBot) {
        room.removePlayer(botId);
        broadcastRoom(room.code);
      }
      break;
    }

    case 'START_ROUND': {
      room.startRound(ws.playerId, msg.promptText || null);
      scheduleRoundTimer(room);
      broadcastRoom(room.code, {
        kind: 'ROUND_STARTED',
        message: `סיבוב ${room.currentRound} התחיל! הנושא: ${room.currentPrompt.he}`,
      });
      break;
    }

    case 'LIVE_STROKES': {
      // Save player's work-in-progress so if the timer hits 0, their drawing is still preserved!
      room.updateLiveStrokes(ws.playerId, msg.strokes, msg.dataUrl);
      break;
    }

    case 'SUBMIT_DRAWING': {
      const transitioned = room.submitDrawing(ws.playerId, msg.strokes, msg.dataUrl);
      if (transitioned) {
        clearRoundTimer(room.code);
        broadcastRoom(room.code, {
          kind: 'ALL_SUBMITTED',
          message: '🎨 כל השחקנים סיימו לצייר! עוברים לשלב הצגת הציורים והדירוגים!',
        });
      } else {
        broadcastRoom(room.code);
      }
      break;
    }

    case 'FORCE_END_DRAWING': {
      if (ws.playerId !== room.hostId) {
        throw new Error('רק מנהל החדר יכול לסיים את הזמן מוקדם');
      }
      clearRoundTimer(room.code);
      room.transitionToVoting();
      broadcastRoom(room.code);
      break;
    }

    case 'RATE_DRAWING': {
      room.rateDrawing(ws.playerId, msg.targetPlayerId, msg.stars);
      broadcastRoom(room.code, {
        kind: 'RATING_UPDATED',
        targetPlayerId: msg.targetPlayerId,
        voterId: ws.playerId,
        stars: msg.stars,
      });
      break;
    }

    case 'SEND_REACTION': {
      room.addReaction(ws.playerId, msg.targetPlayerId, msg.emoji);
      broadcastRoom(room.code, {
        kind: 'REACTION',
        targetPlayerId: msg.targetPlayerId,
        emoji: msg.emoji,
      });
      break;
    }

    case 'FINISH_VOTING': {
      room.finishVoting(ws.playerId);
      broadcastRoom(room.code, {
        kind: 'RESULTS_READY',
        message: '🏆 תוצאות הסיבוב מוכנות!',
      });
      break;
    }

    case 'RETURN_TO_LOBBY': {
      clearRoundTimer(room.code);
      room.returnToLobby(ws.playerId);
      broadcastRoom(room.code);
      break;
    }

    default:
      break;
  }
}

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`🎨 Draw It Server running at http://localhost:${PORT}`);
  });
}

module.exports = { app, server, rooms };
