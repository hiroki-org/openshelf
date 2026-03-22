with open("apps/web/src/components/papers/edit-form.tsx", "r") as f:
    content = f.read()

# Let's inspect the year parsing
print(content[content.find("const parsedYear = year ? parseInt("):content.find("const parsedYear = year ? parseInt(") + 200])
