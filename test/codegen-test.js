/**
 * Code Generator Test — runs in Node.js
 *
 * 1. Loads the code generator with a simulated browser environment
 * 2. Generates snippets for all languages with a full-featured create-session body
 * 3. Validates structure (no old endpoints, correct 3-step flow)
 * 4. Compiles generated Java snippets with javac
 */
const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ---------- Simulate browser globals for code-generator.js ----------

const docsDir = path.join(__dirname, '..', 'docs');

global.window = {};
global.document = { readyState: 'complete' };
global.fetch = (url) => {
  const filePath = path.join(docsDir, url);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return Promise.resolve({
      ok: true,
      text: () => Promise.resolve(content),
      json: () => Promise.resolve(JSON.parse(content)),
    });
  } catch {
    return Promise.resolve({ ok: false });
  }
};
global.XMLHttpRequest = class {
  open(method, url) { this._file = path.join(docsDir, url); }
  send() {
    try {
      this.responseText = fs.readFileSync(this._file, 'utf8');
      this.status = 200;
    } catch { this.status = 404; }
  }
};

require(path.join(__dirname, '..', 'docs', 'js', 'code-generator.js'));
const CodeGenerator = global.window.CodeGenerator;

// ---------- Full-featured test context (create session with all features) ----------

const context = {
  method: 'POST',
  baseUrl: 'https://demo.getinsign.de',
  path: '/configure/session',
  url: 'https://demo.getinsign.de/configure/session',
  username: 'controller',
  password: 'secret123',
  contentType: 'application/json',
  body: {
    foruser: 'john.doe',
    displayname: 'Contract Signing',
    callbackURL: 'https://example.com/callback',
    serverSidecallbackURL: 'https://example.com/api/insign-callback',
    serversideCallbackMethod: 'POST',
    signatureLevel: 'SES',
    embedBiometricData: true,
    makeFieldsMandatory: true,
    allSignaturesRequired: true,
    externEnabled: true,
    externEditAllowed: false,
    externCompleteOnFinish: true,
    externSendDocsOnFinish: true,
    writeAuditReport: true,
    dokumente: [
      {
        id: 'doc1',
        displayname: 'Contract.pdf',
        fileURL: 'https://example.com/files/contract.pdf',
        mustbesigned: true,
        scanSigTags: true,
        allowFormEditing: true
      },
      {
        id: 'doc2',
        displayname: 'Terms.pdf',
        fileURL: 'https://example.com/files/terms.pdf',
        mustberead: true,
        mustbereadText: 'I have read and accept the terms'
      }
    ]
  }
};

// ---------- Generate and validate all languages ----------

