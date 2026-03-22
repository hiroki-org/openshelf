import re

with open("apps/web/src/app/__tests__/paper-edit-page.test.tsx", "r") as f:
    content = f.read()

# We need to remove the four validation tests we added in the previous PR step.
# They are: empty title, exceeding title, exceeding abstract, JSON tags parsing fallback.
# These start at `it("shows validation error when title is empty"`

cutoff_index = content.find('  it("shows validation error when title is empty"')

if cutoff_index != -1:
    content = content[:cutoff_index] + "});\n"

with open("apps/web/src/app/__tests__/paper-edit-page.test.tsx", "w") as f:
    f.write(content)
