export function clamp(value, min = 0, max = 100) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

export function blendMetric(base, wave = 0, boost = 0) {
  return clamp(base + wave + boost);
}

export function scoreCityPulse(metrics, eventBoost = 0) {
  const traffic = clamp(metrics.traffic);
  const weather = clamp(metrics.weather);
  const news = clamp(metrics.news);
  const social = clamp(metrics.social);
  const crowd = clamp(metrics.crowd ?? 50);

  return Math.round(
    clamp(
      traffic * 0.28 +
        weather * 0.14 +
        news * 0.23 +
        social * 0.23 +
        crowd * 0.12 +
        eventBoost,
    ),
  );
}

export function classifyPace(speed) {
  if (speed >= 1700) {
    return {
      key: "sprint",
      label: "Sprint",
      density: "Compressed",
      detail: "essentials",
    };
  }

  if (speed >= 620) {
    return {
      key: "flow",
      label: "Flow",
      density: "Balanced",
      detail: "scan",
    };
  }

  return {
    key: "settled",
    label: "Settled",
    density: "Expanded",
    detail: "context",
  };
}

export function trendLabel(score) {
  if (score >= 78) {
    return "Surging";
  }

  if (score >= 58) {
    return "Moving";
  }

  if (score >= 38) {
    return "Breathing";
  }

  return "Quiet";
}