// Wait for async template preloading (fetch promises) to settle
(async () => {
await new Promise(r => setTimeout(r, 100));

const errors = [];
const outputDir = path.join(__dirname, 'generated');
fs.mkdirSync(outputDir, { recursive: true });

const generated = {};

Object.keys(CodeGenerator.LANGUAGES).forEach(langKey => {
  const lang = CodeGenerator.LANGUAGES[langKey];
  const code = CodeGenerator.generate(langKey, context);

  if (!code || code.startsWith('// Unknown language') || code.startsWith('// Template not loaded')) {
    errors.push(`${langKey}: generation failed or returned placeholder`);
    return;
  }

  // Basic sanity checks — no old endpoints
  if (code.includes('/get/checkstatus') || code.includes('checkstatus')) {
    errors.push(`${langKey}: still references /get/checkstatus`);
  }
  if (code.includes('/get/documents/download')) {
    errors.push(`${langKey}: still references /get/documents/download (should use /get/document)`);
  }

  // No standalone helper functions (except java_insign which uses adapter)
  if (langKey !== 'java_insign') {
    ['getStatus', 'downloadDocument', 'get_status', 'download_document'].forEach(fn => {
      const fnPattern = new RegExp(`(function|def|static.*void|static async Task)\\s+${fn}\\b`);
      if (fnPattern.test(code)) {
        errors.push(`${langKey}: still has standalone ${fn} helper function`);
      }
    });
  }

  // Must include the 5-step flow
  if (langKey !== 'java_insign') {
    if (!code.includes('/get/status')) errors.push(`${langKey}: missing /get/status call`);
    if (!code.includes('/get/document')) errors.push(`${langKey}: missing /get/document call`);
    if (!code.includes('/extern/beginmulti')) errors.push(`${langKey}: missing /extern/beginmulti call`);
    if (!code.includes('/persistence/purge')) errors.push(`${langKey}: missing /persistence/purge call`);
    // /get/status must NOT use sessionid as URL param (except /get/document which should)
    if (code.match(/\/get\/status\?sessionid=/) || code.match(/\/get\/status\?.*sessionid/)) {
      errors.push(`${langKey}: /get/status still uses sessionid as URL parameter (must be in JSON body)`);
    }
  } else {
    if (!code.includes('getStatus')) errors.push(`${langKey}: missing adapter.getStatus call`);
    if (!code.includes('downloadDocument')) errors.push(`${langKey}: missing adapter.downloadDocument call`);
  }

  // Must reference sessionid somewhere
  if (!/session.?[iI]d|SESSION.?ID|sid\b/.test(code)) {
    errors.push(`${langKey}: missing sessionid extraction`);
  }

  // Write output
  const ext = { curl: 'sh', java_spring: 'java', java_pure: 'java', java_insign: 'java',
                 python: 'py', php: 'php', csharp: 'cs', nodejs: 'js', typescript: 'ts',
                 ruby: 'rb', go: 'go', rust: 'rs', kotlin: 'kt' }[langKey] || 'txt';
  const outFile = path.join(outputDir, `${langKey}.${ext}`);
  fs.writeFileSync(outFile, code);
  generated[langKey] = { code, file: outFile, lines: code.split('\n').length };
  console.log(`✓ ${langKey} (${lang.label}) — ${code.split('\n').length} lines`);
});

// ---------- Compile Java snippets ----------

console.log('\n--- Java compilation checks ---');

// Find GSON jar on the Maven classpath
function findJars() {
  const m2 = path.join(process.env.HOME || process.env.USERPROFILE, '.m2', 'repository');
  const jars = [];
  // gson
  try {
    const gsonDir = path.join(m2, 'com', 'google', 'code', 'gson', 'gson');
    const versions = fs.readdirSync(gsonDir).filter(v => !v.startsWith('.'));
    if (versions.length > 0) {
      const ver = versions.sort().pop();
      const jar = path.join(gsonDir, ver, `gson-${ver}.jar`);
      if (fs.existsSync(jar)) jars.push(jar);
    }
  } catch {}
  return jars;
}

const classpath = findJars().join(':');

// java_pure uses only JDK + GSON - can be compiled
if (generated.java_pure) {
  // Extract class name and copy to correctly named file
  const classMatch = generated.java_pure.code.match(/public class (\w+)/);
  const className = classMatch ? classMatch[1] : 'InSignApiCall';
  const correctFile = path.join(outputDir, `${className}.java`);
  fs.copyFileSync(generated.java_pure.file, correctFile);
  try {
    const cmd = `javac --release 11 ${classpath ? '-cp ' + classpath : ''} -d ${outputDir} ${correctFile} 2>&1`;
    execSync(cmd, { encoding: 'utf8', timeout: 30000 });
    console.log('✓ java_pure compiled successfully');
  } catch (e) {
    const stderr = e.stdout || e.stderr || e.message;
    errors.push(`java_pure: compilation failed:\n${stderr}`);
    console.error('✗ java_pure compilation failed');
  }
}

// java_spring needs Spring Web — skip compilation, validate structure only
if (generated.java_spring) {
  const code = generated.java_spring.code;
  if (code.includes('RestClient') && code.includes('public static void main')) {
    console.log('✓ java_spring structure valid (Spring dependency not available for compilation)');
  } else {
    errors.push('java_spring: missing RestClient usage or main method');
  }
}

// java_insign needs insign-java-api — skip compilation, validate structure only
if (generated.java_insign) {
  const code = generated.java_insign.code;
  if (code.includes('InSignAdapter') && code.includes('createinSignSession') && code.includes('getStatus') && code.includes('downloadDocument')) {
    console.log('✓ java_insign structure valid (insign-java-api not available for compilation)');
  } else {
    errors.push('java_insign: missing expected InSignAdapter method calls');
  }
  if (!code.includes('InSignConfigurationData')) {
    errors.push('java_insign: missing InSignConfigurationData (uses wrong type?)');
  }
  if (/\bSessionConfiguration\b/.test(code.replace('createSessionConfiguration', ''))) {
    errors.push('java_insign: still references wrong type SessionConfiguration');
  }
  if (code.includes('.getGuiProperties().set')) {
    errors.push('java_insign: guiProperties is a HashMap, must not use typed setters');
  }
}

// ---------- Report ----------

console.log('');
if (errors.length > 0) {
  console.error('FAILURES:');
  errors.forEach(e => console.error('  ✗ ' + e));
  process.exit(1);
} else {
  console.log('All code generator tests passed.');
}

})();
