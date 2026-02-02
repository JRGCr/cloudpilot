export async function onRequest(context) {
  console.log('[CF-HELLO] Hello function called');
  return new Response('Hello from Pages Functions!', {
    headers: { 'content-type': 'text/plain' }
  });
}