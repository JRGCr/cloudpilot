export async function onRequest(context) {
  return new Response('Hello from Pages Functions!', {
    headers: { 'content-type': 'text/plain' }
  });
}