document.querySelectorAll("button").forEach((btn) => {
  btn.addEventListener("click", () => {
    playSound(buttonClickSound);
  });
});
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Ses elemanlarını güvenli bir şekilde al ve hata yakalama ekle
const getAudioElement = (id) => {
  const audioEl = document.getElementById(id);
  if (!audioEl) {
    console.error(`Hata: ID "${id}" olan ses elemanı bulunamadı.`);
    return null;
  }
  audioEl.addEventListener("error", (e) => {
    console.error(`Ses yükleme hatası: ID "${id}", SRC: "${audioEl.src}"`, e);
  });
  return audioEl;
};

const hitSound = getAudioElement("hitSound");
const scoreSound = getAudioElement("scoreSound");
const winGameSound = getAudioElement("winGameSound");
const loseGameSound = getAudioElement("loseGameSound");
const bgMusic = getAudioElement("bgMusic");
const cubukYukarı = getAudioElement("cubuk-yukarı");
const buttonClickSound = getAudioElement("buttonClickSound");

const ballColorInput = document.getElementById("ballColor");
const paddleColorInput = document.getElementById("paddleColor");
const bgThemeSelect = document.getElementById("bgTheme");
const musicSelect = document.getElementById("musicSelect");
const sfxVolumeInput = document.getElementById("sfxVolume");

// Sesleri güvenli bir şekilde oynatan fonksiyon
const playSound = (audioEl) => {
  if (!audioEl) return;
  try {
    // slider değeri ile ses seviyesini güncelle (her zaman güncel olsun)
    const vol = parseFloat(sfxVolumeInput.value || 0);
    const shouldMute = vol <= 0;

    // orijinal elementin volume ve mute durumunu ayarla
    audioEl.volume = Math.max(0, Math.min(1, vol));
    audioEl.muted = shouldMute;

    // klonla, klona volume/muted ata ve çal
    const clone = audioEl.cloneNode(true);
    clone.volume = audioEl.volume;
    clone.muted = audioEl.muted;

    // bazı tarayıcılarda görünmez olursa sorun olabiliyor; DOM'a ekleyip bittiğinde temizleyelim
    clone.addEventListener("ended", () => {
      if (clone.parentNode) clone.parentNode.removeChild(clone);
    });

    // ekle ve çal
    document.body.appendChild(clone);
    clone.play().catch((e) => {
      // autoplay veya izin sorunları olabilir, hata kaydı yeterli
      console.error("Ses çalınamadı (clone):", e);
    });
  } catch (e) {
    console.error("Ses çalma hatası:", e);
  }
};

function updateAllVolumes() {
  const vol = parseFloat(sfxVolumeInput.value || 0);
  const muteAll = vol <= 0;

  // Efekt sesleri ve buton sesi
  [hitSound, scoreSound, winGameSound, loseGameSound, buttonClickSound].forEach(
    (a) => {
      if (!a) return;
      a.volume = Math.max(0, Math.min(1, vol));
      a.muted = muteAll;
    }
  );

  // Arka plan müziği de kapansın istiyorsan burada ayarla (kapatılmasını istedin)
  if (bgMusic) {
    bgMusic.volume = Math.max(0, Math.min(1, vol));
    bgMusic.muted = muteAll;
    // Eğer istersen mute yerine duraklatma yapabilirsin:
    // if (muteAll) bgMusic.pause(); else bgMusic.play().catch(()=>{});
  }
  if (cubukYukarı) {
    cubukYukarı.volume = Math.max(0, Math.min(1, vol));
    cubukYukarı.muted = muteAll;
    // Eğer istersen mute yerine duraklatma yapabilirsin:
    // if (muteAll) bgMusic.pause(); else bgMusic.play().catch(()=>{});
  }
}

// slider değiştiğinde ve başlangıçta çağır
sfxVolumeInput.addEventListener("input", updateAllVolumes);
updateAllVolumes();

var gameOver = false;
var isPaused = true;
let upPressed = false,
  downPressed = false;
let difficulty = "orta";
let hitProbability = 1;

// Oyun değişkenleri
const game = {};
const POWERUP_SPAWN_INTERVAL = 10000; // 10 saniye
let lastPowerUpTime = 0;
let powerup = null;
let isComputerFrozen = false;

