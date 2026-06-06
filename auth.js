// 🔥 GLOBALNY CLIENT (JEDYNY!)
window.supabaseClient = window.supabase.createClient(
  'https://wzanqzcjrpbhocrfcciy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6YW5xemNqcnBiaG9jcmZjY2l5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MzQ4MjUsImV4cCI6MjA4NzAxMDgyNX0.VNer3odvLPJzBbecICFZFw86SXvvCbEZDQNVciEm97k'
);

function showLoader(){ console.warn("loader not ready"); }
function hideLoaderSuccess(){}

function loadSharedNavStyles() {
  if (document.querySelector('link[href="nav.css"]')) return;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "nav.css";
  document.head.appendChild(link);
}

function initRegisterLink() {
  const loginBox = document.getElementById("loginBox");
  if (!loginBox || loginBox.querySelector(".register-link")) return;

  const link = document.createElement("a");
  link.href = "register.html";
  link.className = "register-link";
  link.textContent = "Rejestracja";
  loginBox.appendChild(link);
}

function initMainRankingSortFix() {
  const table = document.getElementById("rankingTable");
  if (!table || table.dataset.visiblePointsSortReady) return;

  table.dataset.visiblePointsSortReady = "true";
  let isSorting = false;

  const parsePoints = row => {
    const value = row.children[2]?.textContent || "0";
    return Number(value.replace(/[^0-9.-]/g, "")) || 0;
  };

  const sortRows = () => {
    if (isSorting) return;

    const header = table.querySelector("tr");
    const rows = Array.from(table.querySelectorAll("tr")).slice(1);
    if (!header || rows.length < 2) return;

    isSorting = true;

    rows.sort((a, b) => parsePoints(b) - parsePoints(a));
    table.innerHTML = "";
    table.appendChild(header);

    rows.forEach((row, index) => {
      row.classList.remove("gold", "silver", "bronze");
      if (index === 0) row.classList.add("gold");
      if (index === 1) row.classList.add("silver");
      if (index === 2) row.classList.add("bronze");

      const rankCell = row.children[0];
      if (rankCell) {
        rankCell.textContent = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : String(index + 1);
      }

      table.appendChild(row);
    });

    isSorting = false;
  };

  new MutationObserver(sortRows).observe(table, { childList: true, subtree: true });
  setTimeout(sortRows, 0);
}

function initGlobalNavMenu() {
  loadSharedNavStyles();
  initRegisterLink();
  initMainRankingSortFix();

  const navLeft = document.querySelector(".nav-left");
  if (!navLeft || navLeft.querySelector(".nav-menu-wrap")) return;

  const menu = document.createElement("div");
  menu.className = "nav-menu-wrap";
  menu.innerHTML = `
    <button class="nav-menu-button" type="button" aria-label="Menu">☰</button>
    <div class="nav-menu-panel">
      <a href="index.html">🏆 Ranking główny</a>
      <a href="ranking.html">📅 Ranking miesięczny</a>
      <a href="rankingi.html">📊 Rankingi statystyk</a>
      <a href="register.html">📝 Rejestracja</a>
      <a href="boisko.html">⚽ Umawianie na boisko</a>
    </div>
  `;

  navLeft.prepend(menu);

  const button = menu.querySelector(".nav-menu-button");
  button.addEventListener("click", event => {
    event.stopPropagation();
    menu.classList.toggle("open");
  });

  document.addEventListener("click", () => {
    menu.classList.remove("open");
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initGlobalNavMenu);
} else {
  initGlobalNavMenu();
}

// 🔐 INIT UI
window.initAuthUI = async function () {

  const supabase = window.supabaseClient;

  const userBox = document.getElementById("userBox");
  const loginBox = document.getElementById("loginBox");
  const userName = document.getElementById("userName");

  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      if(userBox) userBox.style.display = "none";
      if(loginBox) loginBox.style.display = "flex";
      initRegisterLink();
      return;
    }

    if(userBox) userBox.style.display = "flex";
    if(loginBox) loginBox.style.display = "none";

    const { data: player } = await supabase
      .from('players')
      .select('*')
      .eq('email', user.email)
      .single();

    if (player && userName) {
      userName.innerHTML =
        `<span class="avatar">${player.avatar || "👤"}</span> ${player.name}`;
    }

  } catch (err) {
    console.error("initAuthUI error:", err);
  }
};

// 🔐 LOGIN
window.login = async function () {

  const supabase = window.supabaseClient;

  showLoader(); // 🔥 START animacji

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const errorBox = document.getElementById("loginError");

  errorBox.innerText = "";

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      hideLoaderSuccess();
      errorBox.innerText = "❌ Nieprawidłowy email lub hasło";
      return;
    }

    localStorage.setItem("savedEmail", email);

    hideLoaderSuccess();

    setTimeout(() => {
      location.reload();
    }, 800);

  } catch (err) {
    console.error(err);
    hideLoaderSuccess();
    errorBox.innerText = "❌ Błąd logowania";
  }
};

// 🔓 LOGOUT
window.logout = async function () {
  const supabase = window.supabaseClient;
  await supabase.auth.signOut();
  location.reload();
};




// ENTER = login
document.addEventListener("keydown", function(e){
  if(e.key === "Enter"){
    const email = document.getElementById("email");
    const password = document.getElementById("password");

    if(document.activeElement === email || document.activeElement === password){
      window.login();
    }
  }
});
