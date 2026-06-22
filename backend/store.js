const fs = require('fs');
const path = require('path');

const defaultDataDir = process.env.VERCEL
  ? path.join('/tmp', 'headies-wakanow-data')
  : path.join(__dirname, '..', '.data');

const dataDir = process.env.WKN_DATA_DIR || defaultDataDir;
const dataFile = process.env.WKN_STORE_FILE || path.join(dataDir, 'store.json');

const emptyStore = {
  requests: [],
  eligibleApplicants: [],
  visaApplications: []
};

function ensureStore() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify(emptyStore, null, 2));
  }
}

function readStore() {
  ensureStore();
  try {
    const parsed = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    return {
      requests: Array.isArray(parsed.requests) ? parsed.requests : [],
      eligibleApplicants: Array.isArray(parsed.eligibleApplicants) ? parsed.eligibleApplicants : [],
      visaApplications: Array.isArray(parsed.visaApplications) ? parsed.visaApplications : []
    };
  } catch (error) {
    return { ...emptyStore };
  }
}

function writeStore(nextStore) {
  ensureStore();
  const normalized = {
    requests: Array.isArray(nextStore.requests) ? nextStore.requests : [],
    eligibleApplicants: Array.isArray(nextStore.eligibleApplicants) ? nextStore.eligibleApplicants : [],
    visaApplications: Array.isArray(nextStore.visaApplications) ? nextStore.visaApplications : []
  };
  fs.writeFileSync(dataFile, JSON.stringify(normalized, null, 2));
  return normalized;
}

module.exports = {
  readStore,
  writeStore,
  dataFile
};
