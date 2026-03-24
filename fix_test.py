with open("apps/web/src/components/papers/__tests__/edit-form.test.tsx", "r") as f:
    content = f.read()

content = content.replace('target: { value: "not-a-number" }', 'target: { value: "e" }')

with open("apps/web/src/components/papers/__tests__/edit-form.test.tsx", "w") as f:
    f.write(content)
