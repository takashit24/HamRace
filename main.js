(() => {
  const BEST_KEY = "hokotan_best_score";
  const assetPaths = {
    wheel: "wheel.png",
    normal: "hokotan_normal.png",
    fast: "hokotan_fast.png",
    overheat: "hokotan_overheat.png",
  };

  const elements = {
    score: document.getElementById("scoreValue"),
    best: document.getElementById("bestValue"),
    bestBadge: document.getElementById("bestBadge"),
    wheel: document.getElementById("wheelDisplay"),
    wheelImage: document.getElementById("wheelImage"),
    hamster: document.getElementById("hamsterDisplay"),
    hamsterImage: document.getElementById("hamsterImage"),
    heatFill: document.getElementById("heatFill"),
    timingChip: document.getElementById("timingChip"),
    tapZone: document.getElementById("tapZone"),
    tapPulse: document.getElementById("tapPulse"),
    overlay: document.getElementById("overlay"),
    overlayTitle: document.getElementById("overlayTitle"),
    overlayMessage: document.getElementById("overlayMessage"),
    resultLine: document.getElementById("resultLine"),
    recordBadge: document.getElementById("recordBadge"),
    lastScore: document.getElementById("lastScore"),
    startBtn: document.getElementById("startBtn"),
  };

  const state = {
    gameState: "ready",
    speed: 10,
    score: 0,
    best: 0,
    heat: 0,
    isGoodTiming: false,
    goodTimer: 0,
    scoreTimer: 0,
    hamsterState: "normal",
    lastTick: performance.now(),
    wheelAngle: 0,
    overlayTimer: null,
  };

  const TUNING = {
    decayPerSec: 8,
    goodPeriodMs: 2300,
    goodWindowMs: 720,
    scoreIntervalMs: 110,
    overheatThreshold: 80,
    heatBuildPerSec: 28,
    heatCoolPerSec: 20,
    speedMax: 100,
    tapBoostGood: 10,
    tapBoostNormal: 3,
  };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function loadBestScore() {
    const saved = localStorage.getItem(BEST_KEY);
    const parsed = Number(saved);
    state.best = Number.isFinite(parsed) ? parsed : 0;
    elements.best.textContent = state.best.toString();
  }

  function setImageWithFallback(container, img, src) {
    container.classList.remove("has-image");
    img.onload = () => container.classList.add("has-image");
    img.onerror = () => container.classList.remove("has-image");
    img.src = src;
  }

  function updateHamsterVisual() {
    let nextState = "normal";
    if (state.heat >= 99) {
      nextState = "overheat";
    } else if (state.speed >= 70) {
      nextState = "fast";
    }
    if (nextState !== state.hamsterState) {
      state.hamsterState = nextState;
      const src = assetPaths[nextState];
      if (src) setImageWithFallback(elements.hamster, elements.hamsterImage, src);
    }
  }

  function updateWheelRotation(dt) {
    const spinSpeed = state.gameState === "running" ? state.speed : 0;
    const degPerSec = spinSpeed * 6;
    state.wheelAngle = (state.wheelAngle + degPerSec * dt) % 360;
    elements.wheel.style.transform = `rotate(${state.wheelAngle}deg)`;
  }

  function updateBounce() {
    const amplitude = clamp(8 + state.speed * 0.12, 8, 26);
    const bounceSpeed = clamp(1.2 - state.speed * 0.01, 0.42, 1.2);
    elements.hamster.style.setProperty("--bounce-height", `${amplitude}px`);
    elements.hamster.style.setProperty("--bounce-speed", `${bounceSpeed}s`);
  }

  function updateTiming(dtMs) {
    state.goodTimer += dtMs;
    if (state.goodTimer > TUNING.goodPeriodMs) state.goodTimer = 0;
    state.isGoodTiming = state.goodTimer <= TUNING.goodWindowMs;
    elements.timingChip.classList.toggle("is-good", state.isGoodTiming);
    elements.timingChip.classList.toggle("is-hot", state.speed >= TUNING.overheatThreshold - 4);
    elements.tapZone.classList.toggle("is-good", state.isGoodTiming);
  }

  function updateScore(dtMs) {
    state.scoreTimer += dtMs;
    if (state.scoreTimer >= TUNING.scoreIntervalMs) {
      state.scoreTimer = 0;
      state.score += Math.floor(state.speed / 5);
      elements.score.textContent = Math.floor(state.score).toString();
    }
  }

  function updateHeat(dt) {
    if (state.speed >= TUNING.overheatThreshold) {
      state.heat = clamp(state.heat + TUNING.heatBuildPerSec * dt, 0, 100);
    } else {
      state.heat = clamp(state.heat - TUNING.heatCoolPerSec * dt, 0, 100);
    }
    elements.heatFill.style.width = `${state.heat}%`;
    if (state.heat >= 100) endGame();
  }

  function decaySpeed(dt) {
    state.speed = clamp(state.speed - TUNING.decayPerSec * dt, 0, TUNING.speedMax);
  }

  function updateAnimationVars() {
    updateHamsterVisual();
    updateBounce();
  }

  function tick(now) {
    const dtMs = now - state.lastTick;
    const dt = Math.min(dtMs / 1000, 0.08);
    state.lastTick = now;

    if (state.gameState === "running") {
      decaySpeed(dt);
      updateTiming(dtMs);
      updateScore(dtMs);
      updateHeat(dt);
      updateAnimationVars();
    }

    updateWheelRotation(dt);

    requestAnimationFrame(tick);
  }

  function startGame() {
    state.gameState = "running";
    state.speed = 10;
    state.score = 0;
    state.heat = 0;
    state.goodTimer = 0;
    state.scoreTimer = 0;
    state.lastTick = performance.now();
    if (state.overlayTimer) {
      clearTimeout(state.overlayTimer);
      state.overlayTimer = null;
    }
    elements.score.textContent = "0";
    elements.heatFill.style.width = "0%";
    elements.timingChip.classList.remove("is-hot", "is-good");
    elements.bestBadge.classList.remove("is-active");
    hideOverlay();
  }

  function endGame() {
    if (state.gameState === "gameover") return;
    state.gameState = "gameover";
    const finalScore = Math.floor(state.score);
    const isRecord = finalScore > state.best;
    if (isRecord) {
      state.best = finalScore;
      localStorage.setItem(BEST_KEY, String(finalScore));
      elements.best.textContent = finalScore.toString();
      elements.bestBadge.classList.add("is-active");
    }
    state.speed = 0;
    const delay = 900;
    if (state.overlayTimer) clearTimeout(state.overlayTimer);
    state.overlayTimer = setTimeout(() => {
      showGameOver(finalScore, isRecord);
      state.overlayTimer = null;
    }, delay);
  }

  function hideOverlay() {
    elements.overlay.classList.remove("is-visible");
    elements.resultLine.hidden = true;
    elements.recordBadge.hidden = true;
  }

  function showReady() {
    elements.overlayTitle.textContent = "ほこたん回し車ダッシュ";
    elements.overlayMessage.textContent = "タイミングよくタップして回転スピードアップ。スピードが高すぎるとオーバーヒートでゲームオーバー！";
    elements.startBtn.textContent = "ゲームスタート";
    elements.overlay.classList.add("is-visible");
    elements.resultLine.hidden = true;
    elements.recordBadge.hidden = true;
  }

  function showGameOver(score, isRecord) {
    elements.overlayTitle.textContent = "GAME OVER";
    elements.overlayMessage.textContent = "回しすぎ注意！ほこたんが目を回したよ。";
    elements.lastScore.textContent = score.toString();
    elements.resultLine.hidden = false;
    elements.recordBadge.hidden = !isRecord;
    elements.startBtn.textContent = "もう一度あそぶ";
    elements.overlay.classList.add("is-visible");
  }

  function handleTap(event) {
    if (state.gameState !== "running") return;
    const boost = state.isGoodTiming ? TUNING.tapBoostGood : TUNING.tapBoostNormal;
    state.speed = clamp(state.speed + boost, 0, TUNING.speedMax);
    flashTap(event);
  }

  function flashTap(event) {
    elements.tapZone.classList.add("is-pressed");
    if (event) {
      const rect = elements.tapZone.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      elements.tapPulse.style.left = `${x - 70}px`;
      elements.tapPulse.style.top = `${y - 70}px`;
    } else {
      elements.tapPulse.style.left = "50%";
      elements.tapPulse.style.top = "50%";
    }
    setTimeout(() => elements.tapZone.classList.remove("is-pressed"), 160);
  }

  function bindEvents() {
    elements.startBtn.addEventListener("click", () => {
      if (state.gameState === "ready" || state.gameState === "gameover") startGame();
    });
    elements.tapZone.addEventListener("pointerdown", handleTap);
    window.addEventListener("keydown", (event) => {
      if (event.code === "Space") {
        event.preventDefault();
        handleTap();
      }
    });
  }

  function init() {
    loadBestScore();
    setImageWithFallback(elements.wheel, elements.wheelImage, assetPaths.wheel);
    setImageWithFallback(elements.hamster, elements.hamsterImage, assetPaths.normal);
    showReady();
    bindEvents();
    requestAnimationFrame(tick);
  }

  init();
})();
