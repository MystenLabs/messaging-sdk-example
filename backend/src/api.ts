import { IncomingMessage, ServerResponse } from 'http';
import { ENOKI_PRIVATE_API_KEY, ENOKI_API_BASE } from './config.js';

/**
 * Parse JSON body from request
 */
async function parseRequestBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Send JSON response
 */
function sendJsonResponse(res: ServerResponse, statusCode: number, data: any) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

/**
 * POST /api/sponsor-transaction
 * Initial sponsorship request
 */
export async function handleSponsorTransaction(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (req.method !== 'POST') {
    sendJsonResponse(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const body = await parseRequestBody(req);
    const { transactionBlockKindBytes, network, zkLoginJwt } = body;

    if (!transactionBlockKindBytes || !network || !zkLoginJwt) {
      sendJsonResponse(res, 400, {
        error: 'Missing required fields: transactionBlockKindBytes, network, zkLoginJwt',
      });
      return;
    }

    // Call Enoki API to sponsor the transaction
    const enokiResponse = await fetch(`${ENOKI_API_BASE}/transaction-blocks/sponsor`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ENOKI_PRIVATE_API_KEY}`,
        'zklogin-jwt': zkLoginJwt,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        network,
        transactionBlockKindBytes,
      }),
    });

    if (!enokiResponse.ok) {
      const errorText = await enokiResponse.text();
      console.error('Enoki API error:', errorText);
      sendJsonResponse(res, enokiResponse.status, {
        error: 'Failed to sponsor transaction',
        details: errorText,
      });
      return;
    }

    const enokiData = await enokiResponse.json();
    sendJsonResponse(res, 200, enokiData);
  } catch (error) {
    console.error('Error in handleSponsorTransaction:', error);
    sendJsonResponse(res, 500, {
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}

/**
 * POST /api/sponsor-transaction/:digest
 * Submit user signature for final sponsorship
 */
export async function handleSponsorTransactionFinalize(
  req: IncomingMessage,
  res: ServerResponse,
  digest: string
): Promise<void> {
  if (req.method !== 'POST') {
    sendJsonResponse(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const body = await parseRequestBody(req);
    const { signature, zkLoginJwt } = body;

    if (!signature || !zkLoginJwt) {
      sendJsonResponse(res, 400, {
        error: 'Missing required fields: signature, zkLoginJwt',
      });
      return;
    }

    // Call Enoki API to finalize the sponsored transaction
    const enokiResponse = await fetch(`${ENOKI_API_BASE}/transaction-blocks/sponsor/${digest}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ENOKI_PRIVATE_API_KEY}`,
        'zklogin-jwt': zkLoginJwt,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        signature,
      }),
    });

    if (!enokiResponse.ok) {
      const errorText = await enokiResponse.text();
      console.error('Enoki API error:', errorText);
      sendJsonResponse(res, enokiResponse.status, {
        error: 'Failed to finalize sponsored transaction',
        details: errorText,
      });
      return;
    }

    const enokiData = await enokiResponse.json();
    sendJsonResponse(res, 200, enokiData);
  } catch (error) {
    console.error('Error in handleSponsorTransactionFinalize:', error);
    sendJsonResponse(res, 500, {
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}
