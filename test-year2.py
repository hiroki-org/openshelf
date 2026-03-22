with open("apps/web/src/components/papers/edit-form.tsx", "r") as f:
    content = f.read()

# Ah, it's a try-catch error, so it's setting `error` via the catch block which prints `err.message`
print(content[content.find("} catch (err: unknown) {"):content.find("} catch (err: unknown) {") + 200])
