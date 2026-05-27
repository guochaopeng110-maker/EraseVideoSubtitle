# Local Disk Hosting for Uploaded Videos

We decided to support direct local video uploads and host them temporarily on the server's local disk to act as the publicly accessible **Source Video** for the Volcano Engine API.

## Context

The Volcano Engine Subtitle Erase API requires a public HTTP/HTTPS URL. Since the website will be deployed to a public server, we can leverage the server's own public domain to serve uploaded files.

## Decision

1. By default, uploaded files will be stored in a temporary folder (`public/uploads/` or a dedicated system directory) and exposed via a public URL generated dynamically from the request headers (e.g. `https://your-domain.com/uploads/filename.mp4`).
2. An abstraction layer (Storage Adapter) will be introduced in the backend, supporting `local` storage as the default. This layer can be easily extended to `oss` / `s3` in the future by updating `.env` configurations.
3. A background cleanup job or inline hook will delete the uploaded file once the **Erase Task** finishes (succeeds or fails) or exceeds a predefined timeout (e.g., 30 minutes), preventing disk space issues.