// Topları birden fazla top için bir diziye dönüştür
let balls = [];

// Yıldızlar için dizi
let stars = [];
let energyLines = [];

let settings = {
  ballColor: "#ffffff",
  paddleColor: "#ff0000",
  bgTheme: "stars",
};

function initializeBackgrounds() {
  // Yıldızları oluştur
  stars = [];
  for (let i = 0; i < 200; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * 2,
      speed: Math.random() * 0.5 + 0.1,
    });
  }
  // Enerji hatlarını oluştur
  energyLines = [];
  for (let i = 0; i < 50; i++) {
    energyLines.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      length: Math.random() * 50 + 20,
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
  };
  game.computer = {
    x: canvasWidth - (canvasWidth * 0.025 + game.paddleWidth),
    y: canvasHeight / 2 - game.computerHeight / 2,
    score: 0,
    height: game.computerHeight,
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

  game.player.originalHeight = game.playerHeight;
  game.computer.originalHeight = game.computerHeight;

  initializeBackgrounds();
}

function setupCanvasSize() {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  initializeGameElements();
}

window.addEventListener("load", setupCanvasSize);
window.addEventListener("resize", setupCanvasSize);

if (bgMusic) bgMusic.volume = 0.06;
if (cubukYukarı) cubukYukarı.volume = 0.06;

document.addEventListener("keydown", (e) => {
  if (bgMusic && bgMusic.paused)
    bgMusic.play().catch((e) => console.error("Müzik çalınamadı:", e));
  if (cubukYukarı && cubukYukarı.paused)
    cubukYukarı.play().catch((e) => console.error("Müzik çalınamadı:", e));
  if (e.key === "ArrowUp") {
    upPressed = true;
  }
  if (e.key === "ArrowDown") {
    downPressed = true;
  }
});

document.addEventListener("keyup", (e) => {
  if (e.key === "ArrowUp") {
    upPressed = false;
  }
  if (e.key === "ArrowDown") {
    downPressed = false;
  }
});

canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  const touchY = e.touches[0].clientY;
  const canvasRect = canvas.getBoundingClientRect();

  if (touchY >= canvasRect.top && touchY <= canvasRect.bottom) {
    const relativeY = touchY - canvasRect.top;
    if (relativeY < canvas.height / 2) {
      upPressed = true;
      downPressed = false;
    } else {
      downPressed = true;
      upPressed = false;
    }
  }
});

canvas.addEventListener("touchend", (e) => {
  e.preventDefault();
  upPressed = false;
  downPressed = false;
});

canvas.addEventListener("touchcancel", (e) => {
  e.preventDefault();
  upPressed = false;
  downPressed = false;
});

const pauseBtn = document.getElementById("pauseBtn");
const restartBtn = document.getElementById("restartBtn");
const settingsBtn = document.getElementById("settingsBtn");

function setPauseIcon(isPaused) {
  // isPaused true ise Başlat, false ise Duraklat
  pauseBtn.innerHTML = isPaused
    ? '<i class="fas fa-play"></i> Başlat'
    : '<i class="fas fa-pause"></i> Duraklat';
}

function setRestartIcon() {
  restartBtn.innerHTML = '<i class="fas fa-redo"></i> Yeniden Başlat';
}

function setSettingsIcon() {
  settingsBtn.innerHTML = '<i class="fas fa-cog"></i> Ayarlar';
}

// Event listener
restartBtn.addEventListener("click", () => {
  document.getElementById("levelMenu").style.display = "flex";
  game.player.score = 0;
  game.computer.score = 0;
  initializeGameElements();
  gameOver = false;
  isPaused = true;
  setPauseIcon(true);
  setRestartIcon();
  setSettingsIcon();
});

pauseBtn.addEventListener("click", () => {
  isPaused = !isPaused;
  setPauseIcon(isPaused);
});

settingsBtn.addEventListener("click", () => {
  isPaused = true;
  document.getElementById("settingsMenu").style.display = "flex";
  setPauseIcon(true);
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
  if (bgMusic) {
    bgMusic.pause(); // Önce eski müziği duraklat
    bgMusic.currentTime = 0; // Başına sar
    console.log("target value", e.target.value);
    bgMusic.src = `sounds/${e.target.value}`; // Yeni müzik kaynağı
    bgMusic.play().catch((err) => console.error("Müzik çalınamadı:", err));
  }
  if (cubukYukarı) {
    cubukYukarı.pause(); // Önce eski müziği duraklat
    cubukYukarı.currentTime = 0; // Başına sar
    console.log("target value", e.target.value);
    cubukYukarı.src = `sounds/${e.target.value}`; // Yeni müzik kaynağı
    cubukYukarı.play().catch((err) => console.error("Müzik çalınamadı:", err));
  }
});

