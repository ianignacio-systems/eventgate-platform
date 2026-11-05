/* Guest list tab of an event: upload the list of people who may register (for example a company's
   employees with their years of tenure), choose how tenure becomes raffle tickets, and follow who
   has registered. Registrants pick their own name from the list on the registration page. */
(() => {
  'use strict';
  const A = window.App;
  const { $, esc } = A;
  const root = $('tGuests');
  let ev = null;
  let st = null;
  let upload = null;          // summary of the last upload (problems found in the file)
  let filter = 'all';
  let query = '';

  const base = () => `/api/admin/events/${ev.id}/guests`;
  const years = (t) => (t == null ? '–' : (Math.round(t * 10) / 10).toFixed(1));
  const fmtTime = (iso) => (iso ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso)) : '');

  async function open(e) {
    ev = e;
    root.hidden = false;
    root.innerHTML = '<p class="sub">Loading the guest list…</p>';
    try { st = await A.api(base()); render(); } catch (err) { if (err.message !== 'signed out') root.innerHTML = `<p class="err">${esc(err.message)}</p>`; }
  }
  function close() { root.hidden = true; ev = null; upload = null; }
  async function reload() {
    if (!ev || root.hidden) return;
    if (root.contains(document.activeElement) && document.activeElement.matches('input, select')) return;
    try { st = await A.api(base()); render(); } catch {}
  }
  async function act(fn) {
    try { st = await fn(); render(); }
    catch (err) { if (err.message !== 'signed out') alert(err.message); }
  }

  function shown() {
    const q = query.trim().toLowerCase();
    return st.list.filter((g) => (filter === 'all' || (filter === 'yes') === g.registered) && (!q || g.name.toLowerCase().includes(q) || g.email.toLowerCase().includes(q)));
  }
  function rowsHtml() {
    const list = shown();
    if (!list.length) return `<tr><td colspan="5" style="color:var(--muted);text-align:center">${st.list.length ? 'No one matches.' : 'No list uploaded yet.'}</td></tr>`;
    const tickets = st.ticketRule !== 'none';
    return list.map((g) => `<tr data-gid="${g.id}">
      <td><b style="font-weight:600">${esc(g.name)}</b></td>
      <td style="text-align:right">${years(g.tenure)}</td>
      ${tickets ? `<td style="text-align:right">${g.raffleTickets}</td>` : ''}
      <td>${g.registered ? `<span class="badge in">Registered</span><div class="small">${esc(g.email || 'No email')} · ${esc(fmtTime(g.registeredAt))}</div>` : '<span class="badge out">Not yet</span>'}</td>
      <td style="text-align:right">${g.registered ? '<button class="btn btn-quiet btn-sm" type="button" data-undo>Remove registration</button>' : ''}</td>
    </tr>`).join('');
  }

  function render() {
    const has = st.counts.total > 0;
    const tickets = st.ticketRule !== 'none';
    const pct = has ? Math.round((st.counts.registered / st.counts.total) * 100) : 0;
    root.innerHTML = `
      <section class="card stack">
        <label class="check" style="align-items:flex-start"><input type="checkbox" id="gOn"${st.enabled ? ' checked' : ''}${has ? '' : ' disabled'}>
          <span><b style="display:block;font-weight:600">Only people on the guest list can register</b><span style="color:var(--muted);font-size:.86rem">On the registration page, people find and pick their own name instead of typing it. Each name can register once. ${has ? '' : 'Upload the list below first.'}</span></span></label>
        ${st.otherRegistrations && st.enabled ? `<p class="notice warn" style="margin:0">${A.nf.format(st.otherRegistrations)} ${st.otherRegistrations === 1 ? 'registration was' : 'registrations were'} made before the guest list was turned on and ${st.otherRegistrations === 1 ? 'is' : 'are'} not linked to a name on the list.</p>` : ''}
        <div class="field" style="margin:0"><label for="gRule">Raffle tickets from tenure</label>
          <select id="gRule">${Object.entries(st.rules).map(([k, l]) => `<option value="${k}"${k === st.ticketRule ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>
          <p class="help">${tickets ? (st.raffle.enabled ? 'Tickets are raffle entries: someone with 5 tickets is five times as likely to win as someone with 1. The confirmation email can show them with {raffle_tickets} and {tenure}.' : 'Turn on the raffle in the Raffle tab to use these tickets.') : 'Everyone on the list has the same chance in the raffle.'} Changing the rule updates everyone, including people already registered, but emails already sent don’t change.</p></div>
      </section>

      <section class="card stack">
        <div class="an-head"><div><h3>${has ? 'Replace the list' : 'Upload the list'}</h3>
          <p class="sub" style="margin:0">An Excel (.xlsx) or CSV file with a <b>Name</b> column, and optionally <b>Tenure</b> (years, like 3.2) and <b>Tickets</b> columns. Names written “Last, First M” are shown as “First M Last” in emails and the raffle.${has ? ' Replacing keeps everyone already registered.' : ''}</p></div></div>
        <div class="pw-row" style="flex-wrap:wrap"><input type="file" id="gFile" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" style="flex:1;min-width:220px">
          <button class="btn btn-primary" type="button" id="gUpload">${has ? 'Replace list' : 'Upload list'}</button></div>
        <p class="err" id="gErr"></p>
        ${upload ? `<div class="notice ${upload.problems.length ? 'warn' : 'info'}" style="margin:0"><b>${A.nf.format(upload.people)} ${upload.people === 1 ? 'person' : 'people'} loaded</b> from the columns “${esc(upload.columns.name)}”${upload.columns.tenure ? `, “${esc(upload.columns.tenure)}”` : ''}${upload.columns.tickets ? ` and “${esc(upload.columns.tickets)}”` : ''}.
          ${upload.problems.length ? `<ul style="margin:.4rem 0 0;padding-left:1.2rem">${upload.problems.slice(0, 12).map((p) => `<li>${esc(p)}</li>`).join('')}${upload.problems.length > 12 ? `<li>…and ${upload.problems.length - 12} more</li>` : ''}</ul>` : ''}</div>` : ''}
      </section>

      ${has ? `<section class="card stack">
        <div class="an-head"><div><h3>Who has registered</h3>
          <p class="sub" style="margin:0"><b>${A.nf.format(st.counts.registered)}</b> of ${A.nf.format(st.counts.total)} registered (${pct}%)${tickets && st.raffle.enabled ? ` · ${A.nf.format(st.list.filter((g) => g.registered).reduce((s, g) => s + g.raffleTickets, 0))} raffle tickets so far` : ''}</p></div>
          <div class="pw-row" style="flex-wrap:wrap"><a class="btn btn-quiet btn-sm" href="${base()}.xlsx?only=missing" download>Download not registered</a><a class="btn btn-quiet btn-sm" href="${base()}.xlsx" download>Download full list</a></div></div>
        <div class="pw-row" style="flex-wrap:wrap;align-items:center">
          <div class="search" style="flex:1;min-width:220px;position:relative"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input type="search" id="gQ" placeholder="Search names or emails" value="${esc(query)}" aria-label="Search the guest list"></div>
          <div class="seg" role="group" aria-label="Show">
            <button type="button" data-f="all" aria-pressed="${filter === 'all'}">All</button><button type="button" data-f="yes" aria-pressed="${filter === 'yes'}">Registered</button><button type="button" data-f="no" aria-pressed="${filter === 'no'}">Not yet</button>
          </div></div>
        <div class="table-box"><table class="list"><thead><tr><th>Name</th><th style="text-align:right">Tenure (years)</th>${tickets ? '<th style="text-align:right">Tickets</th>' : ''}<th>Status</th><th></th></tr></thead>
          <tbody id="gRows">${rowsHtml()}</tbody></table></div>
      </section>` : ''}`;
    wire();
  }

  function wireRows() {
    root.querySelectorAll('tr[data-gid] [data-undo]').forEach((b) => b.addEventListener('click', () => {
      const g = st.list.find((x) => x.id === Number(b.closest('tr').dataset.gid));
      A.openDialog({
        title: `Remove ${g.name}’s registration?`,
        body: `<p>Use this when someone registered under the wrong name. The registration and its raffle tickets are removed, and ${esc(g.name)} can register again. A backup is made first. Their confirmation email can’t be taken back.</p>`,
        okLabel: 'Remove registration', danger: true,
        run: async () => { st = await A.api(`${base()}/${g.id}/registration`, { method: 'DELETE' }); render(); },
      });
    }));
  }
  function wire() {
    $('gOn').addEventListener('change', (e) => act(() => A.post(`${base()}/settings`, { enabled: e.target.checked }, 'PUT')));
    $('gRule').addEventListener('change', (e) => act(() => A.post(`${base()}/settings`, { ticketRule: e.target.value }, 'PUT')));
    $('gUpload').addEventListener('click', async () => {
      const file = $('gFile').files[0];
      $('gErr').textContent = '';
      if (!file) { $('gErr').textContent = 'Choose the file first.'; return; }
      if (file.size > 5 * 1024 * 1024) { $('gErr').textContent = 'The file is too big (5 MB at most).'; return; }
      const btn = $('gUpload');
      btn.disabled = true; btn.textContent = 'Uploading…';
      try {
        const r = await fetch(`${base()}/upload`, { method: 'POST', headers: { 'content-type': file.type || (file.name.endsWith('.csv') ? 'text/csv' : 'application/octet-stream') }, body: file });
        const body = await r.json().catch(() => ({}));
        if (r.status === 401) { location.reload(); return; }
        if (!r.ok) throw new Error(body.message || 'The list could not be uploaded.');
        upload = body.upload;
        st = body;
        render();
      } catch (err) { $('gErr').textContent = err.message; btn.disabled = false; btn.textContent = 'Upload list'; }
    });
    if ($('gQ')) $('gQ').addEventListener('input', (e) => { query = e.target.value; $('gRows').innerHTML = rowsHtml(); wireRows(); });
    root.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => { filter = b.dataset.f; render(); }));
    wireRows();
  }

  window.GuestsAdmin = { open, close, reload };
})();
