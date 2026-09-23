const statusEl = document.getElementById("auth-status");
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,}$/;

function setAuthStatus(message) {
  statusEl.textContent = message;
}

initChrome();

const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await request("/api/login", {
        method: "POST",
        body: JSON.stringify({
          email: document.getElementById("login-email").value.trim(),
          password: document.getElementById("login-password").value,
        }),
      });
      window.location.href = "/club.html#club";
    } catch (error) {
      setAuthStatus(error.message);
    }
  });
}

const forgotForm = document.getElementById("forgot-form");
if (forgotForm) {
  forgotForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const previewWrap = document.getElementById("mail-preview");
    const previewLink = document.getElementById("mail-preview-link");
    if (previewWrap) {
      previewWrap.hidden = true;
    }
    try {
      const data = await request("/api/forgot-password", {
        method: "POST",
        body: JSON.stringify({
          email: document.getElementById("forgot-email").value.trim(),
        }),
      });
      setAuthStatus(
        data.message || t("resetSent")
      );
      if (data.previewUrl && previewWrap && previewLink) {
        previewLink.href = data.previewUrl;
        previewWrap.hidden = false;
      }
    } catch (error) {
      setAuthStatus(error.message);
    }
  });
}

const resetForm = document.getElementById("reset-form");
if (resetForm) {
  const token = new URLSearchParams(window.location.search).get("token") || "";
  if (!token) {
    setAuthStatus(t("missingReset"));
  }
  resetForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = document.getElementById("reset-password").value;
    const confirm = document.getElementById("reset-confirm").value;
    if (!PASSWORD_RE.test(password)) {
      setAuthStatus(t("errPasswordLen"));
      return;
    }
    if (password !== confirm) {
      setAuthStatus(t("passwordsMismatch"));
      return;
    }
    if (!token) {
      setAuthStatus(t("missingReset"));
      return;
    }
    try {
      await request("/api/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      setAuthStatus(t("passwordUpdated"));
      window.setTimeout(() => {
        window.location.href = "/login.html";
      }, 900);
    } catch (error) {
      setAuthStatus(error.message);
    }
  });
}

const signupForm = document.getElementById("signup-form");
if (signupForm) {
  const widget = document.getElementById("captcha-widget");
  const robotCheck = document.getElementById("robot-check");
  const submitBtn = document.getElementById("signup-submit");
  const challengeEl = document.getElementById("captcha-challenge");
  const gridEl = document.getElementById("captcha-grid");
  const promptEl = document.getElementById("captcha-prompt");
  const verifyBtn = document.getElementById("captcha-verify-btn");
  let captchaId = "";
  let captchaToken = "";
  let selected = new Set();

  function setSubmitReady() {
    submitBtn.disabled = !captchaToken;
  }

  function resetCaptchaUi() {
    captchaToken = "";
    selected = new Set();
    robotCheck.checked = false;
    widget.classList.remove("checking", "verified");
    challengeEl.hidden = true;
    gridEl.innerHTML = "";
    setSubmitReady();
  }

  function renderTiles(tiles) {
    gridEl.innerHTML = "";
    selected = new Set();
    for (const tile of tiles) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "captcha-tile";
      button.dataset.id = tile.id;
      const img = document.createElement("img");
      img.src = tile.image;
      img.alt = "";
      button.append(img);
      button.addEventListener("click", () => {
        if (selected.has(tile.id)) {
          selected.delete(tile.id);
          button.classList.remove("selected");
        } else {
          selected.add(tile.id);
          button.classList.add("selected");
        }
      });
      gridEl.append(button);
    }
  }

  async function loadCaptcha() {
    resetCaptchaUi();
    const data = await request("/api/captcha");
    captchaId = data.captchaId;
    promptEl.textContent = data.prompt || t("captchaPrompt");
    renderTiles(data.tiles || []);
  }

  loadCaptcha().catch((error) => setAuthStatus(error.message));

  robotCheck.addEventListener("click", (event) => {
    if (captchaToken) {
      return;
    }
    event.preventDefault();
    robotCheck.checked = false;
    challengeEl.hidden = false;
    widget.classList.add("checking");
  });

  verifyBtn.addEventListener("click", async () => {
    if (!captchaId) {
      setAuthStatus(t("confirmRobot"));
      return;
    }
    try {
      const data = await request("/api/captcha/verify", {
        method: "POST",
        body: JSON.stringify({
          captchaId,
          selected: [...selected],
        }),
      });
      captchaToken = data.captchaToken;
      robotCheck.checked = true;
      widget.classList.remove("checking");
      widget.classList.add("verified");
      challengeEl.hidden = true;
      setSubmitReady();
      setAuthStatus("");
    } catch (error) {
      captchaToken = "";
      robotCheck.checked = false;
      setSubmitReady();
      setAuthStatus(error.message);
      await loadCaptcha().catch(() => {});
      challengeEl.hidden = false;
    }
  });

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = document.getElementById("signup-password").value;
    const confirm = document.getElementById("signup-confirm").value;
    if (!PASSWORD_RE.test(password)) {
      setAuthStatus(t("errPasswordLen"));
      return;
    }
    if (password !== confirm) {
      setAuthStatus(t("passwordsMismatch"));
      return;
    }
    if (!captchaToken) {
      setAuthStatus(t("completeCaptcha"));
      challengeEl.hidden = false;
      return;
    }

    try {
      await request("/api/signup", {
        method: "POST",
        body: JSON.stringify({
          email: document.getElementById("signup-email").value.trim(),
          password,
          website: document.getElementById("signup-website").value,
          captchaToken,
        }),
      });
      window.location.href = "/club.html#club";
    } catch (error) {
      await loadCaptcha().catch(() => {});
      setAuthStatus(error.message);
    }
  });
}
