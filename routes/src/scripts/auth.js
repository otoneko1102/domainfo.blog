import { dataStorage } from "./state.js";
import router from "./router.js";

export const getAuthBody = (body = {}) => {
  const password = dataStorage.getItem("adminPassword");
  return { ...body, password };
};

export const fetchWithAuth = (url) => {
  const password = dataStorage.getItem("adminPassword");

  const headers = {
    "Content-Type": "application/json",
  };

  if (password) {
    headers["X-Admin-Password"] = password;
  }

  return fetch(url, {
    method: "GET",
    headers: headers,
  });
};

export const checkAuth = async () => {
  const storedPassword = dataStorage.getItem("adminPassword");
  if (!storedPassword) return false;
  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: storedPassword }),
    });
    return response.ok;
  } catch (err) {
    console.error("Login check failed:", err);
    return false;
  }
};

export const showLoginModal = () => {
  const loginModal = document.getElementById("login-modal");
  if (loginModal) {
    loginModal.classList.remove("hidden");
  }
};

export const handleLogin = async () => {
  const passwordInput = document.getElementById("password-input");
  const loginError = document.getElementById("login-error");
  const password = passwordInput.value;
  if (!password) return;

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (response.ok) {
      dataStorage.setItem("adminPassword", password);
      loginError.textContent = "";
      passwordInput.value = "";
      await router();
    } else {
      loginError.textContent = "パスワードが違います。";
      passwordInput.value = "";
    }
  } catch (error) {
    loginError.textContent = "認証中にエラーが発生しました。";
    console.error("Login failed:", error);
  }
};
