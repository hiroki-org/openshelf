with open("apps/web/src/components/papers/edit-form.tsx", "r") as f:
    content = f.read()

# Let's see what the actual validation error text is
print(content[content.find("年は数値"):content.find("年は数値")+100])
