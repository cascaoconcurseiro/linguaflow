import assert from 'node:assert/strict';

// Mock do Web Audio API para ambiente Node.js de teste
class FakeAudioBuffer {
  constructor(numberOfChannels, length, sampleRate) {
    this.numberOfChannels = numberOfChannels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.data = new Float32Array(length);
  }
  getChannelData(channel) {
    return this.data;
  }
}

class FakeGainNode {
  constructor() {
    this.gain = {
      value: 1,
      setValueAtTime: (val, time) => { this.gain.value = val; },
      linearRampToValueAtTime: (val, time) => {},
      exponentialRampToValueAtTime: (val, time) => {},
    };
    this.connectedTo = null;
  }
  connect(dest) {
    this.connectedTo = dest;
  }
  disconnect() {
    this.connectedTo = null;
  }
}

class FakeBufferSourceNode {
  constructor(ctx) {
    this.ctx = ctx;
    this.buffer = null;
    this.started = false;
    this.connectedTo = null;
  }
  connect(dest) {
    this.connectedTo = dest;
  }
  disconnect() {
    this.connectedTo = null;
  }
  start(time = 0) {
    this.started = true;
    this.ctx.activeSources.push(this);
  }
}

class FakeOscillatorNode {
  constructor(ctx) {
    this.ctx = ctx;
    this.type = 'sine';
    this.frequency = {
      value: 440,
      setValueAtTime: (val, time) => { this.frequency.value = val; this.startTime = time; },
    };
    this.connectedTo = null;
    this.started = false;
    this.stopped = false;
  }
  connect(dest) {
    this.connectedTo = dest;
  }
  disconnect() {
    this.connectedTo = null;
  }
  start(time = 0) {
    this.started = true;
    this.ctx.activeOscillators.push(this);
  }
  stop(time = 0) {
    this.stopped = true;
    this.stopTime = time;
  }
}

class FakeAudioContext {
  constructor(options = {}) {
    this.latencyHint = options.latencyHint;
    this.sampleRate = 44100;
    this.currentTime = 0;
    this.state = 'suspended';
    this.destination = {};
    this.activeSources = [];
    this.activeOscillators = [];
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
  createBuffer(channels, length, sampleRate) {
    return new FakeAudioBuffer(channels, length, sampleRate);
  }
  createBufferSource() {
    return new FakeBufferSourceNode(this);
  }
  createGain() {
    return new FakeGainNode();
  }
  createOscillator() {
    return new FakeOscillatorNode(this);
  }
}

// Configurar ambiente global
globalThis.AudioContext = FakeAudioContext;
globalThis.window = { AudioContext: FakeAudioContext };

// Importar SoundEngine (após configuração dos mocks)
const { SoundEngine } = await import('../dashboard/js/core/soundFx.js').catch(async () => {
  // Se ainda não existir, o teste inicial falha (Fase RED do TDD)
  return { SoundEngine: null };
});

assert(SoundEngine !== null, 'SoundEngine deve ser exportado por dashboard/js/core/soundFx.js');

// Teste 1: Inicialização e desbloqueio de áudio
{
  const engine = new SoundEngine();
  assert.equal(engine.enabled, true, 'Deve iniciar habilitado');
  assert.equal(engine.volume, 0.4, 'Volume padrão deve ser 0.4');
  
  engine.init();
  assert(engine.ctx instanceof FakeAudioContext, 'Deve criar instância do AudioContext');
  assert.equal(engine.ctx.state, 'running', 'Deve reativar contexto suspenso');
}

// Teste 2: Geração de buffers procedurais para teclas
{
  const engine = new SoundEngine();
  engine.init();
  engine._buildKeyBuffers();

  assert(Array.isArray(engine.keyBuffers), 'keyBuffers deve ser um array');
  assert.equal(engine.keyBuffers.length, 3, 'Deve gerar exatamente 3 buffers de tecla');
  
  engine.keyBuffers.forEach((buf, idx) => {
    assert.equal(buf.numberOfChannels, 1, `Buffer ${idx} deve ser mono`);
    assert(buf.length > 0, `Buffer ${idx} deve conter dados PCM`);
    const data = buf.getChannelData(0);
    let hasNonZero = false;
    for (let i = 0; i < data.length; i++) {
      assert(Math.abs(data[i]) <= 1.0, 'Amostras de áudio devem estar normalizadas entre -1 e 1');
      if (data[i] !== 0) hasNonZero = true;
    }
    assert(hasNonZero, `Buffer ${idx} deve conter ruído não-silencioso`);
  });
}

// Teste 3: Execução de clique de tecla e ciclo de rotação
{
  const engine = new SoundEngine();
  engine.init();
  
  engine.playKey();
  assert.equal(engine.ctx.activeSources.length, 1, 'Deve disparar uma fonte de áudio');
  assert.equal(engine.keyIndex, 1, 'Deve rotacionar o keyIndex');

  engine.playKey();
  assert.equal(engine.ctx.activeSources.length, 2, 'Deve disparar a segunda fonte');
  assert.equal(engine.keyIndex, 2, 'Deve avançar keyIndex');
}

// Teste 4: Modo mudo / volume zero
{
  const engine = new SoundEngine();
  engine.init();
  engine.enabled = false;
  
  engine.playKey();
  assert.equal(engine.ctx.activeSources.length, 0, 'Não deve emitir som se disabled');
  
  engine.enabled = true;
  engine.volume = 0;
  engine.playKey();
  assert.equal(engine.ctx.activeSources.length, 0, 'Não deve emitir som se volume zero');
}

// Teste 5: Acordes de Feedback (error, word, milestone, complete)
{
  const testCases = [
    { type: 'error', expectedFreqs: [220, 185] },
    { type: 'word', expectedFreqs: [784, 1047] },
    { type: 'milestone', expectedFreqs: [587, 740, 880] },
    { type: 'complete', expectedFreqs: [587, 740, 880, 1175] },
  ];

  for (const { type, expectedFreqs } of testCases) {
    const engine = new SoundEngine();
    engine.init();
    engine.playChord(type);
    
    assert.equal(
      engine.ctx.activeOscillators.length,
      expectedFreqs.length,
      `Acorde '${type}' deve disparar exatamente ${expectedFreqs.length} osciladores`
    );

    engine.ctx.activeOscillators.forEach((osc, idx) => {
      assert.equal(
        osc.frequency.value,
        expectedFreqs[idx],
        `Oscilador ${idx} do acorde '${type}' deve ter frequência ${expectedFreqs[idx]}Hz`
      );
      assert.equal(osc.started, true, 'Oscilador deve ser iniciado');
      assert.equal(osc.stopped, true, 'Oscilador deve ser programado para parar (prevenção de memory leak)');
    });
  }
}

console.log('✅ Todos os 5 testes unitários de SoundEngine passaram com sucesso.');
