// content/subtitles/engine/install-methods.js — Instala no SubtitleEngine os métodos que moram nos módulos por assunto (engine/*.js).
// Cada módulo é uma classe só de métodos; aqui os métodos são copiados (com seus descritores) para o protótipo do motor.
// Um nome repetido é erro: dois módulos nunca podem sobrescrever o mesmo método em silêncio.
export function installEngineMethods(Target, parts) {
  for (const Part of parts) {
    for (const key of Reflect.ownKeys(Part.prototype)) {
      if (key === 'constructor') continue;
      if (Object.hasOwn(Target.prototype, key)) {
        throw new Error(`SubtitleEngine: método duplicado "${String(key)}" em ${Part.name}`);
      }
      Object.defineProperty(Target.prototype, key, Object.getOwnPropertyDescriptor(Part.prototype, key));
    }
  }
}
