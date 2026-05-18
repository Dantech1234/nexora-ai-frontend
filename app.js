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
async function signup() {
  const email = emailEl.value.trim();
  const password = passwordEl.value.trim();

  if (!validate(email, password)) return;

  setLoading(signupBtn, true);

  const { error } = await supabase.auth.signUp({
    email,
    password
  });

  setLoading(signupBtn, false);

  if (error) return showError(error.message);

  authErrorEl.style.color = "green";
  authErrorEl.innerText = "Account created. Check email to verify.";
}

// ======================
// LOGIN
// ======================
async function login() {
  const email = emailEl.value.trim();
  const password = passwordEl.value.trim();

  if (!validate(email, password)) return;

  setLoading(loginBtn, true);

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  setLoading(loginBtn, false);

  if (error) return showError(error.message);

  clearError();
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
