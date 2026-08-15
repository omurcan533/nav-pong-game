// --- SES MOTORU (Web Audio API & HTML5 Audio Fallback) ---
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.buffers = {};
    this.bgAudio = new Audio();
    this.bgAudio.loop = true;
    this.volume = 0.5;
    this.soundFiles = {
      hit: "sounds/scoreSound.mp3",
      score: "sounds/myGoal.mp3",
      pcGoal: "sounds/pcGoal.mp3",
      win: "sounds/galibiyet.mp3",
      lose: "sounds/yenilgi.mp3",
      button: "sounds/tus-sesi.mp3",
    };
    this.initAudioContext();
  }

  initAudioContext() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.loadAllSounds();
      }
    } catch (e) {
      console.warn("Web Audio API başlatılamadı, varsayılan sesler kullanılacak.", e);
    }
  }

  ensureContext() {
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  async loadSound(name, url) {
    if (!this.ctx) return;
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      this.buffers[name] = audioBuffer;
    } catch (e) {
      console.warn(`Ses önbelleğe alınamadı (${name}):`, e);
    }
  }

  loadAllSounds() {
    for (const [name, url] of Object.entries(this.soundFiles)) {
      this.loadSound(name, url);
    }
  }

  play(name) {
    if (this.volume <= 0) return;
    this.ensureContext();

    if (this.ctx && this.buffers[name]) {
      try {
        const source = this.ctx.createBufferSource();
        const gainNode = this.ctx.createGain();
        source.buffer = this.buffers[name];
        gainNode.gain.value = this.volume;
        source.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        source.start(0);
        return;
      } catch (e) {
        console.error("Web Audio ses çalma hatası:", e);
      }
    }

    // Web Audio hazır değilse HTML5 Audio fallback kullan
    if (this.soundFiles[name]) {
      const fallback = new Audio(this.soundFiles[name]);
      fallback.volume = this.volume;
      fallback.play().catch(() => {});
    }
  }

  playMusic(filename) {
    if (!filename || filename === "none") {
      this.bgAudio.pause();
      this.bgAudio.src = "";
      return;
    }
    const path = `sounds/${filename}`;
    if (!this.bgAudio.src.endsWith(path)) {
      this.bgAudio.src = path;
    }
    this.bgAudio.volume = Math.max(0, Math.min(1, this.volume * 0.3));
    this.bgAudio.play().catch((e) => console.log("Müzik çalınamadı:", e));
  }

  pauseMusic() {
    this.bgAudio.pause();
  }

  resumeMusic() {
    if (this.bgAudio.src && !this.bgAudio.src.endsWith("none") && this.bgAudio.paused) {
      this.bgAudio.play().catch(() => {});
    }
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    this.bgAudio.volume = Math.max(0, Math.min(1, this.volume * 0.3));
  }
}

const sounds = new SoundEngine();

// OYUN ELEMENTLERİ & DOM
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const ballColorInput = document.getElementById("ballColor");
const paddleColorInput = document.getElementById("paddleColor");
const bgThemeSelect = document.getElementById("bgTheme");
const musicSelect = document.getElementById("musicSelect");
const sfxVolumeInput = document.getElementById("sfxVolume");
const pauseBtn = document.getElementById("pauseBtn");
const restartBtn = document.getElementById("restartBtn");
const settingsBtn = document.getElementById("settingsBtn");

const paddleSpeed = 8;
let gameOver = false;
let isPaused = true;
let upPressed = false, downPressed = false;
let difficulty = "orta";

const game = { initialized: false };
const POWERUP_SPAWN_INTERVAL = 10000;
let lastPowerUpTime = 0;
let powerup = null;
let isComputerFrozen = false;

let balls = [];
let stars = [];
let blacks = [];
let energyLines = [];
let fireworks = [];

let settings = {
  ballColor: "#ffffff",
  paddleColor: "#ff0000",
  bgTheme: "black",
};

// BUTON TIKLAMA SESLERİ
document.querySelectorAll("button").forEach((btn) => {
  btn.addEventListener("click", () => {
    sounds.ensureContext();
    sounds.play("button");
  });
});

