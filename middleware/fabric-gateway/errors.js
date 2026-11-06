'use strict';

function isMissingLedgerRecord(error) {
  const messages = [
    error?.message,
    ...(Array.isArray(error?.details) ? error.details.map((detail) => detail?.message) : []),
  ].filter((message) => typeof message === 'string');
  return messages.some((message) => /introuvable|not found|does not exist/i.test(message));
}

module.exports = { isMissingLedgerRecord };
