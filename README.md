# Alamir Operations Platform — Phase 1

Internal operations platform for Alamir International Trading L.L.C.
Phase 1: Landing page, internal login, and KYC verification workflow.

## Project Structure

```
src/
  app/
    page.js                          Landing page
    layout.js                        Root layout
    globals.css                      Global styles
    login/page.js                    Login page
    dashboard/page.js                KYC stats dashboard
    kyc/
      page.js                        KYC request list
      new/page.js                    Create KYC request (Admin)
      review/[id]/page.js            Review KYC + update status
      submit/[token]/page.js         Client document upload portal
    api/
      auth/login/route.js            POST - login
      auth/seed/route.js             POST - seed initial user
      auth/me/route.js               GET  - current user info
      kyc/stats/route.js             GET  - KYC statistics
      kyc/list/route.js              GET  - all KYC requests
      kyc/create/route.js            POST - create KYC request
      kyc/[id]/docs/route.js         GET  - documents for a KYC
      kyc/[id]/status/route.js       PATCH - update KYC status
      kyc/doc/download/[fileId]/     GET  - download file from Drive
      kyc/portal/[token]/route.js    GET  - validate client token
      kyc/portal/[token]/upload/     POST - client uploads documents
  lib/
    google-auth.js                   Google service account auth
    sheets.js                        Google Sheets CRUD operations
    drive.js                         Google Drive upload/download
    email.js                         SMTP email (invite + status)
    token.js                         Secure token generation + hashing
    auth.js                          JWT verification + role checks
    api-client.js                    Frontend API client
  components/
    AuthProvider.js                  Auth context + JWT persistence
    ProtectedLayout.js               Auth guard + role check + navbar
    Navbar.js                        Navigation bar
```

## Prerequisites

- Node.js 18+
- Google Cloud service account (Sheets + Drive API enabled)
- SMTP credentials

## Setup

### 1. Create `.env` file

Copy `.env.example` to `.env` and fill in all values:

```
GOOGLE_PROJECT_ID=your-project-id
GOOGLE_CLIENT_EMAIL=your-sa@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEET_ID=your-sheet-id-from-url
KYC_DRIVE_FOLDER_ID=your-drive-folder-id

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=your-app-password

APP_BASE_URL=http://localhost:3000
JWT_SECRET=any-strong-random-string
```

### 2. Set up Google Sheet

Create a Google Sheet with 4 tabs. Row 1 of each tab must have these headers:

| Tab | Headers |
|-----|---------|
| **Users** | `email` · `passwordHash` · `role` · `createdAt` |
| **KYC** | `id` · `clientName` · `companyName` · `email` · `tokenHash` · `tokenExpiry` · `status` · `remarks` · `createdBy` · `createdAt` · `updatedAt` |
| **KYC_Docs** | `kycId` · `docType` · `driveFileId` · `fileName` · `uploadedAt` |
| **Audit** | `timestamp` · `action` · `actor` · `kycId` · `details` |

Share the sheet with your service account email (Editor).

### 3. Set up Google Drive folder

Create a folder, share it with service account email (Editor), copy folder ID from URL.

### 4. Run

```bash
npm install
npm run dev
```

App runs at **http://localhost:3000**

### 5. Create first admin user

```bash
curl -X POST http://localhost:3000/api/auth/seed -H "Content-Type: application/json" -d "{\"email\":\"admin@alamir.ae\",\"password\":\"YourPassword\",\"role\":\"Admin\",\"seedSecret\":\"YOUR_JWT_SECRET_VALUE\"}"
```

## Workflow

1. Admin logs in → `/login`
2. Dashboard shows KYC stats → `/dashboard`
3. Admin creates KYC request → `/kyc/new` → email sent to client
4. Client opens link → `/kyc/submit/<token>` → uploads documents
5. KYC Team reviews → `/kyc/review/<id>` → downloads docs, updates status
6. On Approve/Reject → client receives email notification

## Security

- Passwords: bcrypt (12 rounds)
- KYC tokens: 32 random bytes, SHA-256 hashed, 7-day expiry
- Files: type-checked (PDF/JPEG/PNG/WebP), max 10MB, private Drive storage
- All actions logged to Audit sheet
