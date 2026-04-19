import sys

def fix_tests(file_path):
    with open(file_path, 'r') as f:
        content = f.read()

    old_test = 'tags: JSON.stringify(["valid-tag", "another-tag"])'
    new_test = 'tags: JSON.stringify(["Valid-Tag", "another-tag"])'

    content = content.replace(old_test, new_test)

    with open(file_path, 'w') as f:
        f.write(content)

fix_tests('apps/api/src/routes/__tests__/papers.test.ts')
