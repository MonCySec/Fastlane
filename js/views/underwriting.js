/* Underwriter queue, review screen, document rejection, and approve / hold / decline (FR-028 to FR-031). */

function uwqV() {
  if (uwOpen) return reviewV(db.apps.find((a) => a.id === uwOpen));
  const f = $('#uf')?.value || 'All',
    L = db.apps
      .filter(
        (a) =>
          ['New', 'Exception', 'On Hold', 'Resubmitted'].includes(a.status) &&
          (f === 'All' || a.status === f),
      )
      .sort(
        (a, b) =>
          (b.status === 'Resubmitted') - (a.status === 'Resubmitted') ||
          new Date(a.q) - new Date(b.q),
      );
  return `<div class="card"><h2>Application queue</h2><label for="uf">Status filter</label><select id="uf" style="width:auto" onchange="draw();$('#uf').value=this.value"><option>All</option>${['New', 'Exception', 'On Hold', 'Resubmitted'].map((s) => `<option ${s === f ? 'selected' : ''}>${s}</option>`).join('')}</select>
  <div class="wrap"><table><tr><th>Ref</th><th>Vehicle</th><th>Drivers</th><th>Status</th><th>Submitted</th><th></th></tr>${L.map((a) => `<tr><td>${a.id}</td><td>${esc(a.quote.make)} ${esc(a.quote.model)}</td><td>${a.quote.ds.length}</td><td>${BADGE(a.status)}</td><td>${when(a.q)}</td><td><button class="btn sm" onclick="uwOpen='${a.id}';draw()">Review</button></td></tr>`).join('') || '<tr><td colspan="6">The queue is empty.</td></tr>'}</table></div></div>`;
}

function reviewV(a) {
  const q = a.quote;
  return `<button class="btn line sm" onclick="uwOpen=null;draw()">Back to queue</button><div class="card"><h2>${a.id} ${BADGE(a.status)}</h2><p>${esc(q.make)} ${esc(q.model)} ${q.year}, ${peso(q.value)}, ${q.vig} group, ${q.cover}. Owner: ${esc(a.owner)}</p>
<h3>Driver records (simulated LTO)</h3><div class="wrap"><table><tr><th>Declared</th><th>License</th><th>Result</th><th>LTO violations</th></tr>${q.ds
    .map((d) => {
      const r = ltoFind(d.l);
      return `<tr><td>${esc(d.n)}<br><span class="muted">${esc(d.d)}</span></td><td>${esc(d.l)}</td><td>${BADGE(d.st)}${d.note ? `<div class="muted">${esc(d.note)}</div>` : ''}${r ? `<div class="muted">LTO: ${esc(r.n)}, ${r.d}, ${r.s}</div>` : ''}</td><td>${r ? r.v.map((v) => `${esc(v.c)} (${v.sev}, ${v.dt})`).join('<br>') || 'None' : '-'}</td></tr>`;
    })
    .join('')}</table></div>
${a.status === 'Exception' ? `<label for="rm">Remarks (kept with the application)</label><textarea id="rm" rows="2">${esc(a.remarks || '')}</textarea><button class="btn gold" onclick="resolveEx('${a.id}')">Confirm driver records</button><button class="btn line" onclick="correctEx('${a.id}')">Correct to LTO data</button><button class="btn line" onclick="rejectEx('${a.id}')">Reject driver records</button>` : ''}${a.remarks ? `<p class="muted">Remarks: ${esc(a.remarks)}</p>` : ''}
<h3>Documents <span class="muted">(${reqDocs(q).filter(([k]) => a.docs[k]?.checked).length} of ${reqDocs(q).length} checked)</span></h3><button class="btn line sm" onclick="acceptAll('${a.id}')">Accept all remaining</button>${reqDocs(
    q,
  )
    .map(([k, l]) => {
      const d = a.docs[k],
        pending = d && d.state === 'Rejected',
        done = d && d.checked;
      const actions = !d
        ? ''
        : done
          ? `<button class="btn line sm" onclick="undoAccept('${a.id}','${k}')">Undo</button>`
          : pending
            ? '<span class="muted">Waiting for the customer to re-upload</span>'
            : `<button class="btn gold sm" onclick="acceptDoc('${a.id}','${k}')">Accept</button><select id="rr${k}" aria-label="Rejection reason" style="width:auto">${db.reasons.map((r) => `<option>${r}</option>`).join('')}</select><button class="btn line sm" onclick="rejDoc('${a.id}','${k}')">Reject</button>`;
      return `<div class="row" style="margin-bottom:.3rem${done ? ';opacity:.75' : ''}"><div style="flex:1"><b>${esc(l)}</b> ${d ? BADGE(d.state) : ''}${done ? ` <span class="b ok">Checked by ${esc(d.checkedBy)}</span>` : ''} <span class="muted">${esc(d?.name || '')}${d?.reason ? ', ' + esc(d.reason) : ''}</span> ${d ? `<button class="btn line sm" onclick="viewDoc('${a.id}','${k}')">View</button>` : ''}</div>${actions}</div>`;
    })
    .join('')}
<h3>Decision</h3><button class="btn" onclick="decide('${a.id}','Approved')">Approve</button><button class="btn line" onclick="decide('${a.id}','On Hold')">Hold</button><button class="btn line" onclick="decide('${a.id}','Declined')">Decline</button></div>`;
}

