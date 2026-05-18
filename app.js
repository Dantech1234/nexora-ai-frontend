import { supabase } from "./supabase.js";

const API_URL = "https://nexora-ai-61ku.onrender.com";

let currentUser = null;
let conversation_id = null;

// ======================
// UI CONTROLLER (SINGLE SOURCE OF TRUTH)
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
// AUTH INITIALIZATION (DEVICE-PROOF)
// ======================
async function initAuth() {
  const { data } = await supabase.auth.getSession();

  if (data.session?.user) {
    currentUser = data.session.user;
    setUI(currentUser);
    loadConversations();
  } else {
    setUI(null);
  }
}

// Listen for ALL auth changes (login/logout/session refresh)
supabase.auth.onAuthStateChange((event, session) => {
  currentUser = session?.user || null;

  setUI(currentUser);

  if (currentUser) {
    loadConversations();
  }
});

// Run auth init immediately
initAuth();

// ======================
// AUTH FUNCTIONS
// ======================
async function signup() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const { error } = await supabase.auth.signUp({
    email,
    password
  });

  if (error) return alert(error.message);

  alert("Account created. Check email or login.");
}

async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) return alert(error.message);

  // NO UI SWITCH HERE — handled by auth listener
}

// ======================
// ENTER KEY SUPPORT
// ======================
function handleKey(e) {
  if (e.key === "Enter") sendMessage();
}

// ======================
// SEND MESSAGE (STREAMING)
// ======================
async function sendMessage() {
  const input = document.getElementById("input");
  const text = input.value.trim();

  if (!text || !currentUser) return;

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
// FORMAT (SAFE CHAT STYLE)
// ======================
function format(text) {
  return text
    .replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br>");
}

// ======================
// NEW CHAT
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

  if (error) {
    console.error(error);
    return;
  }

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

  if (error) {
    console.error(error);
    return;
  }

  document.getElementById("messages").innerHTML = "";

  (data || []).forEach(m => {
    addMessage(m.content, m.role === "user" ? "user" : "bot");
  });

  scrollBottom();
}
