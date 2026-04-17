/**
 * Code Generator Module - Template-based
 *
 * Loads language templates from /codegen-templates/ and renders them with context
 * variables. Complex body-building (GSON JsonObject, Jackson ObjectNode, PHP arrays, Python
 * dicts) is generated programmatically and injected as {{BODY_BUILD}}.
 */
(function () {
  'use strict';

  var LANGUAGES = {
    curl:        { label: 'cURL',            monacoLanguage: 'shell',      template: 'curl.sh' },
    java_spring: { label: 'Java (Spring)',   monacoLanguage: 'java',       template: 'java-spring.java' },
    java_pure:   { label: 'Java (GSON)',     monacoLanguage: 'java',       template: 'java-gson.java' },
    java_insign: { label: 'Java (inSign API)', monacoLanguage: 'java',     template: 'java-insign.java' },
    python:      { label: 'Python',          monacoLanguage: 'python',     template: 'python.py' },
    php:         { label: 'PHP',             monacoLanguage: 'php',        template: 'php.php' },
    csharp:      { label: 'C#',              monacoLanguage: 'csharp',     template: 'csharp.cs' },
    nodejs:      { label: 'Node.js',         monacoLanguage: 'javascript', template: 'nodejs.js' },
    typescript:  { label: 'TypeScript',      monacoLanguage: 'typescript', template: 'typescript.ts' },
    ruby:        { label: 'Ruby',            monacoLanguage: 'ruby',       template: 'ruby.rb' },
    go:          { label: 'Go',              monacoLanguage: 'go',         template: 'go.go' },
    rust:        { label: 'Rust',            monacoLanguage: 'rust',       template: 'rust.rs' },
    kotlin:      { label: 'Kotlin',          monacoLanguage: 'kotlin',     template: 'kotlin.kt' }
  };

  // Template cache
  var templateCache = {};

  // ---------------------------------------------------------------------------
  // Property → Java setter mapping for inSign API client
  // ---------------------------------------------------------------------------

  // GUI property keys parsed from the OpenAPI spec at runtime.
  // Used to decide whether to emit InSignGUIConstants.xxx (type-safe) or "xxx" (string literal).
  // Falls back to feature-descriptions.json if the OpenAPI spec hasn't been loaded yet.
  var _guiConstantsCache = null;
  var _guiConstantsFromOpenApi = false;
  function getGuiConstantsSet() {
    // Rebuild if not yet populated from OpenAPI (may have loaded since last call)
    if (_guiConstantsCache && _guiConstantsFromOpenApi) return _guiConstantsCache;

    var result = {};
    // Primary: OpenAPI spec (parsed by openapi-schema-loader.js)
    var loader = window.state && window.state.schemaLoader;
    if (loader && loader.guiPropertyKeys && Object.keys(loader.guiPropertyKeys).length) {
      Object.keys(loader.guiPropertyKeys).forEach(function (k) { result[k] = true; });
      _guiConstantsFromOpenApi = true;
    }
    // Fallback: feature-descriptions.json property catalog
    if (!_guiConstantsFromOpenApi && propertyCatalog && propertyCatalog.guiProperties) {
      propertyCatalog.guiProperties.forEach(function (f) { result[f.key] = true; });
    }
    _guiConstantsCache = result;
    return result;
  }

  // Properties that need special (non-setter) handling in the Java code generator.
  // Everything else is auto-mapped: key -> session.set<Key>(...) with type from typeof.
  var INSIGN_COMPLEX_TYPES = {
    documents:      'documents',
    guiProperties:  'guiProperties',
    signConfig:     'signConfig',
    deliveryConfig: 'deliveryConfig'
  };

  // ---------------------------------------------------------------------------
  // Escape helpers
  // ---------------------------------------------------------------------------

  function escapeJava(str) {
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
  }

  function escapePhp(str) {
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  function escapeShell(str) {
    return str.replace(/'/g, "'\\''");
  }

  // ---------------------------------------------------------------------------
  // Template engine
  // ---------------------------------------------------------------------------

  /**
   * Render a template string with variables and conditionals.
   *
   * Supports:
   *   {{VAR_NAME}}                    - variable substitution
   *   {{#if VAR_NAME}}...{{/if}}      - conditional block (included if truthy)
   *   {{#unless VAR_NAME}}...{{/unless}} - inverse conditional
   */
  function renderTemplate(template, vars) {
    // Process {{#if VAR}}...{{/if}} blocks
    var result = template.replace(
      /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
      function (_, varName, content) {
        return vars[varName] ? content : '';
      }
    );

    // Process {{#unless VAR}}...{{/unless}} blocks
    result = result.replace(
      /\{\{#unless\s+(\w+)\}\}([\s\S]*?)\{\{\/unless\}\}/g,
      function (_, varName, content) {
        return vars[varName] ? '' : content;
      }
    );

    // Process {{VAR_NAME}} substitutions
    result = result.replace(/\{\{(\w+)\}\}/g, function (_, varName) {
      return vars[varName] !== undefined ? vars[varName] : '{{' + varName + '}}';
    });

    // Clean up blank lines left by removed conditionals (max 2 consecutive)
    result = result.replace(/\n{3,}/g, '\n\n');

    return result;
  }

  // ---------------------------------------------------------------------------
  // Body builders - generate language-specific code to construct the JSON body
  // ---------------------------------------------------------------------------

  /** Jackson ObjectNode builder for Java (Spring) */
  function jacksonBuildNode(obj, varName, indent, docs, langKey) {
    var pad = new Array(indent + 1).join(' ');
    var lines = [];
    lines.push(pad + 'ObjectNode ' + varName + ' = mapper.createObjectNode();');

    Object.keys(obj).forEach(function (key) {
      var val = obj[key];
      if (val === null || val === undefined) return;

      if (docs) {
        var dc = getDocComment(key, langKey || 'java_spring');
        if (dc) lines.push(pad + dc);
      }

      if (typeof val === 'string') {
        lines.push(pad + varName + '.put("' + escapeJava(key) + '", "' + escapeJava(val) + '");');
      } else if (typeof val === 'boolean' || typeof val === 'number') {
        lines.push(pad + varName + '.put("' + escapeJava(key) + '", ' + val + ');');
      } else if (Array.isArray(val)) {
        var arrVar = key + 'Array';
        lines.push('');
        lines.push(pad + 'ArrayNode ' + arrVar + ' = ' + varName + '.putArray("' + escapeJava(key) + '");');
        val.forEach(function (item, i) {
          if (typeof item === 'object' && item !== null) {
            var itemVar = key + 'Item' + i;
            lines.push(pad + 'ObjectNode ' + itemVar + ' = ' + arrVar + '.addObject();');
            Object.keys(item).forEach(function (ik) {
              var iv = item[ik];
              if (iv === null || iv === undefined) return;
              if (docs) { var dc2 = getDocComment(ik, langKey || 'java_spring'); if (dc2) lines.push(pad + dc2); }
              if (typeof iv === 'string') {
                lines.push(pad + itemVar + '.put("' + escapeJava(ik) + '", "' + escapeJava(iv) + '");');
              } else if (typeof iv === 'boolean' || typeof iv === 'number') {
                lines.push(pad + itemVar + '.put("' + escapeJava(ik) + '", ' + iv + ');');
              } else if (Array.isArray(iv)) {
                var innerArr = ik + 'Arr';
                lines.push(pad + 'ArrayNode ' + innerArr + ' = ' + itemVar + '.putArray("' + escapeJava(ik) + '");');
                iv.forEach(function (sv) {
                  if (typeof sv === 'string') lines.push(pad + innerArr + '.add("' + escapeJava(sv) + '");');
                  else lines.push(pad + innerArr + '.add(' + JSON.stringify(sv) + ');');
                });
              }
            });
          } else if (typeof item === 'string') {
            lines.push(pad + arrVar + '.add("' + escapeJava(item) + '");');
          } else {
            lines.push(pad + arrVar + '.add(' + JSON.stringify(item) + ');');
          }
        });
      } else if (typeof val === 'object') {
        var subVar = key + 'Node';
        lines.push('');
        lines.push(pad + 'ObjectNode ' + subVar + ' = ' + varName + '.putObject("' + escapeJava(key) + '");');
        Object.keys(val).forEach(function (sk) {
          var sv = val[sk];
          if (sv === null || sv === undefined) return;
          if (docs) { var dc3 = getDocComment(sk, langKey || 'java_spring'); if (dc3) lines.push(pad + dc3); }
          if (typeof sv === 'string') lines.push(pad + subVar + '.put("' + escapeJava(sk) + '", "' + escapeJava(sv) + '");');
          else if (typeof sv === 'boolean' || typeof sv === 'number') lines.push(pad + subVar + '.put("' + escapeJava(sk) + '", ' + sv + ');');
        });
      }
    });

    return lines.join('\n');
  }

  /** GSON JsonObject builder for Java / Kotlin */
  function gsonBuildNode(obj, varName, indent, docs, langKey) {
    var pad = new Array(indent + 1).join(' ');
    var isKt = langKey === 'kotlin';
    var decl = isKt ? 'val ' : '';
    var newKw = isKt ? '' : 'new ';
    var typeDecl = isKt ? '' : 'JsonObject ';
    var arrTypeDecl = isKt ? '' : 'JsonArray ';
    var lines = [];
    lines.push(pad + decl + typeDecl + varName + ' = ' + newKw + 'JsonObject();');

    Object.keys(obj).forEach(function (key) {
      var val = obj[key];
      if (val === null || val === undefined) return;

      if (docs) {
        var dc = getDocComment(key, langKey || 'java_pure');
        if (dc) lines.push(pad + dc);
      }

      if (typeof val === 'string') {
        lines.push(pad + varName + '.addProperty("' + escapeJava(key) + '", "' + escapeJava(val) + '");');
      } else if (typeof val === 'boolean' || typeof val === 'number') {
        lines.push(pad + varName + '.addProperty("' + escapeJava(key) + '", ' + val + ');');
      } else if (Array.isArray(val)) {
        var arrVar = key + 'Array';
        lines.push('');
        lines.push(pad + decl + arrTypeDecl + arrVar + ' = ' + newKw + 'JsonArray();');
        val.forEach(function (item, i) {
          if (typeof item === 'object' && item !== null) {
            var itemVar = key + 'Item' + i;
            lines.push(pad + decl + typeDecl + itemVar + ' = ' + newKw + 'JsonObject();');
            Object.keys(item).forEach(function (ik) {
              var iv = item[ik];
              if (iv === null || iv === undefined) return;
              if (docs) { var dc2 = getDocComment(ik, langKey || 'java_pure'); if (dc2) lines.push(pad + dc2); }
              if (typeof iv === 'string') {
                lines.push(pad + itemVar + '.addProperty("' + escapeJava(ik) + '", "' + escapeJava(iv) + '");');
              } else if (typeof iv === 'boolean' || typeof iv === 'number') {
                lines.push(pad + itemVar + '.addProperty("' + escapeJava(ik) + '", ' + iv + ');');
              } else if (Array.isArray(iv)) {
                var innerArr = ik + 'Arr';
                lines.push(pad + decl + arrTypeDecl + innerArr + ' = ' + newKw + 'JsonArray();');
                iv.forEach(function (sv) {
                  if (typeof sv === 'string') lines.push(pad + innerArr + '.add("' + escapeJava(sv) + '");');
                  else lines.push(pad + innerArr + '.add(' + JSON.stringify(sv) + ');');
                });
                lines.push(pad + itemVar + '.add("' + escapeJava(ik) + '", ' + innerArr + ');');
              }
            });
            lines.push(pad + arrVar + '.add(' + itemVar + ');');
          } else if (typeof item === 'string') {
            lines.push(pad + arrVar + '.add("' + escapeJava(item) + '");');
          } else {
            lines.push(pad + arrVar + '.add(' + JSON.stringify(item) + ');');
          }
        });
        lines.push(pad + varName + '.add("' + escapeJava(key) + '", ' + arrVar + ');');
      } else if (typeof val === 'object') {
        var subVar = key + 'Node';
        lines.push('');
        lines.push(pad + decl + typeDecl + subVar + ' = ' + newKw + 'JsonObject();');
        Object.keys(val).forEach(function (sk) {
          var sv = val[sk];
          if (sv === null || sv === undefined) return;
          if (docs) { var dc3 = getDocComment(sk, langKey || 'java_pure'); if (dc3) lines.push(pad + dc3); }
          if (typeof sv === 'string') lines.push(pad + subVar + '.addProperty("' + escapeJava(sk) + '", "' + escapeJava(sv) + '");');
          else if (typeof sv === 'boolean' || typeof sv === 'number') lines.push(pad + subVar + '.addProperty("' + escapeJava(sk) + '", ' + sv + ');');
        });
        lines.push(pad + varName + '.add("' + escapeJava(key) + '", ' + subVar + ');');
      }
    });

    return lines.join('\n');
  }

  /** PHP associative array */
  function phpArray(obj, indent, docs) {
    var pad = new Array(indent + 1).join(' ');
    var innerPad = pad + '    ';

    if (Array.isArray(obj)) {
      var lines = ['['];
      obj.forEach(function (val) {
        if (typeof val === 'string') lines.push(innerPad + "'" + escapePhp(val) + "',");
        else if (typeof val === 'boolean') lines.push(innerPad + val + ',');
        else if (typeof val === 'number') lines.push(innerPad + val + ',');
        else if (typeof val === 'object' && val !== null) lines.push(innerPad + phpArray(val, indent + 4, docs) + ',');
      });
      lines.push(pad + ']');
      return lines.join('\n');
    }

    var lines = ['['];
    Object.keys(obj).forEach(function (key) {
      var val = obj[key];
      if (docs) { var dc = getDocComment(key, 'php'); if (dc) lines.push(innerPad + dc); }
      if (val === null || val === undefined) lines.push(innerPad + "'" + escapePhp(key) + "' => null,");
      else if (typeof val === 'string') lines.push(innerPad + "'" + escapePhp(key) + "' => '" + escapePhp(val) + "',");
      else if (typeof val === 'boolean') lines.push(innerPad + "'" + escapePhp(key) + "' => " + val + ',');
      else if (typeof val === 'number') lines.push(innerPad + "'" + escapePhp(key) + "' => " + val + ',');
      else if (Array.isArray(val) || typeof val === 'object') lines.push(innerPad + "'" + escapePhp(key) + "' => " + phpArray(val, indent + 4, docs) + ',');
    });
    lines.push(pad + ']');
    return lines.join('\n');
  }

  /** Python dict/list literal */
  function pythonDict(obj, indent, docs) {
    var pad = new Array(indent + 1).join(' ');
    var innerPad = pad + '    ';

    if (Array.isArray(obj)) {
      var lines = ['['];
      obj.forEach(function (val) {
        if (typeof val === 'string') lines.push(innerPad + '"' + val.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '",');
        else if (typeof val === 'boolean') lines.push(innerPad + (val ? 'True' : 'False') + ',');
        else if (typeof val === 'number') lines.push(innerPad + val + ',');
        else if (typeof val === 'object' && val !== null) lines.push(innerPad + pythonDict(val, indent + 4, docs) + ',');
      });
      lines.push(pad + ']');
      return lines.join('\n');
    }

    var lines = ['{'];
    Object.keys(obj).forEach(function (key) {
      var val = obj[key];
      if (docs) { var dc = getDocComment(key, 'python'); if (dc) lines.push(innerPad + dc); }
      if (val === null || val === undefined) lines.push(innerPad + '"' + key + '": None,');
      else if (typeof val === 'string') lines.push(innerPad + '"' + key + '": "' + val.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '",');
      else if (typeof val === 'boolean') lines.push(innerPad + '"' + key + '": ' + (val ? 'True' : 'False') + ',');
      else if (typeof val === 'number') lines.push(innerPad + '"' + key + '": ' + val + ',');
      else if (Array.isArray(val) || typeof val === 'object') lines.push(innerPad + '"' + key + '": ' + pythonDict(val, indent + 4, docs) + ',');
    });
    lines.push(pad + '}');
    return lines.join('\n');
  }

  /** C# JsonObject builder */
  function csharpBuildJsonNode(obj, varName, indent, docs) {
    var pad = new Array(indent + 1).join(' ');
    var lines = [];
    lines.push(pad + 'var ' + varName + ' = new JsonObject');
    lines.push(pad + '{');

    Object.keys(obj).forEach(function (key) {
      var val = obj[key];
      if (val === null || val === undefined) return;
      if (docs) { var dc = getDocComment(key, 'csharp'); if (dc) lines.push(pad + '    ' + dc); }
      if (typeof val === 'string') lines.push(pad + '    ["' + key + '"] = "' + escapeJava(val) + '",');
      else if (typeof val === 'boolean' || typeof val === 'number') lines.push(pad + '    ["' + key + '"] = ' + val + ',');
      else if (Array.isArray(val)) lines.push(pad + '    ["' + key + '"] = ' + csharpArray(val, indent + 4, docs) + ',');
      else if (typeof val === 'object') lines.push(pad + '    ["' + key + '"] = ' + csharpObject(val, indent + 4, docs) + ',');
    });

    lines.push(pad + '};');
    return lines.join('\n');
  }

  function csharpObject(obj, indent, docs) {
    var pad = new Array(indent + 1).join(' ');
    var lines = ['new JsonObject'];
    lines.push(pad + '{');
    Object.keys(obj).forEach(function (key) {
      var val = obj[key];
      if (val === null || val === undefined) return;
      if (docs) { var dc = getDocComment(key, 'csharp'); if (dc) lines.push(pad + '    ' + dc); }
      if (typeof val === 'string') lines.push(pad + '    ["' + key + '"] = "' + escapeJava(val) + '",');
      else if (typeof val === 'boolean' || typeof val === 'number') lines.push(pad + '    ["' + key + '"] = ' + val + ',');
      else if (Array.isArray(val)) lines.push(pad + '    ["' + key + '"] = ' + csharpArray(val, indent + 4, docs) + ',');
    });
    lines.push(pad + '}');
    return lines.join('\n');
  }

  function csharpArray(arr, indent, docs) {
    var pad = new Array(indent + 1).join(' ');
    var lines = ['new JsonArray'];
    lines.push(pad + '{');
    arr.forEach(function (val) {
      if (typeof val === 'string') lines.push(pad + '    JsonValue.Create("' + escapeJava(val) + '"),');
      else if (typeof val === 'boolean' || typeof val === 'number') lines.push(pad + '    JsonValue.Create(' + val + '),');
      else if (typeof val === 'object' && val !== null) lines.push(pad + '    ' + csharpObject(val, indent + 4, docs) + ',');
    });
    lines.push(pad + '}');
    return lines.join('\n');
  }

  /** Node.js object literal (indented) */
  function jsObjectLiteral(obj, indent, docs) {
    var json = JSON.stringify(obj, null, 2);
    if (!docs) {
      return json.split('\n').map(function (line, i) {
        return i === 0 ? line : new Array(indent + 1).join(' ') + line;
      }).join('\n');
    }
    // With docs: insert comment lines before each top-level key
    var pad = new Array(indent + 1).join(' ');
    var result = [];
    json.split('\n').forEach(function (line, i) {
      var keyMatch = line.match(/^\s+"(\w+)":/);
      if (keyMatch) {
        var dc = getDocComment(keyMatch[1], 'nodejs');
        if (dc) result.push(pad + dc);
      }
      result.push(i === 0 ? line : pad + line);
    });
    return result.join('\n');
  }

  /** Ruby hash literal */
  function rubyHash(obj, indent, docs) {
    var pad = new Array(indent + 1).join(' ');
    var innerPad = pad + '  ';

    if (Array.isArray(obj)) {
      var lines = ['['];
      obj.forEach(function (val) {
        if (typeof val === 'string') lines.push(innerPad + '"' + escapeJava(val) + '",');
        else if (typeof val === 'boolean') lines.push(innerPad + val + ',');
        else if (typeof val === 'number') lines.push(innerPad + val + ',');
        else if (typeof val === 'object' && val !== null) lines.push(innerPad + rubyHash(val, indent + 2, docs) + ',');
      });
      lines.push(pad + ']');
      return lines.join('\n');
    }

    var lines = ['{'];
    Object.keys(obj).forEach(function (key) {
      var val = obj[key];
      if (docs) { var dc = getDocComment(key, 'ruby'); if (dc) lines.push(innerPad + dc); }
      if (val === null || val === undefined) lines.push(innerPad + '"' + key + '" => nil,');
      else if (typeof val === 'string') lines.push(innerPad + '"' + key + '" => "' + escapeJava(val) + '",');
      else if (typeof val === 'boolean') lines.push(innerPad + '"' + key + '" => ' + val + ',');
      else if (typeof val === 'number') lines.push(innerPad + '"' + key + '" => ' + val + ',');
      else if (Array.isArray(val) || typeof val === 'object') lines.push(innerPad + '"' + key + '" => ' + rubyHash(val, indent + 2, docs) + ',');
    });
    lines.push(pad + '}');
    return lines.join('\n');
  }

  /** Go map literal (map[string]interface{}) */
  function goMapLiteral(obj, indent, docs) {
    var pad = new Array(indent + 1).join('\t');
    var innerPad = pad + '\t';

    if (Array.isArray(obj)) {
      var lines = ['[]interface{}{'];
      obj.forEach(function (val) {
        if (typeof val === 'string') lines.push(innerPad + '"' + escapeJava(val) + '",');
        else if (typeof val === 'boolean') lines.push(innerPad + val + ',');
        else if (typeof val === 'number') lines.push(innerPad + val + ',');
        else if (typeof val === 'object' && val !== null) lines.push(innerPad + goMapLiteral(val, indent + 1, docs) + ',');
      });
      lines.push(pad + '}');
      return lines.join('\n');
    }

    var lines = ['map[string]interface{}{'];
    Object.keys(obj).forEach(function (key) {
      var val = obj[key];
      if (docs) { var dc = getDocComment(key, 'go'); if (dc) lines.push(innerPad + dc); }
      if (val === null || val === undefined) lines.push(innerPad + '"' + key + '": nil,');
      else if (typeof val === 'string') lines.push(innerPad + '"' + key + '": "' + escapeJava(val) + '",');
      else if (typeof val === 'boolean') lines.push(innerPad + '"' + key + '": ' + val + ',');
      else if (typeof val === 'number') lines.push(innerPad + '"' + key + '": ' + val + ',');
      else if (Array.isArray(val) || typeof val === 'object') lines.push(innerPad + '"' + key + '": ' + goMapLiteral(val, indent + 1, docs) + ',');
    });
    lines.push(pad + '}');
    return lines.join('\n');
  }

  /** Rust serde_json::json! macro literal (JSON-like but with Rust booleans) */
  function rustJsonLiteral(obj, indent, docs) {
    // Rust json! macro accepts JSON syntax directly
    var json = JSON.stringify(obj, null, 4);
    var pad = new Array(indent + 1).join(' ');
    if (!docs) {
      return json.split('\n').map(function (line, i) {
        return i === 0 ? line : pad + line;
      }).join('\n');
    }
    var result = [];
    json.split('\n').forEach(function (line, i) {
      var keyMatch = line.match(/^\s+"(\w+)":/);
      if (keyMatch) {
        var dc = getDocComment(keyMatch[1], 'rust');
        if (dc) result.push(pad + dc);
      }
      result.push(i === 0 ? line : pad + line);
    });
    return result.join('\n');
  }

  /** Kotlin JSON string builder (uses GSON JsonObject like java_pure but with Kotlin syntax) */
  function kotlinGsonBuild(obj, varName, indent, docs) {
    var pad = new Array(indent + 1).join(' ');
    var lines = [];

    // For the top-level body, we build a JSON string (simpler for Kotlin template)
    var json = JSON.stringify(obj, null, 4);
    if (!docs) {
      lines.push('"""\n' + json + '\n' + pad + '""".trimIndent()');
      return lines.join('\n');
    }
    var result = ['"""'];
    json.split('\n').forEach(function (line) {
      var keyMatch = line.match(/^\s+"(\w+)":/);
      if (keyMatch) {
        var dc = getDocComment(keyMatch[1], 'kotlin');
        // Can't put comments inside a raw string, skip docs for Kotlin
      }
      result.push(line);
    });
    result.push(pad + '""".trimIndent()');
    return result.join('\n');
  }

  // ---------------------------------------------------------------------------
  // C# call builder (method-specific)
  // ---------------------------------------------------------------------------

  function csharpCallCode(method, url, hasBody, indent) {
    var pad = new Array(indent + 1).join(' ');
    var m = method.toUpperCase();
    if (m === 'POST') return pad + 'var response = await http.PostAsync(\n' + pad + '    "' + escapeJava(url) + '", ' + (hasBody ? 'content' : 'null') + ');';
    if (m === 'PUT')  return pad + 'var response = await http.PutAsync(\n' + pad + '    "' + escapeJava(url) + '", ' + (hasBody ? 'content' : 'null') + ');';
    if (m === 'DELETE') return pad + 'var response = await http.DeleteAsync(\n' + pad + '    "' + escapeJava(url) + '");';
    return pad + 'var response = await http.GetAsync(\n' + pad + '    "' + escapeJava(url) + '");';
  }

  // ---------------------------------------------------------------------------
  // inSign API config builder (generates setter calls)
  // ---------------------------------------------------------------------------

  /** Generate setter name from a camelCase property key: exitAvailable → setExitAvailable */
  function setterName(key) {
    return 'set' + key.charAt(0).toUpperCase() + key.slice(1);
  }

  /** Generate signConfig setter calls (JSONSignConfig has typed setters) */
  function buildSignConfigSetters(obj, indent, includeDocs, langKey) {
    var pad = new Array(indent + 1).join(' ');
    var code = '';
    Object.keys(obj).forEach(function (key) {
      var val = obj[key];
      if (val === null || val === undefined || val === '') return;
      if (includeDocs) { var dc = getDocComment(key, langKey); if (dc) code += pad + dc + '\n'; }
      var setter = setterName(key);
      if (typeof val === 'boolean') {
        code += pad + 'signConfig.' + setter + '(' + val + ');\n';
      } else if (typeof val === 'number') {
        code += pad + 'signConfig.' + setter + '(' + val + ');\n';
      } else if (typeof val === 'string') {
        code += pad + 'signConfig.' + setter + '("' + escapeJava(val) + '");\n';
      }
    });
    return code;
  }

  /** Generate deliveryConfig setter calls (JSONDeliveryConfig has typed setters) */
  function buildDeliveryConfigSetters(obj, indent, includeDocs, langKey) {
    var pad = new Array(indent + 1).join(' ');
    var code = '';
    Object.keys(obj).forEach(function (key) {
      var val = obj[key];
      if (val === null || val === undefined || val === '') return;
      if (includeDocs) { var dc = getDocComment(key, langKey); if (dc) code += pad + dc + '\n'; }
      var setter = setterName(key);
      if (typeof val === 'boolean') {
        code += pad + 'deliveryConfig.' + setter + '(' + val + ');\n';
      } else if (typeof val === 'number') {
        code += pad + 'deliveryConfig.' + setter + '(' + val + ');\n';
      } else if (typeof val === 'string') {
        code += pad + 'deliveryConfig.' + setter + '("' + escapeJava(val) + '");\n';
      }
    });
    return code;
  }

  /** Generate addGUIProperty calls (guiProperties is a HashMap<String, Object>) */
  function buildGuiPropertyCalls(obj, indent, includeDocs, langKey) {
    var pad = new Array(indent + 1).join(' ');
    var code = '';
    Object.keys(obj).forEach(function (key) {
      var val = obj[key];
      if (val === null || val === undefined || val === '') return;
      if (includeDocs) { var dc = getDocComment(key, langKey); if (dc) code += pad + dc + '\n'; }
      if (typeof val === 'boolean') {
        var keyArg = getGuiConstantsSet()[key]
          ? 'InSignGUIConstants.' + key
          : '"' + escapeJava(key) + '"';
        code += pad + 'InSignConfigurationBuilder.addGUIProperty(configData, ' + keyArg + ', ' + val + ');\n';
      } else if (typeof val === 'string') {
        // String-valued GUI properties (messages, logos) - put directly into the map
        code += pad + 'guiProps.put("' + escapeJava(key) + '", "' + escapeJava(val) + '");\n';
      }
    });
    return code;
  }

  function buildInsignConfig(body, includeDocs, langKey) {
    var code = '';
    var needsSession = false;
    var needsSignConfig = false;
    var needsDeliveryConfig = false;
    var needsGuiProps = false;
    var docsList = null;
    var guiProps = null;
    var signCfg = null;
    var deliveryCfg = null;

    // Classify properties
    var rootLines = [];
    Object.keys(body).forEach(function (key) {
      var val = body[key];
      if (val === null || val === undefined || val === '') return;

      var complexType = INSIGN_COMPLEX_TYPES[key];
      if (complexType === 'documents') {
        docsList = val;
      } else if (complexType === 'guiProperties') {
        guiProps = val;
      } else if (complexType === 'signConfig') {
        signCfg = val;
      } else if (complexType === 'deliveryConfig') {
        deliveryCfg = val;
      } else if (typeof val === 'object') {
        // Skip unknown complex objects
      } else {
        // Auto-map: key -> session.set<Key>(value)
        needsSession = true;
        var setter = setterName(key);
        if (includeDocs) {
          var dc = getDocComment(key, langKey);
          if (dc) rootLines.push('        ' + dc);
        }
        if (typeof val === 'boolean') rootLines.push('        session.' + setter + '(' + val + ');');
        else rootLines.push('        session.' + setter + '("' + escapeJava(String(val)) + '");');
      }
    });

    if (signCfg && typeof signCfg === 'object') needsSignConfig = true;
    if (deliveryCfg && typeof deliveryCfg === 'object') needsDeliveryConfig = true;
    if (guiProps && typeof guiProps === 'object') {
      // Check if any string-valued props need direct map access
      Object.keys(guiProps).forEach(function (k) {
        if (typeof guiProps[k] === 'string') needsGuiProps = true;
      });
    }

    // Emit local variable declarations
    if (needsSession || needsSignConfig || needsDeliveryConfig || needsGuiProps) {
      code += '        var session = configData.getConfigureSession();\n';
    }
    if (needsSignConfig) {
      code += '        var signConfig = session.getSignConfig();\n';
    }
    if (needsDeliveryConfig) {
      code += '        var deliveryConfig = session.getDeliveryConfig();\n';
    }
    if (needsGuiProps) {
      code += '        var guiProps = session.getGuiProperties();\n';
    }
    if (needsSession || needsSignConfig || needsDeliveryConfig || needsGuiProps) code += '\n';

    // Root-level session properties
    if (rootLines.length > 0) {
      code += rootLines.join('\n') + '\n';
    }

    // guiProperties → InSignConfigurationBuilder.addGUIProperty / guiProps.put
    if (guiProps && typeof guiProps === 'object') {
      code += '\n        // GUI properties\n';
      code += buildGuiPropertyCalls(guiProps, 8, includeDocs, langKey);
    }

    // signConfig → signConfig.setXxx(...)
    if (signCfg && typeof signCfg === 'object') {
      code += '\n        // Sign configuration (delivery channels, pairing, etc.)\n';
      code += buildSignConfigSetters(signCfg, 8, includeDocs, langKey);
    }

    // deliveryConfig → deliveryConfig.setXxx(...)
    if (deliveryCfg && typeof deliveryCfg === 'object') {
      code += '\n        // Delivery configuration (email subjects, bodies, recipients)\n';
      code += buildDeliveryConfigSetters(deliveryCfg, 8, includeDocs, langKey);
    }

    if (docsList && Array.isArray(docsList)) {
      code += '\n';
      docsList.forEach(function (doc, i) {
        var docVar = 'doc' + (i + 1);
        var hasFileURL = doc.fileURL && doc.fileURL !== '';
        code += '        // Document ' + (i + 1) + '\n';

        if (hasFileURL) {
          code += '        var ' + docVar + ' = InSignConfigurationBuilder.addDokument(configData, "' +
                  escapeJava(doc.id || 'doc' + (i + 1)) + '", "' + escapeJava(doc.fileURL) + '");\n';
        } else {
          code += '        var ' + docVar + ' = InSignConfigurationBuilder.addDokumentInline(configData, "' +
                  escapeJava(doc.id || 'doc' + (i + 1)) + '", docBytes' + (i + 1) + ');\n';
        }

        Object.keys(doc).forEach(function (dk) {
          if (dk === 'id' || dk === 'fileURL' || dk === 'file') return;
          var dv = doc[dk];
          if (dv === null || dv === undefined || dv === '') return;
          if (dk === 'signatures' && Array.isArray(dv)) {
            dv.forEach(function () {
              code += '        // Signature field: see InSignConfigurationBuilder.addSignature()\n';
            });
          } else if (typeof dv !== 'object') {
            var docSetter = setterName(dk);
            if (typeof dv === 'boolean') code += '        ' + docVar + '.' + docSetter + '(' + dv + ');\n';
            else code += '        ' + docVar + '.' + docSetter + '("' + escapeJava(String(dv)) + '");\n';
          }
        });
        code += '\n';
      });
    }

    return code;
  }

  // ---------------------------------------------------------------------------
  // Build template variables from context
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // <filedata> handling - replaces placeholder with fileURL (active code) and
  // generates a commented alternative showing base64 file-from-disk approach
  // ---------------------------------------------------------------------------

  /**
   * Check if body contains any <filedata> placeholder in documents[].file,
   * and return a copy with file replaced by fileURL, plus the comment block.
   */
  function resolveFiledata(body, ctx) {
    if (!body || !body.documents || !Array.isArray(body.documents)) return { body: body, hasFiledata: false };

    var found = false;
    var resolved = JSON.parse(JSON.stringify(body));
    for (var i = 0; i < resolved.documents.length; i++) {
      if (resolved.documents[i].file === '<filedata>') {
        found = true;
        delete resolved.documents[i].file;
        resolved.documents[i].fileURL = ctx.documentUrl || 'https://nowhere.invalid/document.pdf';
      }
    }
    return { body: resolved, hasFiledata: found };
  }

  /**
   * Replace <logo:*> placeholders in the body with descriptive URLs for code snippets.
   * These placeholders are used in the JSON editor to avoid embedding large base64 data URLs.
   */
  function resolveLogoPlaceholders(body) {
    if (!body || typeof body !== 'object') return body;
    var resolved = JSON.parse(JSON.stringify(body));
    var map = {
      '<logo:icon>':  'https://example.test/logo-icon.png',
      '<logo:mail>':  'https://example.test/logo-mail.png',
      '<logo:login>': 'https://example.test/logo-login.png'
    };
    if (resolved.guiProperties) {
      for (var k in resolved.guiProperties) {
        if (map[resolved.guiProperties[k]]) resolved.guiProperties[k] = map[resolved.guiProperties[k]];
      }
    }
    if (map[resolved.logoExtern]) resolved.logoExtern = map[resolved.logoExtern];
    return resolved;
  }

  /** Generate language-specific commented code for reading a file from disk and base64-encoding it */
  function filedataComment(langKey, filename) {
    var fn = filename || 'document.pdf';
    switch (langKey) {
      case 'curl':
        return '# --- Alternative: embed file as base64 instead of fileURL ---\n' +
               '# Replace "fileURL" with "file" in the JSON and set its value to base64:\n' +
               '# FILE_B64=$(base64 -w 0 "' + fn + '")\n' +
               '# Then use:  "file": "\'$FILE_B64\'"  instead of "fileURL"\n';
      case 'python':
        return '    # --- Alternative: embed file as base64 instead of fileURL ---\n' +
               '    # import base64\n' +
               '    # with open("' + fn + '", "rb") as f:\n' +
               '    #     file_b64 = base64.b64encode(f.read()).decode()\n' +
               '    # Then replace "fileURL" with: "file": file_b64\n';
      case 'nodejs':
        return '  // --- Alternative: embed file as base64 instead of fileURL ---\n' +
               '  // const fileB64 = require("fs").readFileSync("' + fn + '").toString("base64");\n' +
               '  // Then replace "fileURL" with: "file": fileB64\n';
      case 'php':
        return '// --- Alternative: embed file as base64 instead of fileURL ---\n' +
               '// $fileB64 = base64_encode(file_get_contents("' + fn + '"));\n' +
               '// Then replace "fileURL" with: "file" => $fileB64\n';
      case 'csharp':
        return '// --- Alternative: embed file as base64 instead of fileURL ---\n' +
               '// var fileB64 = Convert.ToBase64String(File.ReadAllBytes("' + fn + '"));\n' +
               '// Then replace "fileURL" with: ["file"] = fileB64\n';
      case 'java_pure':
      case 'java_spring':
        return '        // --- Alternative: embed file as base64 instead of fileURL ---\n' +
               '        // byte[] fileBytes = java.nio.file.Files.readAllBytes(java.nio.file.Path.of("' + fn + '"));\n' +
               '        // String fileB64 = java.util.Base64.getEncoder().encodeToString(fileBytes);\n' +
               '        // Then replace "fileURL" with: .put("file", fileB64)\n';
      case 'java_insign':
        return '        // --- Alternative: load file from disk instead of fileURL ---\n' +
               '        // doc.setFile(java.nio.file.Files.newInputStream(java.nio.file.Path.of("' + fn + '")));\n';
      case 'typescript':
        return '// --- Alternative: embed file as base64 instead of fileURL ---\n' +
               '// import * as fs from "fs";\n' +
               '// const fileB64 = fs.readFileSync("' + fn + '").toString("base64");\n' +
               '// Then replace "fileURL" with: "file": fileB64\n';
      case 'ruby':
        return '# --- Alternative: embed file as base64 instead of fileURL ---\n' +
               '# require "base64"\n' +
               '# file_b64 = Base64.strict_encode64(File.binread("' + fn + '"))\n' +
               '# Then replace "fileURL" with: "file" => file_b64\n';
      case 'go':
        return '\t// --- Alternative: embed file as base64 instead of fileURL ---\n' +
               '\t// fileBytes, _ := os.ReadFile("' + fn + '")\n' +
               '\t// fileB64 := base64.StdEncoding.EncodeToString(fileBytes)\n' +
               '\t// Then replace "fileURL" with: "file": fileB64\n';
      case 'rust':
        return '    // --- Alternative: embed file as base64 instead of fileURL ---\n' +
               '    // use base64::Engine;\n' +
               '    // let file_b64 = base64::engine::general_purpose::STANDARD.encode(std::fs::read("' + fn + '")?);\n' +
               '    // Then replace "fileURL" with: "file": file_b64\n';
      case 'kotlin':
        return '    // --- Alternative: embed file as base64 instead of fileURL ---\n' +
               '    // val fileB64 = java.util.Base64.getEncoder().encodeToString(java.nio.file.Files.readAllBytes(java.nio.file.Path.of("' + fn + '")))\n' +
               '    // Then replace "fileURL" with: "file": fileB64\n';
      default:
        return '';
    }
  }

  function buildVars(langKey, ctx) {
    var method = (ctx.method || 'GET').toUpperCase();
    var hasBody = ctx.body && method !== 'GET' && method !== 'HEAD';
    var url = ctx.baseUrl + ctx.path;
    var includeDocs = ctx.includeDocs || false;
    var includeSamples = ctx.includeSamples || false;
    if (includeDocs || includeSamples) getPropertyCatalog(); // ensure docs are loaded

    // Resolve <filedata> placeholders: replace with fileURL for runnable code
    var filedataResult = hasBody ? resolveFiledata(ctx.body, ctx) : { body: ctx.body, hasFiledata: false };
    // Resolve <logo:*> placeholders with example URLs for code snippets
    var bodyForBuild = hasBody ? resolveLogoPlaceholders(filedataResult.body) : filedataResult.body;

    var vars = {
      URL:           url,
      BASE_URL:      ctx.baseUrl,
      PATH:          ctx.path,
      METHOD:        method,
      METHOD_LOWER:  method.toLowerCase(),
      METHOD_CAPITALIZED: method.charAt(0).toUpperCase() + method.slice(1).toLowerCase(),
      USERNAME:      ctx.username || '',
      PASSWORD:      ctx.password || '',
      CONTENT_TYPE:  ctx.contentType || 'application/json',
      HAS_BODY:      hasBody,
      BODY_JSON:     hasBody ? JSON.stringify(bodyForBuild, null, 2) : '',
      BODY_BUILD:    '',
      CSHARP_CALL:   '',
      INSIGN_CONFIG: '',
      FILE_COMMENT:  filedataResult.hasFiledata ? filedataComment(langKey, ctx.documentFilename) : ''
    };

    // Generate language-specific body builders
    if (hasBody) {
      switch (langKey) {
        case 'java_pure':
          vars.BODY_BUILD = gsonBuildNode(bodyForBuild, 'body', 8, includeDocs, langKey);
          break;
        case 'java_spring':
          vars.BODY_BUILD = jacksonBuildNode(bodyForBuild, 'body', 8, includeDocs, langKey);
          break;
        case 'python':
          vars.BODY_BUILD = pythonDict(bodyForBuild, 4, includeDocs);
          break;
        case 'php':
          vars.BODY_BUILD = phpArray(bodyForBuild, 0, includeDocs);
          break;
        case 'csharp':
          vars.BODY_BUILD = csharpBuildJsonNode(bodyForBuild, 'body', 0, includeDocs);
          break;
        case 'nodejs':
          vars.BODY_BUILD = jsObjectLiteral(bodyForBuild, 2, includeDocs);
          break;
        case 'typescript':
          vars.BODY_BUILD = jsObjectLiteral(bodyForBuild, 2, includeDocs);
          break;
        case 'ruby':
          vars.BODY_BUILD = rubyHash(bodyForBuild, 0, includeDocs);
          break;
        case 'go':
          vars.BODY_BUILD = goMapLiteral(bodyForBuild, 1, includeDocs);
          break;
        case 'rust':
          vars.BODY_BUILD = rustJsonLiteral(bodyForBuild, 4, includeDocs);
          break;
        case 'kotlin':
          vars.BODY_BUILD = gsonBuildNode(bodyForBuild, 'body', 0, includeDocs, 'kotlin');
          break;
        case 'curl':
          vars.BODY_JSON = escapeShell(JSON.stringify(bodyForBuild, null, 2));
          if (includeDocs) vars.BODY_JSON = addJsonDocComments(bodyForBuild, langKey) + '\n' + vars.BODY_JSON;
          break;
      }
    }

    // C# method-specific call
    if (langKey === 'csharp') {
      vars.CSHARP_CALL = csharpCallCode(method, url, hasBody, 0);
    }

    // inSign API config
    if (langKey === 'java_insign') {
      var isSession = ctx.path && ctx.path.replace(/\/+$/, '') === '/configure/session';
      if (!isSession) {
        vars.INSIGN_CONFIG = '        // The inSign Java API is primarily designed for session configuration.\n' +
                             '        // For ' + ctx.path + ', use "Java (Spring)" or "Java (GSON)" tabs.';
      } else {
        vars.INSIGN_CONFIG = buildInsignConfig(bodyForBuild || {}, includeDocs, langKey);
      }
    }

    // Escape values for shell templates
    if (langKey === 'curl') {
      vars.URL = escapeShell(url);
      vars.USERNAME = escapeShell(ctx.username || '');
      vars.PASSWORD = escapeShell(ctx.password || '');
      vars.BASE_URL = escapeShell(ctx.baseUrl);
    }

    // Generate commented-out sample properties for missing flags
    if (hasBody && includeSamples) {
      var samples = generateSamples(langKey, bodyForBuild);
      if (langKey === 'java_insign') {
        if (samples) vars.INSIGN_CONFIG += '\n' + samples;
      } else {
        vars.SAMPLES = samples;
      }
    }
    if (!vars.SAMPLES) vars.SAMPLES = '';

    return vars;
  }

  // ---------------------------------------------------------------------------
  // Property catalog & sample generation
  // ---------------------------------------------------------------------------

  var propertyCatalog = null;
  var propertyDocs = {};  // key → { label, desc, path }

  /** Parse the property catalog from already-fetched JSON data */
  function parsePropertyCatalog(data) {
    _guiConstantsCache = null;
    _guiConstantsFromOpenApi = false;
    propertyCatalog = { root: [], guiProperties: [], signConfig: [], deliveryConfig: [] };
    data.featureGroups.forEach(function (group) {
      group.features.forEach(function (f) {
        var section = f.path || 'root';
        if (section === 'doc') return;
        if (!propertyCatalog[section]) propertyCatalog[section] = [];
        propertyCatalog[section].push({ key: f.key, type: f.type, label: f.label });
        propertyDocs[f.key] = { label: f.label, desc: f.desc || '', path: section };
      });
    });
    if (data.featureDescriptions) {
      data.featureDescriptions.forEach(function (f) {
        if (!propertyDocs[f.key]) {
          propertyDocs[f.key] = { label: f.key, desc: f.description || '', path: 'root' };
        } else if (!propertyDocs[f.key].desc && f.description) {
          propertyDocs[f.key].desc = f.description;
        }
      });
    }
  }

  /** Preload the property catalog asynchronously */
  function preloadPropertyCatalog() {
    if (propertyCatalog) return;
    try {
      fetch('data/feature-descriptions.json')
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) { if (data) parsePropertyCatalog(data); });
    } catch (e) { /* ignore */ }
  }

  /** Return the property catalog (must be preloaded) */
  function getPropertyCatalog() {
    return propertyCatalog;
  }

  /** Get a doc comment for a property key, or empty string if unknown */
  function getDocComment(key, langKey) {
    var info = propertyDocs[key];
    var desc = info && info.desc;
    // Fallback to OpenAPI spec description
    if (!desc) {
      var loader = window.state && window.state.schemaLoader;
      if (loader && loader.guiPropertyKeys && loader.guiPropertyKeys[key]) {
        desc = loader.guiPropertyKeys[key].description;
      }
    }
    if (!info && !desc) return '';
    var cmt = (langKey === 'python' || langKey === 'curl' || langKey === 'ruby') ? '# ' : '// ';
    var label = info ? info.label : key;
    return desc ? (cmt + label + ': ' + desc) : '';
  }

  /** Generate a shell comment block documenting all body keys (for curl, since JSON has no comments) */
  function addJsonDocComments(body) {
    var lines = [];
    lines.push('# --- Property reference ---');
    Object.keys(body).forEach(function (key) {
      var val = body[key];
      var dc = getDocComment(key, 'curl');
      if (dc) lines.push(dc);
      // Include nested object keys (guiProperties, signConfig, etc.)
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        Object.keys(val).forEach(function (sk) {
          var sdc = getDocComment(sk, 'curl');
          if (sdc) lines.push(sdc);
        });
      }
      // Include keys from array items (documents)
      if (Array.isArray(val)) {
        var seen = {};
        val.forEach(function (item) {
          if (item && typeof item === 'object') {
            Object.keys(item).forEach(function (ik) {
              if (!seen[ik]) { seen[ik] = true; var idc = getDocComment(ik, 'curl'); if (idc) lines.push(idc); }
            });
          }
        });
      }
    });
    return lines.join('\n');
  }

  /** Format a sample value literal for a given language */
  function sampleLiteral(langKey, type) {
    if (type === 'bool') {
      if (langKey === 'python') return 'True';
      if (langKey === 'ruby') return 'true';
      return 'true';
    }
    if (langKey === 'php') return "'...'";
    return '"..."';
  }

  /** Generate commented-out sample lines for properties not in the current body */
  function generateSamples(langKey, body) {
    var catalog = getPropertyCatalog();
    if (!catalog || !body) return '';

    var existingRoot = {};
    var existingGui = {};
    var existingSign = {};
    var existingDelivery = {};
    Object.keys(body).forEach(function (k) { existingRoot[k] = true; });
    if (body.guiProperties) Object.keys(body.guiProperties).forEach(function (k) { existingGui[k] = true; });
    if (body.signConfig) Object.keys(body.signConfig).forEach(function (k) { existingSign[k] = true; });
    if (body.deliveryConfig) Object.keys(body.deliveryConfig).forEach(function (k) { existingDelivery[k] = true; });

    var sections = [
      { title: 'Additional session options', items: catalog.root, existing: existingRoot, path: 'root' },
      { title: 'GUI properties', items: catalog.guiProperties || [], existing: existingGui, path: 'guiProperties' },
      { title: 'Sign configuration', items: catalog.signConfig || [], existing: existingSign, path: 'signConfig' },
      { title: 'Delivery configuration', items: catalog.deliveryConfig || [], existing: existingDelivery, path: 'deliveryConfig' }
    ];

    var lines = [];

    sections.forEach(function (sec) {
      var missing = sec.items.filter(function (p) { return !sec.existing[p.key]; });
      if (missing.length === 0) return;

      var cmt = langKey === 'python' || langKey === 'curl' || langKey === 'ruby' ? '# ' : '// ';
      var pad = '';
      if (langKey === 'java_pure' || langKey === 'java_spring' || langKey === 'java_insign') pad = '        ';

      lines.push('');
      lines.push(pad + cmt + '--- ' + sec.title + ' (uncomment as needed) ---');

      // If the nested section doesn't exist in body yet, show how to create it
      if (sec.path !== 'root' && !body[sec.path]) {
        switch (langKey) {
          case 'python':
            lines.push(cmt + 'payload["' + sec.path + '"] = {}'); break;
          case 'php':
            lines.push(cmt + "$payload['" + sec.path + "'] = [];"); break;
          case 'nodejs': case 'typescript':
            lines.push(cmt + 'body.' + sec.path + ' = {};'); break;
          case 'csharp':
            lines.push(cmt + 'body["' + sec.path + '"] = new JsonObject();'); break;
          case 'java_pure': case 'java_spring':
            lines.push(pad + cmt + 'ObjectNode ' + sec.path + 'Node = body.putObject("' + sec.path + '");'); break;
          case 'ruby':
            lines.push(cmt + 'payload["' + sec.path + '"] = {}'); break;
          case 'go':
            lines.push(cmt + 'body["' + sec.path + '"] = map[string]interface{}{}'); break;
          case 'rust':
            lines.push(cmt + 'body["' + sec.path + '"] = serde_json::json!({})'); break;
          case 'kotlin':
            lines.push(pad + cmt + '// Add "' + sec.path + '": {} to the JSON body string'); break;
        }
      }

      missing.forEach(function (p) {
        // Add doc comment for this property
        var dc = getDocComment(p.key, langKey);
        if (dc) lines.push(pad + dc);

        var val = sampleLiteral(langKey, p.type);
        var line;
        switch (langKey) {
          case 'python': {
            var pre = sec.path === 'root' ? 'payload' : 'payload["' + sec.path + '"]';
            line = cmt + pre + '["' + p.key + '"] = ' + val;
            break;
          }
          case 'php': {
            var pre = sec.path === 'root' ? "$payload" : "$payload['" + sec.path + "']";
            line = cmt + pre + "['" + p.key + "'] = " + val + ';';
            break;
          }
          case 'nodejs': case 'typescript': {
            var pre = sec.path === 'root' ? 'body' : 'body.' + sec.path;
            line = cmt + pre + '["' + p.key + '"] = ' + val + ';';
            break;
          }
          case 'csharp': {
            var pre = sec.path === 'root' ? 'body' : '((JsonObject)body["' + sec.path + '"])';
            line = cmt + pre + '["' + p.key + '"] = ' + val + ';';
            break;
          }
          case 'java_pure': case 'java_spring': {
            var vn = sec.path === 'root' ? 'body' : sec.path + 'Node';
            line = pad + cmt + vn + '.put("' + p.key + '", ' + val + ');';
            break;
          }
          case 'java_insign': {
            if (sec.path === 'root') {
              line = pad + cmt + 'session.' + setterName(p.key) + '(' + val + ');';
            } else if (sec.path === 'guiProperties') {
              var keyArg = getGuiConstantsSet()[p.key]
                ? 'InSignGUIConstants.' + p.key
                : '"' + p.key + '"';
              line = pad + cmt + 'InSignConfigurationBuilder.addGUIProperty(configData, ' + keyArg + ', ' + val + ');';
            } else if (sec.path === 'deliveryConfig') {
              line = pad + cmt + 'deliveryConfig.' + setterName(p.key) + '(' + val + ');';
            } else {
              line = pad + cmt + 'signConfig.' + setterName(p.key) + '(' + val + ');';
            }
            break;
          }
          case 'curl': {
            line = cmt + '"' + p.key + '": ' + val;
            break;
          }
          case 'ruby': {
            var pre = sec.path === 'root' ? 'payload' : 'payload["' + sec.path + '"]';
            line = cmt + pre + '["' + p.key + '"] = ' + val;
            break;
          }
          case 'go': {
            var pre = sec.path === 'root' ? 'body' : 'body["' + sec.path + '"].(map[string]interface{})';
            line = cmt + pre + '["' + p.key + '"] = ' + val;
            break;
          }
          case 'rust': {
            line = cmt + 'body["' + p.key + '"] = serde_json::json!(' + val + ');';
            break;
          }
          case 'kotlin': {
            line = pad + cmt + '// Add "' + p.key + '": ' + val + ' to the JSON body string';
            break;
          }
        }
        if (line) lines.push(line);
      });
    });

    return lines.join('\n');
  }

  // ---------------------------------------------------------------------------
  // Template loading
  // ---------------------------------------------------------------------------

  function loadTemplate(filename) {
    return templateCache[filename] || null;
  }

  /** Pre-load all templates asynchronously */
  function preloadTemplates() {
    Object.keys(LANGUAGES).forEach(function (key) {
      var filename = LANGUAGES[key].template;
      if (!templateCache[filename]) {
        try {
          fetch('codegen-templates/' + filename)
            .then(function (r) { return r.ok ? r.text() : null; })
            .then(function (text) { if (text) templateCache[filename] = text; });
        } catch (e) { /* ignore */ }
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  window.CodeGenerator = {
    LANGUAGES: LANGUAGES,
    INSIGN_COMPLEX_TYPES: INSIGN_COMPLEX_TYPES,

    /** Pre-load templates and property catalog (call on page init) */
    preload: function () { preloadTemplates(); preloadPropertyCatalog(); },

    /**
     * Generate a code snippet for the given language and request context.
     */
    generate: function (languageKey, context) {
      var lang = LANGUAGES[languageKey];
      if (!lang) return '// Unknown language: ' + languageKey;

      var template = loadTemplate(lang.template);
      if (!template) return '// Template not loaded: ' + lang.template;

      var vars = buildVars(languageKey, context);
      return renderTemplate(template, vars);
    }
  };

  // Auto-preload on script load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      preloadTemplates();
      preloadPropertyCatalog();
    });
  } else {
    preloadTemplates();
    preloadPropertyCatalog();
  }
})();
