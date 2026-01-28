# Starter for Kriebel LLC

Starter SaaS website template, complete with website, api, worker, component library, DB, and more!

## Packages:
- components: UI library; Should depend only on shared
- shared: logic, database, utils for use across all packages; Should not be dependent on other packages
- web: user-interactible web frontend & API server backend; Should not be dependency of other packages
- worker: background, async crons, queues, and other backlend services; Should not be dependency of other packages

## Built on

Original template was formed from [Taxonomy](https://github.com/shadcn/taxonomy) and:

- [Next.js](https://nextjs.org/) as the React framework
- [shadcn/ui](https://ui.shadcn.com/) for the component library
- [Tailwind](https://tailwindcss.com/) for CSS styling
- [Drizzle](https://github.com/drizzle-team/drizzle-orm) as the ORM for database access
- [Cloudflare D1](https://developers.cloudflare.com/d1/) as the database (SQLite)
- [Firebase](https://github.com/awinogrodzki/next-firebase-auth-edge) for authentication
- [Cloudflare Pages](https://pages.cloudflare.com/) for web deployment & APIs
- Cloudflare Workers for Crons, Queus, Webhook handlers, any generally any other async backend/background service
- Axiom for logging
- [Webpack](https://webpack.js.org/) via Next.js and Cloudflare workers for JS build system/bundler
- [Prettier](https://prettier.io/) for code formatting and auto-styling
- [ESLint](https://eslint.org/) for linting
- [nanoid](https://github.com/ai/nanoid) for unique identifiers

## Caveats

- `FIREBASE_PRIVATE_KEY` should be stripped of all \n. Cloudflare environment variables do not seem to escape/unescape these properly, at least when entered from the dashboard.
- `AUTH_COOKIE_SIGNATURE_1`  & `AUTH_COOKIE_SIGNATURE_2` must not contains special characters (likely =, but maybe others)

## Databases

Use Cloudflare D1 for SQLite databases. Use Drizzle for ORM

## Styleguide

- Id not ID

- `UpperCamelCase`: class / interface / type / enum / decorator
- `lowerCamelCase`: variable / parameter / function / method / property / module alias
- `CONSTANT_CASE`: global constant values, including enum values

When in doubt, fallback to https://google.github.io/styleguide/tsguide.html

## Request & Response
- Prefer `NextRequest` to `Request` and `NextResponse` to `Response` in `web` package
- Prefer `NextResponse.json` && `NextResponse.redirect` over `new NextResponse`
- When there's nothing to valuable to send, response with `null` and rely on response codes on the client
- For error responses, always response in the format `{ error: "error message" }`
- Always use `routeHandler` and `noAuthRouteHandler`
- Omit `{ status: 200 }` since that's the default