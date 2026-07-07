const { Pool } = require('pg');
const { readStore, writeStore } = require('./store');

const hasDatabase = Boolean(process.env.DATABASE_URL);
const localDatabase = hasDatabase && /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);

const pool = hasDatabase ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === 'disable' || localDatabase ? false : { rejectUnauthorized: false },
  max: Number(process.env.PG_POOL_MAX || 5),
  idleTimeoutMillis: 30_000
}) : null;

function now() {
  return new Date().toISOString();
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeAccessCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let index = 0; index < 8; index += 1) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

const USER_TYPES = new Set(['basic', 'premium', 'staff']);
const VISA_PRICE_KEYS = {
  basic: 'visa_basic_fee_naira',
  premium: 'visa_premium_fee_naira'
};
const DEFAULT_VISA_PRICING = {
  basic: Number(process.env.VISA_FEE_NAIRA || 745000),
  premium: Number(process.env.VISA_PREMIUM_FEE_NAIRA || process.env.VISA_FEE_NAIRA || 745000)
};

function normalizeUserType(value) {
  const type = String(value || '').trim().toLowerCase();
  return USER_TYPES.has(type) ? type : 'basic';
}

function recordUserType(record, fallback = 'basic') {
  return normalizeUserType(
    record.userType || record.UserType || record.user_type || record.type || record.Type || record.visaType || record.VisaType || fallback
  );
}

function parsePrice(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function preloadedEmailRequiredError() {
  const error = new Error('This email is not on the approved visa access list. Ask the admin team to preload it before signing up.');
  error.code = 'EMAIL_NOT_PRELOADED';
  error.status = 403;
  return error;
}

function forbiddenError(message) {
  const error = new Error(message);
  error.status = 403;
  return error;
}

function iso(value) {
  if (!value) return '';
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toRequest(row) {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    email: row.email,
    phone: row.phone,
    summary: row.summary,
    status: row.status,
    details: row.details || [],
    metadata: row.metadata || {},
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at)
  };
}

function toEligible(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    accessCode: row.access_code,
    category: row.category,
    userType: normalizeUserType(row.user_type),
    status: row.status,
    source: row.source || 'admin',
    notes: row.notes,
    signupCompletedAt: row.signup_completed_at ? iso(row.signup_completed_at) : '',
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at)
  };
}

function toApplication(row) {
  return {
    id: row.id,
    applicantId: row.applicant_id || row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    applicants: String(row.applicants || 1),
    applicantCategory: row.applicant_category,
    userType: normalizeUserType(row.user_type),
    passportExpiry: row.passport_expiry ? String(row.passport_expiry).slice(0, 10) : '',
    travelDate: row.travel_date ? String(row.travel_date).slice(0, 10) : '',
    travelHistory: row.travel_history,
    role: row.role,
    salary: row.salary,
    employmentLength: row.employment_length,
    notes: row.notes,
    fee: row.fee,
    status: row.status,
    paymentStatus: row.payment_status || 'Unpaid',
    paymentReference: row.payment_reference || '',
    paymentAmount: Number(row.payment_amount || 0),
    paymentCurrency: row.payment_currency || 'NGN',
    paymentPaidAt: row.payment_paid_at ? iso(row.payment_paid_at) : '',
    reviewedAt: row.reviewed_at ? iso(row.reviewed_at) : '',
    passportDetails: row.passport_details || null,
    uploads: [],
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at)
  };
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseDataUrl(file) {
  const dataUrl = String((file && file.dataUrl) || '');
  const match = dataUrl.match(/^data:([^;,]*)(?:;[^,]*)?;base64,(.+)$/);
  const fileData = match ? Buffer.from(match[2], 'base64') : Buffer.from('');
  if (!match || !fileData.length) {
    const error = new Error(`File "${(file && file.name) || 'upload'}" could not be read. Re-select the file and try again.`);
    error.status = 400;
    throw error;
  }
  return {
    fileType: match[1] || (file && file.type) || 'application/octet-stream',
    fileData
  };
}

function toDocumentFile(row) {
  return {
    id: row.id,
    name: row.file_name,
    size: Number(row.file_size || 0),
    type: row.file_type
  };
}

