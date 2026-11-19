/* Policy document as a downloadable PDF (FR-032): policy schedule, declaration page, terms and conditions.
   Uses the jsPDF library loaded in index.html. Only standard PDF fonts, so amounts are written as "PHP". */

const php = (n) => 'PHP ' + Math.round(n).toLocaleString('en-PH');

const POLICY_TERMS = [
  '1. Coverage starts only after payment is confirmed. No coverage is extended before then.',
  '2. Only the drivers named in this policy are covered. A named excluded driver has no coverage while driving the vehicle.',
  '3. A claim must be reported (First Notice of Loss) within 48 hours of the incident. Claims filed after 72 hours without a documented reason may be reduced or rejected.',
  '4. Comprehensive claims above PHP 10,000 require an inspection by an accredited assessor.',
  '5. Settlement is paid directly to the accredited repair shop. Cash settlement is available only if the damage cannot be repaired by an accredited shop.',
  '6. Cancellation within 15 days of the start date is refunded in full less a processing fee. Later cancellations follow the short-rate schedule.',
  '7. Renewal reminders are sent 60 and 30 days before expiry. A policy not renewed by its expiry date lapses and needs a new application.',
  '8. This is a prototype document created with fictitious data. It has no legal or commercial value.',
];

function downloadPolicy(appId) {
  const a = db.apps.find((x) => x.id === appId),
    p = db.policies.find((x) => x.app === appId);
  if (!a || !p) return toast('No policy found for this application.');
  if (!window.jspdf)
    return toast('The PDF library could not load. Check your internet connection.');
  const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' }),
    q = a.quote;
  let y = 20;
  const clean = (t) => String(t).replace(/[^\x20-\x7E]/g, ' ');
  const heading = (t) => {
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(t, 15, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
  };
  const line = (t) =>
    doc.splitTextToSize(clean(t), 180).forEach((l) => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(l, 15, y);
      y += 5.5;
    });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Confidently Fast', 15, y);
  y += 8;
  doc.setFontSize(12);
  doc.text('Motor Vehicle Insurance Policy', 15, y);
  y += 2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  heading('Policy schedule');
  line(`Policy number: ${p.no}`);
  line(`Status: ${p.status}${p.status === 'Pending' ? ' (coverage starts after payment)' : ''}`);
  line(`Policyholder: ${a.owner}`);
  line(`Coverage: ${q.cover}`);
  line(`Effective: ${p.start ? when(p.start) : 'Upon payment'}`);
  line(`Expires: ${p.end ? when(p.end) : 'One year after activation'}`);
  line(`Total annual premium: ${php(p.total)}`);
  heading('Declaration page');
  line(`Vehicle: ${q.make} ${q.model} ${q.year}`);
  line(`Declared value: ${php(q.value)}`);
  line(`Vehicle Insurance Group: ${q.vig}`);
  q.ds.forEach((d, i) =>
    line(
      `Driver ${i + 1}${i ? '' : ' (primary)'}: ${d.n}, license ${d.l}, ` +
        (d.excl
          ? 'EXCLUDED driver'
          : `risk loading ${Math.round(d.load * 100)}%, annual ${php(d.amt)}`),
    ),
  );
  heading('Terms and conditions');
  POLICY_TERMS.forEach(line);
  doc.save(`${p.no}.pdf`);
}
