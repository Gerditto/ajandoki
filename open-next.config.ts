import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// Az alkalmazás oldalai bejelentkezéshez kötöttek és dinamikusak, ezért nem kell
// fizetős (R2) gyorsítótár. Ha később lesz sok statikus tartalom, itt kapcsolható be.
export default defineCloudflareConfig({});
