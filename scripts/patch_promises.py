import re

with open('apps/api/src/routes/papers.ts', 'r') as f:
    content = f.read()

# Pattern 1 (Line 510-512) - catch block
old_pattern1 = """for \\(let i = 0; i < uploadedKeys\\.length; i \\+= 1000\\) \\{\\s+await c\\.env\\.BUCKET\\.delete\\(uploadedKeys\\.slice\\(i, i \\+ 1000\\)\\);\\s+\\}"""
new_pattern1 = """const chunks = [];
        for (let i = 0; i < uploadedKeys.length; i += 1000) {
            chunks.push(c.env.BUCKET.delete(uploadedKeys.slice(i, i + 1000)));
        }
        await Promise.allSettled(chunks);"""
content = re.sub(old_pattern1, new_pattern1, content)

# Pattern 2 (Line 1065-1067) - DELETE route
old_pattern2 = """const keys = files\\.map\\(\\(f\\) => f\\.r2Key\\);\\s+for \\(let i = 0; i < keys\\.length; i \\+= 1000\\) \\{\\s+await c\\.env\\.BUCKET\\.delete\\(keys\\.slice\\(i, i \\+ 1000\\)\\);\\s+\\}"""
new_pattern2 = """const keys = files.map((f) => f.r2Key);
    const chunks = [];
    for (let i = 0; i < keys.length; i += 1000) {
        chunks.push(c.env.BUCKET.delete(keys.slice(i, i + 1000)));
    }
    await Promise.all(chunks);"""
content = re.sub(old_pattern2, new_pattern2, content)

with open('apps/api/src/routes/papers.ts', 'w') as f:
    f.write(content)
