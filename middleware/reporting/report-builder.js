'use strict';
const PDFDocument = require('pdfkit');

function buildReportPdf({ reportId, periodFrom, periodTo, stats, alerts, generatedAt }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text("Rapport d'audit certifie", { align: 'center' });
    doc.moveDown(0.3).fontSize(10).fillColor('#555')
       .text('Plateforme SFD AgnosticTrace', { align: 'center' })
       .text(`Report ID : ${reportId}`, { align: 'center' })
       .text(`Genere le : ${generatedAt}`, { align: 'center' });
    doc.moveDown().fillColor('#000').fontSize(12)
       .text(`Periode : ${periodFrom}  ->  ${periodTo}`);
    doc.moveDown();

    doc.fontSize(14).text('1. Statistiques de la periode');
    doc.moveDown(0.3).fontSize(11);
    doc.text(`Evenements certifies : ${stats.totalEvents}`);
    doc.text(`  - Transactions : ${stats.totalTransactions}`);
    doc.text(`  - Logs : ${stats.totalLogs}`);
    doc.text(`Montant total transige : ${stats.totalAmount.toLocaleString('fr-FR')} XOF`);
    doc.moveDown(0.3).text('Repartition par type d operation :');
    for (const [t, c] of Object.entries(stats.byOperation)) doc.text(`  - ${t} : ${c}`);
    doc.moveDown(0.3).text('Repartition par agent :');
    for (const [a, c] of Object.entries(stats.byAgent)) doc.text(`  - ${a} : ${c}`);
    doc.moveDown();

    doc.fontSize(14).text(`2. Anomalies detectees (${alerts.length})`);
    doc.moveDown(0.3).fontSize(10);
    if (alerts.length === 0) {
      doc.text('Aucune anomalie detectee sur la periode.');
    } else {
      alerts.forEach((a, i) => {
        doc.font('Helvetica-Bold').text(`${i + 1}. [${a.rule_id} / ${a.severity}] ${a.alert_id}`);
        doc.font('Helvetica')
           .text(`   Transactions : ${(a.related_tx_ids || []).join(', ')}`)
           .text(`   Preuve blockchain (txId) : ${a.blockchain_tx_id}`);
        doc.moveDown(0.2);
      });
    }

    doc.moveDown().fontSize(8).fillColor('#777').text(
      "Rapport auto-certifie : son empreinte SHA-256 est ancree sur la blockchain. "
      + "Tout tiers peut verifier son authenticite en recalculant le hash de ce PDF.",
      { align: 'justify' });

    doc.end();
  });
}

module.exports = { buildReportPdf };