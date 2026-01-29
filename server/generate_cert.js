const selfsigned = require('selfsigned');
const fs = require('fs');

(async () => {
    console.log("Generating 2048-bit self-signed certificate...");
    const attrs = [{ name: 'commonName', value: '172.16.7.37' }];
    try {
        const pems = await selfsigned.generate(attrs, { days: 365, keySize: 2048 });

        console.log("Keys generated:", Object.keys(pems));

        fs.writeFileSync('cert.pem', pems.cert);
        fs.writeFileSync('key.pem', pems.private);

        console.log('Certificate generated: cert.pem');
        console.log('Private key generated: key.pem');
    } catch (err) {
        console.error("Error generating certs:", err);
    }
})();
