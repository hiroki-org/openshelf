with open("apps/web/src/components/papers/__tests__/edit-form.test.tsx", "r") as f:
    content = f.read()

# Testing library `fireEvent.click` on checkboxes changes state, whereas `change` with `value` can be tricky
content = content.replace(
    'fireEvent.change(screen.getByLabelText(/公開ページに閲覧数を表示する/i), { target: { checked: true } });',
    'fireEvent.click(screen.getByLabelText(/公開ページに閲覧数を表示する/i));'
)

with open("apps/web/src/components/papers/__tests__/edit-form.test.tsx", "w") as f:
    f.write(content)