function resolveEx(id) {
  const a = db.apps.find((x) => x.id === id);
  a.remarks = ($('#rm')?.value || '').trim();
  /* manual double-check done: build records for licenses the LTO had no data on, then reprice */
  a.quote.drivers.forEach((d) => {
    if (!ltoFind(d.l)) ltoEnsure(d);
  });
  a.quote = calc({ ...a.quote, manual: false });
  a.status = 'New';
  log('Resolved exception ' + id);
  save();
  toast('Driver records confirmed. Quote repriced from the checked records.');
  draw();
}

function rejDoc(id, k) {
  const a = db.apps.find((x) => x.id === id),
    r = $('#rr' + k).value;
  a.docs[k].state = 'Rejected';
  a.docs[k].reason = r;
  a.status = 'On Hold';
  log(`Rejected ${k} on ${id}: ${r}`);
  notify(a.owner, `A document on ${id} was rejected: ${r}. Re-upload only that file.`);
  save();
  toast('Document rejected. The application is On Hold and the customer was notified.');
  draw();
}

function decide(id, s) {
  const a = db.apps.find((x) => x.id === id);
  if (s === 'Approved') {
    if (a.status === 'Exception') return toast('Confirm the driver records before approving.');
    if (Object.values(a.docs).some((d) => d.state !== 'Accepted'))
      return toast('A rejected document is still open.');
    const todo = reqDocs(a.quote).filter(([k]) => !a.docs[k]?.checked).length;
    if (todo)
      return toast(`${todo} document(s) still need to be accepted. Use Accept on each one.`);
    db.policies.push({
      no: uid('POL'),
      app: id,
      owner: a.owner,
      status: 'Pending',
      total: a.quote.total,
      vehicle: a.quote.make + ' ' + a.quote.model,
      cover: a.quote.cover,
    });
  }
  if (s === 'Declined') {
    const r = prompt('Reason for declining?');
    if (!r) return;
    a.notes = r;
  }
  a.status = s;
  a.decided = now();
  log(`${s} ${id}`);
  notify(
    a.owner,
    `Application ${id}: ${s}.` +
      (s === 'Approved' ? ' Pay to activate your policy.' : '') +
      (s === 'Declined' ? ` Reason: ${a.notes}` : ''),
  );
  save();
  uwOpen = null;
  draw();
}

/* FR-018: correct a driver record. The declared name and birthdate are replaced with the LTO values, then the quote is repriced. */
function correctEx(id) {
  const a = db.apps.find((x) => x.id === id);
  a.remarks = ($('#rm')?.value || '').trim();
  a.quote.drivers.forEach((d) => {
    const r = ltoFind(d.l);
    if (r) {
      d.n = r.n;
      d.d = r.d;
    }
  });
  a.quote = calc({ ...a.quote, manual: false });
  if (a.quote.ds.some((d) => d.st !== 'Verified')) {
    toast('Some drivers still cannot be verified. Confirm or reject the records instead.');
    save();
    draw();
    return;
  }
  a.status = 'New';
  log('Corrected driver records ' + id + (a.remarks ? ': ' + a.remarks : ''));
  notify(a.owner, `Driver details on ${id} were corrected to match the LTO record.`);
  save();
  draw();
}

/* FR-018: reject the driver records. The application is declined and the remarks become the reason. */
function rejectEx(id) {
  const a = db.apps.find((x) => x.id === id),
    r = ($('#rm')?.value || '').trim();
  if (!r) return toast('Enter remarks explaining the rejection.');
  a.remarks = r;
  a.notes = r;
  a.status = 'Declined';
  a.decided = now();
  log('Rejected driver records ' + id + ': ' + r);
  notify(a.owner, `Application ${id} was declined: ${r}`);
  save();
  uwOpen = null;
  draw();
}

/* Per-document Accept: remembers that staff already checked this file, so it is not checked again.
   A re-uploaded file is a new object, so it must be checked again; the other files stay accepted. */
function acceptDoc(id, k) {
  const d = db.apps.find((x) => x.id === id).docs[k];
  d.checked = true;
  d.checkedBy = me.name;
  d.checkedAt = now();
  log(`Accepted ${k} on ${id}`);
  save();
  draw();
}

function acceptAll(id) {
  const a = db.apps.find((x) => x.id === id);
  let n = 0;
  reqDocs(a.quote).forEach(([k]) => {
    const d = a.docs[k];
    if (d && d.state === 'Accepted' && !d.checked) {
      d.checked = true;
      d.checkedBy = me.name;
      d.checkedAt = now();
      n++;
    }
  });
  if (!n) return toast('Nothing left to accept. Rejected documents need a new upload.');
  log(`Accepted ${n} documents on ${id}`);
  save();
  draw();
}

function undoAccept(id, k) {
  const d = db.apps.find((x) => x.id === id).docs[k];
  delete d.checked;
  delete d.checkedBy;
  delete d.checkedAt;
  log(`Undid acceptance of ${k} on ${id}`);
  save();
  draw();
}
