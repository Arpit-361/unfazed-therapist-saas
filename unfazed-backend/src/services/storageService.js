/**
 * File storage interface: save(key, buffer, contentType) / read(key) / publicUrl(key).
 * Keys under "public/" are web-served (avatars); everything else (invoices) is private and
 * only streamed through authorized routes.
 *
 * Drivers:
 *  - local: files under STORAGE_LOCAL_DIR (default ./uploads) - development/demo default
 *  - s3:    AWS S3 via @aws-sdk/client-s3 (optional dependency). Falls back to local when the SDK
 *           or credentials are missing so the feature keeps working.
 */
const fs = require('fs/promises');
const path = require('path');
const config = require('../config/env');

const localRoot = path.resolve(process.cwd(), config.storage.localDir);

const localDriver = {
  name: 'local',
  async save(key, buffer) {
    const target = path.join(localRoot, key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, buffer);
    return { key };
  },
  async read(key) {
    return fs.readFile(path.join(localRoot, key));
  },
  publicUrl(key) {
    return `${config.apiPublicUrl}/uploads/${key}`;
  },
};

function createS3Driver() {
  const { bucket, region, accessKeyId, secretAccessKey } = config.storage.s3;
  if (!bucket || !region || !accessKeyId || !secretAccessKey) {
    console.warn('[storage] STORAGE_DRIVER=s3 but AWS credentials are incomplete - using local storage');
    return null;
  }
  let sdk;
  try {
    // eslint-disable-next-line global-require, import/no-unresolved
    sdk = require('@aws-sdk/client-s3');
  } catch {
    console.warn('[storage] @aws-sdk/client-s3 is not installed - using local storage');
    return null;
  }
  const client = new sdk.S3Client({ region, credentials: { accessKeyId, secretAccessKey } });
  return {
    name: 's3',
    async save(key, buffer, contentType) {
      await client.send(new sdk.PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: contentType }));
      return { key };
    },
    async read(key) {
      const res = await client.send(new sdk.GetObjectCommand({ Bucket: bucket, Key: key }));
      return Buffer.from(await res.Body.transformToByteArray());
    },
    publicUrl(key) {
      return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
    },
  };
}

const driver = (config.storage.driver === 's3' && createS3Driver()) || localDriver;

module.exports = {
  driverName: driver.name,
  localRoot,
  save: (key, buffer, contentType) => driver.save(key, buffer, contentType),
  read: (key) => driver.read(key),
  publicUrl: (key) => driver.publicUrl(key),
};
