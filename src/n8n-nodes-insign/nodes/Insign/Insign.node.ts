import {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';
import { randomUUID } from 'crypto';

import { insignRequest, mergeAdditionalFields, RequestExtras, RequestMeta } from './GenericFunctions';

function sniffMime(buf: Buffer): string {
  if (buf.length >= 4 && buf.slice(0, 4).toString() === '%PDF') return 'application/pdf';
  if (buf.length >= 2 && buf[0] === 0x50 && buf[1] === 0x4b) return 'application/zip';
  return 'application/octet-stream';
}

function buildSignedWebhookUrl(baseUrl: string, correlationId: string, secret: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set('cid', correlationId);
  if (secret) {
    const crypto = require('crypto');
    const sig = crypto.createHmac('sha256', secret).update(correlationId).digest('hex');
    url.searchParams.set('sig', sig);
  }
  return url.toString();
}

const ADDITIONAL_FIELDS: any = {
  displayName: 'Additional Fields (JSON)',
  name: 'additionalFields',
  type: 'json',
  default: '{}',
  description:
    'Free-form JSON merged into the request body. Use this for guiProperties, branding, or any inSign field not exposed above.',
};

export class Insign implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'inSign',
    name: 'insign',
    icon: 'file:insign.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: 'Interact with the inSign electronic signature API',
    defaults: { name: 'inSign' },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [{ name: 'insignApi', required: true }],
    properties: [
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        default: 'createSession',
        options: [
          { name: 'Create Session', value: 'createSession', action: 'Create a session with a document', description: 'POST /configure/session with the document inlined as base64' },
          { name: 'Get Status', value: 'getStatus', action: 'Get full session status', description: 'POST /get/status' },
          { name: 'Check Status', value: 'checkStatus', action: 'Lightweight status check', description: 'POST /get/checkstatus' },
          { name: 'Send Reminder', value: 'sendReminder', action: 'Send a manual reminder to the signer', description: 'POST /load/sendManualReminder' },
          { name: 'Make Extern', value: 'makeExtern', action: 'Hand session to external signers', description: 'POST /extern/beginmulti' },
          { name: 'Abort Extern', value: 'abortExtern', action: 'Abort external signing', description: 'POST /extern/abort' },
          { name: 'Download Signed Documents', value: 'download', action: 'Download signed PDFs', description: 'POST /get/documents/download' },
          { name: 'Get Audit Trail', value: 'getAudit', action: 'Get the audit trail as JSON', description: 'POST /get/audit' },
          { name: 'Purge Session', value: 'purge', action: 'Delete a session permanently', description: 'POST /persistence/purge (irreversible)' },
        ],
      },

      // ── Create Session ─────────────────────────────────────────────
      {
        displayName: 'Display Name',
        name: 'displayName',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { operation: ['createSession'] } },
        description: 'Human-readable name shown in the inSign UI',
      },
      {
        displayName: 'Binary Property (Document)',
        name: 'binaryPropertyName',
        type: 'string',
        default: 'data',
        required: true,
        displayOptions: { show: { operation: ['createSession'] } },
        description: 'Name of the binary property on the input item containing the PDF. Sent inline as base64.',
      },
      {
        displayName: 'Document Display Name',
        name: 'documentDisplayName',
        type: 'string',
        default: '',
        displayOptions: { show: { operation: ['createSession'] } },
        description: 'Optional display name for the document. Defaults to the binary file name.',
      },
      {
        displayName: 'Scan Signature Tags',
        name: 'scanSigTags',
        type: 'boolean',
        default: true,
        displayOptions: { show: { operation: ['createSession'] } },
        description: 'Whether to scan the PDF for signature tags',
      },
      {
        displayName: 'Allow Form Editing',
        name: 'allowFormEditing',
        type: 'boolean',
        default: true,
        displayOptions: { show: { operation: ['createSession'] } },
      },
      {
        displayName: 'Upload Enabled',
        name: 'uploadEnabled',
        type: 'boolean',
        default: false,
        displayOptions: { show: { operation: ['createSession'] } },
        description: 'Whether the signer may upload extra documents',
      },
      {
        displayName: 'For User',
        name: 'forUser',
        type: 'string',
        default: '',
        displayOptions: { show: { operation: ['createSession'] } },
        description:
          'User/session identifier inside your inSign account. Leave empty to auto-generate one.',
      },
      {
        displayName: 'User Full Name',
        name: 'userFullName',
        type: 'string',
        default: '',
        displayOptions: { show: { operation: ['createSession'] } },
      },

      // ── Common session behavior toggles (prominent) ────────────────
      {
        displayName: 'Auto-Finish on Last Signature',
        name: 'workflowFinishAfterLastSign',
        type: 'boolean',
        default: false,
        displayOptions: { show: { operation: ['createSession'] } },
        description:
          'When on, the session completes automatically as soon as the last mandatory signature lands. Maps to workflowFinishAfterLastSign.',
      },
      {
        displayName: 'Auto-Complete on External Finish',
        name: 'externCompleteOnFinish',
        type: 'boolean',
        default: false,
        displayOptions: { show: { operation: ['createSession'] } },
        description:
          'When on, the session is marked complete as soon as the external signer presses Done. Maps to externCompleteOnFinish.',
      },
      {
        displayName: 'Email Signed Docs to External',
        name: 'externSendDocsOnFinishCustomer',
        type: 'boolean',
        default: false,
        displayOptions: { show: { operation: ['createSession'] } },
        description:
          'Whether the external signer receives the signed PDFs by email once the session is completed. Maps to externSendDocsOnFinishCustomer.',
      },
      {
        displayName: 'Download Link in Emails',
        name: 'documentEmailDownload',
        type: 'boolean',
        default: false,
        displayOptions: { show: { operation: ['createSession'] } },
        description:
          'Include a signed-documents download link in the notification emails. Maps to documentEmailDownload.',
      },
      {
        displayName: 'Skip Finish Modal (Owner)',
        name: 'skipFinishModal',
        type: 'boolean',
        default: false,
        displayOptions: { show: { operation: ['createSession'] } },
        description:
          'When on, clicking Done does not show the consultant confirmation dialog. Merged into guiProperties.guiFertigbuttonSkipModalDialog.',
      },
      {
        displayName: 'Skip Finish Modal (External)',
        name: 'skipFinishModalExtern',
        type: 'boolean',
        default: false,
        displayOptions: { show: { operation: ['createSession'] } },
        description:
          'Same as above but for the external signer. Merged into guiProperties.guiFertigbuttonSkipModalDialogExtern.',
      },
      {
        displayName: 'External User Guidance',
        name: 'externUserGuidance',
        type: 'boolean',
        default: true,
        displayOptions: { show: { operation: ['createSession'] } },
        description:
          'Step-by-step arrows and highlights for external signers. Maps to externUserGuidance.',
      },

      // ── GDPR / legal links ─────────────────────────────────────────
      {
        displayName: 'GDPR Consent Popup',
        name: 'gdprPopupActive',
        type: 'boolean',
        default: false,
        displayOptions: { show: { operation: ['createSession'] } },
        description:
          'Show the GDPR / DSGVO consent dialog before signing. Maps to gdprPopupActive.',
      },
      {
        displayName: 'Privacy Policy URL',
        name: 'privacyLink',
        type: 'string',
        default: '',
        placeholder: 'https://example.com/privacy',
        displayOptions: { show: { operation: ['createSession'] } },
        description: 'Privacy link shown to the signer. Maps to privacyLink.',
      },
      {
        displayName: 'Imprint URL',
        name: 'imprintLink',
        type: 'string',
        default: '',
        placeholder: 'https://example.com/imprint',
        displayOptions: { show: { operation: ['createSession'] } },
        description: 'Imprint link shown to the signer. Maps to imprintLink.',
      },

      // ── Branding ───────────────────────────────────────────────────
      {
        displayName: 'External CSS / Properties URL',
        name: 'externalPropertiesURL',
        type: 'string',
        default: '',
        placeholder: 'https://example.com/insign-branding.css',
        displayOptions: { show: { operation: ['createSession'] } },
        description:
          'URL to an external CSS or properties file for custom branding. Maps to externalPropertiesURL.',
      },

      // ── Webhook / correlation ──────────────────────────────────────
      {
        displayName: 'Correlation ID',
        name: 'correlationId',
        type: 'string',
        default: '',
        displayOptions: { show: { operation: ['createSession'] } },
        description:
          'Your own identifier for this session, round-tripped through customInfo and echoed back in the webhook callback (cid query param). Leave empty to auto-generate. Use it to correlate n8n runs with inSign events.',
      },
      {
        displayName: 'Browser Callback URL',
        name: 'callbackURL',
        type: 'string',
        default: '',
        placeholder: 'https://your-n8n.example.com/webhook/signed-thanks',
        displayOptions: { show: { operation: ['createSession'] } },
        description:
          'URL the browser navigates to once the signer presses Done. Typically a "thank you" page. This is the inSign `callbackURL` field — runs in the signer\'s browser, separate from the server-side webhook below.',
      },
      {
        displayName: 'Server-Side Webhook URL',
        name: 'serverSidecallbackURL',
        type: 'string',
        default: '',
        placeholder: 'https://your-n8n.example.com/webhook/insign',
        displayOptions: { show: { operation: ['createSession'] } },
        description:
          'Paste the **Production URL** from your inSign Trigger node here. inSign will GET this URL on every session event. The node appends `?cid=<correlationId>&sig=<hmac>` (if a Webhook HMAC Secret is configured on the credential) so the inSign Trigger can authenticate the call.',
      },

      {
        ...ADDITIONAL_FIELDS,
        displayOptions: { show: { operation: ['createSession'] } },
      },

      // ── sessionId-only operations ──────────────────────────────────
      {
        displayName: 'Session ID',
        name: 'sessionId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: {
            operation: ['getStatus', 'checkStatus', 'sendReminder', 'makeExtern', 'abortExtern', 'download', 'getAudit', 'purge'],
          },
        },
      },

      // ── Send Reminder additional fields ────────────────────────────
      {
        ...ADDITIONAL_FIELDS,
        displayOptions: { show: { operation: ['sendReminder'] } },
      },

      // ── Make Extern ────────────────────────────────────────────────
      {
        displayName: 'Extern Users',
        name: 'externUsers',
        placeholder: 'Add Signer',
        type: 'fixedCollection',
        typeOptions: { multipleValues: true },
        default: {},
        required: true,
        displayOptions: { show: { operation: ['makeExtern'] } },
        description: 'At least one external signer must be supplied.',
        options: [
          {
            name: 'user',
            displayName: 'Signer',
            values: [
              { displayName: 'Recipient (Email)', name: 'recipient', type: 'string', default: '', required: true, description: 'The signer\'s email address. Required by inSign.' },
              { displayName: 'Real Name', name: 'realName', type: 'string', default: '' },
              { displayName: 'Phone (SMS)', name: 'recipientsms', type: 'string', default: '', description: 'Phone number for SMS delivery. Required if Send SMS is on.' },
              { displayName: 'Role Type', name: 'roletype', type: 'options', default: 'signer', options: [
                { name: 'Signer', value: 'signer' },
                { name: 'Owner', value: 'owner' },
              ] },
              { displayName: 'Send Email', name: 'sendEmails', type: 'boolean', default: true, description: 'Whether inSign should email the invitation/access link to this signer. Maps to externUsers[].sendEmails.' },
              { displayName: 'Send SMS', name: 'sendSMS', type: 'boolean', default: false, description: 'Whether inSign should SMS the invitation/access link. Maps to externUsers[].sendSMS. Requires Phone (SMS) to be set.' },
              { displayName: 'Note', name: 'note', type: 'string', default: '', description: 'Personal note included in the invitation email.' },
            ],
          },
        ],
      },
      {
        ...ADDITIONAL_FIELDS,
        displayOptions: { show: { operation: ['makeExtern'] } },
      },

      // ── Download: output shape + binary property ───────────────────
      {
        displayName: 'Output Mode',
        name: 'downloadOutputMode',
        type: 'options',
        default: 'auto',
        displayOptions: { show: { operation: ['download'] } },
        options: [
          {
            name: 'Auto (whatever inSign returned)',
            value: 'auto',
            description: 'Emit the raw response body — PDF if single doc, ZIP if multi-doc',
          },
          {
            name: 'ZIP (always)',
            value: 'zip',
            description: 'Emit a ZIP archive. A single PDF is wrapped into a one-file ZIP.',
          },
          {
            name: 'Single Files (unzipped)',
            value: 'files',
            description:
              'One output item per document. A single PDF is emitted as-is; a ZIP is unpacked into one item per entry.',
          },
        ],
      },
      {
        displayName: 'Put Output In Binary Property',
        name: 'outputBinaryProperty',
        type: 'string',
        default: 'data',
        required: true,
        displayOptions: { show: { operation: ['download'] } },
      },

      // ── Purge warning ──────────────────────────────────────────────
      {
        displayName: 'Purging a session is irreversible. All documents, audit data, and signatures will be permanently deleted.',
        name: 'purgeNotice',
        type: 'notice',
        default: '',
        displayOptions: { show: { operation: ['purge'] } },
      },

      // ── Global options (shown for every operation) ─────────────────
      {
        displayName: 'Options',
        name: 'requestOptions',
        type: 'collection',
        placeholder: 'Add option',
        default: {},
        options: [
          {
            displayName: 'Request Timeout (Ms)',
            name: 'timeout',
            type: 'number',
            typeOptions: { minValue: 1000, maxValue: 300000 },
            default: 30000,
            description: 'How long to wait for the inSign API before giving up',
          },
          {
            displayName: 'Trace ID',
            name: 'traceId',
            type: 'string',
            default: '',
            description:
              'Custom X-Request-Id header sent to inSign. Leave empty to auto-generate. Useful for correlating n8n runs with inSign server logs.',
          },
          {
            displayName: 'Include Request Metadata',
            name: 'includeMeta',
            type: 'boolean',
            default: false,
            description:
              'Whether to add a `_meta` object to each output item containing the traceId, duration, method, and path. Handy for debugging.',
          },
        ],
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const out: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      const operation = this.getNodeParameter('operation', i) as string;
      const reqOpts = this.getNodeParameter('requestOptions', i, {}) as {
        timeout?: number;
        traceId?: string;
        includeMeta?: boolean;
      };
      const extras: RequestExtras = { timeout: reqOpts.timeout, traceId: reqOpts.traceId };
      const withMeta = (json: Record<string, unknown>, meta: RequestMeta): IDataObject =>
        (reqOpts.includeMeta ? { ...json, _meta: meta } : json) as unknown as IDataObject;

      try {
        if (operation === 'createSession') {
          const binaryProp = this.getNodeParameter('binaryPropertyName', i) as string;
          const binary = this.helpers.assertBinaryData(i, binaryProp);
          const buffer = await this.helpers.getBinaryDataBuffer(i, binaryProp);
          const base64 = buffer.toString('base64');

          const autoId = () => `n8n-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const document: Record<string, unknown> = {
            id: autoId(),
            displayname: (this.getNodeParameter('documentDisplayName', i) as string) || binary.fileName || 'document.pdf',
            file: base64,
            scanSigTags: this.getNodeParameter('scanSigTags', i) as boolean,
            allowFormEditing: this.getNodeParameter('allowFormEditing', i) as boolean,
          };

          const body: Record<string, unknown> = {
            displayname: this.getNodeParameter('displayName', i) as string,
            // foruser is required by inSign — always populate it.
            // Use crypto.randomUUID() when the user leaves the field empty so
            // every session has a stable, well-formed identifier.
            foruser: ((this.getNodeParameter('forUser', i) as string) || '').trim() || randomUUID(),
            documents: [document],
            uploadEnabled: this.getNodeParameter('uploadEnabled', i) as boolean,
          };

          const userFullName = this.getNodeParameter('userFullName', i, '') as string;
          if (userFullName) body.userFullName = userFullName;

          // Prominent behavior toggles → root fields
          const rootBooleans: Array<[string, string]> = [
            ['workflowFinishAfterLastSign', 'workflowFinishAfterLastSign'],
            ['externCompleteOnFinish', 'externCompleteOnFinish'],
            ['externSendDocsOnFinishCustomer', 'externSendDocsOnFinishCustomer'],
            ['documentEmailDownload', 'documentEmailDownload'],
            ['externUserGuidance', 'externUserGuidance'],
            ['gdprPopupActive', 'gdprPopupActive'],
          ];
          for (const [paramName, apiName] of rootBooleans) {
            const val = this.getNodeParameter(paramName, i, undefined) as boolean | undefined;
            if (val !== undefined) body[apiName] = val;
          }

          const rootStrings: Array<[string, string]> = [
            ['privacyLink', 'privacyLink'],
            ['imprintLink', 'imprintLink'],
            ['externalPropertiesURL', 'externalPropertiesURL'],
            ['callbackURL', 'callbackURL'],
          ];
          for (const [paramName, apiName] of rootStrings) {
            const val = (this.getNodeParameter(paramName, i, '') as string) || '';
            if (val) body[apiName] = val;
          }

          // Correlation ID + signed webhook URL
          const correlationId =
            ((this.getNodeParameter('correlationId', i, '') as string) || '').trim() || autoId();
          body.customInfo = correlationId;
          const webhookUrl = ((this.getNodeParameter('serverSidecallbackURL', i, '') as string) || '').trim();
          if (webhookUrl) {
            const creds = await this.getCredentials('insignApi');
            const secret = (creds.webhookSecret as string) || '';
            const signed = buildSignedWebhookUrl(webhookUrl, correlationId, secret);
            body.serverSidecallbackURL = signed;
          }

          // Skip-modal toggles → guiProperties.*
          const guiProps: Record<string, unknown> = {};
          if (this.getNodeParameter('skipFinishModal', i, false) as boolean) {
            guiProps.guiFertigbuttonSkipModalDialog = true;
          }
          if (this.getNodeParameter('skipFinishModalExtern', i, false) as boolean) {
            guiProps.guiFertigbuttonSkipModalDialogExtern = true;
          }
          if (Object.keys(guiProps).length > 0) body.guiProperties = guiProps;

          const extra = this.getNodeParameter('additionalFields', i) as string | object;
          const merged = mergeAdditionalFields(body, extra);

          const { data, meta } = await insignRequest.call(this, 'POST', '/configure/session', merged, 'json', extras);
          out.push({ json: withMeta(data, meta), pairedItem: { item: i } });
          continue;
        }

        const sessionId = this.getNodeParameter('sessionId', i) as string;

        if (operation === 'getStatus') {
          const { data, meta } = await insignRequest.call(this, 'POST', '/get/status', { sessionid: sessionId }, 'json', extras);
          out.push({ json: withMeta(data, meta), pairedItem: { item: i } });
        } else if (operation === 'checkStatus') {
          const { data, meta } = await insignRequest.call(this, 'POST', '/get/checkstatus', { sessionid: sessionId }, 'json', extras);
          out.push({ json: withMeta(data, meta), pairedItem: { item: i } });
        } else if (operation === 'sendReminder') {
          const extra = this.getNodeParameter('additionalFields', i) as string | object;
          const body = mergeAdditionalFields({ sessionid: sessionId }, extra);
          const { data, meta } = await insignRequest.call(this, 'POST', '/load/sendManualReminder', body, 'json', extras);
          out.push({ json: withMeta(data, meta), pairedItem: { item: i } });
        } else if (operation === 'makeExtern') {
          const externUsers = (this.getNodeParameter('externUsers', i) as { user?: Array<Record<string, string>> }).user ?? [];
          const extra = this.getNodeParameter('additionalFields', i) as string | object;
          const body = mergeAdditionalFields({ sessionid: sessionId, externUsers }, extra);
          const { data, meta } = await insignRequest.call(this, 'POST', '/extern/beginmulti', body, 'json', extras);
          out.push({ json: withMeta(data, meta), pairedItem: { item: i } });
        } else if (operation === 'abortExtern') {
          const { data, meta } = await insignRequest.call(this, 'POST', '/extern/abort', { sessionid: sessionId }, 'json', extras);
          out.push({ json: withMeta(data, meta), pairedItem: { item: i } });
        } else if (operation === 'download') {
          const outProp = this.getNodeParameter('outputBinaryProperty', i) as string;
          const mode = this.getNodeParameter('downloadOutputMode', i) as 'auto' | 'zip' | 'files';
          const { data: res, meta } = await insignRequest.call(
            this,
            'POST',
            '/get/documents/download',
            { sessionid: sessionId },
            'arraybuffer',
            extras,
          );
          const body = Buffer.from(res.body as ArrayBuffer);
          const headers = (res.headers ?? {}) as Record<string, string>;
          const contentType = (headers['content-type'] || sniffMime(body)).split(';')[0].trim();
          const isZip = contentType === 'application/zip' || (body[0] === 0x50 && body[1] === 0x4b);

          if (mode === 'auto') {
            const ext = isZip ? 'zip' : 'pdf';
            const mime = isZip ? 'application/zip' : 'application/pdf';
            const binary = await this.helpers.prepareBinaryData(body, `${sessionId}.${ext}`, mime);
            out.push({
              json: withMeta({ sessionid: sessionId, size: body.length, contentType: mime }, meta),
              binary: { [outProp]: binary },
              pairedItem: { item: i },
            });
          } else if (mode === 'zip') {
            let zipBuffer: Buffer;
            if (isZip) {
              zipBuffer = body;
            } else {
              const JSZip = require('jszip');
              const zip = new JSZip();
              zip.file(`${sessionId}.pdf`, body);
              zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
            }
            const binary = await this.helpers.prepareBinaryData(zipBuffer, `${sessionId}.zip`, 'application/zip');
            out.push({
              json: withMeta({ sessionid: sessionId, size: zipBuffer.length, contentType: 'application/zip' }, meta),
              binary: { [outProp]: binary },
              pairedItem: { item: i },
            });
          } else if (mode === 'files') {
            if (!isZip) {
              const binary = await this.helpers.prepareBinaryData(body, `${sessionId}.pdf`, 'application/pdf');
              out.push({
                json: withMeta({ sessionid: sessionId, fileName: `${sessionId}.pdf`, size: body.length, contentType: 'application/pdf' }, meta),
                binary: { [outProp]: binary },
                pairedItem: { item: i },
              });
            } else {
              const JSZip = require('jszip');
              const zip = await JSZip.loadAsync(body);
              const entries = Object.values(zip.files as Record<string, any>).filter((e) => !e.dir);
              if (entries.length === 0) {
                throw new NodeOperationError(this.getNode(), `Downloaded ZIP for session ${sessionId} contained no files`);
              }
              for (const entry of entries) {
                const fileBuf: Buffer = await entry.async('nodebuffer');
                const mime = entry.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream';
                const binary = await this.helpers.prepareBinaryData(fileBuf, entry.name, mime);
                out.push({
                  json: withMeta({ sessionid: sessionId, fileName: entry.name, size: fileBuf.length, contentType: mime }, meta),
                  binary: { [outProp]: binary },
                  pairedItem: { item: i },
                });
              }
            }
          }
        } else if (operation === 'getAudit') {
          const { data, meta } = await insignRequest.call(this, 'POST', '/get/audit', { sessionid: sessionId }, 'json', extras);
          // Audit is an array of events — wrap it in an object so it fits n8n's json shape.
          const payload = Array.isArray(data) ? { sessionid: sessionId, events: data } : data;
          out.push({ json: withMeta(payload, meta), pairedItem: { item: i } });
        } else if (operation === 'purge') {
          const { data, meta } = await insignRequest.call(this, 'POST', '/persistence/purge', { sessionid: sessionId }, 'json', extras);
          out.push({ json: withMeta(data, meta), pairedItem: { item: i } });
        } else {
          throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
        }
      } catch (error) {
        if (this.continueOnFail()) {
          // Build a structured failure record so downstream IF / Set / Switch
          // nodes can branch on error code / message / response body cleanly.
          const errAny = error as any;
          const errResp = errAny?.errorResponse ?? errAny?.cause?.errorResponse ?? null;
          const httpStatus =
            errAny?.httpCode ?? errAny?.status ?? errAny?.cause?.response?.status ?? null;
          // Surface inSign's own {error, message} from HTTP-200 logical errors,
          // OR the full HTTP response body for transport-level failures.
          let insignError: unknown = null;
          let insignMessage: string | null = null;
          let responseBody: unknown = null;
          if (errResp && typeof errResp === 'object') {
            insignError = (errResp as any).error ?? null;
            insignMessage = (errResp as any).message ?? null;
            responseBody = errResp;
          } else {
            responseBody =
              errAny?.response?.body ??
              errAny?.response?.data ??
              errAny?.cause?.response?.body ??
              null;
          }
          out.push({
            json: {
              error: insignError as IDataObject[keyof IDataObject],
              message: insignMessage ?? (error as Error).message,
              httpStatus,
              responseBody: responseBody as IDataObject[keyof IDataObject],
              trace: errAny?.context?.traceId ?? null,
            } as IDataObject,
            pairedItem: { item: i },
          });
          continue;
        }
        throw error;
      }
    }

    return [out];
  }
}
