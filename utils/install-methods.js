// utils/install-methods.js — Instala em uma classe os métodos que moram em módulos por assunto (motor de legendas, popup de palavra etc.).
// Cada módulo é uma classe só de métodos; aqui os métodos são copiados (com seus descritores) para o protótipo da classe-alvo.
// Um nome repetido é erro: dois módulos nunca podem sobrescrever o mesmo método em silêncio.
export function installMethods(Target, parts) {
  for (const Part of parts) {
    for (const key of Reflect.ownKeys(Part.prototype)) {
      if (key === 'constructor') continue;
      if (Object.hasOwn(Target.prototype, key)) {
        throw new Error(`${Target.name}: método duplicado "${String(key)}" em ${Part.name}`);
      }
      Object.defineProperty(Target.prototype, key, Object.getOwnPropertyDescriptor(Part.prototype, key));
    }
  }
}
