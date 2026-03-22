with open("apps/web/src/components/papers/edit-form.tsx", "r") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 270 <= i+1 <= 380:
        print(f"{i+1}: {line}", end="")
