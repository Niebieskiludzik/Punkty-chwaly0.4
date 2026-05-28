document.addEventListener("DOMContentLoaded", async () => {
  initAuthUI();

  const supabase = window.supabaseClient;
  const tabsEl = document.getElementById("statsTabs");
  const summaryEl = document.getElementById("statsSummary");
  const listEl = document.getElementById("statsRankingList");

  const today = new Date().toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  const navbarDate = document.getElementById("navbarDate");
  if (navbarDate) navbarDate.innerText = "📅 " + today;

  const rankings = [
    {
      key: "value",
      label: "Wartość piłkarzy",
      summary: "Wysoka średnia, dużo dni gry i stabilna forma dają większą wartość.",
      value: player => player.marketValue,
      note: player => `średnia ${formatNumber(player.avgDaily)} | stabilność ${formatPercent(player.consistency)} | ${player.activeDays} dni`,
      format: formatPlayerValue
    },
    {
      key: "avg",
      label: "Średnia ocen",
      summary: "Ranking według średniej dziennej oceny gracza.",
      value: player => player.avgDaily,
      note: player => `${player.activeDays} dni z ocenami | ${player.votesCount} ocen`,
      format: value => formatNumber(value)
    },
    {
      key: "consistency",
      label: "Stabilność formy",
      summary: "Im mniej słabszych i bardzo nierównych dni, tym wyżej.",
      value: player => player.consistency,
      note: player => `wahanie formy ${formatNumber(player.stdDev)} | średnia ${formatNumber(player.avgDaily)}`,
      format: formatPercent
    },
    {
      key: "activeDays",
      label: "Aktywność",
      summary: "Liczba różnych dni, w których gracz dostał oceny.",
      value: player => player.activeDays,
      note: player => `${player.votesCount} ocen łącznie`,
      format: value => `${value} dni`
    },
    {
      key: "last30",
      label: "Ostatnie 30 dni",
      summary: "Punkty rankingowe z ostatnich 30 dni liczone jak w rankingu głównym: (średnia dnia - 6) × 40.",
      value: player => player.last30,
      note: player => `${player.last30Days} dni | średnia z tych dni ${formatNumber(player.last30Avg)}`,
      format: value => `${formatSignedNumber(value)} pkt`
    },
    {
      key: "givenAvg",
      label: "Średnia oddawanych ocen",
      summary: "Jak wysoko dany gracz ocenia innych graczy.",
      value: player => player.givenAvg,
      note: player => `${player.givenCount} ocen oddanych innym`,
      format: value => value ? formatNumber(value) : "brak"
    },
    {
      key: "selfAvg",
      label: "Samoocena",
      summary: "Średnia ocen, które gracz wystawił samemu sobie.",
      value: player => player.selfAvg,
      note: player => `${player.selfCount} samoocen`,
      format: value => value ? formatNumber(value) : "brak"
    }
  ];

  try {
    const [{ data: players }, { data: votes, error: votesError }] = await Promise.all([
      supabase.from("players").select("id, name, avatar"),
      supabase.from("votes").select("player_id, voter_name, score, rounds (round_date)")
    ]);

    if (votesError) throw votesError;

    const stats = buildPlayerStats(players || [], votes || []);
    renderTabs(rankings, stats);
    renderRanking(rankings[0], stats);
  } catch (err) {
    console.error(err);
    summaryEl.innerText = "❌ Błąd ładowania rankingów";
  }

  function renderTabs(rankings, stats) {
    tabsEl.innerHTML = rankings.map((ranking, index) => `
      <button class="stats-tab ${index === 0 ? "active" : ""}" data-ranking="${ranking.key}">
        ${ranking.label}
      </button>
    `).join("");

    tabsEl.querySelectorAll(".stats-tab").forEach(button => {
      button.addEventListener("click", () => {
        tabsEl.querySelectorAll(".stats-tab").forEach(tab => tab.classList.remove("active"));
        button.classList.add("active");

        const ranking = rankings.find(item => item.key === button.dataset.ranking);
        renderRanking(ranking, stats);
      });
    });
  }

  function renderRanking(ranking, stats) {
    summaryEl.innerText = ranking.summary;

    const rows = [...stats]
      .filter(player => Number.isFinite(ranking.value(player)) && ranking.value(player) !== 0)
      .sort((a, b) => ranking.value(b) - ranking.value(a));

    if (rows.length === 0) {
      listEl.innerHTML = `<div class="card center">Brak danych</div>`;
      return;
    }

    listEl.innerHTML = rows.map((player, index) => {
      const rank = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`;

      return `
        <div class="stats-row" onclick="location.href='profile.html?id=${player.id}'">
          <div class="stats-rank">${rank}</div>
          <div class="stats-player">
            <div class="stats-name">${player.avatar || "👤"} ${player.name}</div>
            <div class="stats-note">${ranking.note(player)}</div>
          </div>
          <div class="stats-value">${ranking.format(ranking.value(player))}</div>
        </div>
      `;
    }).join("");
  }

  function buildPlayerStats(players, votes) {
    return players.map(player => {
      const receivedVotes = votes.filter(vote => vote.player_id === player.id);
      const givenVotes = votes.filter(vote => vote.voter_name === player.name && vote.player_id !== player.id);
      const selfVotes = votes.filter(vote => vote.voter_name === player.name && vote.player_id === player.id);
      const dailyAverages = getDailyAverages(receivedVotes);
      const avgDaily = average(dailyAverages.map(day => day.average));
      const stdDev = standardDeviation(dailyAverages.map(day => day.average), avgDaily);
      const consistency = dailyAverages.length ? Math.max(0.55, 1 - (stdDev / 4)) : 0;
      const activityFactor = Math.min(1, Math.sqrt(dailyAverages.length / 20));
      const marketValue = Math.round(avgDaily * 1000000 * consistency * activityFactor);
      const past30 = new Date();
      past30.setHours(0, 0, 0, 0);
      past30.setDate(past30.getDate() - 30);

      const last30Days = dailyAverages.filter(day => new Date(day.date) >= past30);
      const last30 = last30Days.reduce((sum, day) => sum + calculateMainRankingPoints(day.average), 0);
      const last30Avg = average(last30Days.map(day => day.average));

      return {
        ...player,
        votesCount: receivedVotes.length,
        activeDays: dailyAverages.length,
        avgDaily,
        stdDev,
        consistency,
        marketValue,
        last30,
        last30Days: last30Days.length,
        last30Avg,
        givenCount: givenVotes.length,
        givenAvg: average(givenVotes.map(vote => Number(vote.score))),
        selfCount: selfVotes.length,
        selfAvg: average(selfVotes.map(vote => Number(vote.score)))
      };
    });
  }

  function calculateMainRankingPoints(dailyAverage) {
    return (dailyAverage - 6) * 40;
  }

  function getDailyAverages(votes) {
    const days = {};

    votes.forEach(vote => {
      const date = vote.rounds?.round_date;
      const score = Number(vote.score);

      if (!date || Number.isNaN(score)) return;
      if (!days[date]) days[date] = [];

      days[date].push(score);
    });

    return Object.entries(days).map(([date, scores]) => ({
      date,
      average: average(scores)
    }));
  }

  function average(values) {
    const valid = values.filter(value => Number.isFinite(value));
    if (valid.length === 0) return 0;

    return valid.reduce((sum, value) => sum + value, 0) / valid.length;
  }

  function standardDeviation(values, avg) {
    if (values.length === 0) return 0;

    const variance = values.reduce((sum, value) => sum + Math.pow(value - avg, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  function formatNumber(value) {
    return Number(value || 0).toFixed(2).replace(".", ",");
  }

  function formatSignedNumber(value) {
    const rounded = Number(value || 0).toFixed(1).replace(".", ",");
    return value > 0 ? `+${rounded}` : rounded;
  }

  function formatPercent(value) {
    return `${Math.round((value || 0) * 100)}%`;
  }

  function formatPlayerValue(value) {
    if (!value) return "brak";

    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(2).replace(".", ",")} mln €`;
    }

    return `${Math.round(value / 1000)} tys. €`;
  }
});
