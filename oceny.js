document.addEventListener("DOMContentLoaded", async () => {
  initAuthUI();

  const supabase = window.supabaseClient;
  const roundPicker = document.getElementById("roundPicker");
  const matrixBox = document.getElementById("votesMatrix");
  const mobileBox = document.getElementById("votesCards");
  const summary = document.getElementById("votesSummary");

  const today = new Date().toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  const navbarDate = document.getElementById("navbarDate");
  if (navbarDate) navbarDate.innerText = "📅 " + today;

  let players = [];
  let playerById = new Map();
  let playerByName = new Map();
  let roundsWithVotes = [];
  let selectedRoundId = null;

  await loadData();

  async function loadData() {
    showSummary("Ładowanie danych...");

    const { data: playersData, error: playersError } = await supabase
      .from("players")
      .select("id, name, avatar")
      .order("name", { ascending: true });

    if (playersError) {
      console.error(playersError);
      showSummary("Nie udało się pobrać graczy.", true);
      return;
    }

    players = playersData || [];
    playerById = new Map(players.map(player => [player.id, player]));
    playerByName = new Map(players.map(player => [normalizeName(player.name), player]));

    const { data: roundsData, error: roundsError } = await supabase
      .from("rounds")
      .select("id, round_date")
      .order("round_date", { ascending: false })
      .limit(40);

    if (roundsError) {
      console.error(roundsError);
      showSummary("Nie udało się pobrać rund.", true);
      return;
    }

    const roundIds = (roundsData || []).map(round => round.id);
    if (roundIds.length === 0) {
      showEmpty("Brak rund z ocenami.");
      return;
    }

    const { data: votesData, error: votesError } = await supabase
      .from("votes")
      .select("round_id, player_id, voter_name, score")
      .in("round_id", roundIds);

    if (votesError) {
      console.error(votesError);
      showSummary("Nie udało się pobrać ocen.", true);
      return;
    }

    const votesByRound = new Map();
    (votesData || []).forEach(vote => {
      if (!votesByRound.has(vote.round_id)) votesByRound.set(vote.round_id, []);
      votesByRound.get(vote.round_id).push(vote);
    });

    roundsWithVotes = (roundsData || [])
      .filter(round => (votesByRound.get(round.id) || []).length > 0)
      .slice(0, 5)
      .map(round => ({
        ...round,
        votes: votesByRound.get(round.id) || []
      }));

    if (roundsWithVotes.length === 0) {
      showEmpty("Brak rund z zapisanymi ocenami.");
      return;
    }

    selectedRoundId = roundsWithVotes[0].id;
    renderRoundPicker();
    renderSelectedRound();
  }

  function renderRoundPicker() {
    roundPicker.innerHTML = roundsWithVotes.map(round => `
      <button class="round-pill ${round.id === selectedRoundId ? "active" : ""}" data-round-id="${round.id}">
        ${formatDate(round.round_date)}
      </button>
    `).join("");

    roundPicker.querySelectorAll(".round-pill").forEach(button => {
      button.addEventListener("click", () => {
        selectedRoundId = button.dataset.roundId;
        renderRoundPicker();
        renderSelectedRound();
      });
    });
  }

  function renderSelectedRound() {
    const round = roundsWithVotes.find(item => item.id === selectedRoundId);
    if (!round) return;

    const voters = unique(round.votes.map(vote => vote.voter_name).filter(Boolean));
    const ratedPlayerIds = unique(round.votes.map(vote => vote.player_id).filter(Boolean));

    showSummary(`${formatDate(round.round_date)} · ${round.votes.length} ocen · ${voters.length} oceniających`);
    renderMatrix(round.votes, voters, ratedPlayerIds);
    renderMobileCards(round.votes, voters, ratedPlayerIds);
  }

  function renderMatrix(votes, voters, ratedPlayerIds) {
    const voteMap = new Map(votes.map(vote => [`${vote.player_id}|${normalizeName(vote.voter_name)}`, vote]));

    matrixBox.innerHTML = `
      <div class="votes-table-scroll">
        <table class="votes-table">
          <thead>
            <tr>
              <th class="corner-cell">Oceniany / oceniający</th>
              ${voters.map(voter => `<th>${renderPlayerLinkByName(voter)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${ratedPlayerIds.map(playerId => {
              const player = playerById.get(playerId);
              return `
                <tr>
                  <th>${renderPlayerLink(player)}</th>
                  ${voters.map(voter => {
                    const vote = voteMap.get(`${playerId}|${normalizeName(voter)}`);
                    return `<td>${vote ? renderScore(vote.score) : ""}</td>`;
                  }).join("")}
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderMobileCards(votes, voters, ratedPlayerIds) {
    const voteMap = new Map(votes.map(vote => [`${vote.player_id}|${normalizeName(vote.voter_name)}`, vote]));

    mobileBox.innerHTML = ratedPlayerIds.map(playerId => {
      const player = playerById.get(playerId);
      const scorePills = voters.map(voter => {
        const vote = voteMap.get(`${playerId}|${normalizeName(voter)}`);
        if (!vote) return "";

        return `
          <div class="vote-pill-row">
            <span>${renderPlayerLinkByName(voter)}</span>
            ${renderScore(vote.score)}
          </div>
        `;
      }).join("");

      return `
        <div class="vote-player-card">
          <div class="vote-player-title">${renderPlayerLink(player)}</div>
          <div class="vote-pill-list">${scorePills}</div>
        </div>
      `;
    }).join("");
  }

  function renderScore(score) {
    const numeric = Number(score) || 0;
    const className = numeric >= 8 ? "high" : numeric >= 6 ? "mid" : "low";
    return `<span class="score-badge ${className}">${formatScore(numeric)}</span>`;
  }

  function renderPlayerLink(player) {
    if (!player) return `<span class="player-link muted">Nieznany</span>`;
    return `<a class="player-link" href="profile.html?id=${player.id}">${player.avatar || "👤"} ${escapeHtml(player.name)}</a>`;
  }

  function renderPlayerLinkByName(name) {
    const player = playerByName.get(normalizeName(name));
    if (player) return renderPlayerLink(player);
    return `<span class="player-link">${escapeHtml(name)}</span>`;
  }

  function showEmpty(text) {
    showSummary(text);
    roundPicker.innerHTML = "";
    matrixBox.innerHTML = `<div class="votes-empty">${text}</div>`;
    mobileBox.innerHTML = "";
  }

  function showSummary(text, isError = false) {
    summary.textContent = text;
    summary.classList.toggle("error", isError);
  }

  function unique(values) {
    return Array.from(new Set(values));
  }

  function normalizeName(name) {
    return String(name || "").trim().toLowerCase();
  }

  function formatDate(value) {
    return new Date(value).toLocaleDateString("pl-PL", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }

  function formatScore(value) {
    return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(".", ",");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
});
