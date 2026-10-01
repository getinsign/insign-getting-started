import {
  INodeType,
  INodeTypeDescription,
  IWebhookFunctions,
  IWebhookResponseData,
} from 'n8n-workflow';
import { createHmac, timingSafeEqual } from 'crypto';

export class InsignTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'inSign Trigger',
    name: 'insignTrigger',
    icon: 'file:insign.svg',
    group: ['trigger'],
    version: 1,
    description: 'Receive inSign webhook callbacks (session state changes, etc.)',
    defaults: { name: 'inSign Trigger' },
    inputs: [],
    outputs: ['main'],
    // One stable URL per n8n instance. Paste it once into your inSign webhook
    // configuration. It survives workflow edits and redeploys — inSign can
    // call it years after the session was created without re-registration.
    webhooks: [
      {
        name: 'default',
        httpMethod: 'POST',
        responseMode: 'onReceived',
        path: 'insign',
        isFullPath: false,
      },
    ],
    credentials: [
      { name: 'insignApi', required: false },
    ],
    properties: [
      {
        displayName:
          'This trigger receives inSign webhook callbacks on a <b>stable URL</b> that does not change when you edit the workflow. Copy the Production URL below and register it once in your inSign tenant (or proxy). inSign can call this URL years later — the trigger never re-registers itself.',
        name: 'notice',
        type: 'notice',
        default: '',
      },
      {
        displayName: 'Verify HMAC Signature',
        name: 'verifyHmac',
        type: 'boolean',
        default: true,
        description:
          'When on and the credential has a Webhook HMAC Secret set, calls without a valid `sig` query parameter are rejected with HTTP 403. Set the same secret on the inSign API credential used by the Create Session node.',
      },
      {
        displayName: 'Event ID Filter',
        name: 'eventIdFilter',
        type: 'string',
        default: '',
        description:
          'Comma-separated list of eventid values to emit (e.g. "SESSION_FINISHED,SESSION_EXPIRED"). Empty = emit all events.',
        placeholder: 'SESSION_FINISHED,SESSION_EXPIRED',
      },
      {
        displayName: 'Session ID Filter',
        name: 'sessionIdFilter',
        type: 'string',
        default: '',
        description: 'Only emit callbacks matching this sessionid. Empty = emit all sessions.',
      },
    ],
  };

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const body = (this.getBodyData() ?? {}) as Record<string, unknown>;
    const headers = this.getHeaderData() as Record<string, string>;
    const query = this.getQueryData() as Record<string, string>;
    const res = this.getResponseObject();

    // HMAC verification (if enabled and secret is present on credentials)
    const verify = this.getNodeParameter('verifyHmac', true) as boolean;
    if (verify) {
      let secret = '';
      try {
        const creds = await this.getCredentials('insignApi');
        secret = (creds?.webhookSecret as string) || '';
      } catch {
        /* no credential attached is fine — just skip verification */
      }
      if (secret) {
        const cid = String(query.cid ?? '');
        const sig = String(query.sig ?? '');
        if (!cid || !sig || !hmacMatches(secret, cid, sig)) {
          res.status(403).send('invalid signature');
          return { noWebhookResponse: true };
        }
      }
    }

    const eventid = (body.eventid ?? body.eventId ?? query.eventid) as string | undefined;
    const sessionid = (body.sessionid ?? body.sessionId ?? query.sessionid) as string | undefined;
    const correlationId = (query.cid as string | undefined) ?? undefined;
    const data = body.data;

    const eventFilter = (this.getNodeParameter('eventIdFilter', '') as string)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const sessionFilter = (this.getNodeParameter('sessionIdFilter', '') as string).trim();

    if (eventFilter.length && (!eventid || !eventFilter.includes(eventid))) {
      return { noWebhookResponse: false, workflowData: [[]] };
    }
    if (sessionFilter && sessionid !== sessionFilter) {
      return { noWebhookResponse: false, workflowData: [[]] };
    }

    return {
      workflowData: [
        [
          {
            json: {
              eventid: eventid ?? null,
              sessionid: sessionid ?? null,
              correlationId: correlationId ?? null,
              data: (data as any) ?? null,
              raw: body,
              headers,
              query,
              receivedAt: new Date().toISOString(),
            },
          },
        ],
      ],
    };
  }
}

function hmacMatches(secret: string, correlationId: string, providedHex: string): boolean {
  const expected = createHmac('sha256', secret).update(correlationId).digest();
  let providedBuf: Buffer;
  try {
    providedBuf = Buffer.from(providedHex, 'hex');
  } catch {
    return false;
  }
  if (providedBuf.length !== expected.length) return false;
  try {
    return timingSafeEqual(providedBuf, expected);
  } catch {
    return false;
  }
}