sfxVolumeInput.addEventListener("input", (e) => {
  if (hitSound) hitSound.volume = e.target.value;
  if (scoreSound) scoreSound.volume = e.target.value;
  if (winGameSound) winGameSound.volume = e.target.value;
  if (loseGameSound) loseGameSound.volume = e.target.value;
  if (buttonClickSound) buttonClickSound.volume = e.target.value;
});

function startGame(level) {
  difficulty = level;
  document.getElementById("levelMenu").style.display = "none";
  game.player.score = 0;
  game.computer.score = 0;
  initializeGameElements();
  gameOver = false;
  isPaused = false;
  lastPowerUpTime = Date.now();

  if (level === "kolay") hitProbability = 0.1;
  else if (level === "orta") hitProbability = 0.5;
  else if (level === "zor") hitProbability = 0.9;

  if (bgMusic && bgMusic.paused)
    bgMusic.play().catch((e) => console.error("Müzik çalınamadı:", e));
  if (cubukYukarı && cubukYukarı.paused)
    cubukYukarı.play().catch((e) => console.error("Müzik çalınamadı:", e));
}

function drawPaddle(x, y, height, isFrozen = false) {
  ctx.fillStyle = isFrozen ? "purple" : settings.paddleColor;
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
  ctx.font = `${canvas.height * 0.06}px Arial`;
  ctx.fillText(game.player.score, canvas.width / 4, canvas.height * 0.1);
  ctx.fillText(
    game.computer.score,
    (3 * canvas.width) / 4,
    canvas.height * 0.1
  );
}

