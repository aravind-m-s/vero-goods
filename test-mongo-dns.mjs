// test-mongo-dns.mjs

import dns from 'node:dns/promises';

dns.setServers(['8.8.8.8', '1.1.1.1']);

console.log('Testing SRV...');

try {
    const result = await dns.resolveSrv(
        '_mongodb._tcp.vero-goods.iadwjbz.mongodb.net'
    );

    console.log(result);
} catch (error) {
    console.error(error);
}