const SmeeClient = require('smee-client');

const smee = new SmeeClient({
  source: 'https://smee.io/e72f-2405-201-9014-138-61cf-bada-4160-6076', // Your smee.io URL
  target: 'http://localhost:3000',
  logger: console,
});

const events = smee.start();
