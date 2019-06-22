module.exports.aws = {
  provider: 'amazon',
  keyId: process.env.AWS_KEY_ID,
  key: process.env.AWS_KEY,
  region: process.env.AWS_REGION,
  containerUrl : process.env.AWS_BUCKET_URL,
};
