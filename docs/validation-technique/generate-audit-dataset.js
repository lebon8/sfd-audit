'use strict';

const fs = require('fs');
const path = require('path');

const OUTPUT = path.join(__dirname, 'dataset-audit.csv');
const events = [];

function add(event) {
  events.push({
    sigId: `AUDIT-EVAL-${String(events.length + 1).padStart(4, '0')}`,
    isAnomaly: false,
    anomalyType: '',
    operationType: 'DEPOSIT',
    amount: 10000 + (events.length % 5000),
    memberId: `NORMAL-MEMBER-${events.length + 1}`,
    agentId: `NORMAL-AGENT-${events.length + 1}`,
    operationDate: `2026-03-15T10:${String(events.length % 60).padStart(2, '0')}:00`,
  });
}

for (let group = 1; group <= 5; group++) {
  for (let item = 1; item <= 2; item++) {
    events.push({
      sigId: `AUDIT-R1-${group}-${item}`,
      isAnomaly: true,
      anomalyType: 'R1_DOUBLE_DEPOSIT',
      operationType: 'DEPOSIT',
      amount: 90000,
      memberId: `R1-MEMBER-${group}`,
      agentId: `R1-AGENT-${group}-${item}`,
      operationDate: `2026-03-15T10:${String(group * 10 + item).padStart(2, '0')}:00`,
    });
  }
}

for (let item = 1; item <= 10; item++) {
  events.push({
    sigId: `AUDIT-R2-${item}`,
    isAnomaly: true,
    anomalyType: 'R2_AMOUNT_OVER_LIMIT',
    operationType: 'DEPOSIT',
    amount: 1500000,
    memberId: `R2-MEMBER-${item}`,
    agentId: `R2-AGENT-${item}`,
    operationDate: '2026-03-15T12:00:00',
  });
}

for (let item = 1; item <= 10; item++) {
  events.push({
    sigId: `AUDIT-R3-${item}`,
    isAnomaly: true,
    anomalyType: 'R3_OUTSIDE_BUSINESS_HOURS',
    operationType: 'DEPOSIT',
    amount: 50000 + item,
    memberId: `R3-MEMBER-${item}`,
    agentId: `R3-AGENT-${item}`,
    operationDate: `2026-03-15T02:${String(item).padStart(2, '0')}:00`,
  });
}

const r4Groups = [
  [700000, 700001, 700002],
  [700010, 700011, 700012],
  [525000, 525001, 525002, 525003],
];
let r4Item = 0;
for (let group = 0; group < r4Groups.length; group++) {
  for (const amount of r4Groups[group]) {
    r4Item++;
    events.push({
      sigId: `AUDIT-R4-${r4Item}`,
      isAnomaly: true,
      anomalyType: 'R4_MEMBER_NET_FLOW',
      operationType: 'DEPOSIT',
      amount,
      memberId: `R4-MEMBER-${group + 1}`,
      agentId: `R4-AGENT-${r4Item}`,
      operationDate: `2026-03-15T10:${String(group * 10 + (r4Item % 3)).padStart(2, '0')}:00`,
    });
  }
}

for (let item = 1; item <= 10; item++) {
  events.push({
    sigId: `AUDIT-R5-${item}`,
    isAnomaly: true,
    anomalyType: 'R5_AGENT_MULTIPLE_ACCOUNTS',
    operationType: 'DEPOSIT',
    amount: 100000 + item,
    memberId: `R5-MEMBER-${item}`,
    agentId: 'R5-SHARED-AGENT',
    operationDate: `2026-03-15T13:${String(item).padStart(2, '0')}:00`,
  });
}

while (events.length < 1000) add({});

if (events.length !== 1000 || events.filter((event) => event.isAnomaly).length !== 50) {
  throw new Error('Jeu de donnees invalide : 1000 evenements dont 50 anomalies attendus');
}

const columns = [
  'sig_id',
  'is_anomaly',
  'anomaly_type',
  'operation_type',
  'amount',
  'currency',
  'member_id',
  'agent_id',
  'operation_date',
];
const csv = [
  columns.join(','),
  ...events.map((event) => [
    event.sigId,
    event.isAnomaly,
    event.anomalyType,
    event.operationType,
    event.amount,
    'XOF',
    event.memberId,
    event.agentId,
    event.operationDate,
  ].join(',')),
].join('\n') + '\n';

fs.writeFileSync(OUTPUT, csv, { flag: 'w' });
console.log(`Jeu d'audit etiquete ecrit avant evaluation: ${OUTPUT}`);
console.log('Total: 1000; anomalies: 50; normaux: 950');