function attachDocuments(applications, documents) {
  const byApplication = new Map();
  documents.forEach((doc) => {
    if (!byApplication.has(doc.application_id)) byApplication.set(doc.application_id, []);
    byApplication.get(doc.application_id).push(doc);
  });

  return applications.map((app) => {
    const grouped = new Map();
    (byApplication.get(app.id) || []).forEach((doc) => {
      const key = `${doc.field}|${doc.document}|${doc.required}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          field: doc.field,
          document: doc.document,
          required: doc.required,
          files: []
        });
      }
      grouped.get(key).files.push(toDocumentFile(doc));
    });
    return { ...app, uploads: Array.from(grouped.values()) };
  });
}

async function listRequestsPg() {
  const result = await pool.query('select * from travel_requests order by updated_at desc');
  return result.rows.map(toRequest);
}

async function createRequestPg(record) {
  const entry = {
    id: record.id || makeId('req'),
    type: String(record.type || 'Travel'),
    name: String(record.name || ''),
    email: normalizeEmail(record.email),
    phone: String(record.phone || ''),
    summary: String(record.summary || ''),
    status: String(record.status || 'New'),
    details: record.details || [],
    metadata: record.metadata || {},
    createdAt: record.createdAt || now()
  };
  const result = await pool.query(
    `insert into travel_requests
      (id, type, name, email, phone, summary, status, details, metadata, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, now())
     returning *`,
    [
      entry.id,
      entry.type,
      entry.name,
      entry.email,
      entry.phone,
      entry.summary,
      entry.status,
      JSON.stringify(entry.details),
      JSON.stringify(entry.metadata),
      entry.createdAt
    ]
  );
  return toRequest(result.rows[0]);
}

async function updateRequestPg(id, fields) {
  const result = await pool.query(
    `update travel_requests
     set status = coalesce($2, status),
         metadata = coalesce($3::jsonb, metadata),
         updated_at = now()
     where id = $1
     returning *`,
    [id, fields.status || null, fields.metadata ? JSON.stringify(fields.metadata) : null]
  );
  return result.rows[0] ? toRequest(result.rows[0]) : null;
}

async function listEligiblePg() {
  const result = await pool.query('select * from visa_eligible_applicants order by updated_at desc');
  return result.rows.map(toEligible);
}

async function upsertEligibleRecordsPg(records, options = {}) {
  const allowExistingUpdates = Boolean(options.allowExistingUpdates);
  const allowPrivilegedUserTypes = Boolean(options.allowPrivilegedUserTypes);
  for (const record of records) {
    const email = normalizeEmail(record.email || record.Email);
    if (!email) continue;
    const existingResult = await pool.query('select id from visa_eligible_applicants where email = $1 limit 1', [email]);
    if (existingResult.rows[0] && !allowExistingUpdates) {
      throw forbiddenError('Super admin access is required to edit an existing allowlist applicant.');
    }
    const userType = recordUserType(record);
    if (userType !== 'basic' && !allowPrivilegedUserTypes) {
      throw forbiddenError('Super admin access is required to create premium or staff visa users.');
    }
    const explicitAccessCode = String(record.accessCode || record.AccessCode || record.code || record.Code || '').trim();
    const accessCode = explicitAccessCode || makeAccessCode();
    await pool.query(
      `insert into visa_eligible_applicants
        (id, name, email, phone, access_code, category, user_type, status, source, notes, signup_completed_at, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, 'admin', $9, $10::timestamptz, now(), now())
       on conflict (email) do update set
        name = coalesce(nullif(excluded.name, ''), visa_eligible_applicants.name),
        phone = coalesce(nullif(excluded.phone, ''), visa_eligible_applicants.phone),
        access_code = coalesce(nullif(excluded.access_code, ''), visa_eligible_applicants.access_code),
        category = coalesce(nullif(excluded.category, ''), visa_eligible_applicants.category),
        user_type = excluded.user_type,
        status = coalesce(nullif(excluded.status, ''), visa_eligible_applicants.status),
        source = 'admin',
        notes = coalesce(nullif(excluded.notes, ''), visa_eligible_applicants.notes),
        signup_completed_at = coalesce(excluded.signup_completed_at, visa_eligible_applicants.signup_completed_at),
        updated_at = now()`,
      [
        record.id || makeId('elig'),
        String(record.name || record.Name || ''),
        email,
        String(record.phone || record.Phone || ''),
        accessCode,
        String(record.category || record.Category || ''),
        userType,
        String(record.status || record.Status || 'active'),
        String(record.notes || record.Notes || ''),
        explicitAccessCode ? now() : null
      ]
    );
  }
  return listEligiblePg();
}

async function signupApplicantPg(record) {
  const email = normalizeEmail(record.email);
  if (!email) throw new Error('Email is required.');
  const accessCode = String(record.accessCode || record.AccessCode || record.code || record.Code || '').trim();
  if (accessCode.length < 6) throw new Error('Access code must be at least 6 characters.');
  const existingResult = await pool.query('select * from visa_eligible_applicants where email = $1 limit 1', [email]);
  if (!existingResult.rows[0]) throw preloadedEmailRequiredError();
  const existing = existingResult.rows[0];
  if (existing.status === 'blocked') return toEligible(existing);
  const preserveExistingCode = Boolean(existing.signup_completed_at);

  const result = await pool.query(
    `update visa_eligible_applicants
     set name = coalesce(nullif($2, ''), name),
         phone = coalesce(nullif($3, ''), phone),
         access_code = case when $7::boolean then access_code else $4 end,
         category = coalesce(nullif($5, ''), category),
         notes = coalesce(nullif($6, ''), notes),
         source = 'admin',
         signup_completed_at = coalesce(signup_completed_at, now()),
         updated_at = now()
     where email = $1
     returning *`,
    [
      email,
      String(record.name || '').trim(),
      String(record.phone || '').trim(),
      accessCode,
      String(record.category || '').trim(),
      String(record.notes || '').trim(),
      preserveExistingCode
    ]
  );
  return toEligible(result.rows[0]);
}

async function findEligibleLoginPg(email, accessCode) {
  const result = await pool.query(
    `select * from visa_eligible_applicants
     where email = $1
       and lower(access_code) = lower($2)
       and status = 'active'
     limit 1`,
    [normalizeEmail(email), String(accessCode || '').trim()]
  );
  return result.rows[0] ? toEligible(result.rows[0]) : null;
}

async function getEligiblePg(id) {
  const result = await pool.query('select * from visa_eligible_applicants where id = $1 or email = $1 limit 1', [String(id || '').trim()]);
  return result.rows[0] ? toEligible(result.rows[0]) : null;
}

async function updateEligiblePg(id, fields) {
  const result = await pool.query(
    `update visa_eligible_applicants
     set name = coalesce($2, name),
         phone = coalesce($3, phone),
         access_code = coalesce($4, access_code),
         category = coalesce($5, category),
         user_type = coalesce($6, user_type),
         status = coalesce($7, status),
         notes = coalesce($8, notes),
         signup_completed_at = case when $4 is null then signup_completed_at else coalesce(signup_completed_at, now()) end,
         updated_at = now()
     where id = $1
     returning *`,
    [
      id,
      fields.name == null ? null : String(fields.name),
      fields.phone == null ? null : String(fields.phone),
      fields.accessCode == null ? null : String(fields.accessCode),
      fields.category == null ? null : String(fields.category),
      fields.userType == null ? null : normalizeUserType(fields.userType),
      fields.status == null ? null : String(fields.status),
      fields.notes == null ? null : String(fields.notes)
    ]
  );
  return result.rows[0] ? toEligible(result.rows[0]) : null;
}

async function deleteEligiblePg(id) {
  const result = await pool.query('delete from visa_eligible_applicants where id = $1', [id]);
  return result.rowCount > 0;
}

async function getVisaPricingPg() {
  const result = await pool.query('select key, value from app_settings where key = any($1::text[])', [Object.values(VISA_PRICE_KEYS)]);
  const values = new Map(result.rows.map((row) => [row.key, row.value]));
  return {
    basic: parsePrice(values.get(VISA_PRICE_KEYS.basic), DEFAULT_VISA_PRICING.basic),
    premium: parsePrice(values.get(VISA_PRICE_KEYS.premium), DEFAULT_VISA_PRICING.premium),
    staff: 0
  };
}

async function updateVisaPricingPg(fields) {
  const current = await getVisaPricingPg();
  const next = {
    basic: parsePrice(fields.basic, current.basic),
    premium: parsePrice(fields.premium, current.premium)
  };
  await pool.query(
    `insert into app_settings (key, value, updated_at)
     values ($1, $2, now()), ($3, $4, now())
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [VISA_PRICE_KEYS.basic, String(next.basic), VISA_PRICE_KEYS.premium, String(next.premium)]
  );
  return getVisaPricingPg();
}

async function selectApplicationsPg(whereSql, params) {
  const appsResult = await pool.query(`select * from visa_applications ${whereSql} order by updated_at desc`, params);
  const applications = appsResult.rows.map(toApplication);
  if (!applications.length) return [];
  const docResult = await pool.query(
    `select id, application_id, field, document, required, file_name, file_size, file_type, created_at
     from visa_application_documents where application_id = any($1::text[]) order by created_at asc`,
    [applications.map((app) => app.id)]
  );
  return attachDocuments(applications, docResult.rows);
}

async function listApplicationsPg() {
  return selectApplicationsPg('', []);
}

async function getApplicationPg(id) {
  const apps = await selectApplicationsPg('where id = $1 or applicant_id = $1', [id]);
  return apps[0] || null;
}

async function getApplicationByPaymentReferencePg(reference) {
  const apps = await selectApplicationsPg('where payment_reference = $1', [String(reference || '')]);
  return apps[0] || null;
}

async function applicantExists(client, applicantId) {
  if (!applicantId) return false;
  const result = await client.query('select id from visa_eligible_applicants where id = $1 limit 1', [applicantId]);
  return result.rowCount > 0;
}

async function upsertApplicationPg(app) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const id = app.id || app.applicantId || makeId('visa');
    const eligibleResult = await client.query(
      'select id, user_type from visa_eligible_applicants where id = $1 limit 1',
      [app.applicantId || id]
    );
    const eligibleApplicant = eligibleResult.rows[0] || null;
    const applicantId = eligibleApplicant ? eligibleApplicant.id : null;
    const userType = normalizeUserType((eligibleApplicant && eligibleApplicant.user_type) || app.userType);
    const result = await client.query(
      `insert into visa_applications
        (id, applicant_id, name, email, phone, applicants, applicant_category, user_type, passport_expiry, travel_date,
         travel_history, role, salary, employment_length, notes, fee, status, payment_status, payment_reference,
         payment_amount, payment_currency, payment_paid_at, reviewed_at, passport_details, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, nullif($9, '')::date, nullif($10, '')::date,
         $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, nullif($22, '')::timestamptz,
         nullif($23, '')::timestamptz, $24::jsonb, coalesce($25::timestamptz, now()), now())
       on conflict (id) do update set
         applicant_id = excluded.applicant_id,
         name = excluded.name,
         email = excluded.email,
         phone = excluded.phone,
         applicants = excluded.applicants,
         applicant_category = excluded.applicant_category,
         user_type = excluded.user_type,
         passport_expiry = excluded.passport_expiry,
         travel_date = excluded.travel_date,
         travel_history = excluded.travel_history,
         role = excluded.role,
         salary = excluded.salary,
         employment_length = excluded.employment_length,
         notes = excluded.notes,
         fee = excluded.fee,
         status = excluded.status,
         payment_status = excluded.payment_status,
         payment_reference = excluded.payment_reference,
         payment_amount = excluded.payment_amount,
         payment_currency = excluded.payment_currency,
         payment_paid_at = excluded.payment_paid_at,
         reviewed_at = excluded.reviewed_at,
         passport_details = excluded.passport_details,
         updated_at = now()
       returning *`,
      [
        id,
        applicantId,
        String(app.name || ''),
        normalizeEmail(app.email),
        String(app.phone || ''),
        parsePositiveInt(app.applicants, 1),
        String(app.applicantCategory || ''),
        userType,
        String(app.passportExpiry || ''),
        String(app.travelDate || ''),
        String(app.travelHistory || ''),
        String(app.role || ''),
        String(app.salary || ''),
        String(app.employmentLength || ''),
        String(app.notes || ''),
        String(app.fee || 'Basic visa package: visa fee included, admin processing fee included, Headies ticket fee included'),
        String(app.status || 'Draft'),
        String(app.paymentStatus || 'Unpaid'),
        String(app.paymentReference || ''),
        Number(app.paymentAmount || 0),
        String(app.paymentCurrency || 'NGN'),
        String(app.paymentPaidAt || ''),
        String(app.reviewedAt || ''),
        JSON.stringify(app.passportDetails || {}),
        app.createdAt || null
      ]
    );

    // Documents are only replaced when the caller explicitly provides an uploads
    // array. Omitting `uploads` (the lightweight finalize/submit path) leaves the
    // stored documents untouched. Files echoed back as metadata (id, no dataUrl)
    // are preserved instead of being wiped.
    if (Array.isArray(app.uploads)) {
      const keepIds = [];
      const inserts = [];
      for (const upload of app.uploads) {
        const files = Array.isArray(upload && upload.files) ? upload.files : [];
        for (const file of files) {
          if (file && file.dataUrl) inserts.push({ upload, file });
          else if (file && file.id) keepIds.push(String(file.id));
        }
      }
      await client.query(
        'delete from visa_application_documents where application_id = $1 and not (id = any($2::text[]))',
        [id, keepIds]
      );
      for (const { upload, file } of inserts) {
        const parsed = parseDataUrl(file);
        await client.query(
          `insert into visa_application_documents
            (id, application_id, field, document, required, file_name, file_size, file_type, file_data)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            makeId('doc'),
            id,
            String(upload.field || ''),
            String(upload.document || ''),
            Boolean(upload.required),
            String(file.name || 'upload'),
            parsed.fileData.length,
            parsed.fileType,
            parsed.fileData
          ]
        );
      }
    }
    await client.query('commit');
    return getApplicationPg(result.rows[0].id);
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

async function updateApplicationPg(id, fields) {
  const result = await pool.query(
    `update visa_applications
     set status = coalesce($2, status),
         notes = coalesce($3, notes),
         passport_details = coalesce($4::jsonb, passport_details),
         payment_status = coalesce($5, payment_status),
         payment_reference = coalesce($6, payment_reference),
         payment_amount = coalesce($7, payment_amount),
         payment_currency = coalesce($8, payment_currency),
         payment_paid_at = coalesce(nullif($9, '')::timestamptz, payment_paid_at),
         reviewed_at = coalesce(nullif($10, '')::timestamptz, reviewed_at),
         updated_at = now()
     where id = $1
     returning *`,
    [
      id,
      fields.status || null,
      fields.notes == null ? null : String(fields.notes),
      fields.passportDetails === undefined ? null : JSON.stringify(fields.passportDetails || {}),
      fields.paymentStatus == null ? null : String(fields.paymentStatus),
      fields.paymentReference == null ? null : String(fields.paymentReference),
      fields.paymentAmount == null ? null : Number(fields.paymentAmount),
      fields.paymentCurrency == null ? null : String(fields.paymentCurrency),
      fields.paymentPaidAt == null ? null : String(fields.paymentPaidAt),
      fields.reviewedAt == null ? null : String(fields.reviewedAt)
    ]
  );
  return result.rows[0] ? getApplicationPg(result.rows[0].id) : null;
}

async function updateApplicationPaymentPg(id, fields) {
  return updateApplicationPg(id, fields);
}

async function ensureApplicationRowPg(client, applicationId) {
  const found = await client.query(
    'select id from visa_applications where id = $1 or applicant_id = $1 limit 1',
    [applicationId]
  );
  if (found.rows[0]) return found.rows[0].id;
  const eligibleResult = await client.query(
    'select id, name, email, phone, category, user_type from visa_eligible_applicants where id = $1 limit 1',
    [applicationId]
  );
  const applicant = eligibleResult.rows[0] || null;
  await client.query(
    `insert into visa_applications (id, applicant_id, name, email, phone, applicant_category, user_type, status, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, 'Draft', now(), now())
     on conflict (id) do nothing`,
    [
      applicationId,
      applicant ? applicant.id : null,
      applicant ? applicant.name : '',
      applicant ? applicant.email : '',
      applicant ? applicant.phone : '',
      applicant ? applicant.category : '',
      normalizeUserType(applicant && applicant.user_type)
    ]
  );
  return applicationId;
}

async function setApplicationDocumentPg(applicationId, payload) {
  const parsed = parseDataUrl(payload.file);
  const client = await pool.connect();
  try {
    await client.query('begin');
    const id = await ensureApplicationRowPg(client, String(applicationId));
    if (payload.replaceField) {
      await client.query(
        'delete from visa_application_documents where application_id = $1 and field = $2',
        [id, String(payload.field || '')]
      );
    }
    await client.query(
      `insert into visa_application_documents
        (id, application_id, field, document, required, file_name, file_size, file_type, file_data)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        makeId('doc'),
        id,
        String(payload.field || ''),
        String(payload.document || ''),
        Boolean(payload.required),
        String((payload.file && payload.file.name) || 'upload'),
        parsed.fileData.length,
        parsed.fileType,
        parsed.fileData
      ]
    );
    await client.query('update visa_applications set updated_at = now() where id = $1', [id]);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
  return getApplicationPg(String(applicationId));
}

async function getApplicationDocumentPg(applicationId, documentId) {
  const result = await pool.query(
    `select d.id, d.file_name, d.file_size, d.file_type, d.file_data
     from visa_application_documents d
     join visa_applications a on a.id = d.application_id
     where d.id = $2 and (a.id = $1 or a.applicant_id = $1)
     limit 1`,
    [String(applicationId), String(documentId)]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    name: row.file_name,
    size: Number(row.file_size || 0),
    type: row.file_type || 'application/octet-stream',
    data: Buffer.isBuffer(row.file_data) ? row.file_data : Buffer.from(row.file_data || '')
  };
}

function jsonStore() {
  return readStore();
}

async function listRequestsJson() {
  return jsonStore().requests;
}

async function createRequestJson(record) {
  const store = jsonStore();
  const entry = {
    ...record,
    id: record.id || makeId('req'),
    status: record.status || 'New',
    createdAt: record.createdAt || now(),
    updatedAt: now()
  };
  store.requests.push(entry);
  writeStore(store);
  return entry;
}

async function updateRequestJson(id, fields) {
  const store = jsonStore();
  const item = store.requests.find((record) => record.id === id);
  if (!item) return null;
  Object.assign(item, fields, { updatedAt: now() });
  writeStore(store);
  return item;
}

async function listEligibleJson() {
  return jsonStore().eligibleApplicants.map((item) => ({
    source: 'admin',
    signupCompletedAt: '',
    ...item,
    userType: normalizeUserType(item.userType)
  }));
}

async function upsertEligibleRecordsJson(records, options = {}) {
  const allowExistingUpdates = Boolean(options.allowExistingUpdates);
  const allowPrivilegedUserTypes = Boolean(options.allowPrivilegedUserTypes);
  const store = jsonStore();
  records.forEach((record) => {
    const email = normalizeEmail(record.email || record.Email);
    if (!email) return;
    const existing = store.eligibleApplicants.find((item) => normalizeEmail(item.email) === email);
    if (existing && !allowExistingUpdates) throw forbiddenError('Super admin access is required to edit an existing allowlist applicant.');
    const userType = recordUserType(record, existing && existing.userType);
    if (userType !== 'basic' && !allowPrivilegedUserTypes) throw forbiddenError('Super admin access is required to create premium or staff visa users.');
    const explicitAccessCode = String(record.accessCode || record.AccessCode || record.code || record.Code || '').trim();
    const next = {
      id: existing ? existing.id : makeId('elig'),
      name: String(record.name || record.Name || (existing && existing.name) || '').trim(),
      email,
      phone: String(record.phone || record.Phone || (existing && existing.phone) || '').trim(),
      accessCode: String(explicitAccessCode || (existing && existing.accessCode) || makeAccessCode()).trim(),
      category: String(record.category || record.Category || (existing && existing.category) || '').trim(),
      userType,
      status: String(record.status || record.Status || (existing && existing.status) || 'active').trim() || 'active',
      source: 'admin',
      notes: String(record.notes || record.Notes || (existing && existing.notes) || '').trim(),
      signupCompletedAt: explicitAccessCode ? now() : ((existing && existing.signupCompletedAt) || ''),
      createdAt: existing ? existing.createdAt : now(),
      updatedAt: now()
    };
    if (existing) Object.assign(existing, next);
    else store.eligibleApplicants.push(next);
  });
  writeStore(store);
  return store.eligibleApplicants;
}

async function signupApplicantJson(record) {
  const email = normalizeEmail(record.email);
  if (!email) throw new Error('Email is required.');
  const accessCode = String(record.accessCode || record.AccessCode || record.code || record.Code || '').trim();
  if (accessCode.length < 6) throw new Error('Access code must be at least 6 characters.');
  const store = jsonStore();
  const existing = store.eligibleApplicants.find((item) => normalizeEmail(item.email) === email);
  if (!existing) throw preloadedEmailRequiredError();
  if (existing.status === 'blocked') return { ...existing, userType: normalizeUserType(existing.userType) };
  const preserveExistingCode = Boolean(existing.signupCompletedAt);
  const next = {
    id: existing.id,
    name: String(record.name || (existing && existing.name) || '').trim(),
    email,
    phone: String(record.phone || (existing && existing.phone) || '').trim(),
    accessCode: preserveExistingCode ? existing.accessCode : accessCode,
    category: String(record.category || (existing && existing.category) || '').trim(),
    userType: normalizeUserType(existing.userType),
    status: existing.status || 'active',
    source: 'admin',
    notes: String(record.notes || (existing && existing.notes) || '').trim(),
    signupCompletedAt: existing.signupCompletedAt || now(),
    createdAt: existing.createdAt || now(),
    updatedAt: now()
  };
  Object.assign(existing, next);
  writeStore(store);
  return next;
}

async function findEligibleLoginJson(email, accessCode) {
  const item = jsonStore().eligibleApplicants.find((record) => (
    normalizeEmail(record.email) === normalizeEmail(email) &&
    String(record.accessCode || '').trim().toLowerCase() === String(accessCode || '').trim().toLowerCase() &&
    (record.status || 'active') === 'active'
  )) || null;
  return item ? { ...item, userType: normalizeUserType(item.userType) } : null;
}

async function getEligibleJson(id) {
  const item = jsonStore().eligibleApplicants.find((record) => record.id === id || normalizeEmail(record.email) === normalizeEmail(id));
  return item ? { ...item, userType: normalizeUserType(item.userType) } : null;
}

async function updateEligibleJson(id, fields) {
  const store = jsonStore();
  const item = store.eligibleApplicants.find((record) => record.id === id);
  if (!item) return null;
  Object.assign(item, fields, { updatedAt: now() });
  if (fields.userType != null) item.userType = normalizeUserType(fields.userType);
  if (fields.accessCode != null && !item.signupCompletedAt) item.signupCompletedAt = now();
  writeStore(store);
  return item;
}

async function deleteEligibleJson(id) {
  const store = jsonStore();
  const before = store.eligibleApplicants.length;
  store.eligibleApplicants = store.eligibleApplicants.filter((item) => item.id !== id);
  writeStore(store);
  return store.eligibleApplicants.length < before;
}

async function getVisaPricingJson() {
  const store = jsonStore();
  const pricing = store.visaPricing || {};
  return {
    basic: parsePrice(pricing.basic, DEFAULT_VISA_PRICING.basic),
    premium: parsePrice(pricing.premium, DEFAULT_VISA_PRICING.premium),
    staff: 0
  };
}

async function updateVisaPricingJson(fields) {
  const store = jsonStore();
  const current = await getVisaPricingJson();
  store.visaPricing = {
    basic: parsePrice(fields.basic, current.basic),
    premium: parsePrice(fields.premium, current.premium)
  };
  writeStore(store);
  return getVisaPricingJson();
}

function ensureStoredDocumentIds(store) {
  let mutated = false;
  store.visaApplications.forEach((app) => {
    (Array.isArray(app.uploads) ? app.uploads : []).forEach((upload) => {
      (Array.isArray(upload.files) ? upload.files : []).forEach((file) => {
        if (file && !file.id) {
          file.id = makeId('doc');
          mutated = true;
        }
      });
    });
  });
  if (mutated) writeStore(store);
}

function toPublicApplicationJson(app) {
  if (!app) return null;
  return {
    ...app,
    uploads: (Array.isArray(app.uploads) ? app.uploads : []).map((upload) => ({
      field: upload.field,
      document: upload.document,
      required: Boolean(upload.required),
      files: (Array.isArray(upload.files) ? upload.files : []).map((file) => ({
        id: file.id,
        name: file.name,
        size: Number(file.size || 0),
        type: file.type
      }))
    }))
  };
}

async function listApplicationsJson() {
  const store = jsonStore();
  ensureStoredDocumentIds(store);
  return store.visaApplications.map(toPublicApplicationJson);
}

async function getApplicationJson(id) {
  const store = jsonStore();
  ensureStoredDocumentIds(store);
  const item = store.visaApplications.find((record) => record.id === id || record.applicantId === id);
  return toPublicApplicationJson(item) || null;
}

async function getApplicationByPaymentReferenceJson(reference) {
  const store = jsonStore();
  ensureStoredDocumentIds(store);
  const item = store.visaApplications.find((record) => record.paymentReference === reference);
  return toPublicApplicationJson(item) || null;
}

function mergeUploadsJson(existing, uploads) {
  const storedFiles = new Map();
  ((existing && existing.uploads) || []).forEach((upload) => {
    (Array.isArray(upload.files) ? upload.files : []).forEach((file) => {
      if (file && file.id) storedFiles.set(String(file.id), file);
    });
  });
  return uploads.map((upload) => ({
    field: String((upload && upload.field) || ''),
    document: String((upload && upload.document) || ''),
    required: Boolean(upload && upload.required),
    files: (Array.isArray(upload && upload.files) ? upload.files : []).map((file) => {
      if (file && file.dataUrl) {
        const parsed = parseDataUrl(file);
        return {
          id: makeId('doc'),
          name: String(file.name || 'upload'),
          size: parsed.fileData.length,
          type: parsed.fileType,
          dataUrl: String(file.dataUrl)
        };
      }
      return (file && file.id && storedFiles.get(String(file.id))) || null;
    }).filter(Boolean)
  }));
}

async function upsertApplicationJson(app) {
  const store = jsonStore();
  const id = app.id || app.applicantId || makeId('visa');
  const existing = store.visaApplications.find((item) => item.id === id || item.applicantId === id);
  const applicant = store.eligibleApplicants.find((item) => item.id === (app.applicantId || id)) || null;
  const application = {
    ...app,
    id,
    applicantId: app.applicantId || id,
    userType: normalizeUserType((applicant && applicant.userType) || app.userType || (existing && existing.userType)),
    status: app.status || (existing && existing.status) || 'Draft',
    paymentStatus: app.paymentStatus || (existing && existing.paymentStatus) || 'Unpaid',
    paymentReference: app.paymentReference || (existing && existing.paymentReference) || '',
    paymentAmount: app.paymentAmount == null ? ((existing && existing.paymentAmount) || 0) : Number(app.paymentAmount),
    paymentCurrency: app.paymentCurrency || (existing && existing.paymentCurrency) || 'NGN',
    paymentPaidAt: app.paymentPaidAt || (existing && existing.paymentPaidAt) || '',
    reviewedAt: app.reviewedAt || (existing && existing.reviewedAt) || '',
    // Documents are only replaced when the caller explicitly provides uploads;
    // omitting the key preserves stored documents (lightweight finalize path).
    uploads: Array.isArray(app.uploads)
      ? mergeUploadsJson(existing, app.uploads)
      : ((existing && existing.uploads) || []),
    createdAt: (existing && existing.createdAt) || app.createdAt || now(),
    updatedAt: now()
  };
  if (existing) Object.assign(existing, application);
  else store.visaApplications.push(application);
  writeStore(store);
  return toPublicApplicationJson(existing || application);
}

async function updateApplicationJson(id, fields) {
  const store = jsonStore();
  const item = store.visaApplications.find((record) => record.id === id);
  if (!item) return null;
  const { uploads, ...rest } = fields || {};
  Object.assign(item, rest, { updatedAt: now() });
  writeStore(store);
  return toPublicApplicationJson(item);
}

async function updateApplicationPaymentJson(id, fields) {
  return updateApplicationJson(id, fields);
}

async function setApplicationDocumentJson(applicationId, payload) {
  const parsed = parseDataUrl(payload.file);
  const store = jsonStore();
  const id = String(applicationId);
  let app = store.visaApplications.find((item) => item.id === id || item.applicantId === id);
  if (!app) {
    const applicant = store.eligibleApplicants.find((item) => item.id === id) || null;
    app = {
      id,
      applicantId: id,
      name: (applicant && applicant.name) || '',
      email: (applicant && applicant.email) || '',
      phone: (applicant && applicant.phone) || '',
      applicantCategory: (applicant && applicant.category) || '',
      userType: normalizeUserType(applicant && applicant.userType),
      status: 'Draft',
      paymentStatus: 'Unpaid',
      uploads: [],
      createdAt: now(),
      updatedAt: now()
    };
    store.visaApplications.push(app);
  }
  if (!Array.isArray(app.uploads)) app.uploads = [];
  const field = String(payload.field || '');
  let group = app.uploads.find((upload) => upload.field === field);
  if (!group) {
    group = { field, document: '', required: false, files: [] };
    app.uploads.push(group);
  }
  group.document = String(payload.document || group.document || '');
  group.required = Boolean(payload.required);
  if (payload.replaceField) group.files = [];
  group.files.push({
    id: makeId('doc'),
    name: String((payload.file && payload.file.name) || 'upload'),
    size: parsed.fileData.length,
    type: parsed.fileType,
    dataUrl: String(payload.file.dataUrl)
  });
  app.updatedAt = now();
  writeStore(store);
  return toPublicApplicationJson(app);
}

async function getApplicationDocumentJson(applicationId, documentId) {
  const store = jsonStore();
  ensureStoredDocumentIds(store);
  const id = String(applicationId);
  const app = store.visaApplications.find((item) => item.id === id || item.applicantId === id);
  if (!app) return null;
  for (const upload of (Array.isArray(app.uploads) ? app.uploads : [])) {
    for (const file of (Array.isArray(upload.files) ? upload.files : [])) {
      if (file && String(file.id) === String(documentId)) {
        const parsed = parseDataUrl(file);
        return {
          id: file.id,
          name: String(file.name || 'upload'),
          size: parsed.fileData.length,
          type: parsed.fileType,
          data: parsed.fileData
        };
      }
    }
  }
  return null;
}

const postgresRepository = {
  mode: 'postgres',
  listRequests: listRequestsPg,
  createRequest: createRequestPg,
  updateRequest: updateRequestPg,
  listEligible: listEligiblePg,
  upsertEligibleRecords: upsertEligibleRecordsPg,
  signupApplicant: signupApplicantPg,
  getEligible: getEligiblePg,
  findEligibleLogin: findEligibleLoginPg,
  updateEligible: updateEligiblePg,
  deleteEligible: deleteEligiblePg,
  getVisaPricing: getVisaPricingPg,
  updateVisaPricing: updateVisaPricingPg,
  listApplications: listApplicationsPg,
  getApplication: getApplicationPg,
  getApplicationByPaymentReference: getApplicationByPaymentReferencePg,
  upsertApplication: upsertApplicationPg,
  updateApplication: updateApplicationPg,
  updateApplicationPayment: updateApplicationPaymentPg,
  setApplicationDocument: setApplicationDocumentPg,
  getApplicationDocument: getApplicationDocumentPg
};

const jsonRepository = {
  mode: 'json',
  listRequests: listRequestsJson,
  createRequest: createRequestJson,
  updateRequest: updateRequestJson,
  listEligible: listEligibleJson,
  upsertEligibleRecords: upsertEligibleRecordsJson,
  signupApplicant: signupApplicantJson,
  getEligible: getEligibleJson,
  findEligibleLogin: findEligibleLoginJson,
  updateEligible: updateEligibleJson,
  deleteEligible: deleteEligibleJson,
  getVisaPricing: getVisaPricingJson,
  updateVisaPricing: updateVisaPricingJson,
  listApplications: listApplicationsJson,
  getApplication: getApplicationJson,
  getApplicationByPaymentReference: getApplicationByPaymentReferenceJson,
  upsertApplication: upsertApplicationJson,
  updateApplication: updateApplicationJson,
  updateApplicationPayment: updateApplicationPaymentJson,
  setApplicationDocument: setApplicationDocumentJson,
  getApplicationDocument: getApplicationDocumentJson
};

module.exports = hasDatabase ? postgresRepository : jsonRepository;