// ARKA PLAN RESİMLERİ VE EFEKTLERİ
function initializeBackgrounds() {
  stars = [];
  for (let i = 0; i < 150; i++) {
    stars.push({
      x: Math.random() * canvas.clientWidth,
      y: Math.random() * canvas.clientHeight,
      radius: Math.random() * 2 + 0.5,
      speed: Math.random() * 0.5 + 0.1,
    });
  }

  blacks = [];
  for (let i = 0; i < 150; i++) {
    blacks.push({
      x: Math.random() * canvas.clientWidth,
      y: Math.random() * canvas.clientHeight,
      radius: Math.random() * 2 + 0.5,
      speed: Math.random() * 0.5 + 0.1,
    });
  }

  energyLines = [];
  for (let i = 0; i < 40; i++) {
    energyLines.push({
      x: Math.random() * canvas.clientWidth,
      y: Math.random() * canvas.clientHeight,
      length: Math.random() * 40 + 20,
      angle: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.5 + 0.2,
    });
  }
}

function initializeGameElements() {
  const canvasWidth = canvas.clientWidth;
  const canvasHeight = canvas.clientHeight;

  game.paddleWidth = canvasWidth * 0.0125;
  game.playerHeight = canvasHeight * 0.22;
  game.computerHeight = canvasHeight * 0.22;

  game.player = {
    x: canvasWidth * 0.025,
    y: canvasHeight / 2 - game.playerHeight / 2,
    score: 0,
    height: game.playerHeight,
    originalHeight: game.playerHeight,
  };

  game.computer = {
    x: canvasWidth - (canvasWidth * 0.025 + game.paddleWidth),
    y: canvasHeight / 2 - game.computerHeight / 2,
    score: 0,
    height: game.computerHeight,
    originalHeight: game.computerHeight,
  };

  balls = [
    {
      x: canvasWidth / 2,
      y: canvasHeight / 2,
      radius: canvasWidth * 0.01,
      dx: (canvasWidth / 800) * 5,
      dy: (canvasHeight / 500) * 5,
      baseSpeed: (canvasWidth / 800) * 5,
    },
  ];

  initializeBackgrounds();
}

function setupCanvasSize() {
  const scale = window.devicePixelRatio || 1;
  const newWidth = canvas.clientWidth;
  const newHeight = canvas.clientHeight;

  canvas.width = newWidth * scale;
  canvas.height = newHeight * scale;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(scale, scale);

  if (!game.initialized) {
    initializeGameElements();
    game.initialized = true;
  } else {
    // Boyut değiştiğinde mevcut oyunu sıfırlamadan oranla
    const widthRatio = newWidth / (game.lastCanvasWidth || newWidth);
    const heightRatio = newHeight / (game.lastCanvasHeight || newHeight);

    game.paddleWidth = newWidth * 0.0125;
    game.playerHeight = newHeight * 0.22;
    game.computerHeight = newHeight * 0.22;

    game.player.height = game.playerHeight;
    game.computer.height = game.computerHeight;
    game.player.x = newWidth * 0.025;
    game.computer.x = newWidth - (newWidth * 0.025 + game.paddleWidth);

    game.player.y = Math.min(newHeight - game.player.height, game.player.y * heightRatio);
    game.computer.y = Math.min(newHeight - game.computer.height, game.computer.y * heightRatio);

    balls.forEach((ball) => {
      ball.x *= widthRatio;
      ball.y *= heightRatio;
      ball.radius = newWidth * 0.01;
      ball.baseSpeed = (newWidth / 800) * 5;
    });

    initializeBackgrounds();
  }

  game.lastCanvasWidth = newWidth;
  game.lastCanvasHeight = newHeight;
}

window.addEventListener("load", setupCanvasSize);
window.addEventListener("resize", setupCanvasSize);

// KLAVYE VE DOKUNMATİK KONTROLLER
document.addEventListener("keydown", (e) => {
  sounds.ensureContext();
  if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
    upPressed = true;
  }
  if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
    downPressed = true;
  }
});

document.addEventListener("keyup", (e) => {
  if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
    upPressed = false;
  }
  if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
    downPressed = false;
  }
});

