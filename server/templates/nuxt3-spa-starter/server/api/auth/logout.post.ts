import { resolveApiBaseUrl } from '../utils/api-url';

export default defineEventHandler(async (event) => {
  try {
    const config = useRuntimeConfig();
    const baseUrl = resolveApiBaseUrl(config.apiBaseUrl || config.public.baseAPI);

    // Preview mode: no external API available, return mock response
    if (baseUrl.includes('127.0.0.1') || baseUrl.includes('localhost')) {
      return { status: 'success', message: 'Logged out (preview)' };
    }

    const body = await readBody(event);

    const res: any = await $fetch(`${baseUrl}/api/logout`, {
      method: "POST",
      body,
    });

    return { ...res };
  } catch (error: any) {
    throw createError({
      statusCode: error.data?.code || 500,
      statusMessage: error.data?.message || 'Logout failed',
    });
  }
});
