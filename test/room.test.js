const test = require('node:test');
const assert = require('node:assert/strict');
const { Room, ROOM_STATES } = require('../room');

test('Draw It Room lifecycle: Lobby -> Timed Drawing (30-60s) -> Voting Gallery -> Results', () => {
  const room = new Room('TEST', 'p1', 'Alice', '🦊');
  room.addPlayer('p2', 'Bob', '🐼');
  room.addBot();

  assert.equal(room.state, ROOM_STATES.LOBBY);
  assert.equal(room.players.size, 3);

  // Set duration between 30 and 60 seconds
  room.updateSettings('p1', { drawDurationSec: 40 });
  assert.equal(room.settings.drawDurationSec, 40);

  // Start round with a specific prompt
  room.startRound('p1', 'חתול חלל עם קסדה');
  assert.equal(room.state, ROOM_STATES.DRAWING);
  assert.equal(room.currentPrompt.he, 'חתול חלל עם קסדה');

  // Players submit drawings
  const sampleStrokes = [{ tool: 'pen', color: '#ef4444', size: 6, points: [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.8 }] }];
  const transitioned1 = room.submitDrawing('p1', sampleStrokes, null);
  assert.equal(transitioned1, false); // p2 hasn't submitted yet

  const transitioned2 = room.submitDrawing('p2', sampleStrokes, null);
  assert.equal(transitioned2, true); // all humans submitted -> auto transitions to VOTING!
  assert.equal(room.state, ROOM_STATES.VOTING);

  const snapshot = room.getSnapshot();
  assert.equal(snapshot.gallery.length, 3);

  // Players rate each other's drawings (1..5 stars)
  room.rateDrawing('p1', 'p2', 5);
  room.rateDrawing('p2', 'p1', 4);

  const p2Stats = room.getPlayerRatingStats('p2');
  assert.ok(p2Stats.average >= 4);
  assert.ok(p2Stats.count >= 2); // p1 + AI bot

  // Finish voting and compute results
  room.finishVoting('p1');
  assert.equal(room.state, ROOM_STATES.RESULTS);
  assert.ok(room.players.get('p2').totalScore > 0);
});