// Fare ve Dokunmatik Sürükleme Kontrolü
canvas.addEventListener("mousemove", (e) => {
  if (isPaused || gameOver) return;
  const rect = canvas.getBoundingClientRect();
  const mouseY = e.clientY - rect.top;
  game.player.y = Math.max(
    0,
    Math.min(canvas.clientHeight - game.player.height, mouseY - game.player.height / 2)
  );
});

canvas.addEventListener("touchmove", (e) => {
  if (isPaused || gameOver) return;
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const touchY = e.touches[0].clientY - rect.top;
  game.player.y = Math.max(
    0,
    Math.min(canvas.clientHeight - game.player.height, touchY - game.player.height / 2)
  );
}, { passive: false });

canvas.addEventListener("touchstart", (e) => {
  sounds.ensureContext();
  const rect = canvas.getBoundingClientRect();
  const touchY = e.touches[0].clientY - rect.top;
  if (touchY < canvas.clientHeight / 2) {
    upPressed = true;
    downPressed = false;
  } else {
    downPressed = true;
    upPressed = false;
  }
});

canvas.addEventListener("touchend", () => {
  upPressed = false;
  downPressed = false;
});

// MANUEL BUTONLARİ İÇİN SMOOTH KONTROL (setInterval yerine event flag)
function bindHoldButton(id, direction) {
  const btn = document.getElementById(id);
  if (!btn) return;

  const start = (e) => {
    e.preventDefault();
    sounds.ensureContext();
    if (direction === "up") upPressed = true;
    if (direction === "down") downPressed = true;
  };

  const stop = () => {
    if (direction === "up") upPressed = false;
    if (direction === "down") downPressed = false;
  };

  btn.addEventListener("mousedown", start);
  btn.addEventListener("touchstart", start);
  btn.addEventListener("mouseup", stop);
  btn.addEventListener("mouseleave", stop);
  btn.addEventListener("touchend", stop);
  btn.addEventListener("touchcancel", stop);
}

bindHoldButton("upBtn", "up");
bindHoldButton("downBtn", "down");

// AYARLAR VE BUTONLAR
function setPauseIcon(paused) {
  pauseBtn.innerHTML = paused
    ? '<i class="fas fa-play"></i> Başlat'
    : '<i class="fas fa-pause"></i> Duraklat';
}

restartBtn.addEventListener("click", () => {
  document.getElementById("levelMenu").style.display = "flex";
  game.player.score = 0;
  game.computer.score = 0;
  updateScoreboard();
  initializeGameElements();
  gameOver = false;
  isPaused = true;
  fireworks = [];
  setPauseIcon(true);
  sounds.pauseMusic();
});

pauseBtn.addEventListener("click", () => {
  isPaused = !isPaused;
  setPauseIcon(isPaused);
  if (isPaused) {
    sounds.pauseMusic();
  } else {
    sounds.resumeMusic();
  }
});

settingsBtn.addEventListener("click", () => {
  isPaused = true;
  document.getElementById("settingsMenu").style.display = "flex";
  setPauseIcon(true);
  sounds.pauseMusic();
});

document.getElementById("closeSettingsBtn").addEventListener("click", () => {
  document.getElementById("settingsMenu").style.display = "none";
});

ballColorInput.addEventListener("input", (e) => {
  settings.ballColor = e.target.value;
});

paddleColorInput.addEventListener("input", (e) => {
  settings.paddleColor = e.target.value;
});

bgThemeSelect.addEventListener("change", (e) => {
  settings.bgTheme = e.target.value;
});

musicSelect.addEventListener("change", (e) => {
  sounds.playMusic(e.target.value);
});

sfxVolumeInput.addEventListener("input", (e) => {
  sounds.setVolume(parseFloat(e.target.value || 0));
});

sfxVolumeInput.addEventListener("change", () => {
  sounds.play("button");
});

function updateScoreboard() {
  const userScoreElement = document.getElementById("userScore");
  const computerScoreElement = document.getElementById("computerScore");

  if (userScoreElement && computerScoreElement) {
    userScoreElement.textContent = game.player.score;
    computerScoreElement.textContent = game.computer.score;
  }
}

function startGame(level) {
  sounds.ensureContext();
  setPauseIcon(false);
  difficulty = level;
  document.getElementById("levelMenu").style.display = "none";
  game.player.score = 0;
  game.computer.score = 0;
  updateScoreboard();
  initializeGameElements();
  gameOver = false;
  isPaused = false;
  fireworks = [];
  lastPowerUpTime = Date.now();

  const selectedMusic = musicSelect.value;
  if (selectedMusic && selectedMusic !== "none") {
    sounds.playMusic(selectedMusic);
  }
}

