(() => {
  let frames = 0;
  let sampleStarted = 0;
  let counter;
  let container;

  function frame() {
    if (!counter) {
      counter = document.getElementById("fps-counter");
      sampleStarted = performance.now();
    }
    frames += 1;
    const now = performance.now();
    if (now - sampleStarted >= 500) {
      counter.textContent = Math.round(frames * 1000 / (now - sampleStarted)) + " FPS";
      frames = 0;
      sampleStarted = now;
    }
  }

  function resize() {
    const module = window.gameInstance && window.gameInstance.Module;
    if (module && module.calledRun && module.setCanvasSize) {
      module.setCanvasSize(container.clientWidth, container.clientHeight);
    }
  }

  window.TurboDisplay = { frame };
  document.addEventListener("DOMContentLoaded", () => {
    container = document.getElementById("gameContainer");
    const fullscreen = document.getElementById("fullscreen-button");
    fullscreen.addEventListener("click", async () => {
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else {
          await document.getElementById("game-shell").requestFullscreen();
        }
      } catch {
        fullscreen.textContent = "Fullscreen unavailable";
      }
    });
    document.addEventListener("fullscreenchange", () => {
      fullscreen.textContent = document.fullscreenElement ? "Exit fullscreen" : "Fullscreen";
      requestAnimationFrame(resize);
    });
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", () => {
      frames = 0;
      sampleStarted = performance.now();
    });
  }, { once: true });
})();
