import {
  IAuthenticateGeneric,
  ICredentialDataDecryptedObject,
  ICredentialTestRequest,
  ICredentialType,
  IHttpRequestHelper,
  IHttpRequestOptions,
  INodeProperties,
} from 'n8n-workflow';

export class InsignApi implements ICredentialType {
  name = 'insignApi';
  displayName = 'inSign API';
  documentationUrl = 'https://getinsign.github.io/insign-getting-started/explorer.html';

  properties: INodeProperties[] = [
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: 'https://sandbox.test.getinsign.show',
      description: 'Sandbox: https://sandbox.test.getinsign.show. Production: your tenant URL.',
      placeholder: 'https://sandbox.test.getinsign.show',
    },
    {
      displayName: 'Client ID',
      name: 'clientId',
      type: 'string',
      default: 'controller',
      description: 'OAuth2 client_id. Sandbox default: "controller".',
    },
    {
      displayName: 'Client Secret',
      name: 'clientSecret',
      type: 'string',
      typeOptions: { password: true },
      default: 'pwd.insign.sandbox.4561',
      description: 'OAuth2 client_secret. Sandbox default: "pwd.insign.sandbox.4561".',
    },
    {
      displayName: 'Webhook HMAC Secret (Optional)',
      name: 'webhookSecret',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      description:
        'Shared secret used to sign/verify inSign webhook callbacks. When set, the Create Session node appends an HMAC signature to the serverSidecallbackURL, and the inSign Trigger rejects calls whose signature does not match. Leave empty to disable signing.',
    },
    // sessionToken is populated by preAuthentication() and used by the
    // authenticate() expression below. Hidden from the credential UI.
    {
      displayName: 'Session Token',
      name: 'sessionToken',
      type: 'hidden',
      default: '',
    },
  ];

  // Fetches a Bearer token via the OAuth2 Client Credentials grant.
  // n8n caches the result and re-runs this when the cached credential
  // expires or an authenticated request returns 401.
  async preAuthentication(
    this: IHttpRequestHelper,
    credentials: ICredentialDataDecryptedObject,
  ): Promise<{ sessionToken: string }> {
    const baseUrl = (credentials.baseUrl as string).replace(/\/+$/, '');
    const options: IHttpRequestOptions = {
      method: 'POST',
      url: `${baseUrl}/oauth2/token`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: credentials.clientId as string,
        client_secret: credentials.clientSecret as string,
      }).toString(),
    };
    const res = (await this.helpers.httpRequest(options)) as { access_token?: string };
    if (!res?.access_token) {
      throw new Error('inSign /oauth2/token did not return an access_token');
    }
    return { sessionToken: res.access_token };
  }

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: {
        Authorization: '=Bearer {{$credentials.sessionToken}}',
      },
    },
  };

  // The test calls /oauth2/token directly so it verifies the client credentials
  // themselves, independent of whether preAuthentication has run yet.
  test: ICredentialTestRequest = {
    request: {
      baseURL: '={{$credentials.baseUrl}}',
      url: '/oauth2/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        // explicitly drop the Bearer header from authenticate() — the token
        // endpoint must not receive a partial "Bearer " value
        Authorization: '',
      },
      body:
        '=grant_type=client_credentials&client_id={{$credentials.clientId}}&client_secret={{$credentials.clientSecret}}',
    },
    rules: [
      {
        type: 'responseSuccessBody',
        properties: {
          key: 'error',
          value: 'invalid_client',
          message:
            'inSign rejected the client credentials (error=invalid_client). Double-check Client ID and Client Secret against your tenant config.',
        },
      },
      {
        type: 'responseSuccessBody',
        properties: {
          key: 'error',
          value: 'unauthorized_client',
          message:
            'inSign rejected the client grant (error=unauthorized_client). The client is not allowed to use the client_credentials grant for this tenant.',
        },
      },
    ],
  };
}
