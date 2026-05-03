export const LEADERBOARD_LIMIT = 12;

function normalizePlayerName(name) {
  const trimmed = String(name ?? "").trim();
  return trimmed || "Anonymous";
}

function normalizeScore(score) {
  const value = Number(score);
  return Number.isFinite(value) ? Math.trunc(value) : 0;
}

function normalizeRecordedAt(recordedAt) {
  const stamp = Date.parse(recordedAt);
  if (!Number.isFinite(stamp)) return null;
  return new Date(stamp).toISOString();
}

export function isSupabaseEnabled(config) {
  const supabaseUrl = String(config?.supabaseUrl ?? "").trim();
  const supabaseAnonKey = String(config?.supabaseAnonKey ?? "").trim();
  return supabaseUrl.length > 0 && supabaseAnonKey.length > 0;
}

export function createLeaderboardEntry(input, now = () => Date.now()) {
  const name = normalizePlayerName(input?.name);
  const score = normalizeScore(input?.score);
  const timestamp = Number(now());
  const recordedAt = new Date(timestamp).toISOString();

  return {
    id: `${timestamp}-${score}-${encodeURIComponent(name)}`,
    name,
    score,
    source: "round",
    recordedAt,
  };
}

export function toSupabaseRow(entry) {
  const normalized = normalizeLeaderboardEntry(entry);
  if (!normalized) return null;

  return {
    player_name: normalized.name,
    score: normalized.score,
    source: normalized.source,
    client_id: normalized.id,
    created_at: normalized.recordedAt,
  };
}

export function fromSupabaseRow(row) {
  if (!row || typeof row !== "object") return null;

  return normalizeLeaderboardEntry({
    id:
      typeof row.client_id === "string" && row.client_id.length > 0
        ? row.client_id
        : row.id,
    name: row.player_name,
    score: row.score,
    source: row.source,
    recordedAt: row.created_at,
  });
}

export function normalizeLeaderboardEntry(entry) {
  if (!entry || typeof entry !== "object") return null;

  const name = normalizePlayerName(entry.name);
  const scoreValue = Number(entry.score);
  if (!Number.isFinite(scoreValue)) return null;

  const recordedAt = normalizeRecordedAt(entry.recordedAt);
  if (!recordedAt) return null;

  const score = Math.trunc(scoreValue);
  return {
    id:
      typeof entry.id === "string" && entry.id.length > 0
        ? entry.id
        : `${Date.parse(recordedAt)}-${score}-${encodeURIComponent(name)}`,
    name,
    score,
    source: "round",
    recordedAt,
  };
}

export function sortLeaderboard(entries) {
  return entries
    .map((entry) => normalizeLeaderboardEntry(entry))
    .filter(Boolean)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;

      const rightTime = Date.parse(right.recordedAt);
      const leftTime = Date.parse(left.recordedAt);
      if (rightTime !== leftTime) return rightTime - leftTime;

      return left.name.localeCompare(right.name);
    });
}

export function insertLeaderboardEntry(entries, entry, limit = LEADERBOARD_LIMIT) {
  const next = entry?.recordedAt ? entry : createLeaderboardEntry(entry);
  return sortLeaderboard([...entries, next]).slice(0, limit);
}