// ÇİZİM FONKSİYONLARI
function drawPaddle(x, y, height, isFrozen = false) {
  ctx.fillStyle = isFrozen ? "#9b59b6" : settings.paddleColor;
  ctx.fillRect(x, y, game.paddleWidth, height);
}

function drawBall(ball) {
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fillStyle = settings.ballColor;
  ctx.fill();
  ctx.closePath();
}

function drawScore() {
  if (window.innerWidth > 768) {
    ctx.font = `${canvas.clientHeight * 0.06}px Arial`;
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.fillText(game.player.score, canvas.clientWidth / 4, canvas.clientHeight * 0.1);
    ctx.fillText(game.computer.score, (3 * canvas.clientWidth) / 4, canvas.clientHeight * 0.1);
  }
}

// PERFORMANSLI HAVAI FİŞEK PARÇACIK MOTORU
function createFireworkExplosion(x, y) {
  const count = 40;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 5 + 2;
    fireworks.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      alpha: 1,
      decay: Math.random() * 0.02 + 0.015,
      color: `hsl(${Math.random() * 360}, 100%, 60%)`,
      radius: Math.random() * 3 + 2,
    });
  }
}

function updateAndDrawFireworks() {
  if (Math.random() < 0.08 && fireworks.length < 160) {
    createFireworkExplosion(
      Math.random() * canvas.clientWidth,
      Math.random() * (canvas.clientHeight * 0.6)
    );
  }

  for (let i = fireworks.length - 1; i >= 0; i--) {
    const p = fireworks[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.08;
    p.alpha -= p.decay;

    if (p.alpha <= 0) {
      fireworks.splice(i, 1);
      continue;
    }

    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.restore();
  }
}

function drawPowerUp() {
  if (powerup) {
    ctx.beginPath();
    ctx.arc(powerup.x, powerup.y, powerup.radius, 0, Math.PI * 2);
    ctx.fillStyle = powerup.color;
    ctx.fill();
    ctx.closePath();
  }
}

function drawStarryBackground() {
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  ctx.fillStyle = "white";
  stars.forEach((star) => {
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.closePath();
  });
}

function drawEnergyBackground() {
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  energyLines.forEach((line) => {
    ctx.beginPath();
    ctx.moveTo(line.x, line.y);
    ctx.lineTo(
      line.x + Math.cos(line.angle) * line.length,
      line.y + Math.sin(line.angle) * line.length
    );
    ctx.strokeStyle = `hsl(${Math.abs(Math.sin(line.x / 100)) * 120 + 200}, 100%, 50%)`;
    ctx.stroke();
  });
}

function resetBall(ball) {
  ball.x = canvas.clientWidth / 2;
  ball.y = canvas.clientHeight / 2;
  ball.dx = -Math.sign(ball.dx || 1) * ball.baseSpeed;
  ball.dy = (Math.random() > 0.5 ? 1 : -1) * ball.baseSpeed * 0.8;
}

function spawnPowerUp() {
  const types = ["widenPaddle", "freezeOpponent", "duplicateBall"];
  const type = types[Math.floor(Math.random() * types.length)];
  let color = "green";
  if (type === "freezeOpponent") color = "purple";
  if (type === "duplicateBall") color = "cyan";

  powerup = {
    x: Math.random() * (canvas.clientWidth / 2) + canvas.clientWidth / 4,
    y: Math.random() * (canvas.clientHeight / 2) + canvas.clientHeight / 4,
    radius: canvas.clientWidth * 0.02,
    type: type,
    color: color,
  };
}

function applyPowerUpEffect() {
  if (!powerup) return;

  switch (powerup.type) {
    case "widenPaddle":
      game.player.height = game.player.originalHeight * 1.5;
      setTimeout(() => {
        game.player.height = game.player.originalHeight;
      }, 10000);
      break;
    case "freezeOpponent":
      isComputerFrozen = true;
      setTimeout(() => {
        isComputerFrozen = false;
      }, 5000);
      break;
    case "duplicateBall":
      if (balls.length < 2) {
        const originalBall = balls[0];
        balls.push({
          x: originalBall.x,
          y: originalBall.y,
          radius: originalBall.radius,
          dx: -originalBall.dx,
          dy: -originalBall.dy,
          baseSpeed: originalBall.baseSpeed,
        });
      }
      break;
  }

  powerup = null;
  lastPowerUpTime = Date.now();
}

// KAZANMA METİN ANİMASYONU
let textScale = 0;
let textOpacity = 0;

function animateWinText() {
  if (textScale < 1.0) {
    textScale += 0.02;
    textOpacity += 0.02;
  }
  ctx.font = `${Math.floor(80 * Math.min(1.0, textScale))}px 'Bangers', cursive`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = `rgba(255, 215, 0, ${Math.min(1.0, textOpacity)})`;
  ctx.fillText("🏆 SEN KAZANDIN!", canvas.clientWidth / 2, canvas.clientHeight / 2);
}

// GELİŞMİŞ ÇARPIŞMA VE SPIN FİZİĞİ
function checkPaddleCollision(ball, paddle, isPlayer) {
  const paddleRight = paddle.x + game.paddleWidth;
  const paddleBottom = paddle.y + paddle.height;

  if (
    ball.x + ball.radius >= paddle.x &&
    ball.x - ball.radius <= paddleRight &&
    ball.y + ball.radius >= paddle.y &&
    ball.y - ball.radius <= paddleBottom
  ) {
    if ((isPlayer && ball.dx < 0) || (!isPlayer && ball.dx > 0)) {
      const paddleCenterY = paddle.y + paddle.height / 2;
      const hitPoint = (ball.y - paddleCenterY) / (paddle.height / 2);
      const clampedHit = Math.max(-1, Math.min(1, hitPoint));

      const maxAngle = Math.PI / 3.5; // ~51 derece
      const bounceAngle = clampedHit * maxAngle;

      const currentSpeed = Math.hypot(ball.dx, ball.dy);
      const newSpeed = Math.min(currentSpeed * 1.03, canvas.clientWidth * 0.02);

      const direction = isPlayer ? 1 : -1;
      ball.dx = direction * newSpeed * Math.cos(bounceAngle);
      ball.dy = newSpeed * Math.sin(bounceAngle);

      if (isPlayer) {
        ball.x = paddleRight + ball.radius;
      } else {
        ball.x = paddle.x - ball.radius;
      }

      sounds.play("hit");
    }
  }
}

// OYUN DÖNGÜSÜ & DELTA TIME NORMALİZASYONU
let lastTime = 0;

function gameLoop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const rawDelta = (timestamp - lastTime) / 16.666;
  const deltaTime = Math.min(Math.max(rawDelta, 0.1), 2.0); // Extreme delta sapmalarını engelle
  lastTime = timestamp;

  if (!isPaused) {
    update(deltaTime);
    draw();
  }
  requestAnimationFrame(gameLoop);
}

