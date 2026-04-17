/* ==========================================================================
   OpenAPI Schema Loader - Fetches /v3/api-docs from the inSign server
   and registers JSON schemas with Monaco Editor for autocomplete.
   ========================================================================== */

window.OpenApiSchemaLoader = class OpenApiSchemaLoader {

    constructor() {
        this.schemas = {};       // camelCase key -> { uri, schema }
        this.paths = {};         // path -> { method -> { summary, description } }
        this.guiPropertyKeys = {};  // key -> { globalProperty, description } parsed from OpenAPI spec
        this.loaded = false;
    }

    /**
     * Fetch the OpenAPI spec from the server and extract schemas.
     * @param {string} baseUrl - The inSign server base URL
     * @returns {Promise<boolean>} true if schemas were loaded successfully
     */
    async load(baseUrl, corsProxy) {
        let url = baseUrl.replace(/\/+$/, '') + '/v3/api-docs';
        if (corsProxy) url = corsProxy + encodeURIComponent(url);
        try {
            const resp = await fetch(url, {
                headers: { 'Accept': 'application/json' },
                mode: 'cors'
            });
            if (!resp.ok) return false;

            const spec = await resp.json();
            const rawSchemas = spec?.components?.schemas;
            if (!rawSchemas) return false;

            this.schemas = this._transform(rawSchemas);
            this._extractPaths(spec.paths);
            this.loaded = true;
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Transform OpenAPI component schemas into Monaco-compatible format.
     * - Converts $ref from "#/components/schemas/Foo" to "insign://schemas/foo"
     * - Generates camelCase keys from PascalCase schema names
     * - Creates URI identifiers for cross-schema references
     */
    _transform(rawSchemas) {
        const result = {};

        for (const [name, schema] of Object.entries(rawSchemas)) {
            const key = this._toCamelCase(name);
            const uri = 'insign://schemas/' + key;
            const converted = this._convertRefs(structuredClone(schema));
            this._addMarkdownDescriptions(converted);
            result[key] = { uri, schema: converted };

            // Extract GUI property keys from the guiProperties description table
            const guiDesc = schema?.properties?.guiProperties?.description;
            if (guiDesc && guiDesc.includes('|key')) {
                this._parseGuiPropertyKeys(guiDesc);
            }
        }

        return result;
    }

    /**
     * Parse the pipe-delimited table from the guiProperties description field.
     * Format: |keyName (global.property.name)|description text
     * Populates this.guiPropertyKeys with { key: { globalProperty, description } }
     */
    _parseGuiPropertyKeys(desc) {
        for (const line of desc.split('\n')) {
            if (!line.startsWith('|') || line.startsWith('|key') || line.startsWith('|--')) continue;
            const parts = line.split('|').map(s => s.trim()).filter(Boolean);
            if (parts.length < 2) continue;
            const m = parts[0].match(/^(\w+)\s*\(([^)]+)\)/);
            if (m) {
                this.guiPropertyKeys[m[1]] = {
                    globalProperty: m[2],
                    description: parts[1]
                };
            }
        }
    }

    /**
     * Recursively add markdownDescription to every node that has a description.
     * Monaco renders markdownDescription in the suggest details panel with
     * rich formatting. Also adds the property name as a bold header and
     * formats enum values for better readability.
     */
    _addMarkdownDescriptions(obj, propertyName) {
        if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return;

        if (obj.description && !obj.markdownDescription) {
            let desc = obj.description;

            // Shorten Java FQCN: de.is2.sign.service.rest.json.JSONSignConfig → signConfig
            desc = desc.replace(/de\.is2\.sign\.service\.rest\.json\.JSONSignConfig/g, 'signConfig');

            // Extract "replacement: ..." and "since: ..." metadata from description
            let replacement = null;
            let since = null;

            desc = desc.replace(/[,;.]?\s*replacement:\s*(\S+)/gi, (_, val) => {
                replacement = val.replace(/de\.is2\.sign\.service\.rest\.json\.JSONSignConfig\./g, 'signConfig.');
                return '';
            });
            desc = desc.replace(/[,;.]?\s*since:\s*(\S+)/gi, (_, val) => {
                since = val;
                return '';
            });

            desc = desc.trim();

            const parts = [];
            if (propertyName) parts.push(`**${propertyName}**`);
            if (obj.type) parts.push(`\`${obj.type}\``);
            if (obj.enum) parts.push('- enum: ' + obj.enum.map(v => `\`${v}\``).join(', '));
            if (replacement) parts.push(' \u26a0\ufe0f **Deprecated**');
            if (since) parts.push(`- since: \`${since}\``);
            if (parts.length) parts.push('\n\n');
            if (replacement) parts.push(`> \u26a0\ufe0f Replacement: \`${replacement}\`\n\n`);
            parts.push(desc);

            obj.markdownDescription = parts.join(' ');
            obj.description = desc;
        }

        // Recurse into properties
        if (obj.properties) {
            for (const [key, prop] of Object.entries(obj.properties)) {
                this._addMarkdownDescriptions(prop, key);
            }
        }

        // Recurse into items (arrays)
        if (obj.items) {
            this._addMarkdownDescriptions(obj.items);
        }

        // Recurse into combiners
        for (const combiner of ['allOf', 'oneOf', 'anyOf']) {
            if (Array.isArray(obj[combiner])) {
                for (const sub of obj[combiner]) {
                    this._addMarkdownDescriptions(sub);
                }
            }
        }

        // Recurse into additionalProperties
        if (obj.additionalProperties && typeof obj.additionalProperties === 'object') {
            this._addMarkdownDescriptions(obj.additionalProperties);
        }
    }

    /**
     * Recursively convert OpenAPI $ref paths to Monaco schema URIs.
     * "#/components/schemas/FooBar" → "insign://schemas/fooBar"
     */
    _convertRefs(obj) {
        if (obj === null || typeof obj !== 'object') return obj;

        if (Array.isArray(obj)) {
            for (let i = 0; i < obj.length; i++) {
                obj[i] = this._convertRefs(obj[i]);
            }
            return obj;
        }

        if ('$ref' in obj) {
            const ref = obj['$ref'];
            if (ref.startsWith('#/components/schemas/')) {
                const schemaName = ref.substring('#/components/schemas/'.length);
                obj['$ref'] = 'insign://schemas/' + this._toCamelCase(schemaName);
            }
        }

        for (const key of Object.keys(obj)) {
            if (key !== '$ref') {
                obj[key] = this._convertRefs(obj[key]);
            }
        }

        return obj;
    }

    /**
     * Convert PascalCase to camelCase.
     * "ConfigureSession" → "configureSession"
     * "SessionIDInput"   → "sessionIDInput"
     * "QESConfig"        → "qesConfig"
     * "GPSData"          → "gpsData"
     */
    _toCamelCase(name) {
        if (!name) return name;
        // All-uppercase: "GPS" → "gps"
        if (/^[A-Z]+$/.test(name)) return name.toLowerCase();
        // Leading acronym: split before the last uppercase that starts a lowercase-containing word
        // "QESConfig" → "qes" + "Config", "GPSData" → "gps" + "Data"
        // "SessionIDInput" → "s" + "essionIDInput" → falls through to simple case
        const m = name.match(/^([A-Z]+?)([A-Z][a-z].*)$/);
        if (m) {
            return m[1].toLowerCase() + m[2];
        }
        // Simple PascalCase: "ConfigureSession" → "configureSession"
        return name.charAt(0).toLowerCase() + name.slice(1);
    }

    /**
     * Register all loaded schemas with Monaco's JSON language service.
     * Call this after monaco is initialized and schemas are loaded.
     */
    registerWithMonaco(monaco) {
        if (!this.loaded) return;

        const monacoSchemas = [];
        for (const [key, val] of Object.entries(this.schemas)) {
            monacoSchemas.push({
                uri: val.uri,
                fileMatch: [key + '.json'],
                schema: val.schema
            });
        }

        monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
            validate: true,
            schemas: monacoSchemas,
            allowComments: false,
            trailingCommas: 'error'
        });
    }

    /**
     * Enrich the guiProperties schema inside configureSession (and any schema
     * that references it) with per-property definitions parsed from the
     * feature-descriptions data.  This replaces the server's opaque
     * Map<String,Object> / freeform-string description with a proper typed
     * object so Monaco can offer autocomplete and hover tooltips for every
     * guiProperties key.
     *
     * @param {Array} featureGroups - The featureGroups array from feature-descriptions.json
     */
    enrichGuiProperties(featureGroups) {
        if (!this.loaded || this._guiPropsEnriched) return;
        this._guiPropsEnriched = true;

        // Build a JSON-Schema "properties" map from all known GUI properties.
        // Primary source: OpenAPI spec table (this.guiPropertyKeys, parsed from description).
        // Secondary: feature-descriptions.json (labels, types, options for the explorer UI subset).
        const props = {};

        // Index feature-descriptions by key for quick lookup
        const featureIndex = {};
        if (featureGroups?.length) {
            for (const group of featureGroups) {
                for (const f of group.features) {
                    if (f.path === 'guiProperties') featureIndex[f.key] = f;
                }
            }
        }

        // All keys from the OpenAPI spec
        for (const [key, info] of Object.entries(this.guiPropertyKeys)) {
            const f = featureIndex[key];
            const propSchema = {};

            // Type from feature-descriptions if available, else default boolean
            if (f && f.type === 'select' && f.options) {
                propSchema.enum = f.options;
            } else if (f && f.type !== 'bool') {
                propSchema.type = 'string';
            } else {
                propSchema.type = 'boolean';
            }

            // Description from OpenAPI spec, label from feature-descriptions
            const parts = [];
            if (f && f.label) parts.push(`**${f.label}**`);
            parts.push(`\`${info.globalProperty}\``);
            parts.push('\n\n' + info.description);
            propSchema.markdownDescription = parts.join(' - ');
            propSchema.description = info.description;

            props[key] = propSchema;
        }

        // Add any feature-descriptions keys not in OpenAPI (shouldn't happen, but safe)
        for (const [key, f] of Object.entries(featureIndex)) {
            if (props[key]) continue;
            const propSchema = {};
            if (f.type === 'bool') propSchema.type = 'boolean';
            else if (f.type === 'select' && f.options) propSchema.enum = f.options;
            else propSchema.type = 'string';
            const parts = [];
            if (f.label) parts.push(`**${f.label}**`);
            if (f.globalProperty) parts.push(`\`${f.globalProperty}\``);
            if (f.desc) parts.push('\n\n' + f.desc);
            propSchema.markdownDescription = parts.join(' - ');
            propSchema.description = f.desc || f.label || f.key;
            props[key] = propSchema;
        }

        if (!Object.keys(props).length) return;

        const guiSchema = {
            type: 'object',
            description: 'UI behavior properties - toggle features like exit buttons, signing devices, form editing, navigation and more.',
            markdownDescription: 'UI behavior properties - toggle features like exit buttons, signing devices, form editing, navigation and more.\n\nType a property name to see autocomplete suggestions.',
            properties: props,
            additionalProperties: true  // allow unknown keys the spec doesn't list
        };

        // Patch every schema that has a "guiProperties" property
        for (const entry of Object.values(this.schemas)) {
            this._patchGuiProperties(entry.schema, guiSchema);
        }
    }

    /**
     * Recursively find and replace guiProperties definitions in a schema.
     */
    _patchGuiProperties(schema, replacement) {
        if (!schema || typeof schema !== 'object') return;

        if (schema.properties && 'guiProperties' in schema.properties) {
            schema.properties.guiProperties = replacement;
        }

        // Recurse into allOf / oneOf / anyOf
        for (const combiner of ['allOf', 'oneOf', 'anyOf']) {
            if (Array.isArray(schema[combiner])) {
                for (const sub of schema[combiner]) {
                    this._patchGuiProperties(sub, replacement);
                }
            }
        }
    }

    /**
     * Get a schema by camelCase key.
     */
    get(key) {
        return this.schemas[key] || null;
    }

    /**
     * Extract path summaries/descriptions and request/response schema refs
     * from the OpenAPI spec.
     */
    _extractPaths(paths) {
        if (!paths) return;
        for (const [path, methods] of Object.entries(paths)) {
            this.paths[path] = {};
            for (const [method, info] of Object.entries(methods)) {
                if (typeof info === 'object' && info !== null) {
                    const entry = {
                        summary: info.summary || '',
                        description: info.description || ''
                    };

                    // Extract request body schema ref (JSON or form-encoded)
                    const reqContent = info.requestBody?.content;
                    const reqRef = reqContent?.['application/json']?.schema?.['$ref']
                        || reqContent?.['*/*']?.schema?.['$ref'];
                    if (reqRef && reqRef.startsWith('#/components/schemas/')) {
                        entry.requestSchemaKey = this._toCamelCase(reqRef.substring('#/components/schemas/'.length));
                    }

                    // Check for form-urlencoded or multipart request body with inline schema
                    if (!entry.requestSchemaKey && reqContent) {
                        const formSchema = reqContent['application/x-www-form-urlencoded']?.schema
                            || reqContent['multipart/form-data']?.schema;
                        if (formSchema) {
                            if (formSchema['$ref'] && formSchema['$ref'].startsWith('#/components/schemas/')) {
                                entry.requestSchemaKey = this._toCamelCase(formSchema['$ref'].substring('#/components/schemas/'.length));
                            } else if (formSchema.properties) {
                                // Inline form schema - synthesize and register it
                                const syntheticKey = '_form_' + path.replace(/[^a-zA-Z0-9]/g, '_') + '_' + method.toLowerCase();
                                const converted = this._convertRefs(structuredClone(formSchema));
                                this._addMarkdownDescriptions(converted);
                                const uri = 'insign://schemas/' + syntheticKey;
                                this.schemas[syntheticKey] = { uri, schema: converted };
                                entry.requestSchemaKey = syntheticKey;
                            }
                        }
                    }

                    // If no JSON request body, synthesize a schema from parameters
                    // (query, form, path params displayed as JSON in the editor)
                    if (!entry.requestSchemaKey && Array.isArray(info.parameters) && info.parameters.length > 0) {
                        const syntheticKey = '_params_' + path.replace(/[^a-zA-Z0-9]/g, '_') + '_' + method.toLowerCase();
                        const props = {};
                        const required = [];
                        for (const param of info.parameters) {
                            if (!param.name) continue;
                            const propSchema = {};
                            if (param.schema) {
                                if (param.schema.type) propSchema.type = param.schema.type;
                                if (param.schema.enum) propSchema.enum = param.schema.enum;
                                if (param.schema.default !== undefined) propSchema.default = param.schema.default;
                            }
                            if (param.description) {
                                propSchema.description = param.description;
                            }
                            this._addMarkdownDescriptions(propSchema, param.name);
                            props[param.name] = propSchema;
                            if (param.required) required.push(param.name);
                        }
                        const syntheticSchema = {
                            type: 'object',
                            properties: props,
                            additionalProperties: false
                        };
                        if (required.length) syntheticSchema.required = required;

                        const uri = 'insign://schemas/' + syntheticKey;
                        this.schemas[syntheticKey] = { uri, schema: syntheticSchema };
                        entry.requestSchemaKey = syntheticKey;
                    }

                    // Extract response schema (first success response with content)
                    if (info.responses) {
                        for (const [code, resp] of Object.entries(info.responses)) {
                            if (!(code.startsWith('2') || code === 'default')) continue;
                            if (!resp?.content) continue;

                            // Try all content types, prefer application/json
                            const respSchema = resp.content['application/json']?.schema
                                || resp.content['*/*']?.schema;
                            if (!respSchema) continue;

                            if (respSchema['$ref'] && respSchema['$ref'].startsWith('#/components/schemas/')) {
                                entry.responseSchemaKey = this._toCamelCase(respSchema['$ref'].substring('#/components/schemas/'.length));
                                break;
                            }

                            // Inline response schema - synthesize and register it
                            if (respSchema.properties || respSchema.type || respSchema.allOf || respSchema.oneOf) {
                                const syntheticKey = '_resp_' + path.replace(/[^a-zA-Z0-9]/g, '_') + '_' + method.toLowerCase();
                                const converted = this._convertRefs(structuredClone(respSchema));
                                this._addMarkdownDescriptions(converted);
                                const uri = 'insign://schemas/' + syntheticKey;
                                this.schemas[syntheticKey] = { uri, schema: converted };
                                entry.responseSchemaKey = syntheticKey;
                                break;
                            }
                        }
                    }

                    this.paths[path][method.toLowerCase()] = entry;
                }
            }
        }
    }

    /**
     * Look up a description for a given API path and method.
     * Returns { summary, description, requestSchemaKey, responseSchemaKey } or null.
     * Handles paths with query strings by stripping them for lookup.
     */
    getPathInfo(path, method) {
        const cleanPath = path.split('?')[0];
        const entry = this.paths[cleanPath];
        if (!entry) return null;
        const m = (method || 'post').toLowerCase();
        return entry[m] || Object.values(entry)[0] || null;
    }

    /**
     * Look up the response schema key for an API path and method.
     * @returns {string|null} camelCase schema key or null
     */
    getResponseSchemaKey(path, method) {
        const info = this.getPathInfo(path, method);
        return info?.responseSchemaKey || null;
    }

    /**
     * Look up the request schema key for an API path and method.
     * @returns {string|null} camelCase schema key or null
     */
    getRequestSchemaKey(path, method) {
        const info = this.getPathInfo(path, method);
        return info?.requestSchemaKey || null;
    }

    /**
     * Resolve a dotted JSON property path to a schema description.
     * E.g. for schemaKey "sessionStatus" and path "documents[0].id",
     * walk through the schema tree following properties/items/$ref.
     * @param {string} schemaKey - The camelCase schema key
     * @param {string} propPath - Dotted/bracketed path like "documents[0].name"
     * @returns {{ description: string, markdownDescription: string, type: string }|null}
     */
    resolvePropertyDescription(schemaKey, propPath) {
        if (!schemaKey || !propPath) return null;
        const entry = this.schemas[schemaKey];
        if (!entry) return null;

        const segments = propPath.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
        let current = entry.schema;

        for (const seg of segments) {
            if (!current) return null;

            // Resolve $ref
            current = this._resolveRef(current);
            if (!current) return null;

            // If segment is a number, follow items (array index)
            if (/^\d+$/.test(seg)) {
                current = current.items ? this._resolveRef(current.items) : null;
                continue;
            }

            // If current is an array type without explicit index, auto-follow items
            if (current.type === 'array' && current.items && !current.properties) {
                current = this._resolveRef(current.items);
                if (!current) return null;
            }

            // Follow properties
            if (current.properties && current.properties[seg]) {
                current = current.properties[seg];
            } else if (current.additionalProperties && typeof current.additionalProperties === 'object') {
                current = current.additionalProperties;
            } else {
                return null;
            }
        }

        if (!current) return null;
        current = this._resolveRef(current);
        if (!current) return null;

        return {
            description: current.description || null,
            markdownDescription: current.markdownDescription || null,
            type: current.type || null,
            enum: current.enum || null
        };
    }

    /**
     * Resolve a $ref to the actual schema object.
     * @param {object} schema
     * @returns {object|null}
     */
    _resolveRef(schema) {
        if (!schema || typeof schema !== 'object') return schema;
        if (!schema['$ref']) return schema;
        const ref = schema['$ref'];
        // insign://schemas/fooBar -> fooBar
        if (ref.startsWith('insign://schemas/')) {
            const key = ref.substring('insign://schemas/'.length);
            return this.schemas[key]?.schema || null;
        }
        return schema;
    }

    /**
     * Get all top-level property names and descriptions for a schema.
     * Used for building tooltip lookup maps.
     * @param {string} schemaKey
     * @returns {Object<string, { description: string, type: string }>|null}
     */
    getSchemaProperties(schemaKey) {
        if (!schemaKey) return null;
        const entry = this.schemas[schemaKey];
        if (!entry?.schema) return null;

        const schema = this._resolveRef(entry.schema);
        if (!schema?.properties) return null;

        const result = {};
        for (const [key, prop] of Object.entries(schema.properties)) {
            const resolved = this._resolveRef(prop) || prop;
            result[key] = {
                description: resolved.description || '',
                markdownDescription: resolved.markdownDescription || '',
                type: resolved.type || (resolved.enum ? 'enum' : ''),
                enum: resolved.enum || null
            };
        }
        return result;
    }
};
