import { supabase } from "./supabase.js";

const API_URL = "https://nexora-ai-61ku.onrender.com";

let currentUser = null;
let conversation_id = null;
let authReady = false;

// ======================
// ELEMENTS
// ======================
const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");
const authErrorEl = document.getElementById("auth-error");
const loginBtn = document.getElementById("loginBtn");
const signupBtn = document.getElementById("signupBtn");

// ======================
// UI CONTROLLER
// ======================
function setUI(user) {
  const auth = document.getElementById("auth");
  const app = document.getElementById("app");

  if (user) {
    auth.classList.add("hidden");
    app.classList.remove("hidden");
  } else {
    auth.classList.remove("hidden");
    app.classList.add("hidden");
  }
}

// ======================
// ERROR HANDLING
// ======================
function showError(msg) {
  if (!authErrorEl) return;
  authErrorEl.innerText = msg;
  authErrorEl.style.color = "red";
}

function clearError() {
  if (!authErrorEl) return;
  authErrorEl.innerText = "";
}

// ======================
// VALIDATION
// ======================
function validate(email, password) {
  clearError();

  if (!email || !password) {
    showError("Email and password cannot be empty");
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showError("Invalid email format");
    return false;
  }

  if (password.length < 6) {
    showError("Password must be at least 6 characters");
    return false;
  }

  return true;
}

// ======================
// BUTTON LOADING STATE
// ======================
function setLoading(btn, state) {
  if (!btn) return;

  if (state) {
    btn.disabled = true;
    btn.dataset.text = btn.innerText;
    btn.innerText = "Loading...";
  } else {
    btn.disabled = false;
    btn.innerText = btn.dataset.text;
  }
}

// ======================
// AUTH INIT (SAFE FOR ALL DEVICES)
// ======================
async function initAuth() {
  const { data } = await supabase.auth.getSession();

  currentUser = data?.session?.user || null;
  setUI(currentUser);

  if (currentUser) loadConversations();

  authReady = true;
}

initAuth();

// ======================
// AUTH LISTENER
// ======================
supabase.auth.onAuthStateChange((event, session) => {
  currentUser = session?.user || null;

  setUI(currentUser);

  if (currentUser) loadConversations();
});

// ======================
// SIGNUP
// ======================
function showAuthError(msg) {
  const el = document.getElementById("auth-error");
  if (!el) return;
  el.innerText = msg;
}

function clearAuthError() {
  const el = document.getElementById("auth-error");
  if (!el) return;
  el.innerText = "";
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password) {
  return password.length >= 6;
}

// ======================
// SIGNUP (CLEAN + SAFE)
// ======================
async function signup() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  clearAuthError();

  if (!email || !password) {
    return showAuthError("Please fill in all fields.");
  }

  if (!validateEmail(email)) {
    return showAuthError("Please enter a valid email.");
  }

  if (!validatePassword(password)) {
    return showAuthError("Password must be at least 6 characters.");
  }

  const btn = document.getElementById("signupBtn");
  btn.disabled = true;
  btn.innerText = "Creating account...";

  const { error } = await supabase.auth.signUp({
    email,
    password
  });

  btn.disabled = false;
  btn.innerText = "Sign Up";

  if (error) {
    return showAuthError(error.message);
  }

  showAuthError("Account created. Check email to verify.");
}

// ======================
// LOGIN (CLEAN + SAFE)
// ======================
async function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  clearAuthError();

  if (!email || !password) {
    return showAuthError("Email and password cannot be empty.");
  }

  if (!validateEmail(email)) {
    return showAuthError("Invalid email format.");
  }

  if (!validatePassword(password)) {
    return showAuthError("Password must be at least 6 characters.");
  }

  const btn = document.getElementById("loginBtn");
  btn.disabled = true;
  btn.innerText = "Logging in...";

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  btn.disabled = false;
  btn.innerText = "Login";

  if (error) {
    return showAuthError("Login failed: " + error.message);
  }

  if (!data?.user) {
    return showAuthError("Login failed: No user returned.");
  }

  currentUser = data.user;
}
// ======================
// CHAT STREAMING
// ======================
async function sendMessage() {
  if (!currentUser) return showError("Login first");

  const input = document.getElementById("input");
  const text = input.value.trim();

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

  document.getElementById("messages").appendChild(div);
  scrollBottom();
}

function createBotMessage() {
  const div = document.createElement("div");
  div.className = "msg bot";

  document.getElementById("messages").appendChild(div);
  scrollBottom();

  return div;
}

function scrollBottom() {
  const el = document.getElementById("messages");
  el.scrollTop = el.scrollHeight;
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
// CHAT SYSTEM
// ======================
function newChat() {
  conversation_id = null;
  document.getElementById("messages").innerHTML = "";
}

// ======================
// CONVERSATIONS
// ======================
async function loadConversations() {
  if (!currentUser) return;

  const { data, error } = await supabase
    .from("conversations")
    .select("id, title, created_at")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false });

  if (error) return console.error(error);

  const history = document.getElementById("history");
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

  document.getElementById("messages").innerHTML = "";

  (data || []).forEach(m => {
    addMessage(m.content, m.role === "user" ? "user" : "bot");
  });

  scrollBottom();
}
