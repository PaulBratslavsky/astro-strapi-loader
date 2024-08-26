export async function fetchStrapi(method: string, path: string, payload?: any) {
  const baseUrl = import.meta.env.PUBLIC_STRAPI_URL || "http://localhost:1337";
  const url = new URL(path, baseUrl);

  const authToken = false;

  const headers: any = {
    "Content-Type": "application/json",
  };

  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  return fetch(url.href, {
    method: method,
    headers,
    body: payload
      ? JSON.stringify({
          data: payload,
        })
      : undefined,
  });
}
