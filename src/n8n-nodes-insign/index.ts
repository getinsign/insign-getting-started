// Barrel entry referenced by package.json "main". n8n itself loads the nodes
// and the credential through the "n8n" field in package.json; this export
// exists so the package also resolves cleanly when require()-d directly.
export { Insign } from './nodes/Insign/Insign.node';
export { InsignTrigger } from './nodes/InsignTrigger/InsignTrigger.node';
export { InsignApi } from './credentials/InsignApi.credentials';