function update(deltaTime) {
  if (game.player.score >= 3 || game.computer.score >= 3) {
    if (!gameOver) {
      if (game.player.score >= 3) {
        sounds.play("win");
        textScale = 0;
        textOpacity = 0;
      } else {
        sounds.play("lose");
      }
      gameOver = true;
    }
    return;
  }

  if (!powerup && Date.now() - lastPowerUpTime > POWERUP_SPAWN_INTERVAL) {
    spawnPowerUp();
  }

  // Arka plan hareketleri
  if (settings.bgTheme === "stars") {
    stars.forEach((star) => {
      star.x -= star.speed * deltaTime;
      if (star.x < 0) {
        star.x = canvas.clientWidth;
        star.y = Math.random() * canvas.clientHeight;
      }
    });
  }

  if (settings.bgTheme === "energy") {
    energyLines.forEach((line) => {
      line.x += Math.cos(line.angle) * line.speed * deltaTime;
      line.y += Math.sin(line.angle) * line.speed * deltaTime;
      if (
        line.x < 0 ||
        line.x > canvas.clientWidth ||
        line.y < 0 ||
        line.y > canvas.clientHeight
      ) {
        line.x = Math.random() * canvas.clientWidth;
        line.y = Math.random() * canvas.clientHeight;
        line.angle = Math.random() * Math.PI * 2;
      }
    });
  }

  // Oyuncu Hareket Güncellemesi
  const playerSpeed = paddleSpeed * deltaTime * (canvas.clientHeight / 500);
  if (upPressed && game.player.y > 0) {
    game.player.y -= playerSpeed;
  }
  if (downPressed && game.player.y < canvas.clientHeight - game.player.height) {
    game.player.y += playerSpeed;
  }

  // Bilgisayar AI Yumuşatması (Smooth Motion)
  if (!isComputerFrozen) {
    let targetBall = balls[0];
    if (balls.length > 1) {
      targetBall = balls.reduce((prev, curr) => (curr.x > prev.x ? curr : prev));
    }

    const targetY = targetBall.y - game.computer.height / 2;
    const diffY = targetY - game.computer.y;

    let aiSpeedFactor = 0.08;
    if (difficulty === "kolay") aiSpeedFactor = 0.04;
    else if (difficulty === "orta") aiSpeedFactor = 0.08;
    else if (difficulty === "zor") aiSpeedFactor = 0.14;

    game.computer.y += diffY * aiSpeedFactor * deltaTime;

    if (game.computer.y < 0) game.computer.y = 0;
    if (game.computer.y + game.computer.height > canvas.clientHeight) {
      game.computer.y = canvas.clientHeight - game.computer.height;
    }
  }

  // Top Fiziği ve Çarpışmalar
  for (let index = balls.length - 1; index >= 0; index--) {
    const ball = balls[index];
    ball.x += ball.dx * deltaTime;
    ball.y += ball.dy * deltaTime;

    // Alt / Üst Duvar Çarpışması
    if (ball.y + ball.radius > canvas.clientHeight) {
      ball.y = canvas.clientHeight - ball.radius;
      ball.dy *= -1;
    } else if (ball.y - ball.radius < 0) {
      ball.y = ball.radius;
      ball.dy *= -1;
    }

    // PowerUp Çarpışması
    if (powerup) {
      const distance = Math.hypot(ball.x - powerup.x, ball.y - powerup.y);
      if (distance < ball.radius + powerup.radius) {
        applyPowerUpEffect();
      }
    }

    // Raket Çarpışma Kontrolleri
    checkPaddleCollision(ball, game.player, true);
    checkPaddleCollision(ball, game.computer, false);

    // Skor Kontrolleri
    if (ball.x < 0) {
      game.computer.score++;
      sounds.play("pcGoal");
      updateScoreboard();
      if (balls.length > 1) {
        balls.splice(index, 1);
      } else {
        resetBall(ball);
      }
    } else if (ball.x > canvas.clientWidth) {
      game.player.score++;
      sounds.play("score");
      updateScoreboard();
      if (balls.length > 1) {
        balls.splice(index, 1);
      } else {
        resetBall(ball);
      }
    }
  }
}

