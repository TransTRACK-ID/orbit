import { deleteCookie } from 'h3';
import { resolveApiBaseUrl, isPreviewMode } from '../utils/api-url';

export default defineEventHandler(async (event) => {
  try {
    const config = useRuntimeConfig();
    const baseUrl = resolveApiBaseUrl(config.apiBaseUrl || config.public.baseAPI);

    // Preview mode: no external API available, return mock response
    if (isPreviewMode(config)) {
      const basePath = process.env.NUXT_APP_BASE_URL || '/';
      const cookiePath = basePath.endsWith('/') ? basePath : basePath + '/';
      deleteCookie(event, 'session_token', { path: cookiePath });
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
