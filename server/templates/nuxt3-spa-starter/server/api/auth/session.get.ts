// This endpoint handles session validation by forwarding the session token to the third-party API
// The third-party API endpoint is ${process.env.NUXT_PUBLIC_API_BASE_URL}/api/v1/auth/session

import { defineEventHandler, getCookie, getHeader, createError } from 'h3';
import { $fetch } from 'ofetch';
import { useRuntimeConfig } from '#imports';
import { resolveApiBaseUrl, isPreviewMode } from '../../utils/api-url';

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

export default defineEventHandler(async (event) => {
    try {
        // Server-only base URL — can be absolute in preview mode so $fetch works
        const config = useRuntimeConfig();

        // Preview mode: no external API available, return mock session immediately.
        // This bypasses cookie/header checks so preview login works reliably in iframe.
        if (isPreviewMode(config)) {
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
        if (!sessionToken) {
            const authHeader = getHeader(event, 'authorization') || '';
            const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
            if (bearerMatch) {
                sessionToken = bearerMatch[1];
            }
        }

        if (!sessionToken) {
            throw createError({
                statusCode: 401,
                statusMessage: 'Unauthorized',
                message: 'No session token found'
            });
        }

        const apiBaseUrl = resolveApiBaseUrl(config.apiBaseUrl || config.public.baseAPI);

        if (!apiBaseUrl) {
            throw createError({
                statusCode: 500,
                statusMessage: 'Server Error',
                message: 'API base URL not configured'
            });
        }

        // Make the request to the third-party API to validate the session
        const response = await $fetch<SessionResponse>(`${apiBaseUrl}/api/v1/auth/session`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${sessionToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        // Return the session data
        return response;
    } catch (error: unknown) {
        // Handle errors from the third-party API
        console.error('Session validation error:', error);

        // Forward the error status and message
        const err = error as ErrorResponse;
        throw createError({
            statusCode: err.response?.status || 500,
            statusMessage: err.response?.statusText || 'Internal Server Error',
            message: err.response?.data?.message || 'An error occurred during session validation'
        });
    }
});