function draw() {
  if (settings.bgTheme === "stars") {
    drawStarryBackground();
  } else if (settings.bgTheme === "energy") {
    drawEnergyBackground();
  } else {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  }

  if (gameOver) {
    if (game.player.score >= 3) {
      const gradient = ctx.createRadialGradient(
        canvas.clientWidth / 2,
        canvas.clientHeight / 2,
        50,
        canvas.clientWidth / 2,
        canvas.clientHeight / 2,
        canvas.clientWidth
      );
      gradient.addColorStop(0, "rgba(255,215,0,0.4)");
      gradient.addColorStop(1, "rgba(0,0,0,0.85)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

      animateWinText();
      updateAndDrawFireworks();
    } else {
      ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
      ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      ctx.font = `${canvas.clientHeight * 0.09}px 'Bangers', Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ff4757";
      ctx.fillText("💀 BİLGİSAYAR KAZANDI!", canvas.clientWidth / 2, canvas.clientHeight / 2);
    }
    return;
  }

  drawPaddle(game.player.x, game.player.y, game.player.height);
  drawPaddle(
    game.computer.x,
    game.computer.y,
    game.computer.height,
    isComputerFrozen
  );

  balls.forEach((ball) => drawBall(ball));
  drawScore();
  drawPowerUp();
}

requestAnimationFrame(gameLoop);
