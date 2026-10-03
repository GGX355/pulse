const call =
  (name) =>
  async ({ data } = {}) => {
    const response = await fetch(`/api/pulse/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(data || {}),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "请求失败");
    return result;
  };
export const fetchLivePoll = call("fetchLivePoll"),
  fetchPollById = call("fetchPollById"),
  fetchPollList = call("fetchPollList"),
  createLivePoll = call("createLivePoll"),
  listVoterProfiles = call("listVoterProfiles"),
  fetchRosterStatus = call("fetchRosterStatus"),
  fetchVoteDetails = call("fetchVoteDetails"),
  closeLivePoll = call("closeLivePoll"),
  castVote = call("castVote");
export const fetchContentById = call("fetchContentById"),
  fetchDrawById = call("fetchDrawById"),
  fetchDrawList = call("fetchDrawList"),
  fetchDrawListAdmin = call("fetchDrawListAdmin"),
  fetchHomeContent = call("fetchHomeContent"),
  fetchDrawAdmin = call("fetchDrawAdmin"),
  createDrawLive = call("createDrawLive"),
  drawLiveOnce = call("drawLiveOnce"),
  setDrawResultsPublic = call("setDrawResultsPublic"),
  fetchPublicClaims = call("fetchPublicClaims"),
  fetchLiveDraw = call("fetchLiveDraw"),
  deleteContent = call("deleteContent"),
  listDrawClaims = call("listDrawClaims");
export const effectiveMaxChoices = (max, count) => (max <= 0 ? count : Math.min(max, count));
export const REVEAL_MODES = ["flip", "scratch", "grid"];
export const session = call("session"),
  login = call("login"),
  logout = call("logout");