function drawFirework(x, y) {
  for (let i = 0; i < 30; i++) {
    ctx.beginPath();
    ctx.arc(x, y, Math.random() * 4, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${Math.random() * 360}, 100%, 50%)`;
    ctx.fill();
    ctx.closePath();
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
  ctx.fillRect(0, 0, canvas.width, canvas.height);
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
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  energyLines.forEach((line) => {
    ctx.beginPath();
    ctx.moveTo(line.x, line.y);
    ctx.lineTo(
      line.x + Math.cos(line.angle) * line.length,
      line.y + Math.sin(line.angle) * line.length
    );
    ctx.strokeStyle = `hsl(${
      Math.abs(Math.sin(line.x / 100)) * 120 + 200
    }, 100%, 50%)`;
    ctx.stroke();
  });
}

function resetBall(ball) {
  ball.x = canvas.width / 2;
  ball.y = canvas.height / 2;
  ball.dx *= -1;

  ball.dx += Math.sign(ball.dx) * (ball.baseSpeed * 0.1);
  ball.dy += Math.sign(ball.dy) * (ball.baseSpeed * 0.1);
}

function spawnPowerUp() {
  const types = ["widenPaddle", "freezeOpponent", "duplicateBall"];
  const type = types[Math.floor(Math.random() * types.length)];

  let color = "";
  switch (type) {
    case "widenPaddle":
      color = "green";
      break;
    case "freezeOpponent":
      color = "purple";
      break;
    case "duplicateBall":
      color = "cyan";
      break;
  }

  powerup = {
    x: Math.random() * (canvas.width / 2) + canvas.width / 4,
    y: Math.random() * (canvas.height / 2) + canvas.height / 4,
    radius: canvas.width * 0.02,
    type: type,
    color: color,
  };
}

function applyPowerUpEffect() {
  if (!powerup) return;

  switch (powerup.type) {
    case "widenPaddle":
      game.player.height = game.player.height * 1.5;
      setTimeout(() => {
        game.player.height = game.player.originalHeight;
      }, 5000);
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
        });
      }
      break;
  }

  powerup = null;
  lastPowerUpTime = Date.now();
}

let lastTime = 0;
function gameLoop(timestamp) {
  const deltaTime = (timestamp - lastTime) / 16.666;
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
        playSound(winGameSound);
      } else {
        playSound(loseGameSound);
      }
      gameOver = true;
    }
    return;
  }

  if (!powerup && Date.now() - lastPowerUpTime > POWERUP_SPAWN_INTERVAL) {
    spawnPowerUp();
  }

  if (settings.bgTheme === "stars") {
    stars.forEach((star) => {
      star.x -= star.speed;
      if (star.x < 0) {
        star.x = canvas.width;
        star.y = Math.random() * canvas.height;
      }
    });
  }

  if (settings.bgTheme === "energy") {
    energyLines.forEach((line) => {
      line.x += Math.cos(line.angle) * line.speed;
      line.y += Math.sin(line.angle) * line.speed;
      if (
        line.x < 0 ||
        line.x > canvas.width ||
        line.y < 0 ||
        line.y > canvas.height
      ) {
        line.x = Math.random() * canvas.width;
        line.y = Math.random() * canvas.height;
        line.angle = Math.random() * Math.PI * 2;
      }
    });
  }

  const playerSpeed = 7;
  if (upPressed && game.player.y > 0) {
    game.player.y -= playerSpeed * deltaTime * (canvas.height / 500);
  }

  if (downPressed && game.player.y < canvas.height - game.player.height) {
    game.player.y += playerSpeed * deltaTime * (canvas.height / 500);
  }

  if (!isComputerFrozen) {
    if (Math.random() < hitProbability) {
      const targetY = balls[0].y - game.computer.height / 2;
      game.computer.y += (targetY - game.computer.y) * 0.1 * deltaTime;
    }
  }
  if (game.computer.y < 0) game.computer.y = 0;
  if (game.computer.y + game.computer.height > canvas.height)
    game.computer.y = canvas.height - game.computer.height;

  balls.forEach((ball, index) => {
    ball.x += ball.dx * deltaTime;
    ball.y += ball.dy * deltaTime;

    if (ball.y + ball.radius > canvas.height || ball.y - ball.radius < 0) {
      ball.dy *= -1;
    }

    if (powerup) {
      const distance = Math.hypot(ball.x - powerup.x, ball.y - powerup.y);
      if (distance < ball.radius + powerup.radius) {
        applyPowerUpEffect();
      }
    }

    if (
      ball.x - ball.radius < game.player.x + game.paddleWidth &&
      ball.y > game.player.y &&
      ball.y < game.player.y + game.player.height
    ) {
      ball.dx *= -1;
      playSound(hitSound);
    }

    if (
      ball.x + ball.radius > game.computer.x &&
      ball.y > game.computer.y &&
      ball.y < game.computer.y + game.computer.height
    ) {
      ball.dx *= -1;
      playSound(hitSound);
    }

    if (ball.x < 0) {
      game.computer.score++;
      playSound(scoreSound);
      if (balls.length > 1) {
        balls.splice(index, 1);
      } else {
        resetBall(ball);
      }
    }
    if (ball.x > canvas.width) {
      game.player.score++;
      playSound(scoreSound);
      if (balls.length > 1) {
        balls.splice(index, 1);
      } else {
        resetBall(ball);
      }
    }
  });
}

function draw() {
  if (settings.bgTheme === "stars") {
    drawStarryBackground();
  } else if (settings.bgTheme === "energy") {
    drawEnergyBackground();
  } else {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  if (gameOver) {
    ctx.font = `${canvas.height * 0.1}px Arial`;
    ctx.textAlign = "center";

    if (game.player.score >= 3) {
      const gradient = ctx.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        50,
        canvas.width / 2,
        canvas.height / 2,
        canvas.width
      );
      gradient.addColorStop(0, "rgba(255,215,0,0.7)");
      gradient.addColorStop(1, "rgba(0,0,0,0.7)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "gold";
      ctx.fillText("🏆 SEN KAZANDIN!", canvas.width / 2, canvas.height / 2);
    } else {
      ctx.fillStyle = "red";
      ctx.fillText(
        "💀 BİLGİSAYAR KAZANDI!",
        canvas.width / 2,
        canvas.height / 2
      );
    }

    if (game.player.score >= 3) {
      for (let i = 0; i < 20; i++) {
        drawFirework(
          Math.random() * canvas.width,
          Math.random() * canvas.height
        );
      }
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
