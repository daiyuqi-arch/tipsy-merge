'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function makeCtx() {
  const gradient = { addColorStop() {} };
  return {
    setTransform() {}, save() {}, restore() {}, scale() {}, rotate() {}, translate() {},
    clearRect() {}, fillRect() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {},
    arc() {}, ellipse() {}, clip() {}, stroke() {}, fill() {}, setLineDash() {}, drawImage() {},
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    fillText() {}, strokeText() {},
    globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1,
    font: '', textAlign: '', textBaseline: '', lineCap: ''
  };
}

function makeEl(id) {
  const classes = new Set();
  const handlers = {};
  return {
    id, width: 680, height: 160, textContent: '', value: '', hidden: false,
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name)
    },
    getContext: () => makeCtx(),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 420, height: 700 }),
    addEventListener(type, fn) { handlers[type] = fn; },
    setAttribute() {},
    appendChild(child) { this.lastChild = child; },
    querySelector() {
      return { textContent: '', classList: { add() {}, remove() {} } };
    }
  };
}

function makeStorage() {
  const values = Object.create(null);
  return {
    getItem(key) { return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null; },
    setItem(key, value) { values[key] = String(value); },
    values
  };
}

function loadGame() {
  const ids = [
    'game', 'stage', 'overlay', 'score', 'best', 'finalScore', 'finalBest', 'next', 'chain',
    'soundBtn', 'resetBtn', 'restartBtn', 'revivePrompt', 'overPanel', 'reviveScore',
    'reviveLeft', 'reviveBtn', 'giveUpBtn', 'reviveBadge', 'reviveCount'
  ];
  const els = Object.fromEntries(ids.map((id) => [id, makeEl(id)]));
  const storage = makeStorage();
  const sandbox = {
    console, Math, Date, JSON, Object, Array, Number, String, Boolean, Error, isNaN,
    performance: { now: () => Date.now() },
    requestAnimationFrame() { return 1; },
    setTimeout, clearTimeout,
    document: {
      readyState: 'complete',
      getElementById: (id) => els[id] || null,
      addEventListener() {}
    },
    localStorage: storage,
    addEventListener() {},
    navigator: {},
    Image: class {
      set src(value) {
        this._src = value;
        if (this.onload) this.onload();
      }
      get src() { return this._src; }
    }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, 'assets/tipsy/parts.js'), 'utf8'), sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, 'game.js'), 'utf8'), sandbox);
  return sandbox;
}

function testGame() {
  const sandbox = loadGame();
  const game = sandbox.__TIPSY__;
  assert.strictEqual(game.FRUITS.length, 10);
  assert.strictEqual(game.MAX_BONUS, 500);
  assert.strictEqual(
    JSON.stringify(game.FRUITS.map((fruit) => path.basename(fruit.file))),
    JSON.stringify([
      '01-anime.webp', '02-chibi.webp', '03-mask.webp', '04-blue.webp', '05-girl.webp',
      '06-zombie.webp', '07-dog.webp', '08-pepper.webp', '09-penguin.webp', '10-surprise.webp'
    ])
  );

  for (const fruit of game.FRUITS) {
    const asset = path.join(root, fruit.file);
    assert.ok(fs.statSync(asset).size > 1000, `${fruit.file} should exist`);
  }
  for (let tier = 0; tier < game.FRUITS.length; tier++) {
    const shape = game.shapeOf(tier);
    assert.ok(shape.parts.length > 20);
    assert.ok(shape.coverage >= 0.94);
    assert.ok(shape.precision >= 0.85);
    for (const part of shape.parts) {
      assert.ok(part.length === 3 && part.every(Number.isFinite));
      assert.ok(part[2] > 0);
    }
  }

  game.reset();
  for (let i = 0; i < 12; i++) {
    game.state.ready = true;
    game.state.pending = i % 5;
    game.tryDrop();
    for (let frame = 0; frame < 36; frame++) game.update(1 / 60);
  }
  for (const ball of game.state.balls) {
    assert.ok(Number.isFinite(ball.x) && Number.isFinite(ball.y));
    let minX = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < ball.parts.length; i++) {
      minX = Math.min(minX, ball.wx[i] - ball.ws[i]);
      maxX = Math.max(maxX, ball.wx[i] + ball.ws[i]);
      maxY = Math.max(maxY, ball.wy[i] + ball.ws[i]);
    }
    assert.ok(minX >= 8.5 && maxX <= 411.5 && maxY <= 691.5);
  }

  game.reset();
  game.state.balls.length = 0;
  const r = game.FRUITS[9].r;
  const a = game.makeBall(210, 500, 9, 0, 0);
  const b = game.makeBall(210, 500 - r * 2 - 0.5, 9, 0, 0);
  a.landed = true;
  b.landed = true;
  game.state.balls.push(a, b);
  for (let frame = 0; frame < 90 && game.state.balls.length; frame++) {
    game.stepPhysics(1 / 60);
  }
  assert.strictEqual(game.state.balls.length, 0);
  assert.strictEqual(game.state.score, 500);
  assert.strictEqual(game.state.revives, 1);

}

function testLocalBoard() {
  const ids = [
    'boardList', 'boardModal', 'submitMsg', 'nickInput', 'myNameLabel', 'submitBtn',
    'boardBtn', 'boardBtn2', 'boardClose', 'boardRefresh', 'editNameBtn'
  ];
  const els = Object.fromEntries(ids.map((id) => [id, makeEl(id)]));
  const storage = makeStorage();
  const sandbox = {
    console, Date, JSON, Object, Array, Number, String,
    document: {
      readyState: 'complete',
      activeElement: null,
      getElementById: (id) => els[id] || null,
      createElement: (tag) => makeEl(tag),
      addEventListener() {}
    },
    localStorage: storage
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, 'leaderboard.js'), 'utf8'), sandbox);

  for (let score = 1; score <= 25; score++) {
    sandbox.window.TipsyBoard.onGameOver(score);
  }
  const rows = JSON.parse(storage.getItem('tipsy.board.v1'));
  assert.strictEqual(rows.length, 20);
  assert.strictEqual(rows[0].score, 25);
  assert.strictEqual(rows[19].score, 6);
  assert.strictEqual(els.submitMsg.textContent, '本机成绩已记录');
}

testGame();
testLocalBoard();
console.log('smoke tests passed');
