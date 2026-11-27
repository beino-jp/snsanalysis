import { defineCloudflareConfig } from '@opennextjs/cloudflare';
// No external cache resources are created during build.
export default defineCloudflareConfig({incrementalCache:'dummy',tagCache:'dummy',queue:'dummy'});
