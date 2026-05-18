import { supabase } from "./supabase.js";

const API_URL = "https://nexora-ai-61ku.onrender.com";

let currentUser = null;
let conversation_id = null;

// ======================
// SAFE DOM ACCESS (PREVENT CRASHES)
// ======================
function el(id) {
  return document.getElementById(id);
}

// ======================
// AUTH ERROR UI
// ======================
function showAuthError(msg) {
  const box = el("auth-error");
  if (box) {
    box.innerText = msg;
    box.style.color = "red";
  }
}

function clearAuthError() {
  const box = el("auth-error");
  if (box) box.innerText = "";
}

// ======================
// VALIDATION
// ======================
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password) {
  return password && password.length >= 6;
}

// ======================
// UI SWITCH
// ======================
function setUI(user) {
  const auth = el("auth");
  const app = el("app");

  if (!auth || !app) return;

  if (user) {
    auth.classList.add("hidden");
    app.classList.remove("hidden");
  } else {
    auth.classList.remove("hidden");
    app.classList.add("hidden");
  }
}

// ======================
// AUTH INIT
// ======================
async function initAuth() {
  const { data } = await supabase.auth.getSession();

  currentUser = data?.session?.user || null;
  setUI(currentUser);

  if (currentUser) loadConversations();
}

initAuth();

// ======================
// AUTH LISTENER
// ======================
supabase.auth.onAuthStateChange((_event, session) => {
  currentUser = session?.user || null;
  setUI(currentUser);

  if (currentUser) loadConversations();
});

// ======================
// SIGNUP
// ======================
async function signup() {
  const email = el("email")?.value.trim();
  const password = el("password")?.value.trim();
  const btn = el("signupBtn");

  clearAuthError();

  if (!email || !password)
    return showAuthError("Please fill in all fields");

  if (!validateEmail(email))
    return showAuthError("Invalid email format");

  if (!validatePassword(password))
    return showAuthError("Password must be 6+ characters");

  try {
    if (btn) {
      btn.disabled = true;
      btn.innerText = "Creating...";
    }

    const { error } = await supabase.auth.signUp({
      email,
      password
    });

    if (error) return showAuthError(error.message);

    showAuthError("Account created. Check email.");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = "Sign Up";
    }
  }
}

// ======================
// LOGIN
// ======================
async function login() {
  const email = el("email")?.value.trim();
  const password = el("password")?.value.trim();
  const btn = el("loginBtn");

  clearAuthError();

  if (!email || !password)
    return showAuthError("Email and password required");

  if (!validateEmail(email))
    return showAuthError("Invalid email format");

  if (!validatePassword(password))
    return showAuthError("Password must be 6+ characters");

  try {
    if (btn) {
      btn.disabled = true;
      btn.innerText = "Logging in...";
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) return showAuthError(error.message);

    currentUser = data?.user || null;
    setUI(currentUser);

    if (currentUser) loadConversations();
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = "Login";
    }
  }
}

// ======================
// CHAT
// ======================
async function sendMessage() {
  if (!currentUser) return showAuthError("Login first");

  const input = el("input");
  const text = input?.value.trim();
  if (!text) return;

  addMessage(text, "user");
  input.value = "";

  const botDiv = createBotMessage();
  botDiv.innerHTML = "Thinking...";

  try {
    const res = await fetch(`${API_URL}/chat-stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        user_id: currentUser.id,
        conversation_id
      })
    });

    if (!res.ok || !res.body) {
      botDiv.innerHTML = "Connection error";
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    let fullText = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      fullText += decoder.decode(value);
      botDiv.innerHTML = format(fullText);
      scrollBottom();
    }

    loadConversations();
  } catch (err) {
    console.error(err);
    botDiv.innerHTML = "Network error";
  }
}

// ======================
// UI HELPERS
// ======================
function addMessage(text, type) {
  const div = document.createElement("div");
  div.className = `msg ${type}`;
  div.innerHTML = format(text);

  el("messages")?.appendChild(div);
  scrollBottom();
}

function createBotMessage() {
  const div = document.createElement("div");
  div.className = "msg bot";

  el("messages")?.appendChild(div);
  scrollBottom();

  return div;
}

function scrollBottom() {
  const box = el("messages");
  if (box) box.scrollTop = box.scrollHeight;
}

// ======================
// FORMAT
// ======================
function format(text) {
  return text
    .replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br>");
}

// ======================
// CONVERSATIONS
// ======================
async function loadConversations() {
  if (!currentUser) return;

  const { data, error } = await supabase
    .from("conversations")
    .select("id, title")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false });

  if (error) return console.error(error);

  const history = el("history");
  if (!history) return;

  history.innerHTML = "";

  (data || []).forEach(c => {
    const div = document.createElement("div");
    div.className = "history-item";
    div.innerText = c.title;

    div.onclick = () => {
      conversation_id = c.id;
      loadMessages(c.id);
    };

    history.appendChild(div);
  });
}

// ======================
// LOAD MESSAGES
// ======================
async function loadMessages(id) {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  if (error) return console.error(error);

  const box = el("messages");
  if (!box) return;

  box.innerHTML = "";

  (data || []).forEach(m => {
    addMessage(m.content, m.role === "user" ? "user" : "bot");
  });

  scrollBottom();
}

// ======================
// GLOBAL EXPORTS (IMPORTANT)
// ======================
window.login = login;
window.signup = signup;
window.sendMessage = sendMessage;
window.handleKey = (e) => {
  if (e.key === "Enter") sendMessage();
};
window.newChat = () => {
  conversation_id = null;
  const box = el("messages");
  if (box) box.innerHTML = "";
};
