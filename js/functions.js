document.querySelectorAll("button").forEach((btn) => {
  btn.addEventListener("click", () => {
    playSound(buttonClickSound);
  });
});

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

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const hitSound = getAudioElement("hitSound");
const scoreSound = getAudioElement("scoreSound");
const winGameSound = getAudioElement("winGameSound");
const loseGameSound = getAudioElement("loseGameSound");
const cupSoundNav = getAudioElement("cupSoundNav");
const bgMusics = getAudioElement("bgMusics");
const cubukAsagi = getAudioElement("cubuk-asagi");
const buttonClickSound = getAudioElement("buttonClickSound");
const ballColorInput = document.getElementById("ballColor");
const paddleColorInput = document.getElementById("paddleColor");
const bgThemeSelect = document.getElementById("bgTheme");
const musicSelect = document.getElementById("musicSelect");
const sfxVolumeInput = document.getElementById("sfxVolume");
const pauseBtn = document.getElementById("pauseBtn");
const restartBtn = document.getElementById("restartBtn");
const settingsBtn = document.getElementById("settingsBtn");
const paddleSpeed = 10; // çubuğun hızını ayarla

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
  if (cupSoundNav) {
    cupSoundNav.volume = Math.max(0, Math.min(1, vol * 0.2));
    cupSoundNav.muted = muteAll;
  }
  if (bgMusics) {
    bgMusics.volume = Math.max(0, Math.min(1, vol * 0.2));
    bgMusics.muted = muteAll;
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
let blacks = [];
let stars = [];
let energyLines = [];

let settings = {
  ballColor: "#ffffff",
  paddleColor: "#ff0000",
  bgTheme: "black",
};

function initializeBackgrounds() {
  // Yıldızları oluştur
  stars = [];
  for (let i = 0; i < 200; i++) {
    stars.push({
      x: Math.random() * canvas.clientWidth,
      y: Math.random() * canvas.clientHeight,
      radius: Math.random() * 2,
      speed: Math.random() * 0.5 + 0.1,
    });
  }
  // Siyah oluştur
  blacks = [];
  for (let i = 0; i < 200; i++) {
    blacks.push({
      x: Math.random() * canvas.clientWidth,
      y: Math.random() * canvas.clientHeight,
      radius: Math.random() * 2,
      speed: Math.random() * 0.5 + 0.1,
    });
  }
  // Enerji hatlarını oluştur
  energyLines = [];
  for (let i = 0; i < 50; i++) {
    energyLines.push({
      x: Math.random() * canvas.clientWidth,
      y: Math.random() * canvas.clientHeight,
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
  const scale = window.devicePixelRatio || 1;

  // Canvas gerçek çözünürlük
  canvas.width = canvas.clientWidth * scale;
  canvas.height = canvas.clientHeight * scale;

  // Çizim koordinatlarını CSS boyutuna uydur
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(scale, scale);

  initializeGameElements();
}

window.addEventListener("load", setupCanvasSize);
window.addEventListener("resize", setupCanvasSize);

document.addEventListener("keydown", (e) => {
  if (cupSoundNav && cupSoundNav.paused)
    cupSoundNav.play().catch((e) => console.error("Müzik çalınamadı:", e));
  if (bgMusics && bgMusics.paused)
    bgMusics.play().catch((e) => console.error("Müzik çalınamadı:", e));
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
    if (relativeY < canvas.clientHeight / 2) {
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

document.getElementById("upBtn").addEventListener("click", () => {
  if (game.player.y > 0) {
    game.player.y -= paddleSpeed;
  }
});

document.getElementById("downBtn").addEventListener("click", () => {
  if (game.player.y + game.player.height < canvas.clientHeight) {
    game.player.y += paddleSpeed;
  }
});

function setupHoldButton(btnId, direction) {
  let interval;

  const start = (e) => {
    e.preventDefault(); // mobilde kaydırmayı engelle
    interval = setInterval(() => {
      if (direction === "up" && game.player.y > 0) {
        game.player.y -= paddleSpeed;
      }
      if (
        direction === "down" &&
        game.player.y + game.player.height < canvas.clientHeight
      ) {
        game.player.y += paddleSpeed;
      }
    }, 30); // hız (ms)
  };

  const stop = () => clearInterval(interval);

  const btn = document.getElementById(btnId);
  btn.addEventListener("mousedown", start);
  btn.addEventListener("touchstart", start);

  btn.addEventListener("mouseup", stop);
  btn.addEventListener("mouseleave", stop); // fare dışarı çıkarsa dursun
  btn.addEventListener("touchend", stop);
  btn.addEventListener("touchcancel", stop);
}

// Kullanım:
setupHoldButton("upBtn", "up");
setupHoldButton("downBtn", "down");

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
  updateScoreboard(); // Update scoreboard when game restarts
  initializeGameElements();
  gameOver = false;
  isPaused = true;
  setPauseIcon(true);
  setRestartIcon();
  setSettingsIcon();
  if (isPaused) {
    cupSoundNav.pause();
  } else {
    cupSoundNav.play();
  }
});

pauseBtn.addEventListener("click", () => {
  isPaused = !isPaused;
  setPauseIcon(isPaused);
  if (isPaused) {
    cupSoundNav.pause();
  } else {
    cupSoundNav.play();
  }
});

settingsBtn.addEventListener("click", () => {
  isPaused = true;
  document.getElementById("settingsMenu").style.display = "flex";
  setPauseIcon(true);
  if (isPaused) {
    cupSoundNav.pause();
  } else {
    cupSoundNav.play();
  }
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
  const selected = e.target.value;
  if (cupSoundNav) {
    cupSoundNav.pause();
    cupSoundNav.currentTime = 0;
    cupSoundNav.src = selected === "none" ? "" : `sounds/${selected}`;
    if (selected !== "none") {
      cupSoundNav
        .play()
        .then(() => {
          // Seçilen müzik çalarken volume'u slider ile senkronize et
          const vol = parseFloat(sfxVolumeInput.value || 0.5);
          cupSoundNav.volume = Math.max(0, Math.min(1, vol * 0.2));
          cupSoundNav.muted = vol <= 0;
        })
        .catch((err) => console.error("Müzik çalınamadı:", err));
    }
  }

  // Seçim sonrası tüm sesleri güncelle
  updateAllVolumes();
});
let lastVolumeValue = parseFloat(sfxVolumeInput.value || 0);
sfxVolumeInput.addEventListener("input", (e) => {
  if (hitSound) hitSound.volume = e.target.value;
  if (scoreSound) scoreSound.volume = e.target.value;
  if (winGameSound) winGameSound.volume = e.target.value;
  if (loseGameSound) loseGameSound.volume = e.target.value;
  if (buttonClickSound) buttonClickSound.volume = e.target.value;

  updateAllVolumes();

  const currentValue = parseFloat(sfxVolumeInput.value || 0);

  if (currentValue > lastVolumeValue) {
    console.log("ses yükseldi");
    // Ses yükseltildi
    playSound(buttonClickSound);
  } else if (currentValue < lastVolumeValue) {
    console.log("ses kısıldı.");
    // Ses kısıldı
    playSound(buttonClickSound);
  }

  lastVolumeValue = currentValue; // güncelle
});

// Global updateScoreboard function
function updateScoreboard() {
  const userScoreElement = document.getElementById("userScore");
  const computerScoreElement = document.getElementById("computerScore");

  if (userScoreElement && computerScoreElement) {
    userScoreElement.textContent = game.player.score;
    computerScoreElement.textContent = game.computer.score;
  }
}

function startGame(level) {
  setPauseIcon(false);
  difficulty = level;
  document.getElementById("levelMenu").style.display = "none";
  game.player.score = 0;
  game.computer.score = 0;
  updateScoreboard(); // Update scoreboard when game starts
  initializeGameElements();
  gameOver = false;
  isPaused = false;
  lastPowerUpTime = Date.now();

  if (level === "kolay") hitProbability = 0.2;
  else if (level === "orta") hitProbability = 0.5;
  else if (level === "zor") hitProbability = 0.8;

  if (cupSoundNav && cupSoundNav.paused)
    cupSoundNav.play().catch((e) => console.error("Müzik çalınamadı:", e));
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

// Modify drawScore function to handle mobile and desktop
function drawScore() {
  // Only draw scores on canvas for desktop (when screen width > 768px)
  if (window.innerWidth > 768) {
    ctx.font = `${canvas.clientHeight * 0.06}px Arial`;
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.fillText(
      game.player.score,
      canvas.clientWidth / 4,
      canvas.clientHeight * 0.1
    );
    ctx.fillText(
      game.computer.score,
      (3 * canvas.clientWidth) / 4,
      canvas.clientHeight * 0.1
    );
  }
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
  ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  ctx.fillStyle = "white";
  stars.forEach((star) => {
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.closePath();
  });
}

function drawBlackBackground() {
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  ctx.fillStyle = "white";
  blacks.forEach((black) => {
    ctx.beginPath();
    ctx.arc(black.x, black.y, black.radius, 0, Math.PI * 2);
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
    ctx.strokeStyle = `hsl(${
      Math.abs(Math.sin(line.x / 100)) * 120 + 200
    }, 100%, 50%)`;
    ctx.stroke();
  });
}

function resetBall(ball) {
  ball.x = canvas.clientWidth / 2;
  ball.y = canvas.clientHeight / 2;
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
      game.player.height = game.player.height * 1.5;
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
        });
      }
      break;
  }

  powerup = null;
  lastPowerUpTime = Date.now();
}

// Yeni animasyon değişkenleri
let textScale = 0;
let textOpacity = 0;
const maxTextScale = 1.0;
const textAnimationSpeed = 0.02;

function animateWinText() {
  // Metin animasyonunu güncelle
  if (textScale < maxTextScale) {
    textScale += textAnimationSpeed;
    textOpacity += textAnimationSpeed;
    if (textScale > maxTextScale) {
      textScale = maxTextScale;
    }
    if (textOpacity > 1) {
      textOpacity = 1;
    }
  }

  ctx.font = `${Math.floor(100 * textScale)}px 'Bangers', cursive`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Parlama efekti için gölge ayarları
  ctx.shadowColor = `rgba(255, 215, 0, ${textOpacity})`;
  ctx.shadowBlur = 20;

  // Yazı rengi ve opasitesi
  ctx.fillStyle = `rgba(255, 215, 0, ${textOpacity})`;

  // Metni canvas'ın tam ortasına çiz
  const text = "🏆 SEN KAZANDIN!";
  ctx.fillText(text, canvas.clientWidth / 2, canvas.clientHeight / 2);

  // Parlama efektini kapat
  ctx.shadowBlur = 0;

  // Animasyon tamamlanmadıysa devam et
  if (textScale < maxTextScale) {
    requestAnimationFrame(animateWinText);
  }
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
        textScale = 0; // Animasyonu baştan başlat
        textOpacity = 0; // Animasyonu baştan başlat
        requestAnimationFrame(animateWinText);
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
        star.x = canvas.clientWidth;
        star.y = Math.random() * canvas.clientHeight;
      }
    });
  }

  if (settings.bgTheme === "blacks") {
    blacks.forEach((black) => {
      black.x -= black.speed;
      if (black.x < 0) {
        black.x = canvas.clientWidth;
        black.y = Math.random() * canvas.clientHeight;
      }
    });
  }

  if (settings.bgTheme === "energy") {
    energyLines.forEach((line) => {
      line.x += Math.cos(line.angle) * line.speed;
      line.y += Math.sin(line.angle) * line.speed;
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

  const playerSpeed = 7;
  if (upPressed && game.player.y > 0) {
    game.player.y -= playerSpeed * deltaTime * (canvas.clientHeight / 500);
  }

  if (downPressed && game.player.y < canvas.clientHeight - game.player.height) {
    game.player.y += playerSpeed * deltaTime * (canvas.clientHeight / 500);
  }

  if (!isComputerFrozen) {
    if (Math.random() < hitProbability) {
      const targetY = balls[0].y - game.computer.height / 2;
      game.computer.y += (targetY - game.computer.y) * 0.1 * deltaTime;
    }
  }
  if (game.computer.y < 0) game.computer.y = 0;
  if (game.computer.y + game.computer.height > canvas.clientHeight)
    game.computer.y = canvas.clientHeight - game.computer.height;

  balls.forEach((ball, index) => {
    ball.x += ball.dx * deltaTime;
    ball.y += ball.dy * deltaTime;

    if (
      ball.y + ball.radius > canvas.clientHeight ||
      ball.y - ball.radius < 0
    ) {
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
      updateScoreboard(); // Update scoreboard when computer scores
      if (balls.length > 1) {
        balls.splice(index, 1);
      } else {
        resetBall(ball);
      }
    }
    if (ball.x > canvas.clientWidth) {
      game.player.score++;
      playSound(scoreSound);
      updateScoreboard(); // Update scoreboard when player scores
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
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  }

  if (gameOver) {
    ctx.font = `${canvas.clientHeight * 0.1}px Arial`;
    ctx.textAlign = "center";

    if (game.player.score >= 3) {
      // Bu kısım animasyonlu metin fonksiyonu tarafından çizilecek,
      // bu yüzden burada sadece arka planı çiziyoruz.
      const gradient = ctx.createRadialGradient(
        canvas.clientWidth / 2,
        canvas.clientHeight / 2,
        50,
        canvas.clientWidth / 2,
        canvas.clientHeight / 2,
        canvas.clientWidth
      );
      gradient.addColorStop(0, "rgba(255,215,0,0.7)");
      gradient.addColorStop(1, "rgba(0,0,0,0.7)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      ctx.fillStyle = "gold";
      ctx.fillText(
        "🏆 SEN KAZANDIN!",
        canvas.clientWidth / 2,
        canvas.clientHeight / 2
      );
    } else {
      ctx.fillStyle = "red";
      ctx.fillText(
        "💀 BİLGİSAYAR KAZANDI!",
        canvas.clientWidth / 2,
        canvas.clientHeight / 2
      );
    }

    if (game.player.score >= 3) {
      for (let i = 0; i < 20; i++) {
        drawFirework(
          Math.random() * canvas.clientWidth,
          Math.random() * canvas.clientHeight
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
