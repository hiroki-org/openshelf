with open("apps/web/src/app/__tests__/paper-edit-page.test.tsx", "r") as f:
    content = f.read()

# Fix DOM leakage by adding testing-library cleanup and vi.clearAllMocks() in beforeEach
content = "import { cleanup } from '@testing-library/react';\n" + content
content = content.replace("    authState = { user: { id: \"user-1\" }, loading: false };\n  });", "    authState = { user: { id: \"user-1\" }, loading: false };\n  });\n\n  afterEach(() => {\n    cleanup();\n  });")


with open("apps/web/src/app/__tests__/paper-edit-page.test.tsx", "w") as f:
    f.write(content)
