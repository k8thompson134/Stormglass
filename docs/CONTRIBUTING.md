# Contributing to Stormglass

Thank you for your interest in contributing! This document provides guidelines and instructions.

## Development Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 16
- Git

### Local Development

1. Clone and set up:
```bash
git clone <repo>
cd stormglass
npm install
```

2. Set up environment:
```bash
cp .env.example .env
# Edit .env with local database connection
```

3. Start services:
```bash
# Terminal 1: Database and MQTT
docker-compose up

# Terminal 2: Backend
cd backend
npm run dev

# Terminal 3: Frontend
cd frontend
npm run dev
```

## Code Style

- **TypeScript**: Strict mode, explicit types
- **Formatting**: 2-space indentation, enforced via EditorConfig
- **Naming**: camelCase for variables/functions, PascalCase for components/classes
- **Imports**: Absolute imports preferred (via path aliases)

## Commit Guidelines

- Use conventional commits: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `style:`, `chore:`
- Example: `feat: add pressure derivative calculation`
- Keep commits focused on single concerns

## Pull Request Process

1. Create feature branch: `git checkout -b feature/description`
2. Implement changes with tests
3. Ensure all tests pass: `npm test`
4. Lint and format: `npm run lint && npm run format`
5. Open PR with clear description of changes
6. Address review feedback
7. Merge when approved

## Testing

- Unit tests for utilities and logic
- Integration tests for API endpoints
- E2E tests for critical user flows (TBD)

```bash
npm test                 # Run all tests
npm test -- --watch     # Watch mode
```

## Feature Development

### Adding an API Endpoint

1. Define types in `shared/types/`
2. Create route handler in `backend/src/api/`
3. Connect in `backend/src/server.ts`
4. Add integration test
5. Document in `docs/api-specs/`

### Adding a Frontend Page

1. Create component in `frontend/src/pages/`
2. Add route in `frontend/src/App.tsx`
3. Create supporting components in `frontend/src/components/`
4. Add types in `frontend/src/types/`
5. Write unit tests

### Database Changes

1. Create Drizzle migration: `npm run db:generate -- --name migration_name`
2. Review generated SQL
3. Apply: `npm run db:migrate`
4. Update schema in `backend/src/db/schema.ts`
5. Add tests for new queries

## Documentation

- Keep README.md and architecture docs up to date
- Document API endpoints in `docs/api-specs/`
- Add comments for complex algorithms
- Update CHANGELOG.md for releases

## Reporting Issues

Include:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Browser/environment info
- Screenshots if applicable

## Questions?

Open a GitHub issue with the `question` label or start a discussion.

Thank you for contributing to Stormglass!
