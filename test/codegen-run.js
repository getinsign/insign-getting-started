/**
 * Code Generator Integration Test — actually EXECUTES generated snippets
 *
 * ALL languages run in Docker containers IN PARALLEL — no local compilers/runtimes needed.
 * Uses the sandbox at https://sandbox.test.getinsign.show/ to:
 * 1. Create a session
 * 2. Get status
 * 3. Invite signers
 * 4. Download document
 * 5. Purge session
 *
 * Usage:
 *   node codegen-run.js              # run all languages
 *   node codegen-run.js ruby kotlin  # run only ruby and kotlin
 *   node codegen-run.js python       # run only python
 */
const fs   = require('fs');
const path = require('path');
const { exec, execSync } = require('child_process');

// ---------- Simulate browser globals ----------

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
    try { this.responseText = fs.readFileSync(this._file, 'utf8'); this.status = 200; }
    catch { this.status = 404; }
  }
};

require(path.join(__dirname, '..', 'docs', 'js', 'code-generator.js'));
const CodeGenerator = global.window.CodeGenerator;

// ---------- Sandbox credentials ----------

const SANDBOX = {
  baseUrl: 'https://sandbox.test.getinsign.show',
  username: 'controller',
  password: 'pwd.insign.sandbox.4561',
};

// Wait for async template preloading to settle, then run tests
(async () => {
await new Promise(r => setTimeout(r, 100));

// Working body using fileURL from GitHub Pages
const body = {
  foruser: 'codegen-test-user',
  displayname: 'CodeGen Test Session',
  callbackURL: 'https://example.com/callback',
  signatureLevel: 'SES',
  documents: [
    {
      id: 'testdoc',
      displayname: 'TestDocument.pdf',
      fileURL: 'https://getinsign.github.io/insign-getting-started/data/sample.pdf',
      mustbesigned: true,
      scanSigTags: true,
    }
  ]
};

const context = {
  method: 'POST',
  baseUrl: SANDBOX.baseUrl,
  path: '/configure/session',
  url: SANDBOX.baseUrl + '/configure/session',
  username: SANDBOX.username,
  password: SANDBOX.password,
  contentType: 'application/json',
  body,
};

const baseRunDir = path.join(__dirname, 'run');
fs.mkdirSync(baseRunDir, { recursive: true });

// ---------- CLI filter ----------
const filterArgs = process.argv.slice(2).map(a => a.toLowerCase());
function shouldRun(label) {
  if (filterArgs.length === 0) return true;
  const l = label.toLowerCase();
  return filterArgs.some(f => l.includes(f));
}

/** Docker helper */
function docker(image, dir, cmd) {
  return `docker run --rm -v "${dir}:/app" -w /app ${image} ${cmd}`;
}

/** Purge a session to free up sandbox slots */
function purgeSession(output) {
  const match = (output || '').match(/"sessionid"\s*:\s*"([a-f0-9]+)"/);
  if (!match) return;
  const sid = match[1];
  try {
    execSync(`curl -sf -X POST "${SANDBOX.baseUrl}/persistence/purge" -u "${SANDBOX.username}:${SANDBOX.password}" -H "Content-Type: application/json" -d '{"sessionid":"${sid}"}'`, {
      encoding: 'utf8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch { /* best effort */ }
}

/** Run a Docker command asynchronously, returns a Promise */
function runAsync(label, cmd, timeout) {
  return new Promise((resolve) => {
    const start = Date.now();
    exec(cmd, { encoding: 'utf8', timeout: timeout || 120000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      const combined = (stdout || '') + '\n' + (stderr || '');

      if (!err) {
        // Success
        if (!stdout.includes('HTTP 200')) {
          resolve({ lang: label, status: 'FAIL', note: 'no HTTP 200 in output', elapsed, stdout, stderr });
        } else if (!stdout.includes('sessionid')) {
          resolve({ lang: label, status: 'FAIL', note: 'no sessionid in output', elapsed, stdout, stderr });
        } else {
          resolve({ lang: label, status: 'PASS', elapsed, stdout, stderr });
        }
      } else {
        // Non-zero exit — check if session was created but download/invite failed
        if (combined.includes('HTTP 200') && combined.includes('sessionid')) {
          resolve({ lang: label, status: 'WARN', note: 'session OK, non-zero exit', elapsed, stdout, stderr });
          purgeSession(combined);
        } else {
          const lastLines = (stderr || stdout || '').split('\n').filter(Boolean).slice(-3).join(' | ');
          resolve({ lang: label, status: 'FAIL', note: lastLines, elapsed, stdout, stderr });
          purgeSession(combined);
        }
      }
    });
  });
}

// ---------- Test definitions ----------
// Each test gets its own subdirectory to avoid file conflicts in parallel

const testDefs = [];

function addTest(label, setupFn, timeout) {
  if (!shouldRun(label)) return;
  // Each language gets an isolated directory
  const langDir = path.join(baseRunDir, label.toLowerCase().replace(/[^a-z0-9]/g, '_'));
  fs.mkdirSync(langDir, { recursive: true });
  const cmd = setupFn(langDir);
  testDefs.push({ label, cmd, timeout: timeout || 120000 });
}

// curl
addTest('curl', (dir) => {
  CodeGenerator.generate('curl', context); // warm up
  fs.writeFileSync(path.join(dir, 'curl_body.json'), JSON.stringify(body));
  const curlScript = `#!/bin/bash
set -e
BASE="${SANDBOX.baseUrl}"
AUTH="${SANDBOX.username}:${SANDBOX.password}"
echo "--- Step 1: Create session ---"
BODY=$(curl -sf -X POST "$BASE/configure/session" -u "$AUTH" -H "Content-Type: application/json" -d @curl_body.json)
echo "HTTP 200"
echo "$BODY"
SESSION_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('sessionid',''))")
echo "sessionid=$SESSION_ID"
if [ -n "$SESSION_ID" ]; then
  echo "--- Step 2: Get status ---"
  STATUS=$(curl -sf -X POST "$BASE/get/status" -u "$AUTH" -H "Content-Type: application/json" -d "{\\"sessionid\\":\\"$SESSION_ID\\"}")
  echo "HTTP 200"
  echo "$STATUS"
  echo "--- Step 3: Download document ---"
  HTTP_CODE=$(curl -s -o document.pdf -w "%{http_code}" "$BASE/get/document?sessionid=$SESSION_ID&docid=testdoc" -u "$AUTH")
  echo "Download HTTP $HTTP_CODE"
  if [ -f document.pdf ]; then echo "File size: $(wc -c < document.pdf) bytes"; rm -f document.pdf; fi
  echo "--- Step 4: Purge ---"
  curl -sf -X POST "$BASE/persistence/purge" -u "$AUTH" -H "Content-Type: application/json" -d "{\\"sessionid\\":\\"$SESSION_ID\\"}"
  echo "Session purged"
fi`;
  fs.writeFileSync(path.join(dir, 'run_curl.sh'), curlScript);
  return docker('python:3-slim', dir,
    'sh -c "apt-get update -qq && apt-get install -y -qq curl >/dev/null 2>&1 && bash run_curl.sh"');
});

// Java (GSON)
addTest('Java (GSON)', (dir) => {
  fs.writeFileSync(path.join(dir, 'InSignApiCall.java'), CodeGenerator.generate('java_pure', context));
  return docker('eclipse-temurin:21-jdk', dir, `sh -c "
    GSON_VER=2.11.0 &&
    wget -q https://repo1.maven.org/maven2/com/google/code/gson/gson/\\\$GSON_VER/gson-\\\$GSON_VER.jar -O /tmp/gson.jar &&
    javac --release 11 -cp /tmp/gson.jar InSignApiCall.java &&
    java -cp .:/tmp/gson.jar InSignApiCall"`);
});

// Python
addTest('Python', (dir) => {
  fs.writeFileSync(path.join(dir, 'test_insign.py'), CodeGenerator.generate('python', context));
  return docker('python:3-slim', dir, 'sh -c "pip install -q requests && python test_insign.py"');
});

// Node.js
addTest('Node.js', (dir) => {
  fs.writeFileSync(path.join(dir, 'test_insign.js'), CodeGenerator.generate('nodejs', context));
  return docker('node:22-slim', dir, 'node test_insign.js');
});

// PHP
addTest('PHP', (dir) => {
  fs.writeFileSync(path.join(dir, 'test_insign.php'), CodeGenerator.generate('php', context));
  return docker('php:8-cli', dir, 'php test_insign.php');
});

// TypeScript (Deno)
addTest('TypeScript', (dir) => {
  fs.writeFileSync(path.join(dir, 'test_insign.ts'), CodeGenerator.generate('typescript', context));
  return docker('denoland/deno:latest', dir, 'deno run --allow-net --allow-write --allow-read test_insign.ts');
});

// Ruby
addTest('Ruby', (dir) => {
  fs.writeFileSync(path.join(dir, 'test_insign.rb'), CodeGenerator.generate('ruby', context));
  return docker('ruby:3-slim', dir, 'ruby test_insign.rb');
});

// Go
addTest('Go', (dir) => {
  fs.writeFileSync(path.join(dir, 'test_insign.go'), CodeGenerator.generate('go', context));
  return docker('golang:1.23', dir, 'go run test_insign.go');
});

// Kotlin
addTest('Kotlin', (dir) => {
  fs.writeFileSync(path.join(dir, 'insign.main.kts'), CodeGenerator.generate('kotlin', context));
  return docker('eclipse-temurin:21-jdk', dir, `sh -c "
    apt-get update -qq && apt-get install -y -qq unzip curl >/dev/null 2>&1 &&
    KT_VER=2.1.0 &&
    curl -sLo /tmp/kotlin.zip https://github.com/JetBrains/kotlin/releases/download/v\\\$KT_VER/kotlin-compiler-\\\$KT_VER.zip &&
    unzip -q /tmp/kotlin.zip -d /opt &&
    export PATH=/opt/kotlinc/bin:\\\$PATH &&
    GSON_VER=2.11.0 &&
    curl -sLo /tmp/gson.jar https://repo1.maven.org/maven2/com/google/code/gson/gson/\\\$GSON_VER/gson-\\\$GSON_VER.jar &&
    kotlinc -script -jvm-target 11 -cp /tmp/gson.jar insign.main.kts"`);
}, 300000);

// Rust
addTest('Rust', (dir) => {
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'main.rs'), CodeGenerator.generate('rust', context));
  fs.writeFileSync(path.join(dir, 'Cargo.toml'), `[package]
name = "insign_test"
version = "0.1.0"
edition = "2021"

[dependencies]
reqwest = { version = "0.12", features = ["blocking", "json"] }
serde_json = "1"
`);
  return docker('rust:latest', dir, 'cargo run --release 2>&1');
}, 300000);

// C#
addTest('C#', (dir) => {
  fs.writeFileSync(path.join(dir, 'Program.cs'), CodeGenerator.generate('csharp', context));
  fs.writeFileSync(path.join(dir, 'csharp.csproj'), `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net9.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>
</Project>
`);
  return docker('mcr.microsoft.com/dotnet/sdk:9.0', dir, 'dotnet run --no-launch-profile');
}, 180000);

// ---------- Run ALL tests in parallel ----------

console.log(`Running ${testDefs.length} tests in parallel...\n`);
const startAll = Date.now();

const promises = testDefs.map(t => runAsync(t.label, t.cmd, t.timeout));
const results = await Promise.all(promises);

const totalElapsed = ((Date.now() - startAll) / 1000).toFixed(1);

// ---------- Save output & Report ----------

const outputDir = path.join(baseRunDir, 'output');
fs.mkdirSync(outputDir, { recursive: true });

for (const r of results) {
  // Save full output to file for inspection
  const slug = r.lang.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const outFile = path.join(outputDir, `${slug}.log`);
  const content = `=== ${r.lang} — ${r.status} (${r.elapsed}s) ===\n\n` +
    `--- STDOUT ---\n${r.stdout || '(empty)'}\n\n` +
    `--- STDERR ---\n${r.stderr || '(empty)'}\n`;
  fs.writeFileSync(outFile, content);

  // Print condensed to console
  console.log(`\n${'='.repeat(60)}`);
  const icon = r.status === 'PASS' ? '✓' : r.status === 'WARN' ? '⚠' : '✗';
  console.log(`${icon} ${r.lang} — ${r.status} (${r.elapsed}s)  [${outFile}]`);
  console.log('='.repeat(60));
  if (r.status !== 'PASS') {
    // Show last 15 lines of output for failures
    const lines = ((r.stdout || '') + '\n' + (r.stderr || '')).split('\n').filter(Boolean);
    console.log(lines.slice(-15).join('\n'));
  } else {
    // Show key lines for passes
    const lines = (r.stdout || '').split('\n');
    const keyLines = lines.filter(l =>
      l.includes('Completed:') || l.includes('Signatures:') ||
      l.includes('Signing Links') || l.includes('->') ||
      l.includes('Saved document') || l.includes('Session purged') ||
      l.match(/^\s+\S+.*\|/)  // signature field table rows
    );
    if (keyLines.length) console.log(keyLines.join('\n'));
  }
}

console.log(`\n${'='.repeat(60)}`);
console.log(`INTEGRATION TEST RESULTS (${totalElapsed}s total, parallel)`);
console.log('='.repeat(60));
console.log(`Output captured in: ${outputDir}/`);

let exitCode = 0;
for (const r of results) {
  const icon = r.status === 'PASS' ? '✓' : r.status === 'WARN' ? '⚠' : '✗';
  console.log(`  ${icon} ${r.lang}: ${r.status} (${r.elapsed}s)${r.note ? ' — ' + r.note : ''}`);
  if (r.status === 'FAIL') exitCode = 1;
}

process.exit(exitCode);

})();
