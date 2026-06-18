'use strict';

// Interface abstraite : tout adaptateur de source la respecte (inversion de dependance)
class SourceAdapter {
  async connect()    { throw new Error('connect() non implemente'); }
  async consume()    { throw new Error('consume() non implemente'); }
  async disconnect() { throw new Error('disconnect() non implemente'); }
}

module.exports = SourceAdapter;