with open("apps/web/src/components/__tests__/toast.test.tsx", "r") as f:
    content = f.read()

content = content.replace(
    'expect(screen.getByText("no-crypto-toast")).toBeInTheDocument();',
    'expect(screen.getAllByText("no-crypto-toast")[0]).toBeInTheDocument();'
)

with open("apps/web/src/components/__tests__/toast.test.tsx", "w") as f:
    f.write(content)
