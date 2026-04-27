(() => {
  // ---------- Trail (paper plane) ----------
  const trailFill = document.getElementById("trailFill");
  const trailPlane = document.getElementById("trailPlane");

  const updateTrail = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const pct = max > 0 ? (window.scrollY / max) * 100 : 0;
    const clamped = Math.max(0, Math.min(100, pct));
    trailFill.style.width = `${clamped}%`;
    trailPlane.style.left = `calc(${clamped}% - 11px)`;
  };
  window.addEventListener("scroll", updateTrail, { passive: true });
  window.addEventListener("resize", updateTrail);
  updateTrail();

  // ---------- Envelope open ----------
  const envelope = document.getElementById("envelope");
  const coverHint = document.getElementById("coverHint");
  if (envelope) {
    const open = () => {
      envelope.classList.add("is-open");
      if (coverHint) coverHint.textContent = "다섯 장이 도착했어요. 아래로 ↓";
    };
    envelope.addEventListener("click", open);
    envelope.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });
  }

  // ---------- Postcard reveal + flip ----------
  const cards = document.querySelectorAll("[data-flip]");
  const cardObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
        }
      });
    },
    { threshold: 0.25 },
  );
  cards.forEach((card) => {
    cardObserver.observe(card);
    card.addEventListener("click", (e) => {
      // ignore clicks on stamps so they keep their own behavior
      if (e.target.closest("[data-stamp]")) return;
      card.classList.toggle("is-flipped");
    });
  });

  // ---------- Stamp shake ----------
  document.querySelectorAll("[data-stamp]").forEach((stamp) => {
    stamp.addEventListener("click", (e) => {
      e.stopPropagation();
      stamp.classList.remove("is-shaking");
      void stamp.offsetWidth;
      stamp.classList.add("is-shaking");
    });
  });

  // ---------- Rain drops (rain scene) ----------
  const rainLayer = document.getElementById("rainLayer");
  if (rainLayer) {
    const drops = 60;
    for (let i = 0; i < drops; i++) {
      const span = document.createElement("span");
      span.style.left = `${Math.random() * 100}%`;
      span.style.animationDuration = `${0.7 + Math.random() * 1.2}s`;
      span.style.animationDelay = `${Math.random() * 2}s`;
      span.style.opacity = `${0.4 + Math.random() * 0.6}`;
      rainLayer.appendChild(span);
    }
  }

  // ---------- Umbrella swing on scroll near rain scene ----------
  const umbrella = document.querySelector(".art__umbrella");
  if (umbrella) {
    const rainScene = document.querySelector('[data-scene="rain"]');
    let raf = null;
    const update = () => {
      raf = null;
      if (!rainScene) return;
      const rect = rainScene.getBoundingClientRect();
      const center = rect.top + rect.height / 2 - window.innerHeight / 2;
      const t = Math.max(-1, Math.min(1, center / window.innerHeight));
      umbrella.style.transform = `translateX(-50%) rotate(${t * 8}deg)`;
    };
    window.addEventListener(
      "scroll",
      () => {
        if (!raf) raf = requestAnimationFrame(update);
      },
      { passive: true },
    );
    update();
  }

  // ---------- Reply card ----------
  const replyInput = document.getElementById("replyInput");
  const replyCount = document.getElementById("replyCount");
  const replySend = document.getElementById("replySend");
  const replyEcho = document.getElementById("replyEcho");

  if (replyInput && replyCount) {
    const updateCount = () => {
      replyCount.textContent = `${replyInput.value.length} / 120`;
    };
    replyInput.addEventListener("input", updateCount);
    updateCount();
  }

  if (replySend) {
    replySend.addEventListener("click", () => {
      const text = (replyInput?.value || "").trim();
      if (!text) {
        replyEcho.textContent = "한 줄만 적어주세요.";
        return;
      }
      replyEcho.textContent = `잘 받았어요. “${text}” — 그 곳으로 다음 엽서를 보낼게요.`;
      if (replyInput) replyInput.value = "";
      if (replyCount) replyCount.textContent = "0 / 120";
    });
  }

  // ---------- Wax seal drag ----------
  const wax = document.getElementById("wax");
  if (wax) {
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let offsetX = 0;
    let offsetY = 0;

    const onDown = (e) => {
      dragging = true;
      wax.setPointerCapture?.(e.pointerId);
      startX = e.clientX;
      startY = e.clientY;
    };

    const onMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      wax.style.transform = `translate(${offsetX + dx}px, ${offsetY + dy}px)`;
    };

    const onUp = (e) => {
      if (!dragging) return;
      dragging = false;
      wax.releasePointerCapture?.(e.pointerId);
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      offsetX += dx;
      offsetY += dy;
      wax.classList.remove("is-stamped");
      void wax.offsetWidth;
      wax.classList.add("is-stamped");
    };

    wax.addEventListener("pointerdown", onDown);
    wax.addEventListener("pointermove", onMove);
    wax.addEventListener("pointerup", onUp);
    wax.addEventListener("pointercancel", onUp);
  }
})();
