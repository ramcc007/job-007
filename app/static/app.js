const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

const els = {
  body: document.getElementById("jobs-body"),
  lastRefreshed: document.getElementById("last-refreshed"),
  jobCount: document.getElementById("job-count"),
  search: document.getElementById("search-box"),
  source: document.getElementById("source-filter"),
  mode: document.getElementById("mode-filter"),
  bucket: document.getElementById("bucket-filter"),
  refreshBtn: document.getElementById("refresh-now"),
};

function modeBadge(mode) {
  const cls = { Remote: "badge-remote", Hybrid: "badge-hybrid" }[mode] || "badge-unspecified";
  const label = mode === "Hybrid" ? "Hybrid" : (mode || "Unspecified");
  return `<span class="badge ${cls}">${label}</span>`;
}

function timeAgo(isoString) {
  const posted = new Date(isoString + "Z");
  const diffMs = Date.now() - posted.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function renderJobs(jobs) {
  if (!jobs.length) {
    els.body.innerHTML = `<tr><td colspan="8" class="empty-state">No matching jobs right now. The radar keeps checking every 5 minutes.</td></tr>`;
    return;
  }

  els.body.innerHTML = jobs
    .map((job) => {
      const otherSources = (job.other_sources || [])
        .map((s) => `<a href="${s.url}" target="_blank" rel="noopener">${s.source}</a>`)
        .join(", ");
      const hybridNote = job.work_mode === "Hybrid" && job.hybrid_office_days != null
        ? ` (${job.hybrid_office_days}d office)`
        : "";
      return `
        <tr>
          <td data-label="Posted">${timeAgo(job.posted_date)}</td>
          <td data-label="Title" class="title-cell">${escapeHtml(job.title)}</td>
          <td data-label="Company">${escapeHtml(job.company)}</td>
          <td data-label="Mode">${modeBadge(job.work_mode)}${hybridNote}</td>
          <td data-label="Salary">${escapeHtml(job.salary) || "N/A"}</td>
          <td data-label="Location">${escapeHtml(job.location)}</td>
          <td data-label="Summary" class="summary-cell">${escapeHtml(job.summary) || "—"}</td>
          <td data-label="" class="apply-cell">
            <a class="apply-link" href="${job.url}" target="_blank" rel="noopener">Open ↗</a>
            ${otherSources ? `<div class="other-sources">also on: ${otherSources}</div>` : ""}
          </td>
        </tr>`;
    })
    .join("");
}

function timeAgoShort(iso) {
  if (!iso) return "never";
  const diffMin = Math.floor((Date.now() - new Date(iso + "Z").getTime()) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}

async function loadDiagnostics() {
  const el = document.getElementById("source-status");
  try {
    const resp = await fetch("/api/diagnostics");
    const data = await resp.json();
    const sources = data.sources || {};
    const names = ["naukri", "linkedin", "indeed", "foundit", "instahyre"];
    el.innerHTML = names
      .map((name) => {
        const s = sources[name];
        if (!s) return `<span class="src src-idle"><b>${name}</b> not run yet</span>`;
        if (s.error) {
          return `<span class="src src-err" title="${escapeHtml(s.error)}"><b>${name}</b> ERROR: ${escapeHtml(s.error).slice(0, 60)}</span>`;
        }
        const reasons = s.reject_reasons && Object.keys(s.reject_reasons).length
          ? ` · rejected: ${Object.entries(s.reject_reasons).map(([k, v]) => `${k}×${v}`).join(", ")}`
          : "";
        const cls = (s.raw_fetched || 0) === 0 ? "src-warn" : "src-ok";
        return `<span class="src ${cls}" title="${escapeHtml((s.sample_rejects || []).join("\n"))}">` +
          `<b>${name}</b> ${s.raw_fetched ?? "?"} fetched → ${s.matched ?? "?"} matched` +
          `${reasons} · ${timeAgoShort(s.updated_at)}</span>`;
      })
      .join("");
  } catch (err) {
    el.innerHTML = `<span class="src src-err">diagnostics unavailable</span>`;
  }
}

async function loadJobs() {
  loadDiagnostics();
  const params = new URLSearchParams({
    bucket: els.bucket.value,
    work_mode: els.mode.value,
    source: els.source.value,
    q: els.search.value,
  });

  try {
    const resp = await fetch(`/api/jobs?${params.toString()}`);
    const data = await resp.json();
    renderJobs(data.jobs);
    els.jobCount.textContent = `${data.count} job${data.count === 1 ? "" : "s"} matching`;
    els.lastRefreshed.textContent = `Last refreshed: ${new Date().toLocaleTimeString()}`;
  } catch (err) {
    els.jobCount.textContent = "Failed to load jobs — is the server running?";
  }
}

[els.search, els.source, els.mode, els.bucket].forEach((el) => {
  el.addEventListener(el.tagName === "INPUT" ? "input" : "change", () => loadJobs());
});
els.refreshBtn.addEventListener("click", loadJobs);

loadJobs();
setInterval(loadJobs, REFRESH_INTERVAL_MS);
