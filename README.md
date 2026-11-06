![image](https://github.com/user-attachments/assets/2d913c09-d73c-482c-9eca-5d842c61336c)

           ❤️OCODEJS CLI HUB❤️
 # OCodeJS CLI Hub

Danh mục tuyển chọn các công cụ terminal/TUI cho developer và AI agents. Website tĩnh được host bằng GitHub Pages; dữ liệu danh mục nằm trong `tools.json`.

## Danh mục hiện tại

Mỗi mục có mô tả, ngôn ngữ, nhóm, lệnh cài đặt và liên kết tới repository upstream đã xác minh. Lệnh dùng Homebrew cần cài Homebrew trước; các công cụ AI có thể có yêu cầu runtime riêng theo tài liệu upstream.

## Workspace trên trình duyệt

CLI Hub có 51 trang điều hướng. Các chức năng Workspace hiện đã hoạt động ở mức local-first:

- **Dashboard**: tổng hợp số project, công cụ và favorites; hiển thị hoạt động gần đây.
- **Projects / New Project**: tạo, xem và xóa project metadata trong trình duyệt.
- **Environments**: hiển thị trạng thái các runtime và tích hợp đã cấu hình.
- **Activity & Logs**: ghi nhận thao tác project trong browser-local activity log.

Prompt của Agents, project metadata và activity được lưu bằng `localStorage` trên thiết bị/trình duyệt hiện tại. Dữ liệu không tự đồng bộ giữa thiết bị, không phải server audit log và có thể mất khi người dùng xóa dữ liệu trình duyệt. Tạo project hiện chỉ lưu metadata; chưa sinh source code, chạy terminal, kết nối database, cấp credentials hoặc deploy ứng dụng.

## Cấu trúc

- `index.html`: giao diện responsive, tìm kiếm, lọc, xem chi tiết và gửi đề xuất.
- `tools.json`: registry JSON.
- `scripts/validate.mjs`: kiểm tra schema, ID, URL HTTPS và lệnh cài đặt.
- `tests/catalog.test.mjs`: unit tests dùng Node.js built-in test runner.
- `.github/workflows/validate.yml`: CI trên Pull Request và push vào `main`.
- `.github/workflows/static.yml`: GitHub Pages deployment workflow.

## Yêu cầu

- Node.js 20+
- npm đi kèm Node.js
- Homebrew chỉ cần thiết nếu dùng các lệnh `brew install` trong danh mục.

## Chạy local

```bash
npm run validate
npm test
npx serve .
```

Mở URL local do `serve` cung cấp. Không mở HTML bằng `file://`, vì trình duyệt sẽ chặn fetch `tools.json`.

## Thêm công cụ

1. Mở **+ Gửi công cụ** trên website hoặc tạo Issue theo mẫu **Tool submission**.
2. Maintainer xác minh tên, mô tả, lệnh cài đặt và repository upstream.
3. Thêm entry vào `tools.json` bằng Pull Request.
4. CI phải xanh trước khi merge.
5. Việc thêm công cụ không tự chạy lệnh cài đặt và không thực thi mã từ repository upstream.

## Schema

```json
{
  "id": "my-tool",
  "name": "my-tool",
  "description": "Mô tả ngắn.",
  "language": "Rust",
  "category": "Git",
  "install": "cargo install my-tool",
  "repo": "https://github.com/owner/my-tool"
}
```

Các trường `id`, `name`, `description`, `language`, `category` và `install` bắt buộc. `repo` bắt buộc và phải là URL HTTPS hợp lệ. Mọi entry đều cần upstream source để người dùng tự kiểm tra.

## GitHub Pages

Repository đã bật Pages. Kiểm tra **Settings → Pages → Build and deployment** để xác nhận nguồn là **GitHub Actions**. Pull Request chỉ chạy CI; deploy workflow chỉ chạy trên push vào `main` hoặc thao tác thủ công.


## Community library discovery

Home giới thiệu các thư viện frontend/backend tiêu biểu với logo thương hiệu lấy từ [Simple Icons](https://simpleicons.org) CDN, website chính thức, GitHub upstream và npm package page. Banner GIF là nội dung minh họa từ Giphy.

Khu vực **Community / Popular Libraries** gọi npm Downloads API cho từng package và sắp xếp các package đã nhận được dữ liệu theo lượt tải của 30 ngày gần nhất. Đây là bảng xếp hạng tương đối trong danh sách thư viện tuyển chọn của OCode.js, không đại diện cho toàn bộ hệ sinh thái npm. Khi npm API không phản hồi, giao diện đánh dấu dữ liệu không khả dụng thay vì tự tạo số liệu.

- npm downloads API: https://github.com/npm/registry/blob/main/docs/download-counts.md
- Simple Icons CDN: https://github.com/simple-icons/simple-icons#cdn-usage


## Expanded navigation

The CLI Hub navigation contains 51 unique page routes across 11 groups: Workspace, Development, AI Agents, Tools, Developer Hub, System, Project Management, Code Quality, Testing & QA, Deploy & Infrastructure, and Community & Resources. The mobile hamburger drawer includes a searchable navigation field and a vertically scrollable page list. Newly added routes are UI foundations; external integrations, real builds, terminal execution, deployment and monitoring require their respective backends and are not represented as active services.


## Brand assets and iconography

Community library cards load their brand marks from Simple Icons using the corresponding brand color hex values. Navigation and CLI tool cards use the Lucide icon set, initialized after the deferred CDN script loads and refreshed after route rendering. The animated Home banner keeps its source GIF and uses full saturation with a subtle color overlay. Brand assets are loaded from external CDNs and require network access in the browser.


## Marketplace hub

The **Marketplace** page links to the official Visual Studio Code Marketplace, GitHub Marketplace, and Google Cloud Marketplace. Each provider card includes a direct catalog link and official documentation. These are outbound discovery links only; extension installation, account authorization, purchasing, and synchronization are not implemented until provider APIs and credentials are configured. Marketplace is also available from Home quick access.


## GitHub Authentication

The CLI Hub frontend has a GitHub login dialog supporting OAuth, PAT connection, session status, logout and credential disconnect. The default production API is `https://auth.ocodejs.dev`.

The recommended zero-cost deployment uses a **separate Cloudflare Worker + D1 database on the Free plan**, isolated from the existing `ocodejs-cli` static-assets Worker. The Worker source and D1 migration live in `auth-worker/`. It encrypts GitHub credentials with AES-GCM, hashes session/CSRF identifiers with HMAC, uses Secure HttpOnly cookies, exact-origin CORS, OAuth state validation and per-IP rate limits.

The existing Express/PostgreSQL implementation in `auth-server/` is retained as an optional self-hosted alternative. The public frontend does not depend on it.

**Real login is not active until the separate Worker and D1 database are deployed, the `auth.ocodejs.dev` hostname is attached, and a dedicated GitHub OAuth App's client ID/secret are configured as Cloudflare Worker secrets.** PAT connection can be used after the Worker and its encryption/session secrets are configured. Never commit real credentials or put them in frontend code.


## Custom domain: ocodejs.dev

The OCode.js CLI Hub is intended to use **https://ocodejs.dev/** as its canonical public URL. The repository publishes the `CNAME` file at the site root so GitHub Pages can associate the custom domain with this project. The `www.ocodejs.dev` hostname should resolve to the same Pages site and redirect to the apex domain. Keep the existing `app` and `mcp` subdomains on their separate services.

DNS and Pages ownership must be verified before considering the custom domain live. Do not replace unrelated DNS records or the existing Worker bindings while configuring this domain.
