# Cloud Storage Hub

A personal cloud file manager built with Next.js, Supabase Auth/Postgres, Cloudflare R2, GitHub and Vercel.

**Use only for personal files or files you are authorized to store and transfer. Do not use this application to bypass workplace data-loss-prevention rules or transfer employer/client information without written approval.**

## Features
- Email/password sign-up and sign-in through Supabase Auth
- Private Cloudflare R2 bucket; no public object access
- Folder creation and navigation (including nested folders)
- Multi-file upload directly from browser to R2 using short-lived presigned URLs
- Download links expire after five minutes
- Delete files
- Search current folder
- 100 GiB quota target and storage usage display
- Supabase row-level security for per-user metadata isolation

## Architecture
- Vercel hosts the Next.js application and API routes.
- Supabase Auth authenticates users.
- Supabase PostgreSQL stores folders and file metadata.
- Cloudflare R2 stores file bytes. Files do not pass through Vercel serverless functions.

## Prerequisites
- GitHub account
- Vercel account
- Supabase project
- Cloudflare account with R2 enabled
- Node.js 20.9+ locally

## 1. Create Supabase project
1. Create a project at https://supabase.com.
2. Open **SQL Editor** and run `supabase/schema.sql`.
3. In **Project Settings > API**, copy the Project URL and anon/publishable key.
4. In **Authentication > URL Configuration**, add your Vercel deployment URL to Site URL / Redirect URLs. For local development add `http://localhost:3000/**`.
5. In **Authentication > Providers > Email**, configure email confirmation as desired. For production, keep email verification enabled and configure SMTP.

## 2. Create Cloudflare R2 bucket
1. In Cloudflare Dashboard, open **R2 Object Storage** and create a private bucket named `cloud-storage-hub` (or your chosen name).
2. Create an R2 API token with **Object Read & Write** permission scoped only to this bucket.
3. Copy the Access Key ID and Secret Access Key once; keep them private.
4. Note your Cloudflare Account ID and use endpoint:
   `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
5. Do not enable public bucket access or attach a public custom domain.

### R2 CORS
In the R2 bucket CORS settings, add a rule allowing your app origin(s), e.g.:
```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://YOUR-APP.vercel.app"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type", "*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```
Replace the Vercel URL with your actual domain. Avoid wildcard origins in production.

## 3. Configure locally
1. Extract this ZIP.
2. Copy `.env.example` to `.env.local`.
3. Fill in all Supabase and R2 values.
4. Install and run:
```bash
npm install
npm run dev
```
5. Open http://localhost:3000, create an account and test with non-sensitive sample files.

## 4. Deploy with GitHub + Vercel
1. Create a new private GitHub repository.
2. Upload/push all files in this folder (do not upload `.env.local`).
3. In Vercel, choose **Add New > Project**, import the GitHub repository.
4. Add every variable from `.env.example` under **Project Settings > Environment Variables** for Production, Preview and Development as appropriate.
5. Deploy.
6. Add the final Vercel domain to Supabase Auth URL configuration and the R2 CORS AllowedOrigins list.
7. Redeploy after changing environment variables.

## 5. Capacity and cost
- App quota: 100 GiB (100 * 1024^3 bytes).
- Default maximum single file: 5 GiB. Change `MAX_FILE_SIZE_BYTES` if needed.
- Cloudflare R2 is billed separately from Vercel and Supabase. At the commonly published Standard storage rate of US$0.015 per GB-month, 100 GB is roughly US$1.50/month for storage alone, before operations, applicable taxes and any plan changes. Verify current pricing at https://developers.cloudflare.com/r2/pricing/ before deployment.
- Supabase database/auth and Vercel hosting have their own plan limits. The app's 100 GiB quota is an application limit; it does not purchase or reserve storage capacity. Ensure your R2 account billing and limits support your usage.

## Security and operational notes
- Never commit `.env.local` or expose R2 secret keys in `NEXT_PUBLIC_*` variables.
- Use a unique strong password and enable email verification.
- Keep the R2 bucket private. The app generates temporary signed URLs.
- The current quota check is application-level and can be subject to simultaneous-upload races. For multi-user or business-critical use, add a transactional quota-reservation RPC and scheduled cleanup of abandoned `pending` uploads.
- The 100 GiB limit is per app deployment/account usage as currently calculated by the authenticated user's database rows. It is not a provider-side hard cap.
- A pending upload can remain if the browser is closed mid-upload. For production, add a scheduled cleanup job for old pending records and orphaned R2 objects.
- Consider malware scanning, file-type restrictions, audit retention, MFA and backups before storing important data.
- This starter does not implement folder rename/move or folder deletion. It is a functional base for upload, download, create-folder, search and delete-file workflows.

## Troubleshooting
- **Upload CORS error:** add the exact site origin to the R2 CORS rule and retry.
- **401:** confirm Supabase URL/key and sign in again.
- **500 from API:** inspect Vercel Function Logs and verify all R2 environment variables.
- **No email arrives:** check Supabase Auth email settings / SMTP and spam folder.
- **Upload too large:** adjust `MAX_FILE_SIZE_BYTES`; browser and R2 presigned PUT limits also apply.

## Important
This project is a starter application, not a certified enterprise document-management or backup system. Test restore/download and access controls before relying on it.
