// This endpoint handles session validation by forwarding the session token to the third-party API
// The third-party API endpoint is ${process.env.NUXT_PUBLIC_API_BASE_URL}/api/v1/auth/session

import { defineEventHandler, getCookie, getHeader, createError } from 'h3';
import { $fetch } from 'ofetch';
import { resolveApiBaseUrl } from '../../utils/api-url';

interface SessionResponse {
    status: string;
    data?: {
        user?: {
            id: string;
            email: string;
            name?: string;
            [key: string]: any;
        };
        companies?: Array<{
            id: string;
            name: string;
            [key: string]: any;
        }>;
        [key: string]: any;
    };
    [key: string]: any;
}

interface ErrorResponse {
    response?: {
        status?: number;
        statusText?: string;
        data?: {
            message?: string;
            [key: string]: any;
        };
        [key: string]: any;
    };
    [key: string]: any;
}

function isPreviewMode(): boolean {
    // Check env vars directly — more reliable than useRuntimeConfig() in preview builds
    const orbitPreview = process.env.ORBIT_PREVIEW;
    const nuxtPreview = process.env.NUXT_IS_PREVIEW;
    const isPreview = orbitPreview === 'true' || nuxtPreview === 'true';
    console.log(`[session] preview check: ORBIT_PREVIEW=${orbitPreview}, NUXT_IS_PREVIEW=${nuxtPreview}, result=${isPreview}`);
    return isPreview;
}

export default defineEventHandler(async (event) => {
    console.log('[session] handler invoked');
    try {
        // Preview mode: no external API available, return mock session immediately.
        // This must be the VERY FIRST check to avoid any external API calls in preview.
        if (isPreviewMode()) {
            console.log('[session] preview mode detected — returning mock session');
            return {
                status: 'success',
                data: {
                    user: { id: 'preview-user', email: 'preview@example.com', name: 'Preview User' },
                    companies: [{ id: 'preview-company', name: 'Preview Company' }]
                }
            };
        }

        // Get the session token from the cookie or Authorization header
        let sessionToken = getCookie(event, 'session_token');
        console.log(`[session] cookie session_token=${sessionToken ? 'present' : 'missing'}`);

        if (!sessionToken) {
            const authHeader = getHeader(event, 'authorization') || '';
            console.log(`[session] auth header=${authHeader ? 'present' : 'missing'}`);
            const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
            if (bearerMatch) {
                sessionToken = bearerMatch[1];
                console.log(`[session] extracted bearer token`);
            }
        }

        if (!sessionToken) {
            console.log('[session] no token found — returning 401');
            throw createError({
                statusCode: 401,
                statusMessage: 'Unauthorized',
                message: 'No session token found'
            });
        }

        const config = useRuntimeConfig();
        const apiBaseUrl = resolveApiBaseUrl(config.apiBaseUrl || config.public.baseAPI);
        console.log(`[session] apiBaseUrl=${apiBaseUrl}`);

        if (!apiBaseUrl) {
            throw createError({
                statusCode: 500,
                statusMessage: 'Server Error',
                message: 'API base URL not configured'
            });
        }

        // Make the request to the third-party API to validate the session
        console.log(`[session] forwarding to external API: ${apiBaseUrl}/api/v1/auth/session`);
        const response = await $fetch<SessionResponse>(`${apiBaseUrl}/api/v1/auth/session`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${sessionToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        console.log('[session] external API response received');
        return response;
    } catch (error: unknown) {
        console.error('[session] error:', error);

        const err = error as ErrorResponse;
        throw createError({
            statusCode: err.response?.status || 500,
            statusMessage: err.response?.statusText || 'Internal Server Error',
            message: err.response?.data?.message || 'An error occurred during session validation'
        });
    }
});
