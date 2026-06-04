import { setCookie, createError } from 'h3';
import { resolveApiBaseUrl } from '../utils/api-url';

export default defineEventHandler(async (event) => {
  try {
    const config = useRuntimeConfig();
    const baseUrl = resolveApiBaseUrl(config.apiBaseUrl || config.public.baseAPI);

    // Preview mode: no external API available, return mock response
    const isPreview = process.env.ORBIT_PREVIEW === 'true' || process.env.NUXT_IS_PREVIEW === 'true';
    console.log(`[logout] preview check: ORBIT_PREVIEW=${process.env.ORBIT_PREVIEW}, NUXT_IS_PREVIEW=${process.env.NUXT_IS_PREVIEW}, result=${isPreview}`);
    if (isPreview) {
      const basePath = process.env.NUXT_APP_BASE_URL || '/';
      const cookiePath = basePath.endsWith('/') ? basePath : basePath + '/';
      // Clear cookie by setting maxAge to 0
      setCookie(event, 'session_token', '', { httpOnly: true, path: cookiePath, maxAge: 0 });
      console.log(`[logout] preview mode — cleared session_token cookie at path=${cookiePath}`);
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
