import { resolveApiBaseUrl } from '../utils/api-url';

export default defineEventHandler(async (event) => {
  try {
    const baseUrl = resolveApiBaseUrl(useRuntimeConfig().public.baseAPI);

    const body = await readBody(event);

    const res: any = await $fetch(`${baseUrl}/api/logout`, {
      method: "POST",
      body,
    });

    return { ...res };
  } catch (error: any) {
    throw createError({
      statusCode: error.data.code,
      statusMessage: error.data.message,
    });
  }
});
