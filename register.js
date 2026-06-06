document.addEventListener("DOMContentLoaded", async () => {
  initAuthUI();

  const supabase = window.supabaseClient;
  const modeInputs = document.querySelectorAll('input[name="playerMode"]');
  const existingPlayerBox = document.getElementById("existingPlayerBox");
  const newPlayerBox = document.getElementById("newPlayerBox");
  const playerSelect = document.getElementById("playerSelect");
  const newPlayerName = document.getElementById("newPlayerName");
  const emailInput = document.getElementById("registerEmail");
  const passwordInput = document.getElementById("registerPassword");
  const registerBtn = document.getElementById("registerBtn");
  const message = document.getElementById("registerMessage");

  const today = new Date().toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  const navbarDate = document.getElementById("navbarDate");
  if (navbarDate) navbarDate.innerText = "📅 " + today;

  modeInputs.forEach(input => {
    input.addEventListener("change", updateMode);
  });

  registerBtn.addEventListener("click", registerAccount);

  await loadPlayers();
  updateMode();

  async function loadPlayers() {
    const { data: players, error } = await supabase
      .from("players")
      .select("id, name, email, avatar")
      .order("name", { ascending: true });

    if (error) {
      showMessage("Nie udało się pobrać listy osób.", true);
      console.error(error);
      return;
    }

    const availablePlayers = (players || []).filter(player => !player.email);

    if (availablePlayers.length === 0) {
      playerSelect.innerHTML = `<option value="">Brak wolnych osób</option>`;
      return;
    }

    playerSelect.innerHTML = availablePlayers.map(player => `
      <option value="${player.id}">${player.avatar || "👤"} ${player.name}</option>
    `).join("");
  }

  function updateMode() {
    const mode = getMode();

    existingPlayerBox.classList.toggle("hidden-field", mode !== "existing");
    newPlayerBox.classList.toggle("hidden-field", mode !== "new");
  }

  async function registerAccount() {
    const mode = getMode();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const selectedPlayerId = playerSelect.value;
    const enteredName = newPlayerName.value.trim();

    showMessage("");

    if (!email || !password) {
      showMessage("Wpisz e-mail i hasło.", true);
      return;
    }

    if (password.length < 6) {
      showMessage("Hasło musi mieć minimum 6 znaków.", true);
      return;
    }

    if (mode === "existing" && !selectedPlayerId) {
      showMessage("Wybierz osobę z listy albo dodaj nową.", true);
      return;
    }

    if (mode === "new" && !enteredName) {
      showMessage("Wpisz nazwę nowej osoby.", true);
      return;
    }

    registerBtn.disabled = true;
    registerBtn.innerText = "Tworzenie...";

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            player_name: mode === "new" ? enteredName : undefined,
            player_id: mode === "existing" ? selectedPlayerId : undefined
          }
        }
      });

      if (signUpError) throw signUpError;

      if (mode === "existing") {
        const { error: updateError } = await supabase
          .from("players")
          .update({ email })
          .eq("id", selectedPlayerId);

        if (updateError) throw updateError;
      }

      if (mode === "new") {
        const { error: insertError } = await supabase
          .from("players")
          .insert({
            name: enteredName,
            email,
            rating: 1000,
            role: "player"
          });

        if (insertError) throw insertError;
      }

      showMessage("Konto utworzone. Jeśli Supabase wymaga potwierdzenia, sprawdź e-mail. Możesz potem się zalogować.");
      emailInput.value = "";
      passwordInput.value = "";
      newPlayerName.value = "";
      await loadPlayers();
    } catch (err) {
      console.error(err);
      showMessage(readableError(err), true);
    } finally {
      registerBtn.disabled = false;
      registerBtn.innerText = "Utwórz konto";
    }
  }

  function getMode() {
    return document.querySelector('input[name="playerMode"]:checked')?.value || "existing";
  }

  function showMessage(text, isError = false) {
    message.innerText = text;
    message.classList.toggle("error", isError);
  }

  function readableError(err) {
    const text = err?.message || "Nie udało się utworzyć konta.";

    if (text.toLowerCase().includes("already")) {
      return "Ten e-mail jest już zarejestrowany.";
    }

    return text;
  }
});
